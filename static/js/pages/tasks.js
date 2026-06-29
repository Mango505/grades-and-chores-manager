import { apiFetch, showSnackbar, skeletonGrid, setPrimaryAction, clearPrimaryAction } from "../app.js";
import { emptyState, errorBanner, openDialog, injectComponentStyles } from "../components.js";

const PERIOD_LABELS = { once: "Einmalig", daily: "T\u00e4glich", weekly: "W\u00f6chentlich", monthly: "Monatlich" };
const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

let _tasksData = null;

export default async function render(container) {
  injectComponentStyles();
  await load(container);
}

async function load(container) {
  container.innerHTML = skeletonGrid(2, ["title", "medium", "short"]);

  try {
    _tasksData = await apiFetch("/api/tasks");
  } catch(e) {
    container.innerHTML = errorBanner(e.message);
    return;
  }

  const templates = _tasksData.templates || [];
  const completions = _tasksData.completions || [];

  setPrimaryAction("add", "Aufgabe hinzuf\u00fcgen", () => openAddTaskDialog(container));

  draw(container, templates, completions, _tasksData.missed_log);
}

function draw(container, templates, completions, missedLog) {
  if (!templates.length) {
    container.innerHTML =
      '<h2 style="font-size:22px;font-weight:500;margin-bottom:20px">Aufgaben</h2>' +
      emptyState("payments", "Noch keine Aufgaben vorhanden.");
    return;
  }

  const list = templates.map(t => taskCard(t)).join("");

  container.innerHTML =
    '<h2 style="font-size:22px;font-weight:500;margin-bottom:20px">Aufgaben</h2>' +
    '<div id="taskGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px">' +
      list +
    '</div>' +
    historySection(completions) +
    missedSection(missedLog);

  bindEvents(container, templates, completions);
}

function formatPeriod(t) {
  const p = t.period;
  const i = t.interval || 1;
  if (p === "once") return "Einmalig";
  if (p === "daily") return i === 1 ? "T\u00e4glich" : "Alle " + i + " Tage";
  if (p === "weekly") {
    const base = i === 1 ? "Jede Woche" : "Alle " + i + " Wochen";
    if (t.weekdays && t.weekdays.length) {
      const days = t.weekdays.map(d => WEEKDAY_LABELS[d]).join(", ");
      return base + " (" + days + ")";
    }
    return i === 1 ? "W\u00f6chentlich" : "Alle " + i + " Wochen";
  }
  if (p === "monthly") {
    if (t.month_day) {
      const base = i === 1 ? "Jeden Monat" : "Alle " + i + " Monate";
      return base + " am " + t.month_day + ".";
    }
    return i === 1 ? "Monatlich" : "Alle " + i + " Monate";
  }
  return PERIOD_LABELS[p] || p;
}

function taskCard(t) {
  const available = t.available;
  const completed = !!t.last_completed;
  const periodLabel = formatPeriod(t);
  let statusIcon, statusColor, statusText, statusLabel;

  if (available) {
    statusIcon = "radio_button_unchecked";
    statusColor = "var(--md-sys-color-on-surface-variant)";
    statusLabel = "Offen";
  } else if (completed) {
    statusIcon = "check_circle";
    statusColor = "var(--md-sys-color-primary)";
    statusLabel = "Erledigt";
  } else {
    statusIcon = "event_busy";
    statusColor = "var(--md-sys-color-on-surface-variant)";
    statusLabel = "Nicht verf\u00fcgbar";
  }

  return '<div class="card task-card" data-id="' + t.id + '" style="padding:16px 20px">' +
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">' +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-size:16px;font-weight:600;margin-bottom:2px">' + t.name + '</div>' +
        '<div style="font-size:14px;color:var(--md-sys-color-primary);font-weight:500">' +
          formatReward(t.reward) +
        '</div>' +
        '<div style="font-size:12px;color:var(--md-sys-color-on-surface-variant);margin-top:4px">' +
          periodLabel +
        '</div>' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;align-items:center;gap:4px">' +
        '<span class="material-symbols-rounded" style="font-size:28px;color:' + statusColor + '">' + statusIcon + '</span>' +
        '<span style="font-size:11px;color:' + statusColor + '">' + statusLabel + '</span>' +
      '</div>' +
    '</div>' +
    '<div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end">' +
      (available
        ? '<button class="btn-filled btn-complete" style="padding:6px 16px;font-size:13px">Erledigen</button>'
        : completed
          ? '<button class="btn-text btn-redo" style="font-size:13px" disabled>Erledigt</button>'
          : '') +
      '<button class="icon-btn-sm btn-edit-task" title="Bearbeiten"><span class="material-symbols-rounded" style="font-size:18px">edit</span></button>' +
      '<button class="icon-btn-sm btn-del-task" title="L\u00f6schen" style="color:var(--md-sys-color-error)"><span class="material-symbols-rounded" style="font-size:18px">delete</span></button>' +
    '</div>' +
  '</div>';
}

