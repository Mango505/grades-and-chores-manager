/**
 * components.js – Reusable M3-styled HTML builders
 *
 * All functions return HTML strings or DOM nodes so pages can compose them
 * without duplicating markup. Nothing here does any fetching.
 */

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

/**
 * Renders an M3 "elevated card" shell.
 * @param {string} innerHTML
 * @param {string} [extraClass]
 */
export function card(innerHTML, extraClass = "") {
  return `<div class="card ${extraClass}">${innerHTML}</div>`;
}

/**
 * A labelled stat chip: small label above a bold value.
 * Used in overview banners and wallet cards.
 */
export function statChip(label, value, colorVar = "--md-sys-color-primary") {
  return `
    <div class="stat-chip">
      <span class="stat-chip__label">${label}</span>
      <span class="stat-chip__value" style="color:var(${colorVar})">${value}</span>
    </div>`;
}

// ---------------------------------------------------------------------------
// Grade badge (coloured circle: 1=green … 6=red)
// ---------------------------------------------------------------------------

const GRADE_COLORS = {
  1: "#1b7e4a", 2: "#4a8c2a", 3: "#a08c00",
  4: "#c45d00", 5: "#c43000", 6: "#8b0000",
};

/** Returns a small coloured badge showing the grade value. */
export function gradeBadge(value) {
  const rounded = Math.min(6, Math.max(1, Math.round(value)));
  const color   = GRADE_COLORS[rounded] ?? "#555";
  return `<span class="grade-badge" style="background:${color}">${value}</span>`;
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

export function emptyState(icon, text) {
  return `
    <div class="page-placeholder">
      <span class="material-symbols-rounded page-placeholder__icon">${icon}</span>
      <p>${text}</p>
    </div>`;
}

// ---------------------------------------------------------------------------
// Inline error / info banners
// ---------------------------------------------------------------------------

export function errorBanner(msg) {
  return `<div class="banner banner--error">
    <span class="material-symbols-rounded">error</span> ${msg}
  </div>`;
}

// ---------------------------------------------------------------------------
// Dialog helpers (M3 <md-dialog>)
// ---------------------------------------------------------------------------

/**
 * Creates and appends an <md-dialog> to document.body, opens it, and returns it.
 * Caller is responsible for adding event listeners and removing on close.
 *
 * @param {string} headline
 * @param {string} bodyHTML   – content inside the dialog
 * @param {string} confirmLabel
 * @returns {HTMLElement} the dialog element
 */
export function openDialog(headline, bodyHTML, confirmLabel = "Speichern") {
  // Remove any leftover dialog
  document.getElementById("app-dialog")?.remove();

  const dlg = document.createElement("md-dialog");
  dlg.id = "app-dialog";
  dlg.innerHTML = `
    <div slot="headline">${headline}</div>
    <div slot="content" class="dialog-content">${bodyHTML}</div>
    <div slot="actions">
      <md-text-button value="cancel">Abbrechen</md-text-button>
      <md-filled-button value="confirm">${confirmLabel}</md-filled-button>
    </div>`;
  document.body.appendChild(dlg);
  dlg.open = true;
  return dlg;
}

// ---------------------------------------------------------------------------
// Shared CSS injected once (components that don't fit in app.css)
// ---------------------------------------------------------------------------

const COMPONENT_CSS = `
  /* Card */
  .card {
    background: var(--md-sys-color-surface-container-low);
    border-radius: var(--shape-corner-large);
    padding: 20px;
    box-shadow: var(--elevation-1);
  }

  /* Stat chip */
  .stat-chip { display:flex; flex-direction:column; align-items:center; gap:2px; }
  .stat-chip__label { font-size:11px; color:var(--md-sys-color-on-surface-variant); text-transform:uppercase; letter-spacing:.06em; }
  .stat-chip__value { font-size:22px; font-weight:700; line-height:1.1; }

  /* Grade badge */
  .grade-badge {
    display:inline-flex; align-items:center; justify-content:center;
    width:30px; height:30px; border-radius:50%;
    color:#fff; font-weight:700; font-size:13px;
    flex-shrink:0;
  }

  /* Banners */
  .banner { display:flex; align-items:center; gap:8px; padding:12px 16px;
            border-radius:var(--shape-corner-medium); margin-bottom:16px; font-size:14px; }
  .banner--error { background:var(--md-sys-color-error-container);
                   color:var(--md-sys-color-error); }

  /* Dialog content */
  .dialog-content { display:flex; flex-direction:column; gap:16px; padding-top:8px; min-width:280px; }

  /* Chip row */
  .chip-row { display:flex; flex-wrap:wrap; gap:12px; }

  /* Divider */
  .divider { height:1px; background:var(--md-sys-color-outline-variant); margin:12px 0; }

  /* Grade row (used in overview + grades pages) */
  .grade-row {
    display:flex; align-items:center; gap:10px;
    padding:6px 0; border-bottom:1px solid var(--md-sys-color-outline-variant);
    font-size:14px; color:var(--md-sys-color-on-surface-variant);
  }
  .grade-row:last-child { border-bottom:none; }
  .grade-row__meta { flex:1; }
  .grade-row__actions { display:flex; gap:4px; }

  /* Icon button (small) */
  .icon-btn-sm {
    display:inline-flex; align-items:center; justify-content:center;
    width:36px; height:36px; border:none; background:transparent;
    border-radius:var(--shape-corner-full); cursor:pointer;
    color:var(--md-sys-color-on-surface-variant);
    transition:background .2s;
  }
  .icon-btn-sm:hover { background:color-mix(in srgb,var(--md-sys-color-on-surface) 8%,transparent); }
  .icon-btn-sm .material-symbols-rounded { font-size:20px; }
`;

let cssInjected = false;

/** Call once per app session to inject shared component styles. */
export function injectComponentStyles() {
  if (cssInjected) return;
  const style  = document.createElement("style");
  style.textContent = COMPONENT_CSS;
  document.head.appendChild(style);
  cssInjected = true;
}

// ---------------------------------------------------------------------------
// Input validation helpers
// ---------------------------------------------------------------------------

/**
 * Validates a single <md-outlined-text-field> and shows/clears an error message.
 * Returns true if valid.
 *
 * @param {HTMLElement} field   – the md-outlined-text-field element
 * @param {Function}    testFn  – returns an error string or "" if valid
 */
export function validateField(field, testFn) {
  const msg = testFn(field.value);
  field.error        = !!msg;
  field.errorText    = msg;
  field.reportValidity?.();
  return !msg;
}

/**
 * Validates all fields in a dialog before submitting.
 * Returns true only if every field passes.
 *
 * @param {Array<{field: HTMLElement, test: Function}>} rules
 */
export function validateAll(rules) {
  return rules.map(({ field, test }) => validateField(field, test)).every(Boolean);
}

// Common test functions (return error string or "")
export const validators = {
  gradeValue: v => {
    const n = parseFloat(v);
    if (v === "" || isNaN(n))      return "Pflichtfeld – bitte eine Zahl eingeben.";
    if (n < 1 || n > 6)           return "Note muss zwischen 1 und 6 liegen.";
    if ((n * 10) % 5 !== 0)       return "Erlaubte Werte: 1, 1.5, 2, 2.5, … 6";
    return "";
  },
  positiveNumber: v => {
    const n = parseFloat(v);
    if (v === "" || isNaN(n)) return "Pflichtfeld – bitte eine Zahl eingeben.";
    if (n <= 0)               return "Muss größer als 0 sein.";
    return "";
  },
  nonEmpty: v => v.trim() === "" ? "Darf nicht leer sein." : "",
};
