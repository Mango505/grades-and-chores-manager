/**
 * wallet.js – Balance card, redeem, collapsible redemption + grade log tables
 */
import { apiFetch, showSnackbar, setPrimaryAction, clearPrimaryAction } from "../app.js";
import { statChip, emptyState, errorBanner, openDialog, injectComponentStyles } from "../components.js";

const PREVIEW_COUNT = 10;
let showAllRedemptions = false;
let showAllGradeLog    = false;

export default async function render(container) {
  injectComponentStyles();
  showAllRedemptions = false;
  showAllGradeLog    = false;
  await load(container);
}

async function load(container) {
  let wallet, rewardConfig;
  try {
    [wallet, rewardConfig] = await Promise.all([
      apiFetch("/api/wallet"),
      apiFetch("/api/reward-config"),
    ]);
  } catch(e) { container.innerHTML = errorBanner(e.message); return; }

  if (!rewardConfig.enabled) {
    clearPrimaryAction();
    container.innerHTML = emptyState("account_balance_wallet",
      "Belohnungssystem deaktiviert. Aktiviere es unter Einstellungen.");
    return;
  }

  draw(container, wallet, rewardConfig);

  if (wallet.balance > 0) {
    setPrimaryAction("redeem", "Guthaben einlösen", () =>
      container.querySelector("#btnRedeem")?.click()
    );
  } else {
    clearPrimaryAction();
  }
}

function draw(container, wallet, rewardConfig) {
  const fmt          = v => fmtReward(v, rewardConfig);
  const totalRedeemed = wallet.redemptions.reduce((a,r) => a+r.cost, 0);

  container.innerHTML = `
    <!-- Balance banner -->
    <div class="card" style="display:flex;flex-wrap:wrap;gap:16px;
         justify-content:space-around;align-items:center;margin-bottom:20px">
      ${statChip("Aktuelles Guthaben", fmt(wallet.balance))}
      <div style="width:1px;height:36px;background:var(--md-sys-color-outline-variant)"></div>
      ${statChip("Eingelöst (gesamt)", fmt(totalRedeemed), "--md-sys-color-secondary")}
      <div style="width:1px;height:36px;background:var(--md-sys-color-outline-variant)"></div>
      ${statChip("Verdient (gesamt)",  fmt(wallet.balance+totalRedeemed), "--md-sys-color-tertiary")}
    </div>

    <div style="margin-bottom:24px">
      <md-filled-button id="btnRedeem" ${wallet.balance<=0?"disabled":""}>
        <span class="material-symbols-rounded" slot="icon">redeem</span>
        Guthaben einlösen
      </md-filled-button>
    </div>

    <!-- Redemptions -->
    ${collapsibleSection(
        "Einlösungen",
        wallet.redemptions,
        showAllRedemptions,
        "redemptions",
        r => [fmt(r.cost), r.description, r.date ?? ""],
        ["Betrag", "Beschreibung", "Datum"],
        true   // amount column: show as negative
    )}

    <!-- Grade log -->
    ${collapsibleSection(
        "Notenänderungen",
        wallet.grade_log,
        showAllGradeLog,
        "gradelog",
        e => {
          const sym={"+":"+ Hinzugefügt","-":"− Gelöscht","~":"~ Bearbeitet"}[e.action]??e.action;
          const delta = typeof e.value_delta==="number"
            ? (e.value_delta>=0?"+":"")+fmt(e.value_delta) : "";
          return [sym, e.date, e.subject, String(e.value), delta];
        },
        ["Aktion","Datum","Fach","Note","Δ"],
        false
    )}`;

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
      if (isNaN(cost)||cost<=0) { showSnackbar("Ungültiger Betrag.","error"); return; }
      try {
        await apiFetch("/api/wallet/redeem", {method:"POST",
          body:JSON.stringify({cost, description:desc})});
        showSnackbar("Eingelöst.");
        await load(container);
      } catch(e) { showSnackbar(e.message,"error"); }
    });
  });

  // Expand/collapse buttons
  container.querySelector("#btn-expand-redemptions")?.addEventListener("click", () => {
    showAllRedemptions = true;
    draw(container, wallet, rewardConfig);
  });
  container.querySelector("#btn-expand-gradelog")?.addEventListener("click", () => {
    showAllGradeLog = true;
    draw(container, wallet, rewardConfig);
  });
  container.querySelector("#btn-collapse-redemptions")?.addEventListener("click", () => {
    showAllRedemptions = false;
    draw(container, wallet, rewardConfig);
  });
  container.querySelector("#btn-collapse-gradelog")?.addEventListener("click", () => {
    showAllGradeLog = false;
    draw(container, wallet, rewardConfig);
  });
}

