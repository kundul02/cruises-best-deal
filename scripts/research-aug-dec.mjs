#!/usr/bin/env node
/**
 * Deep sync Med + North: Aug 5 — Dec 31 2026
 * fetch → extra lines → enrich → normalize → go-batch → vtg-batch → build-html
 *
 *   node scripts/research-aug-dec.mjs
 *   node scripts/research-aug-dec.mjs --skip-vtg
 *   node scripts/research-aug-dec.mjs --region=med
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const args = process.argv.slice(2);
const skipVtg = args.includes("--skip-vtg");
const regionOnly = args.find((a) => a.startsWith("--region="))?.split("=")[1];

function run(cmd, label) {
  console.log(`\n=== ${label} ===\n> ${cmd}\n`);
  execSync(cmd, { cwd: root, stdio: "inherit" });
}

function countRegion(file) {
  if (!fs.existsSync(file)) return 0;
  return JSON.parse(fs.readFileSync(file, "utf8")).cruises.length;
}

const medFile = path.join(root, "research/summer-med-july-2026.json");
const northFile = path.join(root, "research/north-aug-2026.json");

console.log("Research sync: Med + North · 5 Aug — 31 Dec 2026");
console.log("Before:", { med: countRegion(medFile), north: countRegion(northFile) });

if (!regionOnly || regionOnly === "med") {
  run("node scripts/fetch-summer-med.mjs", "Fetch Med (Cruisello)");
  run("node scripts/fetch-extra-lines.mjs --region=med", "Extra lines Med (Princess/HAL/Costa/Cunard)");
  run("node scripts/enrich-summer-buy.mjs", "Enrich Med buyOptions");
}

if (!regionOnly || regionOnly === "north") {
  run("node scripts/fetch-north-aug-2026.mjs", "Fetch North (Cruisello)");
  run("node scripts/fetch-extra-lines.mjs --region=north", "Extra lines North");
  run("node scripts/enrich-north-aug.mjs", "Enrich North buyOptions");
}

run("node scripts/normalize-buy-options.mjs", "Normalize buyOptions");

if (!regionOnly || regionOnly === "med") {
  run("node scripts/batch-go-all.mjs --region=med", "Go-batch Med");
}
if (!regionOnly || regionOnly === "north") {
  run("node scripts/batch-go-all.mjs --region=north", "Go-batch North");
}

if (!skipVtg) {
  if (!regionOnly || regionOnly === "med") {
    run("node scripts/batch-vtg-all.mjs --region=med --delay=600", "VTG batch Med");
  }
  if (!regionOnly || regionOnly === "north") {
    run("node scripts/batch-vtg-all.mjs --region=north --delay=600", "VTG batch North");
  }
} else {
  console.log("\n(skipped VTG — use without --skip-vtg when vtg-login is ready)\n");
}

run("node scripts/build-unified-cruises-html.mjs", "Build HTML");

console.log("\nDone:", {
  med: countRegion(medFile),
  north: countRegion(northFile),
});
