"""
app.py – Flask entry point. Replaces the CLI main.py.
models.py and storage.py are kept unchanged.
"""
import io
import os
import zipfile
from collections import Counter
from datetime import datetime

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
    """
    Load all data using Config paths as the source of truth.
    The AppConfig stored in app_config.json may contain user-customised paths
    (set via the CLI); we respect those for grades/wallet/reward-config.
    Falls back to Config paths if the AppConfig file is missing or corrupt.
    """
    app_config, status = load_app_config(Config.APP_CONFIG_PATH)

    # If the stored AppConfig has relative paths, resolve them absolute
    # relative to Config.DATA_DIR so CLI-generated configs keep working.
    def _resolve(p: str) -> str:
        if os.path.isabs(p):
            return p
        return os.path.join(Config.DATA_DIR, os.path.basename(p))

    # If config was missing/corrupt fall back to Config-level paths
    if status != LoadStatus.OK:
        app_config.data_path          = Config.GRADES_PATH
        app_config.wallet_path        = Config.WALLET_PATH
        app_config.reward_config_path = Config.REWARD_CONFIG_PATH
        app_config.backup_path        = Config.BACKUP_PATH
    else:
        app_config.data_path          = _resolve(app_config.data_path)
        app_config.wallet_path        = _resolve(app_config.wallet_path)
        app_config.reward_config_path = _resolve(app_config.reward_config_path)
        app_config.backup_path        = _resolve(app_config.backup_path)

    subjects,      _ = load_subjects(app_config.data_path)
    wallet,        _ = load_wallet(app_config.wallet_path)
    reward_config, _ = load_reward_config(app_config.reward_config_path)
    return app_config, subjects, wallet, reward_config


def _save_all(app_config, subjects, wallet, reward_config):
    save_app_config(app_config,       app_config.app_config_path)
    save_subjects(subjects,           app_config.data_path)
    save_wallet(wallet,               app_config.wallet_path)
    save_reward_config(reward_config, app_config.reward_config_path)


def _subject_index(subjects: list, name: str) -> int:
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
    """Body: { "name": str }"""
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


@app.route("/api/subjects/reorder", methods=["PUT"])
def reorder_subjects():
    """Body: { "order": ["name1", "name2", ...] }"""
    data  = request.get_json(force=True)
    order = data.get("order", [])
    app_config, subjects, wallet, reward_config = _load_all()
    name_map  = {s.name: s for s in subjects}
    reordered = [name_map[n] for n in order if n in name_map]
    remaining = [s for s in subjects if s.name not in set(order)]
    subjects  = reordered + remaining
    _save_all(app_config, subjects, wallet, reward_config)
    return jsonify([s.to_dict() for s in subjects])


# ---------------------------------------------------------------------------
# API – Grades
# ---------------------------------------------------------------------------

@app.route("/api/subjects/<string:subject_name>/grades", methods=["POST"])
def add_grade(subject_name):
    """Body: { "value": float, "weight"?: float, "labels"?: [str] }"""
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
        abort(400, "value must be 1–6 and weight > 0")

    subjects[idx].add_grade(grade)
    earned = reward_config.units_for_points(reward_config.points_for_grade(value)) \
             if reward_config.enabled else None
    if reward_config.enabled and earned:
        wallet.balance += earned
    wallet.log_grade_event("+", subject_name, value, weight, labels, value_delta=earned)
    _save_all(app_config, subjects, wallet, reward_config)
    return jsonify(grade.to_dict()), 201


@app.route("/api/subjects/<string:subject_name>/grades/<int:grade_index>", methods=["PUT"])
def edit_grade(subject_name, grade_index):
    """Body: { "value"?, "weight"?, "labels"? } – omit to keep current"""
    data = request.get_json(force=True)
    app_config, subjects, wallet, reward_config = _load_all()
    idx = _subject_index(subjects, subject_name)
    if idx == -1:
        abort(404)
    subject = subjects[idx]
    if not (0 <= grade_index < len(subject.grades)):
        abort(404, f"Grade index {grade_index} out of range")

    old = subject.grades[grade_index]
    new_value  = float(data["value"])  if "value"  in data else old.value
    new_weight = float(data["weight"]) if "weight" in data else old.weight
    new_labels = data["labels"]        if "labels" in data else old.labels

    new_grade = Grade(new_value, new_weight, new_labels)
    if not new_grade.is_valid():
        abort(400, "value must be 1–6 and weight > 0")

    value_delta = None
    if reward_config.enabled:
        old_e = reward_config.units_for_points(reward_config.points_for_grade(old.value))
        new_e = reward_config.units_for_points(reward_config.points_for_grade(new_value))
        value_delta = new_e - old_e
        wallet.balance += value_delta

    subject.grades[grade_index] = new_grade
    wallet.log_grade_event("~", subject_name, new_value, new_weight, new_labels, value_delta=value_delta)
    _save_all(app_config, subjects, wallet, reward_config)
    return jsonify(new_grade.to_dict())


