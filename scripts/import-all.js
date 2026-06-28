/**
 * scripts/import-all.js
 *
 * Full data migration: imports every entity from the live Google Sheet
 * (via Apps Script doGet) into Supabase.  Runs in order so that FKs and
 * cross-references remain consistent.
 *
 * Usage:
 *   node scripts/import-all.js
 *   node scripts/import-all.js --entity pos            # POs only
 *   node scripts/import-all.js --entity shipments      # Shipments only
 *   node scripts/import-all.js --entity contacts,customers
 *
 * Environment variables (.env file or shell):
 *   SUPABASE_URL              — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — service-role key (never the anon key)
 *   TENANT_ID                 — UUID of the tenant row in Supabase
 *   APPS_SCRIPT_URL           — live Apps Script /exec URL
 *
 * All upserts are idempotent: safe to re-run.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  pickImportUpdates,
  pickChangedImportUpdates,
  sanitizeUpdates,
} from "../server/src/importHelpers.js";

// ── Load .env ─────────────────────────────────────────────────────────────────
try {
  const raw = readFileSync(resolve(process.cwd(), ".env"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
} catch { /* .env absent, rely on existing env */ }

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TENANT_ID, APPS_SCRIPT_URL } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) { console.error("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required."); process.exit(1); }
if (!TENANT_ID) { console.error("ERROR: TENANT_ID required."); process.exit(1); }
if (!APPS_SCRIPT_URL) { console.error("ERROR: APPS_SCRIPT_URL required (set to the Apps Script /exec URL)."); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// ── Which entities to import (--entity flag) ──────────────────────────────────
const entityFlag = process.argv.find((a, i) => process.argv[i - 1] === "--entity");
const onlyEntities = entityFlag ? new Set(entityFlag.split(",").map(s => s.trim())) : null;
const shouldImport = (name) => !onlyEntities || onlyEntities.has(name);

// ── Fetch all data from Apps Script in one call ───────────────────────────────
async function fetchAppState() {
  console.log("Fetching full app state from Apps Script:", APPS_SCRIPT_URL);
  const res = await fetch(APPS_SCRIPT_URL + (APPS_SCRIPT_URL.includes("?") ? "&" : "?") + "_=" + Date.now(), { cache: "no-store" });
  if (!res.ok) throw new Error(`Apps Script HTTP ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error("Apps Script error: " + json.error);
  return json;
}

// ── Generic upsert helper for simple entity tables ─────────────────────────────
async function upsertSimple(tableName, rows, idField, { batchSize = 100 } = {}) {
  if (!rows || rows.length === 0) { console.log(`  ${tableName}: 0 rows, skipping.`); return 0; }
  let total = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const records = batch.map(row => ({
      tenant_id: TENANT_ID,
      entity_id: String(row[idField] ?? "").trim(),
      data: row,
    })).filter(r => r.entity_id !== "");

    const { error } = await supabase.from(tableName).upsert(records, { onConflict: "tenant_id,entity_id", ignoreDuplicates: false });
    if (error) throw Object.assign(new Error(`${tableName} upsert failed: ${error.message}`), { detail: error });
    total += records.length;
  }
  console.log(`  ${tableName}: ${total} rows upserted.`);
  return total;
}

// ── POs ───────────────────────────────────────────────────────────────────────
async function importPos(data) {
  if (!data || data.length === 0) { console.log("  purchase_orders: 0 rows."); return; }

  const poNumbers = [...new Set(data.map(row => String(row["PO #"] ?? "").trim()).filter(Boolean))];
  const { data: existingRows, error: fetchErr } = await supabase
    .from("purchase_orders")
    .select("id, po_number, data")
    .eq("tenant_id", TENANT_ID)
    .in("po_number", poNumbers);

  if (fetchErr) throw new Error("purchase_orders fetch failed: " + fetchErr.message);

  const existingByPo = new Map((existingRows || []).map(row => [row.po_number, row]));
  const toInsert = [];
  const toUpdate = [];
  let inserted = 0;
  let updated = 0;

  data.forEach(rowData => {
    const poNumber = String(rowData["PO #"] ?? "").trim();
    if (!poNumber) return;

    const updates = pickImportUpdates(rowData);
    const existing = existingByPo.get(poNumber);

    if (existing) {
      const changed = pickChangedImportUpdates(existing.data || {}, updates);
      if (Object.keys(changed).length === 0) return;
      toUpdate.push({
        id: existing.id,
        data: sanitizeUpdates({ ...(existing.data || {}), ...changed }),
      });
      updated++;
      return;
    }

    toInsert.push({
      tenant_id: TENANT_ID,
      po_number: poNumber,
      data: sanitizeUpdates({ "PO #": poNumber, ...updates }),
    });
    inserted++;
  });

  const BATCH = 100;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const { error } = await supabase.from("purchase_orders").insert(toInsert.slice(i, i + BATCH));
    if (error) throw new Error("purchase_orders insert failed: " + error.message);
  }

  for (const row of toUpdate) {
    const { error } = await supabase
      .from("purchase_orders")
      .update({ data: row.data })
      .eq("id", row.id)
      .eq("tenant_id", TENANT_ID);
    if (error) throw new Error("purchase_orders update failed: " + error.message);
  }

  console.log(`  purchase_orders: ${inserted} inserted, ${updated} updated (${data.length} source rows).`);
}

// ── Packing Cartons (special: keyed by packing_list_entity_id + carton_number) ─
async function importPackingCartons(cartons) {
  if (!cartons || cartons.length === 0) { console.log("  packing_cartons: 0 rows."); return; }

  // Delete all existing cartons for this tenant then re-insert for cleanliness.
  // For large datasets a per-list upsert would be safer; this is a one-time migration.
  const { error: delErr } = await supabase.from("packing_cartons").delete().eq("tenant_id", TENANT_ID);
  if (delErr) throw new Error("packing_cartons delete failed: " + delErr.message);

  const BATCH = 100;
  for (let i = 0; i < cartons.length; i += BATCH) {
    const records = cartons.slice(i, i + BATCH).map((c, offsetIdx) => {
      const listId = String(c["Packing List ID"] ?? "").trim();
      const cartonNum = Number(c["Carton #"] ?? 0) || (i + offsetIdx + 1);
      return { tenant_id: TENANT_ID, packing_list_entity_id: listId, carton_number: cartonNum, data: c };
    }).filter(r => r.packing_list_entity_id !== "");
    const { error } = await supabase.from("packing_cartons").insert(records);
    if (error) throw new Error("packing_cartons insert failed: " + error.message);
  }
  console.log(`  packing_cartons: ${cartons.length} rows inserted.`);
}

// ── Style Photos ──────────────────────────────────────────────────────────────
async function importStylePhotos(photos) {
  if (!photos || photos.length === 0) { console.log("  style_photos: 0 rows."); return; }
  const records = photos.map(p => {
    const style = String(p["Style #"] ?? "").trim();
    const color = String(p["Color"] ?? "").trim();
    return { tenant_id: TENANT_ID, entity_id: `${style}|${color}`, data: p };
  }).filter(r => r.entity_id !== "|");
  const { error } = await supabase.from("style_photos").upsert(records, { onConflict: "tenant_id,entity_id" });
  if (error) throw new Error("style_photos upsert failed: " + error.message);
  console.log(`  style_photos: ${records.length} rows upserted.`);
}

// ── Settings ──────────────────────────────────────────────────────────────────
async function importSettings(state) {
  const settings = {};
  if (state.vendorSubmitMode) settings.vendorSubmitMode = state.vendorSubmitMode;
  if (state.defaultColumns) settings.defaultColumns = state.defaultColumns;
  if (state.defaultStatusFilter) settings.defaultStatusFilter = state.defaultStatusFilter;
  if (Object.keys(settings).length === 0) { console.log("  tenant_settings: nothing to import."); return; }

  const { error } = await supabase.from("tenant_settings").upsert({ tenant_id: TENANT_ID, settings }, { onConflict: "tenant_id" });
  if (error) throw new Error("tenant_settings upsert failed: " + error.message);
  console.log("  tenant_settings: settings saved.");
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n=== Full data import from Apps Script → Supabase ===");
  console.log("Tenant:", TENANT_ID);
  if (onlyEntities) console.log("Filtering to:", [...onlyEntities].join(", "));

  const state = await fetchAppState();

  // Entity import table — each entry: [entityName, tableName, idField, rowsArrayKey]
  const entities = [
    ["pos",                  null,                     "PO #",                  "data"],
    ["shipments",            "shipments",              "Shipment ID",           "shipments"],
    ["exf_requests",         "exf_requests",           "EXF Request ID",        "exfRequests"],
    ["asn_requests",         "asn_requests",           "ASN Request ID",        "asnRequests"],
    ["delivery_requests",    "delivery_requests",      "Delivery Request ID",   "deliveryRequests"],
    ["pickup_requests",      "pickup_requests",        "Pickup Request ID",     "pickupRequests"],
    ["approvals",            "approvals",              "Approval ID",           "approvals"],
    ["chargebacks",          "chargebacks",            "Chargeback ID",         "chargebacks"],
    ["packing_lists",        "packing_lists",          "Packing List ID",       "packingLists"],
    ["packing_cartons",      null,                     null,                    "packingCartons"],
    ["pending_packing_lists","pending_packing_lists",  "Submission ID",         "pendingPackingLists"],
    ["customers",            "customers",              "Customer",              "customers"],
    ["contacts",             "contacts",               "Name",                  "contacts"],
    ["locations",            "locations",              "Entity",                "locations"],
    ["style_photos",         null,                     null,                    "stylePhotos"],
    ["settings",             null,                     null,                    null],
  ];

  for (const [name, table, idField, stateKey] of entities) {
    if (!shouldImport(name)) continue;
    console.log(`\nImporting ${name}…`);
    try {
      if (name === "pos") {
        await importPos(state.data);
      } else if (name === "packing_cartons") {
        await importPackingCartons(state.packingCartons);
      } else if (name === "style_photos") {
        await importStylePhotos(state.stylePhotos);
      } else if (name === "settings") {
        await importSettings(state);
      } else {
        await upsertSimple(table, state[stateKey], idField);
      }
    } catch (err) {
      console.error(`  ERROR importing ${name}:`, err.message);
      if (err.detail) console.error("  Detail:", err.detail);
      // Continue with remaining entities even if one fails.
    }
  }

  console.log("\n=== Import complete ===");
}

main().catch(err => { console.error("Fatal:", err.message || err); process.exit(1); });
