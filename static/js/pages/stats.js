/**
 * stats.js – Statistiken | Exportieren | Vergleichen
 */
import { apiFetch, showSnackbar, clearPrimaryAction } from "../app.js";
import { statChip, gradeBadge, emptyState, errorBanner, injectComponentStyles } from "../components.js";

let activeTab = "stats";

export default async function render(container) {
  injectComponentStyles();
  clearPrimaryAction();
  renderTabShell(container);
}

function renderTabShell(container) {
  const tabs = { stats: "Statistiken", export: "Exportieren", compare: "Vergleichen" };
  container.innerHTML =
    '<div class="m3-tab-bar">' +
      Object.entries(tabs).map(([k, v]) =>
        '<button class="m3-tab ' + (activeTab === k ? "m3-tab--active" : "") + '" data-tab="' + k + '">' + v + '</button>'
      ).join("") +
    '</div><div id="stContent"></div>';
  container.querySelectorAll("[data-tab]").forEach(btn =>
    btn.addEventListener("click", () => { activeTab = btn.dataset.tab; renderTabShell(container); })
  );
  const c = container.querySelector("#stContent");
  if      (activeTab === "stats")   renderStats(c);
  else if (activeTab === "export")  renderExport(c);
  else if (activeTab === "compare") renderCompare(c);
}

// ---------------------------------------------------------------------------
// SVG line chart
// ---------------------------------------------------------------------------
function lineChart(points, { H = 110, yMin, yMax, color, areaFill, invert = false } = {}) {
  if (!points || points.length < 2)
    return '<p style="font-size:12px;color:var(--md-sys-color-on-surface-variant);padding:6px 0">Nicht genug Daten.</p>';
  const W = 400, PAD = { t: 10, r: 8, b: 22, l: 34 };
  const iW = W - PAD.l - PAD.r, iH = H - PAD.t - PAD.b;
  const ys = points.map(p => p.y);
  const yLo = yMin !== undefined ? yMin : Math.min(...ys);
  const yHi = yMax !== undefined ? yMax : Math.max(...ys);
  const yRng = yHi - yLo || 1;
  const px = i => PAD.l + (i / (points.length - 1)) * iW;
  const py = v => invert ? PAD.t + ((v - yLo) / yRng) * iH : PAD.t + iH - ((v - yLo) / yRng) * iH;
  const ptStr = points.map((p, i) => px(i).toFixed(1) + "," + py(p.y).toFixed(1)).join(" ");
  const areaD = "M" + px(0).toFixed(1) + "," + py(yLo).toFixed(1) + " " +
    points.map((p, i) => "L" + px(i).toFixed(1) + "," + py(p.y).toFixed(1)).join(" ") +
    " L" + px(points.length - 1).toFixed(1) + "," + py(yLo).toFixed(1) + " Z";
  const ticks = [yLo, (yLo + yHi) / 2, yHi];
  const ticksSvg = ticks.map(v =>
    '<line x1="' + PAD.l + '" y1="' + py(v).toFixed(1) + '" x2="' + (W - PAD.r) + '" y2="' + py(v).toFixed(1) +
    '" stroke="var(--md-sys-color-outline-variant)" stroke-width="1" stroke-dasharray="3,4"/>' +
    '<text x="' + (PAD.l - 3) + '" y="' + (py(v) + 3.5).toFixed(1) +
    '" text-anchor="end" font-size="10" fill="var(--md-sys-color-on-surface-variant)">' +
    (Number.isInteger(v) ? v : v.toFixed(1)) + '</text>'
  ).join("");
  const dotsSvg = points.map((p, i) =>
    '<circle cx="' + px(i).toFixed(1) + '" cy="' + py(p.y).toFixed(1) + '" r="3" fill="' + color +
    '" stroke="var(--md-sys-color-surface)" stroke-width="1.5"/>'
  ).join("");
  return '<div style="overflow:hidden;margin-top:4px">' +
    '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto" xmlns="http://www.w3.org/2000/svg">' +
      ticksSvg +
      (areaFill ? '<path d="' + areaD + '" fill="' + areaFill + '" opacity="0.12"/>' : '') +
      '<polyline points="' + ptStr + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
      dotsSvg +
    '</svg></div>';
}

