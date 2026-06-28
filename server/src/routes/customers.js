/**
 * POST /api/customers/bulk-upsert
 *
 * Import/update customer rows.  Mirrors handleBulkUpsertCustomers in apps-script.gs.
 * Body: { rows: [{ Customer, Address, ... }, ...] }
 */

import { Router } from "express";
import supabase from "../supabase.js";
import { requireAuth } from "../auth.js";
import { sanitizeCellValue } from "../importHelpers.js";

const router = Router();

router.post("/bulk-upsert", requireAuth, async (req, res) => {
  const rows = req.body?.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ success: false, error: "No rows to import." });
  }

  const customerNames = [...new Set(
    rows.map(r => String(r?.Customer ?? "").trim()).filter(Boolean)
  )];

  if (customerNames.length === 0) {
    return res.status(400).json({ success: false, error: "All rows are missing Customer." });
  }

  // Fetch existing customers so we can compare and skip unchanged ones.
  const { data: existingRows, error: fetchErr } = await supabase
    .from("customers")
    .select("id, entity_id, data")
    .eq("tenant_id", req.tenantId)
    .in("entity_id", customerNames);

  if (fetchErr) {
    console.error("customers bulk fetch failed:", fetchErr);
    return res.status(500).json({ success: false, error: "Failed to look up existing customers." });
  }

  const byCustomer = new Map((existingRows || []).map(r => [r.entity_id, r]));

  const toInsert = [];
  const toUpdate = [];
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const errors = [];
  const insertedCustomers = [];
  const updatedCustomers = [];

  rows.forEach((rowData, index) => {
    const customerKey = String(rowData?.Customer ?? "").trim();
    if (!customerKey) {
      skipped++;
      errors.push({ row: index + 1, error: "Missing Customer" });
      return;
    }

    // Sanitize all field values.
    const sanitized = {};
    for (const [field, value] of Object.entries(rowData || {})) {
      sanitized[field] = typeof value === "string" ? sanitizeCellValue(value) : value;
    }
    sanitized.Customer = customerKey;

    const existing = byCustomer.get(customerKey);
    if (!existing) {
      toInsert.push({ tenant_id: req.tenantId, entity_id: customerKey, data: sanitized });
      insertedCustomers.push(customerKey);
      inserted++;
    } else {
      // Skip if nothing actually changed.
      const changed = Object.entries(sanitized).some(([field, value]) => {
        if (field === "Customer") return false;
        return String(existing.data?.[field] ?? "").trim() !== String(value ?? "").trim();
      });
      if (!changed) { skipped++; return; }
      toUpdate.push({ id: existing.id, data: { ...(existing.data || {}), ...sanitized } });
      updatedCustomers.push(customerKey);
      updated++;
    }
  });

  if (toInsert.length > 0) {
    const { error: insertErr } = await supabase.from("customers").insert(toInsert);
    if (insertErr) {
      console.error("customers bulk insert failed:", insertErr);
      return res.status(500).json({ success: false, error: "Failed to insert customers." });
    }
  }

  for (const row of toUpdate) {
    const { error: updateErr } = await supabase
      .from("customers")
      .update({ data: row.data })
      .eq("id", row.id)
      .eq("tenant_id", req.tenantId);
    if (updateErr) {
      console.error("customers bulk update failed:", updateErr);
      errors.push({ error: updateErr.message });
    }
  }

  return res.json({ success: true, inserted, updated, skipped, errors, insertedCustomers, updatedCustomers });
});

export default router;
