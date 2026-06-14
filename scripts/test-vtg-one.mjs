#!/usr/bin/env node
/** Test full VTG search flow */
import { searchVtgPrice } from "./lib/vtg-search.mjs";

const cruise = {
  line: "TUI Cruises",
  ship: "Mein Schiff 1",
  sailDate: "2026-08-05",
  port: "Bremerhaven",
  nights: 12,
};

const result = await searchVtgPrice(cruise, { headless: true, debug: true });
console.log(JSON.stringify(result, null, 2));
