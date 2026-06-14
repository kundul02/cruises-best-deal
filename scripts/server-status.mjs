#!/usr/bin/env node
/** Check local dev servers (price-server :3920, preview :8765). */
import { execSync } from "child_process";
import fs from "fs";

const PORT_PRICE = process.env.PRICE_SERVER_PORT || 3920;

function lsof(port) {
  try {
    return execSync(`lsof -i :${port} -sTCP:LISTEN 2>/dev/null`, { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

console.log("=== Локальные серверы ===\n");

console.log(`price-server (:${PORT_PRICE})`);
try {
  const health = await fetch(`http://127.0.0.1:${PORT_PRICE}/health`);
  const j = await health.json();
  console.log("  статус: ✓ работает", JSON.stringify(j));
  const ls = lsof(PORT_PRICE);
  if (ls) console.log("  " + ls.split("\n")[0]);
} catch {
  console.log("  статус: ✗ не запущен");
  console.log("  запуск: npm run price-server");
}

console.log("\npreview HTTP (:8765)");
const prev = lsof(8765);
if (prev) {
  console.log("  статус: ✓ работает");
  console.log("  " + prev.split("\n")[0]);
  console.log("  URL: http://127.0.0.1:8765/cruises-europe-2026.html#north");
} else {
  console.log("  статус: ✗ не запущен");
  console.log("  запуск: npm run preview");
}

console.log("\nPlaywright-профили (сессии, не порты):");
for (const [name, dir] of [
  ["VTG", ".playwright-vtg-profile"],
  ["CruiseDirect", ".playwright-cd-profile"],
  ["iCruise", ".playwright-icruise-profile"],
]) {
  console.log(`  ${name}: ${fs.existsSync(dir) ? "✓ есть" : "— нет (нужен login)"}`);
}
