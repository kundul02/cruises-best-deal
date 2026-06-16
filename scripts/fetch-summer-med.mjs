#!/usr/bin/env node
/** Fetch Med cruises Aug–Dec 2026 from Cruisello → research/summer-med-july-2026.json */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { mergeCruiseInventory } from "./lib/merge-cruise-data.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outPath = path.join(root, "research", "summer-med-july-2026.json");

const START = "2026-08-05";
const END = "2026-12-31";

const PORTS = [
  { slug: "cannes", city: "Cannes", country: "France" },
  { slug: "marseille", city: "Marseille", country: "France" },
  { slug: "barcelona", city: "Barcelona", country: "Spain" },
  { slug: "valencia", city: "Valencia", country: "Spain" },
  { slug: "genoa", city: "Genoa", country: "Italy" },
  { slug: "venice", city: "Venice", country: "Italy" },
  { slug: "naples", city: "Naples", country: "Italy" },
  { slug: "rome-civitavecchia", city: "Civitavecchia", country: "Italy" },
  { slug: "savona", city: "Savona", country: "Italy" },
  { slug: "palermo", city: "Palermo", country: "Italy" },
  { slug: "lisbon", city: "Lisbon", country: "Portugal" },
  { slug: "istanbul", city: "Istanbul", country: "Turkey" },
  { slug: "piraeus", city: "Piraeus", country: "Greece" },
  { slug: "malta", city: "Valletta", country: "Malta" },
];

const LINE_BOOK = {
  "MSC Cruises": "https://www.msccruises.co.uk/",
  "Celebrity Cruises": "https://www.celebritycruises.com/",
  "Norwegian Cruise Line": "https://www.ncl.com/",
  "Royal Caribbean": "https://www.royalcaribbean.com/",
  "Costa Cruises": "https://www.costacruises.com/",
  "Holland America Line": "https://www.hollandamerica.com/",
  "Princess Cruises": "https://www.princess.com/",
  "Cunard Line": "https://www.cunard.com/",
};

const CHILD_NOTE = {
  "MSC Cruises":
    "MSC: 3-й/4-й гость часто дешевле (проверьте); 16 лет — обычно взрослый тариф",
  "Celebrity Cruises":
    "Celebrity: скидка 3-го/4-го гостя; 16 лет — как взрослый, проверьте на сайте",
  "Norwegian Cruise Line":
    "NCL: Kids Sail Free до ~12 лет; 16 лет — взрослый; проверьте Free at Sea",
  "Royal Caribbean":
    "RCCL: детские акции до ~12 лет; 16+ — взрослый тариф",
};

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; cruises-best-deal/1.0)" },
  });
  return res.ok ? res.text() : "";
}

function eurNum(s) {
  return s ? Number(s.replace(/,/g, "")) : null;
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
  const nights = trip.departureTime && trip.arrivalTime
    ? Math.round((Date.parse(trip.arrivalTime) - Date.parse(trip.departureTime)) / 86400000)
    : 0;

  const shipM = html.match(/href="\/cruise-lines\/[^"]+\/([^"]+)"[^>]*>([^<]+)</);
  const ship = shipM?.[2]?.trim() || "";

  const portM = html.match(/<span>Cannes<\/span>|<span>([^<]+)<\/span><span class="font-emoji[^"]*">🇫🇷/);
  const portFromHtml = html.match(/class="text-foreground flex items-center text-xl font-bold[\s\S]*?<span>([^<]+)<\/span>/)?.[1]?.trim();

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

  return {
    slug: slugPath.replace(/^\/cruises\//, ""),
    title: trip.name,
    line,
    ship,
    sailDate: trip.departureTime,
    nights,
    port: portMeta?.city || portFromHtml || itinerary[0] || "",
    country: portMeta?.country || "",
    itinerary,
    price2,
    price3,
    pricePP: inside2?.pp || null,
    cabin3Note,
    thirdGuestDiscount,
    cruiselloUrl,
    bookUrl,
    lineUrl: LINE_BOOK[line] || "https://www.cruisecritic.com/cruise-deals",
    childNote: CHILD_NOTE[line] || "Проверьте детский тариф для 16 лет на сайте линии",
    hasChildPromo: Boolean(thirdGuestDiscount || /MSC|NCL|Celebrity|Royal/.test(line)),
  };
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
  const slugs = [...slugToPort.keys()].sort();
  for (const slugPath of slugs) {
    const base = `https://cruisello.com${slugPath}`;
    const [html, html3] = await Promise.all([fetchText(base), fetchText(`${base}?guests=3`)]);
    const c = parseDetail(html, html3, slugPath, slugToPort.get(slugPath));
    if (!c) {
      console.log(`SKIP ${slugPath}`);
      continue;
    }
    if (c.sailDate >= START && c.sailDate <= END) {
      cruises.push(c);
      console.log(`OK ${c.sailDate} ${c.port} €${c.price2}/${c.price3}`);
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

  const previous = fs.existsSync(outPath)
    ? JSON.parse(fs.readFileSync(outPath, "utf8"))
    : { cruises: [] };
  const { cruises: mergedCruises, added, addedCount, removed } = mergeCruiseInventory(previous.cruises, deduped);
  console.log(`Merge: +${addedCount} new, -${removed} dropped`);

  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        meta: {
          fetchedAt: new Date().toISOString().slice(0, 10),
          source: "Cruisello.com",
          dateRange: `${START} — ${END}`,
          ports: PORTS.map((p) => `${p.city}, ${p.country}`),
          note: "price2/price3 = total EUR inside (or lowest cabin for 3 guests); verify before booking",
          lastResearchSync: new Date().toISOString(),
          lastDiscoverAdded: addedCount,
        },
        cruises: mergedCruises,
      },
      null,
      2
    ) + "\n"
  );
  console.log(`Wrote ${mergedCruises.length} cruises → ${outPath}`);
  if (added.length) {
    for (const a of added.slice(0, 10)) console.log(`  NEW ${a.sailDate} ${a.ship} ${a.port}`);
    if (added.length > 10) console.log(`  … +${added.length - 10} more`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
