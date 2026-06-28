/**
 * Request routes — EXF, ASN, Delivery, Pickup, Approval requests.
 *
 * Email actions (resend*Email, sendAsnPickupEmail) still call Apps Script and
 * are NOT handled here.  Those routes will be added when email is migrated.
 *
 * POST /api/requests/exf/create
 * POST /api/requests/asn/create
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

// ── EXF REQUEST ───────────────────────────────────────────────────────────────

router.post("/exf/create", requireAuth, async (req, res) => {
  const { poNumbers, exfDate, exfReqNotes, vendorEmail, vendorCc, memos, shipMethods } = req.body || {};
  if (!Array.isArray(poNumbers) || poNumbers.length === 0) {
    return res.status(400).json({ success: false, error: "poNumbers are required." });
  }

  try {
    const requestId = await nextId(req.tenantId, "exf_requests", "EXF");
    const now = new Date().toISOString().slice(0, 10);

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

    return res.json({ success: true, exfRequestId: requestId });
  } catch (err) {
    console.error("exf create failed:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to create EXF request." });
  }
});

// ── ASN REQUEST ───────────────────────────────────────────────────────────────

router.post("/asn/create", requireAuth, async (req, res) => {
  const { poNumbers, request } = req.body || {};
  if (!Array.isArray(poNumbers) || poNumbers.length === 0) {
    return res.status(400).json({ success: false, error: "poNumbers are required." });
  }

  try {
    const requestId = await nextId(req.tenantId, "asn_requests", "ASN");
    const now = new Date().toISOString().slice(0, 10);

    const requestData = sanitizeUpdates({
      "ASN Request ID": requestId,
      ...(request || {}),
      "PO Numbers": poNumbers.join(", "),
      "PO Count": poNumbers.length,
      "Email Status": "Not Sent",
      "Email Sent At": "",
      "Email Error": "",
      "Created At": now,
      "Updated At": now,
    });

    const { error: insertErr } = await supabase.from("asn_requests").insert({
      tenant_id: req.tenantId, entity_id: requestId, data: requestData,
    });
    if (insertErr) throw insertErr;

    await updatePoFields(req.tenantId, poNumbers, {
      "ASN Request ID": requestId,
      "ASN Requested": true,
      "ASN Date": request?.["ASN Date"] ?? "",
      "ASN Req Date": now,
    });

    return res.json({ success: true, asnRequestId: requestId });
  } catch (err) {
    console.error("asn create failed:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to create ASN request." });
  }
});

// ── DELIVERY REQUEST ──────────────────────────────────────────────────────────

router.post("/delivery/create", requireAuth, async (req, res) => {
  const { poNumbers, request } = req.body || {};

  try {
    const requestId = await nextId(req.tenantId, "delivery_requests", "DR");
    const now = new Date().toISOString().slice(0, 10);

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

    if (Array.isArray(poNumbers) && poNumbers.length > 0) {
      await updatePoFields(req.tenantId, poNumbers, {
        "Delivery Request ID": requestId,
        "Delivery Requested": true,
        "Delivery Date": request?.["Delivery Date"] ?? "",
        "Delivery Req Date": now,
      });
    }

    return res.json({ success: true, deliveryRequestId: requestId });
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

    const now = new Date().toISOString().slice(0, 10);
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
    const now = new Date().toISOString().slice(0, 10);

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

    if (Array.isArray(poNumbers) && poNumbers.length > 0) {
      await updatePoFields(req.tenantId, poNumbers, {
        "Pickup Request ID": requestId,
        "Pickup Requested": true,
        "Pickup Date": request?.["Pickup Date"] ?? "",
        "Pickup Req Date": now,
      });
    }

    return res.json({ success: true, pickupRequestId: requestId });
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

    const now = new Date().toISOString().slice(0, 10);
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
    const now = new Date().toISOString().slice(0, 10);

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

    await updatePoFields(req.tenantId, [poNumber], { "Approval ID": requestId });

    return res.json({ success: true, approvalId: requestId });
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

    const now = new Date().toISOString().slice(0, 10);
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

export default router;
