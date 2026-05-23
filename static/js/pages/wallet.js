/**
 * wallet.js – Balance, redemption form, grade log & redemption history
 */
import { apiFetch, showSnackbar } from "../app.js";
import { card, statChip, emptyState, errorBanner, openDialog, injectComponentStyles } from "../components.js";

export default async function render(container) {
  injectComponentStyles();

  let wallet, rewardConfig;
  try {
    [wallet, rewardConfig] = await Promise.all([
      apiFetch("/api/wallet"),
      apiFetch("/api/reward-config"),
    ]);
  } catch(e) {
    container.innerHTML = errorBanner(e.message);
    return;
  }

  if (!rewardConfig.enabled) {
    container.innerHTML = emptyState("account_balance_wallet",
      "Belohnungssystem deaktiviert. Aktiviere es unter Einstellungen.");
    return;
  }

  const fmt = v => wallet.formatted_balance !== null
    ? formatValue(v, rewardConfig)
    : `${v}`;

  const totalRedeemed = wallet.redemptions.reduce((a, r) => a + r.cost, 0);

  container.innerHTML = `
    <!-- Balance banner -->
    <div class="card chip-row" style="margin-bottom:20px;justify-content:space-around;flex-wrap:wrap;gap:16px">
      ${statChip("Aktuelles Guthaben", fmt(wallet.balance))}
      <div style="width:1px;height:40px;background:var(--md-sys-color-outline-variant)"></div>
      ${statChip("Eingelöst (gesamt)", fmt(totalRedeemed), "--md-sys-color-secondary")}
      <div style="width:1px;height:40px;background:var(--md-sys-color-outline-variant)"></div>
      ${statChip("Verdient (gesamt)", fmt(wallet.balance + totalRedeemed), "--md-sys-color-tertiary")}
    </div>

    <!-- Redeem button -->
    <div style="margin-bottom:24px">
      <md-filled-button id="btnRedeem" ${wallet.balance <= 0 ? "disabled" : ""}>
        <span class="material-symbols-rounded" slot="icon">redeem</span>
        Guthaben einlösen
      </md-filled-button>
    </div>

    <!-- Redemption history -->
    <h3 style="font-size:15px;font-weight:600;margin-bottom:12px">Einlösungen</h3>
    ${historyList(wallet.redemptions, r =>
        `${r.description} &nbsp;|&nbsp; <strong>−${fmt(r.cost)}</strong> &nbsp;|&nbsp; ${r.date ?? ""}`,
      "Keine Einlösungen vorhanden.")}

    <!-- Grade log -->
    <h3 style="font-size:15px;font-weight:600;margin:24px 0 12px">Notenänderungen</h3>
    ${historyList(wallet.grade_log, e => {
        const sym = {"+":"Hinzugefügt","-":"Gelöscht","~":"Bearbeitet"}[e.action] ?? e.action;
        const delta = typeof e.value_delta === "number"
          ? ` &nbsp;<span style="color:${e.value_delta>=0?"#1b7e4a":"var(--md-sys-color-error)"}">
               ${e.value_delta>=0?"+":""}${fmt(e.value_delta)}</span>` : "";
        return `${sym} &nbsp;|&nbsp; ${e.date} &nbsp;|&nbsp; ${e.subject}
                &nbsp;|&nbsp; <strong>${e.value}</strong> (${e.weight}x)
                ${e.labels?.length ? `| ${e.labels.join(", ")}` : ""}${delta}`;
      }, "Keine Notenänderungen vorhanden.")}`;

  // Redeem dialog
  container.querySelector("#btnRedeem")?.addEventListener("click", () => {
    const dlg = openDialog("Guthaben einlösen", `
      <md-outlined-text-field id="dlgCost" label="Betrag" type="number"
        min="0.01" step="0.01" style="width:100%"></md-outlined-text-field>
      <md-outlined-text-field id="dlgDesc" label="Beschreibung (optional)"
        style="width:100%"></md-outlined-text-field>`, "Einlösen");

    dlg.addEventListener("close", async () => {
      if (dlg.returnValue !== "confirm") return;
      const cost = parseFloat(dlg.querySelector("#dlgCost").value);
      const desc = dlg.querySelector("#dlgDesc").value.trim();
      if (isNaN(cost) || cost <= 0) { showSnackbar("Ungültiger Betrag.", "error"); return; }
      try {
        await apiFetch("/api/wallet/redeem", { method:"POST", body: JSON.stringify({cost, description: desc}) });
        showSnackbar("Guthaben eingelöst.");
        render(container);
      } catch(e) { showSnackbar(e.message, "error"); }
    });
  });
}

function historyList(items, rowFn, emptyMsg) {
  if (!items?.length)
    return `<p style="color:var(--md-sys-color-on-surface-variant);font-size:14px">${emptyMsg}</p>`;
  return `<div class="card" style="display:flex;flex-direction:column;gap:0">
    ${[...items].reverse().map(item =>
      `<div class="grade-row" style="font-size:13px">${rowFn(item)}</div>`
    ).join("")}
  </div>`;
}

function formatValue(v, cfg) {
  if (cfg.reward_mode === "money") return `${v.toFixed(2)} €`;
  if (cfg.reward_mode === "unit")  return `${v} ${cfg.unit_name}`;
  return `${Math.round(v)} Pt.`;
}
