#!/usr/bin/env node
/**
 * Refresh prices for one cruise (Cruisello + VTG + best price).
 *
 *   npm run refresh-price -- --slug=french-italian-riviera-cannes-genoa-barcelona~MSC-GRANDIOSA-20260705-7
 *   npm run refresh-price -- --slug=... --no-vtg
 *   npm run refresh-price -- --slug=... --rebuild-html
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { refreshCruisePrices } from "./lib/refresh-cruise.mjs";
import { loadEnvFile } from "./lib/load-env.mjs";

loadEnvFile();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const JSON_FILES = [
  path.join(root, "research", "summer-med-july-2026.json"),
  path.join(root, "research", "north-aug-2026.json"),
  path.join(root, "research", "transatlantic-fall-2026.json"),
];

const args = process.argv.slice(2);
const slugArg = args.find((a) => a.startsWith("--slug="))?.slice(7);
const noVtg = args.includes("--no-vtg");
const withAgencies = args.includes("--agencies");
const rebuild = args.includes("--rebuild-html");
const debug = args.includes("--debug");

const DEFAULT_TEST_SLUG =
  "french-italian-riviera-cannes-genoa-barcelona~MSC-GRANDIOSA-20260705-7";

const slug = slugArg || DEFAULT_TEST_SLUG;

function findCruise(slug) {
  for (const file of JSON_FILES) {
    if (!fs.existsSync(file)) continue;
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    const c = data.cruises.find((x) => x.slug === slug);
    if (c) return { cruise: c, file, data };
  }
  return null;
}

const found = findCruise(slug);
if (!found) {
  console.error("Cruise not found:", slug);
  process.exit(1);
}

console.log("Refreshing:", found.cruise.line, found.cruise.ship, found.cruise.sailDate);
console.log("VTG:", noVtg ? "skip" : "yes (needs npm run vtg-login if first time)");
console.log("Agencies Playwright:", withAgencies ? "CD + iCruise" : "skip (/go/ links always)\n");

const result = await refreshCruisePrices(found.cruise, {
  vtg: !noVtg,
  go: true,
  agencies: withAgencies,
  debug,
});

const idx = found.data.cruises.findIndex((c) => c.slug === slug);
found.data.cruises[idx] = { ...found.data.cruises[idx], ...result.patch };
found.data.meta.lastPriceRefresh = new Date().toISOString().slice(0, 10);
fs.writeFileSync(found.file, JSON.stringify(found.data, null, 2) + "\n");

console.log("\n" + result.message);
console.log("\nCruisello:", result.live?.price2 != null ? `€${result.live.price2} (2) / €${result.live.price3} (3)` : "—");
if (result.vtg?.ok) console.log("VTG:", `€${result.vtg.price2} (${result.vtg.currency})`);
else if (result.vtg?.needsLogin) console.log("VTG: login required → npm run vtg-login");
else if (result.vtg?.skipped) console.log("VTG:", result.vtg.reason || "skipped");
else console.log("VTG:", result.vtg?.error || "—");

if (result.bestPrice?.best2) {
  console.log("\n★ BEST 2 guests:", result.bestPrice.best2.vendor, "€" + result.bestPrice.best2.price);
}
if (result.bestPrice?.best3) {
  console.log("★ BEST 3 guests:", result.bestPrice.best3.vendor, "€" + result.bestPrice.best3.price);
}

if (rebuild) {
  execSync("node scripts/build-unified-cruises-html.mjs", { cwd: root, stdio: "inherit" });
  console.log("\nHTML rebuilt: cruises-europe-2026.html");
}

process.exit(result.errors.some((e) => e.source === "Cruisello") ? 1 : 0);
