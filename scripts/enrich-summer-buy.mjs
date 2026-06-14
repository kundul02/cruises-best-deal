#!/usr/bin/env node
/** Enrich summer-med JSON with buyOptions (vendors + prices) from Cruisello /go/ pages */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parseGoPage, parseCabinHeaders } from "./lib/parse-go-page.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const jsonPath = path.join(root, "research", "summer-med-july-2026.json");

const TEEN16 = {
  "MSC Cruises": {
    summary: "12–17 лет = взрослый тариф; детская скидка до ~11 лет",
    steps: [
      "В «Купить» → «MSC Cruises (прямо)»",
      "Выберите 3 гостей (не 2!)",
      "3-й гость: возраст 16",
      "Сравните итог с колонкой «€ 3 чел.»",
    ],
    policyUrl: "https://www.msccruises.co.uk/faq",
  },
  "Celebrity Cruises": {
    summary: "16 лет = взрослый; акции 3-го/4-го гостя на некоторых рейсах",
    steps: [
      "Celebrity.com → выберите дату и корабль",
      "3 гостя, возраст 16",
      "Смотрите промо «3rd/4th Guest» в корзине",
    ],
    policyUrl: "https://www.celebritycruises.com/faq",
  },
  "Norwegian Cruise Line": {
    summary: "Kids Sail Free обычно до 12 лет; 16 = взрослый",
    steps: [
      "NCL.com → 3 гостя",
      "Free at Sea / 3rd guest promo в корзине",
      "16 лет без детской скидки",
    ],
    policyUrl: "https://www.ncl.com/faq",
  },
  "Royal Caribbean": {
    summary: "Kids Sail Free до ~12; 16+ взрослый",
    steps: ["RCCL.com → 3 guests → проверьте Kids Sail Free в корзине"],
    policyUrl: "https://www.royalcaribbean.com/faq",
  },
};

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; cruises-best-deal/1.0)" },
  });
  return res.ok ? res.text() : "";
}

function eurNum(s) {
  return s ? Number(String(s).replace(/,/g, "")) : null;
}

function teenInfo(c) {
  const base = TEEN16[c.line] || {
    summary: "16 лет обычно = взрослый тариф",
    steps: ["Откройте сайт линии", "Выберите 3 гостей, возраст 16", "Сравните с ценой 2 взрослых"],
    policyUrl: c.lineUrl,
  };
  let discountHint = "Отдельной детской скидки для 16 лет, скорее всего, нет";
  if (c.thirdGuestDiscount) {
    discountHint = "3-й гость дешевле взрослого — смотрите колонку «€ 3 чел.»";
  } else if (c.price2 && c.price3 && c.pricePP) {
    const thirdPp = c.price3 / 3;
    if (thirdPp < c.pricePP * 0.95) {
      discountHint = `3-й гость ~€${Math.round(thirdPp)}/чел vs €${c.pricePP} — частичная скидка`;
    }
  }
  return { ...base, discountHint };
}

async function main() {
  const raw = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

  for (const c of raw.cruises) {
    const detailUrl = c.cruiselloUrl;
    const [detailHtml, goHtml] = await Promise.all([
      fetchText(detailUrl),
      fetchText(c.bookUrl?.includes("/go/") ? c.bookUrl : `${detailUrl}`),
    ]);

    const cabins2 = parseCabinHeaders(detailHtml, 2);
    if (!c.pricePP && cabins2.find((x) => x.cabin === "Inside")) {
      c.pricePP = cabins2.find((x) => x.cabin === "Inside").pp;
    }
    if (!c.price2 && c.pricePP) c.price2 = c.pricePP * 2;

    const goSource = goHtml.includes("Continue to") ? goHtml : detailHtml;
    c.buyOptions = parseGoPage(goSource, c, cabins2);
    c.teen16 = teenInfo(c);
    console.log(`OK ${c.slug.slice(0, 40)} → ${c.buyOptions.length} vendors`);
    await new Promise((r) => setTimeout(r, 120));
  }

  raw.meta.enrichedAt = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(jsonPath, JSON.stringify(raw, null, 2) + "\n");
  console.log(`Enriched ${raw.cruises.length} cruises`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
