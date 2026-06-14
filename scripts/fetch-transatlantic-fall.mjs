#!/usr/bin/env node
/** Transatlantic westbound EU→US/Canada Sep 2026 — Jan 2027 → research/transatlantic-fall-2026.json */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { isWestboundTransatlantic, visaExcludeUk } from "./lib/visa-warnings.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outPath = path.join(root, "research", "transatlantic-fall-2026.json");

const START = "2026-08-01";
const END = "2027-01-31";

const PORTS = [
  { slug: "hamburg", city: "Hamburg", country: "Germany" },
  { slug: "lisbon", city: "Lisbon", country: "Portugal" },
  { slug: "barcelona", city: "Barcelona", country: "Spain" },
  { slug: "civitavecchia", city: "Civitavecchia", country: "Italy" },
  { slug: "cherbourg", city: "Cherbourg", country: "France" },
  { slug: "copenhagen", city: "Copenhagen", country: "Denmark" },
  { slug: "istanbul", city: "Istanbul", country: "Turkey" },
];

const LINE_BOOK = {
  "MSC Cruises": "https://www.msccruises.co.uk/",
  "Celebrity Cruises": "https://www.celebritycruises.com/",
  "Norwegian Cruise Line": "https://www.ncl.com/",
  "Royal Caribbean": "https://www.royalcaribbean.com/",
  "Holland America Line": "https://www.hollandamerica.com/",
  "Princess Cruises": "https://www.princess.com/",
  "Cunard Line": "https://www.cunard.com/",
  "Costa Cruises": "https://www.costacruises.com/",
};

const CARIBBEAN_ONLY =
  /\b(Nassau|CocoCay|Coco Cay|Ocean Cay|Bahamas|Grand Bahama|Stirrup Cay|Caribbean only|Southern Caribbean)\b/i;

/** Repositioning EU→US/Canada may call Bahamas/Caribbean — keep if it ends on mainland Americas */
const AMERICAS_END_RE =
  /\b(New York|Brooklyn|Boston|Manhattan|Bayonne|Cape Liberty|Miami|Fort Lauderdale|Port Canaveral|San Juan|Halifax|Quebec|Québec|Montreal|Montréal|Vancouver|Charleston|Baltimore|Galveston|Los Angeles|San Francisco|Seattle|New Orleans|Tampa)\b/i;

function isCaribbeanOnlyLoop(c) {
  const blob = [c.title, ...(c.itinerary || [])].join(" ");
  if (!CARIBBEAN_ONLY.test(blob)) return false;
  const last = c.itinerary?.at(-1) || "";
  return !AMERICAS_END_RE.test(last);
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; cruises-best-deal/1.0)" },
  });
  return res.ok ? res.text() : "";
}

function eurNum(s) {
  return s ? Number(String(s).replace(/,/g, "")) : null;
}

function parseJsonLd(html) {
  const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    const data = JSON.parse(m[1]);
    return data["@graph"]?.find((x) => x["@type"] === "TouristTrip") || null;
  } catch {
    return null;
  }
}

function parseCabinPrices(html, guests) {
  const cabins = ["Inside", "Oceanview", "Balcony", "Suite"];
  const out = {};
  for (const cabin of cabins) {
    const block = html.match(
      new RegExp(`>${cabin}</span>[\\s\\S]{0,4000}?font-bold whitespace-nowrap">€([\\d,]+)</span>`, "i")
    );
    if (!block) continue;
    const pp = eurNum(block[1]);
    const chunk = block[0];
    const totalM = chunk.match(/Total<!-- -->:<!-- --> <!-- -->(€[\d,]+)/);
    const total = totalM ? eurNum(totalM[1].slice(1)) : pp * guests;
    out[cabin.toLowerCase()] = { pp, total };
  }
  return out;
}

