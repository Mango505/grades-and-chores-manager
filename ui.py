from datetime import datetime
from collections import Counter
import copy
import os
import shutil
from models import Grade, Subject, Wallet, RewardConfig, AppConfig

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
                print(f"Vorschau: Note {value} | Gewichtung: {weight} | Labels: {raw_labels if raw_labels else "<keine Labels>"}")

                c = confirm("Ist das korrekt?")
                if c is True:
                    choice.add_grade(grade)    # add the Grade to the desired subject
                    money_delta = config.money_for_points(config.points_for_grade(value)) if config.enabled else None
                    wallet.log_grade_event("+", choice.name, value, weight, labels, money_delta)
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
            str(i): f"{g.value} | {g.weight:.1f} | {', '.join(g.labels) or "<keine Labels>"}"
            for i, g in enumerate(subject.grades)
        }
        grade_options["z"] = "Zurück"
        grade_choice = print_menu(grade_options, "Note auswählen:", start="\n")

        if grade_choice == "z":
            continue    # back to subject selection

        grade = subject.grades[int(grade_choice)]

        while True:
            # Choose mode
            print(f"\nAktuell: {grade.value} | {grade.weight:.1f} | {', '.join(grade.labels) or "<keine Labels>"}")
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

                    raw_labels = input(f"Neue Labels eingeben oder Leerlassen zum Beibehalten (Aktuell {', '.join(grade.labels) or "<keine Labels>"}): ").strip()
                    new_labels = [t.strip() for t in raw_labels.split(",")] if raw_labels else grade.labels

                    new_grade = Grade(new_value, new_weight, new_labels)
                    if not new_grade.is_valid():
                        print("Ungültige Eingabe. Note muss zwischen 1 und 6 liegen und Gewichtung muss höher als 0 sein.")
                        continue

                    print(f"\nVorschau: {new_value} | {new_weight} | {', '.join(new_labels) or "<keine Labels>"}")
                    c = confirm("Bist du sicher, dass du diese Änderungen übernehmen möchtest?")
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
                        money_delta = (config.money_for_points(config.points_for_grade(new_value)) -
                                       config.money_for_points(config.points_for_grade(grade.value))) if config.enabled else None
                        wallet.log_grade_event("~", subject.name, new_value, new_weight, new_labels, money_delta)
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
                    wallet.log_grade_event("~", subject.name, grade.value, grade.weight, grade.labels)
                    print("Note aktualisiert.")
                    return subjects, wallet
                elif c is False:
                    print("Vorgang abgebrochen.")
                    return subjects, wallet
                # None → continue (back to subject selection)

            # Delete grade
            elif mode_choice == "3":
                c = confirm("Bist du sicher, dass du diese Note löschen möchtest?")
                if c is True:
                    if config.enabled:
                        old_points = config.points_for_grade(grade.value)
                        old_money = config.money_for_points(old_points)
                        if old_money > 0:
                            c2 = confirm(f"Note {grade.value} hat {old_money:.2f} € eingebracht (Aktueller Kontostand: {wallet.balance:.2f} €). Guthaben zurückbuchen?")
                            if c2 is True:
                                if wallet.balance - old_money < 0:
                                    c3 = confirm("Dein Guthaben wird dadurch in den negativen Bereich zurückfallen, fortfahren?")
                                    if c3 is True:
                                        wallet.balance -= old_money
                                        print(f"Guthaben angepasst: -{old_money:.2f} €")
                                        print(f"Aktueller Kontostand: {wallet.balance:.2f} €")
                                    else:
                                        continue
                                else:
                                    wallet.balance -= old_money
                                    print(f"Guthaben angepasst: -{old_money:.2f} €")
                                    print(f"Aktueller Kontostand: {wallet.balance:.2f} €")
                            elif c2 is None:
                                continue
                    subject.remove_grade(int(grade_choice))
                    money_delta = -config.money_for_points(config.points_for_grade(grade.value)) if config.enabled else None
                    wallet.log_grade_event("-", subject.name, grade.value, grade.weight, grade.labels, money_delta)
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
            labels_str = ", ".join(grade.labels) or "<keine Labels>"
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
        "2": "Es muss mindestens ein Label übereinstimmen",
        "z": "Zurück"
    }, "Wähle einen Filtermodus aus:")
    if choice == "1":
        mode = "and"
    elif choice == "2":
        mode = "or"
    else:
        return subjects

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
            labels_str = ', '.join(grade.labels) or "<keine Labels>"
            print(f"\t{grade.value} | {grade.weight:.1f} | {labels_str}")
            total_value += grade.value * grade.weight
            total_weight += grade.weight

    if not found:
        print(f"Keine Einträge mit Label{'s' if len(labels) > 1 else ''} '{raw_labels}' gefunden.")
        return subjects

    print(f"\nGesamtdurchschnitt für '{raw_labels}': {total_value / total_weight:.2f}")
    return subjects


