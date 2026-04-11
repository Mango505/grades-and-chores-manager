import argparse
from ui import print_menu, print_title, create_subject, add_grade, delete_subject, show_overview, filter_by_tag
from storage import save_subjects, load_subjects, save_config, load_config, DATA_PATH
from models import RewardConfig

VERSION = "v1.2.4"

def main():
    parser = argparse.ArgumentParser(
        description="Notenrechner - Verwalte deine Noten im bayerischen Notensystem (1-6)."
    )
    parser.add_argument(
        "-f", "--file",
        default=DATA_PATH,
        metavar="FILE",
        help="Pfad zur JSON-Datei für das Laden und Speichern von Noten (Standard: %(default)s)"
    )
    args = parser.parse_args()

    print_title(f"Notenrechner {VERSION}")

    subjects = load_subjects(args.file)
    if subjects:
        print(f"Datei geladen: {args.file}")

    reward_config = load_config()

    while True:
        choice = print_menu({
            "1": "Fach erstellen",
            "2": "Note hinzufügen",
            "3": "Fach löschen",
            "4": "Übersicht",
            "5": "Nach Tags filtern",
            "q": "Beenden"
        },
        "-" * 8 + " MENÜ " + "-" * 8,
        start="\n"
        )

        if choice == "q":
            save_subjects(subjects, args.file)
            save_config(reward_config)
            break
        elif choice == "1":
            create_subject(subjects)
        elif choice == "2":
            add_grade(subjects, reward_config)
        elif choice == "3":
            delete_subject(subjects)
        elif choice == "4":
            show_overview(subjects)
        elif choice == "5":
            filter_by_tag(subjects)


if __name__ == "__main__":
    main()
