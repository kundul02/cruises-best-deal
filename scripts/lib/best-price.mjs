/** Pick lowest verified price2/price3 from buyOptions (EUR-normalized for USD vendors). */
import { toEur } from "./fx-rates.mjs";

function offerCurrency(offer) {
  if (offer.currency) return offer.currency;
  if (offer.vendor === "Vacations To Go") return "USD";
  return "EUR";
}

function normalizedPrice(offer, key, eurUsd) {
  const val = offer[key];
  if (val == null || !Number.isFinite(val)) return null;
  return toEur(val, offerCurrency(offer), eurUsd);
}

export function pickBestOffer(buyOptions, { guests = 2, eurUsd = 1.08 } = {}) {
  const key = guests === 3 ? "price3" : "price2";
  const priced = (buyOptions || [])
    .filter((o) => o[key] != null && Number.isFinite(o[key]) && !o.manual)
    .map((o) => ({ ...o, _normEur: normalizedPrice(o, key, eurUsd) }))
    .filter((o) => o._normEur != null);
  if (!priced.length) return null;
  priced.sort((a, b) => a._normEur - b._normEur);
  const best = priced[0];
  return { ...best, guests, priceKey: key, price: best[key], normEur: best._normEur };
}

export function computeBestPrice(cruise, extraOffers = [], eurUsd = 1.08) {
  const buyOptions = [...(cruise.buyOptions || []), ...extraOffers];
  const best2 = pickBestOffer(buyOptions, { guests: 2, eurUsd });
  const best3 = pickBestOffer(buyOptions, { guests: 3, eurUsd });
  return {
    best2,
    best3,
    eurUsd,
    verifiedAt: new Date().toISOString(),
  };
}

export function mergeBuyOption(buyOptions, offer) {
  const list = [...(buyOptions || [])];
  const i = list.findIndex((o) => o.vendor === offer.vendor);
  if (i >= 0) {
    const merged = { ...list[i], ...offer };
    if (offer.price2 != null && !offer.manual) {
      merged.manual = false;
      delete merged.steps;
    }
    list[i] = merged;
  } else list.push(offer);
  return list;
}
