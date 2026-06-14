#!/usr/bin/env node
/** Enrich transatlantic JSON with buyOptions from Cruisello /go/ */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parseGoPage, parseCabinHeaders } from "./lib/parse-go-page.mjs";

const jsonPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "research", "transatlantic-fall-2026.json");

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; cruises-best-deal/1.0)" },
  });
  return res.ok ? res.text() : "";
}

function familyInfo(c) {
  return {
    summary: "Дочка 17 лет — взрослый; US visa обязательна на transatlantic",
    steps: [
      "Бронируйте 3 взрослых",
      "Сравните € 2 чел. и € 3 чел.",
      "Проверьте CA порты — у дочери нет CA visa",
    ],
    discountHint: c.thirdGuestDiscount ? "3-й гость дешевле" : "17 лет = взрослый тариф",
    policyUrl: c.lineUrl,
  };
}

async function main() {
  const raw = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

  for (const c of raw.cruises) {
    const detailUrl = c.cruiselloUrl;
    const [detailHtml, goHtml] = await Promise.all([
      fetchText(detailUrl),
      fetchText(c.bookUrl?.includes("/go/") ? c.bookUrl : detailUrl),
    ]);

    const cabins2 = parseCabinHeaders(detailHtml, 2);
    if (!c.pricePP && cabins2.find((x) => x.cabin === "Inside")) {
      c.pricePP = cabins2.find((x) => x.cabin === "Inside").pp;
    }
    if (!c.price2 && c.pricePP) c.price2 = c.pricePP * 2;

    const goSource = goHtml.includes("Continue to") ? goHtml : detailHtml;
    c.buyOptions = parseGoPage(goSource, c, cabins2);
    c.family17 = familyInfo(c);
    console.log(`OK ${c.slug.slice(0, 45)} → ${c.buyOptions.length} vendors`);
    await new Promise((r) => setTimeout(r, 120));
  }

  raw.meta.enrichedAt = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(jsonPath, JSON.stringify(raw, null, 2) + "\n");
  console.log(`Enriched ${raw.cruises.length} transatlantic cruises`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
