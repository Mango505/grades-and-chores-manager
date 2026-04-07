import json
import os
from models import Grade, Subject

FILE_PATH = "data/grades.json"

def save_subjects(subjects: list[Subject], path: str = FILE_PATH) -> None:
    """Save Subject objects to JSON file."""

    os.makedirs(os.path.dirname(path), exist_ok=True)  # creates path if missing

    with open(path, "w") as f:
        json.dump({"subjects": [s.to_dict() for s in subjects]}, f, indent=2)


def load_subjects(path: str = FILE_PATH) -> list[Subject]:
    """Load Subjects from JSON file. Returns empty list if file doesn't exist or is corrupt."""

    if not os.path.exists(path):
        return []

    try:
        with open(path, "r") as f:
            data = json.load(f)
            return [ Subject.from_dict(s) for s in data.get("subjects", []) ]

    except json.JSONDecodeError:
        print(f"Warnung: {FILE_PATH} ist korrupt oder fehlt. Es wird eine leere Liste geladen.")
        return []
