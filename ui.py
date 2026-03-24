from models import Grade

def input_grade() -> Grade | None:
    while True:
        try:
            raw_value = input("Note eingeben oder 'q' für Quit: ").strip().lower()
            if raw_value == "q":
                return None            
            value = float(raw_value)

            raw_weight = input("Bitte Gewichtung der Note eingeben: ")
            weight = float(raw_weight)

            tag = input("Tag eingeben oder nichts: ").strip()

            grade = Grade(value, weight, tag)

            if grade.is_valid():
                return grade
            
            print("Note muss zwischen 1 und 6 liegen.")

        except ValueError:
            print("Ungültige Eingabe. Bitte eine Zahl oder 'q' eingeben.")
        except EOFError:
            return None

def show_result(result: float, grades: list) -> None:
    for grade in grades:
        label = f"[{grade.tag}] " if grade.tag else ""
        print(f"  {label}{grade.value} (weight: {grade.weight})")
    print(f"Die endgültige Note ist: {result:.2f}")
