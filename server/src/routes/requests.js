/**
 * Request routes — EXF, ASN, Delivery, Pickup, Approval requests.
 *
 * Email actions are handled through the API and use Apps Script only as the
 * mail relay, so Supabase remains the source of truth for status fields.
 *
 * POST /api/requests/exf/create
 * POST /api/requests/asn/create
 * POST /api/requests/asn/update
 * POST /api/requests/delivery/create
 * POST /api/requests/delivery/update
 * POST /api/requests/pickup/create
 * POST /api/requests/pickup/update
 * POST /api/requests/approval/create
 * POST /api/requests/approval/update
 */

import { Router } from "express";
import supabase from "../supabase.js";
import { requireAuth } from "../auth.js";
import { sanitizeUpdates } from "../importHelpers.js";
import { sendEmail } from "../email.js";
import {
  buildApprovalEmail,
  buildAsnEmail,
  buildDeliveryPickupEmail,
  buildExfEmail,
} from "../emailTemplates.js";
import {
  buildAsnPickupEmailAttachments,
  buildRequestEmailAttachments,
} from "../packingListPrint/index.js";
import { getCartonWeightLbs } from "../packingListPrint/helpers.js";

const router = Router();

// ── ID generators ─────────────────────────────────────────────────────────────

async function nextId(tenantId, tableName, prefix, padLen = 4) {
  const { data } = await supabase.from(tableName).select("entity_id").eq("tenant_id", tenantId);
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  let max = 0;
  for (const row of data || []) {
    const m = re.exec(String(row.entity_id ?? ""));
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}-${String(max + 1).padStart(padLen, "0")}`;
}

// ── Bulk PO field update ──────────────────────────────────────────────────────

async function updatePoFields(tenantId, poNumbers, updates) {
  if (!poNumbers || poNumbers.length === 0) return;
  const { data: rows } = await supabase
    .from("purchase_orders")
    .select("id, po_number, data")
    .eq("tenant_id", tenantId)
    .in("po_number", poNumbers.map(String));

  for (const row of rows || []) {
    await supabase
      .from("purchase_orders")
      .update({ data: { ...(row.data || {}), ...sanitizeUpdates(updates) } })
      .eq("id", row.id)
      .eq("tenant_id", tenantId);
  }
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function splitPoNumbers(value) {
  if (Array.isArray(value)) return value.map(String).map(s => s.trim()).filter(Boolean);
  return String(value ?? "").split(",").map(s => s.trim()).filter(Boolean);
}

async function fetchPoRows(tenantId, poNumbers) {
  const normalized = splitPoNumbers(poNumbers);
  if (normalized.length === 0) return [];
  const { data, error } = await supabase
    .from("purchase_orders")
    .select("id, po_number, data")
    .eq("tenant_id", tenantId)
    .in("po_number", normalized.map(String));
  if (error) throw error;
  const byPo = new Map((data || []).map(row => [String(row.po_number), row.data || {}]));
  const orderedRows = normalized.map(po => byPo.get(String(po))).filter(Boolean);
  if (orderedRows.length === 0) return [];

  const { data: listData, error: listErr } = await supabase
    .from("packing_lists")
    .select("entity_id, data")
    .eq("tenant_id", tenantId);
  if (listErr) throw listErr;

  const listIdToPo = new Map();
  for (const row of listData || []) {
    const po = String(row.data?.["PO #"] ?? "").trim();
    if (!po || !normalized.includes(po)) continue;
    const listId = String(row.data?.["Packing List ID"] ?? row.entity_id ?? "").trim();
    if (listId) listIdToPo.set(listId, po);
  }

  const weightsByPo = new Map();
  const listIds = [...listIdToPo.keys()];
  if (listIds.length > 0) {
    const { data: cartonData, error: cartonErr } = await supabase
      .from("packing_cartons")
      .select("packing_list_entity_id, data")
      .eq("tenant_id", tenantId)
      .in("packing_list_entity_id", listIds);
    if (cartonErr) throw cartonErr;

    for (const row of cartonData || []) {
      const listId = String(row.packing_list_entity_id ?? "").trim();
      const po = listIdToPo.get(listId);
      if (!po) continue;
      weightsByPo.set(po, (weightsByPo.get(po) || 0) + getCartonWeightLbs(row.data || {}));
    }
  }

  return orderedRows.map(row => {
    const po = String(row["PO #"] ?? "").trim();
    const weight = weightsByPo.get(po) || 0;
    return { ...row, Weight: weight > 0 ? weight : "" };
  });
}

function emailFieldsFromResult(result, hasRecipient, now = todayYmd()) {
  return {
    "Email Status": result.emailSent ? "Sent" : (hasRecipient ? "Failed" : "Not Sent"),
    "Email Sent At": result.emailSent ? now : "",
    "Last Email Attempt At": hasRecipient ? now : "",
    "Email Error": result.emailError || "",
    "Updated At": now,
  };
}

async function updateRequestData(tableName, tenantId, entityId, data) {
  const { error } = await supabase
    .from(tableName)
    .update({ data })
    .eq("tenant_id", tenantId)
    .eq("entity_id", entityId);
  if (error) throw error;
}

async function getRequestRow(tableName, tenantId, entityId) {
  const { data, error } = await supabase
    .from(tableName)
    .select("id, entity_id, data")
    .eq("tenant_id", tenantId)
    .eq("entity_id", entityId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function sendAndStoreRequestEmail({ tenantId, tableName, entityId, type, requestData, poRows = [], poRow = null }) {
  const builders = {
    exf: () => buildExfEmail(entityId, requestData, poRows),
    asn: () => buildAsnEmail(entityId, requestData, poRows),
    delivery: () => buildDeliveryPickupEmail("Delivery", entityId, requestData, poRows),
    pickup: () => buildDeliveryPickupEmail("Pickup", entityId, requestData, poRows),
    approval: () => buildApprovalEmail(entityId, requestData, poRow || poRows[0] || {}),
  };
  const message = builders[type]();
  const hasRecipient = Boolean(String(message.to ?? "").trim());
  let attachments = [];
  if (["asn", "delivery", "pickup"].includes(type)) {
    attachments = await buildRequestEmailAttachments(supabase, tenantId, {
      type,
      entityId,
      requestData,
      poRows,
    });
  }
  const result = await sendEmail({ ...message, attachments });
  const fields = emailFieldsFromResult(result, hasRecipient);
  const updatedData = { ...(requestData || {}), ...fields };
  await updateRequestData(tableName, tenantId, entityId, updatedData);
  return { ...result, data: updatedData };
}

async function sendAndStoreAsnCarrierEmail({ tenantId, requestId, requestData, poRows }) {
  const carrierEmail = String(requestData["Carrier Email"] ?? "").trim();
  const carrierCc = String(requestData["Carrier CC"] ?? "").trim();
  const pickupRequestId = `ASN Pickup ${requestId}`;
  const pickupData = {
    "Pickup Date": requestData["ASN Date"] ?? "",
    "Request Date": todayYmd(),
    From: requestData["Carrier"] ?? "",
    To: requestData["Buyer"] ?? "",
    "Email To": carrierEmail,
    "Email CC": carrierCc,
    "Pickup Req Notes": `ASN pickup for ${requestId}`,
  };

  const message = buildDeliveryPickupEmail("Pickup", pickupRequestId, pickupData, poRows);
  // Override to/cc with stored carrier fields
  message.to = carrierEmail;
  message.cc = carrierCc;
  const hasRecipient = Boolean(carrierEmail);

  const attachments = await buildAsnPickupEmailAttachments(supabase, tenantId, {
    asnRequestId: requestId,
    asnData: requestData,
    poRows,
    labelInputs: [],
  });

  const result = await sendEmail({ ...message, attachments });
  const now = todayYmd();
  const fields = {
    "ASN Pickup Email Status": result.emailSent ? "Sent" : (hasRecipient ? "Failed" : "Not Sent"),
    "ASN Pickup Email Sent At": result.emailSent ? now : "",
    "ASN Pickup Email Error": result.emailError || "",
    "Updated At": now,
  };
  const updatedData = { ...requestData, ...fields };
  await updateRequestData("asn_requests", tenantId, requestId, updatedData);
  return { emailSent: result.emailSent, emailError: result.emailError, data: updatedData };
}

async function resendStoredRequestEmail({ tenantId, tableName, entityId, type }) {
  const row = await getRequestRow(tableName, tenantId, entityId);
  if (!row) return { notFound: true };
  const requestData = row.data || {};
  const poRows = await fetchPoRows(tenantId, splitPoNumbers(requestData["PO Numbers"] || requestData["PO #"]));
  return sendAndStoreRequestEmail({
    tenantId,
    tableName,
    entityId,
    type,
    requestData,
    poRows,
    poRow: poRows[0] || null,
  });
}

async function getContactEmailInfo(tenantId, entityName) {
  const target = String(entityName ?? "").trim().toLowerCase();
  if (!target) return { email: "", cc: "" };
  const { data } = await supabase
    .from("contacts")
    .select("data")
    .eq("tenant_id", tenantId);
  const row = (data || [])
    .map(item => item.data || {})
    .reverse()
    .find(item => String(item.Name ?? item.Entity ?? "").trim().toLowerCase() === target);
  return {
    email: String(row?.Email ?? "").trim(),
    cc: String(row?.CC ?? row?.Cc ?? "").trim(),
  };
}

// ── EXF REQUEST ───────────────────────────────────────────────────────────────

router.post("/exf/create", requireAuth, async (req, res) => {
  const { poNumbers, exfDate, exfReqNotes, vendorEmail, vendorCc, memos, shipMethods } = req.body || {};
  if (!Array.isArray(poNumbers) || poNumbers.length === 0) {
    return res.status(400).json({ success: false, error: "poNumbers are required." });
  }

  try {
    const requestId = await nextId(req.tenantId, "exf_requests", "EXF");
    const now = todayYmd();

    // Resolve vendor name from any matching PO.
    const { data: poRows } = await supabase
      .from("purchase_orders").select("data").eq("tenant_id", req.tenantId).in("po_number", poNumbers.map(String));
    const vendor = poRows?.[0]?.data?.["Vendor"] ?? "";

    const requestData = {
      "EXF Request ID": requestId,
      "EXF Date": exfDate ?? "",
      "EXF Req Submit Date": now,
      "Vendor": vendor,
      "Vendor Email": vendorEmail ?? "",
      "EXF Req CC": vendorCc ?? "",
      "EXF Req Notes": exfReqNotes ?? "",
      "PO Numbers": poNumbers.join(", "),
      "PO Count": poNumbers.length,
      "Email Status": "Not Sent",
      "Email Sent At": "",
      "Email Error": "",
      "Created At": now,
      "Updated At": now,
    };

    const { error: insertErr } = await supabase.from("exf_requests").insert({
      tenant_id: req.tenantId, entity_id: requestId, data: requestData,
    });
    if (insertErr) throw insertErr;

    const emailResult = await sendAndStoreRequestEmail({
      tenantId: req.tenantId,
      tableName: "exf_requests",
      entityId: requestId,
      type: "exf",
      requestData,
      poRows: (poRows || []).map(row => row.data || {}),
    });

    // Update linked POs with EXF fields.
    const poUpdateBase = {
      "EXF Requested": true,
      "EXF Request ID": requestId,
      "EXF Date": exfDate ?? "",
      "EXF Req Date": now,
    };

    for (const po of (poRows || [])) {
      const poNumber = po.data?.["PO #"];
      if (!poNumber) continue;
      const idx = poNumbers.findIndex(n => String(n) === String(poNumber));
      const perPo = { ...poUpdateBase };
      if (memos && memos[idx] !== undefined) perPo["EXF Memo"] = memos[idx];
      if (shipMethods && shipMethods[idx] !== undefined) perPo["Ship Method"] = shipMethods[idx];
      await supabase.from("purchase_orders")
        .update({ data: { ...(po.data || {}), ...sanitizeUpdates(perPo) } })
        .eq("tenant_id", req.tenantId)
        .eq("data->>'PO #'", poNumber);
    }

    return res.json({
      success: true,
      exfRequestId: requestId,
      emailSent: emailResult.emailSent,
      emailError: emailResult.emailError,
      request: emailResult.data,
    });
  } catch (err) {
    console.error("exf create failed:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to create EXF request." });
  }
});

// ── ASN REQUEST ───────────────────────────────────────────────────────────────

router.post("/asn/create", requireAuth, async (req, res) => {
  const { poNumbers, request, sendBuyer = true, sendCarrier = true } = req.body || {};
  if (!Array.isArray(poNumbers) || poNumbers.length === 0) {
    return res.status(400).json({ success: false, error: "poNumbers are required." });
  }

  try {
    const requestId = await nextId(req.tenantId, "asn_requests", "ASN");
    const now = todayYmd();

    const requestData = sanitizeUpdates({
      "ASN Request ID": requestId,
      ...(request || {}),
      "PO Numbers": poNumbers.join(", "),
      "PO Count": poNumbers.length,
      "Email Status": "Not Sent",
      "Email Sent At": "",
      "Email Error": "",
      "ASN Pickup Email Status": "Not Sent",
      "ASN Pickup Email Sent At": "",
      "ASN Pickup Email Error": "",
      "Created At": now,
      "Updated At": now,
    });

    const { error: insertErr } = await supabase.from("asn_requests").insert({
      tenant_id: req.tenantId, entity_id: requestId, data: requestData,
    });
    if (insertErr) throw insertErr;

    const poRows = await fetchPoRows(req.tenantId, poNumbers);

    // Send buyer ASN email
    let buyerEmailResult = { emailSent: false, emailError: "Skipped", data: requestData };
    if (sendBuyer) {
      buyerEmailResult = await sendAndStoreRequestEmail({
        tenantId: req.tenantId,
        tableName: "asn_requests",
        entityId: requestId,
        type: "asn",
        requestData,
        poRows,
      });
    }

    // Send carrier pickup email
    let carrierEmailResult = { emailSent: false, emailError: "Skipped" };
    if (sendCarrier) {
      const latestData = buyerEmailResult.data || requestData;
      carrierEmailResult = await sendAndStoreAsnCarrierEmail({
        tenantId: req.tenantId,
        requestId,
        requestData: latestData,
        poRows,
      });
    }

    // Merge final status into one update if carrier was skipped
    if (!sendBuyer || !sendCarrier) {
      const merged = {
        ...(buyerEmailResult.data || requestData),
        ...(!sendBuyer ? {
          "Email Status": "",
          "Email Sent At": "",
          "Email Error": "",
        } : {}),
        ...(!sendCarrier ? {
          "ASN Pickup Email Status": "",
          "ASN Pickup Email Sent At": "",
          "ASN Pickup Email Error": "",
        } : {}),
        "Updated At": now,
      };
      await updateRequestData("asn_requests", req.tenantId, requestId, merged);
      buyerEmailResult.data = merged;
    }

    await updatePoFields(req.tenantId, poNumbers, {
      "ASN Request ID": requestId,
      "ASN Requested": true,
      "ASN Date": request?.["ASN Date"] ?? "",
      "ASN Req Date": now,
    });

    return res.json({
      success: true,
      asnRequestId: requestId,
      emailSent: buyerEmailResult.emailSent,
      emailError: buyerEmailResult.emailError,
      carrierEmailSent: carrierEmailResult.emailSent,
      carrierEmailError: carrierEmailResult.emailError,
      request: buyerEmailResult.data,
    });
  } catch (err) {
    console.error("asn create failed:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to create ASN request." });
  }
});

router.post("/asn/update", requireAuth, async (req, res) => {
  const { asnRequestId, request } = req.body || {};
  if (!asnRequestId) return res.status(400).json({ success: false, error: "asnRequestId is required." });

  try {
    const { data: existing, error: fetchErr } = await supabase
      .from("asn_requests").select("id, data").eq("tenant_id", req.tenantId).eq("entity_id", asnRequestId).maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!existing) return res.status(404).json({ success: false, error: "ASN request not found." });

    const now = todayYmd();
    const merged = { ...(existing.data || {}), ...sanitizeUpdates(request || {}), "Updated At": now };
    const { error } = await supabase.from("asn_requests").update({ data: merged }).eq("id", existing.id).eq("tenant_id", req.tenantId);
    if (error) throw error;

    // Mirror ASN request fields to all linked POs when linked POs or ASN Date change.
    if (request?.["PO Numbers"] !== undefined || request?.["ASN Date"] !== undefined) {
      const poNumbers = splitPoNumbers(merged["PO Numbers"] || "");
      if (poNumbers.length > 0) {
        await updatePoFields(req.tenantId, poNumbers, {
          "ASN Request ID": asnRequestId,
          "ASN Requested": true,
          "ASN Date": merged["ASN Date"] ?? "",
          "ASN Req Date": merged["Request Date"] ?? "",
        });
      }
    }

    return res.json({ success: true, request: merged });
  } catch (err) {
    console.error("asn update failed:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to update ASN request." });
  }
});

// ── DELIVERY REQUEST ──────────────────────────────────────────────────────────

router.post("/delivery/create", requireAuth, async (req, res) => {
  const { poNumbers, request } = req.body || {};

  try {
    const requestId = await nextId(req.tenantId, "delivery_requests", "DR");
    const now = todayYmd();

    const requestData = sanitizeUpdates({
      "Delivery Request ID": requestId,
      ...(request || {}),
      "PO Numbers": Array.isArray(poNumbers) ? poNumbers.join(", ") : "",
      "PO Count": Array.isArray(poNumbers) ? poNumbers.length : 0,
      "Email Status": "Not Sent",
      "Created At": now,
      "Updated At": now,
    });

    const { error } = await supabase.from("delivery_requests").insert({
      tenant_id: req.tenantId, entity_id: requestId, data: requestData,
    });
    if (error) throw error;

    const poRows = await fetchPoRows(req.tenantId, poNumbers);
    const emailResult = await sendAndStoreRequestEmail({
      tenantId: req.tenantId,
      tableName: "delivery_requests",
      entityId: requestId,
      type: "delivery",
      requestData,
      poRows,
    });

    if (Array.isArray(poNumbers) && poNumbers.length > 0) {
      await updatePoFields(req.tenantId, poNumbers, {
        "Delivery Request ID": requestId,
        "Delivery Requested": true,
        "Delivery Date": request?.["Delivery Date"] ?? "",
        "Delivery Req Date": now,
      });
    }

    return res.json({
      success: true,
      deliveryRequestId: requestId,
      emailSent: emailResult.emailSent,
      emailError: emailResult.emailError,
      request: emailResult.data,
    });
  } catch (err) {
    console.error("delivery create failed:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to create delivery request." });
  }
});

router.post("/delivery/update", requireAuth, async (req, res) => {
  const { deliveryRequestId, request } = req.body || {};
  if (!deliveryRequestId) return res.status(400).json({ success: false, error: "deliveryRequestId is required." });

  try {
    const { data: existing, error: fetchErr } = await supabase
      .from("delivery_requests").select("id, data").eq("tenant_id", req.tenantId).eq("entity_id", deliveryRequestId).maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!existing) return res.status(404).json({ success: false, error: "Delivery request not found." });

    const now = todayYmd();
    const merged = { ...(existing.data || {}), ...sanitizeUpdates(request || {}), "Updated At": now };
    const { error } = await supabase.from("delivery_requests").update({ data: merged }).eq("id", existing.id).eq("tenant_id", req.tenantId);
    if (error) throw error;

    return res.json({ success: true });
  } catch (err) {
    console.error("delivery update failed:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to update delivery request." });
  }
});

// ── PICKUP REQUEST ────────────────────────────────────────────────────────────

router.post("/pickup/create", requireAuth, async (req, res) => {
  const { poNumbers, request } = req.body || {};

  try {
    const requestId = await nextId(req.tenantId, "pickup_requests", "PR");
    const now = todayYmd();

    const requestData = sanitizeUpdates({
      "Pickup Request ID": requestId,
      ...(request || {}),
      "PO Numbers": Array.isArray(poNumbers) ? poNumbers.join(", ") : "",
      "PO Count": Array.isArray(poNumbers) ? poNumbers.length : 0,
      "Email Status": "Not Sent",
      "Created At": now,
      "Updated At": now,
    });

    const { error } = await supabase.from("pickup_requests").insert({
      tenant_id: req.tenantId, entity_id: requestId, data: requestData,
    });
    if (error) throw error;

    const poRows = await fetchPoRows(req.tenantId, poNumbers);
    const emailResult = await sendAndStoreRequestEmail({
      tenantId: req.tenantId,
      tableName: "pickup_requests",
      entityId: requestId,
      type: "pickup",
      requestData,
      poRows,
    });

    if (Array.isArray(poNumbers) && poNumbers.length > 0) {
      await updatePoFields(req.tenantId, poNumbers, {
        "Pickup Request ID": requestId,
        "Pickup Requested": true,
        "Pickup Date": request?.["Pickup Date"] ?? "",
        "Pickup Req Date": now,
      });
    }

    return res.json({
      success: true,
      pickupRequestId: requestId,
      emailSent: emailResult.emailSent,
      emailError: emailResult.emailError,
      request: emailResult.data,
    });
  } catch (err) {
    console.error("pickup create failed:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to create pickup request." });
  }
});

router.post("/pickup/update", requireAuth, async (req, res) => {
  const { pickupRequestId, request } = req.body || {};
  if (!pickupRequestId) return res.status(400).json({ success: false, error: "pickupRequestId is required." });

  try {
    const { data: existing, error: fetchErr } = await supabase
      .from("pickup_requests").select("id, data").eq("tenant_id", req.tenantId).eq("entity_id", pickupRequestId).maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!existing) return res.status(404).json({ success: false, error: "Pickup request not found." });

    const now = todayYmd();
    const merged = { ...(existing.data || {}), ...sanitizeUpdates(request || {}), "Updated At": now };
    const { error } = await supabase.from("pickup_requests").update({ data: merged }).eq("id", existing.id).eq("tenant_id", req.tenantId);
    if (error) throw error;

    return res.json({ success: true });
  } catch (err) {
    console.error("pickup update failed:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to update pickup request." });
  }
});

// ── APPROVAL REQUEST ──────────────────────────────────────────────────────────

router.post("/approval/create", requireAuth, async (req, res) => {
  const { poNumber, approval } = req.body || {};
  if (!poNumber) return res.status(400).json({ success: false, error: "poNumber is required." });

  try {
    const requestId = await nextId(req.tenantId, "approvals", "APR");
    const now = todayYmd();

    const approvalData = sanitizeUpdates({
      "Approval ID": requestId,
      "PO #": poNumber,
      ...(approval || {}),
      "Email Status": "Not Sent",
      "Created At": now,
      "Updated At": now,
    });

    const { error: insertErr } = await supabase.from("approvals").insert({
      tenant_id: req.tenantId, entity_id: requestId, data: approvalData,
    });
    if (insertErr) throw insertErr;

    const poRows = await fetchPoRows(req.tenantId, [poNumber]);
    const emailResult = await sendAndStoreRequestEmail({
      tenantId: req.tenantId,
      tableName: "approvals",
      entityId: requestId,
      type: "approval",
      requestData: approvalData,
      poRows,
      poRow: poRows[0] || null,
    });

    await updatePoFields(req.tenantId, [poNumber], { "Approval ID": requestId });

    return res.json({
      success: true,
      approvalId: requestId,
      emailSent: emailResult.emailSent,
      emailError: emailResult.emailError,
      request: emailResult.data,
    });
  } catch (err) {
    console.error("approval create failed:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to create approval." });
  }
});

router.post("/approval/update", requireAuth, async (req, res) => {
  const { approvalId, status } = req.body || {};
  if (!approvalId) return res.status(400).json({ success: false, error: "approvalId is required." });

  try {
    const { data: existing, error: fetchErr } = await supabase
      .from("approvals").select("id, data").eq("tenant_id", req.tenantId).eq("entity_id", approvalId).maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!existing) return res.status(404).json({ success: false, error: "Approval not found." });

    const now = todayYmd();
    const merged = { ...(existing.data || {}), "Updated At": now };
    if (status !== undefined) merged["Status"] = status;

    const { error: updateErr } = await supabase.from("approvals").update({ data: merged }).eq("id", existing.id).eq("tenant_id", req.tenantId);
    if (updateErr) throw updateErr;

    // Sync status back to PO row if needed.
    const poNumber = String(merged["PO #"] ?? "").trim();
    let poUpdates = {};
    if (status && poNumber) {
      const { data: poRow } = await supabase
        .from("purchase_orders").select("id, data").eq("tenant_id", req.tenantId).eq("po_number", poNumber).maybeSingle();
      if (poRow) {
        const approvalStatusMap = { Approved: "Approved", Rejected: "Rejected" };
        if (approvalStatusMap[status]) {
          poUpdates["N41 Status"] = approvalStatusMap[status];
          await supabase.from("purchase_orders").update({ data: { ...(poRow.data || {}), ...sanitizeUpdates(poUpdates) } })
            .eq("id", poRow.id).eq("tenant_id", req.tenantId);
        }
      }
    }

    return res.json({ success: true, poUpdates });
  } catch (err) {
    console.error("approval update failed:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to update approval." });
  }
});

router.post("/exf/resend-email", requireAuth, async (req, res) => {
  const { exfRequestId } = req.body || {};
  if (!exfRequestId) return res.status(400).json({ success: false, error: "exfRequestId is required." });
  try {
    const result = await resendStoredRequestEmail({
      tenantId: req.tenantId,
      tableName: "exf_requests",
      entityId: exfRequestId,
      type: "exf",
    });
    if (result.notFound) return res.status(404).json({ success: false, error: "EXF request not found." });
    return res.json({ success: true, emailSent: result.emailSent, emailError: result.emailError, request: result.data });
  } catch (err) {
    console.error("exf resend failed:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to resend EXF email." });
  }
});

router.post("/asn/resend-email", requireAuth, async (req, res) => {
  const { asnRequestId } = req.body || {};
  if (!asnRequestId) return res.status(400).json({ success: false, error: "asnRequestId is required." });
  try {
    const result = await resendStoredRequestEmail({
      tenantId: req.tenantId,
      tableName: "asn_requests",
      entityId: asnRequestId,
      type: "asn",
    });
    if (result.notFound) return res.status(404).json({ success: false, error: "ASN request not found." });
    return res.json({ success: true, emailSent: result.emailSent, emailError: result.emailError, request: result.data });
  } catch (err) {
    console.error("asn resend failed:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to resend ASN email." });
  }
});

router.post("/delivery/resend-email", requireAuth, async (req, res) => {
  const { deliveryRequestId } = req.body || {};
  if (!deliveryRequestId) return res.status(400).json({ success: false, error: "deliveryRequestId is required." });
  try {
    const result = await resendStoredRequestEmail({
      tenantId: req.tenantId,
      tableName: "delivery_requests",
      entityId: deliveryRequestId,
      type: "delivery",
    });
    if (result.notFound) return res.status(404).json({ success: false, error: "Delivery request not found." });
    return res.json({ success: true, emailSent: result.emailSent, emailError: result.emailError, request: result.data });
  } catch (err) {
    console.error("delivery resend failed:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to resend delivery email." });
  }
});

router.post("/pickup/resend-email", requireAuth, async (req, res) => {
  const { pickupRequestId } = req.body || {};
  if (!pickupRequestId) return res.status(400).json({ success: false, error: "pickupRequestId is required." });
  try {
    const result = await resendStoredRequestEmail({
      tenantId: req.tenantId,
      tableName: "pickup_requests",
      entityId: pickupRequestId,
      type: "pickup",
    });
    if (result.notFound) return res.status(404).json({ success: false, error: "Pickup request not found." });
    return res.json({ success: true, emailSent: result.emailSent, emailError: result.emailError, request: result.data });
  } catch (err) {
    console.error("pickup resend failed:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to resend pickup email." });
  }
});

router.post("/approval/resend-email", requireAuth, async (req, res) => {
  const { approvalId } = req.body || {};
  if (!approvalId) return res.status(400).json({ success: false, error: "approvalId is required." });
  try {
    const result = await resendStoredRequestEmail({
      tenantId: req.tenantId,
      tableName: "approvals",
      entityId: approvalId,
      type: "approval",
    });
    if (result.notFound) return res.status(404).json({ success: false, error: "Approval not found." });
    return res.json({ success: true, emailSent: result.emailSent, emailError: result.emailError, request: result.data });
  } catch (err) {
    console.error("approval resend failed:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to resend approval email." });
  }
});

router.post("/asn-pickup/send-email", requireAuth, async (req, res) => {
  const { asnRequestId } = req.body || {};
  if (!asnRequestId) return res.status(400).json({ success: false, error: "asnRequestId is required." });

  try {
    const row = await getRequestRow("asn_requests", req.tenantId, asnRequestId);
    if (!row) return res.status(404).json({ success: false, error: "ASN request not found." });
    const asnData = row.data || {};

    const poNumbers = splitPoNumbers(asnData["PO Numbers"]);
    const poRows = await fetchPoRows(req.tenantId, poNumbers);

    const carrierResult = await sendAndStoreAsnCarrierEmail({
      tenantId: req.tenantId,
      requestId: asnRequestId,
      requestData: asnData,
      poRows,
    });

    return res.json({
      success: true,
      emailSent: carrierResult.emailSent,
      emailError: carrierResult.emailError,
      request: carrierResult.data,
    });
  } catch (err) {
    console.error("asn carrier resend failed:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to resend carrier email." });
  }
});

export default router;