def show_balance(config: RewardConfig, wallet: Wallet) -> tuple[RewardConfig, Wallet]:
    print_subtitle("Konto & Verlauf")
    if config.enabled is True:
        print(f"Aktueller Kontostand: {wallet.balance:.2f} €")
    else:
        print("Belohnungssystem deaktiviert.")

    if wallet.redemptions and config.enabled is True:
        print("\nLetzte Einlösungen:")
        for r in wallet.redemptions[-5:][::-1]:  # show last 5
            print(f"{r['description']} | -{r['cost']:.2f} € | {r.get('date','<unbekanntes Datum>')}")
        length = len(wallet.redemptions)
        if length > 5:
            c = confirm(f"\nSollen alle {length} Einlösungen angezeigt werden?")
            if c is True:
                for r in wallet.redemptions[::-1]:    # show all, including previously shown
                    print(f"{r['description']} | -{r['cost']:.2f} € | {r.get('date','<unbekanntes Datum>')}")
            if c is None: return config, wallet

    if wallet.grade_log:
        print("\nLetzte Notenänderungen:")
        symbols = {"+": "Hinzugefügt", "-": "Gelöscht", "~": "Bearbeitet"}
        for e in wallet.grade_log[-5:][::-1]:
            labels_str = ", ".join(e["labels"]) or "<keine Labels>"
            delta = e.get("money_delta")
            if not isinstance(delta, (int, float)):
                money_str = ""
            else:
                sign = "+" if delta >= 0 else ""
                money_str = f" | {sign}{delta:.2f} €"
            print(f"{symbols.get(e['action'], e['action'])} | {e['date']} | {e['subject']} | {e['value']} ({e['weight']:.1f}x) | {labels_str}" + money_str)
        length = len(wallet.grade_log)
        if length > 5:
            c = confirm(f"\nSollen alle {length} Notenänderungen angezeigt werden?")
            if c is True:
                for e in wallet.grade_log[::-1]:
                    labels_str = ", ".join(e["labels"]) or "<keine Labels>"
                    delta = e.get("money_delta")
                    if not isinstance(delta, (int, float)):
                        money_str = ""
                    else:
                        sign = "+" if delta >= 0 else ""
                        money_str = f" | {sign}{delta:.2f} €"
                    print(f"{symbols.get(e['action'], e['action'])} | {e['date']} | {e['subject']} | {e['value']} ({e['weight']:.1f}x) | {labels_str}" + money_str)
    else:
        print("\nKeine Notenänderungen vorhanden.")

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

            c = confirm(f"Bist du sicher, dass du '{choice.name}' entfernen möchtest?")
            if c is True:
                subjects.remove(choice)
                print("Fach entfernt.")
                return subjects
            elif c is False:
                print("Vorgang abgebrochen.")
                return subjects

        except ValueError:
            print("Ungültige Eingabe. Bitte eine Zahl eingeben.")


def show_statistics(subjects: list[Subject], wallet: Wallet, config: RewardConfig) -> None:
    print_subtitle("Statistiken")
    if not subjects or not any(s.grades for s in subjects):
        print("Keine Noten vorhanden.")
        return

    subjects_with_grades = [s for s in subjects if s.grades]

    # Overall average
    all_grades = [g for s in subjects_with_grades for g in s.grades]
    total_avg = sum(g.value * g.weight for g in all_grades) / sum(g.weight for g in all_grades)
    print(f"Gesamtdurchschnitt: {total_avg:.2f}")

    # Number of registered grades
    print(f"Anzahl gespeicherte Noten (Gesamt): {len(all_grades)}")

    # Most used Labels
    label_counts = Counter(l for g in all_grades for l in g.labels if l != "")
    if label_counts:
        top = label_counts.most_common(3)
        print("Top Labels:         " + ", ".join(f"{l} ({n}x)" for l, n in top))

    # Best / worst subject
    sorted_subjects = sorted(subjects_with_grades, key=lambda s: s.average())
    print(f"Bestes Fach:        {sorted_subjects[0].name} ({sorted_subjects[0].average():.2f})")
    print(f"Schlechtestes Fach: {sorted_subjects[-1].name} ({sorted_subjects[-1].average():.2f})")

    # Best / worst grade (absolute)
    best_grade  = min(all_grades, key=lambda g: g.value)
    worst_grade = max(all_grades, key=lambda g: g.value)
    best_subject  = next(s for s in subjects_with_grades if best_grade in s.grades)
    worst_subject = next(s for s in subjects_with_grades if worst_grade in s.grades)
    print(f"Beste Note:         {best_grade.value} in '{best_subject.name}'")
    print(f"Schlechteste Note:  {worst_grade.value} in '{worst_subject.name}'")

    # Best improvement (penultimate vs. last average per subject, at least 2 grades)
    _best_trends(subjects_with_grades)

    # Grade distribution (for matplotlib)
    distribution = {i: 0 for i in range(1, 7)}
    for g in all_grades:
        distribution[round(g.value)] += 1

    # Wallet summary (only if rewards enabled)
    if config.enabled:
        total_redeemed = sum(r["cost"] for r in wallet.redemptions)
        print(f"\nVerdient:   {wallet.balance + total_redeemed:.2f} €")
        print(f"Eingelöst:    {total_redeemed:.2f} €")
        print(f"Restguthaben: {wallet.balance:.2f} €")

    # Graphs (matplotlib)
    _plot_distribution(distribution)    # grade distribution
    _plot_trends(subjects_with_grades)  # trend per subject


