from datetime import datetime
from models import Grade, Subject, Wallet, RewardConfig, AppConfig
import copy

# --- Basic functions ---

def add_grade(subjects: list[Subject], config: RewardConfig, wallet: Wallet) -> tuple[list[Subject], RewardConfig]:
    print_subtitle("Note hinzufügen")
    if not subjects:
        print("Keine Fächer vorhanden.")
        return subjects, config, wallet
    first = True

    while True:
        try:
            if not first: print()
            first = False

            # Choose subject
            choice = print_subjects(
                subjects,
                ", zu dem die Note hinzugefügt werden soll"
            ).strip().lower()
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

            # Enter tags
            raw_tags = input("Tags für die Note eingeben oder leerlassen (Komma als Trennzeichen): ").strip()
            tags = [t.strip() for t in raw_tags.split(",")] if raw_tags else []     # empty list if no input
            for i, t in enumerate(tags):
                tags[i] = t.strip()

            grade = Grade(value, weight, tags)   # create Grade object from user inputs

            if grade.is_valid():
                choice.add_grade(grade)    # add the Grade to the desired subject
                print(f"\nNeue Note zum Fach '{choice.name}' hinzugefügt.")

                points = config.points_for_grade(value)
                money = config.money_for_points(points)
                print(f"Note {value}: {points} Punkte (+{money:.2f} €)")
                wallet.balance += money
                print(f"Aktueller Kontostand: {wallet.balance:.2f} €")

                return subjects, config, wallet
            print("Ungültige Eingabe. Note muss zwischen 1 und 6 liegen und Gewichtung muss höher als 0 sein.")

        except ValueError:
            print("Ungültige Eingabe. Bitte eine Zahl eingeben.")
        except EOFError:
            print("EOFError")
            return subjects, config, wallet


def redeem(wallet: Wallet) -> Wallet:
    print_subtitle("Guthaben einlösen")
    
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

            print()
            desc = description if description else '<keine Beschreibung>'
            date = datetime.now().strftime("%d.%m.%Y %H:%M")
            print("Vorschau:")
            print(f"{desc} | -{cost:.2f} € | {date}")
            confirm = input("Ist das korrekt? 'J' zum Bestätigen: ").strip().lower()
            if confirm == "j":
                wallet.redeem(cost, description if description else "<keine Beschreibung>")
                print(f"Guthaben erfolgreich eingelöst. Neuer Kontostand: {wallet.balance:.2f} €")
                return wallet
            print("Vorgang abgebrochen.")
            break
        
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
            print("└──" + "\tEinträge (Note | Gewichtung | Tags):")
        else:
            print("└──" + "\tDieses Fach enthält keine Noten.")

        for grade in subject.grades:
            tags_str = ", ".join(grade.tags)
            print(f"\t{grade.value} | {grade.weight:.1f} | {tags_str}")
            total_value += grade.value * grade.weight
            total_weight += grade.weight

        if i < len(subjects) - 1: print()   # not the last subject

    overall = f"{total_value / total_weight:.2f}" if total_weight > 0 else "N/A"
    print(f"\nGesamtdurchschnitt: {overall}")


