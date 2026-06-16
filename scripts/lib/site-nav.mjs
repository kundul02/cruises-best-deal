/** Shared site navigation for static HTML pages. */

export const SITE_NAV_CSS = `
.site-nav { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:16px; padding:10px 12px; background:var(--card, #fff); border-radius:12px; border:1px solid var(--sep, #E5E5EA); }
.site-nav a { font-size:13px; font-weight:600; color:var(--blue, #007AFF); text-decoration:none; padding:6px 12px; border-radius:8px; }
.site-nav a:hover { background:var(--bg, #F2F2F7); }
.site-nav a.on { background:var(--blue, #007AFF); color:#fff; }
`;

export function siteNavHtml(active = "") {
  const items = [
    { id: "home", href: "index.html", label: "Главная" },
    { id: "europe", href: "cruises-europe-2026.html", label: "Европа 2026" },
    { id: "navimba", href: "navimba.html", label: "Navimba" },
    { id: "vtg", href: "cruises.html", label: "VTG Leads" },
  ];
  return `<nav class="site-nav" aria-label="Разделы">
${items
  .map(
    (item) =>
      `  <a href="${item.href}"${item.id === active ? ' class="on"' : ""}>${item.label}</a>`
  )
  .join("\n")}
</nav>`;
}