def export(subjects: list[Subject], wallet: Wallet, config: RewardConfig) -> None:
    print_subtitle("Statistiken exportieren")
    if not subjects or not any(s.grades for s in subjects):
        print("Keine Noten vorhanden.")
        return

    label = input("Export-Label eingeben (z.B. '3. Quartal - Mai 2026') oder leerlassen: ").strip()
    label = label if label else "Kein Label"

    filename = f"export_{datetime.now().strftime('%Y%m%d_%H%M')}.txt"

    lines = []
    lines.append(f"NOTENRECHNER EXPORT")
    lines.append(f"Label:    {label}")
    lines.append(f"Erstellt: {datetime.now().strftime('%d.%m.%Y %H:%M')}")

    subjects_with_grades = [s for s in subjects if s.grades]

    choice = print_menu_multi({
        "1": "Statistiken",
        "2": "Noten pro Fach",
        "3": "Notenänderungen (Verlauf)",
        "4": "Einlösungen",
        "z": "Zurück"
    }, "Was möchtest du exportieren?")

    if not choice:
        return  # user pressed z

    if "1" in choice:   # Stats
        lines.append(print_subtitle("Statistiken", 4, width=40, return_str=True))
        # Overall average
        all_grades = [g for s in subjects_with_grades for g in s.grades]
        if all_grades:
            total_avg = sum(g.value * g.weight for g in all_grades) / sum(g.weight for g in all_grades)
            lines.append(f"Gesamtdurchschnitt: {total_avg:.2f}")

        # Number of registered grades
        lines.append(f"Anzahl gespeicherte Noten (Gesamt): {len(all_grades)}")

        # Most used Labels
        label_counts = Counter(l for g in all_grades for l in g.labels if l != "")
        if label_counts:
            top = label_counts.most_common(3)
            lines.append("Top Labels:         " + ", ".join(f"{l} ({n}x)" for l, n in top))

        # Best / worst subject
        sorted_subjects = sorted(subjects_with_grades, key=lambda s: s.average())
        lines.append(f"Bestes Fach:        {sorted_subjects[0].name} ({sorted_subjects[0].average():.2f})")
        lines.append(f"Schlechtestes Fach: {sorted_subjects[-1].name} ({sorted_subjects[-1].average():.2f})")

        # Best / worst grade (absolute)
        best_grade  = min(all_grades, key=lambda g: g.value)
        worst_grade = max(all_grades, key=lambda g: g.value)
        best_subject  = next(s for s in subjects_with_grades if best_grade in s.grades)
        worst_subject = next(s for s in subjects_with_grades if worst_grade in s.grades)
        lines.append(f"Beste Note:         {best_grade.value} in '{best_subject.name}'")
        lines.append(f"Schlechteste Note:  {worst_grade.value} in '{worst_subject.name}'")

        # Best improvement (penultimate vs. last average per subject, at least 2 grades)
        string1, string2 = _best_trends(subjects_with_grades, True)
        if string1: lines.append(string1)
        if string2: lines.append(string2)

        # Wallet
        if config.enabled:
            lines.append("")
            total_redeemed = sum(r["cost"] for r in wallet.redemptions)
            lines.append(f"Verdient:     {wallet.balance + total_redeemed:.2f} €")
            lines.append(f"Eingelöst:    {total_redeemed:.2f} €")
            lines.append(f"Restguthaben: {wallet.balance:.2f} €")

    if "2" in choice:   # Grades per subject
        lines.append(print_subtitle("Noten pro Fach", 4, width=40, return_str=True))
        for s in subjects:
            lines.append(f"Fach: {s.name} | Ø {s.average():.2f}")
            for g in s.grades:
                labels_str = ", ".join(g.labels) or "<keine Labels>"
                lines.append(f"  {g.value} | {g.weight:.1f}x | {labels_str}")
            lines.append("")

    if "3" in choice:   # Grade log
        lines.append(print_subtitle("Notenänderungen", 4, width=40, return_str=True))
        if wallet.grade_log:
            symbols = {"+": "Hinzugefügt", "-": "Gelöscht", "~": "Bearbeitet"}
            for e in wallet.grade_log[::-1]:
                labels_str = ", ".join(e["labels"]) or "<keine Labels>"
                delta = e.get("money_delta")
                if not isinstance(delta, (int, float)):
                    money_str = ""
                else:
                    sign = "+" if delta >= 0 else ""
                    money_str = f" | {sign}{delta:.2f} €"
                lines.append(f"{symbols.get(e['action'], e['action'])} | {e['date']} | {e['subject']} | {e['value']} ({e['weight']:.1f}x) | {labels_str}" + money_str)
        else:
            lines.append("Keine")

    if "4" in choice:   # Redemptions
        lines.append(print_subtitle("Einlösungen", 4, width=40, return_str=True))
        if wallet.redemptions and config.enabled:
            for r in wallet.redemptions[::-1]:
                lines.append(f"{r['description']} | -{r['cost']:.2f} € | {r.get('date','<unbekanntes Datum>')}")
        else:
            lines.append("Keine")

    lines.append(f"\n[EXPORT_LABEL={label}]")  # machine-readable for comparison

    with open(filename, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"Exportiert als: {filename}")


