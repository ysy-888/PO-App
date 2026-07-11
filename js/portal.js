/**
 * Showroom portal mode (external sales team).
 *
 * Portal accounts (tenant_memberships.role = "showroom") get a restricted
 * experience: the Sales Orders view only — search, filters, sorting, and
 * CSV export still work — with no other pages, no CSV import, and no
 * settings. A slim invoice payload (Invoice # / qty / subtotal / status /
 * tracking) is loaded so the Sales Orders modal can show those fields.
 * The server enforces the same restriction (see server/src/auth.js);
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

/** Display name for the signed-in user (greeting). */
function getCurrentUserDisplayName() {
  const label = getUserDisplayLabel(currentUserId, currentUserEmail);
  if (!label || label === "Unknown") return "";
  // If we only have an email, show the local-part rather than the full address.
  if (label.includes("@")) return label.split("@")[0];
  return label;
}

function updateHeaderGreeting() {
  const wrap = document.getElementById("headerGreeting");
  const nameEl = document.getElementById("headerGreetingName");
  if (!wrap || !nameEl) return;
  const name = getCurrentUserDisplayName();
  if (!name) {
    wrap.hidden = true;
    nameEl.textContent = "";
    return;
  }
  nameEl.textContent = name;
  wrap.hidden = false;
}

/**
 * Default columns hidden from the portal's Sales Orders table when the tenant
 * has not saved a custom portal layout via the "Place Showroom Portal" target
 * in the Edit table settings. ("Memo" is also stripped server-side.)
 */
const PORTAL_HIDDEN_SO_COLUMNS = new Set([
  "Division", "Memo", "INVOICE #", "INV QTY", "Subtotal", "TOTAL", "INVOICE STATUS",
]);

/**
 * Tenant-wide Sales Orders layout shown to showroom portal accounts —
 * { order: string[], visible: string[] } — or null when the tenant hasn't
 * saved one (in which case PORTAL_HIDDEN_SO_COLUMNS is the default).
 */
let portalColumnConfig = null;

function getPortalColumnConfig() {
  return portalColumnConfig;
}

function setPortalColumnConfig(config) {
  if (config && typeof config === "object" && !Array.isArray(config)
    && Array.isArray(config.order) && Array.isArray(config.visible)) {
    portalColumnConfig = { order: [...config.order], visible: [...config.visible] };
  } else {
    portalColumnConfig = null;
  }
  return portalColumnConfig;
}

/** Set of SO columns the portal should show per tenant config, or null when unset. */
function getPortalVisibleColumnSet() {
  const cols = (portalColumnConfig?.visible ?? []).filter(c => typeof c === "string" && c);
  return cols.length ? new Set(cols) : null;
}

function isPortalHiddenSoColumn(col) {
  if (!portalModeActive) return false;
  // Fixed leading columns (Flag/Selected) always show.
  if (typeof SO_NON_TOGGLEABLE_COLUMNS !== "undefined" && SO_NON_TOGGLEABLE_COLUMNS.has(col)) return false;
  const configured = getPortalVisibleColumnSet();
  if (configured) {
    if (configured.has(col)) return false;
    // Explicitly saved as hidden in the portal layout.
    const order = portalColumnConfig?.order ?? [];
    if (order.includes(col)) return true;
    // Brand-new column not in the saved layout — follow default portal visibility.
    return PORTAL_HIDDEN_SO_COLUMNS.has(col);
  }
  return PORTAL_HIDDEN_SO_COLUMNS.has(col);
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
  if (json && Object.prototype.hasOwnProperty.call(json, "portalColumns")) {
    setPortalColumnConfig(json.portalColumns);
  }
  // The Supabase fallback payload has no portalMode flag — keep the
  // previous state rather than silently unlocking the full app.
  if (json && json.portalMode !== undefined) {
    portalModeActive = json.portalMode === true;
  }
  updateHeaderGreeting();
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

  // Apply the tenant's saved portal column order, if any.
  if (portalColumnConfig && Array.isArray(portalColumnConfig.order)
    && typeof SO_COLUMNS !== "undefined" && typeof normalizeSoColumnOrder === "function") {
    const order = portalColumnConfig.order.filter(c => SO_COLUMNS.includes(c));
    if (order.length && typeof soColumnOrder !== "undefined") {
      soColumnOrder = normalizeSoColumnOrder(order);
      if (typeof applySoColumnOrder === "function") applySoColumnOrder();
    }
  }

  // Re-apply column visibility — the table header was built before the
  // portal flag arrived, so the portal-hidden columns are still showing.
  if (typeof applySoColumnVisibility === "function") applySoColumnVisibility();

  if (typeof switchAppView === "function") switchAppView("sales");
}
