import io
import zipfile
from collections import Counter
from flask import Flask, jsonify, request, render_template, abort, send_file
from config import Config
from models import Grade, Subject, Wallet, RewardConfig, AppConfig, LoadStatus
from storage import (
    load_app_config, save_app_config,
    load_subjects,   save_subjects,
    load_wallet,     save_wallet,
    load_reward_config, save_reward_config,
)

app = Flask(__name__)
app.config.from_object(Config)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_all():
    app_config, _    = load_app_config(Config.APP_CONFIG_PATH)
    subjects, _      = load_subjects(app_config.data_path)
    wallet, _        = load_wallet(app_config.wallet_path)
    reward_config, _ = load_reward_config(app_config.reward_config_path)
    return app_config, subjects, wallet, reward_config

def _save_all(app_config, subjects, wallet, reward_config):
    save_app_config(app_config,      app_config.app_config_path)
    save_subjects(subjects,          app_config.data_path)
    save_wallet(wallet,              app_config.wallet_path)
    save_reward_config(reward_config, app_config.reward_config_path)

def _subject_index(subjects, name):
    for i, s in enumerate(subjects):
        if s.name == name:
            return i
    return -1

# ---------------------------------------------------------------------------
# Frontend
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    return render_template("index.html")

# ---------------------------------------------------------------------------
# API – Subjects
# ---------------------------------------------------------------------------

@app.route("/api/subjects", methods=["GET"])
def get_subjects():
    _, subjects, _, _ = _load_all()
    return jsonify([s.to_dict() for s in subjects])

@app.route("/api/subjects", methods=["POST"])
def create_subject():
    data = request.get_json(force=True)
    name = (data.get("name") or "").strip()
    if not name:
        abort(400, "name is required")
    app_config, subjects, wallet, reward_config = _load_all()
    if any(s.name == name for s in subjects):
        abort(409, f"Subject '{name}' already exists")
    subjects.append(Subject(name))
    _save_all(app_config, subjects, wallet, reward_config)
    return jsonify({"name": name}), 201

@app.route("/api/subjects/<string:subject_name>", methods=["DELETE"])
def delete_subject(subject_name):
    app_config, subjects, wallet, reward_config = _load_all()
    idx = _subject_index(subjects, subject_name)
    if idx == -1:
        abort(404, f"Subject '{subject_name}' not found")
    subjects.pop(idx)
    _save_all(app_config, subjects, wallet, reward_config)
    return "", 204

@app.route("/api/subjects/reorder", methods=["POST"])
def reorder_subjects():
    """Reorder subjects. Body: { "order": ["name1", "name2", …] }"""
    data  = request.get_json(force=True)
    order = data.get("order", [])
    app_config, subjects, wallet, reward_config = _load_all()

    name_to_subject = {s.name: s for s in subjects}
    # Only reorder subjects that exist; ignore unknown names
    reordered = [name_to_subject[n] for n in order if n in name_to_subject]
    # Append any subjects not mentioned in the order list at the end
    mentioned = set(order)
    for s in subjects:
        if s.name not in mentioned:
            reordered.append(s)

    _save_all(app_config, reordered, wallet, reward_config)
    return jsonify([s.to_dict() for s in reordered])

# ---------------------------------------------------------------------------
# API – Grades
# ---------------------------------------------------------------------------

@app.route("/api/subjects/<string:subject_name>/grades", methods=["POST"])
def add_grade(subject_name):
    data = request.get_json(force=True)
    app_config, subjects, wallet, reward_config = _load_all()
    idx = _subject_index(subjects, subject_name)
    if idx == -1:
        abort(404, f"Subject '{subject_name}' not found")
    try:
        value  = float(data["value"])
        weight = float(data.get("weight", 1.0))
        labels = data.get("labels", [])
    except (KeyError, TypeError, ValueError):
        abort(400, "value (float) required; weight (float) and labels ([str]) optional")
    grade = Grade(value, weight, labels)
    if not grade.is_valid():
        abort(400, "value must be 1–6 and weight must be > 0")
    subjects[idx].add_grade(grade)
    earned = reward_config.units_for_points(reward_config.points_for_grade(value)) if reward_config.enabled else None
    if reward_config.enabled and earned:
        wallet.balance += earned
    wallet.log_grade_event("+", subject_name, value, weight, labels, value_delta=earned)
    _save_all(app_config, subjects, wallet, reward_config)
    return jsonify(grade.to_dict()), 201

