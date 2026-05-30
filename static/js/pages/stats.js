/**
 * stats.js – Statistics | Export | Compare
 * Tab bar uses shared .m3-tab class from app.css.
 */
import { apiFetch, showSnackbar, clearPrimaryAction } from "../app.js";
import { card, statChip, gradeBadge, emptyState, errorBanner, injectComponentStyles } from "../components.js";

let activeTab = "stats";

export default async function render(container) {
  injectComponentStyles();
  injectStyles();
  clearPrimaryAction();
  renderTabShell(container);
}

// ---------------------------------------------------------------------------
// Tab shell
// ---------------------------------------------------------------------------
function renderTabShell(container) {
  const tabs = { stats: "Statistiken", export: "Exportieren", compare: "Vergleichen" };
  container.innerHTML = `
    <div class="m3-tab-bar">
      ${Object.entries(tabs).map(([k, v]) =>
        `<button class="m3-tab ${activeTab === k ? "m3-tab--active" : ""}" data-tab="${k}">${v}</button>`
      ).join("")}
    </div>
    <div id="stContent"></div>`;

  container.querySelectorAll("[data-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tab;
      renderTabShell(container);
    });
  });

  const c = container.querySelector("#stContent");
  if      (activeTab === "stats")   renderStats(c);
  else if (activeTab === "export")  renderExport(c);
  else if (activeTab === "compare") renderCompare(c);
}

