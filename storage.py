import json
import os
from models import Subject, RewardConfig, DEFAULT_POINTS_MAP, DEFAULT_MONEY_PER_POINT

DATA_PATH = "data/grades.json"
CONFIG_PATH = "data/config.json"

def save_subjects(subjects: list[Subject], path: str = DATA_PATH) -> None:
    """
        Save Subject objects to JSON file.
    """
    os.makedirs(os.path.dirname(path), exist_ok=True)  # creates path if missing

    with open(path, "w") as f:
        json.dump({"subjects": [s.to_dict() for s in subjects]}, f, indent=2)


def load_subjects(path: str = DATA_PATH) -> list[Subject]:
    """
        Load Subjects from JSON file. Returns empty list if file is missing or corrupt.
    """
    if not os.path.exists(path):
        return []

    try:
        with open(path, "r") as f:
            data = json.load(f)
            return [
                Subject.from_dict(s) for s in data.get("subjects", [])
            ]

    except json.JSONDecodeError:
        print(f"Warnung: {DATA_PATH} ist korrupt oder fehlt. Es wird eine leere Liste geladen.")
        return []


def save_config(config: RewardConfig, path: str = CONFIG_PATH) -> None:
    """
        Save reward configuration to JSON file.
    """
    os.makedirs(os.path.dirname(path), exist_ok=True)

    with open(path, "w") as f:
        json.dump(config.to_dict(), f, indent=2)


def load_config(path: str = CONFIG_PATH) -> RewardConfig:
    """
        Load reward configuration from JSON file. Returns default RewardConfig if config file is missing or corrupt.
    """
    if not os.path.exists(path):
        return RewardConfig()   # returns default config if file is missing

    try:
        with open(path, "r") as f:
            data = json.load(f)
            return RewardConfig.from_dict(data)

    except json.JSONDecodeError:
        print(f"Warnung: {CONFIG_PATH} ist korrupt oder fehlt. Es wird die Standardkonfiguration geladen.")
        return RewardConfig()   # returns default config if file is corrupt