@app.route("/api/subjects/<string:subject_name>/grades/<int:grade_index>", methods=["PUT"])
def edit_grade(subject_name, grade_index):
    data = request.get_json(force=True)
    app_config, subjects, wallet, reward_config = _load_all()
    idx = _subject_index(subjects, subject_name)
    if idx == -1:
        abort(404)
    subject = subjects[idx]
    if grade_index < 0 or grade_index >= len(subject.grades):
        abort(404, f"Grade index {grade_index} out of range")
    old   = subject.grades[grade_index]
    nv    = float(data["value"])  if "value"  in data else old.value
    nw    = float(data["weight"]) if "weight" in data else old.weight
    nl    = data["labels"]        if "labels" in data else old.labels
    new_g = Grade(nv, nw, nl)
    if not new_g.is_valid():
        abort(400, "value must be 1–6 and weight must be > 0")
    value_delta = None
    if reward_config.enabled:
        value_delta = (reward_config.units_for_points(reward_config.points_for_grade(nv)) -
                       reward_config.units_for_points(reward_config.points_for_grade(old.value)))
        wallet.balance += value_delta
    subject.grades[grade_index] = new_g
    wallet.log_grade_event("~", subject_name, nv, nw, nl, value_delta=value_delta)
    _save_all(app_config, subjects, wallet, reward_config)
    return jsonify(new_g.to_dict())

@app.route("/api/subjects/<string:subject_name>/grades/<int:grade_index>", methods=["DELETE"])
def delete_grade(subject_name, grade_index):
    app_config, subjects, wallet, reward_config = _load_all()
    idx = _subject_index(subjects, subject_name)
    if idx == -1:
        abort(404)
    subject = subjects[idx]
    if grade_index < 0 or grade_index >= len(subject.grades):
        abort(404)
    grade  = subject.grades[grade_index]
    adjust = request.args.get("adjust_wallet", "0") == "1"
    value_delta = None
    if reward_config.enabled and adjust:
        lost = reward_config.units_for_points(reward_config.points_for_grade(grade.value))
        wallet.balance -= lost
        value_delta = -lost
    wallet.log_grade_event("-", subject_name, grade.value, grade.weight, grade.labels, value_delta=value_delta)
    subject.remove_grade(grade_index)
    _save_all(app_config, subjects, wallet, reward_config)
    return "", 204

# ---------------------------------------------------------------------------
# API – Wallet
# ---------------------------------------------------------------------------

@app.route("/api/wallet", methods=["GET"])
def get_wallet():
    _, _, wallet, reward_config = _load_all()
    return jsonify({
        **wallet.to_dict(),
        "formatted_balance": reward_config.format_value(wallet.balance) if reward_config.enabled else None,
    })

@app.route("/api/wallet/redeem", methods=["POST"])
def redeem():
    data = request.get_json(force=True)
    app_config, subjects, wallet, reward_config = _load_all()
    if not reward_config.enabled:
        abort(400, "Reward system is disabled")
    try:
        cost = float(data["cost"])
    except (KeyError, TypeError, ValueError):
        abort(400, "cost (float) is required")
    if cost <= 0:
        abort(400, "cost must be > 0")
    if cost > wallet.balance:
        abort(400, f"Insufficient balance: {wallet.balance:.2f}")
    wallet.redeem(cost, (data.get("description") or "<keine Beschreibung>").strip())
    _save_all(app_config, subjects, wallet, reward_config)
    return jsonify(wallet.to_dict())

# ---------------------------------------------------------------------------
# API – Reward config
# ---------------------------------------------------------------------------

@app.route("/api/reward-config", methods=["GET"])
def get_reward_config():
    _, _, _, reward_config = _load_all()
    return jsonify(reward_config.to_dict())

@app.route("/api/reward-config", methods=["POST"])
def update_reward_config():
    data = request.get_json(force=True)
    app_config, subjects, wallet, _ = _load_all()
    try:
        new_config = RewardConfig.from_dict(data)
    except (KeyError, TypeError, ValueError) as e:
        abort(400, f"Invalid reward config: {e}")
    _save_all(app_config, subjects, wallet, new_config)
    return jsonify(new_config.to_dict())

