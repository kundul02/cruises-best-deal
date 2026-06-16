#!/usr/bin/env node
/** Probe navimba.com — fetch recent cruise deal posts from key threads. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  NAVIMBA_SOURCES,
  fetchNavimba,
  topicLastPageUrl,
  parseTopicPosts,
  parseForumTopics,
  filterDealPosts,
} from "./lib/navimba.mjs";
import { loadNavimbaCookies, fetchNavimbaSession, NAVIMBA_COOKIE_FILE } from "./lib/navimba-session.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, "..", "research", "navimba-latest.json");

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/** Gentle mode: fewer sources, long pauses — avoid Cloudflare IP ban. */
const GENTLE = process.argv.includes("--gentle") || !process.argv.includes("--full");
const DELAY_MS = GENTLE ? 8000 : 3000;
const SOURCES = GENTLE
  ? NAVIMBA_SOURCES.filter((s) => s.id === "deals-main" || s.id === "deals-2026")
  : NAVIMBA_SOURCES;

async function main() {
  const results = {
    fetchedAt: new Date().toISOString(),
    mode: GENTLE ? "gentle" : "full",
    delayMs: DELAY_MS,
    sources: [],
    dealPosts: [],
  };

  // Preflight: use saved Chrome/session cookies if available
  const jar = loadNavimbaCookies();
  if (jar) {
    const probe = await fetchNavimbaSession(`${NAVIMBA_SOURCES[0].url}`).catch((e) => ({
      ok: false,
      error: e.message,
    }));
    if (!probe.ok) {
      results.blocked = true;
      results.blockError = probe.error || `HTTP ${probe.status}`;
      fs.writeFileSync(outPath, JSON.stringify(results, null, 2) + "\n");
      console.error(`Session invalid: ${results.blockError}`);
      process.exit(1);
    }
    results.authenticated = true;
    results.cookieFile = NAVIMBA_COOKIE_FILE;
  } else {
    const probe = await fetchNavimba(`${NAVIMBA_SOURCES[0].url}`).catch((e) => ({
      ok: false,
      error: e.message,
    }));
    if (!probe.ok) {
      results.blocked = true;
      results.blockError = probe.error || `HTTP ${probe.status}`;
      fs.writeFileSync(outPath, JSON.stringify(results, null, 2) + "\n");
      console.error(`Blocked or unreachable: ${results.blockError}`);
      console.error("Run: python3 scripts/export-chrome-navimba-cookies.py (logged into Chrome)");
      process.exit(1);
    }
  }
  await delay(DELAY_MS);

  for (const src of SOURCES) {
    const url =
      src.kind === "topic" ? topicLastPageUrl(src.topicId) : src.url;
    process.stderr.write(`Fetching ${src.id}: ${url}\n`);

    let res;
    try {
      res = jar
        ? await fetchNavimbaSession(url)
        : await fetchNavimba(url);
    } catch (err) {
      results.sources.push({ ...src, ok: false, error: err.message });
      await delay(2000);
      continue;
    }

    if (!res.ok) {
      results.sources.push({ ...src, ok: false, status: res.status });
      await delay(2000);
      continue;
    }

    if (src.kind === "topic") {
      const posts = parseTopicPosts(res.html);
      const deals = filterDealPosts(posts);
      results.sources.push({
        ...src,
        ok: true,
        postsOnPage: posts.length,
        dealPostsOnPage: deals.length,
      });
      for (const p of deals.slice(-5)) {
        results.dealPosts.push({ source: src.id, sourceTitle: src.title, ...p });
      }
    } else {
      const topics = parseForumTopics(res.html);
      const dealTopics = topics.filter((t) =>
        /скид|деш[её]в|акци|спецпредл|цена|отдам кают|попутчик/i.test(t.title)
      );
      results.sources.push({
        ...src,
        ok: true,
        topicsOnPage: topics.length,
        dealTopics: dealTopics.slice(0, 10),
      });
    }

    await delay(DELAY_MS);
  }

  results.dealPosts.sort((a, b) => a.datetime.localeCompare(b.datetime));
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2) + "\n");

  console.log(JSON.stringify(results, null, 2));
  console.error(`\nSaved → ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