function historySection(completions) {
  if (!completions || !completions.length) return "";
  const rev = [...completions].reverse();
  const recent = rev.slice(0, 10);
  const hasMore = completions.length > 10;

  const rows = recent.map(c =>
    '<tr>' +
      '<td style="padding:8px 10px;font-size:13px">' + c.task_name + '</td>' +
      '<td style="padding:8px 10px;font-size:13px;font-weight:500;color:var(--md-sys-color-primary)">+' + formatReward(c.reward) + '</td>' +
      '<td style="padding:8px 10px;font-size:12px;color:var(--md-sys-color-on-surface-variant)">' + (c.completed_at || "") + '</td>' +
    '</tr>'
  ).join("");

  return '<div style="margin-top:24px">' +
    '<h3 style="font-size:15px;font-weight:600;margin-bottom:8px">Letzte Erledigungen</h3>' +
    '<div class="card" style="padding:0;overflow:hidden">' +
      '<table style="width:100%;border-collapse:collapse">' +
        '<thead><tr>' +
          '<th style="text-align:left;padding:8px 10px;font-size:12px;color:var(--md-sys-color-on-surface-variant);border-bottom:1px solid var(--md-sys-color-outline-variant)">Aufgabe</th>' +
          '<th style="text-align:left;padding:8px 10px;font-size:12px;color:var(--md-sys-color-on-surface-variant);border-bottom:1px solid var(--md-sys-color-outline-variant)">Betrag</th>' +
          '<th style="text-align:left;padding:8px 10px;font-size:12px;color:var(--md-sys-color-on-surface-variant);border-bottom:1px solid var(--md-sys-color-outline-variant)">Datum</th>' +
        '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>' +
      (hasMore
        ? '<div style="padding:4px 8px;border-top:1px solid var(--md-sys-color-outline-variant)"><span style="display:block;padding:8px;text-align:center;font-size:12px;color:var(--md-sys-color-on-surface-variant)">+ ' + (completions.length - 10) + ' weitere im Konto-Verlauf</span></div>'
        : "") +
    '</div>' +
  '</div>';
}

function missedSection(missedLog) {
  if (!missedLog || !missedLog.length) return "";
  const rev = [...missedLog].reverse();
  const recent = rev.slice(0, 10);
  const rows = recent.map(m =>
    '<tr>' +
      '<td style="padding:8px 10px;font-size:13px">' + m.task_name + '</td>' +
      '<td style="padding:8px 10px;font-size:12px;color:var(--md-sys-color-on-surface-variant)">' + (m.scheduled_date || "") + '</td>' +
    '</tr>'
  ).join("");

  return '<div style="margin-top:24px">' +
    '<h3 style="font-size:15px;font-weight:600;margin-bottom:8px;color:var(--md-sys-color-on-surface-variant)">Verpasst</h3>' +
    '<div class="card" style="padding:0;overflow:hidden;border:1px solid var(--md-sys-color-outline-variant)">' +
      '<table style="width:100%;border-collapse:collapse">' +
        '<thead><tr>' +
          '<th style="text-align:left;padding:8px 10px;font-size:12px;color:var(--md-sys-color-on-surface-variant);border-bottom:1px solid var(--md-sys-color-outline-variant)">Aufgabe</th>' +
          '<th style="text-align:left;padding:8px 10px;font-size:12px;color:var(--md-sys-color-on-surface-variant);border-bottom:1px solid var(--md-sys-color-outline-variant)">Geplant am</th>' +
        '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>' +
    '</div>' +
  '</div>';
}

