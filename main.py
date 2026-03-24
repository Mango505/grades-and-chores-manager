def main():
    print("Willkommen zum Notenrechner!")

    grades = []

    while True:
        value = input_value()
        if value is None:
            break
        grades.append(value)
    
    if not grades:
        print("Keine Noten eingegeben. Das Programm wird beendet.")
        return
    
    output = calculate_final_grade(grades)
    print(f"Die endgültige Note ist: {output:.2f}")


def input_value():
    while True:
        try:
            raw = input("Note eingeben oder 'q' für Quit: ").strip().lower()

            if raw == "q":
                return None
            
            value = float(raw)
            if 1.0 <= value <= 6.0:
                return value
            else:
                print("Note muss zwischen 1 und 6 liegen.")
            
        except ValueError:
            print("Ungültige Eingabe. Bitte geben Sie eine Zahl oder 'q' für Quit ein.")
        except EOFError:
            print("\nEingabe unerwartet beendet.")
            return None


def calculate_final_grade(grades):
    if not grades:
        raise ValueError("Grade list must not be empty.")
    return sum(grades) / len(grades)


if __name__ == "__main__":
    main()