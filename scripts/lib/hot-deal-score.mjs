/**
 * HOT — hot-deal score for Europe 2026 table rows.
 * Factors: €/person/night, nights length, cruise line tier, ship class, 3rd-guest promo.
 */

/** Line quality 0–100 (premium / mainstream) */
export const LINE_TIER = {
  "Celebrity Cruises": 88,
  "Royal Caribbean": 85,
  "Norwegian Cruise Line": 82,
  "MSC Cruises": 76,
  "TUI Cruises": 78,
  "Princess Cruises": 84,
  "Holland America Line": 83,
  "Cunard Line": 90,
  "Costa Cruises": 72,
  "AIDA Cruises": 74,
};

function shipTierBonus(ship = "") {
  const s = ship.toLowerCase();
  if (/euribia|icon|edge|apex|beyond|seascape|excel|utopia|star|anthem|quantum/i.test(s)) return 12;
  if (/grandiosa|symphony|harmony|magnifica|silhouette|equinox/i.test(s)) return 7;
  if (/mein schiff/i.test(s)) return 6;
  return 0;
}

export function pricePerPersonNight(c) {
  if (!c.price2 || !c.nights) return null;
  return c.price2 / 2 / c.nights;
}

/** 0–100 composite score within a regional pool */
export function computeHotScore(c, pool) {
  const ppn = pricePerPersonNight(c);
  if (ppn == null) return 0;

  const priced = pool.filter((x) => x.price2 && x.nights);
  const ppns = priced.map((x) => pricePerPersonNight(x));
  const minPpn = Math.min(...ppns);
  const maxPpn = Math.max(...ppns);
  const span = maxPpn - minPpn || 1;
  const priceScore = 38 * (1 - (ppn - minPpn) / span);

  let nightScore = 0;
  if (c.nights >= 12) nightScore = 22;
  else if (c.nights >= 9) nightScore = 18;
  else if (c.nights >= 7) nightScore = 14;
  else if (c.nights >= 5) nightScore = 6;

  const lineScore = (LINE_TIER[c.line] || 70) * 0.18;

  let bonus = shipTierBonus(c.ship);
  if (c.thirdGuestDiscount) bonus += 6;

  const valueRatio = c.nights / ppn;
  const values = priced.map((x) => x.nights / pricePerPersonNight(x));
  const maxVal = Math.max(...values, 1);
  const valueScore = 12 * (valueRatio / maxVal);

  return Math.round(Math.min(100, priceScore + nightScore + lineScore + bonus + valueScore));
}

/**
 * Pick multiple hot deals per region (not just one).
 * @returns {{ hot: Set<string>, scores: Map<string, number> }}
 */
export function computeHotDeals(pool, { minScore = 62, maxCount = 8, minCount = 2, topPct = 0.18 } = {}) {
  const scored = pool
    .filter((c) => c.price2 && c.nights)
    .map((c) => ({ slug: c.slug, score: computeHotScore(c, pool) }))
    .sort((a, b) => b.score - a.score);

  const scores = new Map(scored.map((x) => [x.slug, x.score]));
  const hot = new Set();

  if (!scored.length) return { hot, scores };

  const pctIdx = Math.max(0, Math.floor(scored.length * topPct) - 1);
  const threshold = Math.max(minScore, scored[pctIdx]?.score ?? minScore);
  const cap = Math.min(maxCount, Math.max(minCount, Math.ceil(scored.length * topPct)));

  for (const { slug, score } of scored) {
    if (hot.size >= cap) break;
    if (score >= threshold) hot.add(slug);
  }

  // Always include absolute top 2 if they have reasonable score
  for (const { slug, score } of scored.slice(0, 2)) {
    if (score >= minScore - 5) hot.add(slug);
  }

  return { hot, scores };
}

export function annotateHotDeals(cruises) {
  for (const regionId of ["med", "north"]) {
    const pool = cruises.filter((c) => c.regionId === regionId);
    const { hot, scores } = computeHotDeals(pool);
    for (const c of pool) {
      c.hotScore = scores.get(c.slug) ?? 0;
      c.isHot = hot.has(c.slug);
    }
  }
  return cruises;
}
