#!/usr/bin/env node
/** Export all runtime leads with assigned ids. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "cruises.html"), "utf8");
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];

const start = script.indexOf("const BASE_LEADS = [");
const feedStart = script.indexOf("const LATEST_FEED = [");
const end = script.indexOf("function mapFeedLead");
const dataCode = script.slice(start, end);

const factory = new Function(dataCode + "\nreturn { BASE_LEADS, LATEST_FEED };");
const ctx = factory();

function mapFeedLead(item) {
  return {
    id: item.id,
    domain: item.domain,
    name: item.name,
    line: item.line,
    ship: item.ship,
    region: item.region,
    embark: item.embark,
    disembark: item.disembark,
    sailDate: item.sailDate,
    nights: item.nights,
    cabin: item.cabin,
    pax: item.pax || 3,
    pricePerPerson: item.pricePerPerson,
    pricePerNight: item.pricePerNight,
    priceTotalEstimate: item.priceTotalEstimate,
    currency: item.currency || "USD",
    inclusions: item.inclusions || [],
    source: item.source,
    sourceUrl: item.sourceUrl,
    bookingUrl: item.bookingUrl,
    dealScore: item.dealScore,
    urgent: item.urgent || false,
    visaNotes: item.visaNotes,
    visaWarning: item.visaWarning,
    documents: item.documents,
    closed: item.closed || false,
    summary: item.summary,
    desc: item.desc,
  };
}

const all = [
  ...ctx.BASE_LEADS,
  ...(ctx.LATEST_FEED || []).map(mapFeedLead),
];

const out = all.map((p) => ({
  id: p.id,
  domain: p.domain,
  name: p.name,
  line: p.line,
  ship: p.ship,
  region: p.region,
  embark: p.embark,
  disembark: p.disembark,
  sailDate: p.sailDate,
  nights: p.nights,
  cabin: p.cabin,
  pax: p.pax,
  pricePerPerson: p.pricePerPerson,
  pricePerNight: p.pricePerNight,
  priceTotalEstimate: p.priceTotalEstimate,
  currency: p.currency,
  inclusions: p.inclusions,
  source: p.source,
  sourceUrl: p.sourceUrl,
  bookingUrl: p.bookingUrl,
  dealScore: p.dealScore,
  urgent: p.urgent,
  visaNotes: p.visaNotes,
  visaWarning: p.visaWarning,
  documents: p.documents,
  closed: p.closed,
  summary: p.summary,
  desc: p.desc,
}));

const outPath = path.join(root, "research", "all-leads-full.json");
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");
console.log(`Exported ${out.length} leads → ${outPath}`);
