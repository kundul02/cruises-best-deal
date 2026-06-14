#!/usr/bin/env node
/** Inject research/leads-verified.json into cruises.html as VERIFIED_REGISTRY. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const htmlPath = path.join(root, "cruises.html");
const verified = JSON.parse(
  fs.readFileSync(path.join(root, "research", "leads-verified.json"), "utf8")
);

const registryJson = JSON.stringify(verified.leads || {}, null, 2);
const block = `const VERIFIED_REGISTRY = ${registryJson};\n\nfunction applyVerifiedLead(lead) {
  const v = VERIFIED_REGISTRY[String(lead.id)];
  if (!v) return lead;
  const out = { ...lead };
  for (const key of [
    "summary", "desc", "sailDate", "nights", "pricePerPerson", "pricePerNight",
    "priceTotalEstimate", "currency", "inclusions", "visaNotes", "visaWarning",
    "documents", "dealScore", "closed", "urgent", "tone", "check"
  ]) {
    if (v[key] !== undefined) out[key] = v[key];
  }
  return out;
}\n`;

let html = fs.readFileSync(htmlPath, "utf8");
const start = "// VERIFIED_REGISTRY_START";
const end = "// VERIFIED_REGISTRY_END";

if (!html.includes(start)) {
  html = html.replace(
    "const LEADS = [",
    `${start}\n${block}${end}\n\nconst LEADS = [`
  );
} else {
  html = html.replace(
    new RegExp(`${start}[\\s\\S]*?${end}`),
    `${start}\n${block}${end}`
  );
}

html = html.replace(
  /const LEADS = \[\s*\n\s*\.\.\.BASE_LEADS[\s\S]*?\n\];/,
  `const LEADS = [
  ...BASE_LEADS,
  ...LATEST_FEED.map(mapFeedLead)
].map(applyVerifiedLead);`
);

fs.writeFileSync(htmlPath, html);
const indexPath = path.join(root, "index.html");
if (fs.existsSync(indexPath) || htmlPath) {
  fs.copyFileSync(htmlPath, indexPath);
}
console.log(`Injected ${Object.keys(verified.leads || {}).length} verified entries into HTML.`);
