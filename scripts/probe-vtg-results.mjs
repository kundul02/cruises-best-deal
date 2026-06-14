#!/usr/bin/env node
/** Debug VTG submit + dump results structure */
import { chromium } from "playwright";
import fs from "fs";

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext()).newPage();
await page.goto("https://www.vacationstogo.com/custom.cfm", { waitUntil: "domcontentloaded" });

async function pick(id, text) {
  return page.evaluate(({ id, text }) => {
    const sel = document.getElementById(id);
    const t = text.toLowerCase();
    for (const o of sel.options) {
      if (o.text.toLowerCase().includes(t) && o.value) {
        sel.value = o.value;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
        return o.text;
      }
    }
    return null;
  }, { id, text });
}

console.log("line", await pick("LineID", "MSC Cruises"));
await page.waitForTimeout(500);
console.log("ship", await pick("ShipID", "MSC Grandiosa"));
console.log("month", await pick("SMonth", "July 2026"));
console.log("day", await pick("SDay", "5"));
console.log("tmonth", await pick("TMonth", "July 2026"));
console.log("tday", await pick("TDay", "5"));
console.log("min", await pick("MinDay", "6"));
console.log("max", await pick("MaxDay", "8"));
console.log("port", await pick("dPortID", "Cannes"));
await pick("Stateroom", "Cheapest overall");

await Promise.all([
  page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => null),
  page.click("#fabShowMeTheDeals"),
]);
await page.waitForTimeout(3000);

const url = page.url();
const html = await page.content();
fs.writeFileSync("/tmp/vtg-results.html", html);
console.log("URL", url, "len", html.length);

const text = await page.evaluate(() => document.body.innerText.slice(0, 4000));
console.log("TEXT\n", text);

await page.screenshot({ path: "/tmp/vtg-results.png", fullPage: true });
await browser.close();
