#!/usr/bin/env node
/** CLI: discover new cruises on Cruisello — npm run discover-cruises -- --region=med */
import { discoverAll, discoverRegion } from "./lib/discover-cruises.mjs";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const regionArg = process.argv.find((a) => a.startsWith("--region="));
const region = regionArg ? regionArg.split("=")[1] : "all";

const result = region === "all" ? discoverAll() : discoverRegion(region);
console.log(JSON.stringify(result, null, 2));

if (result.ok) {
  execSync("node scripts/build-unified-cruises-html.mjs", { cwd: root, stdio: "inherit" });
}

process.exit(result.ok ? 0 : 1);
