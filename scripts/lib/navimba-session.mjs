/** phpBB session helpers for navimba.com (cookie jar). */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { NAVIMBA_BASE } from "./navimba.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const NAVIMBA_COOKIE_FILE = path.join(__dirname, "..", "..", ".navimba-cookies.json");

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function parseSetCookie(headers) {
  const jar = {};
  const lines = typeof headers?.getSetCookie === "function" ? headers.getSetCookie() : [];
  for (const line of lines) {
    const part = line.split(";")[0];
    const i = part.indexOf("=");
    if (i > 0) jar[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return jar;
}

export function cookieHeader(jar) {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

export function loadNavimbaCookies() {
  try {
    const data = JSON.parse(fs.readFileSync(NAVIMBA_COOKIE_FILE, "utf8"));
    return data.cookies || null;
  } catch {
    return null;
  }
}

export function saveNavimbaCookies(cookies, user) {
  fs.writeFileSync(
    NAVIMBA_COOKIE_FILE,
    JSON.stringify({ savedAt: new Date().toISOString(), user, cookies }, null, 2) + "\n"
  );
}

export async function fetchNavimbaSession(url, { jar, method = "GET", body, referer } = {}) {
  const cookies = jar || loadNavimbaCookies();
  if (!cookies) throw new Error("No navimba session — run navimba-cursor-login first");

  const res = await fetch(url, {
    method,
    redirect: "follow",
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml",
      Cookie: cookieHeader(cookies),
      ...(referer ? { Referer: referer } : {}),
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body,
  });
  const html = res.ok ? await res.text() : "";
  return { ok: res.ok, status: res.status, html, url: res.url };
}

export async function loginNavimba(user, pass) {
  const jar = {};
  const loginUrl = `${NAVIMBA_BASE}/ucp.php?mode=login`;

  const getRes = await fetch(loginUrl, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    redirect: "follow",
  });
  Object.assign(jar, parseSetCookie(getRes.headers));
  const html = await getRes.text();

  const formToken = html.match(/name="form_token"\s+value="([^"]+)"/)?.[1] || "";
  const sid = html.match(/name="sid"\s+value="([^"]+)"/)?.[1] || "";

  const params = new URLSearchParams({
    username: user,
    password: pass,
    autologin: "1",
    viewonline: "1",
    sid,
    redirect: "./index.php?",
    form_token: formToken,
    login: "Вход",
  });

  const postRes = await fetch(loginUrl, {
    method: "POST",
    redirect: "manual",
    headers: {
      "User-Agent": UA,
      Accept: "text/html",
      Cookie: cookieHeader(jar),
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: loginUrl,
    },
    body: params.toString(),
  });
  Object.assign(jar, parseSetCookie(postRes.headers));

  const idxRes = await fetch(`${NAVIMBA_BASE}/index.php`, {
    headers: { "User-Agent": UA, Cookie: cookieHeader(jar) },
    redirect: "follow",
  });
  const idxHtml = await idxRes.text();
  const loggedIn =
    /mode=logout/i.test(idxHtml) ||
    new RegExp(user.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(idxHtml);

  if (!loggedIn) {
    return { ok: false, error: "Login failed — check credentials or captcha" };
  }

  saveNavimbaCookies(jar, user);

  const searchRes = await fetch(`${NAVIMBA_BASE}/search.php?search_id=active_topics`, {
    headers: { "User-Agent": UA, Cookie: cookieHeader(jar) },
    redirect: "follow",
  });
  const searchHtml = await searchRes.text();
  const searchOk = !/запрещено пользоваться поиском/i.test(searchHtml);

  return { ok: true, user, searchOk, cookies: jar };
}
