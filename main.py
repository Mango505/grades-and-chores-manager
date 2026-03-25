from ui import input_grade, show_result
from calculator import calculate_final_grade
from storage import save_grades, load_grades

def main():
    print("Willkommen zum Notenrechner!")

    grades = load_grades()
    if grades:
        print(f"Gespeicherte Noten geladen: {grades}")

    while True:
        grade = input_grade()
        if grade is None:
            break
        grades.append(grade)
    
    if not grades:
        print("Keine Noten eingegeben. Das Programm wird beendet.")
        return
    
    save_grades(grades) # save before exit
    result = calculate_final_grade(grades)
    show_result(result, grades)

if __name__ == "__main__":
    main()
