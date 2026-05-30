/**
 * settings.js – Stack-based sub-navigation
 * Sections: Belohnungssystem | Datenpfade | Ladehinweise | Backup & Reset
 */
import { apiFetch, showSnackbar, clearPrimaryAction } from "../app.js";
import { emptyState, errorBanner, openDialog, injectComponentStyles } from "../components.js";

let stack = ["main"];

export default async function render(container) {
  injectComponentStyles();
  clearPrimaryAction();
  stack = ["main"];
  renderCurrent(container);
}

async function renderCurrent(container) {
  const page = stack.at(-1);
  if      (page === "main")    renderMain(container);
  else if (page === "rewards") await renderRewards(container);
  else if (page === "paths")   await renderPaths(container);
  else if (page === "loading") await renderLoading(container);
  else if (page === "reset")   renderReset(container);
}

function back(container) {
  stack.pop();
  renderCurrent(container);
}

function backBar(title) {
  return `<div class="back-bar" style="margin-bottom:20px" id="backBar">
    <button class="icon-btn" id="btnBack">
      <span class="material-symbols-rounded">arrow_back</span>
    </button>
    <span class="back-bar__title">${title}</span>
  </div>`;
}

function bindBack(container) {
  container.querySelector("#btnBack")?.addEventListener("click", () => back(container));
}

// ---------------------------------------------------------------------------
// Main menu
// ---------------------------------------------------------------------------
function renderMain(container) {
  container.innerHTML = `
    <h2 style="font-size:22px;font-weight:500;margin-bottom:20px">Einstellungen</h2>
    <div class="settings-menu">
      ${item("Belohnungssystem", "redeem",       "rewards", "Punkte, Modus, Belohnungen")}
      ${item("Datenpfade",       "folder",        "paths",   "Speicherorte der JSON-Dateien")}
      ${item("Ladehinweise",     "notifications", "loading", "Verbose-Loading ein-/ausschalten")}
      ${item("Backup & Reset",   "restart_alt",   "reset",   "Backup, Logs leeren, Daten zurücksetzen")}
    </div>`;

  container.querySelectorAll(".settings-menu-item").forEach(btn =>
    btn.addEventListener("click", () => { stack.push(btn.dataset.target); renderCurrent(container); })
  );
}

function item(label, icon, target, sub = "") {
  return `<button class="settings-menu-item" data-target="${target}">
    <div>
      <div style="font-size:15px;font-weight:500">${label}</div>
      ${sub ? `<div style="font-size:12px;color:var(--md-sys-color-on-surface-variant);margin-top:2px">${sub}</div>` : ""}
    </div>
    <span class="material-symbols-rounded">chevron_right</span>
  </button>`;
}

