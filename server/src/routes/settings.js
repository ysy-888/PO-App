/**
 * POST /api/settings/save-column — persist user's default columns + status filter
 * POST /api/settings/user-preferences — persist user's personal UI settings
 * POST /api/settings/vendor-submit-mode — set tenant-wide vendorSubmitMode
 *
 * Personal UI settings live in public.user_settings as one JSONB row per
 * tenant/user. Operational tenant settings remain in public.tenant_settings.
 * Missing rows are created on first write (upsert).
 */

import { Router } from "express";
import supabase from "../supabase.js";
import { requireAuth } from "../auth.js";

const router = Router();

const USER_PREFERENCE_KEYS = new Set([
  "cxlCountdownEnabled",
  "splitViewEnabled",
  "dateFormatId",
  "pageSize",
  "columnLayout",
]);

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

/** Merge a partial settings object into the signed-in user's settings row. */
async function mergeUserSettings(tenantId, userId, patch) {
  const { data: existing, error: fetchErr } = await supabase
    .from("user_settings")
    .select("settings")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchErr) throw fetchErr;

  const current = existing?.settings || {};
  const merged = { ...current, ...patch };

  const { error: upsertErr } = await supabase
    .from("user_settings")
    .upsert(
      { tenant_id: tenantId, user_id: userId, settings: merged },
      { onConflict: "tenant_id,user_id" }
    );

  if (upsertErr) throw upsertErr;
}

function extractUserPreferencePatch(body) {
  const source = body?.settings && typeof body.settings === "object" && !Array.isArray(body.settings)
    ? body.settings
    : body;
  const patch = {};

  for (const key of USER_PREFERENCE_KEYS) {
    if (source?.[key] === undefined) continue;
    patch[key] = source[key];
  }

  return patch;
}

/**
 * POST /api/settings/save-column
 * Body: { columns?: object, columnOrder?: string[], statusFilter?: string, columnLayout?: object }
 * Persists a user's default table view.
 */
router.post("/save-column", requireAuth, async (req, res) => {
  const { columns, columnOrder, statusFilter, columnLayout } = req.body || {};

  try {
    const patch = {};
    if (columns !== undefined) patch.defaultColumns = columns;
    if (columnOrder !== undefined) patch.defaultColumnOrder = columnOrder;
    if (statusFilter !== undefined) patch.defaultStatusFilter = statusFilter;
    if (columnLayout !== undefined) patch.columnLayout = columnLayout;

    if (Object.keys(patch).length === 0) {
      return res.json({ success: true });
    }

    await mergeUserSettings(req.tenantId, req.userId, patch);
    return res.json({ success: true });
  } catch (err) {
    console.error("save-column failed:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to save settings." });
  }
});

/**
 * POST /api/settings/user-preferences
 * Body: { cxlCountdownEnabled?, splitViewEnabled?, dateFormatId?, pageSize?, columnLayout? }
 */
router.post("/user-preferences", requireAuth, async (req, res) => {
  try {
    const patch = extractUserPreferencePatch(req.body || {});
    if (Object.keys(patch).length === 0) {
      return res.json({ success: true });
    }

    await mergeUserSettings(req.tenantId, req.userId, patch);
    return res.json({ success: true });
  } catch (err) {
    console.error("user-preferences failed:", err);
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
