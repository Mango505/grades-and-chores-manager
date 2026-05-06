import argparse
import copy
from ui import (print_menu, print_title, confirm, add_grade, edit_grade, redeem, show_overview, filter_by_label, show_balance,
                create_subject, delete_subject, edit_config, show_statistics, export, compare_exports, show_save_preview, _diff_state)
from storage import (save_app_config, load_app_config, save_subjects, load_subjects, save_wallet, load_wallet,
                     save_reward_config, load_reward_config, APPCONFIG_PATH, DATA_PATH, WALLET_PATH, REWARDCONFIG_PATH)
from models import LoadStatus

VERSION = "v1.5.2"

def _take_snapshot(subjects, wallet, reward_config, app_config) -> dict:
    return {
        "subjects":      [s.to_dict() for s in subjects],
        "wallet":        copy.deepcopy(wallet.to_dict()),  # deepcopy prevents list reference sharing
        "reward_config": reward_config.to_dict(),
        "app_config":    app_config.to_dict(),
    }

def _save_all(app_config, subjects, wallet, reward_config) -> None:
    save_app_config(app_config, app_config.app_config_path)
    save_subjects(subjects, app_config.data_path)
    save_wallet(wallet, app_config.wallet_path)
    save_reward_config(reward_config, app_config.reward_config_path)

