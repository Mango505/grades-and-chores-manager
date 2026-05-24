/**
 * overview.js – Subject cards + label filter + reorder mode + skeleton loading
 */
import { apiFetch, showSnackbar, skeletonGrid } from "../app.js";
import { card, statChip, gradeBadge, emptyState, errorBanner, openDialog, injectComponentStyles } from "../components.js";

let reorderMode = false;

export default async function render(container) {
  injectComponentStyles();
  injectOverviewStyles();

  // Show skeleton immediately while fetching
  container.innerHTML = `
    <div style="margin-bottom:24px">${skeletonGrid(1, ["title","short"])}</div>
    ${skeletonGrid(3)}`;

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
  const total  = subjects.reduce((n, s) => n + s.grades.length, 0);
  const sorted = [...overview.subjects].sort((a, b) => a.average - b.average);
  const best   = sorted[0];

  container.innerHTML = `
    <!-- Summary banner -->
    <div class="ov-banner card chip-row" style="margin-bottom:24px">
      ${statChip("Gesamtschnitt",    avg != null ? avg.toFixed(2) : "—")}
      <div class="divider" style="width:1px;height:40px;margin:0"></div>
      ${statChip("Noten gesamt",     total,                           "--md-sys-color-secondary")}
      <div class="divider" style="width:1px;height:40px;margin:0"></div>
      ${statChip("Bestes Fach",      best ? `${best.name} (${best.average.toFixed(2)})` : "—", "--md-sys-color-tertiary")}
    </div>

    <!-- Toolbar: filter + reorder toggle -->
    <div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:16px;flex-wrap:wrap">
      <md-outlined-text-field id="filterInput" label="Nach Label filtern"
          style="flex:1;min-width:180px" placeholder="z.B. Schulaufgabe">
      </md-outlined-text-field>
      <md-text-button id="filterClear" style="display:none;align-self:center">Zurücksetzen</md-text-button>
      <md-filled-tonal-button id="btnReorder" style="align-self:center">
        <span class="material-symbols-rounded" slot="icon">swap_vert</span>
        ${reorderMode ? "Fertig" : "Reihenfolge"}
      </md-filled-tonal-button>
    </div>

    <div id="filterInfo" style="display:none;margin-bottom:12px;font-size:13px;
         color:var(--md-sys-color-on-surface-variant)"></div>

    <!-- Subject grid / reorder list -->
    <div class="ov-grid" id="subjectGrid">
      ${renderGrid(subjects, subjects)}
    </div>

    <!-- Add subject -->
    <div style="margin-top:24px">
      <md-filled-tonal-button id="btnAddSubject">
        <span class="material-symbols-rounded" slot="icon">add</span>
        Fach erstellen
      </md-filled-tonal-button>
    </div>`;

  bindEvents(container, overview, subjects);
}

function renderGrid(subjects, allSubjects) {
  if (!subjects.length)
    return emptyState("library_books", "Noch keine Fächer vorhanden.");
  if (reorderMode)
    return reorderList(subjects);
  return subjects.map(s => subjectCard(s)).join("");
}

// ---- Reorder list (vertical, with up/down arrows) ----
function reorderList(subjects) {
  return `<div class="ov-reorder-list">
    ${subjects.map((s, i) => `
      <div class="ov-reorder-item card">
        <span style="flex:1;font-size:15px;font-weight:500">${s.name}</span>
        <span style="font-size:12px;color:var(--md-sys-color-on-surface-variant);margin-right:8px">Ø ${s.grades.length ? (s.grades.reduce((a,g)=>a+g.value*g.weight,0)/s.grades.reduce((a,g)=>a+g.weight,0)).toFixed(2) : "—"}</span>
        <button class="icon-btn-sm btn-up"   data-index="${i}" ${i===0?"disabled":""} title="Nach oben">
          <span class="material-symbols-rounded">arrow_upward</span>
        </button>
        <button class="icon-btn-sm btn-down" data-index="${i}" ${i===subjects.length-1?"disabled":""} title="Nach unten">
          <span class="material-symbols-rounded">arrow_downward</span>
        </button>
      </div>`).join("")}
  </div>`;
}

// ---- Sparkline SVG (grade trend, 120×36px) ----
function sparkline(grades) {
  if (grades.length < 2) return "";
  const W = 120, H = 36, PAD = 3;
  const vals = grades.map(g => g.value);
  const step = (W - PAD * 2) / (vals.length - 1);
  // Grade 1 = top (low y), grade 6 = bottom (high y)
  const y = v => PAD + ((v - 1) / 5) * (H - PAD * 2);
  const points = vals.map((v, i) => `${PAD + i * step},${y(v)}`).join(" ");
  // Colour: avg ≤ 2.5 green, ≤ 4 amber, else red
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const stroke = avg <= 2.5 ? "#1b7e4a" : avg <= 4 ? "#a08c00" : "#c43000";
  return `<svg width="${W}" height="${H}" style="flex-shrink:0;opacity:.85" aria-hidden="true">
    <polyline points="${points}" fill="none" stroke="${stroke}"
              stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${PAD + (vals.length-1)*step}" cy="${y(vals.at(-1))}" r="3" fill="${stroke}"/>
  </svg>`;
}


