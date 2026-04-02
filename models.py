class Grade:
    def __init__(self, value: int, weight: float = 1.0, tags: list[str] | None = None):
        self.tags = tags if tags is not None else []
        self.value = value
        self.weight = weight
        self.tags = tags

    def is_valid(self) -> bool:
        return 1 <= self.value <= 6 and self.weight > 0

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