def main():
    # --- Argument parser ---
    parser = argparse.ArgumentParser(
        description="Notenrechner - Verwalte deine Noten im bayerischen Notensystem (1-6)."
    )
    parser.add_argument(    # optional argument for custom app config file path
        "-a", "--app-config",
        default=APPCONFIG_PATH,
        metavar="FILE",
        help="Pfad zur JSON-Datei für das Laden und Speichern der App-Konfiguration (Standard: %(default)s)"
    )
    parser.add_argument(    # optional argument for custom data file path
        "-f", "--file",
        default=DATA_PATH,
        metavar="FILE",
        help="Pfad zur JSON-Datei für das Laden und Speichern von Noten (Standard: %(default)s)"
    )
    parser.add_argument(    # optional argument for custom wallet file path
        "-w", "--wallet",
        default=WALLET_PATH,
        metavar="FILE",
        help="Pfad zur JSON-Datei für das Laden und Speichern des Wallets (Standard: %(default)s)"
    )
    parser.add_argument(    # optional argument for custom reward config file path
        "-r", "--reward-config",
        default=REWARDCONFIG_PATH,
        metavar="FILE",
        help="Pfad zur JSON-Datei für das Laden und Speichern der Belohnungssystem-Konfiguration (Standard: %(default)s)"
    )
    args = parser.parse_args()

    # Title
    print_title(f"Notenrechner {VERSION}")

    # --- Load files ---
    app_config, status = load_app_config(args.app_config)
    if status == LoadStatus.MISSING:
        print(f"Warnung: {args.app_config} existiert nicht. Es wird die Standardkonfiguration der App geladen.")
    elif status == LoadStatus.CORRUPT:
        print(f"Warnung: {args.app_config} ist korrupt. Es wird die Standardkonfiguration der App geladen.")
    elif status == LoadStatus.OK and app_config.verbose_loading:
        print(f"App-Konfiguration geladen: {args.app_config}")

    # After loading app_config, seed it with CLI args if explicitly provided
    if args.file != DATA_PATH:
        app_config.data_path = args.file
    if args.wallet != WALLET_PATH:
        app_config.wallet_path = args.wallet
    if args.reward_config != REWARDCONFIG_PATH:
        app_config.reward_config_path = args.reward_config

    subjects, status = load_subjects(app_config.data_path)
    if status == LoadStatus.MISSING:
        print(f"Warnung: {args.file} existiert nicht. Es wird eine leere Noten-Liste geladen.")
    elif status == LoadStatus.CORRUPT:
        print(f"Warnung: {args.file} ist korrupt. Es wird eine leere Noten-Liste geladen.")
    elif status == LoadStatus.OK and app_config.verbose_loading:
        print(f"Noten geladen: {app_config.data_path}")

    wallet, status = load_wallet(app_config.wallet_path)
    if status == LoadStatus.MISSING:
        print(f"Warnung: {args.wallet} existiert nicht. Es wird ein leeres Wallet geladen.")
    elif status == LoadStatus.CORRUPT:
        print(f"Warnung: {args.wallet} ist korrupt. Es wird ein leeres Wallet geladen.")
    elif status == LoadStatus.OK and app_config.verbose_loading:
        print(f"Wallet geladen: {app_config.wallet_path}")

    reward_config, status = load_reward_config(app_config.reward_config_path)
    if status == LoadStatus.MISSING:
        print(f"Warnung: {args.reward_config} existiert nicht. Es wird die Standardkonfiguration des Belohnungssystems geladen.")
    elif status == LoadStatus.CORRUPT:
        print(f"Warnung: {args.reward_config} ist korrupt. Es wird die Standardkonfiguration des Belohnungssystems geladen.")
    elif status == LoadStatus.OK and app_config.verbose_loading:
        print(f"Belohnungssystem-Konfiguration geladen: {app_config.reward_config_path}")

    snapshot = _take_snapshot(subjects, wallet, reward_config, app_config)

    # --- Menu flow ---
    while True:
        menu = {"1": "Note hinzufügen"}
        menu["2"] = "Notenübersicht"
        menu["3"] = "Konto & Verlauf"
        menu["4"] = "Nach Labels filtern"
        menu["5"] = "Note bearbeiten"
        menu["6"] = "Fach erstellen"
        menu["7"] = "Fach löschen"
        menu["8"] = "Statistiken ansehen"
        menu["9"] = "Daten exportieren"
        menu["10"] = "Exporte vergleichen"
        menu["11"] = "Konfiguration anpassen" + ("\n|" if not reward_config.enabled else "")
        if reward_config.enabled:
            menu["12"] = "Guthaben einlösen\n|"
        menu["s"] = "Speichern"
        menu["q"] = "Speichern & Beenden"

        choice = print_menu(
            menu,
            "-" * 12 + " MENÜ " + "-" * 12,
            start="\n"
        )

        if choice == "s":
            changes = _diff_state(snapshot, subjects, wallet, reward_config, app_config)
            show_save_preview(changes)
            prompt = "Trotzdem speichern?" if not changes else "Änderungen speichern?"
            if confirm(prompt) is True:
                _save_all(app_config, subjects, wallet, reward_config)
                snapshot = _take_snapshot(subjects, wallet, reward_config, app_config)
                print("Gespeichert.")

        elif choice == "q":
            changes = _diff_state(snapshot, subjects, wallet, reward_config, app_config)
            show_save_preview(changes)
            if not changes:
                _save_all(app_config, subjects, wallet, reward_config)
                break
            c = confirm("Änderungen übernehmen?")
            if c is True:
                _save_all(app_config, subjects, wallet, reward_config)
                break
            elif c is False:
                if confirm("Änderungen verwerfen und beenden?") is True:
                    break
            # Z or N at "verwerfen" → back

        elif choice == "1":
            add_grade(subjects, reward_config, wallet)
        elif choice == "2":
            show_overview(subjects)
        elif choice == "3":
            reward_config, wallet = show_balance(reward_config, wallet)
        elif choice == "4":
            filter_by_label(subjects)
        elif choice == "5":
            subjects, wallet = edit_grade(subjects, reward_config, wallet)
        elif choice == "6":
            create_subject(subjects)
        elif choice == "7":
            delete_subject(subjects)
        elif choice == "8":
            show_statistics(subjects, wallet, reward_config)
        elif choice == "9":
            export(subjects, wallet, reward_config)
        elif choice == "10":
            compare_exports()
        elif choice == "11":
            app_config, reward_config, wallet = edit_config(app_config, reward_config, wallet)
        elif choice == "12":
            redeem(wallet)



if __name__ == "__main__":
    main()
