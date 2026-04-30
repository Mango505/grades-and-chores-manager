from datetime import datetime
from models import Grade, Subject, Wallet, RewardConfig, AppConfig
import copy

# --- Basic functions ---

def add_grade(subjects: list[Subject], config: RewardConfig, wallet: Wallet) -> tuple[list[Subject], RewardConfig, Wallet]:
    print_subtitle("Note hinzufügen")
    if not subjects:
        print("Keine Fächer vorhanden.")
        return subjects, config, wallet
    first = True

    while True:
        try:
            # Choose subject
            choice = print_subjects(
                subjects,
                ", zu dem die Note hinzugefügt werden soll",
                start="\n" if not first else None
            ).strip().lower()
            first = False

            if choice == "z":
                print("Vorgang abgebrochen.")
                return subjects, config, wallet
            choice = int(choice)
            choice = subjects[choice]

            # Enter grade value
            value = input("Note eingeben: ").strip().lower()
            value = float(value)

            # Enter grade weight
            weight = input("Gewichtung der Note eingeben (Leerlassen zählt einfach): ").strip().lower()
            if weight:
                weight = float(weight)
            else:
                weight = 1.0

            # Enter labels
            raw_labels = input("Labels für die Note eingeben oder leerlassen (Komma als Trennzeichen): ").strip()
            labels = [t.strip() for t in raw_labels.split(",")] if raw_labels else []     # empty list if no input
            for i, t in enumerate(labels):
                labels[i] = t.strip()

            grade = Grade(value, weight, labels)   # create Grade object from user inputs

            if grade.is_valid():
                print(f"Vorschau: Note {value} | Gewichtung: {weight} | Labels: {raw_labels}")

                c = confirm("Ist das korrekt?")
                if c is True:
                    choice.add_grade(grade)    # add the Grade to the desired subject
                    print(f"\nNeue Note zum Fach '{choice.name}' hinzugefügt.")

                    if config.enabled:  # show earnings if rewards are enabled
                        points = config.points_for_grade(value)
                        money = config.money_for_points(points)
                        print(f"Note {value}: {points} Punkte (+{money:.2f} €)")
                        wallet.balance += money
                        print(f"Aktueller Kontostand: {wallet.balance:.2f} €")

                    return subjects, config, wallet
                elif c is False: 
                    print("Vorgang abgebrochen.")
                    return subjects, config, wallet
                continue

            print("Ungültige Eingabe. Note muss zwischen 1 und 6 liegen und Gewichtung muss höher als 0 sein.")

        except ValueError:
            print("Ungültige Eingabe. Bitte eine Zahl eingeben.")
        except EOFError:
            print("EOFError")
            return subjects, config, wallet


