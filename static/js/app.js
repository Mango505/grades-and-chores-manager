/**
 * app.js – Shell: router, dark mode, FAB, snackbar, skeletons
 */

// ---------------------------------------------------------------------------
// Page registry
// ---------------------------------------------------------------------------
const PAGES = {
  overview: { title: "Übersicht",     loader: () => import("/static/js/pages/overview.js") },
  wallet:   { title: "Konto",         loader: () => import("/static/js/pages/wallet.js")   },
  stats:    { title: "Statistiken",   loader: () => import("/static/js/pages/stats.js")    },
  settings: { title: "Einstellungen", loader: () => import("/static/js/pages/settings.js") },
};
const DEFAULT_PAGE = "overview";

// ---------------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------------
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

function navigateTo(key) {
  if (!(key in PAGES)) key = DEFAULT_PAGE;
  history.pushState(null, "", `#${key}`);
  renderPage(key);
}

async function renderPage(key) {
  const page = PAGES[key];
  if (!page) return;

  clearPrimaryAction();
  updateActiveNav(key);
  if (pageTitle) pageTitle.textContent = page.title;

  pageContainer.innerHTML = `
    <div class="page-placeholder">
      <span class="material-symbols-rounded page-placeholder__icon">hourglass_top</span>
      <p>Lade…</p>
    </div>`;

  try {
    const mod = await page.loader();
    if (typeof mod.default === "function") {
      pageContainer.innerHTML = "";
      await mod.default(pageContainer);
    }
  } catch (err) {
    console.error(`Page '${key}' failed:`, err);
    pageContainer.innerHTML = `
      <div class="page-placeholder">
        <span class="material-symbols-rounded page-placeholder__icon"
              style="color:var(--md-sys-color-error)">error</span>
        <p style="font-size:13px;color:var(--md-sys-color-on-surface-variant)">${err.message}</p>
      </div>`;
  }
}

function updateActiveNav(key) {
  allNavItems.forEach(item => {
    const active = item.dataset.page === key;
    item.classList.toggle("nav-item--active",        active && !!item.closest(".nav-drawer"));
    item.classList.toggle("bottom-nav__item--active", active && !!item.closest(".bottom-nav"));
  });
}

// ---------------------------------------------------------------------------
// Drawer (mobile only)
// ---------------------------------------------------------------------------
function openDrawer() {
  navDrawer.classList.add("open");
  drawerBackdrop.classList.add("visible");
}
function closeDrawer() {
  navDrawer.classList.remove("open");
  drawerBackdrop.classList.remove("visible");
}

drawerBackdrop?.addEventListener("click", closeDrawer);
document.addEventListener("keydown", e => { if (e.key === "Escape") closeDrawer(); });

// Nav clicks (both drawer + bottom bar)
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

/**
 * Set the primary action for the current page.
 * Updates both the desktop extended FAB (nav drawer) and the mobile floating FAB.
 * @param {string} icon   Material Symbol name, e.g. "add"
 * @param {string} label  Text for desktop extended FAB
 * @param {() => void} callback  Called when either FAB is clicked
 */
export function setPrimaryAction(icon, label, callback) {
  _fabCallback = callback;

  const iconEl  = document.getElementById("navFabIcon");
  const labelEl = document.getElementById("navFabLabel");
  const mobIcon = document.getElementById("mobFabIcon");

  if (iconEl)  iconEl.textContent  = icon;
  if (labelEl) labelEl.textContent = label;
  if (mobIcon) mobIcon.textContent = icon;

  navFab?.removeAttribute("hidden");
  mobFab?.removeAttribute("hidden");
}

export function clearPrimaryAction() {
  _fabCallback = null;
  navFab?.setAttribute("hidden", "");
  mobFab?.setAttribute("hidden", "");
}

function _onFabClick() { _fabCallback?.(); }
navFab?.addEventListener("click", _onFabClick);
mobFab?.addEventListener("click", _onFabClick);

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
  if (!res.ok) throw new Error(body?.description ?? body?.error ?? `HTTP ${res.status}`);
  return body;
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
      position:   "fixed",
      bottom:     "calc(var(--bottom-nav-height, 0px) + 16px)",
      left:       "50%",
      transform:  "translateX(-50%) translateY(80px)",
      padding:    "12px 20px",
      borderRadius: "var(--shape-corner-small)",
      fontSize:   "14px",
      maxWidth:   "90vw",
      textAlign:  "center",
      boxShadow:  "var(--elevation-2)",
      zIndex:     "9999",
      transition: "transform .25s cubic-bezier(0.2,0,0,1)",
      pointerEvents: "none",
    });
    document.body.appendChild(bar);
  }

  bar.style.background = type === "error"
    ? "var(--md-sys-color-error)"    : "var(--md-sys-color-on-surface)";
  bar.style.color = type === "error"
    ? "var(--md-sys-color-on-error)" : "var(--md-sys-color-surface)";
  bar.textContent = message;

  // Slide in
  requestAnimationFrame(() => {
    bar.style.transform = "translateX(-50%) translateY(0)";
  });

  // Auto-hide after 3.5 s
  clearTimeout(_snackbarTimer);
  _snackbarTimer = setTimeout(() => {
    bar.style.transform = "translateX(-50%) translateY(80px)";
  }, 3500);
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

  const icon  = isDark ? "light_mode" : "dark_mode";
  const label = isDark ? "Light Mode" : "Dark Mode";

  const els = ["themeIcon", "themeIconMobile"].map(id => document.getElementById(id));
  els.forEach(el => { if (el) el.textContent = icon; });
  const labelEl = document.getElementById("themeLabel");
  if (labelEl) labelEl.textContent = label;
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

// Apply saved pref on load + react to system changes
applyTheme(getThemePref());
window.matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", () => {
    if (getThemePref() === "system") applyTheme("system");
  });

// ---------------------------------------------------------------------------
// Skeleton helpers
// ---------------------------------------------------------------------------
export function skeletonCard(lineClasses = ["title", "medium", "short"]) {
  return `<div class="skeleton-card">
    ${lineClasses.map(c =>
      `<div class="skeleton skeleton-line skeleton-line--${c}"></div>`
    ).join("")}
  </div>`;
}

export function skeletonGrid(n = 3, lineClasses) {
  return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px">
    ${Array.from({ length: n }, () => skeletonCard(lineClasses)).join("")}
  </div>`;
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
renderPage(currentPageKey());
