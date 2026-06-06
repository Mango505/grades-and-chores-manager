/**
 * wallet.js – Balance card, FAB-driven redeem, collapsible log tables
 * Uses native .btn-text instead of md-text-button for reliable spacing.
 */
import { apiFetch, showSnackbar, setPrimaryAction, clearPrimaryAction } from "../app.js";
import { statChip, emptyState, errorBanner, openDialog, injectComponentStyles } from "../components.js";

const PREVIEW = 10;
let showAllR = false;
let showAllG = false;

export default async function render(container) {
  injectComponentStyles();
  showAllR = false;
  showAllG = false;
  await load(container);
}

async function load(container) {
  let wallet, rc;
  try {
    [wallet, rc] = await Promise.all([
      apiFetch("/api/wallet"),
      apiFetch("/api/reward-config"),
    ]);
  } catch(e) { container.innerHTML = errorBanner(e.message); return; }

  if (!rc.enabled) {
    clearPrimaryAction();
    container.innerHTML = emptyState("account_balance_wallet",
      "Belohnungssystem deaktiviert. Aktiviere es unter Einstellungen.");
    return;
  }

  draw(container, wallet, rc);
  setPrimaryAction("redeem", "Guthaben einl\u00f6sen", () => openRedeemDialog(container, wallet, rc));
}

function draw(container, wallet, rc) {
  const fmt      = v => fmtV(v, rc);
  const redeemed = wallet.redemptions.reduce((a, r) => a + r.cost, 0);

  container.innerHTML =
    '<div class="card" style="display:flex;flex-wrap:wrap;gap:16px;justify-content:space-around;align-items:center;margin-bottom:20px">' +
      statChip("Aktuelles Guthaben", fmt(wallet.balance)) +
      '<div class="stat-divider" style="width:1px;height:36px;background:var(--md-sys-color-outline-variant)"></div>' +
      statChip("Eingel\u00f6st", fmt(redeemed), "--md-sys-color-secondary") +
      '<div class="stat-divider" style="width:1px;height:36px;background:var(--md-sys-color-outline-variant)"></div>' +
      statChip("Verdient", fmt(wallet.balance + redeemed), "--md-sys-color-tertiary") +
    '</div>' +
    section("Einl\u00f6sungen", wallet.redemptions, showAllR, "r",
      r => [fmtV(r.cost, rc), r.description || "\u2014", r.date || ""],
      ["Betrag", "Beschreibung", "Datum"]
    ) +
    section("Noten\u00e4nderungen", wallet.grade_log, showAllG, "g",
      e => {
        const sym = { "+": "+ Hinzugef\u00fcgt", "-": "\u2212 Gel\u00f6scht", "~": "~ Bearbeitet" }[e.action] || e.action;
        const d   = typeof e.value_delta === "number"
          ? (e.value_delta >= 0 ? "+" : "") + fmtV(e.value_delta, rc) : "\u2014";
        return [sym, e.date || "", e.subject || "", String(e.value), d];
      },
      ["Aktion", "Datum", "Fach", "Note", "\u0394"]
    );

  container.querySelector("#btnExpandR")?.addEventListener("click",   () => { showAllR = true;  draw(container, wallet, rc); });
  container.querySelector("#btnExpandG")?.addEventListener("click",   () => { showAllG = true;  draw(container, wallet, rc); });
  container.querySelector("#btnCollapseR")?.addEventListener("click", () => { showAllR = false; draw(container, wallet, rc); });
  container.querySelector("#btnCollapseG")?.addEventListener("click", () => { showAllG = false; draw(container, wallet, rc); });
}

