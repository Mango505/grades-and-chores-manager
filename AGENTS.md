# AGENTS.md

Instructions for AI agents working on this repository.

---

## Project Overview

**grade-calculator** is a self-hosted Flask web app for tracking school grades (Bavarian 1–6 system) with an optional reward system. The web interface (`main` branch) is a Material Design 3 SPA backed by a Flask JSON API. The original CLI (`cli` branch) shares the same data layer.

---

## Repository Layout

```
grade-calculator/
├── app.py              # Flask entry point — all API routes
├── config.py           # Absolute path resolution via env vars / .env
├── models.py           # Data models: Grade, Subject, Wallet, RewardConfig, AppConfig
├── storage.py          # JSON load/save for all models
├── requirements.txt    # flask, python-dotenv, gunicorn
├── _env                # .env template (copy to .env, never commit .env)
├── templates/
│   └── index.html      # SPA shell — loaded once, JS takes over routing
└── static/
    ├── css/app.css         # All styles — M3 CSS custom properties, no framework
    ├── manifest.json       # PWA manifest
    ├── sw.js               # Service worker
    └── js/
        ├── app.js          # Router, exports: apiFetch, showSnackbar, setPrimaryAction,
        │                   #   clearPrimaryAction, skeletonCard, skeletonGrid, navigateTo
        ├── components.js   # openDialog, card, statChip, gradeBadge, emptyState,
        │                   #   errorBanner, injectComponentStyles, validateAll, validators
        ├── tour.js         # Onboarding tour: checkTour(), startTour()
        └── pages/
            ├── overview.js
            ├── wallet.js
            ├── stats.js
            └── settings.js
```

---

## Strict Constraints

### Never modify these files
- `models.py` — shared with CLI, any change risks breaking the CLI branch
- `storage.py` — same reason
- `_env` — this is the committed template; `.env` is gitignored

### Branch rules
- `main` — web interface only
- `cli` — original CLI (`main.py`); `models.py` / `storage.py` originate here

---

## Python / Backend

- **Python 3.10+** required (uses union type hints `X | Y`)
- No additional dependencies beyond `requirements.txt`; do not add new packages without explicit instruction
- All routes live in `app.py`; use `_load_all()` / `_save_all()` for data access — never call storage functions directly in route handlers
- Return `jsonify(...)` for all API responses; use `abort(code, message)` for errors
- The `book_reward` boolean field on `POST /api/subjects/:name/grades` controls whether the grade credits the wallet; default `True`
- Path resolution: always use `Config.*_PATH` constants — never hardcode paths

## JavaScript / Frontend

### Module system
- Vanilla ES Modules, no bundler, no TypeScript, no framework
- All page modules export a single `default async function render(container)` — `app.js` calls this
- Import only from `"../app.js"` or `"../components.js"` (relative paths); never import from pages cross-page

### String construction
- **No nested template literals** — they caused a production outage. Use string concatenation (`+`) for any HTML that contains dynamic content inside `${}` expressions
- Template literals are fine for simple, flat strings with no nested backticks

### Buttons
- Use native `<button class="btn-text">`, `<button class="btn-tonal">`, or `<button class="btn-filled">` for any button that needs reliable padding/margin
- `md-filled-button`, `md-filled-tonal-button`, `md-text-button` from the M3 web components library have shadow-DOM styling that ignores external CSS margin rules — only use them where appearance is acceptable without margin control
- The three native button classes are defined in `app.css`

### CSS
- All design tokens are M3 CSS custom properties on `:root` (light) with dark overrides
- Do not use Tailwind, Bootstrap, or any utility framework
- `#subjectGrid` must keep `display:grid !important` — the `!important` overrides service worker cached styles in some browsers
- `.st-stats-wrapper` is a flex-column container that provides consistent `gap:16px` between the tall and short stats sections — do not add `margin-bottom` to `.st-grid-tall`

