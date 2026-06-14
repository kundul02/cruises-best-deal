/**
 * Full price refresh: Cruisello + /go/ agencies + VTG (+ optional CD/iCruise Playwright).
 */
import { fetchCruiselloPrices } from "./cruisello-price.mjs";
import { searchVtgPrice, isVtgLineSupported } from "./vtg-search.mjs";
import { computeBestPrice, mergeBuyOption } from "./best-price.mjs";
import { refreshAgencyPrices } from "./agency-search.mjs";

const MANUAL_VENDORS = ["CruiseCompete"];

function trimNote(note) {
  if (!note) return "";
  return note.replace(/( · обновлено \d{4}-\d{2}-\d{2})+/g, "").trim();
}

export async function refreshCruisePrices(
  cruise,
  { vtg = true, go = true, cd = false, icruise = false, agencies = false, debug = false } = {}
) {
  const useCd = agencies || cd;
  const useICruise = agencies || icruise;

  const ts = new Date().toISOString().slice(0, 10);
  const errors = [];

  let live;
  try {
    live = await fetchCruiselloPrices(cruise.cruiselloUrl);
  } catch (e) {
    errors.push({ source: "Cruisello", error: e.message });
    live = { price2: cruise.price2, price3: cruise.price3, fetchedAt: null };
  }

  let buyOptions = (cruise.buyOptions || []).filter(
    (o) => !["Vacations To Go", ...MANUAL_VENDORS].includes(o.vendor)
  );

  buyOptions.forEach((o) => {
    if (/Cruisello|прямо|Inside|Oceanview|Balcony|Suite/i.test(o.vendor) && live.price2) {
      o.price2 = live.price2;
      o.price3 = live.price3;
      o.verifiedAt = ts;
      o.note = trimNote(o.note) + " · обновлено " + ts;
    }
  });

  for (const cab of live.cabinOffers || []) {
    buyOptions = mergeBuyOption(buyOptions, { ...cab, verifiedAt: ts });
  }

  buyOptions = mergeBuyOption(buyOptions, {
    vendor: "Cruisello",
    url: cruise.cruiselloUrl,
    price2: live.price2,
    price3: live.price3,
    note: "inside, live fetch",
    verifiedAt: ts,
  });

  if (live.bookUrl) {
    cruise = { ...cruise, bookUrl: live.bookUrl };
  }

  let agencyResult = { agencies: {} };
  if (go || useCd || useICruise) {
    try {
      agencyResult = await refreshAgencyPrices(cruise, buyOptions, {
        go,
        cd: useCd,
        icruise: useICruise,
      });
      buyOptions = agencyResult.buyOptions;
      if (agencyResult.agencies?.cd?.needsLogin) {
        errors.push({ source: "CruiseDirect", needsLogin: true });
      }
      if (agencyResult.agencies?.cd?.error && !agencyResult.agencies?.cd?.ok) {
        errors.push({ source: "CruiseDirect", error: agencyResult.agencies.cd.error });
      }
      if (agencyResult.agencies?.icruise?.error && !agencyResult.agencies?.icruise?.ok) {
        errors.push({ source: "iCruise", error: agencyResult.agencies.icruise.error });
      }
    } catch (e) {
      errors.push({ source: "Agencies", error: e.message });
    }
  }

  let vtgResult = { ok: false, skipped: true };
  if (vtg && isVtgLineSupported(cruise.line)) {
    vtgResult = await searchVtgPrice(cruise, { headless: true, debug });
    if (vtgResult.ok) {
      buyOptions = mergeBuyOption(buyOptions, vtgResult);
    } else if (vtgResult.needsLogin) {
      buyOptions = mergeBuyOption(buyOptions, {
        vendor: "Vacations To Go",
        url: "https://www.vacationstogo.com/login.cfm",
        price2: null,
        price3: null,
        manual: true,
        note: "Нужен вход VTG: npm run vtg-login",
        verifiedAt: null,
      });
      errors.push({ source: "VTG", needsLogin: true });
    } else {
      buyOptions = mergeBuyOption(buyOptions, {
        vendor: "Vacations To Go",
        url: "https://www.vacationstogo.com/custom.cfm",
        price2: null,
        manual: true,
        note: vtgResult.error || "не найдено на VTG",
        verifiedAt: null,
      });
      if (vtgResult.error) errors.push({ source: "VTG", error: vtgResult.error });
    }
  } else if (vtg) {
    buyOptions = mergeBuyOption(buyOptions, {
      vendor: "Vacations To Go",
      url: "https://www.vacationstogo.com/custom.cfm",
      price2: null,
      price3: null,
      manual: true,
      vtgStatus: "unavailable",
      note: `${cruise.line} не продаётся на Vacations To Go (VTG US)`,
      verifiedAt: null,
    });
    vtgResult = { ok: false, skipped: true, reason: "line not on VTG US" };
  }

  buyOptions = mergeBuyOption(buyOptions, {
    vendor: "CruiseCompete",
    url: "https://www.cruisecompete.com/",
    price2: null,
    manual: true,
    note: "котировка по email",
    verifiedAt: null,
    hidden: true,
  });

  const bestPrice = computeBestPrice({ ...cruise, buyOptions });

  const patch = {
    price2: live.price2,
    price3: live.price3,
    pricePP: live.pricePP,
    cabin3Note: live.cabin3Note,
    bookUrl: live.bookUrl || cruise.bookUrl,
    buyOptions,
    lastRefreshed: live.fetchedAt || new Date().toISOString(),
    bestPrice2: bestPrice.best2
      ? { vendor: bestPrice.best2.vendor, price: bestPrice.best2.price, url: bestPrice.best2.url }
      : null,
    bestPrice3: bestPrice.best3
      ? { vendor: bestPrice.best3.vendor, price: bestPrice.best3.price, url: bestPrice.best3.url }
      : null,
    bestPriceAt: ts,
  };

  return {
    ok: true,
    slug: cruise.slug,
    live,
    vtg: vtgResult,
    agencies: agencyResult.agencies,
    bestPrice,
    patch,
    errors,
    message: buildMessage(bestPrice, vtgResult, agencyResult.agencies, errors),
  };
}

function buildMessage(bestPrice, vtgResult, agencies, errors) {
  const parts = [];
  if (bestPrice.best2) {
    parts.push(`Лучшая 2 чел.: ${bestPrice.best2.vendor} €${bestPrice.best2.price}`);
  }
  if (agencies?.go?.ok) parts.push("/go/ ссылки обновлены");
  if (agencies?.cd?.ok) parts.push(`CruiseDirect $${agencies.cd.price2}`);
  if (agencies?.icruise?.ok) parts.push(`iCruise $${agencies.icruise.price2}`);
  if (agencies?.cd?.needsLogin) parts.push("CruiseDirect: npm run cd-login");
  if (vtgResult.needsLogin) parts.push("VTG: выполните npm run vtg-login один раз");
  if (vtgResult.skipped && vtgResult.reason) parts.push(`VTG: ${vtgResult.reason}`);
  if (errors.length && !vtgResult.needsLogin) {
    const extra = errors
      .filter((e) => e.source !== "VTG" || !vtgResult.needsLogin)
      .map((e) => `${e.source}: ${e.error || "login"}`)
      .join("; ");
    if (extra) parts.push(extra);
  }
  return parts.join(" · ") || "Cruisello обновлён";
}
