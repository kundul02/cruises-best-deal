#!/usr/bin/env node
/** Clean buyOptions notes + fix VTG status; unhide agencies with /go/ deep links */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { isVtgLineSupported } from "./lib/vtg-search.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = [
  path.join(root, "research", "summer-med-july-2026.json"),
  path.join(root, "research", "north-aug-2026.json"),
  path.join(root, "research", "transatlantic-fall-2026.json"),
];

const STATIC_AGENCIES = ["CruiseDirect", "iCruise"];

function isGenericAgencyUrl(vendor, url) {
  if (!url) return true;
  if (vendor === "CruiseDirect") {
    return url === "https://www.cruisedirect.com/" || url === "https://www.cruisedirect.com";
  }
  if (vendor === "iCruise") {
    return url === "https://www.icruise.com/" || url === "https://www.icruise.com";
  }
  return false;
}

for (const file of files) {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const c of data.cruises) {
    c.buyOptions = (c.buyOptions || []).map((o) => {
      const out = { ...o };
      if (out.note) out.note = out.note.replace(/( · обновлено \d{4}-\d{2}-\d{2})+/g, "").trim();
      if (STATIC_AGENCIES.includes(out.vendor) && out.price2 == null) {
        const fromGo = out.source === "cruisello-go" || !isGenericAgencyUrl(out.vendor, out.url);
        if (fromGo) {
          out.note = out.note?.includes("Cruisello") ? out.note : "ссылка Cruisello /go/ · цена на сайте";
          delete out.hidden;
        } else {
          out.note = "не подключено — только ссылка";
          out.hidden = true;
        }
      }
      return out;
    });

    const vtgIdx = c.buyOptions.findIndex((o) => o.vendor === "Vacations To Go");
    if (!isVtgLineSupported(c.line)) {
      const vtg = {
        vendor: "Vacations To Go",
        url: "https://www.vacationstogo.com/custom.cfm",
        price2: null,
        price3: null,
        manual: true,
        vtgStatus: "unavailable",
        note: `${c.line} не продаётся на Vacations To Go (VTG US)`,
        verifiedAt: null,
      };
      if (vtgIdx >= 0) c.buyOptions[vtgIdx] = { ...c.buyOptions[vtgIdx], ...vtg };
      else c.buyOptions.push(vtg);
    } else if (vtgIdx >= 0 && c.buyOptions[vtgIdx].price2 == null) {
      c.buyOptions[vtgIdx].note = c.buyOptions[vtgIdx].note?.includes("Custom Search")
        ? "не найден на VTG — проверьте вручную на custom.cfm"
        : c.buyOptions[vtgIdx].note;
      delete c.buyOptions[vtgIdx].steps;
    }

    const cc = c.buyOptions.find((o) => o.vendor === "CruiseCompete");
    if (cc) {
      cc.note = "котировка по email (1–2 дня)";
      cc.hidden = true;
    }
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
  console.log("Normalized", path.basename(file), data.cruises.length, "cruises");
}