# ---------------------------------------------------------------------------
# API – App config
# ---------------------------------------------------------------------------

@app.route("/api/app-config", methods=["GET"])
def get_app_config():
    app_config, _, _, _ = _load_all()
    return jsonify(app_config.to_dict())

# ---------------------------------------------------------------------------
# API – Overview
# ---------------------------------------------------------------------------

@app.route("/api/overview", methods=["GET"])
def get_overview():
    _, subjects, _, _ = _load_all()
    result = []
    total_value = total_weight = 0.0
    for s in subjects:
        avg = s.average()
        result.append({"name": s.name, "average": round(avg, 4), "grade_count": len(s.grades)})
        for g in s.grades:
            total_value  += g.value  * g.weight
            total_weight += g.weight
    overall = round(total_value / total_weight, 4) if total_weight else None
    return jsonify({"subjects": result, "overall_average": overall})

# ---------------------------------------------------------------------------
# API – Export
# ---------------------------------------------------------------------------

@app.route("/api/export", methods=["GET"])
def get_export():
    _, subjects, wallet, reward_config = _load_all()
    swg          = [s for s in subjects if s.grades]
    all_grades   = [g for s in swg for g in s.grades]
    total_weight = sum(g.weight for g in all_grades)
    overall_avg  = (sum(g.value * g.weight for g in all_grades) / total_weight) if total_weight else None

    def savg(s):
        w = sum(g.weight for g in s.grades)
        return sum(g.value * g.weight for g in s.grades) / w if w else 0.0

    sorted_subs    = sorted(swg, key=savg)
    best_grade     = min(all_grades, key=lambda g: g.value, default=None)
    worst_grade    = max(all_grades, key=lambda g: g.value, default=None)
    label_counts   = Counter(l for g in all_grades for l in g.labels if l)
    total_redeemed = sum(r["cost"] for r in wallet.redemptions)

    def grade_subject(target):
        for s in swg:
            if any(g.value == target.value and g.weight == target.weight for g in s.grades):
                return s.name
        return "?"

    return jsonify({
        "overall_average": round(overall_avg, 4) if overall_avg is not None else None,
        "grade_count":     len(all_grades),
        "best_subject":    {"name": sorted_subs[0].name,  "average": round(savg(sorted_subs[0]),  2)} if sorted_subs else None,
        "worst_subject":   {"name": sorted_subs[-1].name, "average": round(savg(sorted_subs[-1]), 2)} if sorted_subs else None,
        "best_grade":      {**best_grade.to_dict(),  "subject": grade_subject(best_grade)}  if best_grade  else None,
        "worst_grade":     {**worst_grade.to_dict(), "subject": grade_subject(worst_grade)} if worst_grade else None,
        "top_labels":      [{"label": l, "count": n} for l, n in label_counts.most_common(3)],
        "subjects":        [s.to_dict() for s in subjects],
        "grade_log":       wallet.grade_log,
        "redemptions":     wallet.redemptions,
        "reward_config":   reward_config.to_dict(),
        "wallet_balance":  wallet.balance,
        "total_redeemed":  total_redeemed,
    })

# ---------------------------------------------------------------------------
# API – Backup (ZIP download)
# ---------------------------------------------------------------------------

@app.route("/api/backup", methods=["GET"])
def download_backup():
    """Stream a ZIP of all data JSON files as a browser download."""
    import os
    app_config, _, _, _ = _load_all()

    files = {
        "grades.json":        app_config.data_path,
        "wallet.json":        app_config.wallet_path,
        "reward_config.json": app_config.reward_config_path,
        "app_config.json":    app_config.app_config_path,
    }

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for archive_name, path in files.items():
            if os.path.exists(path):
                zf.write(path, archive_name)

    buf.seek(0)
    from datetime import datetime
    filename = f"notenrechner_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
    return send_file(buf, mimetype="application/zip",
                     as_attachment=True, download_name=filename)

# ---------------------------------------------------------------------------

if __name__ == "__main__":
    app.run(host=Config.HOST, port=Config.PORT, debug=Config.DEBUG)
