/** Map Cruisello line names → VTG Custom Search dropdown labels */

export const LINE_TO_VTG = {
  "MSC Cruises": "MSC Cruises",
  "Norwegian Cruise Line": "Norwegian Cruise Line",
  "Royal Caribbean": "Royal Caribbean International",
  "Celebrity Cruises": "Celebrity Cruises",
  "Princess Cruises": "Princess Cruises",
  "Holland America Line": "Holland America Line",
  "Cunard Line": "Cunard Line",
  "Costa Cruises": "Costa Cruises",
  "Celestyal Cruises": "Celestyal Cruises",
  "TUI Cruises": "TUI Cruises",
  "AIDA Cruises": "AIDA",
  "P&O Cruises": "P&O Cruises",
  "Virgin Voyages": "Virgin Voyages",
  "Oceania Cruises": "Oceania Cruises",
  "Regent Seven Seas": "Regent Seven Seas Cruises",
  "Silversea": "Silversea Cruises",
  "Seabourn": "Seabourn",
  "Azamara": "Azamara",
  "Windstar Cruises": "Windstar Cruises",
  "Hurtigruten": "Hurtigruten",
  "Viking Ocean Cruises": "Viking Ocean Cruises",
};

export function vtgLineName(line) {
  if (LINE_TO_VTG[line]) return LINE_TO_VTG[line];
  // fuzzy: VTG option contains our line name
  return line;
}

/** Normalize ship name for matching VTG dropdown / results */
export function normalizeShip(name) {
  return String(name || "")
    .replace(/^MSC\s+/i, "MSC ")
    .replace(/\s+/g, " ")
    .trim();
}
