/**
 * iCruise.com — Playwright search (no Cloudflare; autocomplete UI).
 */
import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ICRUISE_PROFILE_DIR = path.join(__dirname, "..", "..", ".playwright-icruise-profile");
const HOME = "https://www.icruise.com";

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

export function parseICruiseText(text, cruise) {
  const needle = shipNeedle(cruise.ship).toLowerCase();
  if (!text.toLowerCase().includes(needle.toLowerCase())) return null;

  const target = new Date(cruise.sailDate + "T12:00:00");
  const blob = text.replace(/\s+/g, " ");
  const dateRes = [...blob.matchAll(/([A-Z][a-z]{2,8})\s+(\d{1,2}),?\s+(\d{4})/g)];
  let dateOk = !dateRes.length;
  for (const m of dateRes) {
    const mo = MONTH_NAMES.findIndex((n) => n.startsWith(m[1])) + 1;
    if (!mo) continue;
    const d = new Date(Number(m[3]), mo - 1, Number(m[2]));
    if (Math.abs(d - target) <= 5 * 86400000) {
      dateOk = true;
      break;
    }
  }
  if (!dateOk) return null;

  const prices = [...blob.matchAll(/\$\s*([\d,]+)/g)].map((m) => parseMoney(m[1])).filter(Boolean);
  if (!prices.length) return null;

  const pp = Math.min(...prices);
  return { pricePP: pp, price2: pp * 2, price3: pp * 3, price3Est: true, currency: "USD" };
}

export async function createICruiseBrowser({ headless = true } = {}) {
  const context = await chromium.launchPersistentContext(ICRUISE_PROFILE_DIR, {
    headless,
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = context.pages()[0] || (await context.newPage());
  return { context, page };
}

async function pickAutocomplete(page, placeholder, value) {
  const input = page.locator(`input[placeholder="${placeholder}"]`).first();
  await input.click({ timeout: 8000 });
  await input.fill("");
  await input.fill(value);
  await page.waitForTimeout(1200);
  const option = page.locator(`li:has-text("${value}"), [role="option"]:has-text("${value}")`).first();
  if (await option.count()) {
    await option.click({ timeout: 5000 });
    return true;
  }
  await input.press("Enter").catch(() => null);
  return false;
}

export async function fetchICruisePrices(page, cruise, { timeout = 90000 } = {}) {
  await page.goto(HOME, { waitUntil: "domcontentloaded", timeout });
  await page.waitForTimeout(2000);

  await page.locator('text="Show Advanced Search"').first().click({ timeout: 4000 }).catch(() => null);
  await page.waitForTimeout(500);

  const line = cruise.line.replace(/\s+Line$/i, "").trim();
  const ship = shipNeedle(cruise.ship);
  const [y, mo] = cruise.sailDate.split("-").map(Number);
  const monthLabel = `${MONTH_NAMES[mo - 1].slice(0, 3)} ${y}`;

  await pickAutocomplete(page, "Any Cruise Line", line);
  await pickAutocomplete(page, "Any Ship", ship);
  await pickAutocomplete(page, "Any Month", monthLabel);

  await page.locator('a:has-text("Search")').first().click({ timeout: 8000 }).catch(() => null);
  await page.waitForTimeout(4000);

  const bodyText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").trim());
  const match = parseICruiseText(bodyText, cruise);

  if (!match) {
    return {
      ok: false,
      vendor: "iCruise",
      error: "Sailing not found on iCruise",
      url: page.url(),
    };
  }

  const ts = new Date().toISOString().slice(0, 10);
  return {
    ok: true,
    vendor: "iCruise",
    url: page.url(),
    price2: match.price2,
    price3: match.price3,
    price3Est: match.price3Est,
    pricePP: match.pricePP,
    currency: match.currency,
    note: `iCruise inside · ${cruise.sailDate} · 2ч $${match.price2} · 3ч $${match.price3} (оценка)`,
    verifiedAt: ts,
    manual: false,
  };
}

export async function searchICruisePrice(cruise, opts = {}) {
  const { context, page } = await createICruiseBrowser(opts);
  try {
    return await fetchICruisePrices(page, cruise, opts);
  } finally {
    await context.close();
  }
}
