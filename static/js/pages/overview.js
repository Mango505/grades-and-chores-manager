/**
 * overview.js
 * Grid view:  toolbar → stats → cards (click to detail)
 * Detail view: back + rename/delete + stats + grade table
 * Label filter: flat list of matching grade rows across all subjects
 */
import { apiFetch, showSnackbar, skeletonGrid, setPrimaryAction, clearPrimaryAction } from "../app.js";
import { gradeBadge, emptyState, errorBanner, statChip, openDialog,
         injectComponentStyles, validateAll, validators } from "../components.js";

let reorderMode   = false;
let detailSubject = null;

export default async function render(container) {
  injectComponentStyles();
  injectStyles();
  if (detailSubject) await renderDetail(container);
  else               await renderGrid(container);
}

// ---------------------------------------------------------------------------
// GRID VIEW
// ---------------------------------------------------------------------------
async function renderGrid(container) {
  container.innerHTML = skeletonGrid(3);

  let overview, subjects;
  try {
    [overview, subjects] = await Promise.all([
      apiFetch("/api/overview"),
      apiFetch("/api/subjects"),
    ]);
  } catch(e) { container.innerHTML = errorBanner(e.message); return; }

  const avg  = overview.overall_average;
  const tot  = subjects.reduce((n, s) => n + s.grades.length, 0);
  const best = [...overview.subjects].sort((a, b) => a.average - b.average)[0];

  if (subjects.length) {
    setPrimaryAction("add", "Note hinzufügen", () => openAddNoteDialog(container, subjects));
  } else {
    clearPrimaryAction();
  }

  container.innerHTML = `
    <!-- Toolbar -->
    <div class="ov-toolbar">
      <div class="ov-toolbar-left">
        <md-outlined-text-field id="filterInput" label="Nach Label filtern"
            style="flex:1;min-width:160px" placeholder="z.B. Schulaufgabe">
        </md-outlined-text-field>
        <md-text-button id="filterClear" style="display:none">Zurücksetzen</md-text-button>
      </div>
      <div class="ov-toolbar-right">
        <md-filled-tonal-button id="btnNewSubject">
          <span class="material-symbols-rounded" slot="icon">add</span>Fach
        </md-filled-tonal-button>
        <md-filled-tonal-button id="btnReorder">
          <span class="material-symbols-rounded" slot="icon">${reorderMode ? "check" : "swap_vert"}</span>
          ${reorderMode ? "Fertig" : "Reihenfolge"}
        </md-filled-tonal-button>
      </div>
    </div>

    <!-- Stats banner -->
    <div class="card stat-banner-grid" style="margin-bottom:16px">
      ${statChip("Gesamtschnitt", avg != null ? avg.toFixed(2) : "—")}
      ${statChip("Noten gesamt",  tot, "--md-sys-color-secondary")}
      ${statChip("Bestes Fach",   best ? best.name + " (" + best.average.toFixed(2) + ")" : "—",
                 "--md-sys-color-tertiary")}
    </div>

    <div id="filterInfo" style="display:none;margin-bottom:10px;font-size:13px;
         color:var(--md-sys-color-on-surface-variant)"></div>
    <div id="subjectGrid">${renderGridContent(subjects)}</div>`;

  bindGridEvents(container, subjects);
}

function renderGridContent(subjects) {
  if (!subjects.length) return emptyState("library_books", "Noch keine Fächer vorhanden.");
  if (reorderMode)      return reorderList(subjects);
  return subjects.map(subjectCard).join("");
}

function subjectCard(s) {
  const w   = s.grades.reduce((a, g) => a + g.weight, 0);
  const avg = w ? (s.grades.reduce((a, g) => a + g.value * g.weight, 0) / w).toFixed(2) : null;
  return `<div class="ov-card card" data-subject="${s.name}">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:16px;font-weight:600">${s.name}</div>
        <div style="font-size:13px;color:var(--md-sys-color-on-surface-variant);margin-top:2px">
          ${avg ? "Ø " + avg : "Keine Noten"} · ${s.grades.length} Einträge
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        ${sparkline(s.grades)}
        <span class="material-symbols-rounded"
              style="color:var(--md-sys-color-on-surface-variant);font-size:20px">chevron_right</span>
      </div>
    </div>
  </div>`;
}

