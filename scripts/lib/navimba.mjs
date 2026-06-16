/** Navimba.com forum — read-only parser for cruise deal threads (phpBB). */

export const NAVIMBA_BASE = "https://navimba.com";

/** Forums and sticky threads worth monitoring for deals. */
export const NAVIMBA_SOURCES = [
  {
    id: "deals-main",
    kind: "topic",
    topicId: 6,
    title: "Дешёвые морские и речные круизы, скидки, акции, спецпредложения",
    url: `${NAVIMBA_BASE}/viewtopic.php?t=6`,
  },
  {
    id: "deals-2026",
    kind: "topic",
    topicId: 10656,
    title: "Дешёвые морские круизы 2026",
    url: `${NAVIMBA_BASE}/viewtopic.php?t=10656`,
  },
  {
    id: "deals-where",
    kind: "topic",
    topicId: 4960,
    title: "Где скидки на круизы",
    url: `${NAVIMBA_BASE}/viewtopic.php?t=4960`,
  },
  {
    id: "cabin-resale",
    kind: "topic",
    topicId: 149,
    title: "Отдам каюту в хорошие руки",
    url: `${NAVIMBA_BASE}/viewtopic.php?t=149`,
  },
  {
    id: "forum-choice",
    kind: "forum",
    forumId: 14,
    title: "Выбор круиза: варианты, маршруты, предложения",
    url: `${NAVIMBA_BASE}/viewforum.php?f=14`,
  },
  {
    id: "forum-booking",
    kind: "forum",
    forumId: 2,
    title: "Покупка и бронирование круизов",
    url: `${NAVIMBA_BASE}/viewforum.php?f=2`,
  },
];

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const DEAL_KEYWORDS =
  /\$|€|USD|EUR|руб\.?|скид|акци|спецпредл|деш[её]в|цена|кают|ноч|night|pp|p\.p\.|чел|человек|transatlantic|трансатл|MSC|Celebrity|Princess|Carnival|Costa|NCL|Royal|Mein Schiff|Seascanner|VTG|vacationstogo/i;

export async function fetchNavimba(url, { timeoutMs = 30000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": UA, Accept: "text/html" },
      redirect: "follow",
    });
    const html = res.ok ? await res.text() : "";
    return { ok: res.ok, status: res.status, html, url };
  } finally {
    clearTimeout(timer);
  }
}

/** Last page of a long topic (phpBB: start=-100). */
export function topicLastPageUrl(topicId) {
  return `${NAVIMBA_BASE}/viewtopic.php?t=${topicId}&start=-100`;
}

export function stripHtml(html) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

export function parseTopicPosts(html) {
  const posts = [];
  const re =
    /<div id="p(\d+)"[\s\S]*?<time datetime="([^"]+)"[\s\S]*?class="username-coloured">([^<]+)<\/(?:span|a)>[\s\S]*?<div class="content">([\s\S]*?)<\/div>/g;
  for (const m of html.matchAll(re)) {
    const [, postId, datetime, author, raw] = m;
    const content = stripHtml(raw);
    if (content.length < 20) continue;
    posts.push({ postId, datetime, author, content, url: `${NAVIMBA_BASE}/viewtopic.php?p=${postId}#p${postId}` });
  }
  return posts;
}

export function parseForumTopics(html) {
  const topics = [];
  const re =
    /<a href="\.\/viewtopic\.php\?t=(\d+)(?:&amp;[^"]*)?" class="topictitle">([^<]+)<\/a>/g;
  for (const m of html.matchAll(re)) {
    topics.push({ topicId: Number(m[1]), title: m[2].trim() });
  }
  return topics;
}

export function isDealPost(content) {
  return DEAL_KEYWORDS.test(content);
}

export function filterDealPosts(posts) {
  return posts.filter((p) => isDealPost(p.content));
}
