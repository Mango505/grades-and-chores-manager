grades = []

def main():
    print("Willkommen zum Notenrechner!")

    for i in range(2):
        grade = input_grade()
        grades.append(grade)
        i += 1

    final_grade = calculate_final_grade(grades)
    print (grades)  #! debug
    print(f"Die endgültige Note ist: {final_grade}")

def input_grade():
    while True:
        try:
            grade = float(input("Note eingeben: "))
            if 0 <= grade <= 6:
                return grade
            else:
                print("Note muss zwischen 0 und 6 liegen.")
        except ValueError:
            print("Ungültige Eingabe. Bitte geben Sie eine Zahl ein.")

def calculate_final_grade(grades):
    if not grades:
        return None
    return sum(grades) / len(grades)

if __name__ == "__main__":
    main()