def compare_exports() -> None:
    print_subtitle("Exporte vergleichen")

    file1 = input("Pfad zur ersten Export-Datei: ").strip()
    file2 = input("Pfad zur zweiten Export-Datei: ").strip()

    try:
        data1 = _parse_export(file1)
        data2 = _parse_export(file2)
    except FileNotFoundError as e:
        print(f"Datei nicht gefunden: {e}")
        return
    except ValueError as e:
        print(f"Ungültige Export-Datei: {e}")
        return

    label1 = data1["label"]
    label2 = data2["label"]
    col = 28

    def row(title, v1, v2, diff=""):
        print(f"{title:<22} {str(v1):<{col}} {str(v2):<{col}} {diff}")

    print(f"\n{'':22} {label1:<{col}} {label2:<{col}}")
    print("-" * (22 + col * 2 + 2))

    # Overall average
    avg1, avg2 = data1.get("overall_avg"), data2.get("overall_avg")
    diff = ""
    if isinstance(avg1, float) and isinstance(avg2, float):
        d = avg2 - avg1
        diff = f"({'besser' if d < 0 else 'schlechter' if d > 0 else 'gleich'}: {d:+.2f})"
    row("Gesamtschnitt", avg1 or "N/A", avg2 or "N/A", diff)

    # Grade count
    gc1, gc2 = data1.get("grade_count"), data2.get("grade_count")
    diff = ""
    if isinstance(gc1, int) and isinstance(gc2, int):
        d = gc2 - gc1
        diff = f"({d:+d})"
    row("Anz. Noten", gc1 or "N/A", gc2 or "N/A", diff)

    # Best / worst subject & grade
    row("Bestes Fach",        data1.get("best_subject")  or "N/A", data2.get("best_subject")  or "N/A")
    row("Schlechtestes Fach", data1.get("worst_subject") or "N/A", data2.get("worst_subject") or "N/A")
    row("Beste Note",         data1.get("best_grade")    or "N/A", data2.get("best_grade")    or "N/A")
    row("Schlechteste Note",  data1.get("worst_grade")   or "N/A", data2.get("worst_grade")   or "N/A")

    # Top labels
    print(f"{'Top Labels':<23}", end="")
    tl1_lines = (data1.get("top_labels") or "—").split(", ")
    tl2_lines = (data2.get("top_labels") or "—").split(", ")

    # chunk into col-width pieces
    def chunk(items, width):
        lines, cur = [], ""
        for item in items:
            test = cur + (", " if cur else "") + item
            if len(test) <= width: cur = test
            else: lines.append(cur); cur = item
        if cur: lines.append(cur)
        return lines or ["—"]

    c1 = chunk(tl1_lines, col)
    c2 = chunk(tl2_lines, col)
    for i in range(max(len(c1), len(c2))):
        prefix = " " * 23 if i > 0 else ""
        v1 = c1[i] if i < len(c1) else ""
        v2 = c2[i] if i < len(c2) else ""
        print(f"{prefix}{v1:<{col}} {v2:<{col}}")

    # Per-subject averages
    print()
    print(f"  {'Fach':<20} {label1:<{col}} {label2:<{col}}")
    print("  " + "-" * (20 + col * 2))
    all_subjects = sorted(set(data1["subjects"]) | set(data2["subjects"]))
    changes = []
    for name in all_subjects:
        a1 = data1["subjects"].get(name)
        a2 = data2["subjects"].get(name)
        s1 = f"{a1:.2f}" if a1 is not None else "—"
        s2 = f"{a2:.2f}" if a2 is not None else "—"
        diff = ""
        if a1 is not None and a2 is not None:
            d = a2 - a1
            diff = f"({'↑' if d < 0 else '↓' if d > 0 else '→'} {abs(d):.2f})"
            changes.append((name, d))
        print(f"  {name:<20} {s1:<{col}} {s2:<{col}} {diff}")

    # Most improved / most declined subject
    if changes:
        print()
        most_improved = min(changes, key=lambda t: t[1])
        most_declined = max(changes, key=lambda t: t[1])
        if most_improved[1] < 0:
            print(f"Stärkste Verbesserung:     '{most_improved[0]}' ({most_improved[1]:+.2f})")
        if most_declined[1] > 0:
            print(f"Stärkste Verschlechterung: '{most_declined[0]}' ({most_declined[1]:+.2f})")