// ---------------------------------------------------------------------------
// Statistiken
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

  const all = subjects.flatMap(s => s.grades.map(g => ({ ...g, subject: s.name })));
  if (!all.length) { container.innerHTML = emptyState("insights", "Noch keine Noten."); return; }

  const tw   = all.reduce((a, g) => a + g.weight, 0);
  const avg  = all.reduce((a, g) => a + g.value * g.weight, 0) / tw;
  const savg = s => {
    const w = s.grades.reduce((a, g) => a + g.weight, 0);
    return w ? s.grades.reduce((a, g) => a + g.value * g.weight, 0) / w : 0;
  };
  const swg   = subjects.filter(s => s.grades.length);
  const sort  = [...swg].sort((a, b) => savg(a) - savg(b));
  const best  = all.reduce((a, g) => g.value < a.value ? g : a);
  const worst = all.reduce((a, g) => g.value > a.value ? g : a);

  const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  all.forEach(g => { const r = Math.min(6, Math.max(1, Math.round(g.value))); dist[r]++; });
  const mx = Math.max(...Object.values(dist), 1);

  const lc = {};
  all.forEach(g => g.labels?.forEach(l => { if (l) lc[l] = (lc[l] || 0) + 1; }));
  const topL = Object.entries(lc).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const trends = swg.filter(s => s.grades.length >= 2).map(s => {
    const n = s.grades.length, xs = [...Array(n).keys()], ys = s.grades.map(g => g.value);
    const xm = xs.reduce((a, x) => a + x, 0) / n, ym = ys.reduce((a, y) => a + y, 0) / n;
    const num = xs.reduce((a, x, i) => a + (x - xm) * (ys[i] - ym), 0);
    const den = xs.reduce((a, x) => a + (x - xm) ** 2, 0);
    return { name: s.name, slope: den ? num / den : 0, avg: savg(s) };
  }).sort((a, b) => a.slope - b.slope);

  const redeemed = wallet.redemptions.reduce((a, r) => a + r.cost, 0);
  const fmt = v => fmtReward(v, rewardConfig);

  container.innerHTML = `
    <div class="card" style="display:flex;flex-wrap:wrap;gap:16px;justify-content:space-around;margin-bottom:16px">
      ${statChip("Gesamtschnitt", avg.toFixed(2))}
      ${statChip("Noten gesamt", all.length, "--md-sys-color-secondary")}
      ${statChip("Fächer", swg.length, "--md-sys-color-tertiary")}
    </div>
    <div class="st-grid">
      <div class="card">
        <p class="st-head">Fächer</p>
        <div class="grade-row">
          <span class="material-symbols-rounded" style="font-size:20px;color:var(--md-sys-color-primary)">emoji_events</span>
          <span style="flex:1;font-size:13px;color:var(--md-sys-color-on-surface-variant)">Bestes Fach</span>
          <span style="font-size:14px">${sort[0]?.name ?? "—"}</span>
          <span style="font-size:12px;color:var(--md-sys-color-on-surface-variant);margin-left:6px">(Ø ${savg(sort[0]).toFixed(2)})</span>
        </div>
        <div class="grade-row">
          <span class="material-symbols-rounded" style="font-size:20px;color:var(--md-sys-color-error)">sentiment_dissatisfied</span>
          <span style="flex:1;font-size:13px;color:var(--md-sys-color-on-surface-variant)">Schlechtestes Fach</span>
          <span style="font-size:14px">${sort.at(-1)?.name ?? "—"}</span>
          <span style="font-size:12px;color:var(--md-sys-color-on-surface-variant);margin-left:6px">(Ø ${savg(sort.at(-1)).toFixed(2)})</span>
        </div>
        <div class="divider"></div>
        <p class="st-head">Noten</p>
        <div class="grade-row">${gradeBadge(best.value)}<span style="flex:1;font-size:13px;color:var(--md-sys-color-on-surface-variant)">Beste Note</span><span style="font-size:13px">${best.subject}</span></div>
        <div class="grade-row">${gradeBadge(worst.value)}<span style="flex:1;font-size:13px;color:var(--md-sys-color-on-surface-variant)">Schlechteste</span><span style="font-size:13px">${worst.subject}</span></div>
      </div>

      <div class="card">
        <p class="st-head">Notenverteilung</p>
        <div style="display:flex;align-items:flex-end;gap:8px;height:140px;padding-top:20px">
          ${Object.entries(dist).map(([g, c]) => `
            <div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1">
              <span style="font-size:12px;color:var(--md-sys-color-on-surface-variant);min-height:16px">${c || ""}</span>
              <div style="width:100%;border-radius:4px 4px 0 0;min-height:4px;
                background:${+g <= 2 ? "var(--md-sys-color-primary)" : +g <= 4 ? "var(--md-sys-color-secondary)" : "var(--md-sys-color-error)"};
                height:${Math.round((c / mx) * 100)}px"></div>
              <span style="font-size:13px;font-weight:500">${g}</span>
            </div>`).join("")}
        </div>
      </div>

      ${trends.length ? `<div class="card">
        <p class="st-head">Trendlinien</p>
        ${trends.map(t => {
          const arrow = t.slope < -.05 ? "\u2191" : t.slope > .05 ? "\u2193" : "\u2192";
          const color = t.slope < -.05 ? "#1b7e4a" : t.slope > .05 ? "var(--md-sys-color-error)" : "var(--md-sys-color-on-surface-variant)";
          return `<div class="grade-row">
            <span style="flex:1;font-size:14px">${t.name}</span>
            <span style="color:${color};font-weight:700;font-size:18px;margin-right:6px">${arrow}</span>
            <span style="font-size:12px;color:var(--md-sys-color-on-surface-variant)">Ø ${t.avg.toFixed(2)}</span>
          </div>`;
        }).join("")}
      </div>` : ""}

      ${topL.length ? `<div class="card">
        <p class="st-head">Top Labels</p>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">
          ${topL.map(([l, n]) =>
            `<span style="padding:4px 12px;border-radius:var(--shape-corner-full);
              background:var(--md-sys-color-secondary-container);
              color:var(--md-sys-color-on-secondary-container);font-size:13px">${l} <strong>${n}\u00d7</strong></span>`
          ).join("")}
        </div>
      </div>` : ""}

      ${rewardConfig.enabled ? `<div class="card">
        <p class="st-head">Belohnungen</p>
        <div style="display:flex;flex-wrap:wrap;gap:16px;margin-top:8px">
          ${statChip("Verdient",  fmt(wallet.balance + redeemed))}
          ${statChip("Eingelöst", fmt(redeemed), "--md-sys-color-secondary")}
          ${statChip("Guthaben",  fmt(wallet.balance), "--md-sys-color-tertiary")}
        </div>
      </div>` : ""}
    </div>`;
}

