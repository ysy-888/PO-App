/**
 * Pending Packing Lists (vendor submissions).
 *
 * POST /api/pending-packing-lists/approve  — approve a submission
 * POST /api/pending-packing-lists/reject   — reject a submission
 *
 * When a submission is approved (and skipCartonSave is false) the cartons JSON
 * in the submission is parsed and saved to packing_lists + packing_cartons.
 */

import { Router } from "express";
import supabase from "../supabase.js";
import { requireAuth } from "../auth.js";

const router = Router();

async function nextPackingListId(tenantId) {
  const { data } = await supabase.from("packing_lists").select("entity_id").eq("tenant_id", tenantId);
  let max = 0;
  for (const row of data || []) {
    const m = /^PL-(\d+)$/.exec(String(row.entity_id ?? ""));
    if (m) max = Math.max(max, Number(m[1]));
  }
  return "PL-" + String(max + 1).padStart(4, "0");
}

// ── POST /api/pending-packing-lists/approve ────────────────────────────────────
router.post("/approve", requireAuth, async (req, res) => {
  const submissionId = String(req.body?.submissionId ?? "").trim();
  const skipCartonSave = req.body?.skipCartonSave === true;

  if (!submissionId) return res.status(400).json({ success: false, error: "submissionId is required." });

  try {
    const { data: submission, error: fetchErr } = await supabase
      .from("pending_packing_lists")
      .select("id, data")
      .eq("tenant_id", req.tenantId)
      .eq("entity_id", submissionId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!submission) return res.status(404).json({ success: false, error: "Submission not found." });

    const submissionData = submission.data || {};
    if (submissionData.Status && submissionData.Status !== "Pending") {
      return res.status(400).json({ success: false, error: "Submission is not in Pending status." });
    }

    const now = new Date().toISOString().slice(0, 10);

    // Update submission status.
    const updatedSubmission = { ...submissionData, Status: "Approved", "Reviewed At": now };
    await supabase.from("pending_packing_lists").update({ data: updatedSubmission }).eq("id", submission.id).eq("tenant_id", req.tenantId);

    if (!skipCartonSave) {
      const poNumber = String(submissionData["PO #"] ?? "").trim();
      const notes = String(submissionData["Notes"] ?? "").trim();
      const cartonsJson = submissionData["Cartons JSON"];

      let cartons = [];
      if (cartonsJson) {
        try {
          const parsed = typeof cartonsJson === "string" ? JSON.parse(cartonsJson) : cartonsJson;
          if (Array.isArray(parsed)) cartons = parsed;
        } catch (_) { /* ignore parse errors */ }
      }

      if (poNumber && cartons.length > 0) {
        // Upsert the packing list + cartons.
        const { data: existingList } = await supabase
          .from("packing_lists").select("entity_id, data").eq("tenant_id", req.tenantId)
          .filter("data->>'PO #'", "eq", poNumber).maybeSingle();

        const packingListId = existingList?.entity_id ?? await nextPackingListId(req.tenantId);
        const cartonCount = cartons.length;

        const listData = {
          "Packing List ID": packingListId,
          "PO #": poNumber,
          "Carton Count": cartonCount,
          "Notes": notes,
          "Created At": existingList?.data?.["Created At"] || now,
          "Updated At": now,
        };

        if (existingList) {
          await supabase.from("packing_lists").update({ data: listData }).eq("tenant_id", req.tenantId).eq("entity_id", packingListId);
        } else {
          await supabase.from("packing_lists").insert({ tenant_id: req.tenantId, entity_id: packingListId, data: listData });
        }

        // Replace cartons.
        await supabase.from("packing_cartons").delete().eq("tenant_id", req.tenantId).eq("packing_list_entity_id", packingListId);
        const cartonRows = cartons.map((c, i) => ({
          tenant_id: req.tenantId,
          packing_list_entity_id: packingListId,
          carton_number: i + 1,
          data: { "Packing List ID": packingListId, "Carton #": i + 1, ...c },
        }));
        if (cartonRows.length > 0) await supabase.from("packing_cartons").insert(cartonRows);

        // Update PO with packing quantities.
        const { data: poRow } = await supabase
          .from("purchase_orders").select("id, data").eq("tenant_id", req.tenantId).eq("po_number", poNumber).maybeSingle();
        if (poRow) {
          let actualQty = 0;
          const poUpdates = { "Has Packing List": true, "Ctn Qty": cartonCount };
          for (let i = 1; i <= 15; i++) poUpdates[`Act Unit ${i}`] = "";
          cartons.forEach((c, idx) => {
            const total = Number(c["Total Units"] || 0);
            actualQty += total;
            if (idx < 15) poUpdates[`Act Unit ${idx + 1}`] = total || "";
          });
          poUpdates["Actual Qty"] = actualQty;
          await supabase.from("purchase_orders").update({ data: { ...(poRow.data || {}), ...poUpdates } }).eq("id", poRow.id).eq("tenant_id", req.tenantId);
        }
      }
    }

    return res.json({ success: true, submissionId });
  } catch (err) {
    console.error("approve pending packing list failed:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to approve submission." });
  }
});

// ── POST /api/pending-packing-lists/reject ─────────────────────────────────────
router.post("/reject", requireAuth, async (req, res) => {
  const submissionId = String(req.body?.submissionId ?? "").trim();
  if (!submissionId) return res.status(400).json({ success: false, error: "submissionId is required." });

  try {
    const { data: submission, error: fetchErr } = await supabase
      .from("pending_packing_lists").select("id, data").eq("tenant_id", req.tenantId).eq("entity_id", submissionId).maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!submission) return res.status(404).json({ success: false, error: "Submission not found." });

    const now = new Date().toISOString().slice(0, 10);
    const updated = { ...(submission.data || {}), Status: "Rejected", "Reviewed At": now };
    await supabase.from("pending_packing_lists").update({ data: updated }).eq("id", submission.id).eq("tenant_id", req.tenantId);

    return res.json({ success: true, submissionId });
  } catch (err) {
    console.error("reject pending packing list failed:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to reject submission." });
  }
});

export default router;
