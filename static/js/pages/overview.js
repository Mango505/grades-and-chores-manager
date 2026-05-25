/**
 * overview.js – Subject grid + subject detail view (replaces separate Noten page)
 *
 * Two states (module-level):
 *   detailSubject = null  → grid view
 *   detailSubject = "..." → detail view for that subject
 */
import { apiFetch, showSnackbar, skeletonGrid, setPrimaryAction, clearPrimaryAction } from "../app.js";
import { gradeBadge, emptyState, errorBanner, statChip, openDialog,
         injectComponentStyles, validateAll, validators } from "../components.js";

let reorderMode   = false;
let detailSubject = null; // name string | null

export default async function render(container) {
  injectComponentStyles();
  injectStyles();
  if (detailSubject) {
    await renderDetail(container);
  } else {
    await renderGrid(container);
  }
}

// ===========================================================================
// GRID VIEW
// ===========================================================================
async function renderGrid(container) {
  clearPrimaryAction();
  container.innerHTML = skeletonGrid(3);

  let overview, subjects;
  try {
    [overview, subjects] = await Promise.all([
      apiFetch("/api/overview"),
      apiFetch("/api/subjects"),
    ]);
  } catch(e) { container.innerHTML = errorBanner(e.message); return; }

  const avg   = overview.overall_average;
  const total = subjects.reduce((n, s) => n + s.grades.length, 0);
  const best  = [...overview.subjects].sort((a,b) => a.average - b.average)[0];

  container.innerHTML = `
    <!-- Summary -->
    <div class="card" style="display:flex;flex-wrap:wrap;gap:16px;
         justify-content:space-around;margin-bottom:20px;align-items:center">
      ${statChip("Gesamtschnitt", avg != null ? avg.toFixed(2) : "—")}
      <div style="width:1px;height:36px;background:var(--md-sys-color-outline-variant)"></div>
      ${statChip("Noten gesamt",  total, "--md-sys-color-secondary")}
      <div style="width:1px;height:36px;background:var(--md-sys-color-outline-variant)"></div>
      ${statChip("Bestes Fach",   best ? `${best.name} (${best.average.toFixed(2)})` : "—",
                 "--md-sys-color-tertiary")}
    </div>

    <!-- Toolbar -->
    <div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:16px;flex-wrap:wrap">
      <md-outlined-text-field id="filterInput" label="Nach Label filtern"
          style="flex:1;min-width:180px" placeholder="z.B. Schulaufgabe">
      </md-outlined-text-field>
      <md-text-button id="filterClear" style="display:none;align-self:center">Zurücksetzen</md-text-button>
      <md-filled-tonal-button id="btnNewSubject" style="align-self:center">
        <span class="material-symbols-rounded" slot="icon">add</span> Fach erstellen
      </md-filled-tonal-button>
      <md-filled-tonal-button id="btnReorder" style="align-self:center">
        <span class="material-symbols-rounded" slot="icon">swap_vert</span>
        ${reorderMode ? "Fertig" : "Reihenfolge"}
      </md-filled-tonal-button>
    </div>

    <div id="filterInfo" style="display:none;margin-bottom:12px;font-size:13px;
         color:var(--md-sys-color-on-surface-variant)"></div>

    <div id="subjectGrid">${renderGridContent(subjects)}</div>`;

  bindGridEvents(container, subjects);
}

function renderGridContent(subjects) {
  if (!subjects.length) return emptyState("library_books", "Noch keine Fächer vorhanden.");
  if (reorderMode)      return reorderList(subjects);
  return subjects.map(s => subjectCard(s)).join("");
}

function subjectCard(s) {
  const avg = s.grades.length
    ? (s.grades.reduce((a,g)=>a+g.value*g.weight,0) /
       s.grades.reduce((a,g)=>a+g.weight,0)).toFixed(2) : null;

  const spark = sparkline(s.grades);

  return `<div class="ov-card card" data-subject="${s.name}" style="cursor:pointer">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:16px;font-weight:600">${s.name}</div>
        <div style="font-size:13px;color:var(--md-sys-color-on-surface-variant);margin-top:2px">
          ${avg ? `Ø ${avg}` : "Keine Noten"} · ${s.grades.length} Einträge
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        ${spark}
        <span class="material-symbols-rounded"
              style="color:var(--md-sys-color-on-surface-variant);font-size:20px">chevron_right</span>
      </div>
    </div>
  </div>`;
}