def edit_grade(subjects: list[Subject], config: RewardConfig, wallet: Wallet) -> tuple[list[Subject], Wallet]:
    print_subtitle("Note bearbeiten")
    if not subjects:
        print("Keine Fächer vorhanden.")
        return subjects, wallet
    first = True

    while True:
        # Choose subject
        choice = print_subjects(
            subjects,
            ", dessen Note bearbeitet werden soll",
            start="\n" if not first else None
        ).strip().lower()
        first = False

        if choice == "z":
            print("Vorgang abgebrochen.")
            return subjects, wallet
        
        subject = subjects[int(choice)]
        if not subject.grades:
            print(f"'{subject.name}' enthält keine Noten.")
            continue

        # Choose grade
        grade_options = {
            str(i): f"{g.value} | {g.weight:.1f} | {', '.join(g.labels)}"
            for i, g in enumerate(subject.grades)
        }
        grade_options["z"] = "Zurück"
        grade_choice = print_menu(grade_options, "Note auswählen:", start="\n")

        if grade_choice == "z":
            continue    # back to subject selection
        
        grade = subject.grades[int(grade_choice)]


        while True:
            # Choose mode
            print(f"\nAktuell: {grade.value} | {grade.weight:.1f} | {', '.join(grade.labels)}")
            mode_choice = print_menu({
                "1": "Note bearbeiten",
                "2": "Labels leeren",
                "3": "Note löschen",
                "z": "Zurück"
            }, "Was möchtest du tun?")

            if mode_choice == "z": break

            # Edit fields (empty = keep current)
            elif mode_choice == "1":
                try:
                    new_value = input(f"Neue Note eingeben oder Leerlassen zum Beibehalten (Aktuell {grade.value}): ").strip()
                    new_value = float(new_value) if new_value else grade.value

                    new_weight = input(f"Neue Gewichtung eingeben oder Leerlassen zum Beibehalten (Aktuell {grade.weight}): ").strip()
                    new_weight = float(new_weight) if new_weight else grade.weight

                    raw_labels = input(f"Neue Labels eingeben oder Leerlassen zum Beibehalten (Aktuell {', '.join(grade.labels)}): ").strip()
                    new_labels = [t.strip() for t in raw_labels.split(",")] if raw_labels else grade.labels

                    new_grade = Grade(new_value, new_weight, new_labels)
                    if not new_grade.is_valid():
                        print("Ungültige Eingabe. Note muss zwischen 1 und 6 liegen und Gewichtung muss höher als 0 sein.")
                        continue

                    print(f"\nVorschau: {new_value} | {new_weight} | {', '.join(new_labels)}")
                    c = confirm("Bist du sicher dass du diese Änderungen übernehmen möchtest?")
                    if c is True:
                        if config.enabled:
                            old_money = config.money_for_points(config.points_for_grade(grade.value))
                            new_money = config.money_for_points(config.points_for_grade(new_value))
                            diff = new_money - old_money
                            if diff != 0:
                                sign = "+" if diff > 0 else ""
                                c2 = confirm(f"Notenwert ändert sich, Guthaben um {sign}{diff:.2f} € anpassen?")
                                if c2 is True:
                                    wallet.balance += diff
                                    print(f"Guthaben angepasst: {sign}{diff:.2f} €")
                                    print(f"Aktueller Kontostand: {wallet.balance:.2f} €")
                                elif c2 is None:
                                    continue
                        subject.grades[int(grade_choice)] = new_grade
                        print("Note aktualisiert.")
                        return subjects, wallet
                    elif c is False:
                        print("Vorgang abgebrochen.")
                        return subjects, wallet
                    # None → continue (back to subject selection)

                except ValueError:
                    print("Ungültige Eingabe. Bitte eine Zahl eingeben.")

            # Clear labels
            elif mode_choice == "2":
                c = confirm("Möchtest du alle Labels dieser Note entfernen?")
                if c is True:
                    grade.labels = []
                    print("Note aktualisiert.")
                    return subjects, wallet
                elif c is False:
                    print("Vorgang abgebrochen.")
                    return subjects, wallet
                # None → continue (back to subject selection)

            # Delete grade
            elif mode_choice == "3":
                c = confirm("Bist du sicher dass du diese Note löschen möchtest?")
                if c is True:
                    if config.enabled:
                        old_points = config.points_for_grade(grade.value)
                        old_money = config.money_for_points(old_points)
                        if old_money > 0:
                            c2 = confirm(f"Note {grade.value} hat {old_money:.2f} € eingebracht. Guthaben zurückbuchen?")
                            if c2 is True:
                                if wallet.balance - old_money <= 0:
                                    c3 = confirm("Dein Guthaben wird dadurch in den negativen Bereich zurückfallen, fortfahren?")
                                    if c3 is True:
                                        wallet.balance -= old_money
                                        print(f"Guthaben angepasst: -{old_money:.2f} €")
                                        print(f"Aktueller Kontostand: {wallet.balance:.2f} €")
                                    elif c3 is None:
                                        continue
                            elif c2 is None:
                                continue
                    subject.remove_grade(int(grade_choice))
                    print("Note gelöscht.")
                    return subjects, wallet
                elif c is False:
                    print("Vorgang abgebrochen.")
                    return subjects, wallet
                # None → continue (back to subject selection)


