import json
import os
from models import Grade, Subject, DEFAULT_POINTS_MAP, DEFAULT_MONEY_PER_POINT

FILE_PATH = "data/grades.json"

def save_subjects(subjects: list[Subject], path: str = FILE_PATH) -> None:
    """Save Subject objects to JSON file."""

    os.makedirs(os.path.dirname(path), exist_ok=True)  # creates path if missing

    with open(path, "w") as f:
        json.dump({"subjects": [s.to_dict() for s in subjects]}, f, indent=2)


def load_subjects(path: str = FILE_PATH) -> list[Subject]:
    """Load Subjects from JSON file. Returns empty list if file is missing or corrupt."""

    if not os.path.exists(path):
        return []

    try:
        with open(path, "r") as f:
            data = json.load(f)
            return [ Subject.from_dict(s) for s in data.get("subjects", []) ]

    except json.JSONDecodeError:
        print(f"Warnung: {FILE_PATH} ist korrupt oder fehlt. Es wird eine leere Liste geladen.")
        return []


def load_config() -> tuple[dict[int, int], float]:
    """Load reward configuration. Returns default values if config file is missing or corrupt."""
    points_map = DEFAULT_POINTS_MAP.copy()
    money_per_point = DEFAULT_MONEY_PER_POINT

    return points_map, money_per_point
