#!/usr/bin/env node
/**
 * Local price refresh API — Cruisello + VTG + best price.
 *
 *   node scripts/price-server.mjs
 *   curl "http://127.0.0.1:3920/refresh?slug=YOUR-SLUG"
 *   curl "http://127.0.0.1:3920/refresh?slug=...&vtg=0"   # Cruisello only
 *   curl "http://127.0.0.1:3920/refresh?slug=...&agencies=1"  # + CruiseDirect/iCruise Playwright
 */
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { refreshCruisePrices } from "./lib/refresh-cruise.mjs";
import { loadEnvFile } from "./lib/load-env.mjs";

loadEnvFile();

const API_VERSION = 2;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const PORT = Number(process.env.PRICE_SERVER_PORT || 3920);

const JSON_FILES = [
  path.join(root, "research", "summer-med-july-2026.json"),
  path.join(root, "research", "north-aug-2026.json"),
];

function loadAllCruises() {
  const out = [];
  for (const f of JSON_FILES) {
    if (!fs.existsSync(f)) continue;
    const data = JSON.parse(fs.readFileSync(f, "utf8"));
    for (const c of data.cruises) out.push({ ...c, _file: f });
  }
  return out;
}

function findCruise(slug) {
  return loadAllCruises().find((c) => c.slug === slug);
}

function saveCruiseUpdate(cruise, patch) {
  const file = cruise._file;
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const idx = data.cruises.findIndex((c) => c.slug === cruise.slug);
  if (idx < 0) throw new Error("cruise not in file");
  data.cruises[idx] = { ...data.cruises[idx], ...patch };
  data.meta.lastPriceRefresh = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
  return data.cruises[idx];
}

async function refreshSlug(slug, { vtg = true, agencies = false } = {}) {
  const cruise = findCruise(slug);
  if (!cruise) return { ok: false, error: "Cruise not found", slug };

  const result = await refreshCruisePrices(cruise, { vtg, go: true, agencies });
  const updated = saveCruiseUpdate(cruise, result.patch);

  try {
    execSync("node scripts/build-unified-cruises-html.mjs", { cwd: root, stdio: "ignore" });
  } catch {
    /* HTML rebuild optional */
  }

  return {
    ok: true,
    slug,
    cruise: updated,
    live: result.live,
    vtg: result.vtg,
    agencies: result.agencies,
    bestPrice: result.bestPrice,
    errors: result.errors,
    message: result.message,
    htmlRebuilt: true,
  };
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);

  if (url.pathname === "/health") {
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, port: PORT, apiVersion: API_VERSION, vtgPlaywright: true }));
    return;
  }

  if (url.pathname === "/refresh") {
    const slug = url.searchParams.get("slug");
    const vtg = url.searchParams.get("vtg") !== "0";
    const agencies = url.searchParams.get("agencies") === "1";
    if (!slug) {
      res.writeHead(400);
      res.end(JSON.stringify({ ok: false, error: "Missing ?slug=" }));
      return;
    }
    try {
      const result = await refreshSlug(slug, { vtg, agencies });
      res.writeHead(result.ok ? 200 : 404);
      res.end(JSON.stringify(result, null, 2));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ ok: false, error: "Use GET /refresh?slug=..." }));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Price server http://127.0.0.1:${PORT}`);
  console.log("VTG first time: npm run vtg-login");
  console.log(`Test: curl "http://127.0.0.1:${PORT}/refresh?slug=french-italian-riviera-cannes-genoa-barcelona~MSC-GRANDIOSA-20260705-7"`);
});