def filter_by_tag(subjects: list[Subject]) -> list[Subject]:
    print_subtitle("Nach Tags filtern")
    if not subjects:
        print("Keine Fächer vorhanden.")
        return subjects
    
    choice = print_menu({
        "1": "Es müssen alle Tags übereinstimmen",
        "2": "Es muss mindestens ein Tag übereinstimmen"
    }, "Wähle einen Filtermodus aus:")
    if choice == "1":
        mode = "and"
    if choice == "2":
        mode = "or"

    raw_tags = input("Nach welchen Tags möchtest du filtern (Komma als Trennzeichen)? ").strip()
    tags = [t.strip() for t in raw_tags.split(",")] if raw_tags else []

    total_value = 0.0
    total_weight = 0.0
    found = False

    for subject in subjects:
        if mode == "and":
            filtered = [g for g in subject.grades if all(t in g.tags for t in tags)]
        if mode == "or":
            filtered = [g for g in subject.grades if any(t in g.tags for t in tags)]
        if not filtered:
            continue

        found = True
        print(f"\nFach: {subject.name} | Tag-Durchschnitt: {subject.average_by_tag(tags, f"{mode}"):.2f}")
        print("└──\tEinträge (Note | Gewichtung | Tags):")
        for grade in filtered:
            tags_str = ', '.join(grade.tags)
            print(f"\t{grade.value} | {grade.weight:.1f} | {tags_str}")
            total_value += grade.value * grade.weight
            total_weight += grade.weight

    if not found:
        print(f"Keine Einträge mit Tag '{tags}' gefunden.")
        return subjects

    print(f"\nGesamtdurchschnitt für '{raw_tags}': {total_value / total_weight:.2f}")
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

        while True:
            more = print_menu({
                "1": "Fünf weitere Einlösungen anzeigen",
                "2": "Alle Einlösungen anzeigen",
                "z": "Zurück zum Menü"
            },
            "Was möchtest du tun?",
            start="\n"
            )
            if more == "z": break

            elif more == "1":
                for r in wallet.redemptions[-10:-5][::-1]:  # show 5 more redemptions
                    desc = r["description"]
                    cost = r["cost"]
                    date = r.get("date", "<unbekanntes Datum>")
                    print(f"{desc} | -{cost:.2f} € | {date}")

            elif more == "2":
                if len(wallet.redemptions) > 15:   # ask before showing long list
                    confirm = input(f"Sollen alle {len(wallet.redemptions)} Einträge angezeigt werden? 'J' zum Fortfahren: ").strip().lower()
                    if confirm != "j": continue
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
        if not first: print()
        first = False

        raw = input("Name für neues Fach eingeben: ").strip()
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
            if not first: print()
            first = False

            choice = print_subjects(
                subjects,
                ", welches entfernt werden soll",
            ).strip().lower()
            if choice == "z":
                print("Vorgang abgebrochen.")
                return subjects
            choice = int(choice)
            choice = subjects[choice]

            confirm = input(f"Bist du sicher dass du '{choice.name}' entfernen möchtest? 'J' zum Bestätigen: ").strip().lower()
            if confirm == "j":
                subjects.remove(choice)
                print("Fach entfernt.")
                return subjects
            print("Vorgang abgebrochen.")

        except ValueError:
            print("Ungültige Eingabe. Bitte eine Zahl eingeben.")


def edit_config(app_config: AppConfig, reward_config: RewardConfig) -> tuple[AppConfig, RewardConfig]:
    print_subtitle("Konfiguration anpassen")

    while True:
        choice = print_menu({
            "1": "App-Konfiguration ansehen",
            "2": "Belohnungskonfiguration anpassen",
            "3": "Standard-Pfade anpassen",
            "4": "Ladehinweise anpassen",
            "z": "Zurück"
        })

        if choice == "z":
            return app_config, reward_config
        elif choice == "1":
            print_configuration("app", app_config)
        elif choice == "2":
            return app_config, configure_rewards(reward_config)
        elif choice == "3":
            return configure_paths(app_config), reward_config
        elif choice == "4":
            return configure_loading(app_config), reward_config

# --- Configuration editing functions ---

