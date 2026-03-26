import json
import os
from models import Grade, Subject

FILE_PATH = "data/grades.json"

def save_subjects(subjects: list[Subject]) -> None:
    """Save Subject objects to JSON file."""

    os.makedirs(os.path.dirname(FILE_PATH), exist_ok=True)  # creates data/ if missing

    with open(FILE_PATH, "w") as f:
        json.dump({"subjects": [s.to_dict() for s in subjects]}, f, indent=2)


def load_subjects() -> list[Subject]:
    """Load Subjects from JSON file. Returns empty list if file doesn't exist or is corrupt."""

    if not os.path.exists(FILE_PATH):
        return []

    try:
        with open(FILE_PATH, "r") as f:
            data = json.load(f)
            return [ Subject.from_dict(s) for s in data.get("subjects", []) ]

    except json.JSONDecodeError:
        print(f"Warning: {FILE_PATH} is corrupt. Starting with empty list.")
        return []
