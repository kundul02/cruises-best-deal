#!/usr/bin/env node
/**
 * Batch VTG prices for all cruises → update JSON + rebuild HTML.
 *
 *   node scripts/batch-vtg-all.mjs
 *   node scripts/batch-vtg-all.mjs --region=med
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { createVtgBrowser, fetchVtgPrices, isVtgLineSupported } from "./lib/vtg-search.mjs";
import { computeBestPrice, mergeBuyOption } from "./lib/best-price.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const FILES = {
  med: path.join(root, "research", "summer-med-july-2026.json"),
  north: path.join(root, "research", "north-aug-2026.json"),
  transatlantic: path.join(root, "research", "transatlantic-fall-2026.json"),
};

const args = process.argv.slice(2);
const regionFilter = args.find((a) => a.startsWith("--region="))?.split("=")[1];
const fromIndex = Number(args.find((a) => a.startsWith("--from="))?.split("=")[1] || 0);
const delayMs = Number(args.find((a) => a.startsWith("--delay="))?.split("=")[1] || 800);

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

function saveJob(job) {
  job.data.meta.vtgBatchAt = new Date().toISOString();
  job.data.meta.lastPriceRefresh = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(job.file, JSON.stringify(job.data, null, 2) + "\n");
}

function applyVtg(cruise, vtg) {
  const ts = new Date().toISOString().slice(0, 10);
  let buyOptions = (cruise.buyOptions || []).filter((o) => o.vendor !== "Vacations To Go");

  if (vtg.ok) {
    buyOptions = mergeBuyOption(buyOptions, vtg);
  } else if (!isVtgLineSupported(cruise.line)) {
    buyOptions = mergeBuyOption(buyOptions, {
      vendor: "Vacations To Go",
      url: "https://www.vacationstogo.com/custom.cfm",
      price2: null,
      price3: null,
      manual: true,
      note: `${cruise.line} — нет на VTG US`,
      verifiedAt: null,
    });
  } else if (vtg.needsLogin) {
    buyOptions = mergeBuyOption(buyOptions, {
      vendor: "Vacations To Go",
      url: "https://www.vacationstogo.com/login.cfm",
      price2: null,
      price3: null,
      manual: true,
      note: "нужен npm run vtg-login",
      verifiedAt: null,
    });
  } else {
    buyOptions = mergeBuyOption(buyOptions, {
      vendor: "Vacations To Go",
      url: "https://www.vacationstogo.com/custom.cfm",
      price2: null,
      price3: null,
      manual: true,
      note: vtg.error || "не найдено",
      verifiedAt: null,
    });
  }

  const best = computeBestPrice({ ...cruise, buyOptions });
  return {
    buyOptions,
    vtgPrice2: vtg.ok ? vtg.price2 : null,
    vtgPrice3: vtg.ok ? vtg.price3 : null,
    vtgCurrency: vtg.currency || null,
    vtgAt: vtg.ok ? ts : cruise.vtgAt || null,
    bestPrice2: best.best2 ? { vendor: best.best2.vendor, price: best.best2.price, url: best.best2.url } : null,
    bestPrice3: best.best3 ? { vendor: best.best3.vendor, price: best.best3.price, url: best.best3.url } : null,
    bestPriceAt: ts,
  };
}

const jobs = loadJobs();
console.log(`VTG batch: ${jobs.length} cruises${regionFilter ? ` (${regionFilter})` : ""}\n`);

const { context, page } = await createVtgBrowser({ headless: true });
const stats = { ok: 0, skip: 0, fail: 0, login: 0 };

try {
  for (let n = fromIndex; n < jobs.length; n++) {
    const job = jobs[n];
    const c = job.cruise;
    const label = `[${n + 1}/${jobs.length}] ${c.ship} · ${c.sailDate}`;

    if (!isVtgLineSupported(c.line)) {
      const patch = applyVtg(c, { ok: false, skipped: true });
      job.data.cruises[job.index] = { ...c, ...patch };
      saveJob(job);
      stats.skip++;
      console.log(`${label} — skip (${c.line} not on VTG)`);
      continue;
    }

    process.stdout.write(`${label} … `);
    let vtg;
    try {
      vtg = await fetchVtgPrices(page, c);
    } catch (e) {
      vtg = { ok: false, vendor: "Vacations To Go", error: e.message };
    }
    const patch = applyVtg(c, vtg);
    job.data.cruises[job.index] = { ...c, ...patch };
    saveJob(job);

    if (vtg.needsLogin) {
      stats.login++;
      console.log("LOGIN REQUIRED — run npm run vtg-login");
      break;
    }
    if (vtg.ok) {
      stats.ok++;
      console.log(`$${vtg.price2} / $${vtg.price3} (#${vtg.fastDealId || "?"})`);
    } else {
      stats.fail++;
      console.log(`FAIL: ${vtg.error}`);
    }

    await sleep(delayMs);
  }
} finally {
  await context.close();
}

console.log(`\nDone: ${stats.ok} ok, ${stats.fail} fail, ${stats.skip} skip`);
if (stats.login) {
  console.log("Stopped: VTG session expired");
  process.exit(1);
}

execSync("node scripts/build-unified-cruises-html.mjs", { cwd: root, stdio: "inherit" });
console.log("\nHTML updated: cruises-europe-2026.html");