// ---- Subject card ----
function subjectCard(s) {
  const avg = s.grades.length
    ? (s.grades.reduce((a,g)=>a+g.value*g.weight,0)/s.grades.reduce((a,g)=>a+g.weight,0)).toFixed(2)
    : "—";
  const rows = s.grades.length
    ? s.grades.map(g => `
        <div class="grade-row">
          ${gradeBadge(g.value)}
          <span class="grade-row__meta">
            ${g.weight !== 1 ? `<strong>${g.weight}x</strong> ` : ""}
            ${g.labels.length ? g.labels.join(", ") : "<em>keine Labels</em>"}
          </span>
        </div>`).join("")
    : `<p style="font-size:13px;color:var(--md-sys-color-on-surface-variant)">Keine Noten.</p>`;

  return `
    <div class="ov-card card">
      <div class="ov-card__header">
        <div>
          <div class="ov-card__name">${s.name}</div>
          <div class="ov-card__avg">Ø ${avg}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          ${sparkline(s.grades)}
          <button class="ov-card__toggle icon-btn" title="Noten anzeigen">
            <span class="material-symbols-rounded">expand_more</span>
          </button>
        </div>
      </div>
      <div class="ov-card__body" style="display:none">
        <div class="divider"></div>${rows}
      </div>
    </div>`;
}

// ---- Event binding ----
function bindEvents(container, overview, subjects) {
  const grid       = container.querySelector("#subjectGrid");
  const filterInput = container.querySelector("#filterInput");
  const filterClear = container.querySelector("#filterClear");
  const filterInfo  = container.querySelector("#filterInfo");

  // Collapsible toggle (delegated)
  grid.addEventListener("click", e => {
    const toggle = e.target.closest(".ov-card__toggle");
    if (!toggle) return;
    const body = toggle.closest(".ov-card").querySelector(".ov-card__body");
    const open = body.style.display !== "none";
    body.style.display = open ? "none" : "block";
    toggle.querySelector(".material-symbols-rounded").textContent = open ? "expand_more" : "expand_less";
  });

  // Reorder up/down (delegated)
  grid.addEventListener("click", async e => {
    const btn = e.target.closest(".btn-up, .btn-down");
    if (!btn) return;
    const i = parseInt(btn.dataset.index);
    const j = btn.classList.contains("btn-up") ? i - 1 : i + 1;
    if (j < 0 || j >= subjects.length) return;
    [subjects[i], subjects[j]] = [subjects[j], subjects[i]];
    grid.innerHTML = reorderList(subjects);

    try {
      await apiFetch("/api/subjects/reorder", {
        method: "PUT",
        body: JSON.stringify({ order: subjects.map(s => s.name) }),
      });
    } catch(err) { showSnackbar(err.message, "error"); }
  });

  // Label filter
  function applyFilter() {
    const term = filterInput.value.trim().toLowerCase();
    filterClear.style.display = term ? "" : "none";
    if (!term) {
      filterInfo.style.display = "none";
      grid.innerHTML = renderGrid(subjects, subjects);
      return;
    }
    const filtered = subjects.map(s => ({
      ...s,
      grades: s.grades.filter(g => g.labels.some(l => l.toLowerCase().includes(term)))
    })).filter(s => s.grades.length);

    const total = filtered.reduce((a,s)=>a+s.grades.length, 0);
    filterInfo.style.display = "";
    filterInfo.textContent = `${total} Eintrag/Einträge mit Label '${term}' in ${filtered.length} Fach/Fächern`;
    grid.innerHTML = filtered.length
      ? filtered.map(subjectCard).join("")
      : emptyState("search_off", `Keine Noten mit Label '${term}'.`);
  }

  filterInput.addEventListener("input", applyFilter);
  filterClear.addEventListener("click", () => { filterInput.value = ""; applyFilter(); });

  // Reorder mode toggle
  container.querySelector("#btnReorder").addEventListener("click", () => {
    reorderMode = !reorderMode;
    grid.innerHTML = renderGrid(subjects, subjects);
    container.querySelector("#btnReorder").innerHTML =
      `<span class="material-symbols-rounded" slot="icon">${reorderMode ? "check" : "swap_vert"}</span>
       ${reorderMode ? "Fertig" : "Reihenfolge"}`;
  });

  // Add subject
  container.querySelector("#btnAddSubject").addEventListener("click", () => {
    const dlg = openDialog("Fach erstellen",
      `<md-outlined-text-field id="dlgName" label="Fachname" style="width:100%"></md-outlined-text-field>`
    );
    dlg.addEventListener("close", async () => {
      if (dlg.returnValue !== "confirm") return;
      const name = dlg.querySelector("#dlgName").value.trim();
      if (!name) return;
      try {
        await apiFetch("/api/subjects", { method:"POST", body: JSON.stringify({ name }) });
        showSnackbar(`Fach '${name}' erstellt.`);
        reorderMode = false;
        const [ov, subs] = await Promise.all([apiFetch("/api/overview"), apiFetch("/api/subjects")]);
        renderShell(container, ov, subs);
      } catch(e) { showSnackbar(e.message, "error"); }
    });
  });
}

function injectOverviewStyles() {
  if (document.getElementById("ov-css")) return;
  const s = document.createElement("style"); s.id = "ov-css";
  s.textContent = `
    .ov-banner  { align-items:center;justify-content:space-around;flex-wrap:wrap;gap:16px; }
    .ov-grid    { display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px; }
    .ov-card__header { display:flex;justify-content:space-between;align-items:flex-start; }
    .ov-card__name   { font-size:16px;font-weight:600; }
    .ov-card__avg    { font-size:13px;color:var(--md-sys-color-on-surface-variant);margin-top:2px; }
    .ov-card__body   { margin-top:8px; }
    .ov-reorder-list { display:flex;flex-direction:column;gap:8px; }
    .ov-reorder-item { display:flex;align-items:center;padding:14px 16px; }
    .icon-btn-sm[disabled] { opacity:.3;pointer-events:none; }
    @media(max-width:600px){ .ov-grid{grid-template-columns:1fr;} }
  `;
  document.head.appendChild(s);
}