function section(title, items, showAll, key, rowFn, headers) {
  if (!items || !items.length) {
    return '<div style="margin-bottom:20px">' +
      '<h3 style="font-size:15px;font-weight:600;margin-bottom:8px">' + title + '</h3>' +
      '<p style="font-size:13px;color:var(--md-sys-color-on-surface-variant)">Keine Eintr\u00e4ge.</p>' +
    '</div>';
  }

  const rev     = [...items].reverse();
  const visible = showAll ? rev : rev.slice(0, PREVIEW);
  const hasMore = !showAll && items.length > PREVIEW;
  const canLess = showAll && items.length > PREVIEW;

  const th = h =>
    '<th style="text-align:left;padding:8px 10px;font-size:12px;white-space:nowrap;' +
    'color:var(--md-sys-color-on-surface-variant);' +
    'border-bottom:1px solid var(--md-sys-color-outline-variant)">' + h + '</th>';

  const td = (c, i, cells) => {
    const isLast = i === cells.length - 1;
    let color = "";
    if (isLast && c.startsWith("+"))                              color = "color:#1b7e4a;font-weight:600";
    else if (isLast && (c.startsWith("\u2212") || c.startsWith("-"))) color = "color:var(--md-sys-color-error);font-weight:600";
    return '<td style="padding:8px 10px;font-size:13px;vertical-align:middle;border-bottom:1px solid var(--md-sys-color-outline-variant);' + color + '">' + c + '</td>';
  };

  const rows = visible.map(item => {
    const cells = rowFn(item);
    return '<tr>' + cells.map((c, i) => td(c, i, cells)).join("") + '</tr>';
  }).join("");

  const K = key.toUpperCase();
  // Use native .btn-text for reliable padding/margin – md-text-button ignores external CSS
  return '<div style="margin-bottom:20px">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">' +
      '<h3 style="font-size:15px;font-weight:600">' + title + '</h3>' +
      '<span style="font-size:12px;color:var(--md-sys-color-on-surface-variant)">' + items.length + ' Eintr\u00e4ge</span>' +
    '</div>' +
    '<div class="card" style="padding:0;overflow:hidden">' +
      '<div style="overflow-x:auto">' +
        '<table style="width:100%;border-collapse:collapse">' +
          '<thead><tr>' + headers.map(th).join("") + '</tr></thead>' +
          '<tbody>' + rows + '</tbody>' +
        '</table>' +
      '</div>' +
      (hasMore
        ? '<div style="padding:4px 8px;border-top:1px solid var(--md-sys-color-outline-variant)">' +
            '<button class="btn-text" id="btnExpand' + K + '">Alle ' + items.length + ' anzeigen</button>' +
          '</div>'
        : "") +
      (canLess
        ? '<div style="padding:4px 8px;border-top:1px solid var(--md-sys-color-outline-variant)">' +
            '<button class="btn-text" id="btnCollapse' + K + '">Weniger anzeigen</button>' +
          '</div>'
        : "") +
    '</div>' +
  '</div>';
}

function openRedeemDialog(container, wallet, rc) {
  const fmt = v => fmtV(v, rc);
  const dlg = openDialog("Guthaben einl\u00f6sen",
    '<p style="font-size:13px;color:var(--md-sys-color-on-surface-variant);margin-bottom:4px">' +
      'Verf\u00fcgbar: <strong>' + fmt(wallet.balance) + '</strong></p>' +
    '<md-outlined-text-field id="dlgCost" label="Betrag" type="number" min="0.01" step="0.01" style="width:100%"></md-outlined-text-field>' +
    '<md-outlined-text-field id="dlgDesc" label="Beschreibung (optional)" style="width:100%"></md-outlined-text-field>',
    "Einl\u00f6sen");

  dlg.addEventListener("close", async () => {
    if (dlg.returnValue !== "confirm") return;
    const cost = parseFloat(dlg.querySelector("#dlgCost").value);
    const desc = dlg.querySelector("#dlgDesc").value.trim();
    if (isNaN(cost) || cost <= 0) { showSnackbar("Ung\u00fcltiger Betrag.", "error"); return; }
    if (cost > wallet.balance)    { showSnackbar("Betrag \u00fcbersteigt Guthaben.", "error"); return; }
    try {
      await apiFetch("/api/wallet/redeem", { method: "POST", body: JSON.stringify({ cost, description: desc }) });
      showSnackbar("Eingel\u00f6st.");
      await load(container);
    } catch(e) { showSnackbar(e.message, "error"); }
  });
}

function fmtV(v, rc) {
  if (!rc?.enabled) return String(v);
  if (rc.reward_mode === "money") return Number(v).toFixed(2) + " \u20ac";
  if (rc.reward_mode === "unit")  return v + " " + rc.unit_name;
  return Math.round(v) + " Pt.";
}
