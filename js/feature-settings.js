/** Tenant-wide feature toggles: Chargebacks and Vendor Submissions nav visibility. */

let chargebacksEnabled = true;
let vendorSubmissionsEnabled = true;
let featureSettingsSaveQueue = Promise.resolve();

function isChargebacksFeatureEnabled() {
  return chargebacksEnabled !== false;
}

function isVendorSubmissionsTenantEnabled() {
  return vendorSubmissionsEnabled !== false;
}

function applyTenantFeaturesFromServer(settings) {
  if (!settings || typeof settings !== "object") return;
  if (settings.chargebacksEnabled !== undefined) {
    chargebacksEnabled = settings.chargebacksEnabled !== false;
  }
  if (settings.vendorSubmissionsEnabled !== undefined) {
    vendorSubmissionsEnabled = settings.vendorSubmissionsEnabled !== false;
  }
  updateChargebacksTabVisibility();
  // Vendor Submissions visibility is owned by packing-reviews.js; trigger it.
  if (typeof updateVendorSubmissionsTabVisibility === "function") {
    updateVendorSubmissionsTabVisibility();
  }
  updateFeatureTogglesUi();
}

function updateChargebacksTabVisibility() {
  const tab = document.getElementById("navTabChargebacks");
  if (!tab) return;
  const show = isChargebacksFeatureEnabled();
  tab.hidden = !show;
  if (show) {
    tab.style.removeProperty("display");
  } else {
    tab.style.display = "none";
    if (typeof currentAppView !== "undefined" && currentAppView === "chargebacks" && typeof switchAppView === "function") {
      switchAppView("po");
    }
  }
}

function updateFeatureTogglesUi() {
  const chargebacksToggle = document.getElementById("settingsChargebacksToggle");
  if (chargebacksToggle) {
    chargebacksToggle.setAttribute("aria-checked", isChargebacksFeatureEnabled() ? "true" : "false");
  }

  // Vendor Submissions toggle: only shown when the deploy-time flag is on.
  const vsGroup = document.getElementById("settingsFeaturesVendorSubmissionsGroup");
  if (vsGroup) {
    const deployEnabled = typeof VENDOR_SUBMISSIONS_ENABLED === "undefined" || VENDOR_SUBMISSIONS_ENABLED !== false;
    vsGroup.hidden = !deployEnabled;
  }

  const vsToggle = document.getElementById("settingsVendorSubmissionsToggle");
  if (vsToggle) {
    vsToggle.setAttribute("aria-checked", isVendorSubmissionsTenantEnabled() ? "true" : "false");
  }
}

async function getTenantIdForDirectFeatureSave(client, currentSettingsRow) {
  if (currentSettingsRow?.tenant_id) return currentSettingsRow.tenant_id;

  const { data, error } = await client
    .from("tenant_memberships")
    .select("tenant_id")
    .limit(1);

  if (error) throw error;
  const tenantId = data?.[0]?.tenant_id;
  if (!tenantId) throw new Error("No tenant membership found for this user.");
  return tenantId;
}

async function saveTenantFeatureSettingsDirectly(patch) {
  if (typeof getSupabaseClient !== "function") {
    throw new Error("Supabase client is not available.");
  }

  const client = getSupabaseClient();
  const tenantId = await getTenantIdForDirectFeatureSave(client);
  const { data: currentRow, error: settingsErr } = await client
    .from("tenant_settings")
    .select("tenant_id, settings")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (settingsErr) throw settingsErr;

  const currentSettings = currentRow?.settings || {};
  const mergedSettings = { ...currentSettings, ...patch };

  const { error: upsertErr } = await client
    .from("tenant_settings")
    .upsert(
      { tenant_id: tenantId, settings: mergedSettings },
      { onConflict: "tenant_id" }
    );

  if (upsertErr) throw upsertErr;
  return { success: true, ...patch };
}

async function saveTenantFeatureSettings(patch) {
  try {
    const json = await postApi("/api/settings/features", patch);
    if (!json.success) throw new Error(json.error || "Failed to save feature settings.");
    return json;
  } catch (apiErr) {
    console.warn("Feature settings API unavailable; saving directly to Supabase.", apiErr);
    try {
      return await saveTenantFeatureSettingsDirectly(patch);
    } catch (fallbackErr) {
      throw new Error(fallbackErr.message || apiErr.message || "Failed to save feature settings.");
    }
  }
}

function queueTenantFeatureSettingsSave(patch) {
  const run = featureSettingsSaveQueue
    .catch(() => {})
    .then(() => saveTenantFeatureSettings(patch));
  featureSettingsSaveQueue = run.catch(() => {});
  return run;
}

async function setTenantFeatureEnabled(key, enabled) {
  const previous = key === "chargebacksEnabled" ? chargebacksEnabled : vendorSubmissionsEnabled;

  // Optimistic update.
  if (key === "chargebacksEnabled") {
    chargebacksEnabled = enabled;
    updateChargebacksTabVisibility();
  } else {
    vendorSubmissionsEnabled = enabled;
    if (typeof updateVendorSubmissionsTabVisibility === "function") {
      updateVendorSubmissionsTabVisibility();
    }
  }
  updateFeatureTogglesUi();

  try {
    const json = await queueTenantFeatureSettingsSave({ [key]: enabled });
    if (!json.success) throw new Error(json.error);
    const label = key === "chargebacksEnabled" ? "Chargebacks" : "Vendor Submissions";
    showIndicator(`${label}: ${enabled ? "enabled" : "disabled"} ${CHECK_MARK}`, "success");
  } catch (err) {
    // Rollback on failure.
    if (key === "chargebacksEnabled") {
      chargebacksEnabled = previous;
      updateChargebacksTabVisibility();
    } else {
      vendorSubmissionsEnabled = previous;
      if (typeof updateVendorSubmissionsTabVisibility === "function") {
        updateVendorSubmissionsTabVisibility();
      }
    }
    updateFeatureTogglesUi();
    showIndicator("Feature change failed: " + err.message, "error");
  }
}

function initFeatureSettings() {
  document.getElementById("settingsChargebacksToggle")?.addEventListener("click", () => {
    setTenantFeatureEnabled("chargebacksEnabled", !isChargebacksFeatureEnabled());
  });

  document.getElementById("settingsVendorSubmissionsToggle")?.addEventListener("click", () => {
    setTenantFeatureEnabled("vendorSubmissionsEnabled", !isVendorSubmissionsTenantEnabled());
  });

  updateFeatureTogglesUi();
}
