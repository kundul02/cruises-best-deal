#!/usr/bin/env node
/** Compute dealScore 0–100 for leads in leads-verified.json and BASE_LEADS in HTML. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

export function computeDealScore(lead) {
  let score = 0;
  const ppn = lead.pricePerNight ?? (lead.pricePerPerson && lead.nights ? lead.pricePerPerson / lead.nights : 0);

  if (ppn > 0 && ppn < 70) score += 40;
  else if (ppn < 100) score += 35;
  else if (ppn < 130) score += 28;
  else if (ppn < 160) score += 20;
  else if (ppn < 200) score += 12;
  else score += 5;

  const inc = lead.inclusions || [];
  const incText = inc.join(" ").toLowerCase();
  if (/obc|onboard credit|credit/.test(incText)) score += 6;
  if (/drink|beverage|gratuities/.test(incText)) score += 6;
  if (/airfare|air credit|flight/.test(incText)) score += 6;
  if (/wifi|wi-fi/.test(incText)) score += 4;
  if (/free|discount|2nd guest|3rd|4th|kids sail/.test(incText)) score += 3;

  const nights = lead.nights || 0;
  if (nights >= 12) score += 15;
  else if (nights >= 9) score += 12;
  else if (nights >= 7) score += 8;
  else if (nights >= 5) score += 4;

  if (lead.urgent) score += 10;
  else if (lead.domain === "transatlantic" && nights >= 7) score += 5;

  if (lead.visaWarning === "canada") score -= 15;
  else if (!lead.visaWarning) score += 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function enrichLead(lead) {
  const nights = lead.nights || 1;
  const pricePerPerson = lead.pricePerPerson || 0;
  const pricePerNight = pricePerPerson / nights;
  const priceTotalEstimate = Math.round(pricePerPerson * 2 + pricePerPerson * 0.5);
  const dealScore = computeDealScore({ ...lead, pricePerNight });
  return { pricePerNight: Math.round(pricePerNight * 100) / 100, priceTotalEstimate, dealScore };
}

const verifiedPath = path.join(root, "research", "leads-verified.json");
const verified = JSON.parse(fs.readFileSync(verifiedPath, "utf8"));

for (const [id, entry] of Object.entries(verified.leads || {})) {
  const enriched = enrichLead(entry);
  verified.leads[id] = { ...entry, ...enriched };
}

fs.writeFileSync(verifiedPath, JSON.stringify(verified, null, 2) + "\n");
console.log(`Updated dealScore for ${Object.keys(verified.leads).length} leads.`);
