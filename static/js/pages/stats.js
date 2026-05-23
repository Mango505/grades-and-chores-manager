/**
 * stats.js – Statistics, Export (TXT download), and Export Compare tool
 *
 * Three sub-views accessible via an internal tab bar:
 *   [Statistiken] [Exportieren] [Vergleichen]
 */
import { apiFetch, showSnackbar } from "../app.js";
import { card, statChip, gradeBadge, emptyState, errorBanner, injectComponentStyles } from "../components.js";

let activeTab = "stats"; // persists across internal re-renders

export default async function render(container) {
  injectComponentStyles();
  injectStatsStyles();
  renderTabShell(container);
}

// ---------------------------------------------------------------------------
// Tab shell
// ---------------------------------------------------------------------------

function renderTabShell(container) {
  container.innerHTML = `
    <div class="st-tabs" style="margin-bottom:20px">
      ${["stats","export","compare"].map(t => `
        <button class="gr-tab ${activeTab===t?"gr-tab--active":""}" data-tab="${t}">
          ${{ stats:"Statistiken", export:"Exportieren", compare:"Vergleichen" }[t]}
        </button>`).join("")}
    </div>
    <div id="stContent"></div>`;

  container.querySelectorAll("[data-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tab;
      renderTabShell(container);
    });
  });

  const content = container.querySelector("#stContent");
  if      (activeTab === "stats")   renderStats(content);
  else if (activeTab === "export")  renderExport(content);
  else if (activeTab === "compare") renderCompare(content);
}

// ---------------------------------------------------------------------------
// Tab: Statistiken
// ---------------------------------------------------------------------------

