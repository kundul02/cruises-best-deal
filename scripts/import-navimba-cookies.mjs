#!/usr/bin/env node
/**
 * Import navimba phpBB cookies (from browser DevTools) into .navimba-cookies.json
 *
 *   npm run navimba-import-cookies -- 'phpbb3_xxx_sid=...; phpbb3_xxx_u=...'
 *
 * Or paste Cookie header value from DevTools → Network → any navimba request → Cookie
 */
import { saveNavimbaCookies, NAVIMBA_COOKIE_FILE } from "./lib/navimba-session.mjs";
import { loadEnvFile } from "./lib/load-env.mjs";

loadEnvFile();

const raw = process.argv.slice(2).join(" ").trim();
if (!raw) {
  console.error("Usage: npm run navimba-import-cookies -- '<cookie header>'");
  console.error("Copy from browser: DevTools → Network → navimba.com → Request Headers → Cookie");
  process.exit(1);
}

const cookies = {};
for (const part of raw.split(";")) {
  const p = part.trim();
  const i = p.indexOf("=");
  if (i > 0) cookies[p.slice(0, i).trim()] = p.slice(i + 1).trim();
}

if (Object.keys(cookies).length === 0) {
  console.error("No cookies parsed");
  process.exit(1);
}

const user = process.env.NAVIMBA_USER?.trim() || "unknown";
saveNavimbaCookies(cookies, user);
console.log("Saved", Object.keys(cookies).length, "cookies →", NAVIMBA_COOKIE_FILE);
