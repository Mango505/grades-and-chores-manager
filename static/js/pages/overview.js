/**
 * overview.js – Subject cards with averages, label filter, subject reorder
 */
import { apiFetch, showSnackbar } from "../app.js";
import { card, statChip, gradeBadge, emptyState, errorBanner, openDialog, injectComponentStyles } from "../components.js";

export default async function render(container) {
  injectComponentStyles();
  injectOverviewStyles();
  await loadAndRender(container);
}

async function loadAndRender(container) {
  container.innerHTML = skeletonBanner() + skeletonGrid();

  let overview, subjects;
  try {
    [overview, subjects] = await Promise.all([
      apiFetch("/api/overview"),
      apiFetch("/api/subjects"),
    ]);
  } catch(e) {
    container.innerHTML = errorBanner(e.message);
    return;
  }

  renderShell(container, overview, subjects);
}

function renderShell(container, overview, subjects) {
  const avg    = overview.overall_average;
  const total  = subjects.reduce((n,s) => n + s.grades.length, 0);
  const sorted = [...overview.subjects].sort((a,b) => a.average - b.average);
  const best   = sorted[0];

  container.innerHTML = `
    <!-- Summary banner -->
    <div class="card chip-row ov-banner">
      ${statChip("Gesamtschnitt",    avg != null ? avg.toFixed(2) : "—")}
      <div class="ov-divider"></div>
      ${statChip("Noten gesamt",     total,                              "--md-sys-color-secondary")}
      <div class="ov-divider"></div>
      ${statChip("Bestes Fach",      best ? `${best.name} (${best.average.toFixed(2)})` : "—", "--md-sys-color-tertiary")}
    </div>

    <!-- Toolbar: filter + reorder toggle -->
    <div class="ov-toolbar">
      <md-outlined-text-field id="filterInput" label="Nach Label filtern"
          style="flex:1" placeholder="z.B. Schulaufgabe"></md-outlined-text-field>
      <md-text-button id="filterClear" style="display:none">Zurücksetzen</md-text-button>
      <md-icon-button id="btnReorderToggle" title="Reihenfolge ändern">
        <span class="material-symbols-rounded">swap_vert</span>
      </md-icon-button>
    </div>
    <div id="filterInfo" class="ov-filter-info" style="display:none"></div>

    <!-- Subject grid -->
    <div class="ov-grid" id="subjectGrid">
      ${renderGrid(subjects)}
    </div>

    <!-- Reorder panel (hidden by default) -->
    <div id="reorderPanel" class="card" style="display:none;margin-top:16px">
      <p style="font-size:13px;color:var(--md-sys-color-on-surface-variant);margin-bottom:12px">
        Fächer per ↑ ↓ neu ordnen. Wird sofort gespeichert.
      </p>
      <ul id="reorderList" class="ov-reorder-list">
        ${subjects.map((s,i) => `
          <li class="ov-reorder-item" data-name="${s.name}">
            <span class="material-symbols-rounded" style="color:var(--md-sys-color-on-surface-variant)">drag_indicator</span>
            <span style="flex:1;font-size:14px">${s.name}</span>
            <button class="icon-btn-sm btn-up"   data-index="${i}" ${i===0?"disabled":""}>
              <span class="material-symbols-rounded">arrow_upward</span>
            </button>
            <button class="icon-btn-sm btn-down" data-index="${i}" ${i===subjects.length-1?"disabled":""}>
              <span class="material-symbols-rounded">arrow_downward</span>
            </button>
          </li>`).join("")}
      </ul>
    </div>

    <!-- Add subject -->
    <div style="margin-top:20px">
      <md-filled-tonal-button id="btnAddSubject">
        <span class="material-symbols-rounded" slot="icon">add</span>
        Fach erstellen
      </md-filled-tonal-button>
    </div>`;

  // Collapsible grade lists
  reattachToggleListeners(container);

  // ---- Label filter ----
  const filterInput = container.querySelector("#filterInput");
  const filterClear = container.querySelector("#filterClear");
  const filterInfo  = container.querySelector("#filterInfo");
  const grid        = container.querySelector("#subjectGrid");

  function applyFilter() {
    const term = filterInput.value.trim().toLowerCase();
    filterClear.style.display = term ? "" : "none";
    if (!term) {
      filterInfo.style.display = "none";
      grid.innerHTML = renderGrid(subjects);
      reattachToggleListeners(container);
      return;
    }
    const filtered = subjects.map(s => ({
      ...s,
      grades: s.grades.filter(g => g.labels.some(l => l.toLowerCase().includes(term)))
    })).filter(s => s.grades.length);

    filterInfo.style.display = "";
    filterInfo.textContent   = `${filtered.reduce((a,s)=>a+s.grades.length,0)} Eintrag/Einträge mit Label '${term}' in ${filtered.length} Fach/Fächern`;
    grid.innerHTML = filtered.length
      ? renderGrid(filtered)
      : emptyState("search_off", `Keine Noten mit Label '${term}' gefunden.`);
    reattachToggleListeners(container);
  }

  filterInput.addEventListener("input", applyFilter);
  filterClear.addEventListener("click", () => { filterInput.value = ""; applyFilter(); });

  // ---- Reorder panel toggle ----
  container.querySelector("#btnReorderToggle").addEventListener("click", () => {
    const panel = container.querySelector("#reorderPanel");
    panel.style.display = panel.style.display === "none" ? "" : "none";
  });

  // ---- Reorder up/down ----
  let currentOrder = subjects.map(s => s.name);

  async function saveOrder() {
    try {
      const updated = await apiFetch("/api/subjects/reorder", {
        method: "POST",
        body: JSON.stringify({ order: currentOrder }),
      });
      // Rebuild subjects array in new order from API response
      subjects = updated;
      overview.subjects = updated.map(s => {
        const w = s.grades.reduce((a,g)=>a+g.weight,0);
        return { name:s.name, average: w ? s.grades.reduce((a,g)=>a+g.value*g.weight,0)/w : 0, grade_count:s.grades.length };
      });
      renderShell(container, overview, subjects);
    } catch(e) { showSnackbar(e.message, "error"); }
  }

  container.querySelectorAll(".btn-up").forEach(btn => {
    btn.addEventListener("click", () => {
      const i = parseInt(btn.dataset.index);
      if (i === 0) return;
      [currentOrder[i-1], currentOrder[i]] = [currentOrder[i], currentOrder[i-1]];
      saveOrder();
    });
  });
  container.querySelectorAll(".btn-down").forEach(btn => {
    btn.addEventListener("click", () => {
      const i = parseInt(btn.dataset.index);
      if (i === currentOrder.length-1) return;
      [currentOrder[i], currentOrder[i+1]] = [currentOrder[i+1], currentOrder[i]];
      saveOrder();
    });
  });

  // ---- Add subject dialog ----
  container.querySelector("#btnAddSubject").addEventListener("click", () => {
    const dlg = openDialog("Fach erstellen",
      `<md-outlined-text-field id="dlgSubjectName" label="Fachname" style="width:100%"
           required></md-outlined-text-field>`);
    dlg.addEventListener("close", async () => {
      if (dlg.returnValue !== "confirm") return;
      const name = dlg.querySelector("#dlgSubjectName").value.trim();
      if (!name) return;
      try {
        await apiFetch("/api/subjects", { method:"POST", body:JSON.stringify({name}) });
        showSnackbar(`Fach '${name}' erstellt.`);
        await loadAndRender(container);
      } catch(e) { showSnackbar(e.message, "error"); }
    });
  });
}

