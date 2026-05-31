/*
  Test Mode (menu) = use the test Google Sheet backend. Live Mode = production sheet.
  Data and sheet settings stay separate; switching modes does not copy data.

  Publish to production (menu, test mode only) = ship application CODE:
  frontend via git push to GitHub Pages, backend via clasp push to prod Apps Script.
  See DEPLOY.md for the full checklist.

  Test sheet setup (one-time):
  1. File → Make a copy of the production Google Sheet (or create empty test sheet).
  2. Extensions → Apps Script — paste apps-script.gs and save.
  3. Deploy → New deployment → Web app; copy the /exec URL.
  4. Paste that URL into APPS_SCRIPT_URL_TEST below.
  5. Menu → Test Mode. Menu → Live Mode to return to production.

  URL_PLACEHOLDER and TEST_URL_PLACEHOLDER are magic strings for isDemoMode() /
  isTestUrlConfigured() only — never put real deployment URLs there.
*/

const APPS_SCRIPT_URL_LIVE =
  "https://script.google.com/macros/s/AKfycbzQHBgNmgRKO5zyKaFEkBfhnH1Rc5VRx-tFAK0Zv3G_pp2Y2mHHGSlA7GkIzpAQKiEjtg/exec";
const APPS_SCRIPT_URL_TEST =
  "https://script.google.com/macros/s/AKfycbz2zVIqrPFTRIFH-afAQkzaXBAMKfpzeiPKb7_7kHpymnUnGdbKx5vT0zTOV3YV6toA/exec";

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
