from datetime import datetime
from enum import Enum
DEFAULT_POINTS_MAP = {1: 10, 2: 8, 3: 6, 4: 4, 5: 2, 6: 0}  # default
DEFAULT_MONEY_PER_POINT = 0.50                              # default

class Grade:
    def __init__(self, value: float, weight: float = 1.0, tags: list[str] | None = None):
        self.value = value
        self.weight = weight
        self.tags = tags if tags is not None else []

    def is_valid(self) -> bool:
        return 1.0 <= self.value <= 6.0 and self.weight > 0.0

    def to_dict(self) -> dict:
        """Serialize Grade to a JSON-compatible dict."""
        return {"value": self.value, "weight": self.weight, "tags": self.tags}

    @classmethod
    def from_dict(cls, data: dict) -> "Grade":
        """Deserialize a Grade from a dict."""
        return cls(data["value"], data["weight"], data["tags"])


class Subject:
    def __init__(self, name: str):
        self.name = name
        self.grades: list[Grade] = []
    
    def add_grade(self, grade: Grade) -> None:
        self.grades.append(grade)
    
    def remove_grade(self, index: int) -> None:
        self.grades.pop(index)

    def average(self) -> float:
        """Weighted average of all grades in a subject."""
        if not self.grades:
            return 0.0
        return sum(g.value * g.weight for g in self.grades) / sum(g.weight for g in self.grades)
    
    def average_by_tag(self, tags: list[str], mode: str) -> float:
        """Weighted average of grades by filter."""
        if mode == "and":
            filtered = [g for g in self.grades if all(t in g.tags for t in tags)]
        if mode == "or":
            filtered = [g for g in self.grades if any(t in g.tags for t in tags)]
        if not filtered:
            return 0.0
        return sum(g.value * g.weight for g in filtered) / sum(g.weight for g in filtered)

    def to_dict(self) -> dict:
        return{"name": self.name, "grades": [g.to_dict() for g in self.grades]}

    @classmethod
    def from_dict(cls, data: dict) -> "Subject":
        subject = cls(data["name"])
        subject.grades = [Grade.from_dict(g) for g in data["grades"]]
        return subject


class Wallet:
    def __init__(self, balance: float, redemptions: list[dict]):
        self.balance = balance          # earned but not yet redeemed money
        self.redemptions = redemptions  # list of dicts with "description" and "cost" for each redemption

    def redeem(self, cost: float, description: str = "<keine Beschreibung>") -> None:
        """
            Subtract cost from balance and log the redemption.
        """
        self.balance -= cost
        self.redemptions.append({
            "description": description,
            "cost": cost,
            "date": datetime.now().strftime("%d.%m.%Y %H:%M")   # e.g. "11.04.2026 14:30"
        })

    def to_dict(self) -> dict:
        return {
            "balance": self.balance,
            "redemptions": self.redemptions,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Wallet":
        return cls(
            balance=data["balance"],
            redemptions=data["redemptions"]
        )


class RewardConfig:
    def __init__(
        self,
        points_map: dict[int, int] = None,
        money_per_point: float = DEFAULT_MONEY_PER_POINT,
    ):
        self.points_map = points_map if points_map is not None else DEFAULT_POINTS_MAP.copy()
        self.money_per_point = money_per_point

    def points_for_grade(self, value: float) -> int:
        """Return points for a grade value. Rounds to nearest integer key."""
        return self.points_map.get(round(value), 0)

    def money_for_points(self, points: int) -> float:
        """Convert points to monetary value."""
        return points * self.money_per_point

    def to_dict(self) -> dict:
        return {
            "points_map": {int(k): v for k, v in self.points_map.items()},
            "money_per_point": self.money_per_point,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "RewardConfig":
        return cls(
            points_map={int(k): v for k, v in data["points_map"].items()},
            money_per_point=data["money_per_point"],
        )


class AppConfig:
    def __init__(
        self,
        app_config_path: str = "data/app_config.json",
        data_path: str = "data/grades.json",
        wallet_path: str = "data/wallet.json",
        reward_config_path: str = "data/reward_config.json",
        verbose_loading: bool = True,   # True = "Noten geladen: ...", False = nur Warnungen
    ):
        self.app_config_path = app_config_path
        self.data_path = data_path
        self.wallet_path = wallet_path
        self.reward_config_path = reward_config_path
        self.verbose_loading = verbose_loading

    def to_dict(self) -> dict:
        return {
            "app_config_path": self.app_config_path,
            "data_path": self.data_path,
            "wallet_path": self.wallet_path,
            "reward_config_path": self.reward_config_path,
            "verbose_loading": self.verbose_loading
        }

    @classmethod
    def from_dict(cls, data: dict) -> "AppConfig":
        return cls(
            app_config_path=data["app_config_path"],
            data_path=data["data_path"],
            wallet_path=data["wallet_path"],
            reward_config_path=data["reward_config_path"],
            verbose_loading=data.get("verbose_loading", True)
        )


class LoadStatus(Enum):
    OK = "ok"
    MISSING = "missing"
    CORRUPT = "corrupt"