def edit_config(app_config: AppConfig, reward_config: RewardConfig, wallet: Wallet) -> tuple[AppConfig, RewardConfig, Wallet]:
    print_subtitle("Konfiguration anpassen")
    first = True

    while True:
        choice = print_menu({
            "1": "App-Konfiguration ansehen",
            "2": "Belohnungskonfiguration anpassen",
            "3": "Standard-Pfade anpassen",
            "4": "Ladehinweise anpassen",
            "5": "Zurücksetzen",
            "z": "Zurück"
        },
        start="\n" if not first else None)
        first = False

        if choice == "z":
            return app_config, reward_config, wallet
        elif choice == "1":
            print_configuration("app", app_config, start="\n")
        elif choice == "2":
            reward_config = configure_rewards(reward_config)
        elif choice == "3":
            app_config = configure_paths(app_config)
        elif choice == "4":
            app_config = configure_loading(app_config)
        elif choice == "5":
            app_config, reward_config, wallet = reset_options(app_config, reward_config, wallet)

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

            c = confirm("Bist du sicher, dass du diese Änderungen übernehmen möchtest?")
            if c is True: print("Änderungen übernommen."); return new_config
            elif c is False: print("Vorgang abgebrochen."); return config

        elif choice == "2":
            money = config.money_per_point

            while True:
                try:
                    raw = input(f"Neuen Geldwert pro Punkt eingeben oder leerlassen zum Beibehalten (Aktuell {money:.2f} € pro Punkt)" + "\n> ").strip()
                    if not raw: break
                    new_money = float(raw)

                    c = confirm(f"Bist du sicher, dass du den Geldwert pro Punkt zu {new_money:.2f} € ändern möchtest?")
                    if c is True:
                        config.money_per_point = new_money
                        print("Änderungen übernommen.")
                        return config
                    elif c is False: print("Vorgang abgebrochen."); return config
                    elif c is None: break

                except ValueError:
                    print("Ungültige Eingabe. Bitte eine Zahl eingeben.")

        elif choice == "3":
            c = confirm("Bist du sicher, dass du das Belohnungssystem deaktivieren möchtest?")
            if c is True:
                config.enabled = False
                print("Belohnungssystem deaktiviert.")
                return config
            elif c is False:
                print("Vorgang abgebrochen.")


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

            c = confirm(f"Bist du sicher, dass du den Pfad der App-Konfigurationsdatei zu '{new}' ändern möchtest?")
            if c is True:
                config.app_config_path = new
                print("Änderungen übernommen.")
                return config
            elif c is False: print("Vorgang abgebrochen."); return config

        elif choice == "2":
            new = input(f"Neuen Pfad für die Noten-Datei eingeben (Aktuell: {config.data_path})" + "\n> ").strip()
            if not new: continue
            if not _is_valid_path(new): print("Ungültiger Pfad. Bitte keine Sonderzeichen wie < > \" | ? * verwenden."); continue

            c = confirm(f"Bist du sicher, dass du den Pfad der Noten-Datei zu '{new}' ändern möchtest?")
            if c is True:
                config.data_path = new
                print("Änderungen übernommen.")
                return config
            elif c is False: print("Vorgang abgebrochen."); return config

        elif choice == "3":
            new = input(f"Neuen Pfad für die Wallet-Datei eingeben (Aktuell: {config.wallet_path})" + "\n> ").strip()
            if not new: continue
            if not _is_valid_path(new): print("Ungültiger Pfad. Bitte keine Sonderzeichen wie < > \" | ? * verwenden."); continue

            c = confirm(f"Bist du sicher, dass du den Pfad der Wallet-Datei zu '{new}' ändern möchtest?")
            if c is True:
                config.wallet_path = new
                print("Änderungen übernommen.")
                return config
            elif c is False: print("Vorgang abgebrochen."); return config

        elif choice == "4":
            new = input(f"Neuen Pfad für die Belohnungs-Konfigurationsdatei eingeben (Aktuell: {config.reward_config_path})" + "\n> ").strip()
            if not new: continue
            if not _is_valid_path(new): print("Ungültiger Pfad. Bitte keine Sonderzeichen wie < > \" | ? * verwenden."); continue

            c = confirm(f"Bist du sicher, dass du den Pfad der Belohnungs-Konfigurationsdatei zu '{new}' ändern möchtest?")
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


