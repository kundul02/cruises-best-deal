#!/usr/bin/env node
/** Build navimba.html from research/navimba-latest.json */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parseNavimbaLeads, escapeHtml } from "./lib/parse-navimba-leads.mjs";
import { NAVIMBA_SOURCES } from "./lib/navimba.mjs";
import { SITE_NAV_CSS, siteNavHtml } from "./lib/site-nav.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dataPath = path.join(root, "research", "navimba-latest.json");
const authPath = path.join(root, "research", "navimba-auth.json");
const profilePath = path.join(root, "research", "family-profile.json");
const outPath = path.join(root, "navimba.html");

function loadJson(p, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return fallback;
  }
}

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso.slice(0, 10);
  }
}

function priceLabel(lead) {
  if (lead.pricePerNight) {
    const cur = lead.currency === "GBP" ? "£" : lead.currency === "USD" ? "$" : "€";
    return `${cur}${lead.pricePerNight}/ночь`;
  }
  if (lead.price) {
    const cur = lead.currency === "GBP" ? "£" : lead.currency === "USD" ? "$" : "€";
    const n = lead.nights ? ` · ${lead.nights} н` : "";
    return `${cur}${lead.price}/чел${n}`;
  }
  return "цена в тексте";
}

function regionBadge(region, priority, excluded) {
  if (excluded) return `<span class="badge warn">вне профиля</span>`;
  if (priority) return `<span class="badge ok">приоритет</span>`;
  if (region === "unknown") return `<span class="badge">?</span>`;
  return `<span class="badge">${escapeHtml(region)}</span>`;
}

const data = loadJson(dataPath);
const auth = loadJson(authPath);
const profile = loadJson(profilePath);
const leads = parseNavimbaLeads(data, profile);
const priorityLeads = leads.filter((l) => l.priority && !l.excluded);
const activeTopics = data.activeTopics?.cruiseRelated || [];
const fetchedAt = data.fetchedAt || "—";

const leadRows = leads
  .map(
    (l) => `<tr class="${l.priority && !l.excluded ? "highlight" : ""}${l.excluded ? " muted" : ""}">
  <td>${l.ship ? escapeHtml(l.ship) : "—"}</td>
  <td>${l.sailDate || "—"}</td>
  <td>${l.nights ?? "—"}</td>
  <td>${escapeHtml(priceLabel(l))}</td>
  <td>${regionBadge(l.region, l.priority, l.excluded)}</td>
  <td><a href="${escapeHtml(l.url)}" target="_blank" rel="noopener">${escapeHtml(l.author)}</a></td>
  <td class="summary">${escapeHtml(l.summary)}</td>
</tr>`
  )
  .join("\n");

const topicItems = activeTopics
  .slice(0, 30)
  .map(
    (t) =>
      `<li><a href="https://navimba.com/viewtopic.php?t=${t.topicId}" target="_blank" rel="noopener">${escapeHtml(t.title)}</a></li>`
  )
  .join("\n");

const sourceLinks = NAVIMBA_SOURCES.map(
  (s) =>
    `<a href="${s.url}" target="_blank" rel="noopener">${escapeHtml(s.title || s.id)}</a>`
).join(" · ");

