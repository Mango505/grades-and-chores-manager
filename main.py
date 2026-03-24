from ui import input_grade, show_result
from calculator import calculate_final_grade


def main():
    print("Willkommen zum Notenrechner!")

    grades = []

    while True:
        grade = input_grade()
        if grade is None:
            break
        grades.append(grade)
    
    if not grades:
        print("Keine Noten eingegeben. Das Programm wird beendet.")
        return
    
    result = calculate_final_grade(grades)
    show_result(result, grades)


if __name__ == "__main__":
    main()
