from models import Grade, Subject

def create_subject(subjects: list[Subject]) -> list[Subject]:
    first = True
    print_subtitle("Fach erstellen")
    
    while True:
        if not first:
            print()
        first = False

        raw = input("Name für neues Fach eingeben: ").strip()
        
        if raw not in [s.name for s in subjects]:
            subjects.append(Subject(raw))
            print(f"'{raw}' wurde als neues Fach hinzugefügt.")
            return subjects
        print("Fach existiert bereits. Bitte einen anderen Namen angeben, der noch nicht existiert.")


def add_grade(subjects: list[Subject]) -> list[Subject]:
    first = True
    print_subtitle("Note hinzufügen")
    
    while True:
        try:
            if not first:
                print()
            first = False

            choice = print_subjects(
                subjects,
                ", zu dem die Note hinzugefügt werden soll"
            ).strip().lower()
            choice = int(choice)
            choice = subjects[choice]
            
            value = input("Note eingeben: ").strip().lower()                     
            value = float(value)

            weight = input("Gewichtung der Note eingeben: ").strip().lower()
            weight = float(weight)

            tag = input("Tag für die Note eingeben oder leerlassen: ").strip()

            grade = Grade(value, weight, tag)   # create Grade object from user inputs

            if grade.is_valid():
                choice.add_grade(grade)    # add the Grade to the desired subject
                print(f"Neue Note zum Fach '{choice.name}' hinzugefügt.")
                return subjects            
            print("Ungültige Eingabe. Note muss zwischen 1 und 6 liegen.")

        except ValueError:
            print("Ungültige Eingabe. Bitte eine Zahl eingeben.")
        except EOFError:
            print("EOFError")
            return


def delete_subject(subjects: list[Subject]) -> list[Subject]:
    first = True
    print_subtitle("Fach löschen")

    while True:
        try:
            if not first:
                print()
            first = False

            choice = print_subjects(
                subjects,
                ", welches entfernt werden soll",
            )
            choice = int(choice)
            choice = subjects[choice]

            confirm = input(f"Bist du sicher dass du '{choice.name}' entfernen möchtest? 'Ja' zum Bestätigen: ").strip().lower()
            if confirm in ["j", "ja"]:
                subjects.remove(choice)
                print("Fach entfernt.")
                return subjects
            else:
                print("Vorgang abgebrochen.")
                return subjects
            
        except ValueError:
            print("Ungültige Eingabe. Bitte eine Zahl eingeben.")


def show_overview(subjects: list[Subject]) -> list[Subject]:
    print_subtitle("Notenübersicht")

    for i, subject in enumerate(subjects):
        print(f"Fach: {subject.name} | Durchschnitt: {subject.average():.2f}")

        if subject.grades:
            print("└──" + "\tEinträge (Note | Gewichtung | Nachricht):")
        else:
            print("└──" + "\tDieses Fach enthält keine Noten.")

        for grade in subject.grades:
            print(
                f"\t{grade.value:.2f} | {grade.weight:.2f} | {grade.tag}"
            )

        if i < len(subjects) - 1:   # not the last subject
            print()


def print_subjects(subjects: list[Subject], additional: str = "") -> str:
    """Shows the user a list with indexes of existing subjects to select from"""
    
    options = {str(i): s.name for i, s in enumerate(subjects)}  # convert list to dict: {index: name}
    choice = print_menu(options, "Fach auswählen" + additional + ":")
    return choice


def print_title(title: str): 
    """Prints a title, e.g. print_title("title")"""
    width = len(title) + 4
    border = "+" + "-" * width + "+"

    print(f"\n{border}")
    print(f"|  {title}  |")
    print(border)


def print_subtitle(title: str):
    """Prints a subtitle, e.g. print_subtitle("subtitle")"""
    print("\n" + title.upper())
    print("=" * 30)


def print_menu(options: dict, title="Choose mode:", prompt="> ", start: str | None = None) -> str:
    first = True

    while True:
        if not first and not start:
            print()
        first = False

        if start:
            print(start + title)
        else:
            print(title)
        
        for key, label in options.items():
            print(f"[{key}] {label}")

        choice = input(prompt).strip().lower()

        if choice in options:
            return choice

        print(f"Ungültige Eingabe. Bitte eine dieser Optionen eingeben: {', '.join(options.keys())}.")
