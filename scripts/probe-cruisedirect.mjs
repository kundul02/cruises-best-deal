#!/usr/bin/env node
/** Probe CruiseDirect search page (Cloudflare / filter DOM) */
import { createCdBrowser, fetchCruiseDirectPrices, parseCruiseDirectText } from "./lib/cruisedirect-search.mjs";

const slug = process.argv.find((a) => a.startsWith("--slug="))?.slice(7);
const files = ["research/north-aug-2026.json", "research/summer-med-july-2026.json"];
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let cruise;
for (const f of files) {
  const data = JSON.parse(fs.readFileSync(path.join(root, f), "utf8"));
  cruise = data.cruises.find((c) => c.slug === slug) || data.cruises.find((c) => /EURIBIA/i.test(c.ship));
  if (cruise) break;
}
if (!cruise) {
  console.error("No cruise found; pass --slug=...");
  process.exit(1);
}

console.log("Probing CruiseDirect for", cruise.ship, cruise.sailDate);
const { context, page } = await createCdBrowser({ headless: true });
try {
  const title = await page.goto("https://www.cruisedirect.com/search-results", { waitUntil: "domcontentloaded" });
  console.log("title:", await page.title());
  const result = await fetchCruiseDirectPrices(page, cruise);
  console.log(JSON.stringify(result, null, 2));
} finally {
  await context.close();
}
