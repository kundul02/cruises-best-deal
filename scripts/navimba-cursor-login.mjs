#!/usr/bin/env node
/**
 * Navimba login via HTTP (cookie jar) — for Cursor cloud / any network with navimba access.
 * Saves session to .navimba-cookies.json (gitignored).
 *
 *   npm run navimba-cursor-login
 *
 * Credentials: NAVIMBA_USER, NAVIMBA_PASS in .env
 */
import { loadEnvFile } from "./lib/load-env.mjs";
import { loginNavimba, NAVIMBA_COOKIE_FILE } from "./lib/navimba-session.mjs";

loadEnvFile();

const user = process.env.NAVIMBA_USER?.trim();
const pass = process.env.NAVIMBA_PASS;

if (!user || !pass) {
  console.error("Добавьте NAVIMBA_USER и NAVIMBA_PASS в .env");
  process.exit(1);
}

try {
  const result = await loginNavimba(user, pass);
  if (!result.ok) {
    console.error("✗", result.error);
    process.exit(1);
  }
  console.log("✓ Вход выполнен:", result.user);
  console.log(result.searchOk ? "✓ Поиск «Обсуждаем сейчас» доступен" : "⚠ Поиск недоступен");
  console.log("Сессия сохранена →", NAVIMBA_COOKIE_FILE);
} catch (err) {
  const code = err.cause?.code || err.code;
  if (code === "ECONNREFUSED" || code === "ENOTFOUND") {
    console.error("✗ navimba.com недоступен с этого IP (Cloudflare block).");
    console.error("  Cursor-агент может войти через WebFetch + ручной импорт cookies.");
    console.error("  Или смените VPN и повторите.");
  } else {
    console.error("✗", err.message);
  }
  process.exit(1);
}