// ---------------------------------------------------------------------------
// Exportieren
// ---------------------------------------------------------------------------
async function renderExport(container) {
  container.innerHTML = `
    <div class="card" style="max-width:480px">
      <p class="st-head" style="margin-bottom:16px">Export erstellen</p>
      <md-outlined-text-field id="exportLabel" label="Export-Label (optional)"
          placeholder="z.B. 3. Quartal \u2013 Mai 2026" style="width:100%;margin-bottom:16px">
      </md-outlined-text-field>
      <p style="font-size:13px;color:var(--md-sys-color-on-surface-variant);margin-bottom:10px">
        Inhalt auswählen:
      </p>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px">
        <label style="display:flex;align-items:center;gap:10px;font-size:14px;cursor:pointer">
          <md-checkbox id="chkStats"  checked></md-checkbox> Statistiken
        </label>
        <label style="display:flex;align-items:center;gap:10px;font-size:14px;cursor:pointer">
          <md-checkbox id="chkGrades" checked></md-checkbox> Noten pro Fach
        </label>
        <label style="display:flex;align-items:center;gap:10px;font-size:14px;cursor:pointer">
          <md-checkbox id="chkLog"></md-checkbox> Notenänderungen
        </label>
        <label style="display:flex;align-items:center;gap:10px;font-size:14px;cursor:pointer">
          <md-checkbox id="chkRedeem"></md-checkbox> Einlösungen
        </label>
      </div>
      <md-filled-button id="btnExport">
        <span class="material-symbols-rounded" slot="icon">download</span>
        Als TXT herunterladen
      </md-filled-button>
    </div>`;

  container.querySelector("#btnExport").addEventListener("click", async () => {
    let data;
    try { data = await apiFetch("/api/export"); }
    catch(e) { showSnackbar(e.message, "error"); return; }
    if (!data.grade_count) { showSnackbar("Keine Noten vorhanden.", "error"); return; }

    const label = container.querySelector("#exportLabel").value.trim() || "Kein Label";
    const lines = buildExport(data, label, {
      incStats:  container.querySelector("#chkStats").checked,
      incGrades: container.querySelector("#chkGrades").checked,
      incLog:    container.querySelector("#chkLog").checked,
      incRedeem: container.querySelector("#chkRedeem").checked,
    });
    downloadText(lines.join("\n"), "export_" + ts() + ".txt");
    showSnackbar("Export heruntergeladen.");
  });
}

// ---------------------------------------------------------------------------
// Vergleichen
// ---------------------------------------------------------------------------
function renderCompare(container) {
  container.innerHTML = `
    <div class="card" style="max-width:560px">
      <p class="st-head" style="margin-bottom:16px">Zwei Exporte vergleichen</p>
      <p style="font-size:13px;color:var(--md-sys-color-on-surface-variant);margin-bottom:16px">
        Lade zwei exportierte TXT-Dateien hoch.
      </p>
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:20px">
        <div style="flex:1;min-width:160px">
          <p style="font-size:12px;margin-bottom:6px;color:var(--md-sys-color-on-surface-variant)">Export 1 (älter)</p>
          <input type="file" id="file1" accept=".txt" style="font-size:13px;width:100%" />
        </div>
        <div style="flex:1;min-width:160px">
          <p style="font-size:12px;margin-bottom:6px;color:var(--md-sys-color-on-surface-variant)">Export 2 (neuer)</p>
          <input type="file" id="file2" accept=".txt" style="font-size:13px;width:100%" />
        </div>
      </div>
      <md-filled-tonal-button id="btnCompare">Vergleichen</md-filled-tonal-button>
    </div>
    <div id="cmpResult" style="margin-top:20px"></div>`;

  container.querySelector("#btnCompare").addEventListener("click", async () => {
    const f1 = container.querySelector("#file1").files[0];
    const f2 = container.querySelector("#file2").files[0];
    if (!f1 || !f2) { showSnackbar("Bitte beide Dateien auswählen.", "error"); return; }
    const [t1, t2] = await Promise.all([f1.text(), f2.text()]);
    renderCmpResult(container.querySelector("#cmpResult"), parseExport(t1), parseExport(t2));
  });
}