function bindEvents(container, templates, completions) {
  const grid = container.querySelector("#taskGrid");
  if (!grid) return;

  grid.addEventListener("click", async e => {
    const card = e.target.closest(".task-card");
    if (!card) return;
    const id = parseInt(card.dataset.id);
    const t = templates.find(x => x.id === id);
    if (!t) return;

    if (e.target.closest(".btn-complete")) {
      try {
        await apiFetch("/api/tasks/" + id + "/complete", { method: "POST" });
        showSnackbar(formatReward(t.reward) + " gutgeschrieben!");
        await load(container);
      } catch(e) { showSnackbar(e.message, "error"); }
      return;
    }

    if (e.target.closest(".btn-edit-task")) {
      openEditTaskDialog(container, t);
      return;
    }

    if (e.target.closest(".btn-del-task")) {
      const dlg = openDialog("Aufgabe l\u00f6schen",
        '<p style="font-size:14px">Aufgabe <strong>' + t.name + '</strong> und alle zugeh\u00f6rigen Buchungen l\u00f6schen?</p>',
        "L\u00f6schen", true);
      dlg.addEventListener("close", async () => {
        if (dlg.returnValue !== "confirm") return;
        try {
          await apiFetch("/api/tasks/" + id, { method: "DELETE" });
          showSnackbar("Aufgabe gel\u00f6scht.");
          await load(container);
        } catch(e) { showSnackbar(e.message, "error"); }
      });
      return;
    }
  });
}

// ---------------------------------------------------------------------------
// Extra controls for interval, weekdays, month_day
// ---------------------------------------------------------------------------

function extraControlsHTML(period, interval, weekdays, monthDay) {
  if (period === "once") return "";

  const i = interval || 1;
  const wd = weekdays || [];
  const md = monthDay || 1;

  let html = '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--md-sys-color-outline-variant)">';

  if (period === "daily") {
    html +=
      '<label style="font-size:13px;color:var(--md-sys-color-on-surface-variant);display:block;margin-bottom:6px">Alle</label>' +
      '<div style="display:flex;align-items:center;gap:8px">' +
        '<input type="number" id="dlgInterval" value="' + i + '" min="1" style="width:64px;padding:8px;border:1px solid var(--md-sys-color-outline);border-radius:8px;font-size:14px;font-family:inherit;background:transparent;color:var(--md-sys-color-on-surface);text-align:center">' +
        '<span style="font-size:14px;color:var(--md-sys-color-on-surface)">Tag(e)</span>' +
      '</div>';
  }

  if (period === "weekly") {
    html +=
      '<label style="font-size:13px;color:var(--md-sys-color-on-surface-variant);display:block;margin-bottom:6px">Alle</label>' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">' +
        '<input type="number" id="dlgInterval" value="' + i + '" min="1" style="width:64px;padding:8px;border:1px solid var(--md-sys-color-outline);border-radius:8px;font-size:14px;font-family:inherit;background:transparent;color:var(--md-sys-color-on-surface);text-align:center">' +
        '<span style="font-size:14px;color:var(--md-sys-color-on-surface)">Woche(n)</span>' +
      '</div>' +
      '<label style="font-size:13px;color:var(--md-sys-color-on-surface-variant);display:block;margin-bottom:6px">Wochentage</label>' +
      '<div style="display:flex;gap:4px;flex-wrap:wrap" id="dlgWeekdays">';
    for (let d = 0; d < 7; d++) {
      const active = wd.indexOf(d) !== -1;
      html +=
        '<button class="chip-day' + (active ? " chip-day--active" : "") + '" data-day="' + d + '">' + WEEKDAY_LABELS[d] + '</button>';
    }
    html += '</div>';
  }

  if (period === "monthly") {
    html +=
      '<label style="font-size:13px;color:var(--md-sys-color-on-surface-variant);display:block;margin-bottom:6px">Alle</label>' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">' +
        '<input type="number" id="dlgInterval" value="' + i + '" min="1" style="width:64px;padding:8px;border:1px solid var(--md-sys-color-outline);border-radius:8px;font-size:14px;font-family:inherit;background:transparent;color:var(--md-sys-color-on-surface);text-align:center">' +
        '<span style="font-size:14px;color:var(--md-sys-color-on-surface)">Monat(e)</span>' +
      '</div>' +
      '<label style="font-size:13px;color:var(--md-sys-color-on-surface-variant);display:block;margin-bottom:6px">Am Tag</label>' +
      '<input type="number" id="dlgMonthDay" value="' + md + '" min="1" max="31" style="width:72px;padding:8px;border:1px solid var(--md-sys-color-outline);border-radius:8px;font-size:14px;font-family:inherit;background:transparent;color:var(--md-sys-color-on-surface);text-align:center">';
  }

  return html + '</div>';
}

