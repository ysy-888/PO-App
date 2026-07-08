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
import { requestCalendarSync } from "../calendarSync.js";

const router = Router();

// Any successful SO write may change CXL dates → refresh the calendar soon after.
router.use((_req, res, next) => {
  res.on("finish", () => {
    if (res.statusCode < 400) requestCalendarSync();
  });
  next();
});

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

router.post("/memo", requireAuth, async (req, res) => {
  const { soNumber, memo } = req.body ?? {};
  if (!soNumber && soNumber !== 0) {
    return res.status(400).json({ success: false, error: "Missing soNumber." });
  }

  const entityId = salesOrderEntityId(soNumber);
  if (!entityId) {
    return res.status(400).json({ success: false, error: "Invalid soNumber." });
  }

  const { data: existing, error: fetchErr } = await supabase
    .from("sales_orders")
    .select("id, data")
    .eq("tenant_id", req.tenantId)
    .eq("entity_id", entityId)
    .single();

  if (fetchErr || !existing) {
    return res.status(404).json({ success: false, error: "Sales order not found." });
  }

  const updatedData = { ...(existing.data || {}), Memo: String(memo ?? "").trim() };

  const { error: updateErr } = await supabase
    .from("sales_orders")
    .update({ data: updatedData })
    .eq("id", existing.id)
    .eq("tenant_id", req.tenantId);

  if (updateErr) {
    console.error("sales_orders memo update failed:", updateErr);
    return res.status(500).json({ success: false, error: "Failed to save memo." });
  }

  return res.json({ success: true, memo: updatedData.Memo });
});

// Conversation-style comments on a sales order (internal team + showroom portal).
router.post("/comment", requireAuth, async (req, res) => {
  const { soNumber, text } = req.body ?? {};
  if (!soNumber && soNumber !== 0) {
    return res.status(400).json({ success: false, error: "Missing soNumber." });
  }
  const commentText = String(text ?? "").trim();
  if (!commentText) {
    return res.status(400).json({ success: false, error: "Comment text is required." });
  }

  const entityId = salesOrderEntityId(soNumber);
  if (!entityId) {
    return res.status(400).json({ success: false, error: "Invalid soNumber." });
  }

  const { data: existing, error: fetchErr } = await supabase
    .from("sales_orders")
    .select("id, data")
    .eq("tenant_id", req.tenantId)
    .eq("entity_id", entityId)
    .single();

  if (fetchErr || !existing) {
    return res.status(404).json({ success: false, error: "Sales order not found." });
  }

  const comments = Array.isArray(existing.data?.Comments) ? existing.data.Comments.slice() : [];
  comments.push({
    // authorId lets the client resolve the current display name at render
    // time; author is an email snapshot for legacy/fallback display.
    authorId: req.userId,
    author: req.userEmail || "Unknown",
    text: commentText.slice(0, 2000),
    at: new Date().toISOString(),
  });

  const updatedData = { ...(existing.data || {}), Comments: comments };

  const { error: updateErr } = await supabase
    .from("sales_orders")
    .update({ data: updatedData })
    .eq("id", existing.id)
    .eq("tenant_id", req.tenantId);

  if (updateErr) {
    console.error("sales_orders comment update failed:", updateErr);
    return res.status(500).json({ success: false, error: "Failed to save comment." });
  }

  return res.json({ success: true, comments });
});

router.post("/flag", requireAuth, async (req, res) => {
  const { soNumber, flag } = req.body ?? {};
  if (!soNumber && soNumber !== 0) {
    return res.status(400).json({ success: false, error: "Missing soNumber." });
  }

  const entityId = salesOrderEntityId(soNumber);
  if (!entityId) {
    return res.status(400).json({ success: false, error: "Invalid soNumber." });
  }

  const { data: existing, error: fetchErr } = await supabase
    .from("sales_orders")
    .select("id, data")
    .eq("tenant_id", req.tenantId)
    .eq("entity_id", entityId)
    .single();

  if (fetchErr || !existing) {
    return res.status(404).json({ success: false, error: "Sales order not found." });
  }

  const updatedData = { ...(existing.data || {}), Flag: Boolean(flag) };

  const { error: updateErr } = await supabase
    .from("sales_orders")
    .update({ data: updatedData })
    .eq("id", existing.id)
    .eq("tenant_id", req.tenantId);

  if (updateErr) {
    console.error("sales_orders flag update failed:", updateErr);
    return res.status(500).json({ success: false, error: "Failed to save flag." });
  }

  return res.json({ success: true, flag: updatedData.Flag });
});

export default router;