function sparkline(grades) {
  if (grades.length < 2) return "";
  const W = 100, H = 32, P = 3;
  const step = (W - P * 2) / (grades.length - 1);
  const y    = v => P + ((v - 1) / 5) * (H - P * 2);
  const pts  = grades.map((g, i) => `${P + i * step},${y(g.value)}`).join(" ");
  const avg  = grades.reduce((a, g) => a + g.value, 0) / grades.length;
  const stroke = avg <= 2.5 ? "#1b7e4a" : avg <= 4 ? "#a08c00" : "#c43000";
  return `<svg width="${W}" height="${H}" style="flex-shrink:0;opacity:.8" aria-hidden="true">
    <polyline points="${pts}" fill="none" stroke="${stroke}"
              stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${P + (grades.length - 1) * step}" cy="${y(grades.at(-1).value)}" r="3" fill="${stroke}"/>
  </svg>`;
}

function reorderList(subjects) {
  return `<div style="display:flex;flex-direction:column;gap:8px">
    ${subjects.map((s, i) => `
      <div class="card" style="display:flex;align-items:center;padding:14px 16px;gap:8px">
        <span style="flex:1;font-size:15px;font-weight:500">${s.name}</span>
        <button class="icon-btn-sm btn-up"   data-index="${i}" ${i === 0 ? "disabled" : ""}>
          <span class="material-symbols-rounded">arrow_upward</span>
        </button>
        <button class="icon-btn-sm btn-down" data-index="${i}" ${i === subjects.length - 1 ? "disabled" : ""}>
          <span class="material-symbols-rounded">arrow_downward</span>
        </button>
      </div>`).join("")}
  </div>`;
}