function sparkline(grades) {
  if (grades.length < 2) return "";
  const W=100, H=32, P=3;
  const step = (W-P*2)/(grades.length-1);
  const y = v => P + ((v-1)/5)*(H-P*2);
  const pts = grades.map((g,i) => `${P+i*step},${y(g.value)}`).join(" ");
  const avg = grades.reduce((a,g)=>a+g.value,0)/grades.length;
  const stroke = avg<=2.5?"#1b7e4a":avg<=4?"#a08c00":"#c43000";
  return `<svg width="${W}" height="${H}" style="flex-shrink:0;opacity:.8" aria-hidden="true">
    <polyline points="${pts}" fill="none" stroke="${stroke}"
              stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${P+(grades.length-1)*step}" cy="${y(grades.at(-1).value)}" r="3" fill="${stroke}"/>
  </svg>`;
}

function reorderList(subjects) {
  return `<div style="display:flex;flex-direction:column;gap:8px">
    ${subjects.map((s,i) => `
      <div class="card" style="display:flex;align-items:center;padding:14px 16px;gap:8px">
        <span style="flex:1;font-size:15px;font-weight:500">${s.name}</span>
        <button class="icon-btn-sm btn-up"   data-index="${i}" ${i===0?"disabled":""}>
          <span class="material-symbols-rounded">arrow_upward</span>
        </button>
        <button class="icon-btn-sm btn-down" data-index="${i}" ${i===subjects.length-1?"disabled":""}>
          <span class="material-symbols-rounded">arrow_downward</span>
        </button>
      </div>`).join("")}
  </div>`;
}

function bindGridEvents(container, subjects) {
  const grid       = container.querySelector("#subjectGrid");
  const filterInput = container.querySelector("#filterInput");
  const filterClear = container.querySelector("#filterClear");
  const filterInfo  = container.querySelector("#filterInfo");

  // Subject card click → detail
  grid.addEventListener("click", e => {
    const card = e.target.closest(".ov-card");
    const upBtn = e.target.closest(".btn-up, .btn-down");
    if (card && !upBtn && !reorderMode) {
      detailSubject = card.dataset.subject;
      renderDetail(container);
    }
  });

  // Reorder arrows
  grid.addEventListener("click", async e => {
    const btn = e.target.closest(".btn-up, .btn-down");
    if (!btn) return;
    const i = parseInt(btn.dataset.index);
    const j = btn.classList.contains("btn-up") ? i-1 : i+1;
    if (j<0||j>=subjects.length) return;
    [subjects[i], subjects[j]] = [subjects[j], subjects[i]];
    grid.innerHTML = reorderList(subjects);
    try {
      await apiFetch("/api/subjects/reorder", {
        method:"PUT", body: JSON.stringify({order: subjects.map(s=>s.name)})
      });
    } catch(err) { showSnackbar(err.message, "error"); }
  });

  // Label filter
  function applyFilter() {
    const term = filterInput.value.trim().toLowerCase();
    filterClear.style.display = term ? "" : "none";
    if (!term) { filterInfo.style.display="none"; grid.innerHTML=renderGridContent(subjects); return; }
    const filtered = subjects.map(s=>({
      ...s, grades:s.grades.filter(g=>g.labels.some(l=>l.toLowerCase().includes(term)))
    })).filter(s=>s.grades.length);
    const tot = filtered.reduce((a,s)=>a+s.grades.length,0);
    filterInfo.style.display=""; filterInfo.textContent=
      `${tot} Eintrag/Einträge mit Label '${term}' in ${filtered.length} Fach/Fächern`;
    grid.innerHTML = filtered.length ? filtered.map(subjectCard).join("") :
      emptyState("search_off", `Keine Noten mit Label '${term}'.`);
  }
  filterInput.addEventListener("input", applyFilter);
  filterClear.addEventListener("click", ()=>{ filterInput.value=""; applyFilter(); });

  // Reorder toggle
  container.querySelector("#btnReorder").addEventListener("click", () => {
    reorderMode = !reorderMode;
    grid.innerHTML = renderGridContent(subjects);
    const btn = container.querySelector("#btnReorder");
    btn.innerHTML = `<span class="material-symbols-rounded" slot="icon">${reorderMode?"check":"swap_vert"}</span>
      ${reorderMode?"Fertig":"Reihenfolge"}`;
  });

  // New subject
  container.querySelector("#btnNewSubject").addEventListener("click", () => {
    const dlg = openDialog("Fach erstellen",
      `<md-outlined-text-field id="dlgName" label="Fachname" style="width:100%">
       </md-outlined-text-field>`
    );
    dlg.addEventListener("close", async () => {
      if (dlg.returnValue !== "confirm") return;
      const name = dlg.querySelector("#dlgName").value.trim();
      if (!name) return;
      try {
        await apiFetch("/api/subjects", {method:"POST", body:JSON.stringify({name})});
        showSnackbar(`Fach '${name}' erstellt.`);
        reorderMode = false;
        await renderGrid(container);
      } catch(e) { showSnackbar(e.message,"error"); }
    });
  });
}

