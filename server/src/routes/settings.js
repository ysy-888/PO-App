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
import { fetchTenantUsers } from "../userDirectory.js";

const router = Router();

const USER_PREFERENCE_KEYS = new Set([
  "cxlCountdownEnabled",
  "splitViewEnabled",
  "dateFormatId",
  "asnDefaultEmailAddresses",
  "asnCarriers",
  "asnDefaultCarrierByBuyer",
  "asnBolPickupAddress",
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
 * Body: { cxlCountdownEnabled?, splitViewEnabled?, dateFormatId?, asnDefaultEmailAddresses?, pageSize?, columnLayout? }
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
 * POST /api/settings/portal-columns
 * Body: { portalColumns: { order: string[], visible: string[] } }
 * Persists the tenant-wide Sales Orders column layout shown to showroom
 * portal accounts (the "Place Showroom Portal" table).
 */
router.post("/portal-columns", requireAuth, async (req, res) => {
  const config = req.body?.portalColumns;
  if (!config || typeof config !== "object" || Array.isArray(config)
    || !Array.isArray(config.order) || !Array.isArray(config.visible)) {
    return res.status(400).json({
      success: false,
      error: "portalColumns must be an object with 'order' and 'visible' arrays.",
    });
  }

  const clean = {
    order: config.order.filter(c => typeof c === "string"),
    visible: config.visible.filter(c => typeof c === "string"),
  };
  if (clean.visible.length === 0) {
    return res.status(400).json({ success: false, error: "At least one column must be visible." });
  }

  try {
    await mergeSettings(req.tenantId, { portalColumns: clean });
    return res.json({ success: true, portalColumns: clean });
  } catch (err) {
    console.error("portal-columns failed:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to save portal columns." });
  }
});

/**
 * POST /api/settings/vendor-submit-mode
 * Body: { mode: "review" | "direct" }
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

/**
 * POST /api/settings/features
 * Body: { chargebacksEnabled?: boolean, vendorSubmissionsEnabled?: boolean }
 * Persists tenant-wide feature visibility flags.
 */
router.post("/features", requireAuth, async (req, res) => {
  const { chargebacksEnabled, vendorSubmissionsEnabled } = req.body || {};
  const patch = {};

  if (chargebacksEnabled !== undefined) {
    if (typeof chargebacksEnabled !== "boolean") {
      return res.status(400).json({ success: false, error: "chargebacksEnabled must be a boolean." });
    }
    patch.chargebacksEnabled = chargebacksEnabled;
  }
  if (vendorSubmissionsEnabled !== undefined) {
    if (typeof vendorSubmissionsEnabled !== "boolean") {
      return res.status(400).json({ success: false, error: "vendorSubmissionsEnabled must be a boolean." });
    }
    patch.vendorSubmissionsEnabled = vendorSubmissionsEnabled;
  }

  if (Object.keys(patch).length === 0) {
    return res.json({ success: true });
  }

  try {
    await mergeSettings(req.tenantId, patch);
    return res.json({ success: true, ...patch });
  } catch (err) {
    console.error("features settings failed:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to save feature settings." });
  }
});

/**
 * GET /api/settings/users
 * Lists the tenant's members with email + display name so an admin can
 * manage the names shown in comment threads.
 */
router.get("/users", requireAuth, async (req, res) => {
  try {
    const users = await fetchTenantUsers(req.tenantId);
    return res.json({ success: true, users });
  } catch (err) {
    console.error("list users failed:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to load users." });
  }
});

/**
 * POST /api/settings/user-display-name
 * Body: { userId: string, displayName: string }
 * Sets a member's display name. The target must belong to the caller's
 * tenant (so one tenant can't rename another's users).
 */
router.post("/user-display-name", requireAuth, async (req, res) => {
  const userId = String(req.body?.userId ?? "").trim();
  const displayName = String(req.body?.displayName ?? "").trim().slice(0, 120);
  if (!userId) {
    return res.status(400).json({ success: false, error: "userId is required." });
  }

  try {
    // Verify the target user is a member of this tenant.
    const { data: membership, error: membershipErr } = await supabase
      .from("tenant_memberships")
      .select("user_id")
      .eq("tenant_id", req.tenantId)
      .eq("user_id", userId)
      .maybeSingle();
    if (membershipErr) throw membershipErr;
    if (!membership) {
      return res.status(404).json({ success: false, error: "User is not a member of this tenant." });
    }

    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ display_name: displayName || null })
      .eq("id", userId);
    if (updateErr) throw updateErr;

    return res.json({ success: true, userId, displayName });
  } catch (err) {
    console.error("user-display-name failed:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to save display name." });
  }
});

export default router;
