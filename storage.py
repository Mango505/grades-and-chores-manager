import json
import os
from models import Grade

FILE_PATH = "data/grades.json"

def save_grades(grades: list) -> None:
    """Save Grade objects to JSON file."""

    os.makedirs(os.path.dirname(FILE_PATH), exist_ok=True)  # creates data/ if missing

    serializable = [
        {"value": g.value, "weight": g.weight, "tag": g.tag}
        for g in grades
    ]

    with open(FILE_PATH, "w") as f:
        json.dump({"grades": serializable}, f, indent=2)

def load_grades() -> list:
    """Load grades from JSON file. Returns empty list if file doesn't exist or is corrupt."""

    if not os.path.exists(FILE_PATH):
        return []

    try:
        with open(FILE_PATH, "r") as f:
            data = json.load(f)
            return [
                Grade(g["value"], g["weight"], g["tag"])
                for g in data.get("grades", [])
            ]

    except json.JSONDecodeError:
        print("Warning: Grade file is corrupt. Starting with empty list.")
        return []
