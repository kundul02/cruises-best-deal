/**
 * Parse Cruisello /go/ booking page — line link + agency affiliate URLs.
 * Prices are usually not embedded; agencies need Playwright (see agency-search.mjs).
 */

export const STATIC_AGENCIES = [
  { vendor: "CruiseDirect", url: "https://www.cruisedirect.com/" },
  { vendor: "Vacations To Go", url: "https://www.vacationstogo.com/" },
  { vendor: "CruiseCompete", url: "https://www.cruisecompete.com/" },
  { vendor: "iCruise", url: "https://www.icruise.com/" },
];

const AGENCY_ALTS = new Set(STATIC_AGENCIES.map((a) => a.vendor));

/** Decode affiliate wrapper (e.g. tkqlhce.com → cruisedirect.com) */
export function unwrapAgencyUrl(href) {
  if (!href) return href;
  try {
    const u = new URL(href);
    const inner = u.searchParams.get("url");
    if (inner && /cruisedirect|icruise|vacationstogo|cruisecompete/i.test(inner)) {
      return decodeURIComponent(inner);
    }
  } catch {
    /* ignore */
  }
  return href;
}

/** Agency cards from «Prefer booking through a travel agency?» block */
export function parseAgenciesFromGoHtml(html) {
  if (!html) return [];
  const out = [];
  const re =
    /<a href="([^"]+)"[^>]*target="_blank"[^>]*class="group flex items-center gap-3[\s\S]{0,500}?alt="([^"]+)"/gi;
  let m;
  while ((m = re.exec(html))) {
    const vendor = m[2].trim();
    if (!AGENCY_ALTS.has(vendor)) continue;
    const rawUrl = m[1].replace(/&amp;/g, "&");
    out.push({
      vendor,
      url: unwrapAgencyUrl(rawUrl),
      affiliateUrl: rawUrl,
      source: "cruisello-go",
    });
  }
  return out;
}

/** «Continue to {line}» direct booking link */
export function parseLineDirectUrl(html, fallbackUrl) {
  if (!html) return fallbackUrl;
  const m = html.match(/href="(https:\/\/[^"]+)"[^>]*>Continue to /i);
  if (!m) return fallbackUrl;
  return m[1].replace(/&amp;/g, "&");
}

export function parseCabinHeaders(html, guests) {
  const cabins = ["Inside", "Oceanview", "Balcony", "Suite"];
  const out = [];
  for (const cabin of cabins) {
    const re = new RegExp(`>${cabin}</span>[\\s\\S]{0,600}?€([\\d,]+)`, "i");
    const match = html.match(re);
    if (!match) continue;
    const pp = Number(String(match[1]).replace(/,/g, ""));
    out.push({ cabin, pp, total: pp * guests });
  }
  return out;
}

/**
 * Build buyOptions from /go/ HTML (or detail fallback).
 * @param {string} html — /go/ page HTML
 * @param {object} c — cruise record
 * @param {object[]} cabins2 — optional cabin rows from detail page
 */
export function parseGoPage(html, c, cabins2 = []) {
  const { line, price2, price3, lineUrl, bookUrl, cruiselloUrl } = c;
  const options = [];
  const lineDirect = parseLineDirectUrl(html, lineUrl);

  options.push({
    vendor: `${line} (прямо)`,
    url: lineDirect,
    price2,
    price3,
    note: "inside, 2 гостя — сайт линии",
    source: "cruisello-go",
  });

  options.push({
    vendor: "Cruisello · Book",
    url: bookUrl?.includes("/go/") ? bookUrl : cruiselloUrl,
    price2,
    price3,
    note: "переход к бронированию",
    source: "cruisello-go",
  });

  options.push({
    vendor: "Cruisello",
    url: cruiselloUrl,
    price2,
    price3,
    note: "сравнение цен",
  });

  for (const cab of cabins2) {
    if (cab.cabin === "Inside") continue;
    options.push({
      vendor: cab.cabin,
      url: lineDirect,
      price2: cab.total,
      price3: null,
      note: `~€${cab.pp}/чел × 2`,
      cabin: cab.cabin,
    });
  }

  const fromGo = parseAgenciesFromGoHtml(html);
  const agencyByVendor = Object.fromEntries(fromGo.map((a) => [a.vendor, a]));

  for (const a of STATIC_AGENCIES) {
    const go = agencyByVendor[a.vendor];
    options.push({
      vendor: a.vendor,
      url: go?.url || a.url,
      affiliateUrl: go?.affiliateUrl,
      price2: null,
      price3: null,
      note: go ? "ссылка с Cruisello /go/ · цена на сайте" : "агентство — уточните цену на сайте",
      source: go ? "cruisello-go" : "static",
    });
  }

  const seen = new Set();
  return options.filter((o) => {
    const key = o.vendor + (o.url || "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
