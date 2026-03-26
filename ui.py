from models import Grade, Subject

def create_subject(subjects: list[Subject]) -> list[Subject]:
    while True:
        raw = input("Name für neues Fach eingeben: ").strip()
        
        if raw not in [s.name for s in subjects]:
            subjects.append(Subject(raw))
            return subjects
        print("Fach existiert bereits. Bitte einen anderen Namen angeben, der noch nicht existiert.")


def add_grade(subjects: list[Subject]) -> list[Subject]:
    while True:
        try:
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
                print(f"Neue Note zum Fach '{choice}' hinzugefügt.")
                return subjects            
            print("Note muss zwischen 1 und 6 liegen.")

        except ValueError:
            print("Ungültige Eingabe. Bitte eine Zahl eingeben.")
        except EOFError:
            print("EOFError")
            return


def delete_subject(subjects: list[Subject]) -> list[Subject]:
    while True:
        try:
            choice = print_subjects(
                subjects,
                ", welches entfernt werden soll"
            )
            choice = int(choice)
            choice = subjects[choice]

            subjects.remove(choice)
            return subjects
            
        except ValueError:
            print("Ungültige Eingabe. Bitte eine Zahl eingeben.")


def show_overview(subjects: list[Subject]) -> list[Subject]:
    for subject in subjects:
        print(
            "Fach:", subject.name,
            "|",
            "Durchschnitt:", subject.average(),
            "\n",
            end=""
        )

        if not subject.grades:
            print("Dieses Fach enthält keine Noten.")
            continue

        for grade in subject.grades:
            print(
                grade.value, grade.weight, grade.tag, sep=" | "
            )


def print_subjects(subjects: list[Subject], additional: str = "") -> str:
    """Shows the user a list with indexes of existing subjects to select from"""
    
    options = {str(i): s.name for i, s in enumerate(subjects)}  # convert list to dict: {index: name}
    choice = print_menu(options, "Fach auswählen" + additional + ":")
    return choice


def print_title(title): 
    """Prints a title, e.g. print_title("title")"""
    width = len(title) + 4
    border = "+" + "-" * width + "+"

    print(f"\n{border}")
    print(f"|  {title}  |")
    print(border)


def print_subtitle(title):
    """Prints a subtitle, e.g. print_subtitle("subtitle")"""
    print("\n" + "=" * 30)
    print(title.upper())
    print("=" * 30)


def print_menu(options, title="Choose mode:", prompt="> "):
    while True:
        print(f"\n{title}")
        for key, label in options.items():
            print(f"[{key}] {label}")

        choice = input(prompt).strip()

        if choice in options:
            return choice

        print(f"Invalid input. Please choose one of: {', '.join(options.keys())}.")
