/**
 * settings.js – Reward system config + app info
 *
 * Sections:
 *  1. Reward system toggle (enable / disable)
 *  2. Reward mode selector (money | unit | points)
 *  3. Points-per-grade table (editable inline)
 *  4. Money-per-point or unit config (context-sensitive)
 *  5. App info (version, data paths via /api/app-config once added)
 */
import { apiFetch, showSnackbar } from "../app.js";
import { card, emptyState, errorBanner, openDialog, injectComponentStyles } from "../components.js";

export default async function render(container) {
  injectComponentStyles();
  injectSettingsStyles();

  let cfg;
  try {
    cfg = await apiFetch("/api/reward-config");
  } catch(e) {
    container.innerHTML = errorBanner(e.message);
    return;
  }

  renderShell(container, cfg);
}

function renderShell(container, cfg) {
  const modeLabel = { money:"Geld (€)", unit:"Eigene Einheit", points:"Nur Punkte" };

  // Points-per-grade table rows
  const ptRows = Object.entries(cfg.points_map).map(([grade, pts]) => `
    <tr>
      <td style="width:60px"><strong>Note ${grade}</strong></td>
      <td>
        <input class="st-pts-input" type="number" min="0" step="1"
               data-grade="${grade}" value="${pts}" />
      </td>
      <td style="font-size:12px;color:var(--md-sys-color-on-surface-variant)">
        ${cfg.reward_mode === "money" ? `= ${(pts * cfg.money_per_point).toFixed(2)} €`
          : cfg.reward_mode === "unit" ? `= ${pts * cfg.unit_per_point} ${cfg.unit_name}`
          : `= ${pts} Pt.`}
      </td>
    </tr>`).join("");

  container.innerHTML = `
    <!-- Toggle -->
    <div class="card se-section">
      <div class="se-row">
        <div>
          <div class="se-label">Belohnungssystem</div>
          <div class="se-sublabel">${cfg.enabled ? "Aktiv – Noten werden mit Punkten belohnt." : "Deaktiviert."}</div>
        </div>
        <md-switch id="swEnabled" ${cfg.enabled ? "selected" : ""}></md-switch>
      </div>
    </div>

    ${cfg.enabled ? `
    <!-- Reward mode -->
    <div class="card se-section">
      <div class="se-label" style="margin-bottom:12px">Belohnungsmodus</div>
      <div class="se-mode-group">
        ${["money","unit","points"].map(m => `
          <button class="se-mode-btn ${cfg.reward_mode===m?"se-mode-btn--active":""}"
                  data-mode="${m}">${modeLabel[m]}</button>`).join("")}
      </div>
    </div>

    <!-- Mode-specific config -->
    ${cfg.reward_mode === "money" ? `
    <div class="card se-section">
      <div class="se-label">Geld pro Punkt</div>
      <div class="se-row" style="margin-top:12px">
        <md-outlined-text-field id="fldMoneyPerPt" label="€ / Punkt" type="number"
            min="0.01" step="0.01" value="${cfg.money_per_point.toFixed(2)}"
            style="flex:1"></md-outlined-text-field>
        <md-filled-tonal-button id="btnSaveMoney">Speichern</md-filled-tonal-button>
      </div>
    </div>` : ""}

    ${cfg.reward_mode === "unit" ? `
    <div class="card se-section">
      <div class="se-label">Eigene Einheit</div>
      <div class="se-row" style="margin-top:12px;gap:12px;flex-wrap:wrap">
        <md-outlined-text-field id="fldUnitName"  label="Einheitsname"   value="${cfg.unit_name}"   style="flex:1"></md-outlined-text-field>
        <md-outlined-text-field id="fldUnitPerPt" label="Einheiten / Pt" type="number" min="0.01" step="0.01"
            value="${cfg.unit_per_point}" style="flex:1"></md-outlined-text-field>
        <md-filled-tonal-button id="btnSaveUnit">Speichern</md-filled-tonal-button>
      </div>
    </div>` : ""}

    <!-- Points per grade -->
    <div class="card se-section">
      <div class="se-label" style="margin-bottom:12px">Punkte pro Note</div>
      <table class="se-pts-table"><tbody>${ptRows}</tbody></table>
      <div style="margin-top:16px">
        <md-filled-tonal-button id="btnSavePts">Punkte speichern</md-filled-tonal-button>
      </div>
    </div>
    ` : ""}

    <!-- App info -->
    <div class="card se-section" style="margin-top:8px">
      <div class="se-label">App-Info</div>
      <p style="font-size:13px;color:var(--md-sys-color-on-surface-variant);margin-top:8px">
        Notenrechner – Bayerisches Notensystem 1–6<br>
        Web-Migration basiert auf dem Python-CLI-Original.
      </p>
    </div>`;

  bindEvents(container, cfg);
}

