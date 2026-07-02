/**
 * POST /api/packing-list/save   — upsert packing list + cartons + sync PO fields
 * POST /api/packing-list/delete — delete packing list + cartons
 *
 * Print/PDF is generated on the API server (packingListPrint module).
 */

import { Router } from "express";
import supabase from "../supabase.js";
import { requireAuth } from "../auth.js";
import { sanitizeUpdates, isPoClosed } from "../importHelpers.js";

const router = Router();
const CARTON_WEIGHT_LBS_FIELD = "Carton Weight (lbs)";
const KG_TO_LBS = 2.2046226218;

function toPositiveNumber(value) {
  const n = Number(String(value ?? "").trim());
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function roundWeight(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function cartonWeightKgToLbs(kg) {
  const n = toPositiveNumber(kg);
  return n > 0 ? roundWeight(n * KG_TO_LBS, 2) : "";
}

function cartonWeightLbsToKg(lbs) {
  const n = toPositiveNumber(lbs);
  return n > 0 ? roundWeight(n / KG_TO_LBS, 6) : "";
}

function normalizePackingCartonWeight(carton) {
  const out = { ...carton };
  const kg = toPositiveNumber(out["Carton Weight"]) || cartonWeightLbsToKg(out[CARTON_WEIGHT_LBS_FIELD]);
  out["Carton Weight"] = kg || "";
  out[CARTON_WEIGHT_LBS_FIELD] = cartonWeightKgToLbs(kg);
  return out;
}

/** Generate next PL-NNNN id from the max in the tenant's packing_lists table. */
async function nextPackingListId(tenantId) {
  const { data, error } = await supabase
    .from("packing_lists")
    .select("entity_id")
    .eq("tenant_id", tenantId);

  if (error) throw error;

  let max = 0;
  for (const row of data || []) {
    const m = /^PL-(\d+)$/.exec(String(row.entity_id ?? ""));
    if (m) max = Math.max(max, Number(m[1]));
  }
  return "PL-" + String(max + 1).padStart(4, "0");
}

/** Compute PO quantity fields from cartons. */
function buildPackingPoUpdates(cartons, cartonCount, extraUpdates = {}) {
  const updates = { ...sanitizeUpdates(extraUpdates) };
  updates["Has Packing List"] = true;
  updates["Ctn Qty"] = cartonCount;

  let actualQty = 0;
  const UNIT_COUNT = 15;
  for (let i = 1; i <= UNIT_COUNT; i++) {
    updates[`Act Unit ${i}`] = "";
  }

  cartons.forEach((carton, idx) => {
    const totalUnits = Number(carton["Total Units"] || 0);
    actualQty += totalUnits;
    if (idx < UNIT_COUNT) {
      updates[`Act Unit ${idx + 1}`] = totalUnits || "";
    }
  });

  updates["Actual Qty"] = actualQty;
  return updates;
}

/**
 * POST /api/packing-list/save
 * Body: { poNumber, packingList: { "Carton Count", Notes }, cartons: [...], updates: {} }
 */
router.post("/save", requireAuth, async (req, res) => {
  const { poNumber, packingList, cartons, updates: poEditUpdates } = req.body || {};

  if (!poNumber || typeof poNumber !== "string" || !poNumber.trim()) {
    return res.status(400).json({ success: false, error: "poNumber is required." });
  }
  if (!Array.isArray(cartons) || cartons.length === 0) {
    return res.status(400).json({ success: false, error: "At least one carton is required." });
  }
  if (cartons.some(c => Number(c["Total Units"] || 0) <= 0)) {
    return res.status(400).json({ success: false, error: "A carton quantity cannot be zero." });
  }

  try {
    // Verify PO exists and is not closed.
    const { data: poRow, error: poErr } = await supabase
      .from("purchase_orders")
      .select("id, data")
      .eq("tenant_id", req.tenantId)
      .eq("po_number", poNumber.trim())
      .maybeSingle();

    if (poErr) throw poErr;
    if (!poRow) return res.status(404).json({ success: false, error: `PO # not found: ${poNumber}` });
    if (isPoClosed(poRow.data)) {
      return res.status(400).json({ success: false, error: "Closed POs cannot be edited." });
    }

    // Find or generate packing list ID.
    const { data: existingList, error: listFetchErr } = await supabase
      .from("packing_lists")
      .select("entity_id, data")
      .eq("tenant_id", req.tenantId)
      .eq("data->>PO #", poNumber.trim())
      .maybeSingle();

    if (listFetchErr) throw listFetchErr;

    const now = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const cartonCount = packingList?.["Carton Count"] || cartons.length;
    const notes = packingList?.["Notes"] || "";
    const normalizedCartons = cartons.map(normalizePackingCartonWeight);

    let packingListId;

    if (existingList) {
      packingListId = existingList.entity_id;
      // Update header.
      const updatedData = {
        ...(existingList.data || {}),
        "Carton Count": cartonCount,
        "Notes": notes,
        "Updated At": now,
      };
      const { error: updateErr } = await supabase
        .from("packing_lists")
        .update({ data: updatedData })
        .eq("tenant_id", req.tenantId)
        .eq("entity_id", packingListId);
      if (updateErr) throw updateErr;
    } else {
      packingListId = await nextPackingListId(req.tenantId);
      const newListData = {
        "Packing List ID": packingListId,
        "PO #": poNumber.trim(),
        "Carton Count": cartonCount,
        "Notes": notes,
        "Created At": now,
        "Updated At": now,
      };
      const { error: insertErr } = await supabase
        .from("packing_lists")
        .insert({ tenant_id: req.tenantId, entity_id: packingListId, data: newListData });
      if (insertErr) throw insertErr;
    }

    // Replace all cartons: delete then insert.
    const { error: delCartonsErr } = await supabase
      .from("packing_cartons")
      .delete()
      .eq("tenant_id", req.tenantId)
      .eq("packing_list_entity_id", packingListId);

    if (delCartonsErr) throw delCartonsErr;

    const cartonInserts = normalizedCartons.map((carton, index) => ({
      tenant_id: req.tenantId,
      packing_list_entity_id: packingListId,
      carton_number: index + 1,
      data: {
        "Packing List ID": packingListId,
        "Carton #": index + 1,
        ...carton,
      },
    }));

    if (cartonInserts.length > 0) {
      const { error: insertCartonsErr } = await supabase.from("packing_cartons").insert(cartonInserts);
      if (insertCartonsErr) throw insertCartonsErr;
    }

    // Update PO row with derived quantities + any PO edits.
    const poUpdates = buildPackingPoUpdates(normalizedCartons, cartonCount, poEditUpdates || {});
    const updatedPoData = { ...(poRow.data || {}), ...sanitizeUpdates(poUpdates) };
    const { error: updatePoErr } = await supabase
      .from("purchase_orders")
      .update({ data: updatedPoData })
      .eq("id", poRow.id)
      .eq("tenant_id", req.tenantId);

    if (updatePoErr) throw updatePoErr;

    return res.json({ success: true, packingListId, poUpdates });
  } catch (err) {
    console.error("packing-list save failed:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to save packing list." });
  }
});

/**
 * POST /api/packing-list/delete
 * Body: { packingListId?, poNumber? }
 */
router.post("/delete", requireAuth, async (req, res) => {
  const packingListId = String(req.body?.packingListId ?? "").trim();
  const poNumber = String(req.body?.poNumber ?? "").trim();

  if (!packingListId && !poNumber) {
    return res.status(400).json({ success: false, error: "packingListId or poNumber is required." });
  }

  try {
    // Resolve the list row.
    let query = supabase
      .from("packing_lists")
      .select("entity_id, data")
      .eq("tenant_id", req.tenantId);

    if (packingListId) {
      query = query.eq("entity_id", packingListId);
    } else {
      query = query.eq("data->>PO #", poNumber);
    }

    const { data: listRow, error: listErr } = await query.maybeSingle();
    if (listErr) throw listErr;
    if (!listRow) return res.json({ success: true, deleted: 0 });

    const resolvedId = listRow.entity_id;
    const resolvedPoNumber = poNumber || String(listRow.data?.["PO #"] ?? "").trim();

    // Guard against editing closed POs.
    if (resolvedPoNumber) {
      const { data: poRow } = await supabase
        .from("purchase_orders")
        .select("data")
        .eq("tenant_id", req.tenantId)
        .eq("po_number", resolvedPoNumber)
        .maybeSingle();
      if (poRow && isPoClosed(poRow.data)) {
        return res.status(400).json({ success: false, error: "Closed POs cannot be edited." });
      }
    }

    // Delete cartons then list.
    await supabase.from("packing_cartons").delete().eq("tenant_id", req.tenantId).eq("packing_list_entity_id", resolvedId);
    await supabase.from("packing_lists").delete().eq("tenant_id", req.tenantId).eq("entity_id", resolvedId);

    // Clear packing fields on the PO.
    if (resolvedPoNumber) {
      const { data: poRow } = await supabase
        .from("purchase_orders")
        .select("id, data")
        .eq("tenant_id", req.tenantId)
        .eq("po_number", resolvedPoNumber)
        .maybeSingle();
      if (poRow) {
        const cleared = { ...(poRow.data || {}), "Has Packing List": false, "Ctn Qty": "", "Actual Qty": "" };
        await supabase.from("purchase_orders").update({ data: cleared }).eq("id", poRow.id).eq("tenant_id", req.tenantId);
      }
    }

    return res.json({ success: true, deleted: 1 });
  } catch (err) {
    console.error("packing-list delete failed:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to delete packing list." });
  }
});

export default router;
