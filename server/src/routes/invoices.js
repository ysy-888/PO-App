/**
 * POST /api/invoices/bulk-upsert
 * POST /api/invoices/memo
 * POST /api/invoices/flag
 */

import { Router } from "express";
import supabase from "../supabase.js";
import { requireAuth } from "../auth.js";
import {
  invoiceEntityId,
  buildInvoiceData,
  invoiceValuesEqual,
} from "../invoiceHelpers.js";

const router = Router();

router.post("/bulk-upsert", requireAuth, async (req, res) => {
  const rows = req.body?.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ success: false, error: "No rows to import." });
  }

  const entityIds = [
    ...new Set(
      rows.map(r => invoiceEntityId(r?.["Invoice #"])).filter(Boolean)
    ),
  ];

  if (entityIds.length === 0) {
    return res.status(400).json({ success: false, error: "All rows are missing Invoice #." });
  }

  const { data: existingRows, error: fetchErr } = await supabase
    .from("invoices")
    .select("id, entity_id, data")
    .eq("tenant_id", req.tenantId)
    .in("entity_id", entityIds);

  if (fetchErr) {
    console.error("invoices bulk fetch failed:", fetchErr);
    return res.status(500).json({ success: false, error: "Failed to look up existing invoices." });
  }

  const byEntityId = new Map((existingRows || []).map(r => [r.entity_id, r]));

  const toInsert = [];
  const toUpdate = [];
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const errors = [];
  const insertedInvoices = [];
  const updatedInvoices = [];

  rows.forEach((rowData, index) => {
    const entityId = invoiceEntityId(rowData?.["Invoice #"]);
    if (!entityId) {
      skipped++;
      errors.push({ row: index + 1, error: "Missing Invoice #" });
      return;
    }

    const data = buildInvoiceData(rowData);
    const existing = byEntityId.get(entityId);

    if (!existing) {
      toInsert.push({ tenant_id: req.tenantId, entity_id: entityId, data });
      insertedInvoices.push(entityId);
      inserted++;
    } else if (invoiceValuesEqual(existing.data, data)) {
      skipped++;
    } else {
      toUpdate.push({ id: existing.id, data: { ...(existing.data || {}), ...data } });
      updatedInvoices.push(entityId);
      updated++;
    }
  });

  if (toInsert.length > 0) {
    const { error: insertErr } = await supabase.from("invoices").insert(toInsert);
    if (insertErr) {
      console.error("invoices bulk insert failed:", insertErr);
      return res.status(500).json({ success: false, error: "Failed to insert invoices." });
    }
  }

  for (const row of toUpdate) {
    const { error: updateErr } = await supabase
      .from("invoices")
      .update({ data: row.data })
      .eq("id", row.id)
      .eq("tenant_id", req.tenantId);
    if (updateErr) {
      console.error("invoices bulk update failed:", updateErr);
      errors.push({ error: updateErr.message });
    }
  }

  return res.json({
    success: true,
    inserted,
    updated,
    skipped,
    errors,
    insertedInvoices,
    updatedInvoices,
  });
});

router.post("/memo", requireAuth, async (req, res) => {
  const { invoiceNo, memo, houseMemo } = req.body ?? {};
  if (!invoiceNo && invoiceNo !== 0) {
    return res.status(400).json({ success: false, error: "Missing invoiceNo." });
  }

  const entityId = invoiceEntityId(invoiceNo);
  if (!entityId) {
    return res.status(400).json({ success: false, error: "Invalid invoiceNo." });
  }

  const { data: existing, error: fetchErr } = await supabase
    .from("invoices")
    .select("id, data")
    .eq("tenant_id", req.tenantId)
    .eq("entity_id", entityId)
    .single();

  if (fetchErr || !existing) {
    return res.status(404).json({ success: false, error: "Invoice not found." });
  }

  const updatedData = { ...(existing.data || {}) };
  if (memo !== undefined) updatedData["Memo"] = String(memo ?? "").trim();
  if (houseMemo !== undefined) updatedData["House Memo"] = String(houseMemo ?? "").trim();

  const { error: updateErr } = await supabase
    .from("invoices")
    .update({ data: updatedData })
    .eq("id", existing.id)
    .eq("tenant_id", req.tenantId);

  if (updateErr) {
    console.error("invoices memo update failed:", updateErr);
    return res.status(500).json({ success: false, error: "Failed to save memo." });
  }

  return res.json({ success: true, memo: updatedData["Memo"], houseMemo: updatedData["House Memo"] });
});

router.post("/flag", requireAuth, async (req, res) => {
  const { invoiceNo, flag } = req.body ?? {};
  if (!invoiceNo && invoiceNo !== 0) {
    return res.status(400).json({ success: false, error: "Missing invoiceNo." });
  }

  const entityId = invoiceEntityId(invoiceNo);
  if (!entityId) {
    return res.status(400).json({ success: false, error: "Invalid invoiceNo." });
  }

  const { data: existing, error: fetchErr } = await supabase
    .from("invoices")
    .select("id, data")
    .eq("tenant_id", req.tenantId)
    .eq("entity_id", entityId)
    .single();

  if (fetchErr || !existing) {
    return res.status(404).json({ success: false, error: "Invoice not found." });
  }

  const updatedData = { ...(existing.data || {}), Flag: Boolean(flag) };

  const { error: updateErr } = await supabase
    .from("invoices")
    .update({ data: updatedData })
    .eq("id", existing.id)
    .eq("tenant_id", req.tenantId);

  if (updateErr) {
    console.error("invoices flag update failed:", updateErr);
    return res.status(500).json({ success: false, error: "Failed to save flag." });
  }

  return res.json({ success: true, flag: updatedData.Flag });
});

export default router;
