/**
 * Re-fetch Cruisello for a region, merge with existing JSON, mark new slugs.
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

const PRESERVE_KEYS = [
  "buyOptions",
  "bestPrice2",
  "bestPrice3",
  "lastRefreshed",
  "vtgBatchAt",
  "goBatchAt",
  "discoveredAt",
];

function mergeCruise(fresh, previous) {
  if (!previous) {
    return { ...fresh, discoveredAt: new Date().toISOString().slice(0, 10) };
  }
  const merged = { ...fresh };
  for (const key of PRESERVE_KEYS) {
    if (previous[key] != null && (key === "buyOptions" ? previous.buyOptions?.length : true)) {
      merged[key] = previous[key];
    }
  }
  if (previous.discoveredAt) merged.discoveredAt = previous.discoveredAt;
  return merged;
}

/**
 * @param {"med"|"north"|"transatlantic"} regionId
 */
export function discoverRegion(regionId) {
  const script = DISCOVER_SCRIPTS[regionId];
  const filePath = DISCOVER_FILES[regionId];
  if (!script || !filePath) {
    return { ok: false, error: "Unknown region: " + regionId };
  }

  const previous = fs.existsSync(filePath)
    ? JSON.parse(fs.readFileSync(filePath, "utf8"))
    : { meta: {}, cruises: [] };
  const bySlug = new Map(previous.cruises.map((c) => [c.slug, c]));
  const beforeSlugs = new Set(bySlug.keys());

  execSync(`node ${script}`, { cwd: root, stdio: "pipe", timeout: 600_000 });

  const fetched = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const today = new Date().toISOString().slice(0, 10);
  const added = [];
  const merged = fetched.cruises.map((c) => {
    const prev = bySlug.get(c.slug);
    const isNew = !beforeSlugs.has(c.slug);
    const out = mergeCruise(c, prev);
    if (isNew) {
      out.discoveredAt = today;
      added.push({
        slug: c.slug,
        ship: c.ship,
        line: c.line,
        sailDate: c.sailDate,
        port: c.port,
        price2: c.price2,
      });
    }
    return out;
  });

  const data = {
    meta: {
      ...fetched.meta,
      lastDiscover: new Date().toISOString(),
      lastDiscoverAdded: added.length,
    },
    cruises: merged,
  };
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");

  return {
    ok: true,
    region: regionId,
    total: merged.length,
    before: beforeSlugs.size,
    addedCount: added.length,
    added,
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
