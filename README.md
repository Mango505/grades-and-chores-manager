# grade-calculator

![Version](https://img.shields.io/badge/version-v2.0.1-brightgreen)
![Python](https://img.shields.io/badge/python-3.10+-blue)
![Flask](https://img.shields.io/badge/flask-3.0+-lightgrey)
![Status](https://img.shields.io/badge/status-web%20interface-blue)

A grade manager for the **Bavarian grading system (1–6)** with an integrated reward system — built so I have a single place to track grades, weighted averages, and a reward balance across all devices.

> **v2.0.0** replaces the CLI with a full web interface. The original CLI (`main.py`) is preserved on the `cli` branch. The underlying data models and storage layer (`models.py`, `storage.py`) are shared and unchanged.

---

## Table of Contents 📄

- [Introduction](#introduction)
- [Features](#features)
- [Technologies](#technologies)
- [Setup](#setup)
- [Running](#running)
- [Mobile & PWA](#mobile--pwa)
- [Architecture](#architecture)
- [Data Files](#data-files)
- [Backup & Reset](#backup--reset)
- [CLI Legacy](#cli-legacy)
- [License](#license)

---

## Introduction 🚀

**grade-calculator** is a self-hosted web application for managing school grades with weighted averages, label-based filtering, and an optional reward system. The reward system lets you define a payout per grade — in euros, a custom unit, or raw points — so that earning good grades automatically updates a tracked balance that can later be redeemed.

Everything is stored locally in JSON files on the server. The web interface is a Material Design 3 SPA accessible from any browser on the same network, and is installable as a PWA on mobile.

---

## Features ✨

### Grades & Subjects
- Add, edit, and delete grades per subject with weighted averages
- **Labels** — tag grades (e.g. `Schulaufgabe`, `Abfrage`) for filtering
- **Chip-based multi-label filter** with AND / OR logic across all subjects
- Subject reordering, rename, and bulk delete

### Reward System
- Three reward modes: **Money (€)**, **Custom unit** (e.g. trading cards), **Points only**
- Configurable points per grade value (defaults: `1→10 pts`, `2→6 pts`, `3→2 pts`, `4–6→0`)
- Per-grade **"Belohnung buchen"** toggle — optionally skip wallet credit when adding a grade
- Wallet with running balance, redemption log, and full grade change history
- Grade change log visible even when rewards are disabled

### Statistics
- Overall and per-subject averages, best/worst subject and grade
- **Fächer & Trends** — per-subject trend direction (↑ →↓) via linear regression
- **Notenverlauf** — individual grade history + running average, rendered as inline SVG
- **Guthaben-Verlauf** — cumulative earned reward over time (when rewards enabled)
- Grade distribution bar chart, top labels, two-export comparison

### Export
- TXT export with custom label, timestamped `YYYYMMDD_HHMM`
- Configurable sections: statistics, grades per subject, grade log, redemptions
- Import two exports for side-by-side comparison (averages + subject deltas)

### App
- Responsive Material Design 3 UI — nav drawer on desktop, bottom nav + FAB on mobile
- Dark / light mode toggle (system preference + manual override)
- 6-step onboarding tour on first launch, re-triggerable from settings
- Verbose loading toggle, startup file status check
- Backup as ZIP download, old backup cleanup

---

## Technologies 🛠️

| Layer       | Stack                                                        |
|-------------|--------------------------------------------------------------|
| Backend     | Python 3.10+, Flask 3, python-dotenv, Gunicorn (production) |
| Frontend    | Vanilla ES Modules, no build step                            |
| UI          | Material Design 3 Web Components (`@material/web` via CDN)  |
| Styling     | CSS Custom Properties (M3 tokens), no framework              |
| Storage     | Local JSON files (unchanged from CLI)                        |

---

## Setup ⚙️

```bash
git clone https://github.com/Mango505/grade-calculator.git
cd grade-calculator
pip install -r requirements.txt
```

Copy and edit the environment file:

```bash
cp _env .env
```

Key `.env` settings:

```ini
HOST=127.0.0.1      # use 0.0.0.0 to expose on your network (e.g. for mobile access)
PORT=5000
FLASK_DEBUG=1       # set to 0 in production

# Optional: point to existing CLI data files
GRADES_PATH=~/grades.json
WALLET_PATH=~/wallet.json
```

> **Note:** Always use `python app.py` to start the server — not `flask run`. The app reads `HOST` and `PORT` from `.env` via `python-dotenv`; `flask run` uses different variable names and will ignore them.

---

## Running 🚀

### Development

```bash
python app.py
# → http://localhost:5000
```

### Production (Raspberry Pi / home server)

```bash
gunicorn "app:app" --bind 0.0.0.0:5000 --workers 2
```

To keep it running permanently, use `systemd` or `screen`:

```bash
# Quick option with screen:
screen -S notenrechner
python app.py
# Ctrl+A, D to detach
```

---

## Mobile & PWA 📱

The app is installable as a Progressive Web App — it behaves like a native app with no browser chrome.

**Setup:**

1. Set `HOST=0.0.0.0` in `.env` and restart the server.
2. Find your computer's/Pi's local IP address:
   ```bash
   # macOS / Linux:
   hostname -I
   # Windows:
   ipconfig   # → IPv4 address under the Wi-Fi adapter
   ```
3. Open `http://<local-ip>:5000` on your phone (must be on the same Wi-Fi).
4. Install to home screen:
   - **iOS Safari:** Share → "Zum Home-Bildschirm"
   - **Android Chrome:** Menu → "App installieren"

The service worker caches the app shell (JS, CSS, HTML) so the UI loads even when the server is unreachable. API data (grades, wallet) is served from the last cached response when offline — writes are not possible without the server.

---

## Architecture 🏗️

```
grade-calculator/
├── app.py              # Flask server, all API routes
├── config.py           # Path resolution, env vars
├── models.py           # Grade, Subject, Wallet, RewardConfig, AppConfig
├── storage.py          # JSON load/save for all models
├── requirements.txt
├── .env                # Local config (not committed)
├── templates/
│   └── index.html      # SPA shell
└── static/
    ├── css/app.css
    ├── manifest.json   # PWA manifest
    ├── sw.js           # Service worker (cache-first shell, network-first API)
    └── js/
        ├── app.js          # Router, dark mode, FAB, snackbar, skeletons
        ├── components.js   # Dialog, cards, badges, validation helpers
        ├── tour.js         # Onboarding tour
        └── pages/
            ├── overview.js  # Subject grid + detail view (grade CRUD)
            ├── wallet.js    # Balance + logs
            ├── stats.js     # Charts, export, comparison
            └── settings.js  # Reward config, paths, backup/reset
```

**API routes:**

```
GET/POST   /api/subjects
DELETE     /api/subjects/:name
PUT        /api/subjects/reorder
POST       /api/subjects/:name/grades          ?book_reward (bool)
PUT        /api/subjects/:name/grades/:i
DELETE     /api/subjects/:name/grades/:i       ?adjust_wallet
GET        /api/wallet
POST       /api/wallet/redeem
GET/POST   /api/reward-config
GET/PATCH  /api/app-config
GET        /api/overview
GET        /api/export
GET        /api/backup
POST       /api/backups/cleanup
POST       /api/reset
GET        /api/startup-status
```

---

## Data Files 💾

All data is stored as human-readable JSON. Default locations:

| File                      | Contents                                             |
|---------------------------|------------------------------------------------------|
| `data/grades.json`        | All subjects and their grades (value, weight, labels)|
| `data/wallet.json`        | Balance, redemption log, grade change history        |
| `data/reward_config.json` | Points map, reward mode, rate, unit name             |
| `data/app_config.json`    | File paths, verbose loading flag                     |

Paths can be overridden via `.env` — useful for pointing the web app at existing CLI data files:

```ini
GRADES_PATH=~/my_data/grades.json
WALLET_PATH=~/my_data/wallet.json
```

---

## Backup & Reset 🔄

Both are accessible from **Settings → Backup & Reset**:

- **Backup** — downloads all four data files as a single ZIP (`notenrechner_backup_YYYYMMDD_HHMMSS.zip`)
- **Alte Backups löschen** — keeps only the most recent backup folder, deletes the rest

Individual reset actions (each requires confirmation):

| Action                        | Effect                                    |
|-------------------------------|-------------------------------------------|
| Notenänderungen-Log leeren    | Clears grade change history               |
| Einlösungen-Log leeren        | Clears redemption log (balance unchanged) |
| Guthaben zurücksetzen         | Sets wallet balance to 0                  |
| Belohnungskonfiguration reset | Restores default points map and mode      |
| App-Konfiguration reset       | Restores default file paths               |

> ⚠️ Grade and subject deletion from the overview is permanent outside of a backup restore.

---

## CLI Legacy 🖥️

The original command-line interface is available on the `cli` branch:

```bash
git checkout cli
python main.py
```

The CLI and web app share the same data format — you can switch between them by pointing both at the same JSON files.

---

## License ⚖️

This project is licensed under the terms of the **MIT** license.
See [LICENSE](https://github.com/Mango505/grade-calculator/blob/main/LICENSE) for details.
