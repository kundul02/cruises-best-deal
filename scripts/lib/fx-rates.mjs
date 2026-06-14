/**
 * EUR/USD normalization for cross-vendor price comparison.
 * Uses ECB reference or env override.
 */

const DEFAULT_EUR_USD = 1.08;

let _cached = null;
let _cachedAt = 0;

export async function getEurUsdRate() {
  if (process.env.EUR_USD_RATE) {
    return Number(process.env.EUR_USD_RATE);
  }
  const now = Date.now();
  if (_cached && now - _cachedAt < 86400000) return _cached;
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=EUR&to=USD");
    if (res.ok) {
      const j = await res.json();
      _cached = j.rates?.USD ?? DEFAULT_EUR_USD;
      _cachedAt = now;
      return _cached;
    }
  } catch {
    /* offline */
  }
  _cached = DEFAULT_EUR_USD;
  _cachedAt = now;
  return _cached;
}

/** @returns {number|null} price normalized to EUR */
export function toEur(amount, currency, eurUsd) {
  if (amount == null || !Number.isFinite(amount)) return null;
  const cur = (currency || "EUR").toUpperCase();
  if (cur === "EUR") return amount;
  if (cur === "USD") return amount / eurUsd;
  return amount;
}

export function toUsd(amount, currency, eurUsd) {
  if (amount == null || !Number.isFinite(amount)) return null;
  const cur = (currency || "EUR").toUpperCase();
  if (cur === "USD") return amount;
  if (cur === "EUR") return amount * eurUsd;
  return amount;
}
