/**
 * components.js – Reusable M3-styled HTML builders + validation helpers.
 * Imported by all page modules.
 */

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------
export function card(innerHTML, extraClass = "") {
  return `<div class="card ${extraClass}">${innerHTML}</div>`;
}

// ---------------------------------------------------------------------------
// Stat chip: small label above a bold value
// ---------------------------------------------------------------------------
export function statChip(label, value, colorVar = "--md-sys-color-primary") {
  return `<div class="stat-chip">
    <span class="stat-chip__label">${label}</span>
    <span class="stat-chip__value" style="color:var(${colorVar})">${value}</span>
  </div>`;
}

// ---------------------------------------------------------------------------
// Grade badge: coloured circle 1 (green) → 6 (red)
// ---------------------------------------------------------------------------
const GRADE_COLORS = {
  1: "#1b7e4a", 2: "#4a8c2a", 3: "#a08c00",
  4: "#c45d00", 5: "#c43000", 6: "#8b0000",
};
export function gradeBadge(value) {
  const r = Math.min(6, Math.max(1, Math.round(value)));
  return `<span class="grade-badge" style="background:${GRADE_COLORS[r] ?? "#555"}">${value}</span>`;
}

// ---------------------------------------------------------------------------
// Empty state / error banner
// ---------------------------------------------------------------------------
export function emptyState(icon, text) {
  return `<div class="page-placeholder">
    <span class="material-symbols-rounded page-placeholder__icon">${icon}</span>
    <p>${text}</p>
  </div>`;
}
export function errorBanner(msg) {
  return `<div class="banner banner--error">
    <span class="material-symbols-rounded">error</span> ${msg}
  </div>`;
}

// ---------------------------------------------------------------------------
// Dialog helper
// ---------------------------------------------------------------------------
/**
 * Create, append, and open an <md-dialog>. Returns the element.
 * The caller listens to the "close" event and checks dlg.returnValue.
 */
export function openDialog(headline, bodyHTML, confirmLabel = "Speichern") {
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
// Inline field validation
// ---------------------------------------------------------------------------
/**
 * Validate one <md-outlined-text-field> with a rule function.
 * The rule function receives the raw string value and returns
 * an error message string, or "" if valid.
 *
 * @param {HTMLElement} field
 * @param {(value: string) => string} ruleFn
 * @returns {boolean} true if valid
 */
export function validateField(field, ruleFn) {
  const msg = ruleFn(field.value ?? "");
  if (msg) {
    field.setAttribute("error", "");
    field.setAttribute("error-text", msg);
    return false;
  }
  field.removeAttribute("error");
  field.removeAttribute("error-text");
  return true;
}

/**
 * Validate multiple fields at once. All errors are shown simultaneously.
 * @param {Array<[HTMLElement, (value: string) => string]>} pairs
 * @returns {boolean}
 */
export function validateAll(pairs) {
  return pairs.map(([field, ruleFn]) => validateField(field, ruleFn))
              .every(Boolean);
}

/** Ready-made rule functions. */
export const validators = {
  gradeValue: v => {
    const n = parseFloat(v);
    if (v.trim() === "" || isNaN(n)) return "Pflichtfeld – bitte eine Zahl eingeben.";
    if (n < 1 || n > 6)             return "Note muss zwischen 1 und 6 liegen.";
    return "";
  },
  positiveNumber: v => {
    const n = parseFloat(v);
    if (v.trim() === "" || isNaN(n)) return "Pflichtfeld – bitte eine Zahl eingeben.";
    if (n <= 0)                      return "Muss größer als 0 sein.";
    return "";
  },
  nonEmpty: v => v.trim() === "" ? "Darf nicht leer sein." : "",
};

// ---------------------------------------------------------------------------
// Shared component CSS (injected once into <head>)
// ---------------------------------------------------------------------------
const COMPONENT_CSS = `
  .card { background:var(--md-sys-color-surface-container-low);
          border-radius:var(--shape-corner-large);padding:20px;box-shadow:var(--elevation-1); }
  .stat-chip { display:flex;flex-direction:column;align-items:center;gap:2px; }
  .stat-chip__label { font-size:11px;color:var(--md-sys-color-on-surface-variant);
                      text-transform:uppercase;letter-spacing:.06em; }
  .stat-chip__value { font-size:22px;font-weight:700;line-height:1.1; }
  .grade-badge { display:inline-flex;align-items:center;justify-content:center;
                 width:30px;height:30px;border-radius:50%;
                 color:#fff;font-weight:700;font-size:13px;flex-shrink:0; }
  .banner { display:flex;align-items:center;gap:8px;padding:12px 16px;
            border-radius:var(--shape-corner-medium);margin-bottom:16px;font-size:14px; }
  .banner--error { background:var(--md-sys-color-error-container);
                   color:var(--md-sys-color-error); }
  .dialog-content { display:flex;flex-direction:column;gap:16px;padding-top:8px;min-width:280px; }
  .chip-row { display:flex;flex-wrap:wrap;gap:12px; }
  .divider  { height:1px;background:var(--md-sys-color-outline-variant);margin:12px 0; }
  .grade-row { display:flex;align-items:center;gap:10px;padding:6px 0;
               border-bottom:1px solid var(--md-sys-color-outline-variant);
               font-size:14px;color:var(--md-sys-color-on-surface-variant); }
  .grade-row:last-child { border-bottom:none; }
  .grade-row__meta { flex:1; }
  .icon-btn-sm { display:inline-flex;align-items:center;justify-content:center;
                 width:36px;height:36px;border:none;background:transparent;
                 border-radius:var(--shape-corner-full);cursor:pointer;
                 color:var(--md-sys-color-on-surface-variant);transition:background .2s; }
  .icon-btn-sm:hover { background:color-mix(in srgb,var(--md-sys-color-on-surface) 8%,transparent); }
  .icon-btn-sm .material-symbols-rounded { font-size:20px; }
  .icon-btn-sm[disabled] { opacity:.35;pointer-events:none; }
`;

let _cssInjected = false;
export function injectComponentStyles() {
  if (_cssInjected) return;
  _cssInjected = true;
  const s = document.createElement("style");
  s.textContent = COMPONENT_CSS;
  document.head.appendChild(s);
}
