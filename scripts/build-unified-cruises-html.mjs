#!/usr/bin/env node
/** Unified Europe cruises viewer → cruises-europe-2026.html */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { annotateHotDeals } from "./lib/hot-deal-score.mjs";
import { formatPortLabel } from "./lib/port-countries.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outPath = path.join(root, "cruises-europe-2026.html");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const REGIONS = [
  {
    id: "med",
    title: "Средиземноморье",
    subtitle: "Франция, Испания, Италия · тепло",
    dates: "с 5 Jul 2026",
    json: "research/summer-med-july-2026.json",
    accent: "orange",
    callout:
      "Marseille, Cannes, Barcelona, Genoa и др. Семья 2–3 чел. Дочка 17 лет — взрослый тариф; смотрите «€ 3 чел.» и промо 3-го гостя.",
    highlightPorts: new Set(["Marseille", "Cannes"]),
    statLabel: "из Франции",
    statFilter: (c) => c.country === "France",
  },
  {
    id: "north",
    title: "Северная Европа",
    subtitle: "Норвегия, фьорды, Балтика · прохладно",
    dates: "с 5 Aug 2026",
    json: "research/north-aug-2026.json",
    accent: "teal",
    callout:
      "Copenhagen, Hamburg, Kiel, Bremerhaven. Фьорды, North Cape, Балтика. 17 лет = взрослый тариф на всех линиях.",
    highlightPorts: new Set(["Copenhagen", "Hamburg", "Kiel", "Bremerhaven", "Warnemünde"]),
    statLabel: "DE / DK",
    statFilter: (c) => c.country === "Germany" || c.country === "Denmark",
  },
];

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

function loadRegion(reg) {
  const raw = JSON.parse(fs.readFileSync(path.join(root, reg.json), "utf8"));
  const cruises = raw.cruises.map(sanitize).map((c) => ({ ...c, regionId: reg.id }));
  return { meta: raw.meta, cruises, reg };
}

const loaded = REGIONS.map(loadRegion);
const allCruises = annotateHotDeals(loaded.flatMap((l) => l.cruises)).map((c) => ({
  ...c,
  itineraryLabels: (c.itinerary || []).map(formatPortLabel),
}));
const regionMeta = Object.fromEntries(loaded.map((l) => [l.reg.id, { ...l.reg, meta: l.meta, count: l.cruises.length }]));