function parseDetail(html, html3, slugPath, portMeta) {
  const trip = parseJsonLd(html);
  if (!trip?.departureTime) return null;

  const line = trip.provider?.name || "";
  const itinerary = (trip.itinerary?.itemListElement || []).map((i) => i.name);
  const nights =
    trip.departureTime && trip.arrivalTime
      ? Math.round((Date.parse(trip.arrivalTime) - Date.parse(trip.departureTime)) / 86400000)
      : 0;

  const shipM = html.match(/href="\/cruise-lines\/[^"]+\/([^"]+)"[^>]*>([^<]+)</);
  const ship = shipM?.[2]?.trim() || "";

  const prices2 = parseCabinPrices(html, 2);
  const prices3 = parseCabinPrices(html3, 3);
  const inside2 = prices2.inside;
  const inside3 = prices3.inside;
  const fallback3 = prices3.oceanview || prices3.balcony || prices3.suite;
  const p3 = inside3 || fallback3;
  const cabin3Note = !inside3 && fallback3 ? ` (${fallback3 === prices3.oceanview ? "oceanview" : "balcony"})` : "";

  const bookM = html.match(/href="(\/go\/[^"]+)"/);
  const cruiselloUrl = `https://cruisello.com${slugPath}`;
  const bookUrl = bookM ? `https://cruisello.com${bookM[1]}` : cruiselloUrl;

  const price2 = inside2?.total || null;
  const price3 = p3?.total || null;
  const thirdGuestDiscount =
    price2 && price3 && price3 / 3 < (inside2?.pp || price2 / 2) * 0.95;

  const c = {
    slug: slugPath.replace(/^\/cruises\//, ""),
    title: trip.name,
    line,
    ship,
    sailDate: trip.departureTime,
    nights,
    port: portMeta?.city || itinerary[0] || "",
    country: portMeta?.country || "",
    region: "Transatlantic",
    direction: "westbound",
    itinerary,
    price2,
    price3,
    currency: "EUR",
    pricePP: inside2?.pp || null,
    cabin3Note,
    thirdGuestDiscount,
    cruiselloUrl,
    bookUrl,
    lineUrl: LINE_BOOK[line] || "https://www.cruisecheap.com/cruises/transatlantic-cruises.html",
    familyNote: "17 лет = взрослый тариф; US visa обязательна; Canada — проверить CA visa",
    hasThirdGuestPromo: Boolean(thirdGuestDiscount),
  };

  if (visaExcludeUk(c)) return null;
  if (isCaribbeanOnlyLoop(c)) return null;
  if (!isWestboundTransatlantic(c)) return null;
  if (c.nights < 5) return null;
  return c;
}

async function main() {
  const slugToPort = new Map();
  for (const p of PORTS) {
    const listUrl = `https://cruisello.com/cruises?departurePorts=${p.slug}&startDate=${START}&endDate=${END}&sortBy=price&sortOrder=asc`;
    const html = await fetchText(listUrl);
    const clean = html.replace(/\0/g, " ");
    const slugs = [...clean.matchAll(/href="(\/cruises\/[^"?]+)"/g)].map((m) => m[1]);
    for (const s of slugs) {
      if (!slugToPort.has(s)) slugToPort.set(s, p);
    }
    console.log(`${p.city}: ${slugs.length} slugs`);
    await new Promise((r) => setTimeout(r, 200));
  }

  const cruises = [];
  for (const slugPath of [...slugToPort.keys()].sort()) {
    const base = `https://cruisello.com${slugPath}`;
    const [html, html3] = await Promise.all([fetchText(base), fetchText(`${base}?guests=3`)]);
    const c = parseDetail(html, html3, slugPath, slugToPort.get(slugPath));
    if (!c) continue;
    if (c.sailDate >= START && c.sailDate <= END) {
      cruises.push(c);
      console.log(`OK ${c.sailDate} ${c.port} → ${c.itinerary.at(-1)} ${c.nights}n €${c.price2}`);
    }
    await new Promise((r) => setTimeout(r, 150));
  }

  const seen = new Set();
  const deduped = cruises.filter((c) => {
    if (seen.has(c.slug)) return false;
    seen.add(c.slug);
    return true;
  });

  for (const c of deduped) {
    if (c.price2 && c.price3 && c.price3 > c.price2 * 2.8) c.price3 = null;
    if (!c.price3 && c.price2 && c.pricePP) {
      c.price3Est = true;
      c.price3 = Math.round(c.price2 + c.pricePP * 0.65);
    }
  }

  deduped.sort((a, b) => a.sailDate.localeCompare(b.sailDate) || (a.price2 || 99999) - (b.price2 || 99999));

  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        meta: {
          fetchedAt: new Date().toISOString().slice(0, 10),
          source: "Cruisello.com",
          dateRange: `${START} — ${END}`,
          region: "Transatlantic westbound EU → US/Canada",
          ports: PORTS.map((p) => `${p.city}, ${p.country}`),
          family: "2–3 adults (daughter 17 = adult fare); UK ports excluded",
          note: "US visa required; CA ports flagged; price2/price3 EUR from Cruisello",
        },
        cruises: deduped,
      },
      null,
      2
    ) + "\n"
  );
  console.log(`Wrote ${deduped.length} cruises → ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
