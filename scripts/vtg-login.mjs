#!/usr/bin/env node
/**
 * VTG login — saves session to .playwright-vtg-profile/
 *
 *   npm run vtg-login
 *
 * VTG uses email-only login (Go, no password). Set VTG_EMAIL in .env for auto-fill.
 */
import { chromium } from "playwright";
import { VTG_PROFILE_DIR, vtgEmail, tryVtgEmailLogin } from "./lib/vtg-search.mjs";
import { loadEnvFile } from "./lib/load-env.mjs";

loadEnvFile();

console.log("VTG login — profile:", VTG_PROFILE_DIR);
const email = vtgEmail();
if (email) console.log("Email из .env:", email);
else console.log("Подсказка: добавьте VTG_EMAIL=… в .env для авто-входа\n");

const context = await chromium.launchPersistentContext(VTG_PROFILE_DIR, {
  headless: false,
  viewport: { width: 1100, height: 900 },
});

const page = context.pages()[0] || (await context.newPage());
await page.goto("https://www.vacationstogo.com/login.cfm", { waitUntil: "domcontentloaded" });

if (email && page.url().includes("login")) {
  const ok = await tryVtgEmailLogin(page);
  if (ok) {
    console.log("✓ Авто-вход по email выполнен");
    await page.goto("https://www.vacationstogo.com/custom.cfm", { waitUntil: "domcontentloaded" });
  }
}

if (!email) {
  console.log("1. Введите email → Go (пароль не нужен)");
  console.log("2. Закройте окно браузера когда custom.cfm открывается\n");
}

await new Promise((resolve) => context.on("close", resolve));

console.log("Сессия сохранена. npm run price-server → кнопка ↻ в HTML");
