/**
 * Cruise port → country labels for itinerary display.
 * Keys: exact port name as in Cruisello JSON.
 */
export const PORT_COUNTRY = {
  // Germany
  Kiel: "Germany",
  Hamburg: "Germany",
  Bremerhaven: "Germany",
  "Warnemünde (Rostock)": "Germany",
  // Denmark
  Copenhagen: "Denmark",
  Aarhus: "Denmark",
  // Norway
  Bergen: "Norway",
  Geiranger: "Norway",
  Flåm: "Norway",
  Hellesylt: "Norway",
  Ålesund: "Norway",
  Oslo: "Norway",
  Kristiansand: "Norway",
  Eidfjord: "Norway",
  Stavanger: "Norway",
  Tromsø: "Norway",
  Trondheim: "Norway",
  Haugesund: "Norway",
  Molde: "Norway",
  Olden: "Norway",
  Skjolden: "Norway",
  Nordfjordeid: "Norway",
  Honningsvåg: "Norway",
  Longyearbyen: "Norway",
  // Sweden
  Stockholm: "Sweden",
  Visby: "Sweden",
  Nynashamn: "Sweden",
  // Finland
  Helsinki: "Finland",
  // Netherlands
  Amsterdam: "Netherlands",
  "IJmuiden (Amsterdam)": "Netherlands",
  Rotterdam: "Netherlands",
  // UK & territories
  Southampton: "UK",
  Dover: "UK",
  Belfast: "UK",
  "Greenock (Glasgow)": "UK",
  Invergordon: "UK",
  "Isle of Portland": "UK",
  Kirkwall: "UK",
  "Leith (Edinburgh)": "UK",
  Stornoway: "UK",
  Gibraltar: "Gibraltar",
  // France
  Cannes: "France",
  Marseille: "France",
  "Villefranche-sur-Mer": "France",
  "Le Havre (Paris)": "France",
  Toulon: "France",
  Ajaccio: "France",
  // Spain
  Barcelona: "Spain",
  Valencia: "Spain",
  "Palma de Mallorca": "Spain",
  Málaga: "Spain",
  Cartagena: "Spain",
  Ibiza: "Spain",
  Tarragona: "Spain",
  Cádiz: "Spain",
  // Italy
  Genoa: "Italy",
  Naples: "Italy",
  "Civitavecchia (Rome)": "Italy",
  Venice: "Italy",
  "Livorno (Florence/Pisa)": "Italy",
  "La Spezia": "Italy",
  Ravenna: "Italy",
  Bari: "Italy",
  Brindisi: "Italy",
  Cagliari: "Italy",
  Olbia: "Italy",
  Palermo: "Italy",
  Messina: "Italy",
  Catania: "Italy",
  Portofino: "Italy",
  "Santa Margherita Ligure": "Italy",
  Ancona: "Italy",
  Trieste: "Italy",
  Salerno: "Italy",
  // Greece
  "Piraeus (Athens)": "Greece",
  Santorini: "Greece",
  Mykonos: "Greece",
  Corfu: "Greece",
  Katakolon: "Greece",
  Syros: "Greece",
  // Portugal
  Lisbon: "Portugal",
  Portimao: "Portugal",
  // Turkey
  Istanbul: "Turkey",
  Kusadasi: "Turkey",
  Marmaris: "Turkey",
  // Croatia & Montenegro
  Dubrovnik: "Croatia",
  Split: "Croatia",
  Kotor: "Montenegro",
  // Malta, Tunisia
  Valletta: "Malta",
  "La Goulette (Tunis)": "Tunisia",
  // Baltic
  Tallinn: "Estonia",
  Riga: "Latvia",
  Klaipeda: "Lithuania",
  "Gdynia (Gdansk)": "Poland",
  // Belgium
  Zeebrugge: "Belgium",
  // Iceland
  Reykjavik: "Iceland",
  Akureyri: "Iceland",
  // Ireland
  Dublin: "Ireland",
  // Americas
  Brooklyn: "USA",
  "New York": "USA",
  Miami: "USA",
  "Fort Lauderdale": "USA",
  Boston: "USA",
  Tampa: "USA",
  Halifax: "Canada",
  Quebec: "Canada",
  Montréal: "Canada",
  Montreal: "Canada",
  Alicante: "Spain",
  Motril: "Spain",
  "Port Mahon": "Spain",
  "Port Canaveral": "USA",
};

/** @param {string} portName */
export function portCountry(portName) {
  if (!portName) return null;
  if (PORT_COUNTRY[portName]) return PORT_COUNTRY[portName];
  const base = portName.replace(/\s*\([^)]*\)\s*$/, "").trim();
  if (PORT_COUNTRY[base]) return PORT_COUNTRY[base];
  if (/,\s*(Germany|Denmark|Norway|France|Spain|Italy|UK|Sweden|Finland|Netherlands|Portugal|Turkey|Greece|Croatia|Montenegro|Malta|Tunisia|Estonia|Latvia|Lithuania|Poland|Belgium|Iceland|Ireland|Gibraltar|USA)$/i.test(portName)) {
    return null;
  }
  return null;
}

/** @returns {string} e.g. "Kiel (Germany)" or "Civitavecchia (Rome, Italy)" */
export function formatPortLabel(portName) {
  if (!portName) return "—";
  const country = portCountry(portName);
  if (!country) return portName;
  if (portName.includes("(")) {
    return portName.replace(/\)\s*$/, ", " + country + ")");
  }
  return portName + " (" + country + ")";
}
