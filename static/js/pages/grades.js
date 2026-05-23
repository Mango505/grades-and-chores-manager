/**
 * grades.js – Add / edit / delete grades
 *
 * Layout:
 *   [Subject tab bar]
 *   [Grade table for selected subject]
 *   [FAB: Note hinzufügen]
 *
 * State is kept in module-level variables so the selected tab survives
 * internal re-renders (e.g. after adding a grade).
 */
import { apiFetch, showSnackbar } from "../app.js";
import { gradeBadge, emptyState, errorBanner, openDialog, injectComponentStyles, validateAll, validators } from "../components.js";

let selectedSubject = null; // { name, grades[] }
let allSubjects     = [];

export default async function render(container) {
  injectComponentStyles();
  injectGradesStyles();
  await loadAndRender(container);
}

async function loadAndRender(container) {
  try {
    allSubjects = await apiFetch("/api/subjects");
  } catch (e) {
    container.innerHTML = errorBanner(e.message);
    return;
  }

  // Keep selection valid across re-renders
  if (!allSubjects.length) {
    container.innerHTML = emptyState("library_books", "Noch keine Fächer vorhanden. Erstelle zuerst ein Fach in der Übersicht.");
    return;
  }
  selectedSubject = allSubjects.find(s => s.name === selectedSubject?.name) ?? allSubjects[0];

  renderShell(container);
}

function renderShell(container) {
  // ---- Tab bar ----
  const tabs = allSubjects.map(s => `
    <span class="gr-tab-wrap">
      <button class="gr-tab ${s.name === selectedSubject.name ? "gr-tab--active" : ""}"
              data-name="${s.name}">${s.name}</button>
      <button class="gr-tab-del icon-btn-sm" data-name="${s.name}" title="Fach löschen"
              style="width:22px;height:22px;color:var(--md-sys-color-error);margin-left:-4px">
        <span class="material-symbols-rounded" style="font-size:16px">close</span>
      </button>
    </span>
  `).join("");

  // ---- Grade rows ----
  const gradeRows = selectedSubject.grades.length
    ? selectedSubject.grades.map((g, i) => `
        <tr class="gr-row">
          <td>${gradeBadge(g.value)}</td>
          <td>${g.weight !== 1 ? `<strong>${g.weight}x</strong>` : "1x"}</td>
          <td>${g.labels.length ? g.labels.join(", ") : "<em style='color:var(--md-sys-color-on-surface-variant)'>–</em>"}</td>
          <td class="gr-row__actions">
            <button class="icon-btn-sm btn-edit" data-index="${i}" title="Bearbeiten">
              <span class="material-symbols-rounded">edit</span>
            </button>
            <button class="icon-btn-sm btn-delete" data-index="${i}" title="Löschen"
                    style="color:var(--md-sys-color-error)">
              <span class="material-symbols-rounded">delete</span>
            </button>
          </td>
        </tr>`)
      .join("")
    : `<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--md-sys-color-on-surface-variant)">
         Keine Noten eingetragen.</td></tr>`;

  const avg = selectedSubject.grades.length
    ? (selectedSubject.grades.reduce((a,g) => a + g.value*g.weight, 0) /
       selectedSubject.grades.reduce((a,g) => a + g.weight, 0)).toFixed(2)
    : null;

  container.innerHTML = `
    <!-- Subject tabs (scrollable on mobile) -->
    <div class="gr-tabs" id="grTabs">${tabs}</div>

    <!-- Grade table -->
    <div class="card" style="margin-top:16px;overflow-x:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span style="font-weight:600;font-size:16px">${selectedSubject.name}</span>
        ${avg ? `<span style="font-size:13px;color:var(--md-sys-color-on-surface-variant)">Ø ${avg}</span>` : ""}
      </div>
      <table class="gr-table">
        <thead>
          <tr>
            <th>Note</th><th>Gewichtung</th><th>Labels</th><th></th>
          </tr>
        </thead>
        <tbody>${gradeRows}</tbody>
      </table>
    </div>

    <!-- Add grade button -->
    <div style="margin-top:20px">
      <md-filled-button id="btnAddGrade">
        <span class="material-symbols-rounded" slot="icon">add</span>
        Note hinzufügen
      </md-filled-button>
    </div>`;

  // ---- Delete subject ----
  container.querySelectorAll(".gr-tab-del").forEach(btn => {
    btn.addEventListener("click", async e => {
      e.stopPropagation();
      const name = btn.dataset.name;
      if (!confirm(`Fach '${name}' und alle Noten unwiderruflich löschen?`)) return;
      try {
        await apiFetch(`/api/subjects/${encodeURIComponent(name)}`, { method: "DELETE" });
        showSnackbar(`Fach '${name}' gelöscht.`);
        selectedSubject = null;
        await loadAndRender(container);
      } catch(e) { showSnackbar(e.message, "error"); }
    });
  });

  // ---- Tab switching ----
  container.querySelectorAll(".gr-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedSubject = allSubjects.find(s => s.name === btn.dataset.name);
      renderShell(container);
    });
  });

  // ---- Add grade ----
  container.querySelector("#btnAddGrade").addEventListener("click", () => openGradeDialog(container));

  // ---- Edit grade ----
  container.querySelectorAll(".btn-edit").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.index);
      openGradeDialog(container, idx);
    });
  });

  // ---- Delete grade ----
  container.querySelectorAll(".btn-delete").forEach(btn => {
    btn.addEventListener("click", async () => {
      const idx = parseInt(btn.dataset.index);
      const g   = selectedSubject.grades[idx];
      if (!confirm(`Note ${g.value} (${g.weight}x) wirklich löschen?`)) return;
      try {
        await apiFetch(
          `/api/subjects/${encodeURIComponent(selectedSubject.name)}/grades/${idx}?adjust_wallet=1`,
          { method: "DELETE" }
        );
        showSnackbar("Note gelöscht.");
        await loadAndRender(container);
      } catch(e) { showSnackbar(e.message, "error"); }
    });
  });
}

