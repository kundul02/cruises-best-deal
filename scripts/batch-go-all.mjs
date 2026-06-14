#!/usr/bin/env node
/**
 * Batch: refresh Cruisello /go/ agency links for all cruises (fast, no Playwright).
 *
 *   node scripts/batch-go-all.mjs
 *   node scripts/batch-go-all.mjs --region=north
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { refreshGoAgencies } from "./lib/fetch-go-page.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILES = {
  med: path.join(root, "research", "summer-med-july-2026.json"),
  north: path.join(root, "research", "north-aug-2026.json"),
};

const regionFilter = process.argv.find((a) => a.startsWith("--region="))?.split("=")[1];
const delayMs = Number(process.argv.find((a) => a.startsWith("--delay="))?.split("=")[1] || 150);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

for (const [regionId, file] of Object.entries(FILES)) {
  if (regionFilter && regionId !== regionFilter) continue;
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  let ok = 0;
  for (const c of data.cruises) {
    const res = await refreshGoAgencies(c, c.buyOptions || []);
    c.buyOptions = res.buyOptions;
    if (res.go?.ok) ok++;
    console.log(res.go?.ok ? "OK" : "SKIP", c.slug.slice(0, 50), res.go?.agencies?.length || 0, "agencies");
    await sleep(delayMs);
  }
  data.meta.goBatchAt = new Date().toISOString();
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
  console.log(`\n${path.basename(file)}: ${ok}/${data.cruises.length} /go/ pages parsed\n`);
}

execSync("node scripts/normalize-buy-options.mjs", { cwd: root, stdio: "inherit" });
execSync("node scripts/build-unified-cruises-html.mjs", { cwd: root, stdio: "inherit" });