// ===========================================================================
// DETAIL VIEW
// ===========================================================================
async function renderDetail(container) {
  container.innerHTML = `<div class="back-bar">
    <button class="icon-btn" id="btnBack"><span class="material-symbols-rounded">arrow_back</span></button>
    <span class="back-bar__title">${detailSubject}</span>
  </div>
  <div class="page-placeholder"><span class="material-symbols-rounded page-placeholder__icon">hourglass_top</span></div>`;

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
    detailSubject = null;
    return renderGrid(container);
  }

  setPrimaryAction("add", "Note hinzufügen", () => openGradeDialog(container, subject, null, subjects, rewardConfig));
  drawDetail(container, subject, subjects, rewardConfig);
}

function drawDetail(container, subject, subjects, rewardConfig) {
  const grades = subject.grades;
  const w      = grades.reduce((a,g)=>a+g.weight,0);
  const avg    = w ? grades.reduce((a,g)=>a+g.value*g.weight,0)/w : null;
  const best   = grades.length ? Math.min(...grades.map(g=>g.value)) : null;
  const worst  = grades.length ? Math.max(...grades.map(g=>g.value)) : null;

  const rows = grades.length ? grades.map((g,i) => `
    <tr>
      <td>${gradeBadge(g.value)}</td>
      <td>${g.weight !== 1 ? `<strong>${g.weight}×</strong>` : "1×"}</td>
      <td class="col-labels">${g.labels.join(", ")||"—"}</td>
      <td class="col-actions">
        <button class="icon-btn-sm btn-edit" data-index="${i}">
          <span class="material-symbols-rounded">edit</span>
        </button>
        <button class="icon-btn-sm btn-del" data-index="${i}"
                style="color:var(--md-sys-color-error)">
          <span class="material-symbols-rounded">delete</span>
        </button>
      </td>
    </tr>`).join("")
  : `<tr><td colspan="4" style="text-align:center;padding:32px;
          color:var(--md-sys-color-on-surface-variant)">Keine Noten eingetragen.</td></tr>`;

  // Rebuild container keeping back-bar
  container.innerHTML = `
    <!-- Back bar with rename/delete -->
    <div class="back-bar">
      <button class="icon-btn" id="btnBack">
        <span class="material-symbols-rounded">arrow_back</span>
      </button>
      <span class="back-bar__title">${subject.name}</span>
      <div class="back-bar__actions">
        <button class="icon-btn" id="btnRename" title="Umbenennen">
          <span class="material-symbols-rounded">edit</span>
        </button>
        <button class="icon-btn" id="btnDelSubject" title="Fach löschen"
                style="color:var(--md-sys-color-error)">
          <span class="material-symbols-rounded">delete</span>
        </button>
      </div>
    </div>

    <!-- Stats row -->
    ${avg !== null ? `
    <div class="card" style="display:flex;flex-wrap:wrap;gap:16px;
         justify-content:space-around;align-items:center;margin-bottom:16px">
      ${statChip("Durchschnitt", avg.toFixed(2))}
      ${statChip("Noten", grades.length, "--md-sys-color-secondary")}
      ${best!==null ? statChip("Beste", best, "--md-sys-color-tertiary") : ""}
      ${worst!==null && worst!==best ? statChip("Schlechteste", worst, "--md-sys-color-error") : ""}
    </div>` : ""}

    <!-- Grade table -->
    <div class="card" style="overflow:visible">
      <table class="grade-table">
        <thead>
          <tr>
            <th>Note</th>
            <th>Gewichtung</th>
            <th>Labels</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="gradeBody">${rows}</tbody>
      </table>
    </div>`;

  // Events
  container.querySelector("#btnBack").addEventListener("click", () => {
    detailSubject = null;
    clearPrimaryAction();
    renderGrid(container);
  });

  container.querySelector("#btnRename").addEventListener("click", () => {
    const dlg = openDialog("Fach umbenennen",
      `<md-outlined-text-field id="dlgNewName" label="Neuer Name"
          value="${subject.name}" style="width:100%"></md-outlined-text-field>`
    );
    dlg.addEventListener("close", async () => {
      if (dlg.returnValue !== "confirm") return;
      const name = dlg.querySelector("#dlgNewName").value.trim();
      if (!name || name === subject.name) return;
      // Rename = delete old + create new + copy grades
      try {
        await apiFetch("/api/subjects", {method:"POST", body:JSON.stringify({name})});
        for (const g of subject.grades) {
          await apiFetch(`/api/subjects/${encodeURIComponent(name)}/grades`, {
            method:"POST", body:JSON.stringify({value:g.value, weight:g.weight, labels:g.labels})
          });
        }
        await apiFetch(`/api/subjects/${encodeURIComponent(subject.name)}`, {method:"DELETE"});
        showSnackbar(`Fach umbenannt zu '${name}'.`);
        detailSubject = name;
        await renderDetail(container);
      } catch(e) { showSnackbar(e.message,"error"); }
    });
  });

  container.querySelector("#btnDelSubject").addEventListener("click", async () => {
    if (!confirm(`Fach '${subject.name}' und alle ${grades.length} Noten wirklich löschen?`)) return;
    try {
      await apiFetch(`/api/subjects/${encodeURIComponent(subject.name)}`, {method:"DELETE"});
      showSnackbar(`Fach '${subject.name}' gelöscht.`);
      detailSubject = null;
      clearPrimaryAction();
      await renderGrid(container);
    } catch(e) { showSnackbar(e.message,"error"); }
  });

  container.querySelectorAll(".btn-edit").forEach(btn => {
    btn.addEventListener("click", () => {
      openGradeDialog(container, subject, parseInt(btn.dataset.index), subjects, rewardConfig);
    });
  });

  container.querySelectorAll(".btn-del").forEach(btn => {
    btn.addEventListener("click", async () => {
      const idx = parseInt(btn.dataset.index);
      const g   = subject.grades[idx];
      if (!confirm(`Note ${g.value} (${g.weight}×) löschen?`)) return;
      try {
        await apiFetch(
          `/api/subjects/${encodeURIComponent(subject.name)}/grades/${idx}?adjust_wallet=1`,
          {method:"DELETE"}
        );
        showSnackbar("Note gelöscht.");
        await refreshDetail(container, subject.name, subjects, rewardConfig);
      } catch(e) { showSnackbar(e.message,"error"); }
    });
  });
}

