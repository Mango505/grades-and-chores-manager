from models import Grade

def input_grade() -> Grade | None:
    while True:
        try:
            raw = input("Note eingeben oder 'q' für Quit: ").strip().lower()

            if raw == "q":
                return None
            
            value = float(raw)
            grade = Grade(value)

            if grade.is_valid():
                return grade
            
            print("Note muss zwischen 1 und 6 liegen.")
            
        except ValueError:
            print("Ungültige Eingabe. Bitte eine Zahl oder 'q' eingeben.")
        except EOFError:
            return None

def show_result(grade: float) -> None:
    print(f"Die endgültige Note ist: {grade:.2f}")