### Dialogs
- Always use `openDialog(headline, bodyHTML, confirmLabel?, danger?)` from `components.js`
- Never use `<md-dialog>` — it has centering issues
- Validation errors in dialog close handlers should show `showSnackbar(msg, "error")` — the dialog has already closed at that point, so `return` early prevents the API call but the snackbar gives user feedback

### Service Worker (`sw.js`)
- Cache name is `nr-shell-v3` / `nr-api-v3` — increment the version suffix when static assets change in a way that must invalidate existing caches
- Shell assets list must be updated if new JS page files are added

---

## API Contract

| Method | Path | Body / Query | Notes |
|--------|------|-------------|-------|
| GET | `/api/subjects` | — | Array of subject objects |
| POST | `/api/subjects` | `{name}` | 409 if duplicate |
| DELETE | `/api/subjects/:name` | — | 204 |
| PUT | `/api/subjects/reorder` | `{order:[]}` | |
| POST | `/api/subjects/:name/grades` | `{value,weight?,labels?,book_reward?}` | 400 if value not 1–6 |
| PUT | `/api/subjects/:name/grades/:i` | `{value?,weight?,labels?}` | Partial update |
| DELETE | `/api/subjects/:name/grades/:i` | `?adjust_wallet=1` | Reverses wallet credit |
| GET | `/api/wallet` | — | Includes `formatted_balance` |
| POST | `/api/wallet/redeem` | `{cost,description?}` | 400 if rewards disabled |
| GET/POST | `/api/reward-config` | Full config object on POST | |
| GET | `/api/app-config` | — | Includes `resolved_data_dir` |
| PATCH | `/api/app-config` | `{verbose_loading?}` | Partial update |
| GET | `/api/overview` | — | Aggregated averages |
| GET | `/api/export` | — | Full data for TXT export |
| GET | `/api/backup` | — | ZIP download |
| POST | `/api/backups/cleanup` | — | Keeps newest backup only |
| POST | `/api/reset` | `{action}` | See actions below |
| GET | `/api/startup-status` | — | Load status of all 4 files |

**Reset actions:** `grade_log`, `redemptions`, `balance`, `app_config`, `reward_config`

---

## Data Models (summary)

```python
Grade(value: float, weight: float, labels: list[str])
  # value must be 1.0–6.0, weight > 0

Subject(name: str)
  # .grades: list[Grade]
  # .average() → float (weighted)

Wallet(balance: float, redemptions: list[dict], grade_log: list[dict])
  # grade_log entry: {action, subject, value, weight, labels, value_delta, date}
  # action: "+" add | "-" delete | "~" edit

RewardConfig(enabled, points_map, money_per_point, reward_mode, unit_name, unit_per_point)
  # reward_mode: "money" | "unit" | "points"
  # points_map: {int grade → int points}

AppConfig(data_path, wallet_path, reward_config_path, backup_path, verbose_loading)
```

---

## Coding Conventions

- **Python:** follow existing style (no type annotations in function bodies, docstrings on storage functions only)
- **JavaScript:** string concatenation for HTML; `async/await` everywhere; no `var`; use `const` / `let`
- **Error handling:** all `apiFetch` calls must be wrapped in `try/catch`; show `showSnackbar(e.message, "error")` on failure
- **Comments in English**, UI strings in German (app is German-language)
- Version number lives only in `README.md` badge — nowhere else

---

## Common Pitfalls

1. **Nested template literals** — caused the entire app to stop loading (exports not found). Always use string concatenation for HTML with dynamic inner content.
2. **`md-*` button margins** — the M3 web components ignore `margin` from stylesheets due to shadow DOM. Use `.btn-text`, `.btn-tonal`, `.btn-filled` native button classes instead.
3. **`filter-mode-row` CSS** — the `#filterModeRow` div must have `class="filter-mode-row"` for the CSS `gap` to apply. Missing the class means the chips and radios clump together.
4. **`_load_all()` on every request** — this is intentional; there is no in-memory state between requests. Do not cache loaded data across requests.
5. **`navigateTo` export** — `app.js` exports `navigateTo`; `tour.js` imports it dynamically (`import("/static/js/app.js")`) to avoid circular dependencies.