// ---------------------------------------------------------------------------
// Collapsible table section
// ---------------------------------------------------------------------------
function collapsibleSection(title, items, showAll, id, rowFn, headers, negativeFirst) {
  if (!items?.length) {
    return `<div style="margin-bottom:20px">
      <h3 style="font-size:15px;font-weight:600;margin-bottom:8px">${title}</h3>
      <p style="font-size:13px;color:var(--md-sys-color-on-surface-variant)">Keine Einträge.</p>
    </div>`;
  }

  const reversed  = [...items].reverse();
  const visible   = showAll ? reversed : reversed.slice(0, PREVIEW_COUNT);
  const hasMore   = !showAll && items.length > PREVIEW_COUNT;
  const canCollapse = showAll && items.length > PREVIEW_COUNT;

  const rows = visible.map(item => {
    const cells = rowFn(item);
    return `<tr>${cells.map((c, i) => {
      const isFirst = i === 0;
      const style = isFirst && negativeFirst
        ? "color:var(--md-sys-color-error);font-weight:600"
        : i === cells.length-1 && c.startsWith("+")
        ? "color:#1b7e4a;font-weight:600"
        : i === cells.length-1 && c.startsWith("-")
        ? "color:var(--md-sys-color-error);font-weight:600"
        : "";
      return `<td style="padding:8px 10px;border-bottom:1px solid var(--md-sys-color-outline-variant);
               font-size:13px;vertical-align:middle;${style}">${c}</td>`;
    }).join("")}</tr>`;
  }).join("");

  return `
    <div style="margin-bottom:20px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <h3 style="font-size:15px;font-weight:600">${title}</h3>
        <span style="font-size:12px;color:var(--md-sys-color-on-surface-variant)">${items.length} Einträge</span>
      </div>
      <div class="card" style="padding:0;overflow:hidden">
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr>${headers.map(h =>
                `<th style="text-align:left;padding:10px;font-size:12px;font-weight:600;
                  color:var(--md-sys-color-on-surface-variant);
                  border-bottom:1px solid var(--md-sys-color-outline-variant);
                  white-space:nowrap">${h}</th>`).join("")}
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        ${hasMore ? `
        <div style="padding:10px 16px;border-top:1px solid var(--md-sys-color-outline-variant)">
          <md-text-button id="btn-expand-${id}">
            Alle ${items.length} anzeigen
            <span class="material-symbols-rounded" slot="icon">expand_more</span>
          </md-text-button>
        </div>` : ""}
        ${canCollapse ? `
        <div style="padding:10px 16px;border-top:1px solid var(--md-sys-color-outline-variant)">
          <md-text-button id="btn-collapse-${id}">
            Weniger anzeigen
            <span class="material-symbols-rounded" slot="icon">expand_less</span>
          </md-text-button>
        </div>` : ""}
      </div>
    </div>`;
}

function fmtReward(v, cfg) {
  if (!cfg?.enabled) return String(v);
  if (cfg.reward_mode==="money") return `${Number(v).toFixed(2)} €`;
  if (cfg.reward_mode==="unit")  return `${v} ${cfg.unit_name}`;
  return `${Math.round(v)} Pt.`;
}
