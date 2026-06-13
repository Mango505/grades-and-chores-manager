/**
 * components.js – Shared UI builders.
 * Uses a custom dialog instead of <md-dialog> for reliable centering + button behavior.
 */

export function card(innerHTML, extraClass = "") {
  return `<div class="card ${extraClass}">${innerHTML}</div>`;
}

export function statChip(label, value, colorVar = "--md-sys-color-primary") {
  return `<div class="stat-chip">
    <span class="stat-chip__label">${label}</span>
    <span class="stat-chip__value" style="color:var(${colorVar})">${value}</span>
  </div>`;
}

const GRADE_COLORS = {1:"#1b7e4a",2:"#4a8c2a",3:"#a08c00",4:"#c45d00",5:"#c43000",6:"#8b0000"};
export function gradeBadge(value) {
  const r = Math.min(6, Math.max(1, Math.round(value)));
  return `<span class="grade-badge" style="background:${GRADE_COLORS[r]??'#555'}">${value}</span>`;
}

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
// Custom dialog – reliable centering, no md-dialog dependency
// ---------------------------------------------------------------------------
/**
 * Open a centered modal dialog.
 * Returns an object with the same interface pages expect:
 *   dlg.returnValue, dlg.querySelector(), dlg.addEventListener("close", fn)
 *
 * @param {string} headline
 * @param {string} bodyHTML
 * @param {string} confirmLabel
 * @returns {{ returnValue: string, querySelector: fn, addEventListener: fn }}
 */
export function openDialog(headline, bodyHTML, confirmLabel = "Speichern", danger = false) {
  document.getElementById("app-dialog")?.remove();

  const wrap = document.createElement("div");
  wrap.id = "app-dialog";
  wrap.innerHTML = `
    <div class="dlg-backdrop">
      <div class="dlg" role="dialog" aria-modal="true">
        <div class="dlg-headline">${headline}</div>
        <div class="dlg-content">${bodyHTML}</div>
        <div class="dlg-actions">
          <button class="dlg-cancel">Abbrechen</button>
          <button class="dlg-confirm ${danger?'danger':''}">${confirmLabel}</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(wrap);

  // Focus first input field after render
  setTimeout(() => {
    const first = wrap.querySelector("md-outlined-text-field, input, select");
    first?.focus?.();
  }, 80);

  // Fake dlg object with the interface our pages use
  const dlg = {
    returnValue: "",
    _cbs: {},
    querySelector:    sel => wrap.querySelector(sel),
    querySelectorAll: sel => wrap.querySelectorAll(sel),
    addEventListener(ev, fn) {
      this._cbs[ev] = this._cbs[ev] ?? [];
      this._cbs[ev].push(fn);
    },
    _fire(ev) { (this._cbs[ev] ?? []).forEach(fn => fn()); },
    close(val = "") {
      this.returnValue = val;
      wrap.remove();
      this._fire("close");
    },
  };

  wrap.querySelector(".dlg-cancel").addEventListener("click",  () => dlg.close("cancel"));
  wrap.querySelector(".dlg-confirm").addEventListener("click", () => dlg.close("confirm"));
  // Click outside to cancel
  wrap.querySelector(".dlg-backdrop").addEventListener("click", e => {
    if (e.target === e.currentTarget) dlg.close("cancel");
  });
  // Escape key
  const escHandler = e => { if (e.key === "Escape") { dlg.close("cancel"); document.removeEventListener("keydown", escHandler); } };
  document.addEventListener("keydown", escHandler);

  return dlg;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
export function validateField(field, ruleFn) {
  const val = field.value ?? "";
  const msg = ruleFn(val);
  if (msg) {
    field.setAttribute("error", "");
    field.setAttribute("error-text", msg);
    return false;
  }
  field.removeAttribute("error");
  field.removeAttribute("error-text");
  return true;
}

export function validateAll(pairs) {
  return pairs.map(([field, ruleFn]) => validateField(field, ruleFn)).every(Boolean);
}

export const validators = {
  gradeValue: v => {
    const n = parseFloat(v);
    if (v.trim() === "" || isNaN(n)) return "Bitte eine Zahl zwischen 1 und 6 eingeben.";
    if (n < 1 || n > 6)             return "Note muss zwischen 1 und 6 liegen.";
    return "";
  },
  positiveNumber: v => {
    const n = parseFloat(v);
    if (v.trim() === "" || isNaN(n)) return "Bitte eine Zahl eingeben.";
    if (n <= 0)                      return "Muss größer als 0 sein.";
    return "";
  },
  nonEmpty: v => v.trim() === "" ? "Darf nicht leer sein." : "",
};

// ---------------------------------------------------------------------------
// Shared component CSS
// ---------------------------------------------------------------------------
const CSS = `
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
  .banner--error { background:var(--md-sys-color-error-container);color:var(--md-sys-color-error); }
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

let _injected = false;
export function injectComponentStyles() {
  if (_injected) return;
  _injected = true;
  const s = document.createElement("style");
  s.textContent = CSS;
  document.head.appendChild(s);
}
