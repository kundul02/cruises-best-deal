/** Parse navimba forum deal posts into structured lead-ish objects. */

const SHIP_RE =
  /\b(MSC\s+[\w]+|Celebrity\s+[\w\s]+?|Carnival\s+[\w]+|Royal Caribbean\s+[\w\s]+?|Costa\s+[\w]+|Norwegian\s+[\w]+|Mein Schiff\s+[\w]+|Princess\s+[\w]+|AIDA\s+[\w]*|Azamara\s+[\w]+)\b/i;

const PRICE_RE =
  /(\d[\d\s.,]*)\s*(€|EUR|евро|£|GBP|фунт(?:а|ов)?|\$|USD|долл(?:\.|ар)?(?:ов)?)?(?:\s*\/?\s*(\d+)\s*ноч)/i;

const NIGHTS_RE = /(\d+)\s*(?:ноч|night|nights|койко-ноч)/i;
const PPN_RE = /(\d+)\s*(€|EUR|£|GBP|\$|USD|евро|фунт(?:а|ов)?)\s*(?:за\s*)?(?:койко-ноч|\/\s*ноч|night)/i;

const DATE_RE =
  /(\d{1,2})[\.\/\-](\d{1,2})[\.\/\-](20\d{2})|(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(20\d{2})/i;

const MONTHS = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

const REGION_HINTS = [
  { re: /transatlantic|трансатл|Barcelona.*Port Canaveral|Barcelona.*Orlando|reposition/i, region: "transatlantic" },
  { re: /Norway|Norwegian|фьорд|Nordic|Baltic|Copenhagen|Hamburg|Bremerhaven/i, region: "norway" },
  { re: /Mediterranean|Med\b|Средизем|Barcelona|Marseille|Genoa|Ravenna|Athens|Piraeus|Greece|Turkey|Италия|Испания/i, region: "mediterranean" },
  { re: /Alaska|Аляск|Seattle|Ketchikan|Juneau/i, region: "americas" },
  { re: /Japan|Япон|Tokyo|Токио|Shanghai|Шанхай|Asia|Австрал|Brisbane|Bali|Singapore/i, region: "excluded" },
  { re: /Persian|Персид|Dubai|Дубай|Aroya|Celestyal/i, region: "excluded" },
  { re: /California|Калифорн|Long Beach|Cabo/i, region: "americas" },
];

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseDate(text) {
  const m1 = text.match(/(\d{1,2})[\.\/\-](\d{1,2})[\.\/\-](20\d{2})/);
  if (m1) return `${m1[3]}-${m1[2].padStart(2, "0")}-${m1[1].padStart(2, "0")}`;
  const m2 = text.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(20\d{2})/i);
  if (m2) return `${m2[3]}-${MONTHS[m2[2].slice(0, 3).toLowerCase()]}-${m2[1].padStart(2, "0")}`;
  return null;
}

function guessRegion(text) {
  for (const { re, region } of REGION_HINTS) {
    if (re.test(text)) return region;
  }
  return "unknown";
}

function extractUrls(text) {
  return [...text.matchAll(/https?:\/\/[^\s<>"']+/g)].map((m) => m[0]);
}

export function parseNavimbaLead(post, { priorityRegions = [], excludedRegions = [] } = {}) {
  const content = post.content || "";
  const shipMatch = content.match(SHIP_RE);
  const ship = shipMatch ? shipMatch[1].replace(/\s+/g, " ").trim() : null;

  let price = null;
  let currency = null;
  let nights = null;
  let pricePerNight = null;

  const ppn = content.match(PPN_RE);
  if (ppn) {
    pricePerNight = Number(ppn[1].replace(/\s/g, ""));
    const cur = ppn[2] || "";
    currency = cur.includes("£") || /фунт|GBP/i.test(cur) ? "GBP" : cur.includes("$") || /USD|долл/i.test(cur) ? "USD" : "EUR";
  }

  const priceM = content.match(/(\d[\d\s.,]*)\s*(€|EUR|евро|£|GBP|фунт(?:а|ов)?|\$|USD)(?:\s*\/\s*(\d+)\s*ноч)?/i);
  if (priceM) {
    price = Number(priceM[1].replace(/[\s,]/g, "").replace(",", "."));
    if (!currency) {
      currency = /£|GBP|фунт/i.test(priceM[2]) ? "GBP" : /\$|USD|долл/i.test(priceM[2]) ? "USD" : "EUR";
    }
    if (priceM[3]) nights = Number(priceM[3]);
  }

  const nightsM = content.match(NIGHTS_RE);
  if (nightsM && !nights) nights = Number(nightsM[1]);

  const sailDate = parseDate(content);
  const region = guessRegion(content);
  const priority = priorityRegions.includes(region);
  const excluded = excludedRegions.includes(region) || region === "excluded";

  const urls = extractUrls(content);

  return {
    id: `navimba-${post.postId}`,
    postId: post.postId,
    source: post.source,
    sourceTitle: post.sourceTitle,
    author: post.author,
    datetime: post.datetime,
    url: post.url,
    ship,
    sailDate,
    nights,
    price,
    currency,
    pricePerNight,
    region,
    priority,
    excluded,
    bookingUrls: urls,
    summary: content.length > 280 ? `${content.slice(0, 277)}…` : content,
    raw: content,
  };
}

export function parseNavimbaLeads(data, profile = {}) {
  const priorityRegions = profile.regions?.priority || [];
  const excludedRegions = profile.regions?.excluded || [];
  const posts = data.dealPosts || [];
  const seen = new Set();
  const leads = [];

  for (const post of posts) {
    const key = post.content.slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    leads.push(parseNavimbaLead(post, { priorityRegions, excludedRegions }));
  }

  leads.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority ? -1 : 1;
    if (a.excluded !== b.excluded) return a.excluded ? 1 : -1;
    return (b.datetime || "").localeCompare(a.datetime || "");
  });

  return leads;
}

export { escapeHtml };
