/**
 * settings.js – Sub-navigation like CLI: main menu → section → back
 */
import { apiFetch, showSnackbar, clearPrimaryAction } from "../app.js";
import { emptyState, errorBanner, openDialog, injectComponentStyles } from "../components.js";

// Navigation stack: ["main"] | ["main","rewards"] | ["main","rewards","points"] etc.
let stack = ["main"];

export default async function render(container) {
  injectComponentStyles();
  clearPrimaryAction();
  stack = ["main"]; // reset on page entry
  await renderCurrent(container);
}

async function renderCurrent(container) {
  const page = stack.at(-1);
  if      (page === "main")    renderMain(container);
  else if (page === "rewards") await renderRewards(container);
  else if (page === "paths")   await renderPaths(container);
  else if (page === "reset")   renderReset(container);
}

function backBar(title, container) {
  return `<div class="back-bar" style="margin-bottom:20px">
    <button class="icon-btn" id="btnBack">
      <span class="material-symbols-rounded">arrow_back</span>
    </button>
    <span class="back-bar__title">${title}</span>
  </div>`;
}

function bindBack(container) {
  container.querySelector("#btnBack")?.addEventListener("click", () => {
    stack.pop();
    renderCurrent(container);
  });
}

// ---------------------------------------------------------------------------
// Main menu
// ---------------------------------------------------------------------------
function renderMain(container) {
  container.innerHTML = `
    <h2 style="font-size:22px;font-weight:500;margin-bottom:20px">Einstellungen</h2>
    <div class="settings-menu">
      ${menuItem("Belohnungssystem", "redeem",  "rewards", "Punkte, Modus, Guthaben")}
      ${menuItem("Datenpfade",       "folder",  "paths",   "Wo Daten gespeichert werden")}
      ${menuItem("Backup & Reset",   "restart_alt", "reset", "Backup herunterladen, Daten zurücksetzen")}
    </div>`;

  container.querySelectorAll(".settings-menu-item").forEach(btn => {
    btn.addEventListener("click", () => {
      stack.push(btn.dataset.target);
      renderCurrent(container);
    });
  });
}

function menuItem(label, icon, target, sub = "") {
  return `<button class="settings-menu-item" data-target="${target}">
    <div>
      <div style="font-size:15px;font-weight:500">${label}</div>
      ${sub ? `<div style="font-size:12px;color:var(--md-sys-color-on-surface-variant);margin-top:2px">${sub}</div>` : ""}
    </div>
    <span class="material-symbols-rounded">chevron_right</span>
  </button>`;
}

