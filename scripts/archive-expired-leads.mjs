#!/usr/bin/env node
/**
 * Move leads with past sailDate to archive.
 * Usage: node scripts/archive-expired-leads.mjs [--dry-run] [--date YYYY-MM-DD]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  formatClosedSailDate,
  isSailDatePast,
  parseSailDate,
} from "./lib/sail-date.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const dateArgIdx = args.indexOf("--date");
const today =
  dateArgIdx >= 0 && args[dateArgIdx + 1]
    ? parseIsoDate(args[dateArgIdx + 1])
    : new Date();

if (!today) {
  console.error("Invalid --date; use YYYY-MM-DD");
  process.exit(1);
}

function parseIsoDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function formatLocalDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function loadLeadsFromHtml() {
  const htmlPath = path.join(root, "cruises.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
  const start = script.indexOf("const BASE_LEADS = [");
  const end = script.indexOf("const LATEST_FEED");
  const runtimeCode = script.slice(start, end) + "\nreturn BASE_LEADS;";
  const factory = new Function(runtimeCode);
  return { htmlPath, html, leads: factory() };
}

function findLeadBlock(html, id) {
  const marker = `id: ${id},`;
  const markerIdx = html.indexOf(marker);
  if (markerIdx === -1) return null;
  let braceStart = html.lastIndexOf("{", markerIdx);
  let depth = 0;
  for (let i = braceStart; i < html.length; i++) {
    if (html[i] === "{") depth++;
    if (html[i] === "}") {
      depth--;
      if (depth === 0) {
        return { start: braceStart, end: i + 1, block: html.slice(braceStart, i + 1) };
      }
    }
  }
  return null;
}

function setFieldInBlock(block, field, value) {
  const formatted =
    typeof value === "boolean" || typeof value === "number"
      ? String(value)
      : `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  const re = new RegExp(`(\\b${field}:\\s*)(?:true|false|null|-?\\d+(?:\\.\\d+)?|"[^"]*")`);
  if (re.test(block)) return block.replace(re, `$1${formatted}`);
  return block.replace(/(\n\s*)(closed:|urgent:|sourceUrl:)/, `$1${field}: ${formatted},\n$2`);
}

function patchLeadInHtml(html, id, fields) {
  const found = findLeadBlock(html, id);
  if (!found) return { html, changed: false };
  let block = found.block;
  for (const [field, value] of Object.entries(fields)) {
    block = setFieldInBlock(block, field, value);
  }
  return {
    html: html.slice(0, found.start) + block + html.slice(found.end),
    changed: true,
  };
}

function updateVerifiedJson(leadId, fields) {
  const verifiedPath = path.join(root, "research", "leads-verified.json");
  const verified = JSON.parse(fs.readFileSync(verifiedPath, "utf8"));
  const key = String(leadId);
  if (!verified.leads?.[key]) return;
  Object.assign(verified.leads[key], fields);
  if (!dryRun) fs.writeFileSync(verifiedPath, JSON.stringify(verified, null, 2) + "\n");
}

function run() {
  const registryPath = path.join(root, "research", "leads-registry.json");
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  const { htmlPath, leads } = loadLeadsFromHtml();
  let html = fs.readFileSync(htmlPath, "utf8");
  const report = { date: formatLocalDate(today), dryRun, archived: [] };
  const archivedIds = [];

  for (const lead of leads) {
    if (lead.closed) continue;
    const sailDate = parseSailDate(lead.sailDate);
    if (!sailDate || !isSailDatePast(sailDate, today)) continue;

    const closedLabel = formatClosedSailDate(sailDate);
    report.archived.push({ id: lead.id, name: lead.name, sailDate: lead.sailDate });

    if (!dryRun) {
      const patched = patchLeadInHtml(html, lead.id, {
        closed: true,
        urgent: false,
        desc: `${lead.desc || ""} · ${closedLabel}`.trim(),
      });
      html = patched.html;
      updateVerifiedJson(lead.id, { closed: true, urgent: false });

      registry.leads.active = (registry.leads.active || []).filter((e) => e.id !== lead.id);
      const activeEntry = registry.leads.active.find((e) => e.id === lead.id);
      registry.leads.archive = registry.leads.archive || [];
      if (!registry.leads.archive.some((e) => e.id === lead.id)) {
        registry.leads.archive.unshift({
          id: lead.id,
          archivedAt: formatLocalDate(today),
          reason: `sailDate ${lead.sailDate}`,
        });
      }
    }
    archivedIds.push(lead.id);
  }

  if (!dryRun && archivedIds.length) {
    registry.checkLog = registry.checkLog || [];
    registry.checkLog.unshift({
      date: formatLocalDate(today),
      checker: "archive-expired-leads.mjs",
      archived: archivedIds,
      activeCount: registry.leads.active?.length ?? 0,
    });
    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + "\n");
    fs.writeFileSync(htmlPath, html);
    fs.copyFileSync(htmlPath, path.join(root, "index.html"));
  }

  console.log(JSON.stringify(report, null, 2));
  if (archivedIds.length === 0) {
    console.error("No expired leads to archive.");
  } else if (dryRun) {
    console.error(`Dry run: would archive ${archivedIds.length} lead(s).`);
  } else {
    console.error(`Archived ${archivedIds.length} lead(s).`);
  }
}

run();
