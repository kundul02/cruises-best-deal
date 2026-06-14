/**
 * Fetch Cruisello /go/ page and merge agency links into buyOptions.
 */
import { parseGoPage, parseAgenciesFromGoHtml } from "./parse-go-page.mjs";
import { mergeBuyOption } from "./best-price.mjs";

const UA = "Mozilla/5.0 (compatible; cruises-best-deal/1.0)";

export async function fetchGoPageHtml(cruise) {
  const url = cruise.bookUrl?.includes("/go/") ? cruise.bookUrl : null;
  if (!url) return { ok: false, reason: "no bookUrl" };
  const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
  if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
  const html = await res.text();
  return { ok: true, html, url: res.url };
}

/** Refresh agency URLs from /go/ without overwriting live prices */
export function mergeGoAgencies(buyOptions, cruise, html) {
  let list = [...(buyOptions || [])];
  const agencies = parseAgenciesFromGoHtml(html);
  const lineOpts = parseGoPage(html, cruise, []);

  const SKIP_GO = new Set(["Vacations To Go", "CruiseCompete"]);
  for (const a of agencies) {
    if (SKIP_GO.has(a.vendor)) continue;
    list = mergeBuyOption(list, {
      vendor: a.vendor,
      url: a.url,
      affiliateUrl: a.affiliateUrl,
      source: "cruisello-go",
      note: "ссылка Cruisello /go/ · цена на сайте",
      hidden: false,
    });
  }

  const direct = lineOpts.find((o) => o.vendor.endsWith("(прямо)"));
  if (direct?.url) {
    list = mergeBuyOption(list, {
      vendor: direct.vendor,
      url: direct.url,
      source: "cruisello-go",
    });
  }

  const book = lineOpts.find((o) => o.vendor === "Cruisello · Book");
  if (book?.url) {
    list = mergeBuyOption(list, { vendor: "Cruisello · Book", url: book.url });
  }

  return list;
}

export async function refreshGoAgencies(cruise, buyOptions) {
  const fetched = await fetchGoPageHtml(cruise);
  if (!fetched.ok) return { buyOptions, go: fetched };
  const merged = mergeGoAgencies(buyOptions, cruise, fetched.html);
  return {
    buyOptions: merged,
    go: { ok: true, agencies: parseAgenciesFromGoHtml(fetched.html) },
  };
}
