/**
 * Shipment routes.
 *
 * POST /api/shipments/create      — new shipment + link POs
 * POST /api/shipments/update      — edit shipment fields (syncs to linked POs)
 * POST /api/shipments/delete      — delete one or more shipments
 * POST /api/shipments/add-pos     — add POs to an existing shipment
 * POST /api/shipments/remove-pos  — remove POs from a shipment
 */

import { Router } from "express";
import supabase from "../supabase.js";
import { requireAuth } from "../auth.js";
import { sanitizeUpdates } from "../importHelpers.js";

const router = Router();

const SHIPMENT_PO_SYNC_FIELDS = [
  "Ship Method", "Vessel", "House #", "EXF", "Shipped", "ETD", "ETA", "IHD",
];

async function nextShipmentId(tenantId) {
  const { data } = await supabase.from("shipments").select("entity_id").eq("tenant_id", tenantId);
  let max = 0;
  for (const row of data || []) {
    const m = /^SHP-(\d+)$/.exec(String(row.entity_id ?? ""));
    if (m) max = Math.max(max, Number(m[1]));
  }
  return "SHP-" + String(max + 1).padStart(4, "0");
}

/** Sync shipment fields onto each linked PO row. */
async function syncShipmentToPos(tenantId, shipmentId, shipmentData, poNumbers) {
  if (!poNumbers || poNumbers.length === 0) return;

  const syncUpdates = {};
  SHIPMENT_PO_SYNC_FIELDS.forEach(f => {
    if (shipmentData[f] !== undefined) syncUpdates[f] = shipmentData[f];
  });
  syncUpdates["Shipment ID"] = shipmentId;
  syncUpdates["Status"] = "OTW";

  const { data: poRows } = await supabase
    .from("purchase_orders")
    .select("id, po_number, data")
    .eq("tenant_id", tenantId)
    .in("po_number", poNumbers.map(String));

  for (const row of poRows || []) {
    await supabase
      .from("purchase_orders")
      .update({ data: { ...(row.data || {}), ...sanitizeUpdates(syncUpdates) } })
      .eq("id", row.id)
      .eq("tenant_id", tenantId);
  }
}

function clearedPoShipmentStatus(poData) {
  const exfRequested = poData?.["EXF Requested"];
  const truthy = exfRequested === true
    || String(exfRequested ?? "").trim().toLowerCase() === "true"
    || String(exfRequested ?? "").trim().toLowerCase() === "yes"
    || String(exfRequested ?? "").trim() === "1";
  return truthy ? "Requested" : "WIP";
}

/** Clear shipment fields on POs (when shipment is deleted or POs removed). */
async function clearShipmentFromPos(tenantId, shipmentId) {
  const { data: poRows } = await supabase
    .from("purchase_orders")
    .select("id, data")
    .eq("tenant_id", tenantId)
    .filter("data->>'Shipment ID'", "eq", shipmentId);

  for (const row of poRows || []) {
    const cleared = { ...(row.data || {}) };
    cleared["Shipment ID"] = "";
    SHIPMENT_PO_SYNC_FIELDS.forEach(f => { cleared[f] = ""; });
    cleared["Status"] = clearedPoShipmentStatus(row.data);
    await supabase.from("purchase_orders").update({ data: cleared }).eq("id", row.id).eq("tenant_id", tenantId);
  }
}

// ── POST /api/shipments/create ────────────────────────────────────────────────
router.post("/create", requireAuth, async (req, res) => {
  const { poNumbers, shipment } = req.body || {};
  if (!shipment || typeof shipment !== "object") {
    return res.status(400).json({ success: false, error: "shipment data is required." });
  }

  try {
    const shipmentId = await nextShipmentId(req.tenantId);
    const now = new Date().toISOString().slice(0, 10);

    const shipmentData = sanitizeUpdates({
      "Shipment ID": shipmentId,
      ...shipment,
      "Created At": now,
      "Updated At": now,
    });

    const { error: insertErr } = await supabase.from("shipments").insert({
      tenant_id: req.tenantId,
      entity_id: shipmentId,
      data: shipmentData,
    });
    if (insertErr) throw insertErr;

    if (Array.isArray(poNumbers) && poNumbers.length > 0) {
      await syncShipmentToPos(req.tenantId, shipmentId, shipment, poNumbers);
    }

    return res.json({ success: true, shipmentId });
  } catch (err) {
    console.error("create shipment failed:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to create shipment." });
  }
});

