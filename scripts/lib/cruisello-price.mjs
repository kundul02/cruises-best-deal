/** Parse Cruisello cruise detail pages for 2/3 guest inside prices */

export function eurNum(s) {
  return s ? Number(String(s).replace(/,/g, "")) : null;
}

export function parseJsonLd(html) {
  const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    const data = JSON.parse(m[1]);
    return data["@graph"]?.find((x) => x["@type"] === "TouristTrip") || null;
  } catch {
    return null;
  }
}

export function parseCabinPrices(html, guests) {
  const cabins = ["Inside", "Oceanview", "Balcony", "Suite"];
  const out = {};
  for (const cabin of cabins) {
    const block = html.match(
      new RegExp(`>${cabin}</span>[\\s\\S]{0,4000}?font-bold whitespace-nowrap">€([\\d,]+)</span>`, "i")
    );
    if (!block) continue;
    const pp = eurNum(block[1]);
    const totalM = block[0].match(/Total<!-- -->:<!-- --> <!-- -->(€[\d,]+)/);
    const total = totalM ? eurNum(totalM[1].slice(1)) : pp * guests;
    out[cabin.toLowerCase()] = { pp, total };
  }
  return out;
}

export function parseCabinHeaders(html, guests) {
  const cabins = ["Inside", "Oceanview", "Balcony", "Suite"];
  const out = [];
  for (const cabin of cabins) {
    const m = html.match(new RegExp(`>${cabin}</span>[\\s\\S]{0,600}?€([\\d,]+)`, "i"));
    if (!m) continue;
    const pp = eurNum(m[1]);
    out.push({ cabin, pp, total: pp * guests });
  }
  return out;
}

export async function fetchCruiselloPrices(cruiselloUrl) {
  const headers = { "User-Agent": "Mozilla/5.0 (compatible; cruises-best-deal/1.0)" };
  const [html, html3] = await Promise.all([
    fetch(cruiselloUrl, { headers }).then((r) => (r.ok ? r.text() : "")),
    fetch(`${cruiselloUrl}?guests=3`, { headers }).then((r) => (r.ok ? r.text() : "")),
  ]);

  const trip = parseJsonLd(html);
  const prices2 = parseCabinPrices(html, 2);
  const prices3 = parseCabinPrices(html3, 3);
  const inside2 = prices2.inside;
  const inside3 = prices3.inside;
  const fallback3 = prices3.oceanview || prices3.balcony || prices3.suite;
  const p3 = inside3 || fallback3;

  const bookM = html.match(/href="(\/go\/[^"]+)"/);
  const bookUrl = bookM ? `https://cruisello.com${bookM[1]}` : cruiselloUrl;

  const cabins2 = parseCabinHeaders(html, 2);
  const cabinOffers = cabins2.map((c) => ({
    vendor: c.cabin,
    price2: c.total,
    note: `~€${c.pp}/чел × 2`,
    source: "Cruisello",
    verifiedAt: new Date().toISOString().slice(0, 10),
  }));

  return {
    fetchedAt: new Date().toISOString(),
    title: trip?.name || null,
    price2: inside2?.total ?? null,
    price3: p3?.total ?? null,
    pricePP: inside2?.pp ?? null,
    cabin3Note: !inside3 && fallback3 ? ` (${fallback3 === prices3.oceanview ? "oceanview" : "balcony"})` : "",
    bookUrl,
    cabinOffers,
    sources: [
      {
        vendor: "Cruisello",
        url: cruiselloUrl,
        price2: inside2?.total ?? null,
        price3: p3?.total ?? null,
        verifiedAt: new Date().toISOString().slice(0, 10),
        note: "inside cabin, live fetch",
      },
    ],
  };
}

/** Human steps + links for sites without API (VTG, CruiseCompete, …) */
export function vtgSearchHints(cruise) {
  const d = cruise.sailDate;
  return {
    vendor: "Vacations To Go",
    url: "https://www.vacationstogo.com/custom.cfm",
    price2: null,
    price3: null,
    manual: true,
    note: `Custom Search: line «${cruise.line}», ship «${cruise.ship}», date ${d}, 2–3 guests`,
    steps: [
      "Open custom.cfm",
      `Select line: ${cruise.line}`,
      `Select ship: ${cruise.ship}`,
      `Departure around ${d} (±3 days)`,
      "2 or 3 guests → compare Inside total",
    ],
  };
}

export function cruiseCompeteHint(cruise) {
  return {
    vendor: "CruiseCompete",
    url: "https://www.cruisecompete.com/",
    price2: null,
    manual: true,
    note: "Submit sailing → agent quotes in 1–2 days",
    steps: [`${cruise.line} · ${cruise.ship} · ${cruise.sailDate} · ${cruise.port}`],
  };
}
