/**
 * Chargeback routes.
 *
 * POST /api/chargebacks/create  — mirrors handleCreateChargeback
 * POST /api/chargebacks/update  — mirrors handleUpdateChargeback
 * POST /api/chargebacks/delete  — mirrors handleDeleteChargeback (single or bulk)
 */

import { Router } from "express";
import supabase from "../supabase.js";
import { requireAuth } from "../auth.js";
import { sanitizeUpdates } from "../importHelpers.js";

const router = Router();

async function nextChargebackId(tenantId) {
  const { data } = await supabase.from("chargebacks").select("entity_id").eq("tenant_id", tenantId);
  let max = 0;
  for (const row of data || []) {
    const m = /^CB-(\d+)$/.exec(String(row.entity_id ?? ""));
    if (m) max = Math.max(max, Number(m[1]));
  }
  return "CB-" + String(max + 1).padStart(4, "0");
}

// ── POST /api/chargebacks/create ──────────────────────────────────────────────
router.post("/create", requireAuth, async (req, res) => {
  const { poNumber, chargeback } = req.body || {};
  if (!poNumber) return res.status(400).json({ success: false, error: "poNumber is required." });

  try {
    const chargebackId = await nextChargebackId(req.tenantId);
    const now = new Date().toISOString().slice(0, 10);

    const data = sanitizeUpdates({
      "Chargeback ID": chargebackId,
      "PO #": poNumber,
      ...(chargeback || {}),
      "Date": chargeback?.Date || now,
      "Created At": now,
      "Updated At": now,
    });

    const { error } = await supabase.from("chargebacks").insert({
      tenant_id: req.tenantId, entity_id: chargebackId, data,
    });
    if (error) throw error;

    return res.json({ success: true, chargebackId });
  } catch (err) {
    console.error("chargeback create failed:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to create chargeback." });
  }
});

// ── POST /api/chargebacks/update ──────────────────────────────────────────────
router.post("/update", requireAuth, async (req, res) => {
  const { chargebackId, chargeback } = req.body || {};
  if (!chargebackId) return res.status(400).json({ success: false, error: "chargebackId is required." });

  try {
    const { data: existing, error: fetchErr } = await supabase
      .from("chargebacks").select("id, data").eq("tenant_id", req.tenantId).eq("entity_id", chargebackId).maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!existing) return res.status(404).json({ success: false, error: "Chargeback not found." });

    const now = new Date().toISOString().slice(0, 10);
    const merged = { ...(existing.data || {}), ...sanitizeUpdates(chargeback || {}), "Updated At": now };

    const { error } = await supabase.from("chargebacks").update({ data: merged }).eq("id", existing.id).eq("tenant_id", req.tenantId);
    if (error) throw error;

    return res.json({ success: true });
  } catch (err) {
    console.error("chargeback update failed:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to update chargeback." });
  }
});

// ── POST /api/chargebacks/delete ──────────────────────────────────────────────
// Accepts single { chargebackId } or bulk { chargebackIds: [...] }
router.post("/delete", requireAuth, async (req, res) => {
  const single = req.body?.chargebackId;
  const bulk = req.body?.chargebackIds;
  const ids = bulk ? bulk.map(String) : (single ? [String(single)] : []);

  if (ids.length === 0) return res.status(400).json({ success: false, error: "chargebackId or chargebackIds is required." });

  try {
    const { error } = await supabase.from("chargebacks").delete().eq("tenant_id", req.tenantId).in("entity_id", ids);
    if (error) throw error;
    return res.json({ success: true });
  } catch (err) {
    console.error("chargeback delete failed:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to delete chargeback." });
  }
});

export default router;