function renderCmpResult(el, d1, d2) {
  const diff = (a, b, inv = false) => {
    if (a == null || b == null) return "—";
    const d = b - a;
    const better = inv ? d < 0 : d > 0;
    const arrow  = d === 0 ? "\u2192" : better ? "\u2191" : "\u2193";
    const color  = d === 0 ? "inherit" : better ? "#1b7e4a" : "var(--md-sys-color-error)";
    return `<span style="color:${color};font-weight:600">${arrow} ${d > 0 ? "+" : ""}${d.toFixed(2)}</span>`;
  };

  const all = [...new Set([...Object.keys(d1.subjects), ...Object.keys(d2.subjects)])].sort();

  el.innerHTML = `<div class="card" style="overflow-x:auto">
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr>
        ${["", d1.label, d2.label, "\u0394"].map(h =>
          `<th style="text-align:left;padding:6px 8px;color:var(--md-sys-color-on-surface-variant);border-bottom:1px solid var(--md-sys-color-outline-variant)">${h}</th>`
        ).join("")}
      </tr></thead>
      <tbody>
        ${row("Gesamtschnitt", d1.avg?.toFixed(2) ?? "—", d2.avg?.toFixed(2) ?? "—", diff(d1.avg, d2.avg, true))}
        ${row("Anzahl Noten", d1.cnt ?? "—", d2.cnt ?? "—",
          d1.cnt != null && d2.cnt != null ? (d2.cnt - d1.cnt > 0 ? "+" : "") + (d2.cnt - d1.cnt) : "—")}
        ${row("Bestes Fach", d1.best ?? "—", d2.best ?? "—", "")}
        ${row("Schwächstes", d1.worst ?? "—", d2.worst ?? "—", "")}
        <tr><td colspan="4" style="padding:8px;border-bottom:1px solid var(--md-sys-color-outline-variant);font-size:12px;font-weight:600;color:var(--md-sys-color-on-surface-variant)">Fächer</td></tr>
        ${all.map(n => {
          const a1 = d1.subjects[n], a2 = d2.subjects[n];
          return row(n, a1 != null ? a1.toFixed(2) : "—", a2 != null ? a2.toFixed(2) : "—", diff(a1, a2, true));
        }).join("")}
      </tbody>
    </table>
  </div>`;
}

