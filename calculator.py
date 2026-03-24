from models import Grade

def calculate_final_grade(grades: list[Grade]) -> float:
    if not grades:
        raise ValueError("Grade list must not be empty.")
    
    total = sum(g.value * g.weight for g in grades)
    weight_sum = sum(g.weight for g in grades)

    return total / weight_sum