def redeem(wallet: Wallet) -> Wallet:
    print_subtitle("Guthaben einlösen")
    if wallet.balance < 0.50:
        print("Guthaben zu klein.")
        return wallet

    while True:
        try:
            cost = input("Betrag eingeben, der vom Konto abgezogen werden soll: ").strip()
            cost = float(cost)
            if cost > wallet.balance:
                print(f"Ungültige Eingabe. Betrag muss kleiner oder gleich dem aktuellen Kontostand von {wallet.balance:.2f} € sein.")
                continue
            if cost <= 0.01:
                print("Ungültige Eingabe. Betrag muss größer als 0,01 € sein.")
                continue

            description = input("Beschreibung hinzufügen oder leerlassen: ").strip()

            desc = description if description else '<keine Beschreibung>'
            date = datetime.now().strftime("%d.%m.%Y %H:%M")
            print("\nVorschau:")
            print(f"{desc} | -{cost:.2f} € | {date}")

            c = confirm("\nIst das korrekt?")
            if c is True:
                wallet.redeem(cost, description if description else "<keine Beschreibung>")
                print(f"Guthaben erfolgreich eingelöst. Neuer Kontostand: {wallet.balance:.2f} €")
                return wallet
            elif c is False:
                print("Vorgang abgebrochen.")
                return wallet
            continue

        except ValueError:
            print("Ungültige Eingabe. Bitte eine Zahl eingeben.")


def show_overview(subjects: list[Subject]) -> list[Subject]:
    print_subtitle("Notenübersicht")
    if not subjects:
        print("Keine Fächer vorhanden.")
        return subjects

    total_value = 0.0
    total_weight = 0.0

    for i, subject in enumerate(subjects):
        print(f"Fach: {subject.name} | Durchschnitt: {subject.average():.2f}")

        if subject.grades:
            print("└──" + "\tEinträge (Note | Gewichtung | Labels):")
        else:
            print("└──" + "\tDieses Fach enthält keine Noten.")

        for grade in subject.grades:
            labels_str = ", ".join(grade.labels)
            print(f"\t{grade.value} | {grade.weight:.1f} | {labels_str}")
            total_value += grade.value * grade.weight
            total_weight += grade.weight

        print()

    overall = f"{total_value / total_weight:.2f}" if total_weight > 0 else "N/A"
    print(f"Gesamtdurchschnitt: {overall}")


def filter_by_label(subjects: list[Subject]) -> list[Subject]:
    print_subtitle("Nach Labels filtern")
    if not subjects:
        print("Keine Fächer vorhanden.")
        return subjects

    choice = print_menu({
        "1": "Es müssen alle Labels übereinstimmen",
        "2": "Es muss mindestens ein Labels übereinstimmen"
    }, "Wähle einen Filtermodus aus:")
    if choice == "1":
        mode = "and"
    if choice == "2":
        mode = "or"

    raw_labels = input("Nach welchen Labels möchtest du filtern (Komma als Trennzeichen)? ").strip()
    if not raw_labels:
        print("Ungültige Eingabe.")
        return subjects
    labels = [t.strip() for t in raw_labels.split(",")]

    total_value = 0.0
    total_weight = 0.0
    found = False

    for subject in subjects:
        if mode == "and":
            filtered = [g for g in subject.grades if all(t in g.labels for t in labels)]
        if mode == "or":
            filtered = [g for g in subject.grades if any(t in g.labels for t in labels)]
        if not filtered:
            continue

        found = True
        print(f"\nFach: {subject.name} | Label-Durchschnitt: {subject.average_by_label(labels, f"{mode}"):.2f}")
        print("└──\tEinträge (Note | Gewichtung | Labels):")
        for grade in filtered:
            labels_str = ', '.join(grade.labels)
            print(f"\t{grade.value} | {grade.weight:.1f} | {labels_str}")
            total_value += grade.value * grade.weight
            total_weight += grade.weight

    if not found:
        print(f"Keine Einträge mit Label{'s' if len(labels) > 1 else ''} '{raw_labels}' gefunden.")
        return subjects

    print(f"\nGesamtdurchschnitt für '{raw_labels}': {total_value / total_weight:.2f}")
    return subjects


