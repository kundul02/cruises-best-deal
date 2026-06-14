#!/usr/bin/env node
/**
 * Batch CruiseDirect + iCruise Playwright prices (slow; CD needs npm run cd-login).
 *
 *   node scripts/batch-agencies-all.mjs --region=med
 *   node scripts/batch-agencies-all.mjs --from=10 --delay=2000
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { createCdBrowser, fetchCruiseDirectPrices } from "./lib/cruisedirect-search.mjs";
import { createICruiseBrowser, fetchICruisePrices } from "./lib/icruise-search.mjs";
import { computeBestPrice, mergeBuyOption } from "./lib/best-price.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILES = {
  med: path.join(root, "research", "summer-med-july-2026.json"),
  north: path.join(root, "research", "north-aug-2026.json"),
};

const args = process.argv.slice(2);
const regionFilter = args.find((a) => a.startsWith("--region="))?.split("=")[1];
const fromIndex = Number(args.find((a) => a.startsWith("--from="))?.split("=")[1] || 0);
const delayMs = Number(args.find((a) => a.startsWith("--delay="))?.split("=")[1] || 2000);
const skipCd = args.includes("--no-cd");
const skipICruise = args.includes("--no-icruise");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function loadJobs() {
  const jobs = [];
  for (const [regionId, file] of Object.entries(FILES)) {
    if (regionFilter && regionId !== regionFilter) continue;
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    for (let i = 0; i < data.cruises.length; i++) {
      jobs.push({ regionId, file, data, index: i, cruise: data.cruises[i] });
    }
  }
  return jobs;
}

function applyResult(cruise, result) {
  let buyOptions = cruise.buyOptions || [];
  if (result.ok) {
    buyOptions = mergeBuyOption(buyOptions, { ...result, hidden: false });
  } else {
    buyOptions = mergeBuyOption(buyOptions, {
      vendor: result.vendor,
      price2: null,
      price3: null,
      manual: true,
      note: result.needsLogin ? "Cloudflare — npm run cd-login" : result.error || "не найдено",
      verifiedAt: null,
      hidden: false,
    });
  }
  const best = computeBestPrice({ ...cruise, buyOptions });
  cruise.buyOptions = buyOptions;
  cruise.bestPrice2 = best.best2
    ? { vendor: best.best2.vendor, price: best.best2.price, url: best.best2.url }
    : cruise.bestPrice2;
  cruise.bestPrice3 = best.best3
    ? { vendor: best.best3.vendor, price: best.best3.price, url: best.best3.url }
    : cruise.bestPrice3;
}

const jobs = loadJobs().slice(fromIndex);
console.log(`Agency batch: ${jobs.length} cruises (from ${fromIndex}), delay ${delayMs}ms`);
console.log("CruiseDirect:", skipCd ? "skip" : "yes", "| iCruise:", skipICruise ? "skip" : "yes");

let cdCtx;
let icCtx;
let cdPage;
let icPage;

try {
  if (!skipCd) {
    ({ context: cdCtx, page: cdPage } = await createCdBrowser({ headless: true }));
  }
  if (!skipICruise) {
    ({ context: icCtx, page: icPage } = await createICruiseBrowser({ headless: true }));
  }

  for (let n = 0; n < jobs.length; n++) {
    const job = jobs[n];
    const c = job.cruise;
    console.log(`\n[${fromIndex + n + 1}] ${c.ship} ${c.sailDate}`);

    if (!skipCd && cdPage) {
      const cd = await fetchCruiseDirectPrices(cdPage, c);
      applyResult(c, cd);
      console.log("  CD:", cd.ok ? `$${cd.price2}` : cd.error || "login");
      if (cd.needsLogin) {
        console.error("\nCruiseDirect Cloudflare — run: npm run cd-login\n");
        break;
      }
    }

    if (!skipICruise && icPage) {
      const ic = await fetchICruisePrices(icPage, c);
      applyResult(c, ic);
      console.log("  iCruise:", ic.ok ? `$${ic.price2}` : ic.error || "—");
    }

    job.data.cruises[job.index] = c;
    job.data.meta.agencyBatchAt = new Date().toISOString();
    fs.writeFileSync(job.file, JSON.stringify(job.data, null, 2) + "\n");
    await sleep(delayMs);
  }
} finally {
  await cdCtx?.close().catch(() => null);
  await icCtx?.close().catch(() => null);
}

execSync("node scripts/build-unified-cruises-html.mjs", { cwd: root, stdio: "inherit" });
console.log("\nDone.");