async function renderStats(container) {
  container.innerHTML = emptyState("hourglass_top", "Lade…");

  let subjects, wallet, rewardConfig;
  try {
    [subjects, wallet, rewardConfig] = await Promise.all([
      apiFetch("/api/subjects"),
      apiFetch("/api/wallet"),
      apiFetch("/api/reward-config"),
    ]);
  } catch(e) { container.innerHTML = errorBanner(e.message); return; }

  const allGrades = subjects.flatMap(s => s.grades.map(g => ({ ...g, subject: s.name })));
  if (!allGrades.length) { container.innerHTML = emptyState("insights","Noch keine Noten vorhanden."); return; }

  const totalWeight = allGrades.reduce((a,g) => a+g.weight, 0);
  const overallAvg  = allGrades.reduce((a,g) => a+g.value*g.weight, 0) / totalWeight;
  const subjectAvg  = s => s.grades.reduce((a,g)=>a+g.value*g.weight,0) /
                           s.grades.reduce((a,g)=>a+g.weight,0);
  const swg         = subjects.filter(s=>s.grades.length);
  const sorted      = [...swg].sort((a,b)=>subjectAvg(a)-subjectAvg(b));
  const bestGrade   = allGrades.reduce((a,g)=>g.value<a.value?g:a);
  const worstGrade  = allGrades.reduce((a,g)=>g.value>a.value?g:a);

  const dist = {1:0,2:0,3:0,4:0,5:0,6:0};
  allGrades.forEach(g=>{ const r=Math.min(6,Math.max(1,Math.round(g.value))); dist[r]++; });
  const maxCount = Math.max(...Object.values(dist),1);

  const labelCounts = {};
  allGrades.forEach(g=>g.labels?.forEach(l=>{ if(l) labelCounts[l]=(labelCounts[l]||0)+1; }));
  const topLabels = Object.entries(labelCounts).sort((a,b)=>b[1]-a[1]).slice(0,5);

  // Linear regression slope per subject
  const trends = swg.filter(s=>s.grades.length>=2).map(s=>{
    const n=s.grades.length, xs=[...Array(n).keys()], ys=s.grades.map(g=>g.value);
    const xm=xs.reduce((a,x)=>a+x,0)/n, ym=ys.reduce((a,y)=>a+y,0)/n;
    const num=xs.reduce((a,x,i)=>a+(x-xm)*(ys[i]-ym),0);
    const den=xs.reduce((a,x)=>a+(x-xm)**2,0);
    return { name:s.name, slope:den?num/den:0, avg:subjectAvg(s) };
  }).sort((a,b)=>a.slope-b.slope);

  const totalRedeemed = wallet.redemptions.reduce((a,r)=>a+r.cost,0);
  const fmt = v => fmtReward(v, rewardConfig);

  container.innerHTML = `
    <div class="card chip-row st-banner">
      ${statChip("Gesamtschnitt", overallAvg.toFixed(2))}
      ${statChip("Noten gesamt",  allGrades.length,  "--md-sys-color-secondary")}
      ${statChip("Fächer",        swg.length,         "--md-sys-color-tertiary")}
    </div>
    <div class="st-grid">
      <div class="card">
        <h3 class="st-section-title">Fächer</h3>
        <div class="grade-row">
          <span class="material-symbols-rounded" style="font-size:20px;color:var(--md-sys-color-primary)">emoji_events</span>
          <span style="flex:1;font-size:13px;color:var(--md-sys-color-on-surface-variant)">Bestes Fach</span>
          <span style="font-size:14px">${sorted[0]?.name ?? "—"}</span>
          <span style="font-size:12px;color:var(--md-sys-color-on-surface-variant);margin-left:6px">(Ø ${subjectAvg(sorted[0]).toFixed(2)})</span>
        </div>
        <div class="grade-row">
          <span class="material-symbols-rounded" style="font-size:20px;color:var(--md-sys-color-error)">sentiment_dissatisfied</span>
          <span style="flex:1;font-size:13px;color:var(--md-sys-color-on-surface-variant)">Schlechtestes Fach</span>
          <span style="font-size:14px">${sorted.at(-1)?.name ?? "—"}</span>
          <span style="font-size:12px;color:var(--md-sys-color-on-surface-variant);margin-left:6px">(Ø ${subjectAvg(sorted.at(-1)).toFixed(2)})</span>
        </div>
        <div class="divider"></div>
        <h3 class="st-section-title" style="margin-top:8px">Einzelnoten</h3>
        <div class="grade-row">${gradeBadge(bestGrade.value)}<span style="flex:1;font-size:13px;color:var(--md-sys-color-on-surface-variant)">Beste Note</span><span style="font-size:13px">${bestGrade.subject}</span></div>
        <div class="grade-row">${gradeBadge(worstGrade.value)}<span style="flex:1;font-size:13px;color:var(--md-sys-color-on-surface-variant)">Schlechteste Note</span><span style="font-size:13px">${worstGrade.subject}</span></div>
      </div>

      <div class="card">
        <h3 class="st-section-title">Notenverteilung</h3>
        <div class="st-chart">
          ${Object.entries(dist).map(([g,c])=>`
            <div class="st-bar-col">
              <span class="st-bar-count">${c||""}</span>
              <div class="st-bar" style="height:${Math.round((c/maxCount)*120)}px" data-grade="${g}"></div>
              <span class="st-bar-label">${g}</span>
            </div>`).join("")}
        </div>
      </div>

      ${trends.length ? `<div class="card">
        <h3 class="st-section-title">Trendlinien (≥ 2 Noten)</h3>
        ${trends.map(t=>{
          const arrow = t.slope<-0.05?"↑":t.slope>0.05?"↓":"→";
          const color = t.slope<-0.05?"#1b7e4a":t.slope>0.05?"var(--md-sys-color-error)":"var(--md-sys-color-on-surface-variant)";
          return `<div class="grade-row">
            <span style="flex:1;font-size:14px">${t.name}</span>
            <span style="color:${color};font-weight:700;font-size:18px">${arrow}</span>
            <span style="font-size:12px;color:var(--md-sys-color-on-surface-variant);margin-left:8px">Ø ${t.avg.toFixed(2)} | Δ ${t.slope>0?"+":""}${t.slope.toFixed(2)}/Note</span>
          </div>`;
        }).join("")}
      </div>` : ""}

      ${topLabels.length ? `<div class="card">
        <h3 class="st-section-title">Top Labels</h3>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">
          ${topLabels.map(([l,n])=>`<span class="st-label-chip">${l} <strong>${n}×</strong></span>`).join("")}
        </div>
      </div>` : ""}

      ${rewardConfig.enabled ? `<div class="card">
        <h3 class="st-section-title">Belohnungen</h3>
        <div class="chip-row" style="margin-top:8px">
          ${statChip("Verdient",    fmt(wallet.balance+totalRedeemed))}
          ${statChip("Eingelöst",   fmt(totalRedeemed), "--md-sys-color-secondary")}
          ${statChip("Restguthaben",fmt(wallet.balance), "--md-sys-color-tertiary")}
        </div>
      </div>` : ""}
    </div>`;
}

// ---------------------------------------------------------------------------
// Tab: Exportieren
// ---------------------------------------------------------------------------

