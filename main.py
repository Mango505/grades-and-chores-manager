import argparse
from ui import print_menu, print_title, add_grade, redeem, show_overview, filter_by_tag, show_balance, create_subject, delete_subject
from storage import save_subjects, load_subjects, save_config, load_config, save_wallet, load_wallet, DATA_PATH
from models import RewardConfig

VERSION = "v1.3.0"

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
    wallet = load_wallet()

    while True:
        choice = print_menu({
            "1": "Note hinzufügen",
            "2": "Guthaben einlösen",
            "3": "Notenübersicht",
            "4": "Nach Tags filtern",
            "5": "Kontoübersicht",
            "6": "Fach erstellen",
            "7": "Fach löschen",
            "q": "Beenden"
        },
        "-" * 12 + " MENÜ " + "-" * 12,
        start="\n"
        )

        if choice == "q":
            save_subjects(subjects, args.file)
            save_config(reward_config)
            save_wallet(wallet)
            break
        elif choice == "1":
            add_grade(subjects, reward_config, wallet)
        elif choice == "2":
            redeem(wallet)
        elif choice == "3":
            show_overview(subjects)
        elif choice == "4":
            filter_by_tag(subjects)
        elif choice == "5":
            show_balance(reward_config, wallet)
        elif choice == "6":
            create_subject(subjects)
        elif choice == "7":
            delete_subject(subjects)


if __name__ == "__main__":
    main()