// ---------------------------------------------------------------------------
// Belohnungssystem
// ---------------------------------------------------------------------------
async function renderRewards(container) {
  container.innerHTML = backBar("Belohnungssystem");
  bindBack(container);

  let cfg;
  try { cfg = await apiFetch("/api/reward-config"); }
  catch(e) { container.innerHTML += errorBanner(e.message); return; }

  const modeLabel = { money: "Geld (\u20ac)", unit: "Eigene Einheit", points: "Nur Punkte" };
  const div = document.createElement("div");
  div.innerHTML = `
    <div class="card" style="margin-bottom:12px">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-size:15px;font-weight:500">Belohnungssystem</div>
          <div style="font-size:12px;color:var(--md-sys-color-on-surface-variant);margin-top:2px">
            ${cfg.enabled ? "Aktiv" : "Deaktiviert"}
          </div>
        </div>
        <md-switch id="swEnabled" ${cfg.enabled ? "selected" : ""}></md-switch>
      </div>
    </div>

    ${cfg.enabled ? `
    <div class="card" style="margin-bottom:12px">
      <div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;
                  color:var(--md-sys-color-on-surface-variant);margin-bottom:12px">Modus</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${["money", "unit", "points"].map(m =>
          `<button class="tab-pill ${cfg.reward_mode === m ? "tab-pill--active" : ""}" data-mode="${m}">
             ${modeLabel[m]}
           </button>`).join("")}
      </div>
    </div>

    ${cfg.reward_mode === "money" ? `
    <div class="card" style="margin-bottom:12px">
      <div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;
                  color:var(--md-sys-color-on-surface-variant);margin-bottom:12px">Geld pro Punkt</div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <md-outlined-text-field id="fldMoney" label="\u20ac / Punkt" type="number"
            min="0.01" step="0.01" value="${cfg.money_per_point.toFixed(2)}" style="flex:1;min-width:120px">
        </md-outlined-text-field>
        <md-filled-tonal-button id="btnSaveMoney">Speichern</md-filled-tonal-button>
      </div>
    </div>` : ""}

    ${cfg.reward_mode === "unit" ? `
    <div class="card" style="margin-bottom:12px">
      <div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;
                  color:var(--md-sys-color-on-surface-variant);margin-bottom:12px">Eigene Einheit</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">
        <md-outlined-text-field id="fldUnitName" label="Name" value="${cfg.unit_name}"
            style="flex:1;min-width:130px"></md-outlined-text-field>
        <md-outlined-text-field id="fldUnitPerPt" label="pro Punkt" type="number"
            min="0.01" step="0.01" value="${cfg.unit_per_point}"
            style="flex:1;min-width:110px"></md-outlined-text-field>
        <md-filled-tonal-button id="btnSaveUnit">Speichern</md-filled-tonal-button>
      </div>
    </div>` : ""}

    <div class="card">
      <div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;
                  color:var(--md-sys-color-on-surface-variant);margin-bottom:12px">Punkte pro Note</div>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        ${Object.entries(cfg.points_map).map(([g, p]) => `
          <tr>
            <td style="padding:6px 4px;font-weight:500;width:60px">Note ${g}</td>
            <td><input type="number" class="pts-input" data-grade="${g}" value="${p}" min="0" step="1"
                style="width:72px;padding:6px 8px;border-radius:var(--shape-corner-extra-small);
                border:1px solid var(--md-sys-color-outline);font-size:14px;
                background:var(--md-sys-color-surface);color:var(--md-sys-color-on-surface)"/></td>
            <td style="font-size:12px;color:var(--md-sys-color-on-surface-variant);padding-left:8px">
              ${cfg.reward_mode === "money" ? "= " + (p * cfg.money_per_point).toFixed(2) + " \u20ac"
                : cfg.reward_mode === "unit" ? "= " + (p * cfg.unit_per_point) + " " + cfg.unit_name
                : "= " + p + " Pt."}
            </td>
          </tr>`).join("")}
      </table>
      <div style="margin-top:12px">
        <md-filled-tonal-button id="btnSavePts">Punkte speichern</md-filled-tonal-button>
      </div>
    </div>` : ""}`;

  container.appendChild(div);

  div.querySelector("#swEnabled")?.addEventListener("change", async e => {
    cfg.enabled = e.target.selected;
    try { await save(cfg); showSnackbar(cfg.enabled ? "Aktiviert." : "Deaktiviert."); await renderRewards(container); }
    catch(err) { showSnackbar(err.message, "error"); }
  });
  div.querySelectorAll("[data-mode]").forEach(btn =>
    btn.addEventListener("click", async () => {
      cfg.reward_mode = btn.dataset.mode;
      try { await save(cfg); showSnackbar("Modus geändert."); await renderRewards(container); }
      catch(err) { showSnackbar(err.message, "error"); }
    })
  );
  div.querySelector("#btnSaveMoney")?.addEventListener("click", async () => {
    const v = parseFloat(div.querySelector("#fldMoney").value);
    if (isNaN(v) || v <= 0) { showSnackbar("Ungültiger Wert.", "error"); return; }
    cfg.money_per_point = v;
    try { await save(cfg); showSnackbar("Gespeichert."); await renderRewards(container); }
    catch(e) { showSnackbar(e.message, "error"); }
  });
  div.querySelector("#btnSaveUnit")?.addEventListener("click", async () => {
    const n = div.querySelector("#fldUnitName").value.trim();
    const p = parseFloat(div.querySelector("#fldUnitPerPt").value);
    if (!n || isNaN(p) || p <= 0) { showSnackbar("Ungültige Eingabe.", "error"); return; }
    cfg.unit_name = n; cfg.unit_per_point = p;
    try { await save(cfg); showSnackbar("Gespeichert."); await renderRewards(container); }
    catch(e) { showSnackbar(e.message, "error"); }
  });
  div.querySelector("#btnSavePts")?.addEventListener("click", async () => {
    div.querySelectorAll(".pts-input").forEach(inp => {
      const g = parseInt(inp.dataset.grade), p = parseInt(inp.value);
      if (!isNaN(p) && p >= 0) cfg.points_map[g] = p;
    });
    try { await save(cfg); showSnackbar("Gespeichert."); await renderRewards(container); }
    catch(e) { showSnackbar(e.message, "error"); }
  });
}

// ---------------------------------------------------------------------------
// Datenpfade
// ---------------------------------------------------------------------------
async function renderPaths(container) {
  container.innerHTML = backBar("Datenpfade");
  bindBack(container);

  let appCfg;
  try { appCfg = await apiFetch("/api/app-config"); }
  catch(e) { container.innerHTML += errorBanner(e.message); return; }

  const p = (label, val) => `
    <div style="margin-bottom:14px">
      <div style="font-size:12px;color:var(--md-sys-color-on-surface-variant);margin-bottom:2px">${label}</div>
      <code style="font-size:13px;word-break:break-all;display:block">${val}</code>
    </div>`;

  const div = document.createElement("div");
  div.className = "card";
  div.innerHTML =
    p("Noten",             appCfg.data_path) +
    p("Wallet",            appCfg.wallet_path) +
    p("Belohnungskonfig",  appCfg.reward_config_path) +
    p("App-Konfiguration", appCfg.app_config_path) +
    p("Backups",           appCfg.backup_path) +
    `<p style="font-size:13px;color:var(--md-sys-color-on-surface-variant);margin-top:8px">
      Pfade über <code>DATA_DIR</code> in <code>.env</code> konfigurierbar.
    </p>`;
  container.appendChild(div);
}

// ---------------------------------------------------------------------------
// Ladehinweise
// ---------------------------------------------------------------------------
async function renderLoading(container) {
  container.innerHTML = backBar("Ladehinweise");
  bindBack(container);

  let appCfg;
  try { appCfg = await apiFetch("/api/app-config"); }
  catch(e) { container.innerHTML += errorBanner(e.message); return; }

  const div = document.createElement("div");
  div.className = "card";
  div.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between">
      <div>
        <div style="font-size:15px;font-weight:500">Verbose Loading</div>
        <div style="font-size:12px;color:var(--md-sys-color-on-surface-variant);margin-top:2px">
          ${appCfg.verbose_loading ? "Aktiv \u2013 Ladehinweise werden angezeigt" : "Deaktiviert \u2013 nur Warnungen"}
        </div>
      </div>
      <md-switch id="swVerbose" ${appCfg.verbose_loading ? "selected" : ""}></md-switch>
    </div>`;
  container.appendChild(div);

  div.querySelector("#swVerbose").addEventListener("change", async e => {
    try {
      await apiFetch("/api/app-config", { method: "PATCH",
        body: JSON.stringify({ verbose_loading: e.target.selected }) });
      showSnackbar(e.target.selected ? "Ladehinweise aktiviert." : "Ladehinweise deaktiviert.");
      await renderLoading(container);
    } catch(err) { showSnackbar(err.message, "error"); }
  });
}

