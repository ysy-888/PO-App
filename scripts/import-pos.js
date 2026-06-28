/**
 * scripts/import-pos.js
 *
 * One-time import: loads existing PO data into the Supabase `purchase_orders`
 * table for a given tenant.
 *
 * Usage:
 *   node scripts/import-pos.js
 *
 * Environment variables (create a .env file in the repo root OR export them):
 *   SUPABASE_URL              — your Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — service-role key (never the anon key)
 *   TENANT_ID                 — UUID of the tenant row in Supabase
 *   APPS_SCRIPT_URL           — (Option A) live Apps Script /exec URL to fetch current data
 *   CSV_FILE                  — (Option B) path to a N41 CSV export file
 *
 * Priority: APPS_SCRIPT_URL is used if set; CSV_FILE is the fallback.
 *
 * The script upserts on (tenant_id, po_number) so it is safe to run more
 * than once — existing rows are updated, new rows are inserted.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// ── Load env ────────────────────────────────────────────────
// Accept a .env file at the project root (optional; env vars already set
// in the shell work too).
try {
  const dotenvPath = resolve(process.cwd(), ".env");
  const raw = readFileSync(dotenvPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
} catch {
  // .env not present — fall through to existing env vars
}

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  TENANT_ID,
  APPS_SCRIPT_URL,
  CSV_FILE,
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  process.exit(1);
}
if (!TENANT_ID) {
  console.error("ERROR: TENANT_ID must be set (UUID of the tenant row in Supabase).");
  process.exit(1);
}
if (!APPS_SCRIPT_URL && !CSV_FILE) {
  console.error("ERROR: Set APPS_SCRIPT_URL (preferred) or CSV_FILE.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ── CSV column map (mirrors CSV_TO_SHEET_MAP in js/state-api.js) ────────────
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

// ── Source A: fetch from Apps Script ────────────────────────
async function fetchFromAppsScript(url) {
  console.log("Fetching from Apps Script:", url);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Apps Script returned HTTP ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(`Apps Script error: ${json.error}`);
  const rows = json.data || [];
  console.log(`  → ${rows.length} PO rows received`);
  return rows;
}

// ── Source B: parse N41 CSV file ────────────────────────────
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const raw = {};
    headers.forEach((h, i) => { raw[h.trim()] = (values[i] ?? "").trim(); });

    // Map CSV columns to sheet field names.
    const row = {};
    for (const [csvKey, sheetKey] of Object.entries(CSV_TO_SHEET_MAP)) {
      const val = raw[csvKey] ?? "";
      row[sheetKey] = isNaN(Number(val)) || val === "" ? val : Number(val);
    }
    return row;
  }).filter((row) => String(row["PO #"] ?? "").trim() !== "");
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

// ── Upsert into Supabase ─────────────────────────────────────
const BATCH_SIZE = 100;

async function upsertRows(rows) {
  let inserted = 0;
  let updated = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const records = batch.map((row) => ({
      tenant_id: TENANT_ID,
      po_number: String(row["PO #"] ?? "").trim(),
      data: row,
    })).filter((r) => r.po_number !== "");

    const { data: upserted, error } = await supabase
      .from("purchase_orders")
      .upsert(records, {
        onConflict: "tenant_id,po_number",
        ignoreDuplicates: false,
      })
      .select("id");

    if (error) {
      console.error(`Batch ${i / BATCH_SIZE + 1} upsert error:`, error);
      throw error;
    }

    inserted += (upserted || []).length;
    console.log(`  Batch ${i / BATCH_SIZE + 1}: ${records.length} rows processed`);
  }

  return { inserted };
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  console.log("\n=== PO Import ===");
  console.log("Tenant ID:", TENANT_ID);

  let rows;
  if (APPS_SCRIPT_URL) {
    rows = await fetchFromAppsScript(APPS_SCRIPT_URL);
  } else {
    const csvPath = resolve(process.cwd(), CSV_FILE);
    console.log("Reading CSV:", csvPath);
    const text = readFileSync(csvPath, "utf8");
    rows = parseCSV(text);
    console.log(`  → ${rows.length} PO rows parsed`);
  }

  if (rows.length === 0) {
    console.log("No rows to import. Exiting.");
    return;
  }

  console.log(`\nUpserting ${rows.length} rows into purchase_orders…`);
  const { inserted } = await upsertRows(rows);
  console.log(`\nDone. ${inserted} rows written.`);
}

main().catch((err) => {
  console.error("Import failed:", err.message || err);
  process.exit(1);
});