@app.route("/api/subjects/<string:subject_name>/grades/<int:grade_index>", methods=["DELETE"])
def delete_grade(subject_name, grade_index):
    """Query param: adjust_wallet=1 to reverse reward balance."""
    app_config, subjects, wallet, reward_config = _load_all()
    idx = _subject_index(subjects, subject_name)
    if idx == -1:
        abort(404)
    subject = subjects[idx]
    if not (0 <= grade_index < len(subject.grades)):
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
    """Body: { "cost": float, "description"?: str }"""
    data = request.get_json(force=True)
    app_config, subjects, wallet, reward_config = _load_all()
    if not reward_config.enabled:
        abort(400, "Reward system is disabled")
    try:
        cost = float(data["cost"])
    except (KeyError, TypeError, ValueError):
        abort(400, "cost (float) required")
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
    """Replace the full reward configuration."""
    data = request.get_json(force=True)
    app_config, subjects, wallet, _ = _load_all()
    try:
        new_config = RewardConfig.from_dict(data)
    except (KeyError, TypeError, ValueError) as e:
        abort(400, f"Invalid reward config: {e}")
    _save_all(app_config, subjects, wallet, new_config)
    return jsonify(new_config.to_dict())


# ---------------------------------------------------------------------------
# API – Overview
# ---------------------------------------------------------------------------

@app.route("/api/overview", methods=["GET"])
def get_overview():
    _, subjects, _, _ = _load_all()
    total_value = total_weight = 0.0
    result = []
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
    swg        = [s for s in subjects if s.grades]
    all_grades = [g for s in swg for g in s.grades]
    tw         = sum(g.weight for g in all_grades)
    overall    = sum(g.value * g.weight for g in all_grades) / tw if tw else None

    def savg(s):
        w = sum(g.weight for g in s.grades)
        return sum(g.value * g.weight for g in s.grades) / w if w else 0.0

    sorted_s    = sorted(swg, key=savg)
    best_g      = min(all_grades, key=lambda g: g.value, default=None)
    worst_g     = max(all_grades, key=lambda g: g.value, default=None)
    lc          = Counter(l for g in all_grades for l in g.labels if l)

    def gsub(target):
        return next((s.name for s in swg if any(
            g.value == target.value and g.weight == target.weight for g in s.grades)), "?")

    return jsonify({
        "overall_average": round(overall, 4) if overall is not None else None,
        "grade_count":     len(all_grades),
        "best_subject":    {"name": sorted_s[0].name,  "average": round(savg(sorted_s[0]),  2)} if sorted_s else None,
        "worst_subject":   {"name": sorted_s[-1].name, "average": round(savg(sorted_s[-1]), 2)} if sorted_s else None,
        "best_grade":      {**best_g.to_dict(),  "subject": gsub(best_g)}  if best_g  else None,
        "worst_grade":     {**worst_g.to_dict(), "subject": gsub(worst_g)} if worst_g else None,
        "top_labels":      [{"label": l, "count": n} for l, n in lc.most_common(3)],
        "subjects":        [s.to_dict() for s in subjects],
        "grade_log":       wallet.grade_log,
        "redemptions":     wallet.redemptions,
        "reward_config":   reward_config.to_dict(),
        "wallet_balance":  wallet.balance,
        "total_redeemed":  sum(r["cost"] for r in wallet.redemptions),
    })


# ---------------------------------------------------------------------------
# API – App config
# ---------------------------------------------------------------------------

@app.route("/api/app-config", methods=["GET"])
def get_app_config():
    app_config, _, _, _ = _load_all()
    return jsonify({**app_config.to_dict(), "resolved_data_dir": Config.DATA_DIR})


# ---------------------------------------------------------------------------
# API – Backup download
# ---------------------------------------------------------------------------

