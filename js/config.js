// API backend config. Data is served by Express + Supabase.
const API_BASE_URL = "https://po-app-api.onrender.com";

// Supabase anon key — safe to include in the browser (public key, not service-role).
const SUPABASE_URL = "https://rlhxetfcnsdxogjzeztg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsaHhldGZjbnNkeG9nanplenRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1OTIzMDcsImV4cCI6MjA5ODE2ODMwN30.qQ3UYlBwqSyNFAeVj0BWquAUZXiK21-DHE5UBY4b8tQ";

/** When false, hides the Vendor Submissions tab and related settings. */
const VENDOR_SUBMISSIONS_ENABLED = true;

/**
 * Base URL for the Express API (no trailing slash).
 */
function getApiBaseUrl() {
  return API_BASE_URL;
}

function scopedStorageKey(base) {
  return `poTable.api.${base}`;
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
