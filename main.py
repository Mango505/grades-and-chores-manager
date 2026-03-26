from ui import print_menu, create_subject, add_grade, delete_subject, show_overview
from storage import save_subjects, load_subjects
from models import Grade, Subject


def main():
    subjects = load_subjects()
    if subjects:
        print(f"Gespeicherte Noten geladen: {subjects}")

    while True:
        choice = print_menu({
            "1": "Fach erstellen",
            "2": "Note hinzufügen",
            "3": "Fach löschen",
            "4": "Übersicht",
            "q": "Beenden"
        }, "=== Notenrechner ===")

        if choice == "q":
            save_subjects(subjects)
            break
        elif choice == "1":
            create_subject(subjects)
        elif choice == "2":
            add_grade(subjects)
        elif choice == "3":
            delete_subject(subjects)
        elif choice == "4":
            show_overview(subjects)


if __name__ == "__main__":
    main()
