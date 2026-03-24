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

            grade = Grade(value, weight)

            if grade.is_valid():
                return grade
            
            print("Note muss zwischen 1 und 6 liegen.")

        except ValueError:
            print("Ungültige Eingabe. Bitte eine Zahl oder 'q' eingeben.")
        except EOFError:
            return None

def show_result(grade: float) -> None:
    print(f"Die endgültige Note ist: {grade:.2f}")