#!/usr/bin/env node
/** Probe iCruise homepage search */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createICruiseBrowser, fetchICruisePrices } from "./lib/icruise-search.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const slug = process.argv.find((a) => a.startsWith("--slug="))?.slice(7);
const files = ["research/north-aug-2026.json", "research/summer-med-july-2026.json"];

let cruise;
for (const f of files) {
  const data = JSON.parse(fs.readFileSync(path.join(root, f), "utf8"));
  cruise = slug ? data.cruises.find((c) => c.slug === slug) : data.cruises.find((c) => /EURIBIA/i.test(c.ship));
  if (cruise) break;
}

console.log("Probing iCruise for", cruise.ship, cruise.sailDate);
const { context, page } = await createICruiseBrowser({ headless: true });
try {
  const result = await fetchICruisePrices(page, cruise);
  console.log(JSON.stringify(result, null, 2));
} finally {
  await context.close();
}
