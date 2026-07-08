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
let currentUserId = "";
// userId → { email, displayName } for everyone in the tenant.
let tenantUsersById = {};

function isPortalMode() {
  return portalModeActive;
}

function getCurrentUserEmail() {
  return currentUserEmail;
}

function getCurrentUserId() {
  return currentUserId;
}

function getTenantUsersById() {
  return tenantUsersById;
}

/** Preferred display label for a user: display name → email → fallback. */
function getUserDisplayLabel(userId, fallbackEmail = "") {
  const entry = userId ? tenantUsersById[userId] : null;
  if (entry) return String(entry.displayName || entry.email || fallbackEmail || "Unknown");
  // No id match — the fallback might itself be an email we can map by value.
  if (fallbackEmail) {
    const byEmail = Object.values(tenantUsersById).find(u => u.email === fallbackEmail);
    if (byEmail && byEmail.displayName) return byEmail.displayName;
  }
  return String(fallbackEmail || "Unknown");
}

/** Columns that never show in the portal's Sales Orders table. */
const PORTAL_HIDDEN_SO_COLUMNS = new Set([
  "Division", "Memo", "INVOICE #", "INV QTY", "Subtotal", "TOTAL", "INVOICE STATUS",
]);

function isPortalHiddenSoColumn(col) {
  return portalModeActive && PORTAL_HIDDEN_SO_COLUMNS.has(col);
}

/** Called from applyAppStatePayload with the /api/app-state response. */
function setPortalStateFromAppState(json) {
  if (typeof json?.userEmail === "string" && json.userEmail) {
    currentUserEmail = json.userEmail;
  }
  if (typeof json?.currentUserId === "string" && json.currentUserId) {
    currentUserId = json.currentUserId;
  }
  if (json?.users && typeof json.users === "object" && !Array.isArray(json.users)) {
    tenantUsersById = json.users;
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