const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Круизы Европа 2026 — Med & North</title>
<style>
:root { --blue:#007AFF; --green:#34C759; --orange:#FF9500; --teal:#5AC8FA; --bg:#F2F2F7; --card:#fff; --text:#1C1C1E; --text2:#636366; --sep:#E5E5EA; }
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:-apple-system,BlinkMacSystemFont,sans-serif; background:var(--bg); color:var(--text); padding:16px; max-width:1280px; margin:0 auto; }
h1 { font-size:22px; margin-bottom:4px; }
.sub { font-size:13px; color:var(--text2); margin-bottom:16px; line-height:1.5; }
.region-cards { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px; }
.region-card { text-align:left; border:2px solid var(--sep); background:var(--card); border-radius:16px; padding:16px; cursor:pointer; transition:border-color .15s, box-shadow .15s; }
.region-card:hover { border-color:var(--blue); }
.region-card.on.med { border-color:var(--orange); background:#FFF8F0; }
.region-card.on.north { border-color:var(--teal); background:#F0FAFF; }
.region-card h2 { font-size:17px; margin-bottom:4px; }
.region-card p { font-size:12px; color:var(--text2); margin-bottom:8px; line-height:1.4; }
.region-card .count { font-size:13px; font-weight:600; color:var(--blue); }
.region-card .dates { font-size:11px; color:var(--text2); display:block; margin-top:2px; }
.callout { background:#E5F0FF; border-left:3px solid var(--blue); padding:12px 14px; border-radius:12px; font-size:13px; margin-bottom:16px; line-height:1.55; }
.stats { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:16px; }
.stat { background:var(--card); border:1px solid var(--sep); border-radius:12px; padding:10px; text-align:center; }
.stat b { display:block; font-size:18px; color:var(--blue); }
.stat span { font-size:10px; color:var(--text2); }
.filter-label { font-size:11px; color:var(--text2); text-transform:uppercase; margin:8px 0 6px; letter-spacing:.03em; }
.filters { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:4px; }
.chip { border:1.5px solid var(--sep); background:var(--card); border-radius:20px; padding:7px 14px; font-size:13px; cursor:pointer; }
.chip.on { background:var(--blue); color:#fff; border-color:var(--blue); }
.chip.accent-med.on { background:var(--orange); border-color:var(--orange); }
.chip.accent-north.on { background:var(--teal); border-color:var(--teal); }
.chip.nights.on { background:var(--purple, #5856D6); border-color:var(--purple, #5856D6); color:#fff; }
.table-wrap { overflow-x:auto; border-radius:12px; border:1px solid var(--sep); background:var(--card); }
table { width:100%; border-collapse:collapse; font-size:13px; table-layout:fixed; }
th,td { padding:8px 10px; text-align:left; border-bottom:1px solid var(--sep); vertical-align:top; }
th.col-date,td.col-date { width:72px; }
th.col-port,td.col-port { width:96px; }
th.col-nights,td.col-nights { width:48px; text-align:center; }
th.col-ship,td.col-ship { width:22%; }
th.col-route,td.col-route { width:12%; }
td.col-route li { font-size:11px; line-height:1.45; }
th.col-price,td.col-price { width:88px; }
th.col-buy,td.col-buy { width:14%; }
th { background:#f8f8fa; font-size:11px; text-transform:uppercase; color:var(--text2); position:sticky; top:0; }
th.sortable { cursor:pointer; user-select:none; white-space:nowrap; }
th.sortable:hover { color:var(--blue); }
th.sortable.on { color:var(--blue); }
th.sortable .arr { font-size:9px; margin-left:3px; opacity:.45; }
th.sortable.on .arr { opacity:1; }
tr.highlight { background:#E8F5E9; }
tr.hot-deal { background:linear-gradient(90deg,#FFCDD2 0%,#FFEBEE 55%,#FFF8F8 100%); box-shadow:inset 4px 0 0 #C62828, inset -1px 0 0 #EF9A9A, inset 0 1px 0 #EF9A9A, inset 0 -1px 0 #EF9A9A; }
tr.hot-deal:hover { background:#FFCDD2; }
tr.hot-deal.highlight { background:linear-gradient(90deg,#FFCDD2 0%,#FFEBEE 55%,#FFF8F8 100%); }
.hot-badge { display:inline-block; background:#B71C1C; color:#FFEB3B; font-weight:800; font-size:10px; letter-spacing:.14em; padding:2px 7px; border-radius:4px; margin-right:5px; border:1px solid #7F0000; box-shadow:0 1px 2px rgba(0,0,0,.15); vertical-align:middle; }
.hot-score { font-size:9px; color:#C62828; font-weight:600; margin-left:2px; opacity:.85; }
.chip.hot-filter.on { background:#C62828; border-color:#B71C1C; color:#FFEB3B; }
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
.refresh-btn { display:block; margin-top:6px; font-size:11px; padding:4px 8px; border-radius:8px; border:1px solid var(--sep); background:var(--bg); cursor:pointer; color:var(--blue); width:100%; }
.refresh-btn:hover { background:#E8F0FE; }
.refresh-btn:disabled { opacity:.5; cursor:wait; }
.refresh-btn.err { color:#FF3B30; border-color:#FF3B30; }
.refresh-status { font-size:10px; color:var(--text2); margin-top:4px; }
.buy-manual { opacity:.85; font-style:italic; }
.buy-verified { font-size:10px; color:var(--green); }
.badge.best-deal { background:#34C759; color:#fff; font-size:10px; }
.refresh-btn.primary { background:var(--blue); color:#fff; border-color:var(--blue); font-weight:600; }
.refresh-btn.primary:hover { background:#0066d6; }
.best-hint { font-size:10px; color:var(--green); display:block; margin-top:2px; }
.buy-compact { font-size:11px; line-height:1.45; }
.buy-best { font-weight:700; color:var(--green); margin-bottom:2px; }
.buy-vtg-status { font-size:10px; color:var(--text2); margin-bottom:4px; }
.buy-toggle { border:none; background:transparent; color:var(--blue); cursor:pointer; font-size:11px; padding:0; text-align:left; }
.buy-toggle.on { font-weight:600; }
tr.buy-detail { background:#f4f6fb; }
tr.buy-detail td { padding:0; border-bottom:2px solid var(--sep); }
.buy-panel { padding:12px 14px 14px; }
.buy-panel-head { display:flex; flex-wrap:wrap; align-items:center; gap:10px; margin-bottom:10px; }
.buy-flash { background:#E8F5E9; border:1px solid #34C759; color:#1A7A40; border-radius:10px; padding:10px 12px; font-size:12px; margin-bottom:10px; }
.buy-flash.err { background:#FFF0F0; border-color:#FF3B30; color:#C62828; }
.buy-intro { background:#EEF2FF; border-radius:10px; padding:10px 12px; font-size:12px; line-height:1.5; color:#333; margin-bottom:12px; }
.buy-intro strong { display:block; margin-bottom:4px; }
.unavail-hint { font-size:11px; color:var(--text2); margin-bottom:8px; line-height:1.45; }
.buy-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:10px; max-width:100%; }
.buy-card { background:var(--card); border:1px solid var(--sep); border-radius:10px; padding:10px 12px; font-size:11px; }
.buy-card.best { border-color:var(--green); box-shadow:0 0 0 1px var(--green); }
.buy-card.na { border-style:dashed; background:#fafafa; opacity:.92; }
.buy-card-head { display:flex; justify-content:space-between; gap:8px; align-items:flex-start; margin-bottom:4px; }
.buy-card-head a { color:var(--blue); font-weight:600; text-decoration:none; }
.buy-card-price { font-weight:700; white-space:nowrap; font-size:12px; }
.buy-card-note { color:var(--text2); font-size:10px; line-height:1.4; margin-top:4px; }
.buy-section { font-size:10px; text-transform:uppercase; color:var(--text2); letter-spacing:.04em; margin:12px 0 6px; }
.buy-section:first-child { margin-top:0; }
.status-na { color:#8e8e93; font-style:italic; }
@media (max-width:640px) { .stats { grid-template-columns:repeat(2,1fr); } .region-cards { grid-template-columns:1fr; } .buy-grid { grid-template-columns:1fr; } }
</style>
</head>
<body>
<h1>Круизы из Европы · 2026</h1>
<p class="sub">Выберите регион · данные Cruisello · ${allCruises.length} рейсов · обновлено ${regionMeta.med.meta.fetchedAt}</p>

<div class="region-cards" id="region-cards"></div>
<div class="callout" id="callout"></div>

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
  <th class="sortable col-date" data-col="date">Дата<span class="arr"></span></th>
  <th class="sortable col-port" data-col="port">Порт<span class="arr"></span></th>
  <th class="sortable col-nights" data-col="nights">Ночей<span class="arr"></span></th>
  <th class="col-ship">Корабль</th><th class="col-route">Маршрут</th>
  <th class="sortable col-price" data-col="price2">€ 2 чел.<span class="arr"></span></th>
  <th class="sortable col-price" data-col="price3">€ 3 чел.<span class="arr"></span></th>
  <th class="col-buy">Купить</th>
</tr></thead>
<tbody id="tbody"></tbody>
</table>
</div>
<p class="foot">
  Cruisello + сайты линий + агентства. Цены inside, 2 гостя. <span class="badge est">оценка</span> — расчёт для 3 гостей.
  <span class="hot-badge">HOT</span> — лучшее сочетание цены, ночей и уровня линии/корабля в регионе (может быть несколько).<br>
  <strong>Лучшая цена:</strong> запустите <code>npm run price-server</code> (и один раз <code>npm run vtg-login</code> для VTG).<br>
  В строке круиза → <strong>↻ Лучшая цена</strong>. CLI: <code>npm run refresh-price -- --slug=… --rebuild-html</code>
</p>
<script>
const REGIONS = ${JSON.stringify(REGIONS.map(({ id, title, subtitle, dates, accent, callout }) => ({ id, title, subtitle, dates, accent, callout })))};
const REGION_META = ${JSON.stringify(regionMeta)};
const CRUISES = ${JSON.stringify(allCruises)};

let activeRegion = "north";
let portFilter = "all";
let nightsFilter = "all";
let sortCol = "date";
let sortDir = "asc";
let openBuySlug = null;
let refreshFlash = null;
let hotFilter = false;

const CABIN_VENDORS = new Set(["Inside", "Oceanview", "Balcony", "Suite"]); // не показываем — только inside в колонках €2/€3

const SORT_DEFAULT_DIR = { date: "asc", port: "asc", nights: "desc", price2: "asc", price3: "asc" };
const PRICE_API = "http://127.0.0.1:3920";

function regionCruises() {
  return CRUISES.filter(c => c.regionId === activeRegion);
}

function fmtEur(n) { return n == null ? "—" : "€" + n.toLocaleString("en-GB"); }

function cmp(a, b, col) {
  if (col === "date") return a.sailDate.localeCompare(b.sailDate);
  if (col === "port") return a.port.localeCompare(b.port) || a.sailDate.localeCompare(b.sailDate);
  if (col === "nights") return a.nights - b.nights || a.sailDate.localeCompare(b.sailDate);
  if (col === "price2") return (a.price2 ?? 9e9) - (b.price2 ?? 9e9);
  if (col === "price3") return (a.price3 ?? 9e9) - (b.price3 ?? 9e9);
  return 0;
}

function filtered() {
  const pool = regionCruises();
  let list = pool.filter(c => {
    if (portFilter !== "all" && c.port !== portFilter) return false;
    if (nightsFilter !== "all" && c.nights !== Number(nightsFilter)) return false;
    if (hotFilter && !c.isHot) return false;
    return true;
  });
  const dir = sortDir === "asc" ? 1 : -1;
  list.sort((a, b) => dir * cmp(a, b, sortCol));
  return list;
}

function hotCount() {
  return regionCruises().filter(c => c.isHot).length;
}

function updateHeaderSort() {
  document.querySelectorAll("th.sortable").forEach(th => {
    const col = th.dataset.col;
    const on = col === sortCol;
    th.classList.toggle("on", on);
    th.querySelector(".arr").textContent = on ? (sortDir === "asc" ? "↑" : "↓") : "";
  });
}

function bestBadge(c, guests) {
  const b = guests === 3 ? c.bestPrice3 : c.bestPrice2;
  if (!b?.price) return "";
  const same = guests === 2 ? c.price2 === b.price : c.price3 === b.price;
  if (same && /Cruisello|прямо/i.test(b.vendor)) return "";
  const opt = (c.buyOptions || []).find(o => o.vendor === b.vendor);
  const sym = opt?.currency === "USD" ? "$" : "€";
  return '<span class="best-hint">★ ' + b.vendor + " " + sym + b.price.toLocaleString("en-GB") + "</span>";
}

function fmtPrice(o, guests) {
  const key = guests === 3 ? "price3" : "price2";
  const v = o[key];
  if (v == null) return null;
  const cur = o.currency === "USD" ? "$" : "€";
  return cur + v.toLocaleString("en-GB");
}

function statusLabel(o, c) {
  if (o.price2 != null) return null;
  if (o.vendor === "Vacations To Go") {
    if (c && /TUI|AIDA/i.test(c.line)) return "нет на VTG US";
    if (o.vtgStatus === "unavailable" || (o.note && /не продаётся|не представлена|нет на VTG/i.test(o.note)))
      return "нет на VTG US";
    if (o.note && /не найден/i.test(o.note)) return "не найден на VTG";
    if (o.note && /vtg-login|вход/i.test(o.note)) return "нужен вход VTG";
    return "нет цены VTG";
  }
  if (o.vendor === "CruiseCompete") return "котировка по email";
  if (o.vendor === "CruiseDirect" || o.vendor === "iCruise") {
    if (o.price2 != null) return null;
    if (o.source === "cruisello-go") return "ссылка /go/ · цена на сайте";
    if (o.note && /Cloudflare|cd-login/i.test(o.note)) return "нужен cd-login";
    return "не подключено";
  }
  if (o.manual) return o.note || "не проверено";
  return "цена не собрана";
}

function trimNote(note) {
  if (!note) return "";
  return note.replace(/( · обновлено \d{4}-\d{2}-\d{2})+/g, "").trim();
}

function buyPanelIntro(c) {
  if (/TUI|AIDA/i.test(c.line)) {
    return "<strong>Этот круиз — " + c.line + "</strong>" +
      "Vacations To Go <em>не продаёт</em> TUI/AIDA — это нормально, не ошибка. " +
      "Смотрите зелёные карточки: TUI и Cruisello. Кнопка «Обновить» обновляет только их.";
  }
  return "<strong>Как читать панель</strong>" +
    "Зелёные карточки — цены, которые мы подтягиваем автоматически (Cruisello + VTG). " +
    "«↻ Обновить цены» перезапрашивает их. Пунктирные ниже — просто ссылки, мы их пока не скрейпим.";
}

function buyOptionsGrouped(c) {
  const raw = c.buyOptions?.length ? c.buyOptions : [
    { vendor: c.line + " (прямо)", url: c.lineUrl, price2: c.price2, price3: c.price3 },
    { vendor: "Cruisello", url: c.cruiselloUrl, price2: c.price2, price3: c.price3 },
  ];
  const vendors = [];
  const unavailable = [];
  let hasBook = false;

  for (const o of raw) {
    if (o.hidden) continue;
    const opt = { ...o, note: trimNote(o.note) };
    if (CABIN_VENDORS.has(opt.vendor)) continue;
    if (opt.price2 != null) {
      if (opt.vendor === "Cruisello · Book") { hasBook = true; vendors.push(opt); continue; }
      if (opt.vendor === "Cruisello" && hasBook) continue;
      if (opt.vendor === "Inside" && opt.price2 === c.price2) continue;
      vendors.push(opt);
    } else {
      unavailable.push(opt);
    }
  }
  return { vendors, unavailable };
}

function buyCard(o, c, { best = false, na = false } = {}) {
  const href = o.url ? ' href="' + String(o.url).replace(/"/g, "") + '" target="_blank" rel="noopener"' : "";
  const name = o.url ? "<a" + href + ">" + o.vendor + " ↗</a>" : o.vendor;
  const p2 = fmtPrice(o, 2);
  const p3 = fmtPrice(o, 3);
  const price = p2 ? p2 + (p3 ? " · 3ч " + p3 : "") : '<span class="status-na">' + (statusLabel(o, c) || "—") + "</span>";
  const cls = "buy-card" + (best ? " best" : "") + (na || !p2 ? " na" : "");
  const tag = best ? ' <span class="badge best-deal">лучшая</span>' : "";
  return '<div class="' + cls + '"><div class="buy-card-head">' + name + tag +
    '<span class="buy-card-price">' + price + "</span></div>" +
    (o.note ? '<div class="buy-card-note">' + o.note + "</div>" : "") +
    (o.verifiedAt && p2 ? '<div class="buy-card-note">✓ ' + o.verifiedAt + "</div>" : "") +
    "</div>";
}

function buyCell(c) {
  const g = buyOptionsGrouped(c);
  const b = c.bestPrice2;
  const vtg = (c.buyOptions || []).find(o => o.vendor === "Vacations To Go");
  let vtgLine = "";
  if (vtg) {
    if (vtg.price2) vtgLine = "VTG: " + fmtPrice(vtg, 2);
    else vtgLine = "VTG: " + (statusLabel(vtg, c) || "—");
  }
  const n = g.vendors.length;
  const na = g.unavailable.length;
  return '<div class="buy-compact">' +
    (b ? '<div class="buy-best">★ ' + b.vendor + " " + fmtEur(b.price) + "</div>" : "") +
    (vtgLine ? '<div class="buy-vtg-status">' + vtgLine + "</div>" : "") +
    '<button type="button" class="buy-toggle' + (openBuySlug === c.slug ? " on" : "") + '" data-buy="' + c.slug + '">' +
    (openBuySlug === c.slug ? "▾ Скрыть" : "▸ " + n + " площадок") +
    (na ? " · " + na + " н/д" : "") +
    "</button></div>";
}

function buyPanel(c) {
  const g = buyOptionsGrouped(c);
  let html = '<div class="buy-panel"><div class="buy-panel-head"><h4>Где купить · ' + c.ship + " · " + (c._fmtDate || "") + '</h4>' +
    '<button type="button" class="refresh-btn primary" data-refresh="' + c.slug + '">↻ Обновить Cruisello + VTG</button></div>';
  if (refreshFlash && refreshFlash.slug === c.slug) {
    html += '<div class="buy-flash' + (refreshFlash.err ? " err" : "") + '">' + refreshFlash.msg + "</div>";
  }
  html += '<div class="buy-intro">' + buyPanelIntro(c) + "</div>";
  if (g.vendors.length) {
    html += '<div class="buy-section">✓ Есть цена — можно сравнивать</div><div class="buy-grid">';
    html += g.vendors.map(o => buyCard(o, c, {
      best: c.bestPrice2 && o.vendor === c.bestPrice2.vendor && o.price2 === c.bestPrice2.price
    })).join("");
    html += "</div>";
  }
  if (g.unavailable.length) {
    const vtgOnly = g.unavailable.filter(o => o.vendor === "Vacations To Go");
    const rest = g.unavailable.filter(o => o.vendor !== "Vacations To Go");
    if (vtgOnly.length) {
      html += '<div class="buy-section">Vacations To Go</div><div class="buy-grid">';
      html += vtgOnly.map(o => buyCard(o, c, { na: true })).join("");
      html += "</div>";
    }
    if (rest.length) {
      html += '<div class="buy-section">Прочие (не подключены)</div><div class="buy-grid">';
      html += rest.map(o => buyCard(o, c, { na: true })).join("");
      html += "</div>";
    }
  }
  if (c.lastRefreshed) html += '<div class="refresh-status">последнее обновление: ' + c.lastRefreshed.slice(0, 16).replace("T", " ") + " UTC</div>";
  return html + "</div>";
}

function formatRefreshFlash(data) {
  const parts = [];
  if (data.live?.price2 != null) parts.push("Cruisello €" + data.live.price2);
  if (data.vtg?.ok) {
    parts.push("VTG $" + data.vtg.price2 + (data.vtg.price3 ? " / 3ч $" + data.vtg.price3 : ""));
  } else if (data.vtg?.needsLogin) {
    parts.push("VTG: выполните npm run vtg-login один раз");
  } else if (data.vtg?.skipped && data.vtg?.reason) {
    parts.push("VTG: " + data.vtg.reason);
  } else if (data.vtg?.error) {
    parts.push("VTG: " + data.vtg.error);
  }
  if (data.bestPrice?.best2) {
    parts.push("★ лучшая 2 чел.: " + data.bestPrice.best2.vendor + " " +
      (data.bestPrice.best2.currency === "USD" ? "$" : "€") + data.bestPrice.best2.price);
  }
  if (data.htmlRebuilt) parts.push("JSON + HTML сохранены");
  return parts.join(" · ") || data.message || "Цены обновлены — смотрите зелёные карточки.";
}

async function refreshCruise(slug, btn) {
  btn.disabled = true;
  const label = btn.textContent;
  btn.textContent = "… обновляем";
  openBuySlug = slug;
  try {
    const health = await fetch(PRICE_API + "/health").then(r => r.json()).catch(() => null);
    if (!health?.ok) throw new Error("no-server");
    if (health.apiVersion !== 2) {
      refreshFlash = { slug, err: true, msg: "Устаревший price-server — перезапустите: npm run price-server" };
      render();
      if (btn) { btn.disabled = false; btn.textContent = label; }
      return;
    }
    const r = await fetch(PRICE_API + "/refresh?slug=" + encodeURIComponent(slug));
    const data = await r.json();
    if (!data.ok) throw new Error(data.error || "refresh failed");
    const idx = CRUISES.findIndex(x => x.slug === slug);
    if (idx >= 0) CRUISES[idx] = { ...CRUISES[idx], ...data.cruise };
    refreshFlash = { slug, msg: formatRefreshFlash(data) };
    render();
  } catch (e) {
    const msg = e.message === "no-server"
      ? "Сервер не отвечает — в терминале: npm run price-server"
      : "Ошибка: " + e.message;
    refreshFlash = { slug, err: true, msg };
    render();
    if (btn) { btn.disabled = false; btn.textContent = label; }
  }
}

function familyTip(c) {
  const t = c.family17 || c.teen16;
  if (!t) return "";
  const steps = (t.steps || []).map(s => "<li>" + s + "</li>").join("");
  const label = c.family17 ? "17 лет — тариф" : "Скидка / 3-й гость";
  return '<details class="child-tip fold"><summary>' + label + '</summary>' +
    "<p><strong>" + (t.summary || "") + "</strong></p>" +
    "<p>" + (t.discountHint || c.childNote || "") + "</p>" +
    (steps ? "<ol>" + steps + "</ol>" : "") +
    (t.policyUrl ? '<p><a href="' + t.policyUrl + '" target="_blank" rel="noopener">Подробнее ↗</a></p>' : "") +
    "</details>";
}

function isHighlight(c) {
  if (activeRegion === "med" && c.port === "Cannes" && c.sailDate === "2026-07-05") return true;
  if (activeRegion === "north" && c.sailDate === "2026-08-05") return true;
  return false;
}

function rowClass(c) {
  const cls = [];
  if (c.isHot) cls.push("hot-deal");
  if (isHighlight(c)) cls.push("highlight");
  return cls.length ? ' class="' + cls.join(" ") + '"' : "";
}

function tags(c) {
  const t = [];
  if (c.isHot) t.push('<span class="hot-badge" title="Hot deal · score ' + (c.hotScore||"") + '">HOT</span>');
  if (isHighlight(c)) t.push('<span class="badge best">' + (activeRegion === "med" ? "5 Jul" : "5 Aug") + '</span>');
  if (activeRegion === "north" && c.itinerary?.some(p => /Bergen|Geiranger|Flåm|Norway|Oslo|Tromsø|North Cape/i.test(p)))
    t.push('<span class="badge best">Norway</span>');
  if (c.thirdGuestDiscount) t.push('<span class="badge child">3-й гость дешевле</span>');
  if (c.price3Est) t.push('<span class="badge est">оценка 3 чел.</span>');
  return t.join(" ");
}

function render() {
  const reg = REGIONS.find(r => r.id === activeRegion);
  const pool = regionCruises();
  const list = filtered();
  const ports = ["all", ...[...new Set(pool.map(c => c.port))].sort()];
  const nights = ["all", ...[...new Set(pool.map(c => c.nights))].sort((a,b)=>a-b)];

  document.getElementById("region-cards").innerHTML = REGIONS.map(r => {
    const m = REGION_META[r.id];
    const on = r.id === activeRegion ? " on " + r.accent : "";
    return '<button type="button" class="region-card' + on + '" data-region="' + r.id + '">' +
      '<h2>' + r.title + '</h2><p>' + r.subtitle + '</p>' +
      '<span class="count">' + m.count + ' рейсов</span>' +
      '<span class="dates">' + r.dates + '</span></button>';
  }).join("");

  document.getElementById("callout").innerHTML = "<strong>" + reg.title + ".</strong> " + reg.callout;

  const statFn = activeRegion === "med"
    ? c => c.country === "France"
    : c => c.country === "Germany" || c.country === "Denmark";
  const statLabel = activeRegion === "med" ? "из Франции" : "DE / DK";
  const best = [...pool].filter(c => c.price2).sort((a,b) => a.price2 - b.price2)[0];
  const earliest = [...pool].sort((a,b) => a.sailDate.localeCompare(b.sailDate))[0];

  document.getElementById("stats").innerHTML =
    '<div class="stat"><b>' + pool.length + '</b><span>рейсов</span></div>' +
    '<div class="stat"><b>' + pool.filter(statFn).length + '</b><span>' + statLabel + '</span></div>' +
    '<div class="stat"><b>' + (best ? fmtEur(best.price2) : "—") + '</b><span>мин. 2 чел.</span></div>' +
    '<div class="stat"><b>' + (earliest ? earliest._fmtDate : "—") + '</b><span>первый рейс</span></div>';

  const accent = "accent-" + activeRegion;
  document.getElementById("port-filters").innerHTML = ports.map(p =>
    '<button class="chip ' + accent + (portFilter===p?" on":"") + '" data-port="' + p + '">' +
    (p==="all"?"Все порты":p) + '</button>'
  ).join("");

  document.getElementById("nights-filters").innerHTML = nights.map(n =>
    '<button class="chip nights' + (nightsFilter===String(n)?" on":"") + '" data-nights="' + n + '">' +
    (n==="all"?"Все ночи":n+" ноч.") + '</button>'
  ).join("");

  const hotN = hotCount();
  document.getElementById("sort-filters").innerHTML = [
    ["date","По дате"], ["nights","По ночам"], ["price2","€ 2 чел."], ["price3","€ 3 чел."]
  ].map(([k,l]) => '<button class="chip' + (sortCol===k?" on":"") + '" data-sort="' + k + '">' +
    l + (sortCol===k ? (sortDir==="asc"?" ↑":" ↓") : "") + '</button>').join("") +
    '<button type="button" class="chip hot-filter' + (hotFilter ? " on" : "") + '" data-hot-filter>HOT' +
    (hotN ? " (" + hotN + ")" : "") + '</button>';

  updateHeaderSort();
  document.getElementById("count").textContent = "Показано " + list.length + " из " + pool.length;

  document.getElementById("tbody").innerHTML = list.map(c => {
    const p3note = (c.cabin3Note||"").trim();
    const labels = c.itineraryLabels || c.itinerary || [];
    const route = labels.length
      ? '<details class="fold route"><summary>' + labels.length + ' портов</summary><ul>' +
        labels.map(p => "<li>" + p + "</li>").join("") + '</ul></details>'
      : "—";
    const main = '<tr' + rowClass(c) + '>' +
      '<td class="date col-date">' + (c._fmtDate||"") + '</td>' +
      '<td class="port col-port"><strong>' + c.port + '</strong><small>' + c.country + '</small></td>' +
      '<td class="col-nights">' + c.nights + '</td>' +
      '<td class="col-ship">' + tags(c) + c.line + '<br><small>' + c.ship + '</small>' + familyTip(c) + '</td>' +
      '<td class="col-route">' + route + '</td>' +
      '<td class="price col-price">' + fmtEur(c.price2) + bestBadge(c, 2) + '</td>' +
      '<td class="price col-price">' + fmtEur(c.price3) + bestBadge(c, 3) + (p3note ? '<br><span class="price-note">'+p3note.replace(/^\\s*\\(/,"").replace(/\\)$/,"")+'</span>' : "") + '</td>' +
      '<td class="col-buy">' + buyCell(c) + '</td></tr>';
    const detail = openBuySlug === c.slug
      ? '<tr class="buy-detail"><td colspan="8">' + buyPanel(c) + '</td></tr>'
      : "";
    return main + detail;
  }).join("");

  document.querySelectorAll("[data-region]").forEach(b => b.onclick = () => {
    if (b.dataset.region === activeRegion) return;
    activeRegion = b.dataset.region;
    portFilter = "all"; nightsFilter = "all"; hotFilter = false;
    render();
  });
  document.querySelectorAll("[data-port]").forEach(b => b.onclick = () => { portFilter = b.dataset.port; render(); });
  document.querySelectorAll("[data-nights]").forEach(b => b.onclick = () => { nightsFilter = b.dataset.nights; render(); });
  document.querySelectorAll("[data-sort]").forEach(b => b.onclick = () => {
    const col = b.dataset.sort;
    if (sortCol === col) sortDir = sortDir === "asc" ? "desc" : "asc";
    else { sortCol = col; sortDir = SORT_DEFAULT_DIR[col] || "asc"; }
    render();
  });
  document.querySelectorAll("[data-hot-filter]").forEach(b => b.onclick = () => {
    hotFilter = !hotFilter;
    render();
  });
  document.querySelectorAll("[data-refresh]").forEach(b => b.onclick = () => refreshCruise(b.dataset.refresh, b));
  document.querySelectorAll("[data-buy]").forEach(b => b.onclick = () => {
    openBuySlug = openBuySlug === b.dataset.buy ? null : b.dataset.buy;
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
  c._fmtDate = String(d).padStart(2,"0") + " " + ${JSON.stringify(MONTHS)}[m-1] + " " + y;
});
const hash = location.hash.replace("#","");
if (hash === "med" || hash === "north") activeRegion = hash;
render();
</script>
</body>
</html>`;

fs.writeFileSync(outPath, html);

// Redirect stubs for old standalone files
const redirect = (target, title) => `<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8">
<meta http-equiv="refresh" content="0;url=${target}">
<title>${title}</title></head>
<body><p>Переехало в <a href="${target}">${target}</a></p></body></html>`;

fs.writeFileSync(path.join(root, "med-summer-july-2026.html"), redirect("cruises-europe-2026.html#med", "Redirect"));
fs.writeFileSync(path.join(root, "north-aug-2026.html"), redirect("cruises-europe-2026.html#north", "Redirect"));

const indexRedirect = `<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Круизы Европа 2026</title>
<meta http-equiv="refresh" content="0;url=cruises-europe-2026.html">
<link rel="canonical" href="cruises-europe-2026.html">
<script>location.replace("cruises-europe-2026.html" + location.hash);</script>
</head>
<body><p><a href="cruises-europe-2026.html">Круизы Европа 2026 — Med &amp; North</a></p></body></html>`;
fs.writeFileSync(path.join(root, "index.html"), indexRedirect);

console.log(`Built ${outPath} (${allCruises.length} cruises: med ${regionMeta.med.count}, north ${regionMeta.north.count})`);
