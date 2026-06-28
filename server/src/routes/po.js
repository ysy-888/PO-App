/**
 * POST /api/po/update       — single-field save (mirrors handleUpdate)
 * POST /api/po/bulk-upsert  — CSV import batches (mirrors handleBulkUpsertPos)
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

router.post("/update", requireAuth, async (req, res) => {
  const { poNumber, updates } = req.body || {};

  if (!poNumber || typeof poNumber !== "string" || !poNumber.trim()) {
    return res.status(400).json({ success: false, error: "poNumber is required." });
  }
  if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
    return res.status(400).json({ success: false, error: "updates must be a non-null object." });
  }

  const cleanUpdates = sanitizeUpdates(updates);

  // Fetch the existing row so we can merge rather than overwrite.
  const { data: existing, error: fetchErr } = await supabase
    .from("purchase_orders")
    .select("id, data")
    .eq("tenant_id", req.tenantId)
    .eq("po_number", poNumber.trim())
    .maybeSingle();

  if (fetchErr) {
    console.error("purchase_orders fetch failed:", fetchErr);
    return res.status(500).json({ success: false, error: "Failed to look up PO." });
  }

  if (!existing) {
    return res.status(404).json({ success: false, error: `PO # not found: ${poNumber}` });
  }

  // Merge the updates into the existing data object.
  const updatedData = { ...(existing.data || {}), ...cleanUpdates };

  const { error: updateErr } = await supabase
    .from("purchase_orders")
    .update({ data: updatedData })
    .eq("id", existing.id)
    .eq("tenant_id", req.tenantId); // belt-and-suspenders tenant check

  if (updateErr) {
    console.error("purchase_orders update failed:", updateErr);
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

      const merged = { ...(existing.data || {}), ...sanitizeUpdates(changed) };
      toUpdate.push({ id: existing.id, data: merged });
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

  for (const row of toUpdate) {
    const { error: updateErr } = await supabase
      .from("purchase_orders")
      .update({ data: row.data })
      .eq("id", row.id)
      .eq("tenant_id", req.tenantId);
    if (updateErr) {
      console.error("purchase_orders bulk update failed:", updateErr);
      return res.status(500).json({ success: false, error: "Failed to update POs." });
    }
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

export default router;