def show_balance(config: RewardConfig, wallet: Wallet) -> tuple[RewardConfig, Wallet]:
    print_subtitle("Kontoübersicht")

    # Balance
    print(f"Aktueller Kontostand: {wallet.balance:.2f} €", end="\n\n")

    # Redemptions
    if wallet.redemptions:
        print("Letzte Einlösungen:")
        for r in wallet.redemptions[-5:][::-1]:  # show last 5 redemptions
            desc = r["description"]
            cost = r["cost"]
            date = r.get("date", "<unbekanntes Datum>")
            print(f"{desc} | -{cost:.2f} € | {date}")

        length = len(wallet.redemptions)
        if length > 5: 
            c = confirm(f"\nSollen alle {length} Einträge angezeigt werden?")
            if c is True:
                for r in wallet.redemptions:    # show all, including previously shown
                    desc = r["description"]
                    cost = r["cost"]
                    date = r.get("date", "<unbekanntes Datum>")
                    print(f"{desc} | -{cost:.2f} € | {date}")

    return config, wallet


def create_subject(subjects: list[Subject]) -> list[Subject]:
    first = True
    print_subtitle("Fach erstellen")

    while True:
        raw = input("\nName für neues Fach eingeben: " if not first else "Name für neues Fach eingeben: ").strip()
        first = False
        if not raw: print("Name darf nicht leer sein."); continue

        if raw not in [s.name for s in subjects]:
            subjects.append(Subject(raw))
            print(f"'{raw}' wurde als neues Fach hinzugefügt.")
            return subjects
        print("Fach existiert bereits. Bitte einen anderen Namen angeben, der noch nicht existiert.")


def delete_subject(subjects: list[Subject]) -> list[Subject]:
    print_subtitle("Fach löschen")
    if not subjects:
        print("Keine Fächer vorhanden.")
        return subjects
    first = True

    while True:
        try:
            choice = print_subjects(
                subjects,
                ", welches entfernt werden soll",
                start="\n" if not first else None
            ).strip().lower()
            first = False

            if choice == "z":
                print("Vorgang abgebrochen.")
                return subjects
            choice = int(choice)
            choice = subjects[choice]

            c = confirm(f"Bist du sicher dass du '{choice.name}' entfernen möchtest?")
            if c is True:
                subjects.remove(choice)
                print("Fach entfernt.")
                return subjects
            elif c is False:
                print("Vorgang abgebrochen.")
                return subjects

        except ValueError:
            print("Ungültige Eingabe. Bitte eine Zahl eingeben.")


def edit_config(app_config: AppConfig, reward_config: RewardConfig) -> tuple[AppConfig, RewardConfig]:
    print_subtitle("Konfiguration anpassen")
    first = True

    while True:
        choice = print_menu({
            "1": "App-Konfiguration ansehen",
            "2": "Belohnungskonfiguration anpassen",
            "3": "Standard-Pfade anpassen",
            "4": "Ladehinweise anpassen",
            "z": "Zurück"
        },
        start="\n" if not first else None)
        first = False

        if choice == "z":
            return app_config, reward_config
        elif choice == "1":
            print_configuration("app", app_config, start="\n")
        elif choice == "2":
            reward_config = configure_rewards(reward_config)
        elif choice == "3":
            app_config = configure_paths(app_config)
        elif choice == "4":
            app_config = configure_loading(app_config)

