#!/usr/bin/env node
/** Safe git commit + push for price refresh artifacts only. */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const ALLOWED = [
  "cruises-europe-2026.html",
  "index.html",
  "med-summer-july-2026.html",
  "north-aug-2026.html",
  "research/summer-med-july-2026.json",
  "research/north-aug-2026.json",
  "research/transatlantic-fall-2026.json",
  "research/public-api.json",
];

export function gitDeploy({ message } = {}) {
  const date = new Date().toISOString().slice(0, 10);
  const msg = message || `chore: auto price refresh ${date}`;

  const toAdd = ALLOWED.filter((f) => fs.existsSync(path.join(root, f)));
  if (!toAdd.length) {
    return { ok: true, pushed: false, message: "No artifact files found" };
  }

  for (const f of toAdd) {
    execSync(`git add ${JSON.stringify(f)}`, { cwd: root, stdio: "pipe" });
  }

  const status = execSync("git status --porcelain", { cwd: root, encoding: "utf8" }).trim();
  if (!status) {
    return { ok: true, pushed: false, message: "Nothing to commit" };
  }

  execSync(`git commit -m ${JSON.stringify(msg)}`, { cwd: root, stdio: "pipe" });
  execSync("git push origin main", { cwd: root, stdio: "pipe" });

  const log = execSync("git log -1 --format=%H", { cwd: root, encoding: "utf8" }).trim();
  return { ok: true, pushed: true, commit: log, files: toAdd, message: msg };
}

if (process.argv[1]?.includes("git-deploy.mjs")) {
  try {
    const r = gitDeploy();
    console.log(JSON.stringify(r, null, 2));
  } catch (e) {
    console.error(e.message || e);
    process.exit(1);
  }
}
