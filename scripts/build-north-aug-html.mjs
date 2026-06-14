#!/usr/bin/env node
/** Build north-aug-2026.html from research/north-aug-2026.json */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const jsonPath = path.join(root, "research", "north-aug-2026.json");
const outPath = path.join(root, "north-aug-2026.html");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function sanitize(c) {
  const out = { ...c };
  if (!out.price2 && out.pricePP) out.price2 = out.pricePP * 2;
  if (out.price2 && (!out.price3 || out.price3 > out.price2 * 2.8)) {
    const pp = out.pricePP || out.price2 / 2;
    out.price3Est = true;
    out.price3 = Math.round(out.price2 + pp * 0.65);
    out.cabin3Note = out.cabin3Note || " (оценка)";
  }
  if (out.price2 && out.price3 && out.price3 / 3 < (out.pricePP || out.price2 / 2) * 0.92) {
    out.thirdGuestDiscount = true;
  }
  return out;
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

const raw = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const cruises = raw.cruises.map(sanitize);
const meta = raw.meta;
const ports = [...new Set(cruises.map((c) => c.port))].sort();
const nightsList = [...new Set(cruises.map((c) => c.nights))].sort((a, b) => a - b);

const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Северная Европа Aug 2026 — Норвегия, Балтика</title>
<style>
:root { --blue:#007AFF; --green:#34C759; --orange:#FF9500; --teal:#5AC8FA; --bg:#F2F2F7; --card:#fff; --text:#1C1C1E; --text2:#636366; --sep:#E5E5EA; }
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:-apple-system,BlinkMacSystemFont,sans-serif; background:var(--bg); color:var(--text); padding:16px; max-width:1100px; margin:0 auto; }
h1 { font-size:22px; margin-bottom:4px; }
.sub { font-size:13px; color:var(--text2); margin-bottom:16px; line-height:1.5; }
.callout { background:#E5F0FF; border-left:3px solid var(--blue); padding:12px 14px; border-radius:12px; font-size:13px; margin-bottom:16px; line-height:1.55; }
.stats { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:16px; }
.stat { background:var(--card); border:1px solid var(--sep); border-radius:12px; padding:10px; text-align:center; }
.stat b { display:block; font-size:18px; color:var(--blue); }
.stat span { font-size:10px; color:var(--text2); }
.filter-label { font-size:11px; color:var(--text2); text-transform:uppercase; margin:8px 0 6px; letter-spacing:.03em; }
.filters { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:4px; }
.chip { border:1.5px solid var(--sep); background:var(--card); border-radius:20px; padding:7px 14px; font-size:13px; cursor:pointer; }
.chip.on { background:var(--blue); color:#fff; border-color:var(--blue); }
.chip.de.on { background:var(--teal); border-color:var(--teal); }
.chip.nights.on { background:var(--orange); border-color:var(--orange); }
.table-wrap { overflow-x:auto; border-radius:12px; border:1px solid var(--sep); background:var(--card); }
table { width:100%; border-collapse:collapse; font-size:13px; min-width:980px; }
th,td { padding:10px 12px; text-align:left; border-bottom:1px solid var(--sep); vertical-align:top; }
th { background:#f8f8fa; font-size:11px; text-transform:uppercase; color:var(--text2); position:sticky; top:0; }
th.sortable { cursor:pointer; user-select:none; white-space:nowrap; }
th.sortable:hover { color:var(--blue); }
th.sortable.on { color:var(--blue); }
th.sortable .arr { font-size:9px; margin-left:3px; opacity:.45; }
th.sortable.on .arr { opacity:1; }
tr.highlight { background:#E8F5E9; }
tr:hover { background:#f5f9ff; }
.date { font-weight:600; white-space:nowrap; }
.port small { color:var(--text2); display:block; }
.badge { font-size:10px; padding:2px 6px; border-radius:4px; background:var(--sep); display:inline-block; margin:1px 2px 1px 0; }
.badge.best { background:#E8F5E9; color:#1A7A40; }
.badge.child { background:#FFF3E0; color:#B45309; }
.badge.est { background:#EEE; color:#666; }
.price { font-weight:700; white-space:nowrap; }
.price-note { font-size:10px; color:var(--text2); font-weight:400; }
details.fold summary { cursor:pointer; color:var(--blue); font-size:12px; list-style:none; }
details.fold summary::-webkit-details-marker { display:none; }
details.fold summary::before { content:"▸ "; }
details.fold[open] summary::before { content:"▾ "; }
details.fold ul { margin:6px 0 0 0; padding:0; list-style:none; font-size:11px; color:var(--text2); line-height:1.55; }
details.fold li { padding:4px 0; border-bottom:1px solid var(--sep); }
details.fold li:last-child { border-bottom:none; }
details.fold a { color:var(--blue); text-decoration:none; }
details.fold .buy-price { float:right; font-weight:600; color:var(--text); }
details.fold .buy-note { display:block; font-size:10px; color:var(--text2); margin-top:2px; }
details.child-tip { margin-top:4px; }
details.child-tip summary { font-size:11px; color:var(--orange); cursor:pointer; }
details.child-tip ol { margin:6px 0 0 18px; font-size:11px; color:var(--text2); line-height:1.5; }
details.child-tip a { color:var(--blue); }
.foot { margin-top:16px; font-size:12px; color:var(--text2); line-height:1.6; }
@media (max-width:640px) { .stats { grid-template-columns:repeat(2,1fr); } }
</style>
</head>
<body>
<h1>Северная Европа · август 2026</h1>
<p class="sub">Отправление с 5 августа · ${meta.ports.length} портов · ${meta.region || "Norway/Baltic"} · ${meta.source}, ${meta.fetchedAt}${meta.enrichedAt ? " · " + meta.enrichedAt : ""}</p>
<div class="callout">
  <strong>Норвегия / фьорды / Балтика</strong> — прохладнее, чем Средиземное море.
  Порты: <strong>Copenhagen</strong>, <strong>Hamburg</strong>, Kiel, Warnemünde, Bremerhaven, Amsterdam, Stockholm…
  Семья 2–3 чел.: <strong>17 лет = взрослый тариф</strong> везде; смотрите «€ 3 чел.» и промо 3-го гостя.
  Июльские Med-варианты — в <a href="med-summer-july-2026.html">med-summer-july-2026.html</a>.
</div>
<div class="stats" id="stats"></div>
<p class="filter-label">Порт отправления</p>
<div class="filters" id="port-filters"></div>
<p class="filter-label">Количество ночей</p>
<div class="filters" id="nights-filters"></div>
<p class="filter-label">Сортировка</p>
<div class="filters" id="sort-filters"></div>
<p id="count" style="font-size:13px;color:var(--text2);margin-bottom:8px"></p>
<div class="table-wrap">
<table>
<thead><tr>
  <th class="sortable" data-col="date">Дата<span class="arr"></span></th>
  <th class="sortable" data-col="port">Порт<span class="arr"></span></th>
  <th class="sortable" data-col="nights">Ночей<span class="arr"></span></th>
  <th>Корабль</th><th>Маршрут</th>
  <th class="sortable" data-col="price2">€ 2 чел.<span class="arr"></span></th>
  <th class="sortable" data-col="price3">€ 3 чел.<span class="arr"></span></th>
  <th>Купить</th>
</tr></thead>
<tbody id="tbody"></tbody>
</table>
</div>
<p class="foot">
  Cruisello + прямые сайты линий + агентства (CruiseDirect, Vacations To Go, CruiseCompete, iCruise).
  Цены линии/Cruisello — inside, 2 гостя; у агентств цену нужно уточнить на сайте.
  <span class="badge est">оценка</span> — расчётная цена для 3 гостей.
</p>
<script>
const CRUISES = ${JSON.stringify(cruises)};

const PORTS = ["all", ${ports.map((p) => JSON.stringify(p)).join(", ")}];
const NIGHTS = ["all", ${nightsList.join(", ")}];
let portFilter = "all";
let nightsFilter = "all";
let sortCol = "date";
let sortDir = "asc";

const SORT_DEFAULT_DIR = { date: "asc", port: "asc", nights: "desc", price2: "asc", price3: "asc" };

function cmp(a, b, col) {
  if (col === "date") return a.sailDate.localeCompare(b.sailDate);
  if (col === "port") return a.port.localeCompare(b.port) || a.sailDate.localeCompare(b.sailDate);
  if (col === "nights") return a.nights - b.nights || a.sailDate.localeCompare(b.sailDate);
  if (col === "price2") return (a.price2 ?? 9e9) - (b.price2 ?? 9e9);
  if (col === "price3") return (a.price3 ?? 9e9) - (b.price3 ?? 9e9);
  return 0;
}

function fmtEur(n) { return n == null ? "—" : "€" + n.toLocaleString("en-GB"); }

function filtered() {
  let list = CRUISES.filter(c => {
    if (portFilter !== "all" && c.port !== portFilter) return false;
    if (nightsFilter !== "all" && c.nights !== Number(nightsFilter)) return false;
    return true;
  });
  const dir = sortDir === "asc" ? 1 : -1;
  list.sort((a, b) => dir * cmp(a, b, sortCol));
  return list;
}

function updateHeaderSort() {
  document.querySelectorAll("th.sortable").forEach(th => {
    const col = th.dataset.col;
    const on = col === sortCol;
    th.classList.toggle("on", on);
    th.querySelector(".arr").textContent = on ? (sortDir === "asc" ? "↑" : "↓") : "";
  });
}

function buyList(c) {
  const opts = c.buyOptions && c.buyOptions.length ? c.buyOptions : [
    { vendor: c.line, url: c.lineUrl, price2: c.price2, price3: c.price3, note: "сайт линии" },
    { vendor: "Cruisello", url: c.cruiselloUrl, price2: c.price2, price3: c.price3, note: "сравнение" },
    { vendor: "Забронировать", url: c.bookUrl, price2: c.price2, price3: null, note: "Cruisello Book" },
  ];
  const items = opts.map(o => {
    const price = o.price2 != null ? fmtEur(o.price2) : "уточнить";
    const p3 = o.price3 != null ? " / 3ч: " + fmtEur(o.price3) : "";
    const href = o.url ? ' href="' + o.url.replace(/"/g,"") + '" target="_blank" rel="noopener"' : "";
    const link = o.url ? "<a" + href + ">" + o.vendor + " ↗</a>" : o.vendor;
    return "<li>" + link + '<span class="buy-price">' + price + p3 + "</span>" +
      (o.note ? '<span class="buy-note">' + o.note + "</span>" : "") + "</li>";
  }).join("");
  return '<details class="fold buy"><summary>' + opts.length + " площадок</summary><ul>" + items + "</ul></details>";
}

function childTip(c) {
  if (!c.family17) return "";
  const t = c.family17;
  const steps = (t.steps || []).map(s => "<li>" + s + "</li>").join("");
  return '<details class="child-tip fold"><summary>17 лет — тариф</summary>' +
    "<p><strong>" + (t.summary || "") + "</strong></p>" +
    "<p>" + (t.discountHint || "") + "</p>" +
    (steps ? "<ol>" + steps + "</ol>" : "") +
    (t.policyUrl ? '<p><a href="' + t.policyUrl + '" target="_blank" rel="noopener">Сайт линии ↗</a></p>' : "") +
    "</details>";
}

const DE_PORTS = new Set(["Copenhagen","Hamburg","Kiel","Warnemünde","Bremerhaven","Amsterdam"]);

function render() {
  const list = filtered();
  const de = CRUISES.filter(c => c.country === "Germany" || c.country === "Denmark");
  const best = [...CRUISES].filter(c=>c.price2).sort((a,b)=>a.price2-b.price2)[0];
  const earliest = [...CRUISES].sort((a,b)=>a.sailDate.localeCompare(b.sailDate))[0];
  document.getElementById("stats").innerHTML = \`
    <div class="stat"><b>\${CRUISES.length}</b><span>рейсов</span></div>
    <div class="stat"><b>\${de.length}</b><span>DE / DK</span></div>
    <div class="stat"><b>\${best ? fmtEur(best.price2) : "—"}</b><span>мин. 2 чел.</span></div>
    <div class="stat"><b>\${earliest ? earliest._fmtDate : "—"}</b><span>первый рейс</span></div>\`;

  document.getElementById("port-filters").innerHTML = PORTS.map(p =>
    \`<button class="chip\${DE_PORTS.has(p)?" de":""}\${portFilter===p?" on":""}" data-port="\${p}">\${p==="all"?"Все порты":p}</button>\`
  ).join("");

  document.getElementById("nights-filters").innerHTML = NIGHTS.map(n =>
    \`<button class="chip nights\${nightsFilter===String(n)?" on":""}" data-nights="\${n}">\${n==="all"?"Все ночи":n+" ноч."}</button>\`
  ).join("");

  document.getElementById("sort-filters").innerHTML = [
    ["date","По дате"],
    ["nights","По ночам"],
    ["price2","По цене 2 чел."],
    ["price3","По цене 3 чел."]
  ].map(([k,l]) => \`<button class="chip\${sortCol===k?" on":""}" data-sort="\${k}">\${l}\${sortCol===k ? (sortDir==="asc"?" ↑":" ↓") : ""}</button>\`).join("");

  updateHeaderSort();

  document.getElementById("count").textContent = "Показано " + list.length + " рейсов";
  document.getElementById("tbody").innerHTML = list.map(c => {
    const hl = c.sailDate === "2026-08-05" ? ' class="highlight"' : "";
    const tags = [];
    if (c.sailDate === "2026-08-05") tags.push('<span class="badge best">5 Aug</span>');
    if (c.itinerary?.some(p => /Bergen|Geiranger|Flåm|Norway|Oslo|Stavanger/i.test(p))) tags.push('<span class="badge best">Norway</span>');
    if (c.thirdGuestDiscount) tags.push('<span class="badge child">3-й гость дешевле</span>');
    if (c.price3Est) tags.push('<span class="badge est">оценка 3 чел.</span>');
    const route = c.itinerary?.length
      ? \`<details class="fold route"><summary>\${c.itinerary.length} портов</summary><ul>\${c.itinerary.map(p=>"<li>"+p+"</li>").join("")}</ul></details>\`
      : "—";
    const p3note = (c.cabin3Note||"").trim();
    return \`<tr\${hl}>
      <td class="date">\${c._fmtDate || ""}</td>
      <td class="port"><strong>\${c.port}</strong><small>\${c.country}</small></td>
      <td>\${c.nights}</td>
      <td>\${tags.join(" ")}\${c.line}<br><small>\${c.ship}</small>\${childTip(c)}</td>
      <td>\${route}</td>
      <td class="price">\${fmtEur(c.price2)}</td>
      <td class="price">\${fmtEur(c.price3)}\${p3note ? '<br><span class="price-note">'+p3note.replace(/^\\s*\\(/,"").replace(/\\)$/,"")+'</span>' : ""}</td>
      <td>\${buyList(c)}</td>
    </tr>\`;
  }).join("");

  document.querySelectorAll("[data-port]").forEach(b => b.onclick = () => { portFilter = b.dataset.port; render(); });
  document.querySelectorAll("[data-nights]").forEach(b => b.onclick = () => { nightsFilter = b.dataset.nights; render(); });
  document.querySelectorAll("[data-sort]").forEach(b => b.onclick = () => {
    const col = b.dataset.sort;
    if (sortCol === col) sortDir = sortDir === "asc" ? "desc" : "asc";
    else { sortCol = col; sortDir = SORT_DEFAULT_DIR[col] || "asc"; }
    render();
  });
}

document.querySelectorAll("th.sortable").forEach(th => {
  th.addEventListener("click", () => {
    const col = th.dataset.col;
    if (sortCol === col) sortDir = sortDir === "asc" ? "desc" : "asc";
    else { sortCol = col; sortDir = SORT_DEFAULT_DIR[col] || "asc"; }
    render();
  });
});

CRUISES.forEach(c => {
  const [y,m,d] = c.sailDate.split("-").map(Number);
  const months = ${JSON.stringify(MONTHS)};
  c._fmtDate = String(d).padStart(2,"0") + " " + months[m-1] + " " + y;
});
render();
</script>
</body>
</html>`;

fs.writeFileSync(outPath, html);
console.log(`Built ${outPath} (${cruises.length} cruises, nights: ${nightsList.join(", ")})`);
