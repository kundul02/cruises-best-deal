#!/usr/bin/env node
/**
 * Discover extra cruise lines on Cruisello (Princess, HAL, etc.) and merge into JSON.
 * Does not remove existing cruises — only appends new slugs.
 *
 *   node scripts/fetch-extra-lines.mjs
 *   node scripts/fetch-extra-lines.mjs --region=north --dry-run
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const TARGET_LINES = [
  "Princess Cruises",
  "Holland America Line",
  "Cunard Line",
  "Costa Cruises",
];

const LINE_SLUGS = {
  "Princess Cruises": "princess-cruises",
  "Holland America Line": "holland-america-line",
  "Cunard Line": "cunard-line",
  "Costa Cruises": "costa-cruises",
};

const REGIONS = {
  north: {
    file: path.join(root, "research", "north-aug-2026.json"),
    start: "2026-08-05",
    end: "2026-08-31",
    ports: ["copenhagen", "southampton", "amsterdam", "hamburg", "bremerhaven", "kiel"],
    filter: (c) =>
      /Norway|Baltic|North|Fjord|Copenhagen|Hamburg|Bremerhaven|Southampton|Amsterdam/i.test(
        [c.title, c.port, ...(c.itinerary || [])].join(" ")
      ),
  },
  med: {
    file: path.join(root, "research", "summer-med-july-2026.json"),
    start: "2026-07-05",
    end: "2026-07-31",
    ports: ["marseille", "cannes", "barcelona", "genoa", "nice", "rome-civitavecchia"],
    filter: () => true,
  },
};

const LINE_BOOK = {
  "Princess Cruises": "https://www.princess.com/",
  "Holland America Line": "https://www.hollandamerica.com/",
  "Cunard Line": "https://www.cunard.com/",
  "Costa Cruises": "https://www.costacruises.com/",
};

const args = process.argv.slice(2);
const regionKey = args.find((a) => a.startsWith("--region="))?.split("=")[1] || "north";
const dryRun = args.includes("--dry-run");
const reg = REGIONS[regionKey];
if (!reg) {
  console.error("Unknown region:", regionKey);
  process.exit(1);
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; cruises-best-deal/1.0)" },
  });
  return res.ok ? res.text() : "";
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

function eurNum(s) {
  return s ? Number(String(s).replace(/,/g, "")) : null;
}

function parseDetail(html, html3, slugPath) {
  const trip = parseJsonLd(html);
  if (!trip?.departureTime) return null;
  const line = trip.provider?.name || "";
  if (!TARGET_LINES.includes(line)) return null;

  const itinerary = (trip.itinerary?.itemListElement || []).map((i) => i.name);
  const nights =
    trip.departureTime && trip.arrivalTime
      ? Math.round((Date.parse(trip.arrivalTime) - Date.parse(trip.departureTime)) / 86400000)
      : 0;
  const shipM = html.match(/href="\/cruise-lines\/[^"]+\/([^"]+)"[^>]*>([^<]+)</);
  const ship = shipM?.[2]?.trim() || "";

  const inside2M = html.match(/">Inside<\/span>[\s\S]{0,600}?€([\d,]+)/i);
  const pp = inside2M ? eurNum(inside2M[1]) : null;
  const bookM = html.match(/href="(\/go\/[^"]+)"/);
  const cruiselloUrl = `https://cruisello.com${slugPath}`;
  const bookUrl = bookM ? `https://cruisello.com${bookM[1]}` : cruiselloUrl;

  return {
    slug: slugPath.replace(/^\/cruises\//, ""),
    title: trip.name,
    line,
    ship,
    sailDate: trip.departureTime,
    nights,
    port: itinerary[0] || "",
    country: "",
    region: regionKey === "north" ? "Northern Europe" : "Mediterranean",
    itinerary,
    price2: pp ? pp * 2 : null,
    price3: pp ? Math.round(pp * 2 + pp * 0.65) : null,
    pricePP: pp,
    price3Est: true,
    cruiselloUrl,
    bookUrl,
    lineUrl: LINE_BOOK[line] || "",
    familyNote: "17 лет = взрослый тариф",
  };
}

async function discoverSlugs() {
  const slugs = new Set();
  for (const line of TARGET_LINES) {
    const slug = LINE_SLUGS[line];
    const url = `https://cruisello.com/cruise-lines/${slug}/cruises?startDate=${reg.start}&endDate=${reg.end}`;
    const html = await fetchText(url);
    for (const m of html.matchAll(/href="(\/cruises\/[^"?]+)"/g)) slugs.add(m[1]);
    for (const port of reg.ports) {
      const listUrl = `https://cruisello.com/cruises?departurePorts=${port}&startDate=${reg.start}&endDate=${reg.end}&sortBy=price`;
      const listHtml = await fetchText(listUrl);
      for (const m of listHtml.matchAll(/href="(\/cruises\/[^"?]+)"/g)) slugs.add(m[1]);
      await new Promise((r) => setTimeout(r, 120));
    }
  }
  return [...slugs];
}

const data = JSON.parse(fs.readFileSync(reg.file, "utf8"));
const existing = new Set(data.cruises.map((c) => c.slug));
const slugPaths = await discoverSlugs();
console.log(`Discovered ${slugPaths.length} slugs on Cruisello for ${regionKey}`);

const added = [];
for (const slugPath of slugPaths) {
  const slug = slugPath.replace(/^\/cruises\//, "");
  if (existing.has(slug)) continue;
  const base = `https://cruisello.com${slugPath}`;
  const [html, html3] = await Promise.all([fetchText(base), fetchText(`${base}?guests=3`)]);
  const c = parseDetail(html, html3, slugPath);
  if (!c || c.sailDate < reg.start || c.sailDate > reg.end) continue;
  if (!reg.filter(c)) continue;
  added.push(c);
  console.log("NEW", c.line, c.ship, c.sailDate, c.price2 ? `€${c.price2}` : "—");
  await new Promise((r) => setTimeout(r, 150));
}

console.log(`\n${added.length} new cruises for ${TARGET_LINES.join(", ")}`);

if (!dryRun && added.length) {
  data.cruises.push(...added);
  data.cruises.sort((a, b) => a.sailDate.localeCompare(b.sailDate) || (a.price2 || 99999) - (b.price2 || 99999));
  data.meta.extraLinesAt = new Date().toISOString();
  data.meta.extraLinesNote = `Added ${added.length} from fetch-extra-lines (${TARGET_LINES.join(", ")})`;
  fs.writeFileSync(reg.file, JSON.stringify(data, null, 2) + "\n");
  console.log(`Merged into ${reg.file} → ${data.cruises.length} total`);
  console.log("Next: node scripts/enrich-north-aug.mjs (or summer) && node scripts/batch-go-all.mjs");
} else if (dryRun) {
  console.log("(dry-run — JSON not modified)");
}
