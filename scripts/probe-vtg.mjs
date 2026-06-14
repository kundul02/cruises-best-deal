#!/usr/bin/env node
/** Probe VTG custom.cfm form — dev only */
import { chromium } from "playwright";

const cruise = {
  line: "TUI Cruises",
  ship: "Mein Schiff 1",
  sailDate: "2026-08-05",
  port: "Bremerhaven",
  nights: 12,
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto("https://www.vacationstogo.com/custom.cfm", { waitUntil: "networkidle", timeout: 60000 });

const selects = await page.evaluate(() =>
  [...document.querySelectorAll("select")].map((s) => ({
    name: s.name,
    id: s.id,
    options: [...s.options].slice(0, 5).map((o) => o.text),
    count: s.options.length,
  }))
);
console.log("SELECTS", JSON.stringify(selects, null, 2));

const inputs = await page.evaluate(() =>
  [...document.querySelectorAll("input, button")].slice(0, 30).map((el) => ({
    tag: el.tagName,
    type: el.type,
    name: el.name,
    id: el.id,
    value: el.value?.slice?.(0, 40),
    text: el.textContent?.trim?.().slice(0, 40),
  }))
);
console.log("INPUTS", JSON.stringify(inputs, null, 2));

await page.screenshot({ path: "/tmp/vtg-custom.png", fullPage: true });
await browser.close();