# --- Configuration editing functions ---

def configure_rewards(config: RewardConfig) -> RewardConfig:
    print_subtitle("Belohnungskonfiguration anpassen", 2, "-")

    # System disabled: only offer to enable it
    if not config.enabled:
        status_label = "deaktiviert"
        print(f"Belohnungssystem: {status_label}")
        choice = print_menu({
            "1": "Belohnungssystem aktivieren",
            "z": "Zurück"
        }, start="\n")
        if choice == "1":
            config.enabled = True
            print("Belohnungssystem aktiviert.")
        return config

    # System enabled: show full config and all options
    first = True
    while True:
        print_subtitle("Aktuelle Konfiguration", 3, "=", start="\n" if not first else None)
        first = False
        print_configuration("reward", config)

        choice = print_menu({
            "1": "Punkte pro Note",
            "2": "Geld pro Punkt",
            "3": "Belohnungssystem deaktivieren",
            "z": "Zurück"
        },
        "Was möchtest du ändern?",
        start="\n"
        )

        if choice == "z":
            return config

        elif choice == "1":
            print_subtitle("Punkte pro Note ändern", 4, "-")
            new_config = copy.deepcopy(config)   # create a copy of the current config to edit, so changes are not applied until confirmation

            for g, p in new_config.points_map.items():
                while True:
                    try:
                        new = input(f"Neuen Punktewert für Note {g} eingeben oder Leerlassen zum Beibehalten (Aktuell {p} Punkte)" + "\n> ").strip()
                        if new:
                            new = int(new)
                            new_config.points_map[g] = new
                            break
                        else:
                            break
                    except ValueError:
                        print("Ungültige Eingabe. Bitte eine Ganzzahl eingeben.\n")

            # Print new configuration
            print_subtitle("Neue Konfiguration", 3, "=")
            print_configuration("points_map", new_config)

            c = confirm("Bist du sicher dass du diese Änderungen übernehmen möchtest?")
            if c is True: print("Änderungen übernommen."); return new_config
            elif c is False: print("Vorgang abgebrochen."); return config

        elif choice == "2":
            money = config.money_per_point

            while True:
                try:
                    raw = input(f"Neuen Geldwert pro Punkt eingeben oder leerlassen zum Beibehalten (Aktuell {money:.2f} € pro Punkt)" + "\n> ").strip()
                    new_money = float(raw)

                    c = confirm(f"Bist du sicher dass du den Geldwert pro Punkt zu {new_money:.2f} € ändern möchtest?")
                    if c is True:
                        config.money_per_point = new_money
                        print("Änderungen übernommen.")
                        return config
                    elif c is False: print("Vorgang abgebrochen."); return config
                    elif c is None: break

                except ValueError:
                    print("Ungültige Eingabe. Bitte eine Zahl eingeben.")

        elif choice == "3":
            c = confirm("Bist du sicher dass du das Belohnungssystem deaktivieren möchtest?")
            if c is True:
                config.enabled = False
                print("Belohnungssystem deaktiviert.")
            elif c is False:
                print("Vorgang abgebrochen.")


def _is_valid_path(path: str) -> bool:
    """Check that a path contains no null bytes or Windows-illegal characters."""
    invalid_chars = set('\0<>"|?*')
    return bool(path) and not any(c in invalid_chars for c in path)