async function refreshDetail(container, name, allSubjects, rewardConfig) {
  const fresh = await apiFetch("/api/subjects");
  const subject = fresh.find(s=>s.name===name);
  if (!subject) { detailSubject=null; return renderGrid(container); }
  // Update allSubjects in-place for the current render cycle
  const idx = allSubjects.findIndex(s=>s.name===name);
  if (idx>=0) allSubjects[idx] = subject;
  drawDetail(container, subject, fresh, rewardConfig);
}

// ---------------------------------------------------------------------------
// Add / edit grade dialog
// ---------------------------------------------------------------------------
function openGradeDialog(container, subject, editIndex, allSubjects, rewardConfig) {
  const g = editIndex !== null ? subject.grades[editIndex] : null;

  const dlg = openDialog(
    g ? "Note bearbeiten" : "Note hinzufügen",
    `<md-outlined-text-field id="dlgVal" label="Note (1–6)" type="number"
        min="1" max="6" step="0.5" value="${g?.value??""}" style="width:100%">
     </md-outlined-text-field>
     <md-outlined-text-field id="dlgWt" label="Gewichtung" type="number"
        min="0.5" step="0.5" value="${g?.weight??1}" style="width:100%">
     </md-outlined-text-field>
     <md-outlined-text-field id="dlgLbl" label="Labels (Komma getrennt)"
        value="${g?.labels?.join(", ")??""}" style="width:100%">
     </md-outlined-text-field>`,
    g ? "Speichern" : "Hinzufügen"
  );

  dlg.addEventListener("close", async () => {
    if (dlg.returnValue !== "confirm") return;
    const fVal = dlg.querySelector("#dlgVal");
    const fWt  = dlg.querySelector("#dlgWt");
    const ok   = validateAll([
      [fVal, validators.gradeValue],
      [fWt,  validators.positiveNumber],
    ]);
    if (!ok) return;

    const value  = parseFloat(fVal.value);
    const weight = parseFloat(fWt.value)||1;
    const raw    = dlg.querySelector("#dlgLbl").value.trim();
    const labels = raw ? raw.split(",").map(l=>l.trim()).filter(Boolean) : [];
    const url    = editIndex!==null
      ? `/api/subjects/${encodeURIComponent(subject.name)}/grades/${editIndex}`
      : `/api/subjects/${encodeURIComponent(subject.name)}/grades`;

    try {
      await apiFetch(url, {method: editIndex!==null?"PUT":"POST", body:JSON.stringify({value,weight,labels})});
      showSnackbar(editIndex!==null ? "Note aktualisiert." : "Note hinzugefügt.");
      await refreshDetail(container, subject.name, allSubjects, rewardConfig);
    } catch(e) { showSnackbar(e.message,"error"); }
  });
}

function injectStyles() {
  if (document.getElementById("ov-css")) return;
  const s = document.createElement("style"); s.id="ov-css";
  s.textContent=`
    .ov-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px; }
    .ov-card:hover { background:var(--md-sys-color-surface-container); }
    @media(max-width:600px){.ov-grid{grid-template-columns:1fr;}}
  `;
  document.head.appendChild(s);
}
