/**
 * app.js – Shell: router, dark mode, FAB, snackbar, skeletons
 */

const PAGES = {
  overview: { title: "Übersicht",      loader: () => import("/static/js/pages/overview.js") },
  wallet:   { title: "Konto & Verlauf", loader: () => import("/static/js/pages/wallet.js")   },
  stats:    { title: "Statistiken",    loader: () => import("/static/js/pages/stats.js")    },
  settings: { title: "Einstellungen",  loader: () => import("/static/js/pages/settings.js") },
};
const DEFAULT_PAGE = "overview";

const navDrawer      = document.getElementById("navDrawer");
const drawerBackdrop = document.getElementById("drawerBackdrop");
const pageContainer  = document.getElementById("pageContainer");
const pageTitle      = document.getElementById("pageTitle");
const allNavItems    = document.querySelectorAll("[data-page]");
const navFab         = document.getElementById("navFab");
const mobFab         = document.getElementById("mobFab");

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
function currentPageKey() {
  const hash = location.hash.replace("#", "").trim();
  return hash in PAGES ? hash : DEFAULT_PAGE;
}

export function navigateTo(key) {
  if (!(key in PAGES)) key = DEFAULT_PAGE;
  history.pushState(null, "", "#" + key);
  renderPage(key);
}

async function renderPage(key) {
  const page = PAGES[key];
  if (!page) return;

  clearPrimaryAction();
  updateActiveNav(key);
  if (pageTitle) pageTitle.textContent = page.title;

  // Clean up any injected page-specific top-bar elements (e.g. overview overflow menu)
  document.getElementById("ov-overflow-btn")?.remove();
  document.getElementById("ov-overflow-menu")?.remove();

  pageContainer.innerHTML =
    '<div class="page-placeholder">' +
      '<span class="material-symbols-rounded page-placeholder__icon">hourglass_top</span>' +
      '<p>Lade\u2026</p>' +
    '</div>';

  try {
    const mod = await page.loader();
    if (typeof mod.default === "function") {
      pageContainer.innerHTML = "";
      await mod.default(pageContainer);
    }
  } catch (err) {
    console.error("Page '" + key + "' failed:", err);
    pageContainer.innerHTML =
      '<div class="page-placeholder">' +
        '<span class="material-symbols-rounded page-placeholder__icon" style="color:var(--md-sys-color-error)">error</span>' +
        '<p style="font-size:13px;color:var(--md-sys-color-on-surface-variant)">' + err.message + '</p>' +
      '</div>';
  }
}

function updateActiveNav(key) {
  allNavItems.forEach(item => {
    const active = item.dataset.page === key;
    item.classList.toggle("nav-item--active",         active && !!item.closest(".nav-drawer"));
    item.classList.toggle("bottom-nav__item--active", active && !!item.closest(".bottom-nav"));
  });
}

// ---------------------------------------------------------------------------
// Drawer (mobile only)
// ---------------------------------------------------------------------------
function closeDrawer() {
  navDrawer.classList.remove("open");
  drawerBackdrop.classList.remove("visible");
}

drawerBackdrop?.addEventListener("click", closeDrawer);
document.addEventListener("keydown", e => { if (e.key === "Escape") closeDrawer(); });

allNavItems.forEach(item => {
  item.addEventListener("click", e => {
    e.preventDefault();
    closeDrawer();
    navigateTo(item.dataset.page);
  });
});

window.addEventListener("popstate", () => renderPage(currentPageKey()));

// ---------------------------------------------------------------------------
// Primary Action FAB
// ---------------------------------------------------------------------------
let _fabCallback = null;

export function setPrimaryAction(icon, label, callback) {
  _fabCallback = callback;
  const iconEl  = document.getElementById("navFabIcon");
  const labelEl = document.getElementById("navFabLabel");
  const mobIcon = document.getElementById("mobFabIcon");
  if (iconEl)  iconEl.textContent  = icon;
  if (labelEl) labelEl.textContent = label;
  if (mobIcon) mobIcon.textContent = icon;
  if (navFab) navFab.removeAttribute("hidden");
  mobFab?.removeAttribute("hidden");
}

export function clearPrimaryAction() {
  _fabCallback = null;
  if (navFab) navFab.setAttribute("hidden", "");
  mobFab?.setAttribute("hidden", "");
}

navFab?.addEventListener("click", () => _fabCallback?.());
mobFab?.addEventListener("click", () => _fabCallback?.());

// ---------------------------------------------------------------------------
// API fetch helper
// ---------------------------------------------------------------------------
export async function apiFetch(url, options = {}) {
  const res  = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
    ...options,
  });
  if (res.status === 204) return undefined;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.description ?? body?.error ?? "HTTP " + res.status);
  return body;
}

// ---------------------------------------------------------------------------
// Startup status check
// ---------------------------------------------------------------------------
async function checkStartupStatus() {
  let status, appCfg;
  try {
    [status, appCfg] = await Promise.all([
      apiFetch("/api/startup-status"),
      apiFetch("/api/app-config"),
    ]);
  } catch { return; }

  const ok      = status.files.filter(f => f.status === "ok");
  const missing = status.files.filter(f => f.status === "missing");
  const corrupt = status.files.filter(f => f.status === "corrupt");

  if (appCfg.verbose_loading && ok.length)
    setTimeout(() => showSnackbar(ok.map(f => f.name).join(", ") + " geladen."), 600);

  if (missing.length || corrupt.length)
    _showLoadErrorDialog(missing, corrupt);
}

