# grade-calculator

![Version](https://img.shields.io/badge/version-v1.5.4-brightgreen)
![Python](https://img.shields.io/badge/python-3.10+-blue)
![Status](https://img.shields.io/badge/status-CLI%20functional-green)

A command-line grade manager for the **Bavarian grading system (1–6)** with an integrated reward system — built so I have a single app to track both my grades and my reward balance in one place.

---

## Table of Contents 📄

- [Introduction](#introduction)
- [Features](#features)
- [Technologies](#technologies)
- [Usage ](#usage)
- [Data Files](#data-files)
- [Backup & Reset](#backup--reset)
- [Project Status](#project-status)
- [License](#license)

## Introduction 🚀

**grade-calculator** is a CLI application for managing school grades with weighted averages, label-based filtering, and an optional reward system. The reward system lets you (or a parent) define a payout per grade — in euros, a custom unit like trading cards, or raw points — so that earning good grades automatically updates a tracked balance that can later be redeemed.

Everything is stored locally in JSON files, making it portable and easy to inspect or back up manually.

---

## Features ✨

### Grades & Subjects
- Add, edit, and delete grades per subject
- **Weighted averages** — each grade carries a configurable weight
- **Labels** — tag grades (e.g. `Schulaufgabe`, `Abfrage`) for filtering and export
- Filter grades by label with AND / OR logic
- View overall and per-subject averages at a glance

### Reward System
- Three reward modes:
  - **Money (€)** — fixed € amount per point earned
  - **Custom unit** — e.g. trading cards, with a configurable conversion rate
  - **Points only** — no conversion, just raw points
- Configurable points per grade value (defaults: `1→10 pts`, `2→6 pts`, `3→2 pts`, `4-6→0 pts`)
- Wallet with running balance, redemption log, and grade change history
- Balance adjustments when editing or deleting grades

### Statistics & Export
- Overview statistics: overall average, best/worst subject, best/worst grade, top labels
- Trend analysis per subject (requires `numpy`) with strongest improvement/decline
- Grade distribution bar chart and per-subject trend line graphs (requires `matplotlib`)
- Export selected data to a timestamped `.txt` file with a custom label
- Compare two exports side-by-side (averages, subject deltas, most improved/declined)

### Configuration
- All file paths configurable at runtime via CLI flags or the in-app config menu
- Toggle verbose loading messages
- In-app reward system configuration (points map, rate, mode)

---

## Technologies 🐍

| Dependency   | Required | Purpose                              |
|--------------|----------|--------------------------------------|
| Python 3.10+ | ✅        | Core runtime (uses `match`-style type hints) |
| `matplotlib` | ❌        | Grade distribution chart, trend graphs |
| `numpy`      | ❌        | Trend line calculation (polyfit)     |

No external packages are required to run the core application. Install optional dependencies with:

```bash
pip install matplotlib numpy
```

---

## Usage 🛠️

### Running the app

```bash
git clone https://github.com/Mango505/grade-calculator.git
cd grade-calculator
python main.py
```

### CLI Arguments

All arguments are optional. If not provided, the app falls back to the paths stored in `data/app_config.json` or the built-in defaults.

> When providing a file path via an argument, it will override the path stored in the app config for that file.

```
python main.py [-h] [-a FILE] [-f FILE] [-w FILE] [-r FILE]
```

| Flag                    | Default                    | Description                          |
|-------------------------|----------------------------|--------------------------------------|
| `-a`, `--app-config`    | `data/app_config.json`     | Path to app configuration file       |
| `-f`, `--file`          | `data/grades.json`         | Path to grades data file             |
| `-w`, `--wallet`        | `data/wallet.json`         | Path to wallet file                  |
| `-r`, `--reward-config` | `data/reward_config.json`  | Path to reward configuration file    |

**Example — use a separate data directory:**
```bash
python main.py -f school/grades.json -w school/wallet.json
```

### Navigation

The app uses a numbered menu system throughout. At any prompt:
- Enter the number/letter shown in brackets to select an option
- `Z` / `z` goes back or cancels the current action
- `J` / `j` confirms, `N` / `n` declines any yes/no prompt
- Changes are **not saved automatically** — use `[s] Speichern` or `[q] Speichern & Beenden`

---

## Data Files 💾

All data is persisted as human-readable JSON. Default locations (relative to the project root):

| File                       | Contents                                                  |
|----------------------------|-----------------------------------------------------------|
| `data/grades.json`         | All subjects and their grades (value, weight, labels)     |
| `data/wallet.json`         | Reward balance, redemption log, grade change history      |
| `data/reward_config.json`  | Points map, reward mode, rate, unit settings              |
| `data/app_config.json`     | File paths and app settings (e.g. verbose loading)        |

The `data/` directory is created automatically on first save. Files can be moved freely as long as the paths are updated via the config menu or CLI flags.

---

## Backup & Reset 🔄

### Backups
A timestamped backup of all four data files can be created from within the app:

```
Konfiguration anpassen → Zurücksetzen → (automatic backup before any reset)
```

Backups are stored in `data/backups/backup_YYYYMMDD_HHMMSS/` by default. The backup path is configurable. Old backups can be cleaned up via `Alte Backups löschen`, which keeps only the most recent one.

### Reset Options
The following can be reset individually or all at once (a backup is always attempted first):

- Grade change log
- Redemption log
- App configuration (restored to defaults)
- Reward configuration (restored to defaults)
- Wallet balance
- All subjects and grades

> ⚠️ Deleting subjects and grades is irreversible outside of a backup restore.

---

## Project Status 👀

| Component       | Status              |
|-----------------|---------------------|
| CLI application | ✅ Fully functional |
| Web interface   | 🔜 Planned          |

---

## License ⚖️

> You can view the license [here](https://github.com/Mango505/grade-calculator/blob/d846d67eda37bd25aa45da4d3eac7db6b9195f3d/LICENSE).

This project is licensed under the terms of the **MIT** license.