function row(label, v1, v2, d) {
  const td = s => `<td style="padding:8px;border-bottom:1px solid var(--md-sys-color-outline-variant)">${s}</td>`;
  return `<tr>
    ${td(`<span style="font-size:13px;color:var(--md-sys-color-on-surface-variant)">${label}</span>`)}
    ${td(v1)}${td(v2)}${td(d)}
  </tr>`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function buildExport(data, label, { incStats, incGrades, incLog, incRedeem }) {
  const cfg = data.reward_config;
  const fmt = v => fmtReward(v, cfg);
  const L = [
    "NOTENRECHNER EXPORT",
    "Label:    " + label,
    "Erstellt: " + new Date().toLocaleString("de-DE"),
  ];
  if (incStats && data.overall_average != null) {
    L.push("", "=== STATISTIKEN ===");
    L.push("Gesamtdurchschnitt: " + data.overall_average.toFixed(2));
    L.push("Anzahl Noten: " + data.grade_count);
    if (data.top_labels?.length) L.push("Top Labels: " + data.top_labels.map(x => x.label + " (" + x.count + "x)").join(", "));
    if (data.best_subject)  L.push("Bestes Fach: "          + data.best_subject.name  + " (" + data.best_subject.average  + ")");
    if (data.worst_subject) L.push("Schlechtestes Fach: "   + data.worst_subject.name + " (" + data.worst_subject.average + ")");
    if (data.best_grade)    L.push("Beste Note: "           + data.best_grade.value   + " in '" + data.best_grade.subject  + "'");
    if (data.worst_grade)   L.push("Schlechteste Note: "    + data.worst_grade.value  + " in '" + data.worst_grade.subject + "'");
    if (cfg.enabled) {
      L.push("Verdient:     " + fmt(data.wallet_balance + data.total_redeemed));
      L.push("Eingelöst:    " + fmt(data.total_redeemed));
      L.push("Restguthaben: " + fmt(data.wallet_balance));
    }
  }
  if (incGrades) {
    L.push("", "=== NOTEN PRO FACH ===");
    data.subjects.forEach(s => {
      const w = s.grades.reduce((a, g) => a + g.weight, 0);
      const a = w ? s.grades.reduce((a, g) => a + g.value * g.weight, 0) / w : 0;
      L.push("Fach: " + s.name + " | \u00d8 " + a.toFixed(2));
      s.grades.forEach(g => L.push("  " + g.value + " | " + g.weight + "x | " + (g.labels.join(", ") || "\u2013")));
      L.push("");
    });
  }
  if (incLog && data.grade_log?.length) {
    L.push("", "=== NOTENÄNDERUNGEN ===");
    const sym = { "+": "Hinzugefügt", "-": "Gelöscht", "~": "Bearbeitet" };
    [...data.grade_log].reverse().forEach(e =>
      L.push((sym[e.action] ?? e.action) + " | " + e.date + " | " + e.subject + " | " + e.value + " (" + e.weight + "x)")
    );
  }
  if (incRedeem && data.redemptions?.length) {
    L.push("", "=== EINLÖSUNGEN ===");
    [...data.redemptions].reverse().forEach(r =>
      L.push(r.description + " | -" + fmt(r.cost) + " | " + (r.date ?? ""))
    );
  }
  L.push("", "[EXPORT_LABEL=" + label + "]");
  return L;
}

function parseExport(text) {
  const r = { label: "Unbekannt", avg: null, cnt: null, best: null, worst: null, subjects: {} };
  for (const line of text.split("\n")) {
    if      (line.startsWith("Label:"))              r.label = line.split(":").slice(1).join(":").trim();
    else if (line.startsWith("Gesamtdurchschnitt:")) r.avg   = parseFloat(line.split(":")[1]);
    else if (line.startsWith("Anzahl"))              r.cnt   = parseInt(line.split(":")[1]);
    else if (line.startsWith("Bestes Fach:"))        r.best  = line.split(":").slice(1).join(":").trim();
    else if (line.startsWith("Schlechtestes Fach:")) r.worst = line.split(":").slice(1).join(":").trim();
    else if (line.startsWith("Fach:")) {
      const p = line.split("|"), name = p[0].replace("Fach:", "").trim(), avg = parseFloat((p[1] ?? "").replace("\u00d8", ""));
      if (!isNaN(avg)) r.subjects[name] = avg;
    }
  }
  return r;
}

function fmtReward(v, cfg) {
  if (!cfg?.enabled) return String(v);
  if (cfg.reward_mode === "money") return Number(v).toFixed(2) + " \u20ac";
  if (cfg.reward_mode === "unit")  return v + " " + cfg.unit_name;
  return Math.round(v) + " Pt.";
}

function downloadText(content, filename) {
  const a = Object.assign(document.createElement("a"), {
    href:     URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" })),
    download: filename,
  });
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

function ts() {
  return new Date().toISOString().slice(0, 13).replace(/[-T:]/g, "");
}

function injectStyles() {
  if (document.getElementById("st-css")) return;
  const s = document.createElement("style"); s.id = "st-css";
  s.textContent = `
    .st-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px; }
    .st-head { font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;
               color:var(--md-sys-color-on-surface-variant);margin-bottom:8px; }
    @media(max-width:600px){ .st-grid{grid-template-columns:1fr;} }
  `;
  document.head.appendChild(s);
}