def configure_paths(config: AppConfig) -> AppConfig:
    print_subtitle("Standard-Pfade anpassen", 2, "-")
    print_subtitle("Aktuelle Konfiguration", 3, "=", start=None)
    print_configuration("paths", config)

    while True:
        choice = print_menu({
            "1": "App-Konfigurationsdatei",
            "2": "Noten-Datei",
            "3": "Wallet-Datei",
            "4": "Belohnungs-Konfigurationsdatei",
            "z": "Zurück"
        },
        "Welchen Pfad möchtest du ändern?",
        start="\n"
        )

        if choice == "z":
            return config

        elif choice == "1":
            new = input(f"Neuen Pfad für die App-Konfigurationsdatei eingeben (Aktuell: {config.app_config_path})" + "\n> ").strip()
            if not new: continue
            if not _is_valid_path(new): print("Ungültiger Pfad. Bitte keine Sonderzeichen wie < > \" | ? * verwenden."); continue

            c = confirm(f"Bist du sicher dass du den Pfad der App-Konfigurationsdatei zu '{new}' ändern möchtest?")
            if c is True:
                config.app_config_path = new
                print("Änderungen übernommen.")
                return config
            elif c is False: print("Vorgang abgebrochen."); return config

        elif choice == "2":
            new = input(f"Neuen Pfad für die Noten-Datei eingeben (Aktuell: {config.data_path})" + "\n> ").strip()
            if not new: continue
            if not _is_valid_path(new): print("Ungültiger Pfad. Bitte keine Sonderzeichen wie < > \" | ? * verwenden."); continue

            c = confirm(f"Bist du sicher dass du den Pfad der Noten-Datei zu '{new}' ändern möchtest?")
            if c is True:
                config.data_path = new
                print("Änderungen übernommen.")
                return config
            elif c is False: print("Vorgang abgebrochen."); return config

        elif choice == "3":
            new = input(f"Neuen Pfad für die Wallet-Datei eingeben (Aktuell: {config.wallet_path})" + "\n> ").strip()
            if not new: continue
            if not _is_valid_path(new): print("Ungültiger Pfad. Bitte keine Sonderzeichen wie < > \" | ? * verwenden."); continue
            
            c = confirm(f"Bist du sicher dass du den Pfad der Wallet-Datei zu '{new}' ändern möchtest?")
            if c is True:
                config.wallet_path = new
                print("Änderungen übernommen.")
                return config
            elif c is False: print("Vorgang abgebrochen."); return config

        elif choice == "4":
            new = input(f"Neuen Pfad für die Belohnungs-Konfigurationsdatei eingeben (Aktuell: {config.reward_config_path})" + "\n> ").strip()
            if not new: continue
            if not _is_valid_path(new): print("Ungültiger Pfad. Bitte keine Sonderzeichen wie < > \" | ? * verwenden."); continue
            
            c = confirm(f"Bist du sicher dass du den Pfad der Belohnungs-Konfigurationsdatei zu '{new}' ändern möchtest?")
            if c is True:
                config.reward_config_path = new
                print("Änderungen übernommen.")
                return config
            elif c is False: print("Vorgang abgebrochen."); return config


def configure_loading(config: AppConfig) -> AppConfig:
    print_subtitle("Ladehinweise anpassen", 2, "-")
    print_configuration("verbose_loading", config)

    action = "aktivieren" if not config.verbose_loading else "deaktivieren"
    choice = print_menu({
        "1": f"Ladehinweise {action}",
        "z": "Zurück"
    })

    if choice == "z":
        return config
    elif choice == "1":
        config.verbose_loading = not config.verbose_loading
        status = "aktiviert" if config.verbose_loading else "deaktiviert"
        print(f"Ladehinweise wurden {status}.")
        return config

# --- Helpers ---

def print_subjects(subjects: list[Subject], additional: str = "", start: str | None = None) -> str:
    """Shows the user a list with indexes of existing subjects to select from"""

    options = {str(i): s.name for i, s in enumerate(subjects)}  # convert list to dict: {index: name}
    options["z"] = "Zurück"
    choice = print_menu(options, "Fach auswählen" + additional + ":", start=start)
    return choice


def confirm(message: str, prompt: str = " 'J'/'N'/'Z': ") -> bool | None:
    while True:
        choice = input(message + prompt).strip().lower()
        if choice in ["ja", "j"]:
            return True
        if choice in ["nein", "n"]:
            return False
        if choice in ["zurück", "z"]:
            return None    # caller should treat as "back"
        print("Ungültige Eingabe.")