async function renderExport(container) {
  container.innerHTML = `
    <div class="card" style="max-width:500px">
      <h3 class="st-section-title" style="margin-bottom:16px">Export erstellen</h3>
      <md-outlined-text-field id="exportLabel" label="Export-Label (optional)"
          placeholder="z.B. 3. Quartal – Mai 2026" style="width:100%;margin-bottom:16px">
      </md-outlined-text-field>
      <div style="margin-bottom:12px;font-size:13px;color:var(--md-sys-color-on-surface-variant)">
        Inhalt wählen (Mehrfachauswahl):
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px">
        <label class="st-check"><md-checkbox id="chkStats"  checked></md-checkbox> Statistiken</label>
        <label class="st-check"><md-checkbox id="chkGrades" checked></md-checkbox> Noten pro Fach</label>
        <label class="st-check"><md-checkbox id="chkLog"              ></md-checkbox> Notenänderungen</label>
        <label class="st-check"><md-checkbox id="chkRedeem"           ></md-checkbox> Einlösungen</label>
      </div>
      <md-filled-button id="btnExport">
        <span class="material-symbols-rounded" slot="icon">download</span>
        Als TXT herunterladen
      </md-filled-button>
    </div>`;

  container.querySelector("#btnExport").addEventListener("click", async () => {
    let data;
    try { data = await apiFetch("/api/export"); }
    catch(e) { showSnackbar(e.message,"error"); return; }

    if (!data.grade_count) { showSnackbar("Keine Noten vorhanden.","error"); return; }

    const label    = container.querySelector("#exportLabel").value.trim() || "Kein Label";
    const incStats  = container.querySelector("#chkStats").checked;
    const incGrades = container.querySelector("#chkGrades").checked;
    const incLog    = container.querySelector("#chkLog").checked;
    const incRedeem = container.querySelector("#chkRedeem").checked;

    const lines = buildExportText(data, label, { incStats, incGrades, incLog, incRedeem });
    downloadText(lines.join("\n"), `export_${timestamp()}.txt`);
    showSnackbar("Export heruntergeladen.");
  });
}

// ---------------------------------------------------------------------------
// Tab: Vergleichen
// ---------------------------------------------------------------------------

function renderCompare(container) {
  container.innerHTML = `
    <div class="card" style="max-width:600px">
      <h3 class="st-section-title" style="margin-bottom:16px">Zwei Exporte vergleichen</h3>
      <p style="font-size:13px;color:var(--md-sys-color-on-surface-variant);margin-bottom:16px">
        Lade zwei TXT-Exportdateien hoch. Die Werte werden automatisch ausgelesen und verglichen.
      </p>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px">
        <div style="flex:1;min-width:180px">
          <div style="font-size:12px;margin-bottom:6px;color:var(--md-sys-color-on-surface-variant)">Export 1 (älter)</div>
          <input type="file" id="file1" accept=".txt" class="st-file-input" />
        </div>
        <div style="flex:1;min-width:180px">
          <div style="font-size:12px;margin-bottom:6px;color:var(--md-sys-color-on-surface-variant)">Export 2 (neuer)</div>
          <input type="file" id="file2" accept=".txt" class="st-file-input" />
        </div>
      </div>
      <md-filled-tonal-button id="btnCompare">Vergleichen</md-filled-tonal-button>
    </div>
    <div id="compareResult" style="margin-top:20px"></div>`;

  container.querySelector("#btnCompare").addEventListener("click", async () => {
    const f1 = container.querySelector("#file1").files[0];
    const f2 = container.querySelector("#file2").files[0];
    if (!f1 || !f2) { showSnackbar("Bitte beide Dateien auswählen.","error"); return; }

    const [t1, t2] = await Promise.all([f1.text(), f2.text()]);
    const d1 = parseExportText(t1), d2 = parseExportText(t2);
    renderCompareResult(container.querySelector("#compareResult"), d1, d2);
  });
}