// ---------------------------------------------------------------------------
// Statistiken
// ---------------------------------------------------------------------------
async function renderStats(container) {
  container.innerHTML = emptyState("hourglass_top", "Lade\u2026");
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
  const savg = s => { const w = s.grades.reduce((a,g)=>a+g.weight,0); return w ? s.grades.reduce((a,g)=>a+g.value*g.weight,0)/w : 0; };
  const swg  = subjects.filter(s => s.grades.length);
  const best  = all.reduce((a, g) => g.value < a.value ? g : a);
  const worst = all.reduce((a, g) => g.value > a.value ? g : a);

  const dist = {1:0,2:0,3:0,4:0,5:0,6:0};
  all.forEach(g => { const r = Math.min(6,Math.max(1,Math.round(g.value))); dist[r]++; });
  const mx = Math.max(...Object.values(dist), 1);

  const lc = {};
  all.forEach(g => g.labels?.forEach(l => { if (l) lc[l] = (lc[l]||0)+1; }));
  const topL = Object.entries(lc).sort((a,b)=>b[1]-a[1]).slice(0,6);

  const subjectTrends = swg.map(s => {
    const n = s.grades.length;
    if (n < 2) return { name: s.name, slope: 0, avg: savg(s) };
    const xs = [...Array(n).keys()], ys = s.grades.map(g=>g.value);
    const xm = xs.reduce((a,x)=>a+x,0)/n, ym = ys.reduce((a,y)=>a+y,0)/n;
    const num = xs.reduce((a,x,i)=>a+(x-xm)*(ys[i]-ym),0), den = xs.reduce((a,x)=>a+(x-xm)**2,0);
    return { name: s.name, slope: den?num/den:0, avg: savg(s) };
  }).sort((a,b)=>a.avg-b.avg);

  const gradeEvents = (wallet.grade_log||[]).filter(e=>e.action==="+");
  let runSum = 0;
  const avgRunPoints = gradeEvents.map((e,i)=>{ runSum+=e.value; return {y:runSum/(i+1)}; });
  const gradePoints  = gradeEvents.map(e=>({y:e.value}));
  let cumulative = 0;
  const walletPoints = (wallet.grade_log||[])
    .filter(e=>typeof e.value_delta==="number" && e.value_delta>0)
    .map(e=>{ cumulative+=e.value_delta; return {y:cumulative}; });

  const hasGradeChart  = gradeEvents.length >= 2;
  const hasWalletChart = rewardConfig.enabled && walletPoints.length >= 2;
  const redeemed       = wallet.redemptions.reduce((a,r)=>a+r.cost,0);
  const fmt            = v => fmtReward(v, rewardConfig);

  // Tall cards
  const fachTrendCard =
    '<div class="card"><p class="st-head">F\u00e4cher & Trends</p>' +
    subjectTrends.map(t => {
      const arrow = t.slope<-.05?"\u2191":t.slope>.05?"\u2193":"\u2192";
      const ac    = t.slope<-.05?"#1b7e4a":t.slope>.05?"var(--md-sys-color-error)":"var(--md-sys-color-on-surface-variant)";
      return '<div class="grade-row" style="gap:8px"><span style="flex:1;font-size:14px">'+t.name+'</span>' +
        '<span style="color:'+ac+';font-weight:700;font-size:16px;width:20px;text-align:center">'+arrow+'</span>' +
        '<span style="font-size:12px;color:var(--md-sys-color-on-surface-variant);min-width:52px;text-align:right">\u00d8 '+t.avg.toFixed(2)+'</span></div>';
    }).join("") + '</div>';

  const gradeChartCard = hasGradeChart
    ? '<div class="card"><p class="st-head">Notenverlauf <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:11px">(Note 1 = oben)</span></p>' +
        lineChart(gradePoints,  {H:100,yMin:1,yMax:6,color:"var(--md-sys-color-primary)",areaFill:"var(--md-sys-color-primary)",invert:true}) +
        '<p class="st-head" style="margin-top:14px">Laufender Gesamtschnitt</p>' +
        lineChart(avgRunPoints, {H:80, yMin:1,yMax:6,color:"var(--md-sys-color-secondary)",invert:true}) +
      '</div>'
    : "";

  // Short cards
  const bestWorstFachCard =
    '<div class="card"><p class="st-head">Bestes & Schlechtestes Fach</p>' +
    '<div class="grade-row"><span class="material-symbols-rounded" style="font-size:20px;color:var(--md-sys-color-primary)">emoji_events</span>' +
      '<span style="flex:1;font-size:13px;color:var(--md-sys-color-on-surface-variant)">Bestes</span>' +
      '<span style="font-size:14px">'+(subjectTrends[0]?.name??"\u2014")+'</span>' +
      '<span style="font-size:12px;color:var(--md-sys-color-on-surface-variant);margin-left:6px">(\u00d8 '+(subjectTrends[0]?.avg.toFixed(2)??"\u2014")+')</span></div>' +
    '<div class="grade-row"><span class="material-symbols-rounded" style="font-size:20px;color:var(--md-sys-color-error)">sentiment_dissatisfied</span>' +
      '<span style="flex:1;font-size:13px;color:var(--md-sys-color-on-surface-variant)">Schlechtestes</span>' +
      '<span style="font-size:14px">'+(subjectTrends.at(-1)?.name??"\u2014")+'</span>' +
      '<span style="font-size:12px;color:var(--md-sys-color-on-surface-variant);margin-left:6px">(\u00d8 '+(subjectTrends.at(-1)?.avg.toFixed(2)??"\u2014")+')</span></div>' +
    '</div>';

  const notenCard =
    '<div class="card"><p class="st-head">Einzelnoten</p>' +
    '<div class="grade-row">'+gradeBadge(best.value)+'<span style="flex:1;font-size:13px;color:var(--md-sys-color-on-surface-variant)">Beste Note</span><span style="font-size:13px">'+best.subject+'</span></div>' +
    '<div class="grade-row">'+gradeBadge(worst.value)+'<span style="flex:1;font-size:13px;color:var(--md-sys-color-on-surface-variant)">Schlechteste</span><span style="font-size:13px">'+worst.subject+'</span></div>' +
    '<div style="font-size:12px;color:var(--md-sys-color-on-surface-variant);margin-top:8px">'+all.length+' Noten gesamt</div></div>';

  const verteilungCard =
    '<div class="card"><p class="st-head">Notenverteilung</p>' +
    '<div style="display:flex;align-items:flex-end;gap:6px;height:90px;padding-top:16px">' +
    Object.entries(dist).map(([g,c]) =>
      '<div style="display:flex;flex-direction:column;align-items:center;gap:3px;flex:1">' +
        '<span style="font-size:11px;color:var(--md-sys-color-on-surface-variant);min-height:14px">'+(c||"")+'</span>' +
        '<div style="width:100%;border-radius:3px 3px 0 0;min-height:3px;height:'+Math.round((c/mx)*60)+'px;background:'+
          (+g<=2?"var(--md-sys-color-primary)":+g<=4?"var(--md-sys-color-secondary)":"var(--md-sys-color-error)")+'"></div>' +
        '<span style="font-size:12px;font-weight:500">'+g+'</span></div>'
    ).join("") + '</div></div>';

  const labelsCard = topL.length
    ? '<div class="card"><p class="st-head">Top Labels</p><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">' +
        topL.map(([l,n])=>'<span style="padding:4px 10px;border-radius:var(--shape-corner-full);background:var(--md-sys-color-secondary-container);color:var(--md-sys-color-on-secondary-container);font-size:13px">'+l+' <strong>'+n+'\u00d7</strong></span>').join("") +
      '</div></div>' : "";

  const rewardCard = rewardConfig.enabled
    ? '<div class="card"><p class="st-head">Belohnungen</p><div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:6px">' +
        statChip("Verdient",fmt(wallet.balance+redeemed))+statChip("Eingel\u00f6st",fmt(redeemed),"--md-sys-color-secondary")+statChip("Guthaben",fmt(wallet.balance),"--md-sys-color-tertiary") +
      '</div></div>' : "";

  const walletChartCard = hasWalletChart
    ? '<div class="card"><p class="st-head">Guthaben-Verlauf (kumuliert)</p>' +
        lineChart(walletPoints,{H:100,yMin:0,color:"#1b7e4a",areaFill:"#1b7e4a"}) +
      '</div>' : "";

  const shortCards = [verteilungCard, bestWorstFachCard, notenCard];
  if (labelsCard)      shortCards.push(labelsCard);
  if (rewardCard)      shortCards.push(rewardCard);
  if (walletChartCard) shortCards.push(walletChartCard);

  const tallSection = hasGradeChart
    ? '<div class="st-grid-tall">' + fachTrendCard + gradeChartCard + '</div>'
    : fachTrendCard;  // just the card, no grid wrapper needed

  // .st-stats-wrapper uses flex-column gap:16px → consistent spacing between all sections
  container.innerHTML =
    '<div class="card" style="display:flex;flex-wrap:wrap;gap:16px;justify-content:space-around;margin-bottom:16px">' +
      statChip("Gesamtschnitt",avg.toFixed(2))+statChip("Noten gesamt",all.length,"--md-sys-color-secondary")+statChip("F\u00e4cher",swg.length,"--md-sys-color-tertiary") +
    '</div>' +
    '<div class="st-stats-wrapper">' +
      tallSection +
      '<div class="st-grid">' + shortCards.join("") + '</div>' +
    '</div>';
}