def reset_options(app_config: AppConfig, reward_config: RewardConfig, wallet: Wallet) -> tuple[AppConfig, RewardConfig, Wallet]:
    print_subtitle("Zurücksetzen", 2, "-")
    create_backup(app_config)  # backup saved files before any reset

    choice = print_menu({
        "1": f"Notenänderungen-Log leeren ({len(wallet.grade_log)} Einträge)",
        "2": f"Einlösungen-Log leeren ({len(wallet.redemptions)} Einträge)",
        "3": "App-Konfiguration auf Standard zurücksetzen",
        "4": "Belohnungskonfiguration auf Standard zurücksetzen",
        "5": "Guthaben zurücksetzen",
        "z": "Zurück"
    }, "Was möchtest du zurücksetzen?")

    changed = False

    if choice == "1":
        if confirm("Bist du sicher, dass du den Notenänderungen-Log leeren möchtest? Es werden keine Änderungen an den Noten vorgenommen.") is True:
            wallet.grade_log = []
            print("Notenänderungen-Log geleert.")
            changed = True
    elif choice == "2":
        if confirm("Bist du sicher, dass du den Einlösungen-Log leeren möchtest? Es wird keine Änderung am Guthaben vorgenommen.") is True:
            wallet.redemptions = []
            print("Einlösungen-Log geleert.")
            changed = True
    elif choice == "3":
        if confirm("Bist du sicher, dass du die App-Konfiguration auf Standardwerte zurücksetzen möchtest?") is True:
            app_config = AppConfig()
            print("App-Konfiguration zurückgesetzt.")
            changed = True
    elif choice == "4":
        if confirm("Bist du sicher, dass du die Belohnungskonfiguration auf Standardwerte zurücksetzen möchtest?") is True:
            reward_config = RewardConfig()
            print("Belohnungskonfiguration zurückgesetzt.")
            changed = True
    elif choice == "5":
        if confirm("Bist du sicher, dass du das Guthaben auf 0 € zurücksetzen möchtest? Es wird keine Änderung am Einlösungen- oder Notenänderungen-Log vorgenommen.") is True:
            wallet.balance = 0.0
            print("Guthaben zurückgesetzt.")
            changed = True

    if changed:
        print("Tipp: Zum endgültigen Speichern ins Hauptmenü zurückkehren und speichern.",
              "\nDieser Schritt kann durch Wiederherstellung aus einem Backup rückgängig gemacht werden.")
    return app_config, reward_config, wallet

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
            return False    # caller should treat as "abort"
        if choice in ["zurück", "z"]:
            return None     # caller should treat as "back to previous menu (in which you can go back further)"
        print("Ungültige Eingabe.")


def print_title(title: str):
    """Prints a title, e.g. print_title("title")"""
    width = len(title) + 4
    border = "+" + "-" * width + "+"

    print(f"\n{border}")
    print(f"|  {title}  |")
    print(border)


def print_subtitle(title: str, size: int = 1, symbol: str = "=", start: str | None = "\n", width = 30, min_symbols = 3, return_str: bool = False) -> None | str:
    """
        Prints a subtitle, e.g. print_subtitle("subtitle"). A bigger size value means smaller subtitle, so smallest size is 4, biggest is 1.
        \nmin_symbols only needed for sizes 3 and 4.
        \nreturn_str returns a string for sizes 3 and 4.
    """
    start = start if start else ""

    if size == 1:
        if not return_str:
            print(start + title.upper())
            print(symbol * width)

    elif size == 2:
        if not return_str:
            print(start + title)
            print(symbol * width)

    elif size == 3:
        text = f" {title.upper()} "
        width = max(width, len(text) + min_symbols * 2)
        string = start + text.center(width, symbol)
        if return_str:
            return string
        else:
            print(string)

    elif size == 4:
        text = f" {title} "
        width = max(width, len(text) + min_symbols * 2)
        string = start + text.center(width, symbol)
        if return_str:
            return string
        else:
            print(string)


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


def print_menu_multi(options: dict, title="", prompt="Auswahl (z.B. 1,3): ", start: str | None = None) -> list[str]:
    """
    Like print_menu, but allows comma-separated selection.
    Returns list of chosen keys. 'z' always cancels and returns [].
    """
    valid = set(options.keys())
    first = True

    while True:
        if not first and not start: print()
        first = False

        if start: print(start, end="")
        if title: print(title)

        for key, label in options.items():
            print(f"[{key}] {label}")

        raw = input(prompt).strip().lower()

        if raw == "z":
            return []

        chosen = [c.strip() for c in raw.split(",")]
        invalid = [c for c in chosen if c not in valid or c == "z"]

        if invalid:
            print(f"Ungültige Eingabe: {', '.join(invalid)}. Erlaubt: {', '.join(k for k in options if k != 'z')}.")
            continue

        if not chosen:
            print("Bitte mindestens eine Option wählen.")
            continue

        return list(dict.fromkeys(chosen))  # deduplicate, preserve order


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