@app.route("/api/backup", methods=["GET"])
def download_backup():
    app_config, _, _, _ = _load_all()
    files = {
        app_config.data_path:          "grades.json",
        app_config.wallet_path:        "wallet.json",
        app_config.reward_config_path: "reward_config.json",
        app_config.app_config_path:    "app_config.json",
    }
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for src, arc in files.items():
            if os.path.exists(src):
                zf.write(src, arc)
    buf.seek(0)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return send_file(buf, mimetype="application/zip", as_attachment=True,
                     download_name=f"notenrechner_backup_{stamp}.zip")


# ---------------------------------------------------------------------------

@app.route("/api/startup-status", methods=["GET"])
def startup_status():
    """Return load status for all four data files."""
    from storage import (load_app_config as _lac, load_subjects as _ls,
                         load_wallet as _lw, load_reward_config as _lr)

    app_config_obj, ac_st = _lac(Config.APP_CONFIG_PATH)

    def _res(p):
        return p if os.path.isabs(p) else os.path.join(Config.DATA_DIR, os.path.basename(p))

    data_path = _res(app_config_obj.data_path)
    wallet_path = _res(app_config_obj.wallet_path)
    rc_path = _res(app_config_obj.reward_config_path)

    _, s_st  = _ls(data_path)
    _, w_st  = _lw(wallet_path)
    _, rc_st = _lr(rc_path)

    return jsonify({"files": [
        {"name": "App-Konfiguration",       "path": Config.APP_CONFIG_PATH, "status": ac_st.value},
        {"name": "Noten",                   "path": data_path,              "status": s_st.value},
        {"name": "Wallet",                  "path": wallet_path,            "status": w_st.value},
        {"name": "Belohnungskonfiguration", "path": rc_path,                "status": rc_st.value},
    ]})



# ---------------------------------------------------------------------------
# API – Reset actions
# ---------------------------------------------------------------------------

@app.route("/api/reset", methods=["POST"])
def reset_data():
    """
    Reset specific data. Body: { "action": str }
    Actions: "grade_log" | "redemptions" | "balance" | "app_config" | "reward_config"
    """
    data   = request.get_json(force=True)
    action = data.get("action", "")
    app_config, subjects, wallet, reward_config = _load_all()

    if action == "grade_log":
        wallet.grade_log = []
    elif action == "redemptions":
        wallet.redemptions = []
    elif action == "balance":
        wallet.balance = 0.0
    elif action == "app_config":
        app_config = AppConfig(
            data_path=app_config.data_path,
            wallet_path=app_config.wallet_path,
            reward_config_path=app_config.reward_config_path,
            backup_path=app_config.backup_path,
        )
    elif action == "reward_config":
        reward_config = RewardConfig()
    else:
        abort(400, f"Unknown action: {action}")

    _save_all(app_config, subjects, wallet, reward_config)
    return jsonify({"ok": True, "action": action})


# ---------------------------------------------------------------------------
# API – App config update
# ---------------------------------------------------------------------------

@app.route("/api/app-config", methods=["PATCH"])
def update_app_config():
    """Partial update of app config. Currently supports: verbose_loading (bool)."""
    data = request.get_json(force=True)
    app_config, subjects, wallet, reward_config = _load_all()

    if "verbose_loading" in data:
        app_config.verbose_loading = bool(data["verbose_loading"])

    _save_all(app_config, subjects, wallet, reward_config)
    return jsonify(app_config.to_dict())



@app.route("/api/backups/cleanup", methods=["POST"])
def cleanup_backups():
    """Delete all backup directories except the newest one."""
    import shutil
    app_config, _, _, _ = _load_all()
    backup_path = app_config.backup_path

    if not os.path.exists(backup_path):
        return jsonify({"message": "Kein Backup-Verzeichnis gefunden.", "deleted": 0})

    entries = sorted(
        [e for e in os.scandir(backup_path) if e.is_dir() and e.name.startswith("backup_")],
        key=lambda e: e.name
    )

    if len(entries) <= 1:
        return jsonify({"message": "Nur ein Backup vorhanden, nichts zu löschen.", "deleted": 0})

    to_delete = entries[:-1]  # keep the newest
    failed, deleted = [], 0
    for e in to_delete:
        try:
            shutil.rmtree(e.path)
            deleted += 1
        except OSError:
            failed.append(e.name)

    msg = f"{deleted} altes Backup/Backups gelöscht."
    if failed:
        msg += f" Fehlgeschlagen: {', '.join(failed)}"
    return jsonify({"message": msg, "deleted": deleted, "failed": failed})



if __name__ == "__main__":
    app.run(host=Config.HOST, port=Config.PORT, debug=Config.DEBUG)