// ---------------------------------------------------------------------------
// Backup & Reset
// ---------------------------------------------------------------------------
function renderReset(container) {
  container.innerHTML = backBar("Backup & Reset");
  bindBack(container);

  const div = document.createElement("div");
  div.innerHTML = `
    <div class="card" style="margin-bottom:12px">
      <div style="font-size:15px;font-weight:500;margin-bottom:8px">Backup</div>
      <p style="font-size:13px;color:var(--md-sys-color-on-surface-variant);margin-bottom:12px">
        Lädt alle Datendateien als ZIP herunter.
      </p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <md-filled-tonal-button id="btnBackup">
          <span class="material-symbols-rounded" slot="icon">download</span>
          Backup herunterladen
        </md-filled-tonal-button>
        <md-outlined-button id="btnCleanup">
          <span class="material-symbols-rounded" slot="icon">auto_delete</span>
          Alte Backups löschen
        </md-outlined-button>
      </div>
    </div>

    <div class="card" style="border:1px solid var(--md-sys-color-error-container)">
      <div style="font-size:15px;font-weight:500;color:var(--md-sys-color-error);margin-bottom:12px">
        Gefahrenzone
      </div>
      <button class="btn-danger" id="rGradeLog">
        <span class="material-symbols-rounded">delete_sweep</span>
        Notenänderungen-Log leeren
      </button>
      <button class="btn-danger" id="rRedemptions">
        <span class="material-symbols-rounded">delete_sweep</span>
        Einlösungen-Log leeren
      </button>
      <button class="btn-danger" id="rBalance">
        <span class="material-symbols-rounded">account_balance_wallet</span>
        Guthaben auf 0 zurücksetzen
      </button>
      <button class="btn-danger" id="rRewardCfg">
        <span class="material-symbols-rounded">restart_alt</span>
        Belohnungskonfiguration zurücksetzen
      </button>
      <button class="btn-danger" id="rAppCfg">
        <span class="material-symbols-rounded">settings_backup_restore</span>
        App-Konfiguration zurücksetzen
      </button>
    </div>`;
  container.appendChild(div);

  div.querySelector("#btnBackup").addEventListener("click", () => {
    const a = Object.assign(document.createElement("a"), { href: "/api/backup" });
    document.body.appendChild(a); a.click(); a.remove();
    showSnackbar("Backup wird heruntergeladen\u2026");
  });

  div.querySelector("#btnCleanup").addEventListener("click", () => {
    const dlg = openDialog("Alte Backups löschen",
      `<p style="font-size:14px">Alle Backups außer dem neuesten werden gelöscht.</p>`,
      "Löschen", true);
    dlg.addEventListener("close", async () => {
      if (dlg.returnValue !== "confirm") return;
      try {
        const r = await apiFetch("/api/backups/cleanup", { method: "POST" });
        showSnackbar(r.message ?? "Alte Backups gelöscht.");
      } catch(e) { showSnackbar(e.message, "error"); }
    });
  });

  const resets = [
    ["rGradeLog",    "grade_log",     "Notenänderungen-Log leeren?"],
    ["rRedemptions", "redemptions",   "Einlösungen-Log leeren?\nDas Guthaben wird nicht verändert."],
    ["rBalance",     "balance",       "Guthaben auf 0 zurücksetzen?\nLogs bleiben erhalten."],
    ["rRewardCfg",   "reward_config", "Belohnungskonfiguration auf Standardwerte zurücksetzen?"],
    ["rAppCfg",      "app_config",    "App-Konfiguration auf Standardwerte zurücksetzen?"],
  ];

  resets.forEach(([id, action, msg]) => {
    div.querySelector("#" + id).addEventListener("click", () => {
      const dlg = openDialog("Bestätigung",
        `<p style="font-size:14px">${msg.replace(/\n/g, "<br>")}</p>`,
        "Zurücksetzen", true);
      dlg.addEventListener("close", async () => {
        if (dlg.returnValue !== "confirm") return;
        try {
          await apiFetch("/api/reset", { method: "POST", body: JSON.stringify({ action }) });
          showSnackbar("Zurückgesetzt.");
        } catch(e) { showSnackbar(e.message, "error"); }
      });
    });
  });
}

async function save(cfg) {
  await apiFetch("/api/reward-config", { method: "POST", body: JSON.stringify(cfg) });
}
