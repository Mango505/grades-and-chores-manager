import json
import os
from models import Subject, RewardConfig, Wallet, AppConfig, LoadStatus

APPCONFIG_PATH = "data/app_config.json"
DATA_PATH = "data/grades.json"
WALLET_PATH = "data/wallet.json"
REWARDCONFIG_PATH = "data/reward_config.json"


def save_app_config(config: AppConfig, path: str = APPCONFIG_PATH) -> None:
    """
        Save app configuration to JSON file.
    """
    os.makedirs(os.path.dirname(path), exist_ok=True)

    with open(path, "w") as f:
        json.dump(config.to_dict(), f, indent=2)

def load_app_config(path: str = APPCONFIG_PATH) -> tuple[AppConfig, LoadStatus]:
    """
        Load app configuration from JSON file. Returns default AppConfig if config file is missing or corrupt.
    """
    if not os.path.exists(path):
        return AppConfig(), LoadStatus.MISSING  # returns default config if file is missing

    try:
        with open(path, "r") as f:
            data = json.load(f)
            return AppConfig.from_dict(data), LoadStatus.OK

    except (json.JSONDecodeError, KeyError, TypeError):
        return AppConfig(), LoadStatus.CORRUPT  # returns default config if file is corrupt


def save_subjects(subjects: list[Subject], path: str = DATA_PATH) -> None:
    """
        Save subjects and grades data to JSON file.
    """
    os.makedirs(os.path.dirname(path), exist_ok=True)  # creates path if missing

    with open(path, "w") as f:
        json.dump({"subjects": [s.to_dict() for s in subjects]}, f, indent=2)

def load_subjects(path: str = DATA_PATH) -> tuple[list[Subject], LoadStatus]:
    """
        Load Subjects from JSON file. Returns empty list if file is missing or corrupt.
    """
    if not os.path.exists(path):
        return [], LoadStatus.MISSING   # returns empty list if file is missing

    try:
        with open(path, "r") as f:
            data = json.load(f)
            return [ Subject.from_dict(s) for s in data.get("subjects", []) ], LoadStatus.OK

    except json.JSONDecodeError:
        return [], LoadStatus.CORRUPT   # returns empty list if file is corrupt


def save_wallet(wallet: Wallet, path: str = WALLET_PATH) -> None:
    """
        Save wallet data to JSON file.
    """
    os.makedirs(os.path.dirname(path), exist_ok=True)

    with open(path, "w") as f:
        json.dump(wallet.to_dict(), f, indent=2)

def load_wallet(path: str = WALLET_PATH) -> tuple[Wallet, LoadStatus]:
    """
        Load wallet data from JSON file. Returns empty wallet if file is missing or corrupt.
    """
    if not os.path.exists(path):
        return Wallet(balance=0.0, redemptions=[]), LoadStatus.MISSING  # returns empty wallet if file is missing

    try:
        with open(path, "r") as f:
            data = json.load(f)
            return Wallet(balance=data.get("balance", 0.0), redemptions=data.get("redemptions", [])), LoadStatus.OK

    except json.JSONDecodeError:
        return Wallet(balance=0.0, redemptions=[]), LoadStatus.CORRUPT  # returns empty wallet if file is corrupt


def save_reward_config(config: RewardConfig, path: str = REWARDCONFIG_PATH) -> None:
    """
        Save reward configuration to JSON file.
    """
    os.makedirs(os.path.dirname(path), exist_ok=True)

    with open(path, "w") as f:
        json.dump(config.to_dict(), f, indent=2)

def load_reward_config(path: str = REWARDCONFIG_PATH) -> tuple[RewardConfig, LoadStatus]:
    """
        Load reward configuration from JSON file. Returns default RewardConfig if config file is missing or corrupt.
    """
    if not os.path.exists(path):
        return RewardConfig(), LoadStatus.MISSING   # returns default config if file is missing

    try:
        with open(path, "r") as f:
            data = json.load(f)
            return RewardConfig.from_dict(data), LoadStatus.OK

    except json.JSONDecodeError:
        return RewardConfig(), LoadStatus.CORRUPT   # returns default config if file is corrupt
