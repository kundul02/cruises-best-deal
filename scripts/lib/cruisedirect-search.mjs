/**
 * CruiseDirect — Playwright price search (Cloudflare; needs headed login once).
 */
import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CD_PROFILE_DIR = path.join(__dirname, "..", "..", ".playwright-cd-profile");
const SEARCH_URL = "https://www.cruisedirect.com/search-results";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function parseMoney(s) {
  if (!s) return null;
  const n = Number(String(s).replace(/[^\d.,]/g, "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function shipNeedle(ship) {
  return ship.replace(/^MSC\s+/i, "").replace(/^Norwegian\s+/i, "").trim();
}

function sailLabel(isoDate) {
  const [y, mo, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, mo - 1, d);
  const wd = dt.toLocaleDateString("en-US", { weekday: "short" });
  const mon = MONTH_NAMES[mo - 1].slice(0, 3);
  return `${mon} ${d}, ${y}`.replace(/\s+/g, " ");
}

export function parseCruiseDirectText(text, cruise) {
  const needle = shipNeedle(cruise.ship).toLowerCase();
  if (!text.toLowerCase().includes(needle)) return null;

  const target = new Date(cruise.sailDate + "T12:00:00");
  const datePatterns = [...text.matchAll(/([A-Z][a-z]{2,8})\s+(\d{1,2}),?\s+(\d{4})/g)];
  let dateOk = !datePatterns.length;
  for (const m of datePatterns) {
    const mo = MONTH_NAMES.findIndex((n) => n.startsWith(m[1])) + 1;
    if (!mo) continue;
    const d = new Date(Number(m[3]), mo - 1, Number(m[2]));
    if (Math.abs(d - target) <= 5 * 86400000) {
      dateOk = true;
      break;
    }
  }
  if (!dateOk) return null;

  const prices = [...text.matchAll(/\$\s*([\d,]+)/g)].map((m) => parseMoney(m[1])).filter(Boolean);
  if (!prices.length) return null;

  const pp = Math.min(...prices);
  return { pricePP: pp, price2: pp * 2, price3: pp * 3, price3Est: true, currency: "USD" };
}

export async function createCdBrowser({ headless = true } = {}) {
  const context = await chromium.launchPersistentContext(CD_PROFILE_DIR, {
    headless,
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = context.pages()[0] || (await context.newPage());
  return { context, page };
}

async function isCloudflare(page) {
  const title = await page.title();
  return /just a moment|attention required/i.test(title);
}

/** Filter search UI on cruisedirect.com/search-results */
export async function fetchCruiseDirectPrices(page, cruise, { timeout = 90000 } = {}) {
  await page.goto(SEARCH_URL, { waitUntil: "domcontentloaded", timeout });
  await page.waitForTimeout(2500);

  if (await isCloudflare(page)) {
    return { ok: false, needsLogin: true, vendor: "CruiseDirect", error: "Cloudflare — npm run cd-login" };
  }

  const line = cruise.line.replace(/\s+Line$/i, "").trim();
  const ship = shipNeedle(cruise.ship);
  const [y, mo] = cruise.sailDate.split("-").map(Number);
  const monthYear = `${MONTH_NAMES[mo - 1]} ${y}`;

  try {
    // Open filters if collapsed
    await page.locator('text=/All Filters|Filter/i').first().click({ timeout: 4000 }).catch(() => null);
    await page.waitForTimeout(800);

    // Cruise line filter
    const lineFilter = page.locator('text=/Cruise Line|Select Cruise Line/i').first();
    await lineFilter.click({ timeout: 5000 }).catch(() => null);
    await page.locator(`text="${line}"`).first().click({ timeout: 8000 }).catch(() => null);
    await page.waitForTimeout(600);

    // Ship filter
    await page.locator('text=/Ship|Select Ship/i').first().click({ timeout: 5000 }).catch(() => null);
    await page.locator(`text="${ship}"`).first().click({ timeout: 8000 }).catch(() => null);
    await page.waitForTimeout(600);

    // Month / date
    await page.locator('text=/Departure Date|Date Range/i').first().click({ timeout: 5000 }).catch(() => null);
    await page.locator(`text="${monthYear}"`).first().click({ timeout: 8000 }).catch(() => null);
    await page.waitForTimeout(1500);
  } catch {
    /* filters vary — fall through to text scan */
  }

  const bodyText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").trim());
  const match = parseCruiseDirectText(bodyText, cruise);

  if (!match) {
    return {
      ok: false,
      vendor: "CruiseDirect",
      error: "Sailing not found on CruiseDirect",
      snippet: bodyText.slice(0, 200),
    };
  }

  const ts = new Date().toISOString().slice(0, 10);
  return {
    ok: true,
    vendor: "CruiseDirect",
    url: SEARCH_URL,
    price2: match.price2,
    price3: match.price3,
    price3Est: match.price3Est,
    pricePP: match.pricePP,
    currency: match.currency,
    note: `CruiseDirect inside · ${sailLabel(cruise.sailDate)} · 2ч $${match.price2} · 3ч $${match.price3} (оценка)`,
    verifiedAt: ts,
    manual: false,
  };
}

export async function searchCruiseDirectPrice(cruise, opts = {}) {
  const { context, page } = await createCdBrowser(opts);
  try {
    return await fetchCruiseDirectPrices(page, cruise, opts);
  } finally {
    await context.close();
  }
}
