#!/usr/bin/env node
/** One-time: pass CruiseDirect Cloudflare in headed browser → .playwright-cd-profile/ */
import { createCdBrowser } from "./lib/cruisedirect-search.mjs";

console.log("Откроется CruiseDirect. Пройдите Cloudflare / captcha если есть.");
console.log("Когда search-results загрузится нормально — закройте окно браузера.\n");

const { context, page } = await createCdBrowser({ headless: false });
await page.goto("https://www.cruisedirect.com/search-results", { waitUntil: "domcontentloaded" });
await page.waitForEvent("close", { timeout: 0 }).catch(() => null);
await context.close();
console.log("Профиль сохранён в .playwright-cd-profile/");
