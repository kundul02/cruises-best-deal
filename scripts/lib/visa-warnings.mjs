/**
 * Visa rules from research/family-profile.json — UK excluded, CA warning, US required on transatlantic.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const profilePath = path.join(__dirname, "../../research/family-profile.json");

let _profile = null;
function profile() {
  if (!_profile) {
    try {
      _profile = JSON.parse(fs.readFileSync(profilePath, "utf8"));
    } catch {
      _profile = { visaRules: {} };
    }
  }
  return _profile;
}

export const UK_PORTS_RE =
  /\b(Southampton|Dover|Liverpool|Edinburgh|Glasgow|Belfast|Harwich|Portsmouth|Falmouth|Greenock|Invergordon|Holyhead|Tyne|Newcastle|British Isles|London \(Tilbury\)|Tilbury)\b/i;

export const CANADA_PORTS_RE =
  /\b(Quebec|Québec|Montreal|Montréal|Halifax|Sydney \(Nova Scotia\)|Victoria \(BC\)|Vancouver|Saint John|Charlottetown)\b/i;

export const US_PORTS_RE =
  /\b(Brooklyn|New York|Manhattan|NYC|Miami|Fort Lauderdale|Boston|Tampa|Port Canaveral|Bayonne|Cape Liberty|Charleston|Baltimore|Galveston|Los Angeles|San Francisco|Seattle|New Orleans|Honolulu|San Diego|San Juan)\b/i;

export const EU_EMBARK_COUNTRIES = new Set([
  "Germany",
  "Denmark",
  "Netherlands",
  "France",
  "Spain",
  "Italy",
  "Portugal",
  "Turkey",
  "Belgium",
  "Norway",
  "Sweden",
  "Finland",
  "Greece",
  "Malta",
  "Ireland",
]);

/** @param {string} portName */
export function portBlob(cruise) {
  return [cruise.title, cruise.port, cruise.country, ...(cruise.itinerary || [])].join(" ");
}

/** @param {{ title?: string, port?: string, country?: string, itinerary?: string[] }} cruise */
export function hasUkPort(cruise) {
  return UK_PORTS_RE.test(portBlob(cruise));
}

export function hasCanadaPort(cruise) {
  return CANADA_PORTS_RE.test(portBlob(cruise));
}

export function hasUsPort(cruise) {
  return US_PORTS_RE.test(portBlob(cruise));
}

/** Hard exclude — no UK visa/ETA for family */
export function visaExcludeUk(cruise) {
  return hasUkPort(cruise);
}

/** Daughter lacks CA visa per family-profile */
export function visaWarnCanada(cruise) {
  return hasCanadaPort(cruise);
}

/**
 * @returns {{ visaWarning?: string, visaExclude?: boolean, visaNotes?: string }}
 */
export function annotateVisa(cruise, { regionId } = {}) {
  const notes = [];
  if (visaExcludeUk(cruise)) {
    return {
      visaExclude: true,
      visaWarning: "uk",
      visaNotes: "UK-порт в маршруте — исключено (нет UK visa/ETA)",
    };
  }
  if (regionId === "transatlantic" || hasUsPort(cruise)) {
    notes.push("US visa обязательна на борту");
  }
  if (visaWarnCanada(cruise)) {
    notes.push("⚠ Canada: у дочери нет CA visa");
    return {
      visaWarning: "canada",
      visaNotes: notes.join(" · "),
    };
  }
  if (notes.length) return { visaNotes: notes.join(" · ") };
  return {};
}

export function filterVisaSafe(cruises, { hideUk = true, hideCanada = false } = {}) {
  return cruises.filter((c) => {
    if (hideUk && (c.visaExclude || visaExcludeUk(c))) return false;
    if (hideCanada && (c.visaWarning === "canada" || visaWarnCanada(c))) return false;
    return true;
  });
}

export function isWestboundTransatlantic(cruise) {
  if (visaExcludeUk(cruise)) return false;
  const blob = portBlob(cruise);
  if (!hasUsPort(cruise) && !hasCanadaPort(cruise)) return false;
  const embarkEu = EU_EMBARK_COUNTRIES.has(cruise.country || "");
  if (!embarkEu) return false;
  const americasFirst = US_PORTS_RE.test(cruise.port || "") || CANADA_PORTS_RE.test(cruise.port || "");
  if (americasFirst) return false;
  return true;
}