function _showLoadErrorDialog(missing, corrupt) {
  document.getElementById("load-error-dialog")?.remove();
  const wrap = document.createElement("div");
  wrap.id = "load-error-dialog";

  function fileRow(f) {
    return '<div style="margin-bottom:8px">' +
      '<div style="font-size:13px;margin-bottom:4px">' + f.name + '</div>' +
      '<code style="display:block;padding:8px 10px;border-radius:6px;font-size:12px;' +
      'background:var(--md-sys-color-surface-container-high);word-break:break-all">' +
      f.path + '</code></div>';
  }

  const missingSection = missing.length
    ? '<p style="font-size:14px;font-weight:600;margin-bottom:8px">Datei nicht gefunden:</p>' + missing.map(fileRow).join("")
    : "";
  const corruptSection = corrupt.length
    ? '<p style="font-size:14px;font-weight:600;margin-top:8px;margin-bottom:8px">Datei besch\u00e4digt:</p>' + corrupt.map(fileRow).join("")
    : "";

  wrap.innerHTML =
    '<div style="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:2000;' +
    'display:flex;align-items:center;justify-content:center;padding:24px">' +
      '<div style="background:var(--md-sys-color-surface-container-high);border-radius:28px;' +
      'max-width:520px;width:100%;box-shadow:0 8px 24px rgba(0,0,0,.18);overflow:hidden">' +
        '<div style="padding:24px 24px 0;font-size:22px;font-weight:500;color:var(--md-sys-color-error)">' +
          '\u26A0 Ladefehler</div>' +
        '<div style="padding:16px 24px;max-height:60vh;overflow-y:auto">' +
          missingSection + corruptSection +
          '<p style="font-size:13px;color:var(--md-sys-color-on-surface-variant);margin-top:12px">' +
          'Beim Fortfahren werden Standardwerte geladen.</p>' +
        '</div>' +
        '<div style="padding:12px 24px 20px;display:flex;justify-content:flex-end">' +
          '<button id="loadErrOk" style="padding:10px 24px;border-radius:50px;border:none;' +
          'background:var(--md-sys-color-primary);color:var(--md-sys-color-on-primary);' +
          'font-size:14px;font-weight:500;font-family:inherit;cursor:pointer">Fortfahren</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  document.body.appendChild(wrap);
  wrap.querySelector("#loadErrOk").addEventListener("click", () => wrap.remove());
}

// ---------------------------------------------------------------------------
// Snackbar
// ---------------------------------------------------------------------------
let _snackbarTimer = null;

export function showSnackbar(message, type = "info") {
  let bar = document.getElementById("snackbar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "snackbar";
    Object.assign(bar.style, {
      position: "fixed", bottom: "calc(var(--bottom-nav-height, 0px) + 16px)",
      left: "50%", transform: "translateX(-50%)",
      padding: "12px 20px", borderRadius: "var(--shape-corner-small)",
      fontSize: "14px", maxWidth: "90vw", textAlign: "center",
      boxShadow: "var(--elevation-2)", zIndex: "9999",
      opacity: "0", transition: "opacity .2s ease", pointerEvents: "none",
    });
    document.body.appendChild(bar);
  }
  bar.style.background = type === "error" ? "var(--md-sys-color-error)"    : "var(--md-sys-color-on-surface)";
  bar.style.color      = type === "error" ? "var(--md-sys-color-on-error)" : "var(--md-sys-color-surface)";
  bar.textContent = message;
  bar.style.opacity = "1";
  clearTimeout(_snackbarTimer);
  _snackbarTimer = setTimeout(() => { bar.style.opacity = "0"; }, 3500);
}

// ---------------------------------------------------------------------------
// Dark mode
// ---------------------------------------------------------------------------
const THEME_KEY = "nr-theme";
function getThemePref() { return localStorage.getItem(THEME_KEY) ?? "system"; }

function applyTheme(pref) {
  const root = document.documentElement;
  if      (pref === "dark")  root.setAttribute("data-theme", "dark");
  else if (pref === "light") root.setAttribute("data-theme", "light");
  else                       root.removeAttribute("data-theme");
  const sysDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark  = pref === "dark" || (pref === "system" && sysDark);
  const icon    = isDark ? "light_mode" : "dark_mode";
  ["themeIcon", "themeIconMobile"].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = icon; });
  const labelEl = document.getElementById("themeLabel");
  if (labelEl) labelEl.textContent = isDark ? "Light Mode" : "Dark Mode";
}

function toggleTheme() {
  const pref    = getThemePref();
  const sysDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark  = pref === "dark" || (pref === "system" && sysDark);
  const next    = isDark ? "light" : "dark";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
}

document.getElementById("themeToggle")?.addEventListener("click", toggleTheme);
document.getElementById("themeToggleMobile")?.addEventListener("click", toggleTheme);
applyTheme(getThemePref());
window.matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", () => { if (getThemePref() === "system") applyTheme("system"); });

// ---------------------------------------------------------------------------
// Skeleton helpers
// ---------------------------------------------------------------------------
export function skeletonCard(lineClasses = ["title", "medium", "short"]) {
  return '<div class="skeleton-card">' +
    lineClasses.map(c => '<div class="skeleton skeleton-line skeleton-line--' + c + '"></div>').join("") +
    '</div>';
}

export function skeletonGrid(n = 3, lineClasses) {
  return '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px">' +
    Array.from({ length: n }, () => skeletonCard(lineClasses)).join("") + '</div>';
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
renderPage(currentPageKey());
checkStartupStatus();
setTimeout(() => {
  import("/static/js/tour.js").then(m => m.checkTour()).catch(() => {});
}, 900);