function bindExtraControls(dlg, period) {
  if (period === "weekly") {
    const container = dlg.querySelector("#dlgWeekdays");
    if (!container) return;
    const chips = container.querySelectorAll(".chip-day");
    chips.forEach(chip => {
      chip.addEventListener("click", () => {
        chip.classList.toggle("chip-day--active");
      });
    });
  }
}

function collectExtraData(dlg, period) {
  const data = {};
  if (period === "once") return data;
  const intervalInput = dlg.querySelector("#dlgInterval");
  if (intervalInput) {
    data.interval = parseInt(intervalInput.value) || 1;
  }
  if (period === "weekly") {
    const chips = dlg.querySelectorAll("#dlgWeekdays .chip-day--active");
    data.weekdays = Array.from(chips).map(c => parseInt(c.dataset.day));
    if (!data.weekdays.length) data.weekdays = null;
  }
  if (period === "monthly") {
    const md = dlg.querySelector("#dlgMonthDay");
    data.month_day = md ? (parseInt(md.value) || 1) : null;
  }
  return data;
}

// ---------------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------------

function openAddTaskDialog(container) {
  const dlg = openDialog("Aufgabe hinzuf\u00fcgen",
    '<md-outlined-text-field id="dlgName" label="Aufgabe" style="width:100%"></md-outlined-text-field>' +
    '<md-outlined-text-field id="dlgReward" label="Betrag (\u20ac)" type="number" min="0.01" step="0.01" style="width:100%"></md-outlined-text-field>' +
    '<div style="margin-top:8px">' +
      '<label style="font-size:13px;color:var(--md-sys-color-on-surface-variant);display:block;margin-bottom:6px">Wiederholung</label>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap" id="periodPicker">' +
        '<button class="tab-pill tab-pill--active" data-period="once">Einmalig</button>' +
        '<button class="tab-pill" data-period="daily">T\u00e4glich</button>' +
        '<button class="tab-pill" data-period="weekly">W\u00f6chentlich</button>' +
        '<button class="tab-pill" data-period="monthly">Monatlich</button>' +
      '</div>' +
    '</div>' +
    '<div id="dlgExtraControls"></div>',
    "Hinzuf\u00fcgen"
  );

  let selectedPeriod = "once";

  function updateControls() {
    const target = dlg.querySelector("#dlgExtraControls");
    if (target) {
      target.innerHTML = extraControlsHTML(selectedPeriod, 1, [], 1);
      bindExtraControls(dlg, selectedPeriod);
    }
  }

  dlg.querySelectorAll("[data-period]").forEach(btn => {
    btn.addEventListener("click", () => {
      dlg.querySelectorAll("[data-period]").forEach(b => b.classList.remove("tab-pill--active"));
      btn.classList.add("tab-pill--active");
      selectedPeriod = btn.dataset.period;
      updateControls();
    });
  });

  dlg.addEventListener("close", async () => {
    if (dlg.returnValue !== "confirm") return;
    const name = dlg.querySelector("#dlgName").value.trim();
    const reward = parseFloat(dlg.querySelector("#dlgReward").value);
    if (!name) { showSnackbar("Bitte Namen eingeben.", "error"); return; }
    if (isNaN(reward) || reward <= 0) { showSnackbar("Ung\u00fcltiger Betrag.", "error"); return; }
    const extra = collectExtraData(dlg, selectedPeriod);
    try {
      await apiFetch("/api/tasks", {
        method: "POST",
        body: JSON.stringify({ name, reward, period: selectedPeriod, ...extra }),
      });
      showSnackbar("Aufgabe '" + name + "' erstellt.");
      await load(container);
    } catch(e) { showSnackbar(e.message, "error"); }
  });
}

