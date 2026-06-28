/*
  Test Mode (menu) = use the test Google Sheet backend. Live Mode = production sheet.
  Data and sheet settings stay separate; switching modes does not copy data.

  Test sheet setup (one-time):
  1. File → Make a copy of the production Google Sheet (or create empty test sheet).
  2. Extensions → Apps Script — paste apps-script.gs and save.
  3. Deploy → New deployment → Web app; copy the /exec URL.
  4. Paste that URL into APPS_SCRIPT_URL_TEST below.
  5. Menu → Test Mode. Menu → Live Mode to return to production.

  URL_PLACEHOLDER and TEST_URL_PLACEHOLDER are magic strings for isDemoMode() /
  isTestUrlConfigured() only — never put real deployment URLs there.

  BACKEND controls which data source the app uses:
    "appsscript" (default) — original Apps Script / Google Sheets path, unchanged.
    "api"                  — new Express + Supabase path.
  Switch to "api" once the Express server is deployed and data is imported.
*/

// ── Apps Script backend (original path) ─────────────────────
const APPS_SCRIPT_URL_LIVE =
  "https://script.google.com/macros/s/AKfycbxRySh1gggq5hOtA5rHx77tbTwQuYl9FX2rr2xCfHi2EXf3Vp2SLrIaPrVhO9AgISxRpA/exec";
const APPS_SCRIPT_URL_TEST =
  "https://script.google.com/macros/s/AKfycbxrWo9TBsY2T40kqd-Pay45afo86oocOrDBKdz4UokGRJ5_2hRk8GCXR7uZbEAytAym/exec";

// ── New SaaS backend config ──────────────────────────────────
// Set BACKEND to "api" to route all data through the Express + Supabase layer.
// Set API_BASE_URL to your deployed Express server URL (no trailing slash).
const BACKEND = "api"; // "appsscript" | "api"
const API_BASE_URL = "https://po-app-api.onrender.com";

// Supabase anon key — safe to include in the browser (public key, not service-role).
// Only used when BACKEND === "api".
const SUPABASE_URL = "https://rlhxetfcnsdxogjzeztg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsaHhldGZjbnNkeG9nanplenRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1OTIzMDcsImV4cCI6MjA5ODE2ODMwN30.qQ3UYlBwqSyNFAeVj0BWquAUZXiK21-DHE5UBY4b8tQ";

/** When false, hides the Vendor Submissions tab and related settings. */
const VENDOR_SUBMISSIONS_ENABLED = true;

const APP_MODE_STORAGE_KEY = "poTable.appMode";
const URL_PLACEHOLDER = "YOUR_APPS_SCRIPT_WEB_APP_URL_HERE";
const TEST_URL_PLACEHOLDER = "YOUR_TEST_APPS_SCRIPT_WEB_APP_URL_HERE";

function getAppMode() {
  try {
    return localStorage.getItem(APP_MODE_STORAGE_KEY) === "test" ? "test" : "live";
  } catch {
    return "live";
  }
}

function isTestMode() {
  return getAppMode() === "test";
}

function getAppsScriptUrl() {
  return isTestMode() ? APPS_SCRIPT_URL_TEST : APPS_SCRIPT_URL_LIVE;
}

function isDemoMode() {
  const url = getAppsScriptUrl();
  return url === URL_PLACEHOLDER || url === TEST_URL_PLACEHOLDER;
}

function isTestUrlConfigured() {
  return APPS_SCRIPT_URL_TEST !== TEST_URL_PLACEHOLDER;
}

/** True when the app is running against the new Express + Supabase backend. */
function isApiMode() {
  return BACKEND === "api";
}

/**
 * Base URL for the Express API (no trailing slash).
 * Only meaningful when isApiMode() is true.
 */
function getApiBaseUrl() {
  return API_BASE_URL;
}

function scopedStorageKey(base) {
  return `poTable.${getAppMode()}.${base}`;
}

function isDirectBackdropClick(event, overlay = event?.currentTarget) {
  return Boolean(
    event &&
    overlay &&
    event.target === overlay &&
    overlay.dataset.backdropPointerStarted === "true"
  );
}

function bindDirectBackdropDismiss(overlay, dismiss) {
  if (!overlay || typeof dismiss !== "function") return;
  overlay.addEventListener("pointerdown", event => {
    overlay.dataset.backdropPointerStarted = event.target === overlay ? "true" : "false";
  });
  overlay.addEventListener("click", event => {
    if (isDirectBackdropClick(event, overlay)) dismiss(event);
    overlay.dataset.backdropPointerStarted = "false";
  });
}