// ---- Helpers ----

function renderGrid(subjects) {
  return subjects.length === 0
    ? emptyState("library_books", "Noch keine Fächer vorhanden.")
    : subjects.map(subjectCard).join("");
}

function subjectCard(s) {
  const w   = s.grades.reduce((a,g)=>a+g.weight,0);
  const avg = w ? (s.grades.reduce((a,g)=>a+g.value*g.weight,0)/w).toFixed(2) : "—";
  const rows = s.grades.length
    ? s.grades.map(g=>`
        <div class="grade-row">
          ${gradeBadge(g.value)}
          <span class="grade-row__meta">
            ${g.weight!==1?`<strong>${g.weight}x</strong> `:""}
            ${g.labels.length?g.labels.join(", "):"<em>keine Labels</em>"}
          </span>
        </div>`).join("")
    : `<p style="font-size:13px;color:var(--md-sys-color-on-surface-variant)">Keine Noten eingetragen.</p>`;

  return `
    <div class="ov-card card">
      <div class="ov-card__header">
        <div>
          <div class="ov-card__name">${s.name}</div>
          <div class="ov-card__avg">Ø ${avg}</div>
        </div>
        <button class="ov-card__toggle icon-btn" title="Noten anzeigen">
          <span class="material-symbols-rounded">expand_more</span>
        </button>
      </div>
      <div class="ov-card__body" style="display:none">
        <div class="divider"></div>${rows}
      </div>
    </div>`;
}

function reattachToggleListeners(container) {
  container.querySelectorAll(".ov-card__toggle").forEach(btn => {
    btn.addEventListener("click", () => {
      const body = btn.closest(".ov-card").querySelector(".ov-card__body");
      const open = body.style.display !== "none";
      body.style.display = open ? "none" : "block";
      btn.querySelector(".material-symbols-rounded").textContent = open ? "expand_more" : "expand_less";
    });
  });
}

function skeletonBanner() {
  return `<div class="skeleton" style="height:80px;border-radius:var(--shape-corner-large);margin-bottom:24px"></div>`;
}
function skeletonGrid() {
  const c = `<div class="skeleton skeleton-card"></div>`;
  return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px">${c}${c}${c}</div>`;
}

function injectOverviewStyles() {
  if (document.getElementById("ov-css")) return;
  const s = document.createElement("style"); s.id = "ov-css";
  s.textContent = `
    .ov-banner   { align-items:center;justify-content:space-around;flex-wrap:wrap;gap:16px;margin-bottom:20px; }
    .ov-divider  { width:1px;height:40px;background:var(--md-sys-color-outline-variant); }
    .ov-toolbar  { display:flex;align-items:center;gap:8px;margin-bottom:12px; }
    .ov-filter-info { font-size:13px;color:var(--md-sys-color-on-surface-variant);margin-bottom:12px; }
    .ov-grid     { display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px; }
    .ov-card__header { display:flex;justify-content:space-between;align-items:flex-start; }
    .ov-card__name   { font-size:16px;font-weight:600;color:var(--md-sys-color-on-surface); }
    .ov-card__avg    { font-size:13px;color:var(--md-sys-color-on-surface-variant);margin-top:2px; }
    .ov-card__body   { margin-top:8px; }
    .ov-reorder-list { list-style:none;display:flex;flex-direction:column;gap:4px; }
    .ov-reorder-item { display:flex;align-items:center;gap:8px;padding:8px 4px;
                       border-radius:var(--shape-corner-small);
                       border-bottom:1px solid var(--md-sys-color-outline-variant); }
    .ov-reorder-item:last-child { border-bottom:none; }
    @media(max-width:600px){ .ov-grid{grid-template-columns:1fr;} }
  `;
  document.head.appendChild(s);
}