def create_backup(app_config: AppConfig) -> bool:
    """Copies all data files to a timestamped backup directory. Returns True on success."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = os.path.join("data", "backups", f"backup_{timestamp}")

    files = {
        app_config.data_path:          "grades.json",
        app_config.wallet_path:        "wallet.json",
        app_config.reward_config_path: "reward_config.json",
        app_config.app_config_path:    "app_config.json",
    }

    existing = [(src, name) for src, name in files.items() if os.path.exists(src)]
    if not existing:
        print("Keine gespeicherten Dateien zum Sichern gefunden.")
        return False

    try:
        os.makedirs(backup_dir, exist_ok=True)
        for src, name in existing:
            shutil.copy2(src, os.path.join(backup_dir, name))
        print(f"Backup erstellt: {backup_dir} ({', '.join(n for _, n in existing)})")
        return True
    except OSError as e:
        print(f"Backup fehlgeschlagen: {e}")
        return False


def _is_valid_path(path: str) -> bool:
    """Check that a path contains no null bytes or Windows-illegal characters."""
    invalid_chars = set('\0<>"|?*')
    return bool(path) and not any(c in invalid_chars for c in path)


def _plot_distribution(distribution: dict) -> None:
    try:
        import matplotlib.pyplot as plt
        fig, ax = plt.subplots()
        ax.bar([str(k) for k in distribution], distribution.values(), color="#007d58")
        ax.set_xlabel("Note")
        ax.set_ylabel("Anzahl")
        ax.set_title("Notenverteilung")
        plt.tight_layout()
        plt.show()
    except ImportError:
        print("(matplotlib nicht installiert - kein Graph verfügbar)")


def _plot_trends(subjects_with_grades: list) -> None:
    try:
        import matplotlib.pyplot as plt
        import numpy as np
    except ImportError:
        print("(matplotlib/numpy nicht installiert - kein Graph verfügbar)")
        return

    cols = 2
    rows = (len(subjects_with_grades) + 1) // 2
    fig, axes = plt.subplots(rows, cols, figsize=(10, rows * 2))
    axes = axes.flatten() if hasattr(axes, 'flatten') else [axes]

    for i, s in enumerate(subjects_with_grades):
        ax = axes[i]
        grades = [g.value for g in s.grades]
        x = list(range(len(grades)))

        ax.plot(x, grades, 'o-', color="#007d58", linewidth=2,
                markersize=5, label="Noten")

        # Trend line only if at least 2 points
        if len(grades) >= 2:
            m, b = np.polyfit(x, grades, 1)
            trend = [m * xi + b for xi in x]
            ax.plot(x, trend, '--', color="#a92285", linewidth=1.5, label="Trend")

            # Trend direction in the title
            if m < -0.1:    arrow = "↑"
            elif m > 0.1:   arrow = "↓"
            else:           arrow = "→"
            ax.set_title(f"{s.name}   {arrow}   Ø {s.average():.2f}")
        else:
            ax.set_title(f"{s.name}  Ø {s.average():.2f}")

        # Point labeling
        for xi, yi in zip(x, grades):
            ax.annotate(f"{yi:.1f}", (xi, yi), textcoords="offset points",
                        xytext=(0, 8), ha="center", fontsize=8)

        ax.set_ylim(6.3, 0.7)       # 1 = top (good), 6 = bottom (bad)
        ax.set_yticks([1, 2, 3, 4, 5, 6])
        ax.set_xticks(x)
        ax.set_xticklabels(["" for j in x])
        ax.grid(True, alpha=0.3, linestyle="--")
        ax.legend(fontsize=8)

    # Hide empty subplots
    for j in range(len(subjects_with_grades), len(axes)):
        axes[j].set_visible(False)

    fig.suptitle("Notenverlauf & Trendlinien", fontsize=14, fontweight="bold")
    plt.tight_layout()
    plt.show()


def _best_trends(subjects_with_grades: list, return_str: bool = False) -> None | tuple[str, str]:
    try:
        import numpy as np
    except ImportError:
        print("(numpy nicht installiert - Stärkste Verbesserung/Verschlechterung nicht verfügbar)")
        return

    improvements = []
    for s in subjects_with_grades:
        if len(s.grades) < 2:
            continue
        x = list(range(len(s.grades)))
        y = [g.value for g in s.grades]
        m, _ = np.polyfit(x, y, 1)
        improvements.append((s, m))

    string1 = ""
    string2 = ""
    if improvements:
        # m negative = grade smaller = improvement
        most_improved = min(improvements, key=lambda t: t[1])
        most_declined = max(improvements, key=lambda t: t[1])
        s, m = most_improved
        if m < 0:
            string1 = f"Stärkste Verbesserung:     '{s.name}' (Trend: {m:+.2f} pro Note)"
            if not return_str:
                print(string1)
        s2, m2 = most_declined
        if m2 > 0:
            string2 = f"Stärkste Verschlechterung: '{s2.name}' (Trend: {m2:+.2f} pro Note)"
            if not return_str:
                print(string2)

    if return_str: return string1, string2


def _parse_export(path: str) -> dict:
    if not os.path.exists(path):
        raise FileNotFoundError(path)

    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    lines = content.splitlines()
    result = {
        "label": "Unbekannt",
        "subjects": {},
        "overall_avg": None,
        "grade_count": None,
        "top_labels": None,
        "best_subject": None,
        "worst_subject": None,
        "best_grade": None,
        "worst_grade": None,
    }

    for line in lines:
        if line.startswith("Label:"):
            result["label"] = line.split(":", 1)[1].strip()
        elif line.startswith("Gesamtdurchschnitt:"):
            try: result["overall_avg"] = float(line.split(":")[1].strip())
            except ValueError: pass
        elif line.startswith("Anzahl"):
            try: result["grade_count"] = int(line.split(":")[1].strip())
            except ValueError: pass
        elif line.startswith("Top Labels:"):
            result["top_labels"] = line.split(":", 1)[1].strip()
        elif line.startswith("Bestes Fach:"):
            result["best_subject"] = line.split(":", 1)[1].strip()
        elif line.startswith("Schlechtestes Fach:"):
            result["worst_subject"] = line.split(":", 1)[1].strip()
        elif line.startswith("Beste Note:"):
            result["best_grade"] = line.split(":", 1)[1].strip()
        elif line.startswith("Schlechteste Note:"):
            result["worst_grade"] = line.split(":", 1)[1].strip()
        elif line.startswith("Fach:"):
            parts = line.split("|")
            name = parts[0].replace("Fach:", "").strip()
            try:
                avg = float(parts[1].replace("Ø", "").strip())
                result["subjects"][name] = avg
            except (ValueError, IndexError): pass

    return result


def _wrap(text: str, width: int, indent: int = 22) -> str:
    """Wrap text to width, subsequent lines indented by indent + col spaces."""
    if len(text) <= width:
        return text
    words = text.split(", ")
    lines = []
    current = ""
    for word in words:
        test = current + (", " if current else "") + word
        if len(test) <= width:
            current = test
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    pad = " " * (indent + width)  # align with second column start
    return f"\n{pad}".join(lines)


def _diff_state(snap: dict, subjects, wallet, reward_config, app_config) -> list[str]:
    changes = []

    # Subjects & grades
    old_subs = {s["name"]: s for s in snap["subjects"]}
    new_subs = {s.name: s for s in subjects}
    for name in sorted(set(new_subs) - set(old_subs)):
        changes.append(f"  + Fach hinzugefügt:  '{name}'")
    for name in sorted(set(old_subs) - set(new_subs)):
        changes.append(f"  - Fach entfernt:     '{name}'")
    for name in sorted(set(old_subs) & set(new_subs)):
        old_grades = old_subs[name]["grades"]
        new_grades = [g.to_dict() for g in new_subs[name].grades]
        delta = len(new_grades) - len(old_grades)
        if delta:
            changes.append(f"  {'+' if delta >= 0 else '-'} Noten '{name}': {delta:+d}")
        elif old_grades != new_grades:
            # same count but content changed (e.g. labels cleared, value/weight edited)
            changes.append(f"  ~ Noten in '{name}' bearbeitet")

    # Wallet balance & redemptions
    old_bal, new_bal = snap["wallet"]["balance"], wallet.balance
    if abs(new_bal - old_bal) > 0.001:
        changes.append(f"  ~ Kontostand: {old_bal:.2f} → {new_bal:.2f} € ({new_bal - old_bal:+.2f} €)")
    old_red, new_red = len(snap["wallet"]["redemptions"]), len(wallet.redemptions)
    if new_red < old_red:
        changes.append(f"  ~ Einlösungen-Log geleert ({old_red} → {new_red} Einträge)")
    elif new_red > old_red:
        changes.append(f"  ~ Einlösungen: +{new_red - old_red} Einträge")

    # Grade log
    old_log, new_log = len(snap["wallet"]["grade_log"]), len(wallet.grade_log)
    if new_log < old_log:
        changes.append(f"  ~ Notenänderungen-Log geleert ({old_log} → {new_log} Einträge)")
    elif new_log > old_log:
        changes.append(f"  ~ Notenänderungen: +{new_log - old_log} Einträge")

    # RewardConfig
    old_rc = snap["reward_config"]
    if old_rc["enabled"] != reward_config.enabled:
        changes.append(f"  ~ Belohnungssystem: {'deaktiviert → aktiviert' if reward_config.enabled else 'aktiviert → deaktiviert'}")
    if abs(old_rc["money_per_point"] - reward_config.money_per_point) > 0.0001:
        changes.append(f"  ~ Geld/Punkt: {old_rc['money_per_point']:.2f} → {reward_config.money_per_point:.2f} €")
    for k, old_v in old_rc["points_map"].items():
        new_v = reward_config.points_map.get(int(k), 0)
        if old_v != new_v:
            changes.append(f"  ~ Punkte Note {k}: {old_v} → {new_v}")

    # AppConfig
    field_labels = {
        "app_config_path":    "App-Config-Pfad",
        "data_path":          "Noten-Pfad",
        "wallet_path":        "Wallet-Pfad",
        "reward_config_path": "Belohnungs-Pfad",
        "verbose_loading":    "Ladehinweise",
    }
    old_ac = snap["app_config"]
    for field, label in field_labels.items():
        old_val, new_val = old_ac.get(field), getattr(app_config, field)
        if old_val != new_val:
            old_val = "aktiviert" if old_val is True else "deaktiviert" if old_val is False else old_val
            new_val = "aktiviert" if new_val is True else "deaktiviert" if new_val is False else new_val
            changes.append(f"  ~ {label}: {old_val} → {new_val}")

    return changes


def show_save_preview(changes: list[str]) -> None:
    print_subtitle("Änderungen seit dem Laden", 2)
    if not changes:
        print("Keine Änderungen.")
    else:
        for line in changes:
            print(line)