// ---------------------------------------------------------------------------
// Label filter
// ---------------------------------------------------------------------------
function renderFilterResults(subjects, term) {
  const matches = [];
  subjects.forEach(s => {
    s.grades.forEach(g => {
      if (g.labels.some(l => l.toLowerCase().includes(term))) {
        matches.push({ subject: s.name, grade: g });
      }
    });
  });
  if (!matches.length) return emptyState("search_off", "Keine Noten mit Label '" + term + "'.");

  const rows = matches.map(({ subject, grade }) => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid var(--md-sys-color-outline-variant);font-size:14px">${subject}</td>
      <td style="padding:8px 10px;border-bottom:1px solid var(--md-sys-color-outline-variant)">${gradeBadge(grade.value)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid var(--md-sys-color-outline-variant);font-size:13px;color:var(--md-sys-color-on-surface-variant)">${grade.weight}×</td>
      <td style="padding:8px 10px;border-bottom:1px solid var(--md-sys-color-outline-variant);font-size:13px;color:var(--md-sys-color-on-surface-variant)">${grade.labels.join(", ")}</td>
    </tr>`).join("");

  return `<div class="card" style="padding:0;overflow:hidden">
    <table style="width:100%;border-collapse:collapse">
      <thead><tr>
        ${["Fach", "Note", "Gew.", "Labels"].map(h =>
          `<th style="text-align:left;padding:8px 10px;font-size:12px;
            color:var(--md-sys-color-on-surface-variant);
            border-bottom:1px solid var(--md-sys-color-outline-variant)">${h}</th>`
        ).join("")}
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

// ---------------------------------------------------------------------------
// Grid event binding
// ---------------------------------------------------------------------------
function bindGridEvents(container, subjects) {
  const grid        = container.querySelector("#subjectGrid");
  const filterInput = container.querySelector("#filterInput");
  const filterClear = container.querySelector("#filterClear");
  const filterInfo  = container.querySelector("#filterInfo");

  // Card click → detail
  grid.addEventListener("click", e => {
    const card  = e.target.closest(".ov-card");
    const arrow = e.target.closest(".btn-up,.btn-down");
    if (card && !arrow && !reorderMode) {
      detailSubject = card.dataset.subject;
      renderDetail(container);
    }
  });

  // Reorder arrows
  grid.addEventListener("click", async e => {
    const btn = e.target.closest(".btn-up,.btn-down");
    if (!btn) return;
    const i = parseInt(btn.dataset.index);
    const j = btn.classList.contains("btn-up") ? i - 1 : i + 1;
    if (j < 0 || j >= subjects.length) return;
    [subjects[i], subjects[j]] = [subjects[j], subjects[i]];
    grid.innerHTML = reorderList(subjects);
    try {
      await apiFetch("/api/subjects/reorder",
        { method: "PUT", body: JSON.stringify({ order: subjects.map(s => s.name) }) });
    } catch(err) { showSnackbar(err.message, "error"); }
  });

  // Filter
  function applyFilter() {
    const term = filterInput.value.trim().toLowerCase();
    filterClear.style.display = term ? "" : "none";
    if (!term) {
      filterInfo.style.display = "none";
      grid.innerHTML = renderGridContent(subjects);
      return;
    }
    const matches = subjects.flatMap(s =>
      s.grades.filter(g => g.labels.some(l => l.toLowerCase().includes(term)))
    );
    filterInfo.style.display = "";
    filterInfo.textContent = matches.length + " Eintrag/Einträge mit Label '" + term + "'";
    grid.innerHTML = renderFilterResults(subjects, term);
  }
  filterInput.addEventListener("input", applyFilter);
  filterClear.addEventListener("click", () => { filterInput.value = ""; applyFilter(); });

  // Reorder toggle
  container.querySelector("#btnReorder").addEventListener("click", () => {
    reorderMode = !reorderMode;
    grid.innerHTML = renderGridContent(subjects);
    const btn = container.querySelector("#btnReorder");
    btn.innerHTML =
      '<span class="material-symbols-rounded" slot="icon">' + (reorderMode ? "check" : "swap_vert") + '</span>' +
      (reorderMode ? "Fertig" : "Reihenfolge");
  });

  // New subject
  container.querySelector("#btnNewSubject").addEventListener("click", () => {
    const dlg = openDialog("Fach erstellen",
      `<md-outlined-text-field id="dlgName" label="Fachname" style="width:100%"></md-outlined-text-field>`);
    dlg.addEventListener("close", async () => {
      if (dlg.returnValue !== "confirm") return;
      const name = dlg.querySelector("#dlgName").value.trim();
      if (!name) return;
      try {
        await apiFetch("/api/subjects", { method: "POST", body: JSON.stringify({ name }) });
        showSnackbar("Fach '" + name + "' erstellt.");
        reorderMode = false;
        await renderGrid(container);
      } catch(e) { showSnackbar(e.message, "error"); }
    });
  });
}

// ---------------------------------------------------------------------------
// Add note from grid (subject selector first)
// ---------------------------------------------------------------------------
async function openAddNoteDialog(container, subjects) {
  const opts = subjects.map(s =>
    `<option value="${s.name}">${s.name}</option>`).join("");

  const dlg = openDialog("Fach auswählen",
    `<div style="display:flex;flex-direction:column;gap:8px">
       <label style="font-size:13px;color:var(--md-sys-color-on-surface-variant)">
         Zu welchem Fach soll die Note hinzugefügt werden?
       </label>
       <select id="dlgSubject" style="padding:10px 12px;border-radius:var(--shape-corner-small);
         border:1px solid var(--md-sys-color-outline);background:var(--md-sys-color-surface);
         color:var(--md-sys-color-on-surface);font-size:14px;font-family:inherit">
         ${opts}
       </select>
     </div>`, "Weiter");

  dlg.addEventListener("close", () => {
    if (dlg.returnValue !== "confirm") return;
    const name    = dlg.querySelector("#dlgSubject").value;
    const subject = subjects.find(s => s.name === name);
    if (!subject) return;
    openGradeDialog(container, subject, null, subjects);
  });
}

// ---------------------------------------------------------------------------
// DETAIL VIEW
// ---------------------------------------------------------------------------
async function renderDetail(container) {
  container.innerHTML = `
    <div class="back-bar">
      <button class="icon-btn" id="btnBack">
        <span class="material-symbols-rounded">arrow_back</span>
      </button>
      <span class="back-bar__title">${detailSubject}</span>
    </div>
    ${skeletonGrid(2, ["title", "medium", "short"])}`;

  container.querySelector("#btnBack").addEventListener("click", () => {
    detailSubject = null;
    clearPrimaryAction();
    renderGrid(container);
  });

  let subjects, rewardConfig;
  try {
    [subjects, rewardConfig] = await Promise.all([
      apiFetch("/api/subjects"),
      apiFetch("/api/reward-config"),
    ]);
  } catch(e) { container.innerHTML += errorBanner(e.message); return; }

  const subject = subjects.find(s => s.name === detailSubject);
  if (!subject) {
    showSnackbar("Fach nicht gefunden.", "error");
    detailSubject = null; clearPrimaryAction();
    return renderGrid(container);
  }

  setPrimaryAction("add", "Note hinzufügen",
    () => openGradeDialog(container, subject, null, subjects, rewardConfig));
  drawDetail(container, subject, subjects, rewardConfig);
}

function drawDetail(container, subject, subjects, rewardConfig) {
  const g   = subject.grades;
  const w   = g.reduce((a, x) => a + x.weight, 0);
  const avg = w ? g.reduce((a, x) => a + x.value * x.weight, 0) / w : null;

  const rows = g.length ? g.map((gr, i) => `
    <tr>
      <td style="padding:10px;border-bottom:1px solid var(--md-sys-color-outline-variant)">${gradeBadge(gr.value)}</td>
      <td style="padding:10px;border-bottom:1px solid var(--md-sys-color-outline-variant);font-size:14px">${gr.weight !== 1 ? "<strong>" + gr.weight + "×</strong>" : "1×"}</td>
      <td style="padding:10px;border-bottom:1px solid var(--md-sys-color-outline-variant);font-size:13px;color:var(--md-sys-color-on-surface-variant);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${gr.labels.join(", ") || "—"}</td>
      <td style="padding:10px;border-bottom:1px solid var(--md-sys-color-outline-variant);white-space:nowrap;text-align:right">
        <button class="icon-btn-sm btn-edit" data-index="${i}">
          <span class="material-symbols-rounded">edit</span>
        </button>
        <button class="icon-btn-sm btn-del" data-index="${i}" style="color:var(--md-sys-color-error)">
          <span class="material-symbols-rounded">delete</span>
        </button>
      </td>
    </tr>`).join("")
  : `<tr><td colspan="4" style="padding:32px;text-align:center;color:var(--md-sys-color-on-surface-variant)">Keine Noten.</td></tr>`;

  container.innerHTML = `
    <div class="back-bar">
      <button class="icon-btn" id="btnBack">
        <span class="material-symbols-rounded">arrow_back</span>
      </button>
      <span class="back-bar__title">${subject.name}</span>
      <div class="back-bar__actions">
        <button class="icon-btn" id="btnRename" title="Umbenennen">
          <span class="material-symbols-rounded">edit</span>
        </button>
        <button class="icon-btn" id="btnDelSubject" title="Löschen"
                style="color:var(--md-sys-color-error)">
          <span class="material-symbols-rounded">delete</span>
        </button>
      </div>
    </div>

    ${avg !== null ? `
    <div class="card stat-banner-grid" style="margin-bottom:16px">
      ${statChip("Durchschnitt", avg.toFixed(2))}
      ${statChip("Einträge", g.length, "--md-sys-color-secondary")}
      ${statChip("Beste Note", Math.min(...g.map(x => x.value)), "--md-sys-color-tertiary")}
    </div>` : ""}

    <div class="card" style="padding:0;overflow:hidden">
      <table class="grade-table" style="width:100%;border-collapse:collapse">
        <thead><tr>
          <th style="text-align:left;padding:8px 10px;font-size:12px;color:var(--md-sys-color-on-surface-variant);border-bottom:1px solid var(--md-sys-color-outline-variant)">Note</th>
          <th style="text-align:left;padding:8px 10px;font-size:12px;color:var(--md-sys-color-on-surface-variant);border-bottom:1px solid var(--md-sys-color-outline-variant)">Gew.</th>
          <th style="text-align:left;padding:8px 10px;font-size:12px;color:var(--md-sys-color-on-surface-variant);border-bottom:1px solid var(--md-sys-color-outline-variant)">Labels</th>
          <th style="border-bottom:1px solid var(--md-sys-color-outline-variant)"></th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  container.querySelector("#btnBack").addEventListener("click", () => {
    detailSubject = null; clearPrimaryAction(); renderGrid(container);
  });

  container.querySelector("#btnRename").addEventListener("click", () => {
    const dlg = openDialog("Fach umbenennen",
      `<md-outlined-text-field id="dlgNewName" label="Neuer Name"
           value="${subject.name}" style="width:100%"></md-outlined-text-field>`);
    dlg.addEventListener("close", async () => {
      if (dlg.returnValue !== "confirm") return;
      const name = dlg.querySelector("#dlgNewName").value.trim();
      if (!name || name === subject.name) return;
      try {
        await apiFetch("/api/subjects", { method: "POST", body: JSON.stringify({ name }) });
        for (const gr of subject.grades)
          await apiFetch(`/api/subjects/${encodeURIComponent(name)}/grades`,
            { method: "POST", body: JSON.stringify({ value: gr.value, weight: gr.weight, labels: gr.labels }) });
        await apiFetch(`/api/subjects/${encodeURIComponent(subject.name)}`, { method: "DELETE" });
        showSnackbar("Umbenannt zu '" + name + "'.");
        detailSubject = name;
        await renderDetail(container);
      } catch(e) { showSnackbar(e.message, "error"); }
    });
  });

  container.querySelector("#btnDelSubject").addEventListener("click", () => {
    const dlg = openDialog("Fach löschen",
      `<p style="font-size:14px">Fach '<strong>${subject.name}</strong>' und alle ${g.length} Noten unwiderruflich löschen?</p>`,
      "Löschen", true);
    dlg.addEventListener("close", async () => {
      if (dlg.returnValue !== "confirm") return;
      try {
        await apiFetch(`/api/subjects/${encodeURIComponent(subject.name)}`, { method: "DELETE" });
        showSnackbar("'" + subject.name + "' gelöscht.");
        detailSubject = null; clearPrimaryAction();
        await renderGrid(container);
      } catch(e) { showSnackbar(e.message, "error"); }
    });
  });

  container.querySelectorAll(".btn-edit").forEach(btn => {
    btn.addEventListener("click", () =>
      openGradeDialog(container, subject, parseInt(btn.dataset.index), subjects, rewardConfig));
  });

  container.querySelectorAll(".btn-del").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.index);
      const gr  = subject.grades[idx];
      const dlg = openDialog("Note löschen",
        `<p style="font-size:14px">Note <strong>${gr.value}</strong> (${gr.weight}×) löschen?</p>`,
        "Löschen", true);
      dlg.addEventListener("close", async () => {
        if (dlg.returnValue !== "confirm") return;
        try {
          await apiFetch(
            `/api/subjects/${encodeURIComponent(subject.name)}/grades/${idx}?adjust_wallet=1`,
            { method: "DELETE" });
          showSnackbar("Note gelöscht.");
          await refreshDetail(container, subject.name, rewardConfig);
        } catch(e) { showSnackbar(e.message, "error"); }
      });
    });
  });
}

async function refreshDetail(container, name, rewardConfig) {
  const subjects = await apiFetch("/api/subjects");
  const subject  = subjects.find(s => s.name === name);
  if (!subject) { detailSubject = null; clearPrimaryAction(); return renderGrid(container); }
  drawDetail(container, subject, subjects, rewardConfig);
}

// ---------------------------------------------------------------------------
// Grade add/edit dialog
// ---------------------------------------------------------------------------
function openGradeDialog(container, subject, editIndex, subjects, rewardConfig) {
  const gr = editIndex !== null ? subject.grades[editIndex] : null;
  const dlg = openDialog(
    gr ? "Note bearbeiten" : "Note hinzufügen",
    `<md-outlined-text-field id="dlgVal" label="Note (1–6)" type="number"
         min="1" max="6" step="0.5" value="${gr?.value ?? ""}" style="width:100%">
     </md-outlined-text-field>
     <md-outlined-text-field id="dlgWt" label="Gewichtung" type="number"
         min="0.5" step="0.5" value="${gr?.weight ?? 1}" style="width:100%">
     </md-outlined-text-field>
     <md-outlined-text-field id="dlgLbl" label="Labels (Komma getrennt)"
         value="${gr?.labels?.join(", ") ?? ""}" style="width:100%">
     </md-outlined-text-field>`,
    gr ? "Speichern" : "Hinzufügen");

  dlg.addEventListener("close", async () => {
    if (dlg.returnValue !== "confirm") return;
    const fVal = dlg.querySelector("#dlgVal");
    const fWt  = dlg.querySelector("#dlgWt");
    if (!validateAll([[fVal, validators.gradeValue], [fWt, validators.positiveNumber]])) return;
    const value  = parseFloat(fVal.value);
    const weight = parseFloat(fWt.value) || 1;
    const raw    = dlg.querySelector("#dlgLbl").value.trim();
    const labels = raw ? raw.split(",").map(l => l.trim()).filter(Boolean) : [];
    const url    = editIndex !== null
      ? `/api/subjects/${encodeURIComponent(subject.name)}/grades/${editIndex}`
      : `/api/subjects/${encodeURIComponent(subject.name)}/grades`;
    try {
      await apiFetch(url, { method: editIndex !== null ? "PUT" : "POST",
        body: JSON.stringify({ value, weight, labels }) });
      showSnackbar(editIndex !== null ? "Note aktualisiert." : "Note hinzugefügt.");
      await refreshDetail(container, subject.name, rewardConfig);
    } catch(e) { showSnackbar(e.message, "error"); }
  });
}

function injectStyles() {
  if (document.getElementById("ov-css")) return;
  const s = document.createElement("style"); s.id = "ov-css";
  s.textContent = `
    .ov-card.card { cursor:pointer; transition:background .15s; }
    .ov-card.card:hover { background:var(--md-sys-color-surface-container); }
    @media(max-width:600px){
      .ov-toolbar-right { width:100%; }
      .ov-toolbar-right md-filled-tonal-button { flex:1; }
    }
  `;
  document.head.appendChild(s);
}