// ---- Add / edit dialog ----

function openGradeDialog(container, editIndex = null) {
  const g = editIndex !== null ? selectedSubject.grades[editIndex] : null;

  const dlg = openDialog(
    g ? "Note bearbeiten" : "Note hinzufügen",
    `<md-outlined-text-field id="dlgValue"  label="Note (1–6)"   type="number"
        min="1" max="6" step="0.5" value="${g?.value ?? ""}" style="width:100%"></md-outlined-text-field>
     <md-outlined-text-field id="dlgWeight" label="Gewichtung"   type="number"
        min="0.1" step="0.5" value="${g?.weight ?? 1}" style="width:100%"></md-outlined-text-field>
     <md-outlined-text-field id="dlgLabels" label="Labels (Komma getrennt)"
        value="${g?.labels?.join(", ") ?? ""}" style="width:100%"></md-outlined-text-field>`,
    g ? "Speichern" : "Hinzufügen"
  );

  dlg.addEventListener("close", async () => {
    if (dlg.returnValue !== "confirm") return;

    const fValue  = dlg.querySelector("#dlgValue");
    const fWeight = dlg.querySelector("#dlgWeight");

    // Inline field validation before submitting
    const ok = validateAll([
      { field: fValue,  test: validators.gradeValue },
      { field: fWeight, test: validators.positiveNumber },
    ]);
    if (!ok) { dlg.open = true; return; }  // re-open dialog to show errors

    const value  = parseFloat(fValue.value);
    const weight = parseFloat(fWeight.value) || 1.0;
    const raw    = dlg.querySelector("#dlgLabels").value.trim();
    const labels = raw ? raw.split(",").map(l => l.trim()).filter(Boolean) : [];

    const url = editIndex !== null
      ? `/api/subjects/${encodeURIComponent(selectedSubject.name)}/grades/${editIndex}`
      : `/api/subjects/${encodeURIComponent(selectedSubject.name)}/grades`;
    const method = editIndex !== null ? "PUT" : "POST";

    try {
      await apiFetch(url, { method, body: JSON.stringify({ value, weight, labels }) });
      showSnackbar(editIndex !== null ? "Note aktualisiert." : "Note hinzugefügt.");
      await loadAndRender(container);
    } catch(e) { showSnackbar(e.message, "error"); }
  });
}

function injectGradesStyles() {
  if (document.getElementById("gr-css")) return;
  const s = document.createElement("style"); s.id = "gr-css";
  s.textContent = `
    .gr-tabs { display:flex; gap:8px; overflow-x:auto; padding-bottom:4px; flex-wrap:nowrap; }
    .gr-tab-wrap { display:inline-flex; align-items:center; flex-shrink:0; }
    .gr-tab  { padding:8px 16px; border-radius:var(--shape-corner-full); border:1px solid var(--md-sys-color-outline);
               background:transparent; cursor:pointer; font-size:14px; white-space:nowrap;
               color:var(--md-sys-color-on-surface); transition:background .2s,color .2s; }
    .gr-tab--active { background:var(--md-sys-color-primary); color:var(--md-sys-color-on-primary);
                      border-color:var(--md-sys-color-primary); }
    .gr-table { width:100%; border-collapse:collapse; font-size:14px; }
    .gr-table th { text-align:left; padding:8px 6px; font-size:12px;
                   color:var(--md-sys-color-on-surface-variant); border-bottom:1px solid var(--md-sys-color-outline-variant); }
    .gr-table td { padding:10px 6px; border-bottom:1px solid var(--md-sys-color-outline-variant); vertical-align:middle; }
    .gr-table tr:last-child td { border-bottom:none; }
    .gr-row__actions { display:flex; gap:2px; justify-content:flex-end; }
  `;
  document.head.appendChild(s);
}
