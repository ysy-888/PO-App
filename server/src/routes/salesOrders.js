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
import { sendEmail } from "../email.js";
import { buildCustomerEmailHtml } from "../emailTemplates.js";
import { archiveAttachmentsToDrive } from "../google.js";
import { buildSalesOrderPdfAttachment } from "../salesOrderPdf.js";
import { createMentionNotifications } from "./notifications.js";
import { fetchTenantUsers } from "../userDirectory.js";

const router = Router();

// ── Outreach constants ────────────────────────────────────────────────────────

const OUTREACH_METHODS = new Set(["email", "phone", "text", "instagram", "facebook", "shopify"]);
const OUTREACH_STATUSES = new Set(["", "No Response", "Awaiting reply", "Order Approved"]);

/**
 * Customer outreach email templates. The body supports {customer} and
 * {soNumber} placeholders; the shared customer email shell supplies the
 * general design (header, footer, styling).
 */
const OUTREACH_EMAIL_TEMPLATES = {
  outreach1: {
    label: "Outreach email 1",
    subject: (soNum) => `[ELEVATOR DISCO] Sales Order #${soNum} — Order Details`,
    body: (customer, soNum) => [
      `Hi ${customer || "there"},`,
      "",
      `Thank you for your order! Please find attached the details for your sales order #${soNum}.`,
      "",
      "Kindly review and confirm at your earliest convenience. If anything needs to be adjusted, just reply to this email and we'll take care of it.",
      "",
      "Best regards,",
      "Elevator Disco",
      "www.elevatordisco.com",
    ].join("\n"),
  },
  outreach2: {
    label: "Outreach email 2",
    subject: (soNum) => `[ELEVATOR DISCO] Following up — Sales Order #${soNum}`,
    body: (customer, soNum) => [
      `Hi ${customer || "there"},`,
      "",
      `Just following up on our previous email regarding sales order #${soNum} — the order details are attached again for your convenience.`,
      "",
      "Please let us know if you'd like to confirm the order as-is or make any changes. We want to make sure everything ships on schedule for you.",
      "",
      "Best regards,",
      "Elevator Disco",
      "www.elevatordisco.com",
    ].join("\n"),
  },
};

/** Fetch a sales order row by SO number; returns { row, errorResponse }. */
async function fetchSalesOrderRow(tenantId, soNumber) {
  const entityId = salesOrderEntityId(soNumber);
  if (!entityId) return { row: null, status: 400, error: "Invalid soNumber." };

  const { data: existing, error: fetchErr } = await supabase
    .from("sales_orders")
    .select("id, data")
    .eq("tenant_id", tenantId)
    .eq("entity_id", entityId)
    .single();

  if (fetchErr || !existing) return { row: null, status: 404, error: "Sales order not found." };
  return { row: existing };
}

/** Persist a merged data patch onto a fetched sales order row. */
async function updateSalesOrderData(tenantId, row, patch) {
  const updatedData = { ...(row.data || {}), ...patch };
  const { error } = await supabase
    .from("sales_orders")
    .update({ data: updatedData })
    .eq("id", row.id)
    .eq("tenant_id", tenantId);
  if (error) throw error;
  return updatedData;
}

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
// Body: { soNumber, text, mentions?: [{ id, label }] } — mentioned tenant
// members each receive a notification.
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

  // Validate mentions against actual tenant members; keep label snapshots
  // for highlight rendering.
  let mentions = [];
  const rawMentions = Array.isArray(req.body?.mentions) ? req.body.mentions.slice(0, 20) : [];
  if (rawMentions.length > 0) {
    try {
      const members = await fetchTenantUsers(req.tenantId);
      const byId = new Map(members.map(u => [u.id, u]));
      const seen = new Set();
      mentions = rawMentions
        .map(m => ({ id: String(m?.id ?? "").trim(), label: String(m?.label ?? "").trim().slice(0, 120) }))
        .filter(m => m.id && m.label && byId.has(m.id) && !seen.has(m.id) && seen.add(m.id));
    } catch (err) {
      console.warn("comment mention validation failed:", err.message);
      mentions = [];
    }
  }

  const storedText = commentText.slice(0, 2000);
  const comment = {
    // authorId lets the client resolve the current display name at render
    // time; author is an email snapshot for legacy/fallback display.
    authorId: req.userId,
    author: req.userEmail || "Unknown",
    text: storedText,
    at: new Date().toISOString(),
  };
  if (mentions.length > 0) comment.mentions = mentions;

  const comments = Array.isArray(existing.data?.Comments) ? existing.data.Comments.slice() : [];
  comments.push(comment);

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

  // Notify mentioned users (never the author; never blocks the comment).
  const notifyIds = mentions.map(m => m.id).filter(id => id !== req.userId);
  if (notifyIds.length > 0) {
    const soData = existing.data || {};
    await createMentionNotifications({
      tenantId: req.tenantId,
      userIds: notifyIds,
      data: {
        type: "so_comment_mention",
        soNumber: String(soData["SO #"] ?? soNumber).trim(),
        customer: String(soData["Customer"] ?? "").trim(),
        customerPo: String(soData["Customer PO #"] ?? "").trim(),
        preview: storedText.slice(0, 160),
        fromId: req.userId,
        from: req.userEmail || "Unknown",
        at: comment.at,
      },
    });
  }

  return res.json({ success: true, comments });
});

// ── Sales Portal Memo (editable by internal + showroom portal users) ──

