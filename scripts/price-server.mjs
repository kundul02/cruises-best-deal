#!/usr/bin/env node
/**
 * Local price refresh API — Cruisello + VTG + deploy to GitHub Pages.
 *
 *   node scripts/price-server.mjs
 *   curl "http://127.0.0.1:3920/refresh?slug=SLUG&token=TOKEN"
 *   curl "http://127.0.0.1:3920/deploy?region=all&token=TOKEN"
 */
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { refreshCruisePrices } from "./lib/refresh-cruise.mjs";
import { loadEnvFile } from "./lib/load-env.mjs";
import { gitDeploy } from "./git-deploy.mjs";

loadEnvFile();

const API_VERSION = 2;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const PORT = Number(process.env.PRICE_SERVER_PORT || 3920);

const REGION_FILES = {
  med: path.join(root, "research", "summer-med-july-2026.json"),
  north: path.join(root, "research", "north-aug-2026.json"),
  transatlantic: path.join(root, "research", "transatlantic-fall-2026.json"),
};

const JSON_FILES = Object.values(REGION_FILES);

let lastDeploy = null;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function authOk(url) {
  const required = process.env.REFRESH_TOKEN?.trim();
  if (!required) return true;
  return url.searchParams.get("token") === required;
}

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

function rebuildHtml() {
  execSync("node scripts/build-unified-cruises-html.mjs", { cwd: root, stdio: "ignore" });
}

async function refreshSlug(slug, { vtg = true, agencies = false } = {}) {
  const cruise = findCruise(slug);
  if (!cruise) return { ok: false, error: "Cruise not found", slug };

  const useVtg = vtg && !/TUI|AIDA/i.test(cruise.line);
  const result = await refreshCruisePrices(cruise, { vtg: useVtg, go: true, agencies });
  const updated = saveCruiseUpdate(cruise, result.patch);

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
  };
}

async function deployRegion(regionId, { vtg = true, agencies = false, push = true } = {}) {
  const files =
    regionId === "all"
      ? JSON_FILES.filter((f) => fs.existsSync(f))
      : REGION_FILES[regionId]
        ? [REGION_FILES[regionId]]
        : [];

  if (!files.length) return { ok: false, error: "Unknown region: " + regionId };

  const results = [];
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const c of data.cruises) {
      const r = await refreshSlug(c.slug, { vtg, agencies });
      results.push({ slug: c.slug, ok: r.ok, error: r.error });
      await sleep(600);
    }
  }

  rebuildHtml();

  let deploy = { pushed: false };
  if (push) {
    try {
      deploy = gitDeploy({ message: `chore: auto price refresh ${regionId} ${new Date().toISOString().slice(0, 10)}` });
      lastDeploy = new Date().toISOString();
    } catch (e) {
      deploy = { ok: false, error: e.message };
    }
  }

  return { ok: true, region: regionId, refreshed: results.length, results, deploy, htmlRebuilt: true };
}

async function handleDeploy(url) {
  const region = url.searchParams.get("region") || "all";
  const slug = url.searchParams.get("slug");
  const vtg = url.searchParams.get("vtg") !== "0";
  const agencies = url.searchParams.get("agencies") === "1";
  const push = url.searchParams.get("push") !== "0";

  if (slug) {
    const r = await refreshSlug(slug, { vtg, agencies });
    rebuildHtml();
    let deploy = { pushed: false };
    if (push && r.ok) {
      deploy = gitDeploy();
      lastDeploy = new Date().toISOString();
    }
    return { ...r, deploy, htmlRebuilt: true };
  }

  return deployRegion(region, { vtg, agencies, push });
}

function sendJson(res, code, body) {
  res.writeHead(code);
  res.end(JSON.stringify(body, null, 2));
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);

  if (url.pathname === "/health") {
    sendJson(res, 200, {
      ok: true,
      port: PORT,
      apiVersion: API_VERSION,
      vtgPlaywright: true,
      deployEnabled: Boolean(process.env.REFRESH_TOKEN),
      lastDeploy,
    });
    return;
  }

  if (url.pathname === "/refresh" || url.pathname === "/deploy") {
    if (!authOk(url)) {
      sendJson(res, 401, { ok: false, error: "Invalid or missing token" });
      return;
    }
    try {
      const result =
        url.pathname === "/deploy"
          ? await handleDeploy(url)
          : await (async () => {
              const slug = url.searchParams.get("slug");
              if (!slug) return { ok: false, error: "Missing ?slug=" };
              const r = await refreshSlug(slug, {
                vtg: url.searchParams.get("vtg") !== "0",
                agencies: url.searchParams.get("agencies") === "1",
              });
              rebuildHtml();
              return { ...r, htmlRebuilt: true };
            })();
      sendJson(res, result.ok === false ? 404 : 200, result);
    } catch (e) {
      sendJson(res, 500, { ok: false, error: e.message });
    }
    return;
  }

  sendJson(res, 404, { ok: false, error: "Use /health, /refresh?slug=, /deploy?region=" });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Price server http://127.0.0.1:${PORT}`);
  console.log("VTG first time: npm run vtg-login");
  if (process.env.REFRESH_TOKEN) console.log("REFRESH_TOKEN set — required on /refresh and /deploy");
  console.log(`Deploy: curl "http://127.0.0.1:${PORT}/deploy?region=all&token=YOUR_TOKEN"`);
});
