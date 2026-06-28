/**
 * POST /api/styles/bulk-upsert
 *
 * Import/update Style Master rows from N41 CSV export.
 * Body: { rows: [{ "Style #", "Color", "Size Cat", ... }, ...] }
 */

import { Router } from "express";
import supabase from "../supabase.js";
import { requireAuth } from "../auth.js";
import { sanitizeCellValue } from "../importHelpers.js";
import {
  buildStyleRowData,
  styleEntityId,
  styleRowValuesEqual,
} from "../styleHelpers.js";

const router = Router();

router.post("/bulk-upsert", requireAuth, async (req, res) => {
  const rows = req.body?.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ success: false, error: "No rows to import." });
  }

  const entityIds = [...new Set(
    rows.map(r => styleEntityId(r?.["Style #"], r?.["Color"])).filter(Boolean)
  )];

  if (entityIds.length === 0) {
    return res.status(400).json({ success: false, error: "All rows are missing Style # or Color." });
  }

  const { data: existingRows, error: fetchErr } = await supabase
    .from("styles")
    .select("id, entity_id, data")
    .eq("tenant_id", req.tenantId)
    .in("entity_id", entityIds);

  if (fetchErr) {
    console.error("styles bulk fetch failed:", fetchErr);
    return res.status(500).json({ success: false, error: "Failed to look up existing styles." });
  }

  const byEntityId = new Map((existingRows || []).map(r => [r.entity_id, r]));

  const toInsert = [];
  const toUpdate = [];
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const errors = [];
  const insertedStyles = [];
  const updatedStyles = [];

  rows.forEach((rowData, index) => {
    const entityId = styleEntityId(rowData?.["Style #"], rowData?.["Color"]);
    if (!entityId) {
      skipped++;
      errors.push({ row: index + 1, error: "Missing Style # or Color" });
      return;
    }

    const sanitized = {};
    for (const [field, value] of Object.entries(rowData || {})) {
      sanitized[field] = typeof value === "string" ? sanitizeCellValue(value) : value;
    }
    const data = buildStyleRowData(sanitized);

    const existing = byEntityId.get(entityId);
    if (!existing) {
      toInsert.push({ tenant_id: req.tenantId, entity_id: entityId, data });
      insertedStyles.push(entityId);
      inserted++;
    } else if (styleRowValuesEqual(existing.data, data)) {
      skipped++;
    } else {
      toUpdate.push({ id: existing.id, data: { ...(existing.data || {}), ...data } });
      updatedStyles.push(entityId);
      updated++;
    }
  });

  if (toInsert.length > 0) {
    const { error: insertErr } = await supabase.from("styles").insert(toInsert);
    if (insertErr) {
      console.error("styles bulk insert failed:", insertErr);
      return res.status(500).json({ success: false, error: "Failed to insert styles." });
    }
  }

  for (const row of toUpdate) {
    const { error: updateErr } = await supabase
      .from("styles")
      .update({ data: row.data })
      .eq("id", row.id)
      .eq("tenant_id", req.tenantId);
    if (updateErr) {
      console.error("styles bulk update failed:", updateErr);
      errors.push({ error: updateErr.message });
    }
  }

  return res.json({
    success: true,
    inserted,
    updated,
    skipped,
    errors,
    insertedStyles,
    updatedStyles,
  });
});

export default router;
