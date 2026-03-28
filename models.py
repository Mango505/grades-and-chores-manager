class Grade:
    def __init__(self, value: int, weight: float = 1.0, tags: list[str] = []):
        self.value = value
        self.weight = weight
        self.tags = tags

    def is_valid(self) -> bool:
        return 1 <= self.value <= 6    

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
        """Weighted average of all grades."""
        if not self.grades:
            return 0.0
        return sum(g.value * g.weight for g in self.grades) / sum(g.weight for g in self.grades)

    def to_dict(self) -> dict:
        return{"name": self.name, "grades": [g.to_dict() for g in self.grades]}

    @classmethod
    def from_dict(cls, data: dict) -> "Subject":
        subject = cls(data["name"])
        subject.grades = [Grade.from_dict(g) for g in data["grades"]]
        return subject