def configure_rewards(config: RewardConfig) -> RewardConfig:
    print_subtitle("Belohnungskonfiguration anpassen", 2, "-")

    # Print current configuration
    print_subtitle("Aktuelle Konfiguration", 3, "=")
    print_configuration("reward", config)

    choice = print_menu({
        "1": "Punkte pro Note",
        "2": "Geld pro Punkt",
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
        print()
        print_subtitle("Neue Konfiguration", 3, "=")
        print_configuration("points_map", new_config)

        confirm = input("Bist du sicher dass du diese Änderungen übernehmen möchtest? 'J' zum Fortfahren: ").strip().lower()
        if confirm == "j": print("Änderungen übernommen."); return new_config
        else: print("Vorgang abgebrochen."); return config

    elif choice == "2":
        money = config.money_per_point

        while True:
            try:
                raw = input(f"Neuen Geldwert pro Punkt eingeben oder leerlassen zum Beibehalten (Aktuell {money:.2f} € pro Punkt)" + "\n> ").strip()
                new_money = float(raw)

                confirm = input(f"Bist du sicher dass du den Geldwert pro Punkt zu {new_money:.2f} € ändern möchtest? 'J' zum Fortfahren: ").strip().lower()
                if confirm == "j": config.money_per_point = new_money; print("Änderungen übernommen."); return config
                else: print("Vorgang abgebrochen."); return config

            except ValueError:
                print("Ungültige Eingabe. Bitte eine Zahl eingeben.")


def configure_paths(config: AppConfig) -> AppConfig:
    print_subtitle("Standard-Pfade anpassen", 2, "-")
    print_subtitle("Aktuelle Konfiguration", 3, "=")
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
            if new:
                confirm = input(f"Bist du sicher dass du den Pfad der App-Konfigurationsdatei zu {new} ändern möchtest? 'J' zum Fortfahren: ").strip().lower()
                if confirm == "j": config.app_config_path = new; print("Änderungen übernommen."); return config
                else: print("Vorgang abgebrochen."); return config
            else: print("Pfad darf nicht leer sein."); continue
        
        elif choice == "2":
            new = input(f"Neuen Pfad für die Noten-Datei eingeben (Aktuell: {config.data_path})" + "\n> ").strip()
            if new:
                confirm = input(f"Bist du sicher dass du den Pfad der Noten-Datei zu {new} ändern möchtest? 'J' zum Fortfahren: ").strip().lower()
                if confirm == "j": config.data_path = new; print("Änderungen übernommen."); return config
                else: print("Vorgang abgebrochen."); return config
            else: print("Pfad darf nicht leer sein."); continue
        
        elif choice == "3":
            new = input(f"Neuen Pfad für die Wallet-Datei eingeben (Aktuell: {config.wallet_path})" + "\n> ").strip()
            if new:
                confirm = input(f"Bist du sicher dass du den Pfad der Wallet-Datei zu {new} ändern möchtest? 'J' zum Fortfahren: ").strip().lower()
                if confirm == "j": config.wallet_path = new; print("Änderungen übernommen."); return config
                else: print("Vorgang abgebrochen."); return config
            else: print("Pfad darf nicht leer sein."); continue
        
        elif choice == "4":
            new = input(f"Neuen Pfad für die Belohnungs-Konfigurationsdatei eingeben (Aktuell: {config.reward_config_path})" + "\n> ").strip()
            if new:
                confirm = input(f"Bist du sicher dass du den Pfad der Belohnungs-Konfigurationsdatei zu {new} ändern möchtest? 'J' zum Fortfahren: ").strip().lower()
                if confirm == "j": config.reward_config_path = new; print("Änderungen übernommen."); return config
                else: print("Vorgang abgebrochen."); return config
            else: print("Pfad darf nicht leer sein."); continue


def configure_loading(config: AppConfig) -> AppConfig:
    print_subtitle("Ladehinweise anpassen", 2, "-")
    print_configuration("verbose_loading", config)

    action = "aktivieren" if not config.verbose_loading else "deaktivieren"
    choice = print_menu({
        "1": f"Ladehinweise {action}",
        "z": "Zurück"
    },
    "Was möchtest du tun?"
    )

    if choice == "z":
        return config
    elif choice == "1":
        config.verbose_loading = not config.verbose_loading
        status = "aktiviert" if config.verbose_loading else "deaktiviert"
        print(f"Ladehinweise wurden {status}.")
        return config

# --- Templates ---

def print_subjects(subjects: list[Subject], additional: str = "") -> str:
    """Shows the user a list with indexes of existing subjects to select from"""
    
    options = {str(i): s.name for i, s in enumerate(subjects)}  # convert list to dict: {index: name}
    options["z"] = "Zurück"
    choice = print_menu(options, "Fach auswählen" + additional + ":")
    return choice


def print_title(title: str): 
    """Prints a title, e.g. print_title("title")"""
    width = len(title) + 4
    border = "+" + "-" * width + "+"

    print(f"\n{border}")
    print(f"|  {title}  |")
    print(border)


def print_subtitle(title: str, size: int = 1, symbol: str = "=", width = 30, min_symbols = 3):
    """
        Prints a subtitle, e.g. print_subtitle("subtitle"). A bigger size value means smaller subtitle, so smallest size is 4, biggest is 1. min_symbols only needed for sizes 3 and 4.
    """

    if size == 1:
        print("\n" + title.upper())
        print(symbol * width)
    
    elif size == 2:
        print("\n" + title)
        print(symbol * width)
    
    elif size == 3:
        text = f" {title.upper()} "
        width = max(width, len(text) + min_symbols * 2)
        print(text.center(width, symbol))
    
    elif size == 4:
        text = f" {title} "
        width = max(width, len(text) + min_symbols * 2)
        print(text.center(width, symbol))


def print_menu(options: dict, title="", prompt="> ", start: str | None = None) -> str:
    """
        Returns key of chosen option (lowercase).
    """
    first = True

    while True:
        if not first and not start: print()
        first = False

        if title:
            if start: print(start + title)
            else: print(title)
        
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
        print(start + f"Geld pro Punkt: {config.money_per_point:.2f} €")

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