// ---------------------------------------------------------------------------
// Exportieren – .btn-filled
// ---------------------------------------------------------------------------
async function renderExport(container) {
  container.innerHTML =
    '<div class="card" style="max-width:480px"><p class="st-head" style="margin-bottom:16px">Export erstellen</p>' +
    '<md-outlined-text-field id="exportLabel" label="Export-Label (optional)" placeholder="z.B. 3. Quartal \u2013 Mai 2026" style="width:100%;margin-bottom:16px"></md-outlined-text-field>' +
    '<p style="font-size:13px;color:var(--md-sys-color-on-surface-variant);margin-bottom:10px">Inhalt ausw\u00e4hlen:</p>' +
    '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px">' +
      '<label style="display:flex;align-items:center;gap:10px;font-size:14px;cursor:pointer"><md-checkbox id="chkStats"  checked></md-checkbox> Statistiken</label>' +
      '<label style="display:flex;align-items:center;gap:10px;font-size:14px;cursor:pointer"><md-checkbox id="chkGrades" checked></md-checkbox> Noten pro Fach</label>' +
      '<label style="display:flex;align-items:center;gap:10px;font-size:14px;cursor:pointer"><md-checkbox id="chkLog"></md-checkbox> Noten\u00e4nderungen</label>' +
      '<label style="display:flex;align-items:center;gap:10px;font-size:14px;cursor:pointer"><md-checkbox id="chkRedeem"></md-checkbox> Einl\u00f6sungen</label>' +
    '</div>' +
    '<button class="btn-filled" id="btnExport"><span class="material-symbols-rounded">download</span>Als TXT herunterladen</button>' +
    '</div>';

  container.querySelector("#btnExport").addEventListener("click", async () => {
    let data;
    try { data = await apiFetch("/api/export"); }
    catch(e) { showSnackbar(e.message,"error"); return; }
    if (!data.grade_count) { showSnackbar("Keine Noten vorhanden.","error"); return; }
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
// Vergleichen – .btn-filled (primary color)
// ---------------------------------------------------------------------------
function renderCompare(container) {
  container.innerHTML =
    '<div class="card" style="max-width:560px"><p class="st-head" style="margin-bottom:16px">Zwei Exporte vergleichen</p>' +
    '<p style="font-size:13px;color:var(--md-sys-color-on-surface-variant);margin-bottom:16px">Lade zwei exportierte TXT-Dateien hoch.</p>' +
    '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:20px">' +
      '<div style="flex:1;min-width:160px"><p style="font-size:12px;margin-bottom:6px;color:var(--md-sys-color-on-surface-variant)">Export 1 (\u00e4lter)</p><input type="file" id="file1" accept=".txt" style="font-size:13px;width:100%"/></div>' +
      '<div style="flex:1;min-width:160px"><p style="font-size:12px;margin-bottom:6px;color:var(--md-sys-color-on-surface-variant)">Export 2 (neuer)</p><input type="file" id="file2" accept=".txt" style="font-size:13px;width:100%"/></div>' +
    '</div>' +
    '<button class="btn-filled" id="btnCompare">Vergleichen</button></div>' +
    '<div id="cmpResult" style="margin-top:20px"></div>';

  container.querySelector("#btnCompare").addEventListener("click", async () => {
    const f1 = container.querySelector("#file1").files[0], f2 = container.querySelector("#file2").files[0];
    if (!f1||!f2) { showSnackbar("Bitte beide Dateien ausw\u00e4hlen.","error"); return; }
    const [t1,t2] = await Promise.all([f1.text(),f2.text()]);
    renderCmpResult(container.querySelector("#cmpResult"), parseExport(t1), parseExport(t2));
  });
}

function renderCmpResult(el, d1, d2) {
  const diff = (a,b,inv=false) => {
    if (a==null||b==null) return "\u2014";
    const d=b-a, better=inv?d<0:d>0, color=d===0?"inherit":better?"#1b7e4a":"var(--md-sys-color-error)", arrow=d===0?"\u2192":better?"\u2191":"\u2193";
    return '<span style="color:'+color+';font-weight:600">'+arrow+' '+(d>0?"+":"")+d.toFixed(2)+'</span>';
  };
  const all = [...new Set([...Object.keys(d1.subjects),...Object.keys(d2.subjects)])].sort();
  const td  = s => '<td style="padding:8px;border-bottom:1px solid var(--md-sys-color-outline-variant)">'+s+'</td>';
  const row = (label,v1,v2,d) => '<tr>'+td('<span style="font-size:13px;color:var(--md-sys-color-on-surface-variant)">'+label+'</span>')+td(v1)+td(v2)+td(d)+'</tr>';
  el.innerHTML =
    '<div class="card" style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">' +
    '<thead><tr>'+['',d1.label,d2.label,'\u0394'].map(h=>'<th style="text-align:left;padding:6px 8px;color:var(--md-sys-color-on-surface-variant);border-bottom:1px solid var(--md-sys-color-outline-variant)">'+h+'</th>').join("")+'</tr></thead>' +
    '<tbody>' +
      row("Gesamtschnitt",d1.avg?.toFixed(2)??"\u2014",d2.avg?.toFixed(2)??"\u2014",diff(d1.avg,d2.avg,true)) +
      row("Anzahl Noten",d1.cnt??"\u2014",d2.cnt??"\u2014",d1.cnt!=null&&d2.cnt!=null?(d2.cnt-d1.cnt>0?"+":"")+(d2.cnt-d1.cnt):"\u2014") +
      row("Bestes Fach",d1.best??"\u2014",d2.best??"\u2014","") +
      row("Schw\u00e4chstes",d1.worst??"\u2014",d2.worst??"\u2014","") +
      '<tr><td colspan="4" style="padding:8px;border-bottom:1px solid var(--md-sys-color-outline-variant);font-size:12px;font-weight:600;color:var(--md-sys-color-on-surface-variant)">F\u00e4cher</td></tr>' +
      all.map(n=>{ const a1=d1.subjects[n],a2=d2.subjects[n]; return row(n,a1!=null?a1.toFixed(2):"\u2014",a2!=null?a2.toFixed(2):"\u2014",diff(a1,a2,true)); }).join("") +
    '</tbody></table></div>';
}

// ---------------------------------------------------------------------------
// Export helpers
// ---------------------------------------------------------------------------
function buildExport(data, label, {incStats,incGrades,incLog,incRedeem}) {
  const cfg=data.reward_config, fmt=v=>fmtReward(v,cfg);
  const L=["NOTENRECHNER EXPORT","Label:    "+label,"Erstellt: "+new Date().toLocaleString("de-DE")];
  if (incStats&&data.overall_average!=null) {
    L.push("","=== STATISTIKEN ===","Gesamtdurchschnitt: "+data.overall_average.toFixed(2),"Anzahl Noten: "+data.grade_count);
    if (data.top_labels?.length) L.push("Top Labels: "+data.top_labels.map(x=>x.label+"("+x.count+"x)").join(", "));
    if (data.best_subject)  L.push("Bestes Fach: "+data.best_subject.name+" ("+data.best_subject.average+")");
    if (data.worst_subject) L.push("Schlechtestes Fach: "+data.worst_subject.name+" ("+data.worst_subject.average+")");
    if (cfg.enabled) L.push("Verdient: "+fmt(data.wallet_balance+data.total_redeemed),"Eingelöst: "+fmt(data.total_redeemed),"Restguthaben: "+fmt(data.wallet_balance));
  }
  if (incGrades) {
    L.push("","=== NOTEN PRO FACH ===");
    data.subjects.forEach(s=>{
      const w=s.grades.reduce((a,g)=>a+g.weight,0),a=w?s.grades.reduce((a,g)=>a+g.value*g.weight,0)/w:0;
      L.push("Fach: "+s.name+" | \u00d8 "+a.toFixed(2));
      s.grades.forEach(g=>L.push("  "+g.value+" | "+g.weight+"x | "+(g.labels.join(", ")||"\u2013")));
      L.push("");
    });
  }
  if (incLog&&data.grade_log?.length) {
    L.push("","=== NOTEN\u00c4NDERUNGEN ===");
    const sym={"+":"Hinzugef\u00fcgt","-":"Gel\u00f6scht","~":"Bearbeitet"};
    [...data.grade_log].reverse().forEach(e=>L.push((sym[e.action]??e.action)+" | "+e.date+" | "+e.subject+" | "+e.value+" ("+e.weight+"x)"));
  }
  if (incRedeem&&data.redemptions?.length) {
    L.push("","=== EINL\u00d6SUNGEN ===");
    [...data.redemptions].reverse().forEach(r=>L.push(r.description+" | -"+fmt(r.cost)+" | "+(r.date??"")));
  }
  L.push("","[EXPORT_LABEL="+label+"]");
  return L;
}

function parseExport(text) {
  const r={label:"Unbekannt",avg:null,cnt:null,best:null,worst:null,subjects:{}};
  for (const line of text.split("\n")) {
    if      (line.startsWith("Label:"))              r.label=line.split(":").slice(1).join(":").trim();
    else if (line.startsWith("Gesamtdurchschnitt:")) r.avg=parseFloat(line.split(":")[1]);
    else if (line.startsWith("Anzahl"))              r.cnt=parseInt(line.split(":")[1]);
    else if (line.startsWith("Bestes Fach:"))        r.best=line.split(":").slice(1).join(":").trim();
    else if (line.startsWith("Schlechtestes Fach:")) r.worst=line.split(":").slice(1).join(":").trim();
    else if (line.startsWith("Fach:")) { const p=line.split("|"),name=p[0].replace("Fach:","").trim(),a=parseFloat((p[1]??"").replace("\u00d8","")); if (!isNaN(a)) r.subjects[name]=a; }
  }
  return r;
}

function fmtReward(v, cfg) {
  if (!cfg?.enabled) return String(v);
  if (cfg.reward_mode==="money") return Number(v).toFixed(2)+" \u20ac";
  if (cfg.reward_mode==="unit")  return v+" "+cfg.unit_name;
  return Math.round(v)+" Pt.";
}

function downloadText(content, filename) {
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([content],{type:"text/plain;charset=utf-8"})), download: filename });
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

// Fixed: YYYYMMDD_HHMM format
function ts() {
  const d = new Date(), pad = n => String(n).padStart(2,"0");
  return d.getFullYear() + pad(d.getMonth()+1) + pad(d.getDate()) + "_" + pad(d.getHours()) + pad(d.getMinutes());
}
