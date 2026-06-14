/**
 * Vacations To Go — batch-friendly search (shared browser session).
 */
import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";
import { vtgLineName, normalizeShip } from "./vtg-lines.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const VTG_PROFILE_DIR = path.join(__dirname, "..", "..", ".playwright-vtg-profile");
const CUSTOM_URL = "https://www.vacationstogo.com/custom.cfm";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function parseMoney(s) {
  if (!s) return null;
  const m = String(s).replace(/[^\d.,]/g, "").replace(/,/g, "");
  const n = Number(m);
  return Number.isFinite(n) ? n : null;
}

function sailParts(isoDate) {
  const [y, mo, d] = isoDate.split("-").map(Number);
  return { monthLabel: `${MONTH_NAMES[mo - 1]} ${y}`, day: d };
}

async function selectByText(page, selectId, text, { partial = true, optional = false } = {}) {
  const ok = await page.evaluate(
    ({ selectId, text, partial }) => {
      const sel = document.getElementById(selectId);
      if (!sel) return { ok: false, err: "no select " + selectId };
      const t = text.toLowerCase();
      for (const opt of sel.options) {
        const label = opt.text.trim();
        if (!opt.value || /^(choose|any|minimum|maximum|from month|to month|exclude)/i.test(label)) continue;
        const match = partial
          ? label.toLowerCase().includes(t) || t.includes(label.toLowerCase())
          : label.toLowerCase() === t;
        if (match) {
          sel.value = opt.value;
          sel.dispatchEvent(new Event("change", { bubbles: true }));
          return { ok: true, picked: label };
        }
      }
      return { ok: false, err: "no option for " + text };
    },
    { selectId, text, partial }
  );
  if (!ok.ok) {
    if (optional) return null;
    throw new Error(`select ${selectId}: ${ok.err}`);
  }
  await page.waitForTimeout(300);
  return ok;
}

/** Pick closest numeric night option (VTG dropdown may not have exact value) */
async function selectNight(page, selectId, nights) {
  const ok = await page.evaluate(
    ({ selectId, nights }) => {
      const sel = document.getElementById(selectId);
      if (!sel) return { ok: false };
      let best = null;
      let bestDiff = Infinity;
      for (const opt of sel.options) {
        const n = parseInt(opt.text, 10);
        if (!n) continue;
        const diff = Math.abs(n - nights);
        if (diff < bestDiff) {
          bestDiff = diff;
          best = opt;
        }
      }
      if (!best) return { ok: false };
      sel.value = best.value;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      return { ok: true, picked: best.text };
    },
    { selectId, nights }
  );
  if (!ok.ok) return null;
  await page.waitForTimeout(300);
  return ok;
}

function portQuery(port, country) {
  const map = {
    Bremerhaven: "Bremerhaven, Germany",
    Hamburg: "Hamburg, Germany",
    Kiel: "Kiel, Germany",
    Warnemünde: "Warnemunde, Germany",
    Copenhagen: "Copenhagen, Denmark",
    Barcelona: "Barcelona, Spain",
    Cannes: "Cannes, France",
    Marseille: "Marseille, France",
    Genoa: "Genoa, Italy",
    Southampton: "Southampton, England",
    Amsterdam: "Amsterdam, Netherlands",
    Stockholm: "Stockholm, Sweden",
    Helsinki: "Helsinki, Finland",
    Bergen: "Bergen, Norway",
    Valencia: "Valencia, Spain",
    Lisbon: "Lisbon, Portugal",
    Venice: "Venice, Italy",
    Naples: "Naples, Italy",
    Istanbul: "Istanbul, Turkey",
    Civitavecchia: "Civitavecchia (Rome), Italy",
  };
  if (map[port]) return map[port];
  if (country) return `${port}, ${country}`;
  return port;
}