function openEditTaskDialog(container, t) {
  const periods = ["once", "daily", "weekly", "monthly"];
  const periodBtns = periods.map(p =>
    '<button class="tab-pill' + (t.period === p ? " tab-pill--active" : "") + '" data-period="' + p + '">' +
      PERIOD_LABELS[p] +
    '</button>'
  ).join("");

  const dlg = openDialog("Aufgabe bearbeiten",
    '<md-outlined-text-field id="dlgName" label="Aufgabe" value="' + t.name + '" style="width:100%"></md-outlined-text-field>' +
    '<md-outlined-text-field id="dlgReward" label="Betrag (\u20ac)" type="number" min="0.01" step="0.01" value="' + t.reward + '" style="width:100%"></md-outlined-text-field>' +
    '<div style="margin-top:8px">' +
      '<label style="font-size:13px;color:var(--md-sys-color-on-surface-variant);display:block;margin-bottom:6px">Wiederholung</label>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap" id="periodPicker">' + periodBtns + '</div>' +
    '</div>' +
    '<div id="dlgExtraControls">' + extraControlsHTML(t.period, t.interval, t.weekdays, t.month_day) + '</div>',
    "Speichern"
  );

  let selectedPeriod = t.period;

  function updateControls() {
    const target = dlg.querySelector("#dlgExtraControls");
    if (target) {
      const currentWeeks = collectExtraData(dlg, "weekly").weekdays || t.weekdays || [];
      const currentMonthDay = (selectedPeriod === "monthly" && dlg.querySelector("#dlgMonthDay"))
        ? parseInt(dlg.querySelector("#dlgMonthDay").value) || t.month_day || 1
        : t.month_day || 1;
      const currentInterval = dlg.querySelector("#dlgInterval")
        ? parseInt(dlg.querySelector("#dlgInterval").value) || t.interval || 1
        : t.interval || 1;
      target.innerHTML = extraControlsHTML(
        selectedPeriod,
        selectedPeriod === t.period ? t.interval : currentInterval,
        selectedPeriod === "weekly" ? (selectedPeriod === t.period ? t.weekdays : currentWeeks) : [],
        selectedPeriod === "monthly" ? (selectedPeriod === t.period ? t.month_day : currentMonthDay) : null
      );
      bindExtraControls(dlg, selectedPeriod);
    }
  }

  dlg.querySelectorAll("[data-period]").forEach(btn => {
    btn.addEventListener("click", () => {
      dlg.querySelectorAll("[data-period]").forEach(b => b.classList.remove("tab-pill--active"));
      btn.classList.add("tab-pill--active");
      selectedPeriod = btn.dataset.period;
      updateControls();
    });
  });

  bindExtraControls(dlg, selectedPeriod);

  dlg.addEventListener("close", async () => {
    if (dlg.returnValue !== "confirm") return;
    const name = dlg.querySelector("#dlgName").value.trim();
    const reward = parseFloat(dlg.querySelector("#dlgReward").value);
    if (!name) { showSnackbar("Bitte Namen eingeben.", "error"); return; }
    if (isNaN(reward) || reward <= 0) { showSnackbar("Ung\u00fcltiger Betrag.", "error"); return; }
    const extra = collectExtraData(dlg, selectedPeriod);
    try {
      await apiFetch("/api/tasks/" + t.id, {
        method: "PUT",
        body: JSON.stringify({ name, reward, period: selectedPeriod, ...extra }),
      });
      showSnackbar("Aufgabe aktualisiert.");
      await load(container);
    } catch(e) { showSnackbar(e.message, "error"); }
  });
}

function formatReward(v) {
  return Number(v).toFixed(2) + " \u20ac";
}
