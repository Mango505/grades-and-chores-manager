from flask import Flask, jsonify, request, render_template, abort
from models import Grade, Subject, Wallet, RewardConfig, AppConfig, LoadStatus
from storage import (
    load_app_config, save_app_config,
    load_subjects, save_subjects,
    load_wallet, save_wallet,
    load_reward_config, save_reward_config,
)

app = Flask(__name__)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_all():
    """Load all data from disk and return as a tuple."""
    app_config, _ = load_app_config()
    subjects, _   = load_subjects(app_config.data_path)
    wallet, _     = load_wallet(app_config.wallet_path)
    reward_config, _ = load_reward_config(app_config.reward_config_path)
    return app_config, subjects, wallet, reward_config


def _save_all(app_config, subjects, wallet, reward_config):
    save_app_config(app_config, app_config.app_config_path)
    save_subjects(subjects, app_config.data_path)
    save_wallet(wallet, app_config.wallet_path)
    save_reward_config(reward_config, app_config.reward_config_path)


def _subject_index(subjects: list[Subject], name: str) -> int:
    """Return index of subject by name, or -1 if not found."""
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
    """Return all subjects with their grades."""
    _, subjects, _, _ = _load_all()
    return jsonify([s.to_dict() for s in subjects])


@app.route("/api/subjects", methods=["POST"])
def create_subject():
    """Create a new subject. Body: { "name": str }"""
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
def delete_subject(subject_name: str):
    """Delete a subject and all its grades."""
    app_config, subjects, wallet, reward_config = _load_all()
    idx = _subject_index(subjects, subject_name)
    if idx == -1:
        abort(404, f"Subject '{subject_name}' not found")

    subjects.pop(idx)
    _save_all(app_config, subjects, wallet, reward_config)
    return "", 204


# ---------------------------------------------------------------------------
# API – Grades
# ---------------------------------------------------------------------------

@app.route("/api/subjects/<string:subject_name>/grades", methods=["POST"])
def add_grade(subject_name: str):
    """Add a grade to a subject. Body: { "value": float, "weight": float, "labels": [str] }"""
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
        abort(400, "value (float) is required; weight (float) and labels ([str]) are optional")

    grade = Grade(value, weight, labels)
    if not grade.is_valid():
        abort(400, "value must be 1–6 and weight must be > 0")

    subjects[idx].add_grade(grade)

    # Wallet / reward bookkeeping
    earned = reward_config.units_for_points(reward_config.points_for_grade(value)) if reward_config.enabled else None
    if reward_config.enabled and earned:
        wallet.balance += earned
    wallet.log_grade_event("+", subject_name, value, weight, labels, value_delta=earned)

    _save_all(app_config, subjects, wallet, reward_config)
    return jsonify(grade.to_dict()), 201


@app.route("/api/subjects/<string:subject_name>/grades/<int:grade_index>", methods=["PUT"])
def edit_grade(subject_name: str, grade_index: int):
    """Edit a grade. Body: { "value"?, "weight"?, "labels"? } – omit fields to keep them."""
    data = request.get_json(force=True)
    app_config, subjects, wallet, reward_config = _load_all()

    idx = _subject_index(subjects, subject_name)
    if idx == -1:
        abort(404, f"Subject '{subject_name}' not found")

    subject = subjects[idx]
    if grade_index < 0 or grade_index >= len(subject.grades):
        abort(404, f"Grade index {grade_index} out of range")

    old_grade = subject.grades[grade_index]
    new_value  = float(data["value"])  if "value"  in data else old_grade.value
    new_weight = float(data["weight"]) if "weight" in data else old_grade.weight
    new_labels = data["labels"]        if "labels" in data else old_grade.labels

    new_grade = Grade(new_value, new_weight, new_labels)
    if not new_grade.is_valid():
        abort(400, "value must be 1–6 and weight must be > 0")

    # Wallet adjustment
    value_delta = None
    if reward_config.enabled:
        old_earned = reward_config.units_for_points(reward_config.points_for_grade(old_grade.value))
        new_earned = reward_config.units_for_points(reward_config.points_for_grade(new_value))
        value_delta = new_earned - old_earned
        wallet.balance += value_delta

    subject.grades[grade_index] = new_grade
    wallet.log_grade_event("~", subject_name, new_value, new_weight, new_labels, value_delta=value_delta)

    _save_all(app_config, subjects, wallet, reward_config)
    return jsonify(new_grade.to_dict())


@app.route("/api/subjects/<string:subject_name>/grades/<int:grade_index>", methods=["DELETE"])
def delete_grade(subject_name: str, grade_index: int):
    """Delete a grade. Query param: adjust_wallet=1 to reverse reward balance."""
    app_config, subjects, wallet, reward_config = _load_all()

    idx = _subject_index(subjects, subject_name)
    if idx == -1:
        abort(404, f"Subject '{subject_name}' not found")

    subject = subjects[idx]
    if grade_index < 0 or grade_index >= len(subject.grades):
        abort(404, f"Grade index {grade_index} out of range")

    grade = subject.grades[grade_index]
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
    """Return wallet balance, redemptions, and grade log."""
    _, _, wallet, reward_config = _load_all()
    return jsonify({
        **wallet.to_dict(),
        "formatted_balance": reward_config.format_value(wallet.balance) if reward_config.enabled else None,
    })


@app.route("/api/wallet/redeem", methods=["POST"])
def redeem():
    """Redeem balance. Body: { "cost": float, "description"?: str }"""
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

    description = (data.get("description") or "<keine Beschreibung>").strip()
    wallet.redeem(cost, description)
    _save_all(app_config, subjects, wallet, reward_config)
    return jsonify(wallet.to_dict())


# ---------------------------------------------------------------------------
# API – Reward config
# ---------------------------------------------------------------------------

@app.route("/api/reward-config", methods=["GET"])
def get_reward_config():
    """Return the current reward configuration."""
    _, _, _, reward_config = _load_all()
    return jsonify(reward_config.to_dict())


# ---------------------------------------------------------------------------
# API – Overview / stats (computed)
# ---------------------------------------------------------------------------

@app.route("/api/overview", methods=["GET"])
def get_overview():
    """Return aggregated overview: per-subject averages + overall average."""
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

if __name__ == "__main__":
    app.run(debug=True, port=5000)