// ---- Event binding ----

function bindEvents(container, cfg) {
  // Toggle enabled
  container.querySelector("#swEnabled")?.addEventListener("change", async e => {
    try {
      // We patch the full config via a PATCH-like POST (our API doesn't have PATCH yet,
      // so we POST the full updated object to a dedicated toggle endpoint – add in Phase 3,
      // for now we show an info snackbar and re-render optimistically).
      cfg.enabled = e.target.selected;
      await saveConfig(cfg);
      showSnackbar(cfg.enabled ? "Belohnungssystem aktiviert." : "Belohnungssystem deaktiviert.");
      renderShell(container, cfg);
    } catch(err) { showSnackbar(err.message, "error"); }
  });

  // Reward mode buttons
  container.querySelectorAll(".se-mode-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      cfg.reward_mode = btn.dataset.mode;
      try {
        await saveConfig(cfg);
        showSnackbar(`Modus geändert: ${btn.textContent}`);
        renderShell(container, cfg);
      } catch(err) { showSnackbar(err.message, "error"); }
    });
  });

  // Money per point
  container.querySelector("#btnSaveMoney")?.addEventListener("click", async () => {
    const val = parseFloat(container.querySelector("#fldMoneyPerPt").value);
    if (isNaN(val) || val <= 0) { showSnackbar("Ungültiger Wert.", "error"); return; }
    cfg.money_per_point = val;
    try { await saveConfig(cfg); showSnackbar("Gespeichert."); renderShell(container, cfg); }
    catch(err) { showSnackbar(err.message, "error"); }
  });

  // Unit config
  container.querySelector("#btnSaveUnit")?.addEventListener("click", async () => {
    const name = container.querySelector("#fldUnitName").value.trim();
    const perPt = parseFloat(container.querySelector("#fldUnitPerPt").value);
    if (!name) { showSnackbar("Name darf nicht leer sein.", "error"); return; }
    if (isNaN(perPt) || perPt <= 0) { showSnackbar("Ungültiger Wert.", "error"); return; }
    cfg.unit_name = name; cfg.unit_per_point = perPt;
    try { await saveConfig(cfg); showSnackbar("Gespeichert."); renderShell(container, cfg); }
    catch(err) { showSnackbar(err.message, "error"); }
  });

  // Points per grade
  container.querySelector("#btnSavePts")?.addEventListener("click", async () => {
    container.querySelectorAll(".st-pts-input").forEach(inp => {
      const grade = parseInt(inp.dataset.grade);
      const pts   = parseInt(inp.value);
      if (!isNaN(pts) && pts >= 0) cfg.points_map[grade] = pts;
    });
    try { await saveConfig(cfg); showSnackbar("Punkte gespeichert."); renderShell(container, cfg); }
    catch(err) { showSnackbar(err.message, "error"); }
  });
}

// ---- Save helper ----
// Sends the full updated RewardConfig back. A dedicated PATCH /api/reward-config
// route will be added in Phase 3; for now we reuse the existing structure.
async function saveConfig(cfg) {
  await apiFetch("/api/reward-config", {
    method: "POST",
    body: JSON.stringify(cfg),
  });
}

function injectSettingsStyles() {
  if (document.getElementById("se-css")) return;
  const s = document.createElement("style"); s.id = "se-css";
  s.textContent = `
    .se-section  { margin-bottom:16px; }
    .se-label    { font-size:15px;font-weight:600;color:var(--md-sys-color-on-surface); }
    .se-sublabel { font-size:13px;color:var(--md-sys-color-on-surface-variant);margin-top:2px; }
    .se-row      { display:flex;align-items:center;justify-content:space-between;gap:12px; }
    .se-mode-group { display:flex;gap:8px;flex-wrap:wrap; }
    .se-mode-btn { padding:8px 18px;border-radius:var(--shape-corner-full);
                   border:1px solid var(--md-sys-color-outline);background:transparent;
                   cursor:pointer;font-size:14px;color:var(--md-sys-color-on-surface);
                   transition:background .2s,color .2s; }
    .se-mode-btn--active { background:var(--md-sys-color-primary);color:var(--md-sys-color-on-primary);
                           border-color:var(--md-sys-color-primary); }
    .se-pts-table { width:100%;border-collapse:collapse;font-size:14px; }
    .se-pts-table td { padding:6px 4px; }
    .st-pts-input { width:80px;padding:6px 8px;border-radius:var(--shape-corner-extra-small);
                    border:1px solid var(--md-sys-color-outline);font-size:14px;
                    background:var(--md-sys-color-surface);color:var(--md-sys-color-on-surface); }
  `;
  document.head.appendChild(s);
}
