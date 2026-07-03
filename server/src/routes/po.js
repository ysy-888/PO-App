/**
 * POST /api/po/update       — single-field save (mirrors handleUpdate)
 * POST /api/po/bulk-upsert  — CSV import batches (mirrors handleBulkUpsertPos)
 * POST /api/po/batch-update — multi-PO field updates in one call
 *
 * All updates go through the merge_po_updates Postgres function
 * (db/migrations/006_merge_po_updates.sql), which merges only the changed
 * JSON keys atomically — concurrent editors of different fields no longer
 * clobber each other, and batches are one round trip instead of one per PO.
 * If the function isn't installed yet, falls back to the legacy
 * read-merge-write path so the app keeps working pre-migration.
 */

import { Router } from "express";
import supabase from "../supabase.js";
import { requireAuth } from "../auth.js";
import {
  sanitizeUpdates,
  pickImportUpdates,
  pickChangedImportUpdates,
  isPoClosed,
} from "../importHelpers.js";

const router = Router();

/** PostgREST code when an RPC function is missing from the schema cache. */
function isMissingFunctionError(error) {
  if (!error) return false;
  if (error.code === "PGRST202" || error.code === "42883") return true;
  const msg = String(error.message || "").toLowerCase();
  return msg.includes("could not find the function") || msg.includes("does not exist");
}

let mergeFunctionAvailable = true;

/**
 * Apply merged updates to POs. items: [{ poNumber, updates }] (already sanitized).
 * Returns { updated, missing, errors } or { error } on hard failure.
 */
async function mergePoUpdates(tenantId, items) {
  if (mergeFunctionAvailable) {
    const { data, error } = await supabase.rpc("merge_po_updates", {
      p_tenant_id: tenantId,
      p_items: items,
    });
    if (!error) {
      return { updated: data?.updated ?? 0, missing: data?.missing ?? [], errors: [] };
    }
    if (!isMissingFunctionError(error)) {
      console.error("merge_po_updates RPC failed:", error);
      return { error };
    }
    // Migration 006 not applied yet — remember and fall back.
    mergeFunctionAvailable = false;
    console.warn("merge_po_updates function not found — using legacy per-row updates. Apply db/migrations/006_merge_po_updates.sql.");
  }
  return legacyMergePoUpdates(tenantId, items);
}

/** Legacy read-merge-write path (subject to lost updates; pre-migration only). */
async function legacyMergePoUpdates(tenantId, items) {
  const poNumbers = [...new Set(items.map((i) => i.poNumber))];
  const { data: existingRows, error: fetchErr } = await supabase
    .from("purchase_orders")
    .select("id, po_number, data")
    .eq("tenant_id", tenantId)
    .in("po_number", poNumbers);

  if (fetchErr) {
    console.error("purchase_orders fetch failed:", fetchErr);
    return { error: fetchErr };
  }

  const byPo = new Map((existingRows || []).map((r) => [r.po_number, r]));
  const missing = [];
  const errors = [];
  let updated = 0;

  for (const item of items) {
    const existing = byPo.get(item.poNumber);
    if (!existing) {
      missing.push(item.poNumber);
      continue;
    }
    const merged = { ...(existing.data || {}), ...item.updates };
    const { error: updateErr } = await supabase
      .from("purchase_orders")
      .update({ data: merged })
      .eq("id", existing.id)
      .eq("tenant_id", tenantId);
    if (updateErr) {
      console.error(`PO ${item.poNumber} update failed:`, updateErr);
      errors.push({ poNumber: item.poNumber, error: updateErr.message });
    } else {
      updated++;
    }
  }
  return { updated, missing, errors };
}

router.post("/update", requireAuth, async (req, res) => {
  const { poNumber, updates } = req.body || {};

  if (!poNumber || typeof poNumber !== "string" || !poNumber.trim()) {
    return res.status(400).json({ success: false, error: "poNumber is required." });
  }
  if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
    return res.status(400).json({ success: false, error: "updates must be a non-null object." });
  }

  const cleanUpdates = sanitizeUpdates(updates);
  const result = await mergePoUpdates(req.tenantId, [
    { poNumber: poNumber.trim(), updates: cleanUpdates },
  ]);

  if (result.error) {
    return res.status(500).json({ success: false, error: "Failed to save update." });
  }
  if (result.missing.length > 0) {
    return res.status(404).json({ success: false, error: `PO # not found: ${poNumber}` });
  }
  if (result.errors.length > 0) {
    return res.status(500).json({ success: false, error: "Failed to save update." });
  }

  return res.json({ success: true });
});

