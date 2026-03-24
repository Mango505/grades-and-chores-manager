class Grade:
    def __init__(self, value: float, weight: float = 1.0, tag: str = ""):
        self.value = value
        self.weight = weight
        self.tag = tag

    def is_valid(self) -> bool:
        return 1.0 <= self.value <= 6.0
