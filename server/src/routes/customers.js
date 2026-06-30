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
import { sendEmail } from "../email.js";
import { buildCustomerEmailHtml } from "../emailTemplates.js";

const router = Router();
const CUSTOMER_EMAIL_SENT_AT_FIELD = "Email Sent At";

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function applyCustomerEmailTemplate(text, customerName) {
  return String(text ?? "").replace(/CUSTOMER/g, String(customerName ?? "").trim());
}

async function getCustomerRow(tenantId, customer) {
  const { data, error } = await supabase
    .from("customers")
    .select("id, entity_id, data")
    .eq("tenant_id", tenantId)
    .eq("entity_id", customer)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function markCustomerEmailSent(tenantId, row, sentAt) {
  const updated = {
    ...(row.data || {}),
    [CUSTOMER_EMAIL_SENT_AT_FIELD]: sentAt,
  };
  const { error } = await supabase
    .from("customers")
    .update({ data: updated })
    .eq("tenant_id", tenantId)
    .eq("id", row.id);
  if (error) throw error;
  return updated;
}

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

router.post("/send-email", requireAuth, async (req, res) => {
  const { to, subject, body, customer } = req.body || {};
  const customerKey = String(customer ?? "").trim();
  const result = await sendEmail({
    to,
    subject,
    text: body,
    html: buildCustomerEmailHtml(body),
  });
  if (!result.emailSent) {
    return res.json({ success: false, error: result.emailError || "Send failed.", emailSent: false, emailError: result.emailError });
  }

  let sentAt = todayYmd();
  if (customerKey) {
    try {
      const row = await getCustomerRow(req.tenantId, customerKey);
      if (row) await markCustomerEmailSent(req.tenantId, row, sentAt);
    } catch (err) {
      console.error("customer sent timestamp update failed:", err);
      return res.json({
        success: true,
        sentAt,
        emailSent: true,
        emailError: "Email sent, but the sent timestamp could not be saved.",
      });
    }
  }
  return res.json({ success: true, sentAt, emailSent: true, emailError: "" });
});

router.post("/batch-send-email", requireAuth, async (req, res) => {
  const customerKeys = Array.isArray(req.body?.customers)
    ? req.body.customers.map(key => String(key ?? "").trim()).filter(Boolean)
    : [];
  const subject = String(req.body?.subject ?? "").trim();
  const body = String(req.body?.body ?? "").trim();

  if (customerKeys.length === 0) {
    return res.status(400).json({ success: false, error: "No customers selected." });
  }
  if (!subject) return res.status(400).json({ success: false, error: "Subject is required." });
  if (!body) return res.status(400).json({ success: false, error: "Message body is required." });

  const { data: rows, error: fetchErr } = await supabase
    .from("customers")
    .select("id, entity_id, data")
    .eq("tenant_id", req.tenantId)
    .in("entity_id", customerKeys);
  if (fetchErr) return res.status(500).json({ success: false, error: "Failed to load customers." });

  const byCustomer = new Map((rows || []).map(row => [row.entity_id, row]));
  const sentCustomers = [];
  const sentAtByCustomer = {};
  const errors = [];

  for (const customerKey of customerKeys) {
    const row = byCustomer.get(customerKey);
    if (!row) {
      errors.push({ customer: customerKey, error: "Customer not found." });
      continue;
    }
    const to = String(row.data?.Email ?? "").trim();
    if (!to) {
      errors.push({ customer: customerKey, error: "No email on file." });
      continue;
    }
    const personalizedSubject = applyCustomerEmailTemplate(subject, customerKey);
    const personalizedBody = applyCustomerEmailTemplate(body, customerKey);
    const result = await sendEmail({
      to,
      subject: personalizedSubject,
      text: personalizedBody,
      html: buildCustomerEmailHtml(personalizedBody),
    });
    if (!result.emailSent) {
      errors.push({ customer: customerKey, error: result.emailError || "Send failed." });
      continue;
    }
    const sentAt = todayYmd();
    try {
      await markCustomerEmailSent(req.tenantId, row, sentAt);
      sentCustomers.push(customerKey);
      sentAtByCustomer[customerKey] = sentAt;
    } catch (err) {
      errors.push({ customer: customerKey, error: "Email sent, but timestamp update failed." });
    }
  }

  if (sentCustomers.length === 0) {
    return res.json({ success: false, error: "No emails were sent.", errors });
  }
  return res.json({
    success: true,
    sent: sentCustomers.length,
    sentCustomers,
    sentAtByCustomer,
    errors,
  });
});

export default router;
