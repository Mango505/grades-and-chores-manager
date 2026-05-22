/**
 * app.js – Navigation shell & client-side router
 *
 * Responsibilities:
 *  - Hash-based routing (#overview, #grades, …)
 *  - Mobile drawer open/close + backdrop
 *  - Active state sync between drawer items and bottom nav items
 *  - Lazy page loading: each page module exports { title, render(container) }
 */

// ---------------------------------------------------------------------------
// Page registry – maps hash → { title, loader }
// loader() returns a Promise that resolves to a page module
// ---------------------------------------------------------------------------
const PAGES = {
  overview: {
    title: "Übersicht",
    loader: () => import("/static/js/pages/overview.js"),
  },
  grades: {
    title: "Noten",
    loader: () => import("/static/js/pages/grades.js"),
  },
  wallet: {
    title: "Konto",
    loader: () => import("/static/js/pages/wallet.js"),
  },
  stats: {
    title: "Statistiken",
    loader: () => import("/static/js/pages/stats.js"),
  },
  settings: {
    title: "Einstellungen",
    loader: () => import("/static/js/pages/settings.js"),
  },
};

const DEFAULT_PAGE = "overview";

// ---------------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------------
const navDrawer      = document.getElementById("navDrawer");
const drawerToggle   = document.getElementById("drawerToggle");
const drawerBackdrop = document.getElementById("drawerBackdrop");
const pageContainer  = document.getElementById("pageContainer");
const pageTitle      = document.getElementById("pageTitle");

// All nav links (drawer + bottom bar)
const allNavItems = document.querySelectorAll("[data-page]");

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

/** Return the current page key from the URL hash, falling back to default. */
function currentPageKey() {
  const hash = location.hash.replace("#", "").trim();
  return hash in PAGES ? hash : DEFAULT_PAGE;
}

/** Navigate to a page by key, updating the URL hash. */
function navigateTo(key) {
  if (!(key in PAGES)) key = DEFAULT_PAGE;
  history.pushState(null, "", `#${key}`);
  renderPage(key);
}

/** Render the page identified by key into pageContainer. */
async function renderPage(key) {
  const page = PAGES[key];
  if (!page) return;

  // Update active styles
  updateActiveNav(key);

  // Update top app bar title
  if (pageTitle) pageTitle.textContent = page.title;

  // Show loading state
  pageContainer.innerHTML = `
    <div class="page-placeholder">
      <span class="material-symbols-rounded page-placeholder__icon">hourglass_top</span>
      <p>Lade…</p>
    </div>`;

  try {
    const module = await page.loader();
    // Each page module must export a default render(container) function
    if (typeof module.default === "function") {
      pageContainer.innerHTML = "";
      await module.default(pageContainer);
    } else {
      throw new Error(`Page module '${key}' has no default export.`);
    }
  } catch (err) {
    console.error(`Failed to load page '${key}':`, err);
    pageContainer.innerHTML = `
      <div class="page-placeholder">
        <span class="material-symbols-rounded page-placeholder__icon" style="color:var(--md-sys-color-error)">error</span>
        <p>Seite konnte nicht geladen werden.</p>
      </div>`;
  }
}

/** Sync the --active CSS class across all nav items for the given page key. */
function updateActiveNav(key) {
  allNavItems.forEach((item) => {
    const isActive = item.dataset.page === key;
    item.classList.toggle("nav-item--active", isActive && item.closest(".nav-drawer") !== null);
    item.classList.toggle("bottom-nav__item--active", isActive && item.closest(".bottom-nav") !== null);
  });
}

// ---------------------------------------------------------------------------
// Mobile drawer
// ---------------------------------------------------------------------------

function openDrawer() {
  navDrawer.classList.add("open");
  drawerBackdrop.classList.add("visible");
  document.body.style.overflow = "hidden"; // prevent background scroll
}

function closeDrawer() {
  navDrawer.classList.remove("open");
  drawerBackdrop.classList.remove("visible");
  document.body.style.overflow = "";
}

drawerToggle?.addEventListener("click", () => {
  navDrawer.classList.contains("open") ? closeDrawer() : openDrawer();
});

drawerBackdrop?.addEventListener("click", closeDrawer);

// Close drawer on Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDrawer();
});

// ---------------------------------------------------------------------------
// Nav link clicks
// ---------------------------------------------------------------------------
allNavItems.forEach((item) => {
  item.addEventListener("click", (e) => {
    e.preventDefault();
    const key = item.dataset.page;
    closeDrawer();
    navigateTo(key);
  });
});

// ---------------------------------------------------------------------------
// Browser back/forward
// ---------------------------------------------------------------------------
window.addEventListener("popstate", () => {
  renderPage(currentPageKey());
});

// ---------------------------------------------------------------------------
// API helper – shared by all page modules
// ---------------------------------------------------------------------------

/**
 * Thin fetch wrapper that always parses JSON and throws on non-2xx responses.
 * @param {string} url
 * @param {RequestInit} [options]
 * @returns {Promise<any>} parsed JSON body, or undefined for 204
 */
export async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
    ...options,
  });

  if (res.status === 204) return undefined;

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message = body?.description ?? body?.error ?? `HTTP ${res.status}`;
    throw new Error(message);
  }

  return body;
}

/**
 * Show a transient snackbar notification (M3-style toast).
 * @param {string} message
 * @param {"info"|"error"} [type]
 */
export function showSnackbar(message, type = "info") {
  let bar = document.getElementById("snackbar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "snackbar";
    bar.style.cssText = `
      position:fixed; bottom:calc(var(--bottom-nav-height, 0px) + 16px); left:50%;
      transform:translateX(-50%) translateY(80px);
      background:var(--md-sys-color-on-surface); color:var(--md-sys-color-surface);
      padding:12px 20px; border-radius:var(--shape-corner-small);
      font:var(--typescale-body-medium); max-width:90vw; text-align:center;
      box-shadow:var(--elevation-2); z-index:9999;
      transition:transform .25s cubic-bezier(0.2,0,0,1);
      pointer-events:none;
    `;
    document.body.appendChild(bar);
  }

  if (type === "error") {
    bar.style.background = "var(--md-sys-color-error)";
    bar.style.color       = "var(--md-sys-color-on-error)";
  } else {
    bar.style.background = "var(--md-sys-color-on-surface)";
    bar.style.color       = "var(--md-sys-color-surface)";
  }

  bar.textContent = message;
  // Slide up
  requestAnimationFrame(() => {
    bar.style.transform = "translateX(-50%) translateY(0)";
  });

  clearTimeout(bar._timeout);
  bar._timeout = setTimeout(() => {
    bar.style.transform = "translateX(-50%) translateY(80px)";
  }, 3500);
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
renderPage(currentPageKey());