router.post("/portal-memo", requireAuth, async (req, res) => {
  const { soNumber, memo } = req.body ?? {};
  if (!soNumber && soNumber !== 0) {
    return res.status(400).json({ success: false, error: "Missing soNumber." });
  }

  try {
    const { row, status, error } = await fetchSalesOrderRow(req.tenantId, soNumber);
    if (!row) return res.status(status).json({ success: false, error });

    const value = String(memo ?? "").trim();
    await updateSalesOrderData(req.tenantId, row, { "Sales Portal Memo": value });
    return res.json({ success: true, memo: value });
  } catch (err) {
    console.error("sales_orders portal-memo failed:", err);
    return res.status(500).json({ success: false, error: "Failed to save Sales Portal Memo." });
  }
});

// ── Outreach log / status / email ────────────────────────────────────────────

router.post("/outreach-log", requireAuth, async (req, res) => {
  const { soNumber, entry } = req.body ?? {};
  if (!soNumber && soNumber !== 0) {
    return res.status(400).json({ success: false, error: "Missing soNumber." });
  }
  const method = String(entry?.method ?? "").trim().toLowerCase();
  if (!OUTREACH_METHODS.has(method)) {
    return res.status(400).json({ success: false, error: "Invalid outreach method." });
  }
  const date = String(entry?.date ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ success: false, error: "Entry date is required (YYYY-MM-DD)." });
  }
  const notes = String(entry?.notes ?? "").trim().slice(0, 2000);

  try {
    const { row, status, error } = await fetchSalesOrderRow(req.tenantId, soNumber);
    if (!row) return res.status(status).json({ success: false, error });

    const log = Array.isArray(row.data?.["Outreach Log"]) ? row.data["Outreach Log"].slice() : [];
    log.push({
      at: date,
      method,
      notes,
      manual: true,
      authorId: req.userId,
      author: req.userEmail || "Unknown",
      createdAt: new Date().toISOString(),
    });

    await updateSalesOrderData(req.tenantId, row, { "Outreach Log": log });
    return res.json({ success: true, outreachLog: log });
  } catch (err) {
    console.error("sales_orders outreach-log failed:", err);
    return res.status(500).json({ success: false, error: "Failed to save outreach log entry." });
  }
});

router.post("/outreach-status", requireAuth, async (req, res) => {
  const { soNumber } = req.body ?? {};
  const status = String(req.body?.status ?? "").trim();
  if (!soNumber && soNumber !== 0) {
    return res.status(400).json({ success: false, error: "Missing soNumber." });
  }
  if (!OUTREACH_STATUSES.has(status)) {
    return res.status(400).json({ success: false, error: "Invalid outreach status." });
  }

  try {
    const { row, status: httpStatus, error } = await fetchSalesOrderRow(req.tenantId, soNumber);
    if (!row) return res.status(httpStatus).json({ success: false, error });

    await updateSalesOrderData(req.tenantId, row, { "Outreach Status": status });
    return res.json({ success: true, outreachStatus: status });
  } catch (err) {
    console.error("sales_orders outreach-status failed:", err);
    return res.status(500).json({ success: false, error: "Failed to save outreach status." });
  }
});

/**
 * POST /api/sales-orders/outreach-email
 * Body: { soNumber, template: "outreach1" | "outreach2", to?: string }
 * Sends a customer outreach email (general email design) with the Sales
 * Order details PDF attached, then appends an entry to the Outreach Log.
 * The recipient comes from the Customers DB unless `to` overrides it.
 */
router.post("/outreach-email", requireAuth, async (req, res) => {
  const { soNumber } = req.body ?? {};
  const templateKey = String(req.body?.template ?? "").trim();
  if (!soNumber && soNumber !== 0) {
    return res.status(400).json({ success: false, error: "Missing soNumber." });
  }
  const template = OUTREACH_EMAIL_TEMPLATES[templateKey];
  if (!template) {
    return res.status(400).json({ success: false, error: "Unknown outreach email template." });
  }

  try {
    const { row, status, error } = await fetchSalesOrderRow(req.tenantId, soNumber);
    if (!row) return res.status(status).json({ success: false, error });

    const soData = row.data || {};
    const soNum = String(soData["SO #"] ?? soNumber).trim();
    const customerName = String(soData["Customer"] ?? "").trim();

    // Recipient: explicit override, else the customer record's email.
    let to = String(req.body?.to ?? "").trim();
    if (!to && customerName) {
      const { data: customerRow } = await supabase
        .from("customers")
        .select("data")
        .eq("tenant_id", req.tenantId)
        .eq("entity_id", customerName)
        .maybeSingle();
      to = String(customerRow?.data?.["Email"] ?? "").trim();
    }
    if (!to) {
      return res.status(400).json({
        success: false,
        error: `No email on file for customer "${customerName}". Add one in the Customers tab or enter an address.`,
      });
    }

    const bodyText = template.body(customerName, soNum);
    const attachment = await buildSalesOrderPdfAttachment(supabase, req.tenantId, soData);

    const result = await sendEmail({
      to,
      subject: template.subject(soNum),
      text: bodyText,
      html: buildCustomerEmailHtml(bodyText),
      attachments: [attachment],
    });
    if (!result.emailSent) {
      return res.json({ success: false, error: result.emailError || "Send failed.", emailSent: false });
    }
    archiveAttachmentsToDrive([attachment]);

    // Auto-log the send.
    const log = Array.isArray(soData["Outreach Log"]) ? soData["Outreach Log"].slice() : [];
    log.push({
      at: new Date().toISOString(),
      method: "email",
      notes: `Sent "${template.label}" to ${to}`,
      template: templateKey,
      authorId: req.userId,
      author: req.userEmail || "Unknown",
    });
    await updateSalesOrderData(req.tenantId, row, { "Outreach Log": log });

    return res.json({ success: true, emailSent: true, to, outreachLog: log });
  } catch (err) {
    console.error("sales_orders outreach-email failed:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to send outreach email." });
  }
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