// ---------------------------------------------------------------------------
// Rewards section
// ---------------------------------------------------------------------------
async function renderRewards(container) {
  container.innerHTML = backBar("Belohnungssystem", container) +
    `<div class="page-placeholder"><span class="material-symbols-rounded page-placeholder__icon">hourglass_top</span></div>`;
  bindBack(container);

  let cfg;
  try { cfg = await apiFetch("/api/reward-config"); }
  catch(e) { showSnackbar(e.message,"error"); return; }

  const modeLabel = {money:"Geld (€)", unit:"Eigene Einheit", points:"Nur Punkte"};

  const inner = document.createElement("div");
  inner.innerHTML = `
    <!-- Toggle -->
    <div class="card" style="margin-bottom:12px">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-size:15px;font-weight:500">Belohnungssystem</div>
          <div style="font-size:12px;color:var(--md-sys-color-on-surface-variant);margin-top:2px">
            ${cfg.enabled ? "Aktiv" : "Deaktiviert"}
          </div>
        </div>
        <md-switch id="swEnabled" ${cfg.enabled?"selected":""}></md-switch>
      </div>
    </div>

    ${cfg.enabled ? `
    <!-- Mode -->
    <div class="card" style="margin-bottom:12px">
      <div style="font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;
                  color:var(--md-sys-color-on-surface-variant);margin-bottom:12px">Modus</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${["money","unit","points"].map(m=>`
          <button class="tab-pill ${cfg.reward_mode===m?"tab-pill--active":""}" data-mode="${m}">
            ${modeLabel[m]}
          </button>`).join("")}
      </div>
    </div>

    ${cfg.reward_mode==="money" ? `
    <div class="card" style="margin-bottom:12px">
      <div style="font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;
                  color:var(--md-sys-color-on-surface-variant);margin-bottom:12px">Geld pro Punkt</div>
      <div style="display:flex;gap:8px;align-items:center">
        <md-outlined-text-field id="fldMoney" label="€ / Punkt" type="number"
            min="0.01" step="0.01" value="${cfg.money_per_point.toFixed(2)}" style="flex:1">
        </md-outlined-text-field>
        <md-filled-tonal-button id="btnSaveMoney">Speichern</md-filled-tonal-button>
      </div>
    </div>` : ""}

    ${cfg.reward_mode==="unit" ? `
    <div class="card" style="margin-bottom:12px">
      <div style="font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;
                  color:var(--md-sys-color-on-surface-variant);margin-bottom:12px">Eigene Einheit</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <md-outlined-text-field id="fldUnitName" label="Einheitsname"
            value="${cfg.unit_name}" style="flex:1;min-width:140px"></md-outlined-text-field>
        <md-outlined-text-field id="fldUnitPerPt" label="Einheiten/Pt" type="number"
            min="0.01" step="0.01" value="${cfg.unit_per_point}" style="flex:1;min-width:120px">
        </md-outlined-text-field>
        <md-filled-tonal-button id="btnSaveUnit" style="align-self:flex-end">Speichern</md-filled-tonal-button>
      </div>
    </div>` : ""}

    <!-- Points per grade -->
    <div class="card" style="margin-bottom:12px">
      <div style="font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;
                  color:var(--md-sys-color-on-surface-variant);margin-bottom:12px">Punkte pro Note</div>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        ${Object.entries(cfg.points_map).map(([g,p])=>`
          <tr>
            <td style="padding:6px 4px;font-weight:500;width:60px">Note ${g}</td>
            <td><input type="number" class="pts-input" data-grade="${g}" value="${p}"
                min="0" step="1"
                style="width:80px;padding:6px 10px;border-radius:var(--shape-corner-extra-small);
                border:1px solid var(--md-sys-color-outline);font-size:14px;
                background:var(--md-sys-color-surface);color:var(--md-sys-color-on-surface)"/></td>
            <td style="font-size:12px;color:var(--md-sys-color-on-surface-variant);padding-left:8px">
              ${cfg.reward_mode==="money" ? `= ${(p*cfg.money_per_point).toFixed(2)} €`
                :cfg.reward_mode==="unit"  ? `= ${p*cfg.unit_per_point} ${cfg.unit_name}`
                : `= ${p} Pt.`}
            </td>
          </tr>`).join("")}
      </table>
      <div style="margin-top:12px">
        <md-filled-tonal-button id="btnSavePts">Punkte speichern</md-filled-tonal-button>
      </div>
    </div>` : ""}`;

  container.appendChild(inner);

  // Wire events
  inner.querySelector("#swEnabled")?.addEventListener("change", async e => {
    cfg.enabled = e.target.selected;
    try { await saveConfig(cfg); showSnackbar(cfg.enabled?"Aktiviert.":"Deaktiviert."); await renderRewards(container); }
    catch(err) { showSnackbar(err.message,"error"); }
  });

  inner.querySelectorAll("[data-mode]").forEach(btn => {
    btn.addEventListener("click", async () => {
      cfg.reward_mode = btn.dataset.mode;
      try { await saveConfig(cfg); showSnackbar("Modus geändert."); await renderRewards(container); }
      catch(err) { showSnackbar(err.message,"error"); }
    });
  });

  inner.querySelector("#btnSaveMoney")?.addEventListener("click", async () => {
    const v = parseFloat(inner.querySelector("#fldMoney").value);
    if (isNaN(v)||v<=0) { showSnackbar("Ungültiger Wert.","error"); return; }
    cfg.money_per_point = v;
    try { await saveConfig(cfg); showSnackbar("Gespeichert."); await renderRewards(container); }
    catch(e) { showSnackbar(e.message,"error"); }
  });

  inner.querySelector("#btnSaveUnit")?.addEventListener("click", async () => {
    const name = inner.querySelector("#fldUnitName").value.trim();
    const perPt = parseFloat(inner.querySelector("#fldUnitPerPt").value);
    if (!name||isNaN(perPt)||perPt<=0) { showSnackbar("Ungültige Eingabe.","error"); return; }
    cfg.unit_name=name; cfg.unit_per_point=perPt;
    try { await saveConfig(cfg); showSnackbar("Gespeichert."); await renderRewards(container); }
    catch(e) { showSnackbar(e.message,"error"); }
  });

  inner.querySelector("#btnSavePts")?.addEventListener("click", async () => {
    inner.querySelectorAll(".pts-input").forEach(inp => {
      const g=parseInt(inp.dataset.grade), p=parseInt(inp.value);
      if (!isNaN(p)&&p>=0) cfg.points_map[g]=p;
    });
    try { await saveConfig(cfg); showSnackbar("Punkte gespeichert."); await renderRewards(container); }
    catch(e) { showSnackbar(e.message,"error"); }
  });
}

// ---------------------------------------------------------------------------
// Paths section
// ---------------------------------------------------------------------------
async function renderPaths(container) {
  container.innerHTML = backBar("Datenpfade", container);
  bindBack(container);

  let appCfg;
  try { appCfg = await apiFetch("/api/app-config"); }
  catch(e) { container.innerHTML += errorBanner(e.message); return; }

  const row = (label, val) => `
    <div style="margin-bottom:12px">
      <div style="font-size:12px;color:var(--md-sys-color-on-surface-variant);margin-bottom:2px">${label}</div>
      <code style="font-size:13px;word-break:break-all">${val}</code>
    </div>`;

  const info = document.createElement("div");
  info.className = "card";
  info.innerHTML =
    row("Noten",              appCfg.data_path) +
    row("Wallet",             appCfg.wallet_path) +
    row("Belohnungskonfig",   appCfg.reward_config_path) +
    row("App-Konfiguration",  appCfg.app_config_path) +
    row("Backup-Verzeichnis", appCfg.backup_path) +
    `<div style="margin-top:12px;font-size:13px;color:var(--md-sys-color-on-surface-variant)">
       Pfade über <code>DATA_DIR</code> in <code>.env</code> konfigurierbar.
     </div>`;
  container.appendChild(info);
}

// ---------------------------------------------------------------------------
// Backup & Reset
// ---------------------------------------------------------------------------
function renderReset(container) {
  container.innerHTML = backBar("Backup & Reset", container);
  bindBack(container);

  const inner = document.createElement("div");
  inner.innerHTML = `
    <div class="settings-menu">
      <div class="card" style="margin-bottom:12px">
        <div style="font-size:15px;font-weight:500;margin-bottom:8px">Backup</div>
        <p style="font-size:13px;color:var(--md-sys-color-on-surface-variant);margin-bottom:16px">
          Lädt alle Datendateien als ZIP herunter.
        </p>
        <md-filled-tonal-button id="btnBackup">
          <span class="material-symbols-rounded" slot="icon">download</span>
          Backup herunterladen
        </md-filled-tonal-button>
      </div>

      <div class="card" style="border:1px solid var(--md-sys-color-error-container)">
        <div style="font-size:15px;font-weight:500;margin-bottom:8px;
                    color:var(--md-sys-color-error)">Gefahrenzone</div>
        <p style="font-size:13px;color:var(--md-sys-color-on-surface-variant);margin-bottom:16px">
          Diese Aktionen können nicht rückgängig gemacht werden (außer über ein Backup).
        </p>
        <div style="display:flex;flex-direction:column;gap:8px">
          <md-outlined-button id="btnResetRewards" style="--md-outlined-button-outline-color:var(--md-sys-color-error);color:var(--md-sys-color-error)">
            Belohnungskonfig zurücksetzen
          </md-outlined-button>
        </div>
      </div>
    </div>`;
  container.appendChild(inner);

  inner.querySelector("#btnBackup").addEventListener("click", () => {
    const a = Object.assign(document.createElement("a"), {href:"/api/backup"});
    document.body.appendChild(a); a.click(); a.remove();
    showSnackbar("Backup wird heruntergeladen…");
  });

  inner.querySelector("#btnResetRewards").addEventListener("click", async () => {
    if (!confirm("Belohnungskonfiguration wirklich auf Standardwerte zurücksetzen?")) return;
    try {
      await apiFetch("/api/reward-config", {method:"POST",
        body:JSON.stringify({enabled:false,points_map:{1:10,2:6,3:2,4:0,5:0,6:0},
          money_per_point:0.5,reward_mode:"money",unit_name:"",unit_per_point:1})
      });
      showSnackbar("Belohnungskonfiguration zurückgesetzt.");
    } catch(e) { showSnackbar(e.message,"error"); }
  });
}

async function saveConfig(cfg) {
  await apiFetch("/api/reward-config", {method:"POST", body:JSON.stringify(cfg)});
}
