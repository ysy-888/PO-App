/**
 * POST /api/sales-orders/bulk-upsert
 *
 * Import/update Sales Order documents from a grouped N41 CSV export.
 * Body: { rows: [{ "SO #", "Customer", ..., Lines: [...] }, ...] }
 */

import { Router } from "express";
import supabase from "../supabase.js";
import { requireAuth } from "../auth.js";
import {
  salesOrderEntityId,
  buildSalesOrderData,
  salesOrderValuesEqual,
} from "../salesOrderHelpers.js";

const router = Router();

router.post("/bulk-upsert", requireAuth, async (req, res) => {
  const rows = req.body?.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ success: false, error: "No rows to import." });
  }

  const entityIds = [
    ...new Set(
      rows.map(r => salesOrderEntityId(r?.["SO #"])).filter(Boolean)
    ),
  ];

  if (entityIds.length === 0) {
    return res.status(400).json({ success: false, error: "All rows are missing SO #." });
  }

  const { data: existingRows, error: fetchErr } = await supabase
    .from("sales_orders")
    .select("id, entity_id, data")
    .eq("tenant_id", req.tenantId)
    .in("entity_id", entityIds);

  if (fetchErr) {
    console.error("sales_orders bulk fetch failed:", fetchErr);
    return res.status(500).json({ success: false, error: "Failed to look up existing sales orders." });
  }

  const byEntityId = new Map((existingRows || []).map(r => [r.entity_id, r]));

  const toInsert = [];
  const toUpdate = [];
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const errors = [];
  const insertedOrders = [];
  const updatedOrders = [];

  rows.forEach((rowData, index) => {
    const entityId = salesOrderEntityId(rowData?.["SO #"]);
    if (!entityId) {
      skipped++;
      errors.push({ row: index + 1, error: "Missing SO #" });
      return;
    }

    const data = buildSalesOrderData(rowData);
    const existing = byEntityId.get(entityId);

    if (!existing) {
      toInsert.push({ tenant_id: req.tenantId, entity_id: entityId, data });
      insertedOrders.push(entityId);
      inserted++;
    } else if (salesOrderValuesEqual(existing.data, data)) {
      skipped++;
    } else {
      toUpdate.push({ id: existing.id, data: { ...(existing.data || {}), ...data } });
      updatedOrders.push(entityId);
      updated++;
    }
  });

  if (toInsert.length > 0) {
    const { error: insertErr } = await supabase.from("sales_orders").insert(toInsert);
    if (insertErr) {
      console.error("sales_orders bulk insert failed:", insertErr);
      return res.status(500).json({ success: false, error: "Failed to insert sales orders." });
    }
  }

  for (const row of toUpdate) {
    const { error: updateErr } = await supabase
      .from("sales_orders")
      .update({ data: row.data })
      .eq("id", row.id)
      .eq("tenant_id", req.tenantId);
    if (updateErr) {
      console.error("sales_orders bulk update failed:", updateErr);
      errors.push({ error: updateErr.message });
    }
  }

  return res.json({
    success: true,
    inserted,
    updated,
    skipped,
    errors,
    insertedOrders,
    updatedOrders,
  });
});

export default router;