// ── POST /api/shipments/update ────────────────────────────────────────────────
router.post("/update", requireAuth, async (req, res) => {
  const { shipmentId, shipment } = req.body || {};
  if (!shipmentId) return res.status(400).json({ success: false, error: "shipmentId is required." });

  try {
    const { data: existing, error: fetchErr } = await supabase
      .from("shipments").select("id, data").eq("tenant_id", req.tenantId).eq("entity_id", shipmentId).maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!existing) return res.status(404).json({ success: false, error: "Shipment not found." });

    const now = new Date().toISOString().slice(0, 10);
    const merged = { ...(existing.data || {}), ...sanitizeUpdates(shipment || {}), "Updated At": now };

    const { error: updateErr } = await supabase.from("shipments").update({ data: merged }).eq("id", existing.id).eq("tenant_id", req.tenantId);
    if (updateErr) throw updateErr;

    // Sync updated shipment fields to linked POs.
    const { data: linkedPos } = await supabase
      .from("purchase_orders").select("id, po_number, data").eq("tenant_id", req.tenantId).filter("data->>'Shipment ID'", "eq", shipmentId);

    const syncUpdates = sanitizeUpdates(Object.fromEntries(
      SHIPMENT_PO_SYNC_FIELDS.filter(f => shipment?.[f] !== undefined).map(f => [f, shipment[f]])
    ));
    for (const row of linkedPos || []) {
      await supabase.from("purchase_orders").update({ data: { ...(row.data || {}), ...syncUpdates } }).eq("id", row.id).eq("tenant_id", req.tenantId);
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("update shipment failed:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to update shipment." });
  }
});

// ── POST /api/shipments/delete ────────────────────────────────────────────────
router.post("/delete", requireAuth, async (req, res) => {
  const shipmentIds = req.body?.shipmentIds;
  if (!Array.isArray(shipmentIds) || shipmentIds.length === 0) {
    return res.status(400).json({ success: false, error: "shipmentIds array is required." });
  }

  try {
    for (const id of shipmentIds) {
      await clearShipmentFromPos(req.tenantId, String(id));
    }
    await supabase.from("shipments").delete().eq("tenant_id", req.tenantId).in("entity_id", shipmentIds.map(String));
    return res.json({ success: true });
  } catch (err) {
    console.error("delete shipment failed:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to delete shipment." });
  }
});

// ── POST /api/shipments/add-pos ───────────────────────────────────────────────
router.post("/add-pos", requireAuth, async (req, res) => {
  const { shipmentId, poNumbers } = req.body || {};
  if (!shipmentId) return res.status(400).json({ success: false, error: "shipmentId is required." });
  if (!Array.isArray(poNumbers) || poNumbers.length === 0) {
    return res.status(400).json({ success: false, error: "poNumbers array is required." });
  }

  try {
    const { data: shipment, error: fetchErr } = await supabase
      .from("shipments").select("data").eq("tenant_id", req.tenantId).eq("entity_id", shipmentId).maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!shipment) return res.status(404).json({ success: false, error: "Shipment not found." });

    await syncShipmentToPos(req.tenantId, shipmentId, shipment.data || {}, poNumbers);
    return res.json({ success: true, shipmentId });
  } catch (err) {
    console.error("add-pos to shipment failed:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to add POs to shipment." });
  }
});

// ── POST /api/shipments/remove-pos ───────────────────────────────────────────
router.post("/remove-pos", requireAuth, async (req, res) => {
  const { shipmentId, poNumbers } = req.body || {};
  if (!shipmentId || !Array.isArray(poNumbers) || poNumbers.length === 0) {
    return res.status(400).json({ success: false, error: "shipmentId and poNumbers are required." });
  }

  try {
    const { data: poRows } = await supabase
      .from("purchase_orders").select("id, data").eq("tenant_id", req.tenantId).in("po_number", poNumbers.map(String));

    for (const row of poRows || []) {
      if (String(row.data?.["Shipment ID"] ?? "") !== String(shipmentId)) continue;
      const cleared = { ...(row.data || {}), "Shipment ID": "" };
      SHIPMENT_PO_SYNC_FIELDS.forEach(f => { cleared[f] = ""; });
      cleared["Status"] = clearedPoShipmentStatus(row.data);
      await supabase.from("purchase_orders").update({ data: cleared }).eq("id", row.id).eq("tenant_id", req.tenantId);
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("remove-pos from shipment failed:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to remove POs from shipment." });
  }
});

export default router;
