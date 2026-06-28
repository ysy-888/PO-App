/**
 * Merge PO quantity fields into existing Supabase purchase_orders rows.
 *
 * Sources (in order):
 *   1. APPS_SCRIPT_URL — full PO rows from the sheet backend
 *   2. CSV_FILE        — N41 export fallback for POs not in Apps Script
 *
 * Usage:
 *   node scripts/merge-po-quantities.js
 *
 * Env (.env in repo root or server/.env):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TENANT_ID
 *   APPS_SCRIPT_URL (preferred)
 *   CSV_FILE (optional fallback)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import {
  pickImportUpdates,
  sanitizeUpdates,
} from "../src/importHelpers.js";

function loadEnvFile(path) {
  try {
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim();
    }
  } catch {
    /* ignore */
  }
}

loadEnvFile(resolve(process.cwd(), ".env"));
loadEnvFile(resolve(process.cwd(), "../.env"));

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  TENANT_ID,
  APPS_SCRIPT_URL,
  CSV_FILE,
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !TENANT_ID) {
  console.error("ERROR: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and TENANT_ID are required.");
  process.exit(1);
}
if (!APPS_SCRIPT_URL && !CSV_FILE) {
  console.error("ERROR: Set APPS_SCRIPT_URL and/or CSV_FILE.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const CSV_TO_SHEET_MAP = {
  poNo: "PO #",
  poDate: "PO Date",
  etaDate: "EST IHD",
  vendor: "Vendor",
  status: "N41 Status",
  division: "Division",
  shipVia: "Ship Method",
  orderNo: "SO #",
  user1: "Old PO #",
  custName: "Buyer",
  customerPo: "Buyer PO #",
  style: "Style #",
  color: "Color",
  category: "Style Category",
  totalUnit: "PO Qty",
  recQty: "Received Qty",
  cancelDate: "CXL Date",
  cost: "FOB Cost",
  extCost: "PO Total Cost",
};
for (let i = 1; i <= 15; i++) {
  CSV_TO_SHEET_MAP[`size${i}`] = `Size ${i}`;
  CSV_TO_SHEET_MAP[`value${i}`] = `PO Unit ${i}`;
}

function splitCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === "," && !inQuotes) { values.push(current); current = ""; continue; }
    current += ch;
  }
  values.push(current);
  return values;
}

function parseCsvFile(path) {
  const text = readFileSync(path, "utf8");
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim());
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const raw = {};
    headers.forEach((h, i) => { raw[h] = (values[i] ?? "").trim(); });
    const row = {};
    for (const [csvKey, sheetKey] of Object.entries(CSV_TO_SHEET_MAP)) {
      const val = raw[csvKey] ?? "";
      if (val === "") continue;
      row[sheetKey] = isNaN(Number(val)) ? val : Number(val);
    }
    return row;
  }).filter(row => String(row["PO #"] ?? "").trim() !== "");
}

async function fetchAppsScriptRows(url) {
  console.log("Fetching from Apps Script:", url);
  const res = await fetch(url + (url.includes("?") ? "&" : "?") + "_=" + Date.now(), { cache: "no-store" });
  if (!res.ok) throw new Error(`Apps Script HTTP ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error("Apps Script error: " + json.error);
  console.log(`  → ${(json.data || []).length} PO rows`);
  return json.data || [];
}

function hasQuantityFields(data) {
  if (!data) return false;
  if (data["PO Qty"] != null && data["PO Qty"] !== "") return true;
  for (let i = 1; i <= 15; i++) {
    const v = data[`PO Unit ${i}`];
    if (v != null && v !== "" && Number(v) !== 0) return true;
  }
  return false;
}

function buildSourceMap(appsRows, csvRows) {
  const byPo = new Map();
  for (const row of csvRows) {
    const po = String(row["PO #"] ?? "").trim();
    if (po) byPo.set(po, row);
  }
  for (const row of appsRows) {
    const po = String(row["PO #"] ?? "").trim();
    if (po) byPo.set(po, row);
  }
  return byPo;
}

async function main() {
  console.log("\n=== Merge PO quantities into Supabase ===");
  console.log("Tenant:", TENANT_ID);

  const appsRows = APPS_SCRIPT_URL ? await fetchAppsScriptRows(APPS_SCRIPT_URL) : [];
  let csvRows = [];
  if (CSV_FILE) {
    const csvPath = existsSync(resolve(process.cwd(), CSV_FILE))
      ? resolve(process.cwd(), CSV_FILE)
      : resolve(process.cwd(), "..", CSV_FILE);
    if (existsSync(csvPath)) {
      csvRows = parseCsvFile(csvPath);
      console.log(`CSV: ${csvRows.length} rows from ${csvPath}`);
    }
  }

  const sourceByPo = buildSourceMap(appsRows, csvRows);
  console.log(`Source map: ${sourceByPo.size} POs with import data`);

  const { data: existingRows, error: fetchErr } = await supabase
    .from("purchase_orders")
    .select("id, po_number, data")
    .eq("tenant_id", TENANT_ID);

  if (fetchErr) throw new Error("Failed to fetch purchase_orders: " + fetchErr.message);
  console.log(`Supabase: ${existingRows.length} existing PO rows`);

  let updated = 0;
  let skippedNoSource = 0;
  let skippedHasQty = 0;
  const BATCH = 50;
  const pending = [];

  for (const existing of existingRows) {
    const po = existing.po_number;
    const source = sourceByPo.get(po);
    if (!source) {
      skippedNoSource++;
      continue;
    }
    if (hasQuantityFields(existing.data)) {
      skippedHasQty++;
      continue;
    }

    const updates = pickImportUpdates(source);
    const merged = sanitizeUpdates({ ...(existing.data || {}), ...updates });
    pending.push({ id: existing.id, data: merged });
  }

  console.log(`To update: ${pending.length} (no source: ${skippedNoSource}, already has qty: ${skippedHasQty})`);

  for (let i = 0; i < pending.length; i += BATCH) {
    const batch = pending.slice(i, i + BATCH);
    for (const row of batch) {
      const { error } = await supabase
        .from("purchase_orders")
        .update({ data: row.data })
        .eq("id", row.id)
        .eq("tenant_id", TENANT_ID);
      if (error) throw new Error("Update failed for id " + row.id + ": " + error.message);
      updated++;
    }
    console.log(`  Updated ${Math.min(i + BATCH, pending.length)} / ${pending.length}`);
  }

  const { data: check } = await supabase
    .from("purchase_orders")
    .select("po_number, data")
    .eq("tenant_id", TENANT_ID)
    .not("data->PO Qty", "is", null)
    .limit(1);

  console.log(`\nDone. ${updated} rows updated.`);
  if (check?.length) {
    console.log("Sample:", check[0].po_number, "PO Qty =", check[0].data["PO Qty"]);
  }
}

main().catch(err => {
  console.error("Fatal:", err.message || err);
  process.exit(1);
});