def print_title(title: str): 
    """Prints a title, e.g. print_title("title")"""
    width = len(title) + 4
    border = "+" + "-" * width + "+"

    print(f"\n{border}")
    print(f"|  {title}  |")
    print(border)


def print_subtitle(title: str, size: int = 1, symbol: str = "=", start: str | None = "\n", width = 30, min_symbols = 3):
    """
        Prints a subtitle, e.g. print_subtitle("subtitle"). A bigger size value means smaller subtitle, so smallest size is 4, biggest is 1.
        \nmin_symbols only needed for sizes 3 and 4.
    """
    start = start if start else ""

    if size == 1:
        print(start + title.upper())
        print(symbol * width)
    
    elif size == 2:
        print(start + title)
        print(symbol * width)
    
    elif size == 3:
        text = f" {title.upper()} "
        width = max(width, len(text) + min_symbols * 2)
        print(start + text.center(width, symbol))
    
    elif size == 4:
        text = f" {title} "
        width = max(width, len(text) + min_symbols * 2)
        print(start + text.center(width, symbol))


def print_menu(options: dict, title="", prompt="> ", start: str | None = None) -> str:
    """
        Returns key of chosen option (lowercase).
    """
    first = True

    while True:
        if not first and not start: print()
        first = False

        if start: print(start, end="")
        if title: print(title)
        
        for key, label in options.items():
            print(f"[{key}] {label}")

        choice = input(prompt).strip().lower()

        if choice in options:
            return choice

        print(f"Ungültige Eingabe. Bitte eine dieser Optionen eingeben: {', '.join(options.keys())}.")


def print_configuration(mode: str, config: AppConfig | RewardConfig, start: str = "") -> None:
    """
        Prints configuration values.
        \nModes for AppConfig: 'app', 'paths', 'verbose_loading'.
        \nModes for RewardConfig: 'reward', 'points_map', 'money_per_point'.
    """

    # --- For RewardConfig ---
    if mode == "reward":
        status = "aktiviert" if config.enabled else "deaktiviert"
        print(start + f"Belohnungssystem: {status}")
        print(f"Geld pro Punkt: {config.money_per_point:.2f} €")

        print("Punkte pro Note:")
        items = list(config.points_map.items())
        for i, (k, v) in enumerate(items):
            print(f"Note {k}: {v} Pt.", end="\n")

    elif mode == "points_map":
        print(start + "Punkte pro Note:")
        items = list(config.points_map.items())
        for i, (k, v) in enumerate(items):
            sep = "\n" if i < len(items) - 1 else "\n\n"
            print(f"Note {k}: {v} Pt.", end=sep)

    elif mode == "money_per_point":
        print(start + f"Geld pro Punkt: {config.money_per_point:.2f} €")

    # --- For AppConfig ---
    elif mode == "app":
        print(start + f"Pfad der App-Konfigurationsdatei: {config.app_config_path}")
        print(f"Pfad der Noten-Datei: {config.data_path}")
        print(f"Pfad der Wallet-Datei: {config.wallet_path}")
        print(f"Pfad der Belohnungs-Konfigurationsdatei: {config.reward_config_path}")

        status = "aktiviert" if config.verbose_loading else "deaktiviert"
        print(f"Status der Ladehinweise: {status}")

    elif mode == "paths":
        print(start + f"Pfad der App-Konfigurationsdatei: {config.app_config_path}")
        print(f"Pfad der Noten-Datei: {config.data_path}")
        print(f"Pfad der Wallet-Datei: {config.wallet_path}")
        print(f"Pfad der Belohnungs-Konfigurationsdatei: {config.reward_config_path}")

    elif mode == "verbose_loading":
        status = "aktiviert" if config.verbose_loading else "deaktiviert"
        print(start + f"Status der Ladehinweise: {status}")
