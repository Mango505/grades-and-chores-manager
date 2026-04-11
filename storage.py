import json
import os
from models import Subject, RewardConfig, Wallet

DATA_PATH = "data/grades.json"
CONFIG_PATH = "data/config.json"
WALLET_PATH = "data/wallet.json"

def save_subjects(subjects: list[Subject], path: str = DATA_PATH) -> None:
    """
        Save subjects and grades data to JSON file.
    """
    os.makedirs(os.path.dirname(path), exist_ok=True)  # creates path if missing

    with open(path, "w") as f:
        json.dump({"subjects": [s.to_dict() for s in subjects]}, f, indent=2)


def load_subjects(path: str = DATA_PATH) -> list[Subject]:
    """
        Load Subjects from JSON file. Returns empty list if file is missing or corrupt.
    """
    if not os.path.exists(path):
        return []   # returns empty list if file is missing

    try:
        with open(path, "r") as f:
            data = json.load(f)
            return [
                Subject.from_dict(s) for s in data.get("subjects", [])
            ]

    except json.JSONDecodeError:
        print(f"Warnung: {DATA_PATH} ist korrupt. Es wird eine leere Liste geladen.")
        return []   # returns empty list if file is corrupt


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
        print(f"Warnung: {CONFIG_PATH} ist korrupt. Es wird die Standardkonfiguration geladen.")
        return RewardConfig()   # returns default config if file is corrupt


def save_wallet(wallet: Wallet, path: str = WALLET_PATH) -> None:
    """
        Save wallet data to JSON file.
    """
    os.makedirs(os.path.dirname(path), exist_ok=True)

    with open(path, "w") as f:
        json.dump(wallet.to_dict(), f, indent=2)


def load_wallet(path: str = WALLET_PATH) -> Wallet:
    """
        Load wallet data from JSON file. Returns empty wallet if file is missing or corrupt.
    """
    if not os.path.exists(path):
        return Wallet(balance=0.0, redemptions=[])  # returns empty wallet if file is missing

    try:
        with open(path, "r") as f:
            data = json.load(f)
            return Wallet(balance=data.get("balance", 0.0), redemptions=data.get("redemptions", []))

    except json.JSONDecodeError:
        print(f"Warnung: {WALLET_PATH} ist korrupt. Es wird ein leeres Wallet geladen.")
        return Wallet(balance=0.0, redemptions=[])  # returns empty wallet if file is corrupt
