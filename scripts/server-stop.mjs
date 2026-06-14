#!/usr/bin/env node
/** Stop local price-server and preview HTTP server. */
import { execSync } from "child_process";

function tryKill(pattern, label) {
  try {
    execSync(`pkill -f "${pattern}" 2>/dev/null`, { stdio: "ignore" });
    console.log(`✓ остановлен: ${label}`);
    return true;
  } catch {
    console.log(`— не запущен: ${label}`);
    return false;
  }
}

console.log("Останавливаем локальные серверы…\n");
tryKill("scripts/price-server.mjs", "price-server (:3920)");
tryKill("http.server 8765", "preview (:8765)");
console.log("\nПроверка: npm run server:status");
