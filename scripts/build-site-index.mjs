#!/usr/bin/env node
/** Build index.html — landing hub for the static site. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parseNavimbaLeads } from "./lib/parse-navimba-leads.mjs";
import { siteNavHtml } from "./lib/site-nav.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outPath = path.join(root, "index.html");

function loadJson(p, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return fallback;
  }
}

function countCruises() {
  const files = [
    "summer-med-july-2026.json",
    "north-aug-2026.json",
    "transatlantic-fall-2026.json",
  ];
  let total = 0;
  const regions = {};
  for (const file of files) {
    const data = loadJson(path.join(root, "research", file), { cruises: [] });
    const key = file.includes("med")
      ? "med"
      : file.includes("north")
        ? "north"
        : "transatlantic";
    const n = data.cruises?.length || 0;
    regions[key] = n;
    total += n;
  }
  return { total, regions };
}

function countVtgLeads() {
  const registry = loadJson(path.join(root, "research", "leads-registry.json"), {});
  const active = registry.leads?.active;
  if (Array.isArray(active)) return active.length;
  const leads = registry.leads || registry.items || [];
  return Array.isArray(leads) ? leads.length : 0;
}

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return String(iso).slice(0, 10);
  }
}

const med = loadJson(path.join(root, "research", "summer-med-july-2026.json"), {});
const navimba = loadJson(path.join(root, "research", "navimba-latest.json"), {});
const profile = loadJson(path.join(root, "research", "family-profile.json"), {});
const { total: cruiseTotal, regions } = countCruises();
const navimbaLeads = parseNavimbaLeads(navimba, profile);
const priorityNavimba = navimbaLeads.filter((l) => l.priority && !l.excluded).length;
const vtgCount = countVtgLeads();
const lastEurope = med.meta?.fetchedAt || med.fetchedAt || "—";

const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Cruise Best Deal — круизы для семьи</title>
<meta name="description" content="Сравнение круизов Европа 2026, лиды с форума Navimba и VacationsToGo для семьи 2–3 чел.">
<style>
:root { --blue:#007AFF; --green:#34C759; --teal:#5AC8FA; --purple:#5856D6; --bg:#F2F2F7; --card:#fff; --text:#1C1C1E; --text2:#636366; --sep:#E5E5EA; }
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:-apple-system,BlinkMacSystemFont,sans-serif; background:var(--bg); color:var(--text); padding:16px; max-width:960px; margin:0 auto; line-height:1.5; }
.site-nav { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:16px; padding:10px 12px; background:var(--card); border-radius:12px; border:1px solid var(--sep); }
.site-nav a { font-size:13px; font-weight:600; color:var(--blue); text-decoration:none; padding:6px 12px; border-radius:8px; }
.site-nav a:hover { background:var(--bg); }
.site-nav a.on { background:var(--blue); color:#fff; }
h1 { font-size:26px; margin-bottom:6px; letter-spacing:-0.3px; }
.sub { font-size:14px; color:var(--text2); margin-bottom:20px; }
.cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:14px; margin-bottom:24px; }
.card { display:block; background:var(--card); border:1.5px solid var(--sep); border-radius:16px; padding:18px; text-decoration:none; color:inherit; transition:border-color .15s, box-shadow .15s; }
.card:hover { border-color:var(--blue); box-shadow:0 4px 16px rgba(0,0,0,.06); }
.card h2 { font-size:18px; margin-bottom:6px; }
.card p { font-size:13px; color:var(--text2); margin-bottom:12px; }
.card .stat { font-size:22px; font-weight:700; }
.card.med .stat { color:#FF9500; }
.card.north .stat { color:var(--teal); }
.card.navimba .stat { color:var(--green); }
.card.vtg .stat { color:var(--purple); }
.card .meta { font-size:11px; color:var(--text2); margin-top:4px; }
.foot { font-size:12px; color:var(--text2); line-height:1.6; padding-top:8px; border-top:1px solid var(--sep); }
.foot a { color:var(--blue); }
</style>
</head>
<body>
${siteNavHtml("home")}

<h1>Cruise Best Deal</h1>
<p class="sub">Круизы для семьи 2–3 чел. · Med, Север, трансатлантика · форум Navimba · VTG hot deals</p>

<div class="cards">
  <a class="card med" href="cruises-europe-2026.html">
    <h2>Европа 2026</h2>
    <p>Cruisello + VTG · HOT, NEW, визы · live-обновления с Mac</p>
    <div class="stat">${cruiseTotal}</div>
    <div class="meta">Med ${regions.med || 0} · North ${regions.north || 0} · Transatlantic ${regions.transatlantic || 0}</div>
    <div class="meta">Цены: ${fmtDate(lastEurope)}</div>
  </a>

  <a class="card navimba" href="navimba.html">
    <h2>Navimba</h2>
    <p>Русскоязычный форум · сделки и активные темы</p>
    <div class="stat">${navimbaLeads.length}</div>
    <div class="meta">${priorityNavimba} под ваш профиль</div>
    <div class="meta">Обновлено: ${fmtDate(navimba.fetchedAt)}</div>
  </a>

  <a class="card vtg" href="cruises.html">
    <h2>VTG Leads</h2>
    <p>Глобальные hot deals · VacationsToGo, CruisePlum и др.</p>
    <div class="stat">${vtgCount || "—"}</div>
    <div class="meta">Отдельный pipeline лидов</div>
  </a>
</div>

<p class="foot">
  Публичный сайт: <a href="https://kundul02.github.io/cruises-best-deal/">kundul02.github.io/cruises-best-deal</a><br>
  Live-кнопки (↻, discover, deploy) работают только локально с <code>npm run price-server</code> + <code>npm run preview</code>.
</p>
</body>
</html>
`;

fs.writeFileSync(outPath, html);
console.log(`Built ${outPath} — ${cruiseTotal} cruises, ${navimbaLeads.length} navimba, ${vtgCount} vtg`);
