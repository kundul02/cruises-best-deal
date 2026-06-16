/** Merge fresh Cruisello fetch with existing cruise records (preserve enrichments). */

const PRESERVE_KEYS = [
  "buyOptions",
  "bestPrice2",
  "bestPrice3",
  "lastRefreshed",
  "vtgBatchAt",
  "goBatchAt",
  "discoveredAt",
  "family17",
  "teen16",
  "familyNote",
  "childNote",
  "hasChildPromo",
  "hasThirdGuestPromo",
];

export function mergeCruise(fresh, previous) {
  if (!previous) return fresh;
  const merged = { ...fresh };
  for (const key of PRESERVE_KEYS) {
    if (previous[key] == null) continue;
    if (key === "buyOptions" && !previous.buyOptions?.length) continue;
    merged[key] = previous[key];
  }
  if (previous.discoveredAt) merged.discoveredAt = previous.discoveredAt;
  return merged;
}

/**
 * Replace inventory with fetched list; merge per slug; mark new slugs.
 * @returns {{ cruises: object[], added: object[], addedCount: number, removed: number }}
 */
export function mergeCruiseInventory(previousCruises, fetchedCruises) {
  const bySlug = new Map(previousCruises.map((c) => [c.slug, c]));
  const today = new Date().toISOString().slice(0, 10);
  const fetchedSlugs = new Set(fetchedCruises.map((c) => c.slug));
  const added = [];

  const cruises = fetchedCruises.map((c) => {
    const prev = bySlug.get(c.slug);
    if (!prev) {
      const out = { ...c, discoveredAt: today };
      added.push({
        slug: c.slug,
        ship: c.ship,
        line: c.line,
        sailDate: c.sailDate,
        port: c.port,
        price2: c.price2,
      });
      return out;
    }
    return mergeCruise(c, prev);
  });

  const removed = previousCruises.filter((c) => !fetchedSlugs.has(c.slug)).length;
  return { cruises, added, addedCount: added.length, removed };
}
