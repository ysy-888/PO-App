/**
 * Showroom portal mode (external sales team).
 *
 * Portal accounts (tenant_memberships.role = "showroom") get a restricted
 * experience: the Sales Orders view only — search, filters, sorting, and
 * CSV export still work — with no other pages, no CSV import, and no
 * settings. The server enforces the same restriction (see server/src/auth.js);
 * this file only adjusts the UI after /api/app-state reports portalMode: true.
 */

let portalModeActive = false;
let currentUserEmail = "";

function isPortalMode() {
  return portalModeActive;
}

function getCurrentUserEmail() {
  return currentUserEmail;
}

/** Columns that never show in the portal's Sales Orders table. */
const PORTAL_HIDDEN_SO_COLUMNS = new Set([
  "Memo", "INVOICE #", "INV QTY", "Subtotal", "TOTAL", "INVOICE STATUS",
]);

function isPortalHiddenSoColumn(col) {
  return portalModeActive && PORTAL_HIDDEN_SO_COLUMNS.has(col);
}

/** Called from applyAppStatePayload with the /api/app-state response. */
function setPortalStateFromAppState(json) {
  if (typeof json?.userEmail === "string" && json.userEmail) {
    currentUserEmail = json.userEmail;
  }
  // The Supabase fallback payload has no portalMode flag — keep the
  // previous state rather than silently unlocking the full app.
  if (json && json.portalMode !== undefined) {
    portalModeActive = json.portalMode === true;
  }
  if (portalModeActive) applyPortalModeUi();
}

function applyPortalModeUi() {
  document.body.classList.add("portal-mode");

  // Navigation: Sales Orders only.
  [
    "navTabPo", "navTabShipments", "navTabRequestsWrap", "navTabInvoices",
    "navTabChargebacks", "navTabCustomers", "navTabStyles", "navTabPackingReviews",
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.hidden = true;
      el.style.display = "none";
    }
  });

  // Header menu: no CSV import, no settings. Export stays available.
  ["headerMenuImportCsv", "headerMenuSettings"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  });

  // Re-apply column visibility — the table header was built before the
  // portal flag arrived, so the portal-hidden columns are still showing.
  if (typeof applySoColumnVisibility === "function") applySoColumnVisibility();

  if (typeof switchAppView === "function") switchAppView("sales");
}