const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Navimba — сделки и темы форума</title>
<style>
:root { --blue:#007AFF; --green:#2E7D32; --bg:#F2F2F7; --card:#fff; --text:#1C1C1E; --text2:#636366; --sep:#E5E5EA; }
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:-apple-system,BlinkMacSystemFont,sans-serif; background:var(--bg); color:var(--text); padding:16px; max-width:1100px; margin:0 auto; }
${SITE_NAV_CSS}
h1 { font-size:22px; margin-bottom:4px; }
.sub { font-size:13px; color:var(--text2); margin-bottom:16px; line-height:1.5; }
.stats { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:16px; }
.stat { background:var(--card); border:1px solid var(--sep); border-radius:12px; padding:10px; text-align:center; }
.stat b { display:block; font-size:18px; color:var(--green); }
.stat span { font-size:10px; color:var(--text2); }
.callout { background:#E8F5E9; border-left:3px solid var(--green); padding:12px 14px; border-radius:12px; font-size:13px; margin-bottom:16px; line-height:1.55; }
.section { margin-bottom:20px; }
.section h2 { font-size:16px; margin-bottom:8px; }
.table-wrap { overflow-x:auto; border-radius:12px; border:1px solid var(--sep); background:var(--card); }
table { width:100%; border-collapse:collapse; font-size:12px; }
th,td { padding:8px 10px; text-align:left; border-bottom:1px solid var(--sep); vertical-align:top; }
th { background:#f8f8fa; font-size:10px; text-transform:uppercase; color:var(--text2); }
tr.highlight { background:#E8F5E9; }
tr.muted { opacity:.65; }
td.summary { max-width:360px; line-height:1.45; color:var(--text2); font-size:11px; }
.badge { font-size:10px; padding:2px 6px; border-radius:4px; background:var(--sep); display:inline-block; }
.badge.ok { background:#E8F5E9; color:var(--green); }
.badge.warn { background:#FFF3E0; color:#E65100; }
.topic-list { list-style:none; background:var(--card); border:1px solid var(--sep); border-radius:12px; padding:8px 0; }
.topic-list li { padding:8px 14px; border-bottom:1px solid var(--sep); font-size:13px; }
.topic-list li:last-child { border-bottom:none; }
.topic-list a { color:var(--blue); text-decoration:none; }
.links { font-size:13px; line-height:1.8; }
.links a { color:var(--blue); }
.foot { margin-top:16px; font-size:12px; color:var(--text2); line-height:1.6; }
.foot code { background:#eee; padding:2px 6px; border-radius:4px; font-size:11px; }
@media (max-width:720px) {
  .stats { grid-template-columns:repeat(2,1fr); }
  td.summary { max-width:none; }
}
</style>
</head>
<body>
${siteNavHtml("navimba")}

<h1>Navimba — форум сделок</h1>
<p class="sub">Собрано ${fmtDate(fetchedAt)} · ${auth.authStatus === "logged_in" ? "сессия OK" : "гость"} · источник: ${escapeHtml(data.meta?.authSource || "—")}</p>

<div class="stats">
  <div class="stat"><b>${leads.length}</b><span>лидов из постов</span></div>
  <div class="stat"><b>${priorityLeads.length}</b><span>под ваш профиль</span></div>
  <div class="stat"><b>${activeTopics.length}</b><span>активных тем</span></div>
  <div class="stat"><b>${data.dealPosts?.length || 0}</b><span>постов с ценами</span></div>
</div>

<div class="callout">
  <strong>Приоритет для семьи (Med / трансатлантика / Север):</strong>
  ${priorityLeads.length ? priorityLeads.slice(0, 3).map((l) => escapeHtml(l.ship || l.summary.slice(0, 60))).join(" · ") : "пока нет явных совпадений — смотрите таблицу ниже"}
</div>

<section class="section">
  <h2>Сделки с форума (лиды navimba)</h2>
  <div class="table-wrap">
  <table>
  <thead><tr>
    <th>Корабль</th><th>Дата</th><th>Ночей</th><th>Цена</th><th>Регион</th><th>Автор</th><th>Текст</th>
  </tr></thead>
  <tbody>
  ${leadRows || '<tr><td colspan="7">Нет данных — запустите probe-navimba.mjs</td></tr>'}
  </tbody>
  </table>
  </div>
</section>

<section class="section">
  <h2>Активные темы на форуме (круизы)</h2>
  <ul class="topic-list">${topicItems || "<li>—</li>"}</ul>
</section>

<section class="section">
  <h2>Разделы для мониторинга</h2>
  <p class="links">${sourceLinks}</p>
</section>

<p class="foot">
  Обновление данных на Mac (Chrome залогинен на navimba):<br>
  <code>npm run navimba-export-chrome-cookies</code> →
  <code>node scripts/probe-navimba.mjs</code> →
  <code>npm run build-navimba-html</code><br>
  Эти лиды <em>не</em> смешаны с VTG/Cruisello — это отдельный поток с русскоязычного форума.
</p>
</body>
</html>
`;

fs.writeFileSync(outPath, html);
console.log(`Wrote ${outPath} — ${leads.length} leads, ${priorityLeads.length} priority`);