router.post("/bulk-upsert", requireAuth, async (req, res) => {
  const rows = req.body?.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ success: false, error: "No rows to import." });
  }

  const poNumbers = [
    ...new Set(rows.map((r) => String(r["PO #"] ?? "").trim()).filter(Boolean)),
  ];

  const { data: existingRows, error: fetchErr } = await supabase
    .from("purchase_orders")
    .select("id, po_number, data")
    .eq("tenant_id", req.tenantId)
    .in("po_number", poNumbers);

  if (fetchErr) {
    console.error("purchase_orders bulk fetch failed:", fetchErr);
    return res.status(500).json({ success: false, error: "Failed to look up existing POs." });
  }

  const existingByPo = new Map((existingRows || []).map((r) => [r.po_number, r]));

  const toInsert = [];
  const toUpdate = [];
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const errors = [];
  const insertedPoNumbers = [];
  const updatedPoNumbers = [];

  rows.forEach((rowData, index) => {
    const poNumber = String(rowData["PO #"] ?? "").trim();
    if (!poNumber) {
      skipped++;
      errors.push({ row: index + 1, error: "Missing PO #" });
      return;
    }

    const updates = pickImportUpdates(rowData);
    const existing = existingByPo.get(poNumber);

    if (existing) {
      if (isPoClosed(existing.data)) {
        skipped++;
        return;
      }
      const changed = pickChangedImportUpdates(existing.data || {}, updates);
      if (Object.keys(changed).length === 0) return;

      toUpdate.push({ poNumber, updates: sanitizeUpdates(changed) });
      updatedPoNumbers.push(poNumber);
      updated++;
      return;
    }

    const newData = sanitizeUpdates({ "PO #": poNumber, ...updates });
    toInsert.push({
      tenant_id: req.tenantId,
      po_number: poNumber,
      data: newData,
    });
    existingByPo.set(poNumber, { id: null, po_number: poNumber, data: newData });
    insertedPoNumbers.push(poNumber);
    inserted++;
  });

  if (toInsert.length > 0) {
    const { error: insertErr } = await supabase.from("purchase_orders").insert(toInsert);
    if (insertErr) {
      console.error("purchase_orders bulk insert failed:", insertErr);
      return res.status(500).json({ success: false, error: "Failed to insert new POs." });
    }
  }

  if (toUpdate.length > 0) {
    const result = await mergePoUpdates(req.tenantId, toUpdate);
    if (result.error) {
      return res.status(500).json({ success: false, error: "Failed to update POs." });
    }
    result.errors.forEach((e) => errors.push(e));
  }

  return res.json({
    success: true,
    inserted,
    updated,
    skipped,
    errors,
    insertedPoNumbers,
    updatedPoNumbers,
  });
});

/**
 * POST /api/po/batch-update
 *
 * Applies multiple field updates across multiple POs in one call.
 * Body: { items: [{ poNumber, updates }, ...] }
 */
router.post("/batch-update", requireAuth, async (req, res) => {
  const items = req.body?.items;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: "items array is required." });
  }

  const cleanItems = items
    .map((item) => ({
      poNumber: String(item?.poNumber ?? "").trim(),
      updates: item?.updates,
    }))
    .filter(
      (item) =>
        item.poNumber &&
        item.updates &&
        typeof item.updates === "object" &&
        !Array.isArray(item.updates)
    )
    .map((item) => ({ poNumber: item.poNumber, updates: sanitizeUpdates(item.updates) }));

  if (cleanItems.length === 0) {
    return res.status(400).json({ success: false, error: "All items are missing poNumber." });
  }

  const result = await mergePoUpdates(req.tenantId, cleanItems);
  if (result.error) {
    return res.status(500).json({ success: false, error: "Failed to update POs." });
  }

  const errors = [
    ...result.missing.map((poNumber) => ({ poNumber, error: "PO not found" })),
    ...result.errors,
  ];
  return res.json({ success: true, errors });
});

export default router;