/** Parse ticker/custom results row → per-person inside + deal id */
export function parseVtgTickerRow(text, cruise) {
  const shipNeedle = normalizeShip(cruise.ship).toLowerCase();
  if (!text.toLowerCase().includes(shipNeedle.split(" ").pop())) return null;

  const dealM = text.match(/#(\d+)/);
  const dateM = text.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
  const prices = [...text.matchAll(/\$\s*([\d,]+)/g)].map((m) => Number(m[1].replace(/,/g, "")));
  if (!prices.length) return null;

  const target = new Date(cruise.sailDate + "T12:00:00");
  if (dateM) {
    const [mo, da, yr] = dateM[1].split("/").map(Number);
    const y = yr < 100 ? yr + 2000 : yr;
    const d = new Date(y, mo - 1, da);
    if (Math.abs(d - target) > 4 * 86400000) return null;
  }

  const pp = prices.length >= 2 ? prices[prices.length - 1] : prices[0];
  const dealId = dealM?.[1];
  return {
    pricePP: pp,
    price2: pp * 2,
    price3: pp * 2 + pp,
    price3Est: true,
    dealId,
    url: dealId ? `https://www.vacationstogo.com/fastdeal.cfm?deal=${dealId}` : CUSTOM_URL,
    currency: "USD",
    date: dateM?.[1],
  };
}

export async function createVtgBrowser({ headless = true } = {}) {
  const context = await chromium.launchPersistentContext(VTG_PROFILE_DIR, {
    headless,
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = context.pages()[0] || (await context.newPage());
  return { context, page };
}

/** VTG magic-link login: email + Go (no password). Set VTG_EMAIL in .env */
export function vtgEmail() {
  return process.env.VTG_EMAIL?.trim() || "";
}

export async function tryVtgEmailLogin(page, { timeout = 25000 } = {}) {
  const email = vtgEmail();
  if (!email || !page.url().includes("login")) return false;

  const clicked = await page.evaluate((em) => {
    const emailInput =
      document.querySelector('input[type="email"]') ||
      document.querySelector('input[name*="email" i]') ||
      document.querySelector("#Email") ||
      document.querySelector('input[name="Email"]');
    if (!emailInput) return { ok: false, err: "no email field" };

    emailInput.focus();
    emailInput.value = em;
    emailInput.dispatchEvent(new Event("input", { bubbles: true }));
    emailInput.dispatchEvent(new Event("change", { bubbles: true }));

    const goBtn = [...document.querySelectorAll("input[type=submit], button, a")].find((el) =>
      /^(go|enter|log in|login|submit)$/i.test(String(el.value || el.textContent || "").trim())
    );
    if (!goBtn) return { ok: false, err: "no Go button" };
    goBtn.click();
    return { ok: true };
  }, email);

  if (!clicked.ok) return false;

  await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout }).catch(() => null);
  await page.waitForTimeout(1500);
  return !page.url().includes("login.cfm");
}

async function ensureVtgAccess(page, { timeout = 90000 } = {}) {
  if (!page.url().includes("login.cfm")) return true;
  if (await tryVtgEmailLogin(page, { timeout })) {
    await page.goto(CUSTOM_URL, { waitUntil: "domcontentloaded", timeout });
  }
  return !page.url().includes("login.cfm");
}

export async function fetchVtgPrices(page, cruise, { timeout = 90000 } = {}) {
  const line = vtgLineName(cruise.line);
  const ship = normalizeShip(cruise.ship);
  const { monthLabel, day } = sailParts(cruise.sailDate);
  const dep = portQuery(cruise.port, cruise.country);
  const minN = Math.max(3, cruise.nights - 1);
  const maxN = cruise.nights + 1;

  await page.goto(CUSTOM_URL, { waitUntil: "domcontentloaded", timeout });

  if (!(await ensureVtgAccess(page, { timeout }))) {
    return {
      ok: false,
      needsLogin: true,
      vendor: "Vacations To Go",
      error: vtgEmail() ? "VTG login failed — проверьте VTG_EMAIL" : "Задайте VTG_EMAIL в .env или npm run vtg-login",
    };
  }

  try {
    await selectByText(page, "RegionID", "Europe", { partial: true, optional: true });
  } catch {
    /* optional */
  }

  await selectByText(page, "LineID", line, { partial: true, optional: true });
  await page.waitForTimeout(400);
  await selectByText(page, "ShipID", ship, { partial: true });
  await selectByText(page, "SMonth", monthLabel, { partial: false });
  await selectByText(page, "SDay", String(day), { partial: false });
  await selectByText(page, "TMonth", monthLabel, { partial: false });
  await selectByText(page, "TDay", String(day), { partial: false });
  if (!(await selectByText(page, "MinDay", String(minN), { partial: false, optional: true }))) {
    await selectNight(page, "MinDay", minN);
  }
  if (!(await selectByText(page, "MaxDay", String(maxN), { partial: false, optional: true }))) {
    await selectNight(page, "MaxDay", maxN);
  }

  try {
    await selectByText(page, "dPortID", dep.split(",")[0], { partial: true, optional: true });
  } catch {
    /* optional */
  }

  await selectByText(page, "Stateroom", "Cheapest overall", { partial: true });

  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout }).catch(() => null),
    page.click("#fabShowMeTheDeals"),
  ]);
  await page.waitForTimeout(2000);

  if (!(await ensureVtgAccess(page, { timeout }))) {
    return { ok: false, needsLogin: true, vendor: "Vacations To Go" };
  }

  const rows = await page.evaluate(() =>
    [...document.querySelectorAll("tr")]
      .map((tr) => tr.innerText.replace(/\s+/g, " ").trim())
      .filter(Boolean)
  );

  let match = null;
  for (const row of rows) {
    match = parseVtgTickerRow(row, cruise);
    if (match) break;
  }

  if (!match) {
    return {
      ok: false,
      vendor: "Vacations To Go",
      error: "Sailing not found on VTG",
      rowCount: rows.length,
    };
  }

  const ts = new Date().toISOString().slice(0, 10);
  return {
    ok: true,
    vendor: "Vacations To Go",
    url: match.url,
    price2: match.price2,
    price3: match.price3,
    price3Est: match.price3Est,
    pricePP: match.pricePP,
    currency: match.currency,
    fastDealId: match.dealId,
    note: `VTG inside · ${match.date || cruise.sailDate} · 2ч $${match.price2} · 3ч $${match.price3}${match.price3Est ? " (оценка +1pp)" : ""}`,
    verifiedAt: ts,
    manual: false,
  };
}

export function isVtgLineSupported(line) {
  const unsupported = ["TUI Cruises", "AIDA"];
  return !unsupported.some((u) => line.includes(u));
}

/** @deprecated use fetchVtgPrices with shared page */
export async function searchVtgPrice(cruise, opts = {}) {
  const { context, page } = await createVtgBrowser(opts);
  try {
    return await fetchVtgPrices(page, cruise, opts);
  } finally {
    await context.close();
  }
}

export async function parseVtgResultsPage(page, cruise) {
  const rows = await page.evaluate(() =>
    [...document.querySelectorAll("tr")].map((tr) => tr.innerText.replace(/\s+/g, " ").trim())
  );
  for (const row of rows) {
    const m = parseVtgTickerRow(row, cruise);
    if (m) {
      return {
        ok: true,
        vendor: "Vacations To Go",
        url: m.url,
        price2: m.price2,
        price3: m.price3,
        pricePP: m.pricePP,
        currency: "USD",
        verifiedAt: new Date().toISOString().slice(0, 10),
        manual: false,
      };
    }
  }
  return { ok: false, error: "not found" };
}
