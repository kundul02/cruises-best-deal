/**
 * Unified agency refresh: Cruisello /go/ links + CruiseDirect + iCruise Playwright.
 */
import { refreshGoAgencies } from "./fetch-go-page.mjs";
import { mergeBuyOption } from "./best-price.mjs";
import { createCdBrowser, fetchCruiseDirectPrices } from "./cruisedirect-search.mjs";
import { createICruiseBrowser, fetchICruisePrices } from "./icruise-search.mjs";

function applyAgencyResult(buyOptions, result) {
  if (!result) return buyOptions;
  const existing = buyOptions.find((o) => o.vendor === result.vendor);
  if (result.ok) {
    return mergeBuyOption(buyOptions, { ...result, hidden: false });
  }
  return mergeBuyOption(buyOptions, {
    vendor: result.vendor,
    url: result.url || existing?.url,
    price2: null,
    price3: null,
    manual: true,
    note: result.needsLogin
      ? "Cloudflare — npm run cd-login"
      : result.error || "не найдено",
    verifiedAt: null,
    hidden: false,
  });
}

export async function refreshAgencyPrices(cruise, buyOptions, { cd = true, icruise = true, go = true } = {}) {
  let list = [...(buyOptions || [])];
  const results = { go: null, cd: null, icruise: null };

  if (go) {
    const goRes = await refreshGoAgencies(cruise, list);
    list = goRes.buyOptions;
    results.go = goRes.go;
  }

  let cdContext;
  let icContext;
  try {
    if (cd) {
      const { context, page } = await createCdBrowser({ headless: true });
      cdContext = context;
      results.cd = await fetchCruiseDirectPrices(page, cruise);
      list = applyAgencyResult(list, results.cd);
    }
    if (icruise) {
      const { context, page } = await createICruiseBrowser({ headless: true });
      icContext = context;
      results.icruise = await fetchICruisePrices(page, cruise);
      list = applyAgencyResult(list, results.icruise);
    }
  } finally {
    await cdContext?.close().catch(() => null);
    await icContext?.close().catch(() => null);
  }

  return { buyOptions: list, agencies: results };
}
