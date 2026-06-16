#!/usr/bin/env node
/**
 * Navimba login — saves phpBB session to .playwright-navimba-profile/
 *
 *   npm run navimba-login
 *
 * Set NAVIMBA_USER and NAVIMBA_PASS in .env (never commit).
 */
import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnvFile } from "./lib/load-env.mjs";

loadEnvFile();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const NAVIMBA_PROFILE_DIR = path.join(__dirname, "..", ".playwright-navimba-profile");

const user = process.env.NAVIMBA_USER?.trim();
const pass = process.env.NAVIMBA_PASS;

if (!user || !pass) {
  console.error("Добавьте NAVIMBA_USER и NAVIMBA_PASS в .env");
  process.exit(1);
}

console.log("Navimba login — profile:", NAVIMBA_PROFILE_DIR);

const context = await chromium.launchPersistentContext(NAVIMBA_PROFILE_DIR, {
  headless: false,
  viewport: { width: 1100, height: 900 },
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  args: ["--disable-http2"],
});

const page = context.pages()[0] || (await context.newPage());

try {
  await page.goto("https://navimba.com/ucp.php?mode=login", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
} catch (err) {
  console.error("Не удалось открыть navimba.com:", err.message);
  console.error("Проверьте VPN — сайт должен открываться в обычном браузере.");
  await context.close();
  process.exit(1);
}

if (page.url().includes("mode=login")) {
  await page.fill('input[name="username"]', user);
  await page.fill('input[name="password"]', pass);
  await page.click('input[type="submit"][name="login"]');
  await page.waitForLoadState("domcontentloaded", { timeout: 30000 });
  await page.waitForTimeout(1500);
}

const loggedIn = (await page.locator('a[href*="mode=logout"]').count()) > 0;
if (loggedIn) {
  console.log("✓ Вход выполнен как", user);
  await page.goto("https://navimba.com/search.php?search_id=active_topics", {
    waitUntil: "domcontentloaded",
  });
  const title = await page.title();
  if (/запрещ|information|информация/i.test(title)) {
    console.log("⚠ Поиск всё ещё недоступен:", title);
  } else {
    console.log("✓ «Обсуждаем сейчас» доступен");
  }
} else {
  console.log("✗ Не удалось войти — проверьте логин/пароль или закройте окно после ручного входа");
}

console.log("\nЗакройте окно браузера — сессия сохранится в профиле Playwright.");
await new Promise((resolve) => context.on("close", resolve));
console.log("Готово.");
