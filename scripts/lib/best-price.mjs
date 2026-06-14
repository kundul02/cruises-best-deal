/** Pick lowest verified price2/price3 from buyOptions and live sources */

export function pickBestOffer(buyOptions, { guests = 2 } = {}) {
  const key = guests === 3 ? "price3" : "price2";
  const priced = (buyOptions || []).filter(
    (o) => o[key] != null && Number.isFinite(o[key]) && !o.manual
  );
  if (!priced.length) return null;
  priced.sort((a, b) => a[key] - b[key]);
  return { ...priced[0], guests, priceKey: key, price: priced[0][key] };
}

export function computeBestPrice(cruise, extraOffers = []) {
  const buyOptions = [...(cruise.buyOptions || []), ...extraOffers];
  const best2 = pickBestOffer(buyOptions, { guests: 2 });
  const best3 = pickBestOffer(buyOptions, { guests: 3 });
  return {
    best2,
    best3,
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