function renderCompareResult(container, d1, d2) {
  const col = v => v != null ? v : "—";

  const avgDiff = (d1.overall_avg != null && d2.overall_avg != null)
    ? d2.overall_avg - d1.overall_avg : null;
  const cntDiff = (d1.grade_count != null && d2.grade_count != null)
    ? d2.grade_count - d1.grade_count : null;

  // Per-subject comparison
  const allSubjects = [...new Set([...Object.keys(d1.subjects), ...Object.keys(d2.subjects)])].sort();

  container.innerHTML = `
    <div class="card">
      <table class="st-cmp-table">
        <thead>
          <tr>
            <th></th>
            <th>${d1.label}</th>
            <th>${d2.label}</th>
            <th>Differenz</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Gesamtschnitt</td>
            <td>${col(d1.overall_avg?.toFixed(2))}</td>
            <td>${col(d2.overall_avg?.toFixed(2))}</td>
            <td>${avgDiff!=null ? diffCell(avgDiff, true) : "—"}</td>
          </tr>
          <tr>
            <td>Anzahl Noten</td>
            <td>${col(d1.grade_count)}</td>
            <td>${col(d2.grade_count)}</td>
            <td>${cntDiff!=null ? `${cntDiff>0?"+":""}${cntDiff}` : "—"}</td>
          </tr>
          <tr><td>Bestes Fach</td><td>${col(d1.best_subject)}</td><td>${col(d2.best_subject)}</td><td></td></tr>
          <tr><td>Schlechtest. Fach</td><td>${col(d1.worst_subject)}</td><td>${col(d2.worst_subject)}</td><td></td></tr>
        </tbody>
      </table>

      <div class="divider" style="margin:16px 0"></div>
      <h3 class="st-section-title">Fächer im Vergleich</h3>
      <table class="st-cmp-table" style="margin-top:8px">
        <thead><tr><th>Fach</th><th>${d1.label}</th><th>${d2.label}</th><th>Δ</th></tr></thead>
        <tbody>
          ${allSubjects.map(name => {
            const a1 = d1.subjects[name], a2 = d2.subjects[name];
            const diff = (a1!=null&&a2!=null) ? a2-a1 : null;
            return `<tr>
              <td>${name}</td>
              <td>${a1!=null?a1.toFixed(2):"—"}</td>
              <td>${a2!=null?a2.toFixed(2):"—"}</td>
              <td>${diff!=null?diffCell(diff,true):"—"}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>`;
}

// Colour-coded diff cell: for grades, negative = better (green)
function diffCell(d, gradeScale = false) {
  const better = gradeScale ? d < 0 : d > 0;
  const color  = d === 0 ? "inherit" : better ? "#1b7e4a" : "var(--md-sys-color-error)";
  const arrow  = d === 0 ? "→" : better ? "↑" : "↓";
  return `<span style="color:${color};font-weight:600">${arrow} ${d>0?"+":""}${d.toFixed(2)}</span>`;
}

// ---------------------------------------------------------------------------
// Export text builder (mirrors CLI export function)
// ---------------------------------------------------------------------------

function buildExportText(data, label, { incStats, incGrades, incLog, incRedeem }) {
  const cfg = data.reward_config;
  const fmt = v => fmtReward(v, cfg);
  const lines = [
    "NOTENRECHNER EXPORT",
    `Label:    ${label}`,
    `Erstellt: ${new Date().toLocaleString("de-DE")}`,
  ];

  if (incStats && data.overall_average != null) {
    lines.push("", "=== STATISTIKEN ===");
    lines.push(`Gesamtdurchschnitt: ${data.overall_average.toFixed(2)}`);
    lines.push(`Anzahl gespeicherte Noten (Gesamt): ${data.grade_count}`);
    if (data.top_labels?.length)
      lines.push("Top Labels: " + data.top_labels.map(x=>`${x.label} (${x.count}x)`).join(", "));
    if (data.best_subject)
      lines.push(`Bestes Fach: ${data.best_subject.name} (${data.best_subject.average})`);
    if (data.worst_subject)
      lines.push(`Schlechtestes Fach: ${data.worst_subject.name} (${data.worst_subject.average})`);
    if (data.best_grade)
      lines.push(`Beste Note: ${data.best_grade.value} in '${data.best_grade.subject}'`);
    if (data.worst_grade)
      lines.push(`Schlechteste Note: ${data.worst_grade.value} in '${data.worst_grade.subject}'`);
    if (cfg.enabled) {
      lines.push(`Verdient:     ${fmt(data.wallet_balance + data.total_redeemed)}`);
      lines.push(`Eingelöst:    ${fmt(data.total_redeemed)}`);
      lines.push(`Restguthaben: ${fmt(data.wallet_balance)}`);
    }
  }

  if (incGrades) {
    lines.push("", "=== NOTEN PRO FACH ===");
    data.subjects.forEach(s => {
      const avg = s.grades.length
        ? (s.grades.reduce((a,g)=>a+g.value*g.weight,0)/s.grades.reduce((a,g)=>a+g.weight,0)).toFixed(2)
        : "—";
      lines.push(`Fach: ${s.name} | Ø ${avg}`);
      s.grades.forEach(g => lines.push(`  ${g.value} | ${g.weight}x | ${g.labels.join(", ")||"<keine Labels>"}`));
      lines.push("");
    });
  }

  if (incLog) {
    lines.push("", "=== NOTENÄNDERUNGEN ===");
    const sym = {"+":"Hinzugefügt","-":"Gelöscht","~":"Bearbeitet"};
    if (data.grade_log?.length)
      [...data.grade_log].reverse().forEach(e =>
        lines.push(`${sym[e.action]??e.action} | ${e.date} | ${e.subject} | ${e.value} (${e.weight}x) | ${e.labels?.join(",")||""}`)
      );
    else lines.push("Keine");
  }

  if (incRedeem) {
    lines.push("", "=== EINLÖSUNGEN ===");
    if (data.redemptions?.length && cfg.enabled)
      [...data.redemptions].reverse().forEach(r =>
        lines.push(`${r.description} | -${fmt(r.cost)} | ${r.date??""}`)
      );
    else lines.push("Keine");
  }

  lines.push("", `[EXPORT_LABEL=${label}]`);
  return lines;
}

// Parse a CLI/web-exported TXT file into a structured object
function parseExportText(text) {
  const lines = text.split("\n");
  const result = { label:"Unbekannt", overall_avg:null, grade_count:null,
                   best_subject:null, worst_subject:null, subjects:{} };
  for (const line of lines) {
    if (line.startsWith("Label:"))               result.label        = line.split(":").slice(1).join(":").trim();
    else if (line.startsWith("Gesamtdurchschnitt:")) result.overall_avg = parseFloat(line.split(":")[1]);
    else if (line.startsWith("Anzahl"))           result.grade_count  = parseInt(line.split(":")[1]);
    else if (line.startsWith("Bestes Fach:"))     result.best_subject = line.split(":").slice(1).join(":").trim();
    else if (line.startsWith("Schlechtestes Fach:")) result.worst_subject = line.split(":").slice(1).join(":").trim();
    else if (line.startsWith("Fach:")) {
      const parts = line.split("|");
      const name  = parts[0].replace("Fach:","").trim();
      const avg   = parseFloat((parts[1]??"").replace("Ø",""));
      if (!isNaN(avg)) result.subjects[name] = avg;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function fmtReward(v, cfg) {
  if (!cfg?.enabled) return String(v);
  if (cfg.reward_mode === "money") return `${Number(v).toFixed(2)} €`;
  if (cfg.reward_mode === "unit")  return `${v} ${cfg.unit_name}`;
  return `${Math.round(v)} Pt.`;
}

function downloadText(content, filename) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"), { href:url, download:filename });
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}

function timestamp() {
  return new Date().toISOString().slice(0,16).replace(/[-T:]/g,"").replace("","_").slice(0,13);
}

function injectStatsStyles() {
  if (document.getElementById("st-css")) return;
  const s = document.createElement("style"); s.id = "st-css";
  s.textContent = `
    .st-tabs        { display:flex;gap:8px;margin-bottom:0;flex-wrap:wrap; }
    .st-banner      { justify-content:space-around;flex-wrap:wrap;gap:16px;margin-bottom:20px; }
    .st-grid        { display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px; }
    .st-section-title { font-size:13px;font-weight:600;text-transform:uppercase;
                        letter-spacing:.05em;color:var(--md-sys-color-on-surface-variant);margin-bottom:8px; }
    .st-chart       { display:flex;align-items:flex-end;gap:8px;height:160px;padding-top:24px; }
    .st-bar-col     { display:flex;flex-direction:column;align-items:center;gap:4px;flex:1; }
    .st-bar-count   { font-size:12px;color:var(--md-sys-color-on-surface-variant);min-height:16px; }
    .st-bar         { width:100%;border-radius:4px 4px 0 0;background:var(--md-sys-color-primary);min-height:4px; }
    .st-bar[data-grade="4"] { background:var(--md-sys-color-secondary); }
    .st-bar[data-grade="5"],.st-bar[data-grade="6"] { background:var(--md-sys-color-error);opacity:.75; }
    .st-bar-label   { font-size:13px;font-weight:500; }
    .st-label-chip  { padding:4px 12px;border-radius:var(--shape-corner-full);
                      background:var(--md-sys-color-secondary-container);
                      color:var(--md-sys-color-on-secondary-container);font-size:13px; }
    .st-check       { display:flex;align-items:center;gap:10px;font-size:14px;cursor:pointer; }
    .st-file-input  { width:100%;font-size:13px;padding:8px 0; }
    .st-cmp-table   { width:100%;border-collapse:collapse;font-size:13px; }
    .st-cmp-table th { text-align:left;padding:6px 8px;font-size:12px;
                       color:var(--md-sys-color-on-surface-variant);
                       border-bottom:1px solid var(--md-sys-color-outline-variant); }
    .st-cmp-table td { padding:8px;border-bottom:1px solid var(--md-sys-color-outline-variant); }
    .st-cmp-table tr:last-child td { border-bottom:none; }
    @media(max-width:600px){ .st-grid{grid-template-columns:1fr;} }
  `;
  document.head.appendChild(s);
}
