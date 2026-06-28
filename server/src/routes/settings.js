/**
 * POST /api/settings/save-column  — persist default columns + status filter
 * POST /api/settings/vendor-submit-mode — set vendorSubmitMode
 *
 * All settings live in public.tenant_settings as a single JSONB row per tenant.
 * Missing row is created on first write (upsert).
 */

import { Router } from "express";
import supabase from "../supabase.js";
import { requireAuth } from "../auth.js";

const router = Router();

/** Merge a partial settings object into the tenant's settings row. */
async function mergeSettings(tenantId, patch) {
  // Fetch current settings so we can deep-merge.
  const { data: existing, error: fetchErr } = await supabase
    .from("tenant_settings")
    .select("settings")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (fetchErr) throw fetchErr;

  const current = existing?.settings || {};
  const merged = { ...current, ...patch };

  const { error: upsertErr } = await supabase
    .from("tenant_settings")
    .upsert({ tenant_id: tenantId, settings: merged }, { onConflict: "tenant_id" });

  if (upsertErr) throw upsertErr;
}

/**
 * POST /api/settings/save-column
 * Body: { columns?: object, columnOrder?: string[], statusFilter?: string }
 * Mirrors handleSaveColumnDefault in apps-script.gs.
 */
router.post("/save-column", requireAuth, async (req, res) => {
  const { columns, columnOrder, statusFilter } = req.body || {};

  try {
    const patch = {};
    if (columns !== undefined) patch.defaultColumns = columns;
    if (columnOrder !== undefined) patch.defaultColumnOrder = columnOrder;
    if (statusFilter !== undefined) patch.defaultStatusFilter = statusFilter;

    if (Object.keys(patch).length === 0) {
      return res.json({ success: true });
    }

    await mergeSettings(req.tenantId, patch);
    return res.json({ success: true });
  } catch (err) {
    console.error("save-column failed:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to save settings." });
  }
});

/**
 * POST /api/settings/vendor-submit-mode
 * Body: { mode: "review" | "direct" }
 * Mirrors handleSetVendorSubmitMode in apps-script.gs.
 */
router.post("/vendor-submit-mode", requireAuth, async (req, res) => {
  const mode = String(req.body?.mode ?? "").trim();
  if (mode !== "review" && mode !== "direct") {
    return res.status(400).json({ success: false, error: "mode must be 'review' or 'direct'." });
  }

  try {
    await mergeSettings(req.tenantId, { vendorSubmitMode: mode });
    return res.json({ success: true, mode });
  } catch (err) {
    console.error("vendor-submit-mode failed:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to save settings." });
  }
});

export default router;
