/**
 * Re-fetch Cruisello for a region (fetch scripts merge + mark new slugs).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "../..");

export const DISCOVER_SCRIPTS = {
  med: "scripts/fetch-summer-med.mjs",
  north: "scripts/fetch-north-aug-2026.mjs",
  transatlantic: "scripts/fetch-transatlantic-fall.mjs",
};

export const DISCOVER_FILES = {
  med: path.join(root, "research", "summer-med-july-2026.json"),
  north: path.join(root, "research", "north-aug-2026.json"),
  transatlantic: path.join(root, "research", "transatlantic-fall-2026.json"),
};

/**
 * @param {"med"|"north"|"transatlantic"} regionId
 */
export function discoverRegion(regionId) {
  const script = DISCOVER_SCRIPTS[regionId];
  const filePath = DISCOVER_FILES[regionId];
  if (!script || !filePath) {
    return { ok: false, error: "Unknown region: " + regionId };
  }

  const before = fs.existsSync(filePath)
    ? JSON.parse(fs.readFileSync(filePath, "utf8")).cruises.length
    : 0;

  execSync(`node ${script}`, { cwd: root, stdio: "pipe", timeout: 900_000 });

  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const addedCount = data.meta?.lastDiscoverAdded ?? 0;

  return {
    ok: true,
    region: regionId,
    total: data.cruises.length,
    before,
    addedCount,
    added: data.cruises.filter((c) => c.discoveredAt === new Date().toISOString().slice(0, 10)),
  };
}

export function discoverAll() {
  const results = [];
  let totalAdded = 0;
  for (const regionId of Object.keys(DISCOVER_SCRIPTS)) {
    const r = discoverRegion(regionId);
    results.push(r);
    if (r.ok) totalAdded += r.addedCount;
  }
  return { ok: true, totalAdded, results };
}
