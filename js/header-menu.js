const CXL_COUNTDOWN_STORAGE_BASE = "cxlCountdown";
const SPLIT_VIEW_STORAGE_BASE = "splitView";
const PAGE_SIZE_STORAGE_BASE = "pageSize";
const DEFAULT_PAGE_SIZE = "60";

/** Escape a value for safe interpolation into innerHTML strings. */
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const EMPTY_DISPLAY = "\u2013";
const EN_DASH = "\u2013";
const ELLIPSIS = "\u2026";
const CHECK_MARK = "\u2713";
const CHARGEBACK_ID_FIELD = "Chargeback ID";
const PACKING_LIST_ID_FIELD = "Packing List ID";
const CHARGEBACK_STATUSES = ["Open", "Approved", "Deducted", "Disputed"];
const CHARGEBACK_REASONS = [
  "Delayed",
  "Damaged",
  "Shortage",
  "Overage",
  "Wrong Packing",
  "Wrong Ticketing/Labeling",
  "No Packing List",
  "Wrong Packing List Info",
  "Other",
];

let cxlCountdownEnabled = false;
let splitViewEnabled = true;

function loadSplitViewPreference() {
  try {
    const stored = localStorage.getItem(scopedStorageKey(SPLIT_VIEW_STORAGE_BASE));
    applySplitViewPreference(stored === null ? true : stored === "1");
  } catch {
    applySplitViewPreference(true);
  }
}

function refreshSplitViewLayoutIfReady() {
  if (typeof switchAppView !== "function" || typeof currentAppView === "undefined") return;
  switchAppView(currentAppView);
}

function saveSplitViewPreference() {
  try {
    localStorage.setItem(scopedStorageKey(SPLIT_VIEW_STORAGE_BASE), splitViewEnabled ? "1" : "0");
  } catch {
    /* ignore storage failures */
  }
  if (typeof persistUserPreferencePatch === "function") {
    persistUserPreferencePatch({ splitViewEnabled });
  }
}

function applySplitViewPreference(enabled) {
  splitViewEnabled = Boolean(enabled);
  document.body.classList.toggle("split-view-enabled", splitViewEnabled);
  if (typeof updateSettingsSplitViewUi === "function") updateSettingsSplitViewUi();
  refreshSplitViewLayoutIfReady();
}

function setSplitViewEnabled(enabled) {
  applySplitViewPreference(enabled);
  saveSplitViewPreference();
}

function toggleSplitView() {
  setSplitViewEnabled(!splitViewEnabled);
}

function isSplitViewEnabled() {
  return splitViewEnabled;
}

function loadCxlCountdownPreference() {
  try {
    applyCxlCountdownPreference(localStorage.getItem(scopedStorageKey(CXL_COUNTDOWN_STORAGE_BASE)) === "1");
  } catch {
    applyCxlCountdownPreference(false);
  }
}

function saveCxlCountdownPreference() {
  try {
    localStorage.setItem(scopedStorageKey(CXL_COUNTDOWN_STORAGE_BASE), cxlCountdownEnabled ? "1" : "0");
  } catch {
    /* ignore storage failures */
  }
  if (typeof persistUserPreferencePatch === "function") {
    persistUserPreferencePatch({ cxlCountdownEnabled });
  }
}

function applyCxlCountdownPreference(enabled) {
  cxlCountdownEnabled = Boolean(enabled);
  if (typeof updateSettingsCountdownUi === "function") updateSettingsCountdownUi();
}

function setCxlCountdownEnabled(enabled) {
  applyCxlCountdownPreference(enabled);
  saveCxlCountdownPreference();
  renderTable();
  updateModalIfOpen();
}

function toggleCxlCountdown() {
  setCxlCountdownEnabled(!cxlCountdownEnabled);
}

function isPoTableViewActive() {
  const wrap = document.getElementById("poViewContent") || document.getElementById("poTableWrap");
  return Boolean(wrap && !wrap.hidden);
}

function isSalesOrdersViewActive() {
  const wrap = document.getElementById("salesOrderTableWrap");
  return Boolean(wrap && !wrap.hidden);
}

function isInvoicesViewActive() {
  const wrap = document.getElementById("invoiceTableWrap");
  return Boolean(wrap && !wrap.hidden);
}

function isGlobalShortcutBlocked(target) {
  if (isTypingInField(target)) return true;
  if (document.querySelector(".modal-backdrop.open")) return true;
  if (typeof openCellSelect !== "undefined" && openCellSelect) return true;
  return false;
}

function getCurrentViewSearchInput() {
  const view = typeof currentAppView !== "undefined" ? currentAppView : "po";
  const searchInputIds = {
    sales: "salesOrderSearchInput",
    po: "searchInput",
    shipments: "shipmentSearchInput",
    requests: "requestsSearchInput",
    chargebacks: "chargebackSearchInput",
    invoices: "invoiceSearchInput",
    customers: "customersSearchInput",
    styles: "stylesSearchInput",
    packingReviews: "packingReviewSearchInput",
  };
  const input = document.getElementById(searchInputIds[view]);
  if (input) return input;
  return document.querySelector(".toolbar:not([hidden]) .toolbar-search-wrap input[type='search']");
}

function focusCurrentViewSearch() {
  const input = getCurrentViewSearchInput();
  if (!input) return;
  input.focus();
  input.select();
}

function applyCurrentViewDivisionShortcut(division) {
  const view = typeof currentAppView !== "undefined" ? currentAppView : "po";
  if (view === "sales" && typeof setSoDivisionFilter === "function") {
    setSoDivisionFilter(division);
    return true;
  }
  if (view === "invoices" && typeof setInvDivisionFilter === "function") {
    setInvDivisionFilter(division);
    return true;
  }
  if ((view === "po" || isPoTableViewActive()) && typeof setDivisionFilter === "function") {
    setDivisionFilter(division);
    return true;
  }
  return false;
}

function switchAppViewFromShortcut(view) {
  if (typeof switchAppView !== "function") return;
  switchAppView(view);
  const hasRequestType = typeof currentRequestType !== "undefined" && Boolean(currentRequestType);
  if (view === "requests" && !hasRequestType && typeof switchRequestType === "function") {
    switchRequestType("approval");
  }
}

function isPaginationKeyboardEnabled() {
  if (isSalesOrdersViewActive()) {
    if (typeof isSoPageSizeAll === "function" && isSoPageSizeAll()) return false;
    if (typeof filteredSalesOrders !== "undefined" && typeof soPageSize !== "undefined") {
      return filteredSalesOrders.length > soPageSize;
    }
    return false;
  }
  if (isInvoicesViewActive()) {
    if (typeof isInvPageSizeAll === "function" && isInvPageSizeAll()) return false;
    if (typeof filteredInvoices !== "undefined" && typeof invPageSize !== "undefined") {
      return filteredInvoices.length > invPageSize;
    }
    return false;
  }
  if (!isPoTableViewActive()) return false;
  if (isPageSizeAll()) return false;
  if (filteredRows.length <= pageSize) return false;
  return true;
}

function initPaginationKeyboard() {
  document.addEventListener("keydown", e => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    if (isGlobalShortcutBlocked(e.target)) return;
    if (!isPaginationKeyboardEnabled()) return;

    e.preventDefault();
    if (isSalesOrdersViewActive() && typeof goToSoPage === "function") {
      if (e.key === "ArrowLeft") goToSoPage(soCurrentPage - 1);
      else goToSoPage(soCurrentPage + 1);
      return;
    }
    if (isInvoicesViewActive() && typeof goToInvPage === "function") {
      if (e.key === "ArrowLeft") goToInvPage(invCurrentPage - 1);
      else goToInvPage(invCurrentPage + 1);
      return;
    }
    if (e.key === "ArrowLeft") goToPage(currentPage - 1);
    else goToPage(currentPage + 1);
  });
}

function focusPoSearch() {
  focusCurrentViewSearch();
}

function updateSearchInputVisualState() {
  const input = document.getElementById("searchInput");
  const overlay = document.getElementById("searchInputOverlay");
  if (!input) return;

  const isFocused = document.activeElement === input;
  const q = input.value.trim();
  const showCommitted = !isFocused && q.length > 0;

  input.classList.toggle("has-value", showCommitted);
  input.classList.toggle("search-applied", showCommitted);

  if (!overlay) return;
  if (showCommitted) {
    overlay.classList.add("is-visible");
    overlay.innerHTML = `<mark class="search-match search-input-match">${escapeHtml(q)}</mark>`;
  } else {
    overlay.classList.remove("is-visible");
    overlay.innerHTML = "";
  }
}

function initSearchInput() {
  const input = document.getElementById("searchInput");
  if (!input) return;

  input.addEventListener("focus", () => {
    input.classList.remove("has-value", "search-applied");
    const overlay = document.getElementById("searchInputOverlay");
    overlay?.classList.remove("is-visible");
    if (overlay) overlay.innerHTML = "";
  });

  input.addEventListener("blur", () => commitPoSearch());

  input.addEventListener("search", () => commitPoSearch());

  input.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    input.blur();
  });

  updateSearchInputVisualState();
}

function initToolbarKeyboard() {
  document.addEventListener("keydown", e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === " " || e.code === "Space") {
      if (isGlobalShortcutBlocked(e.target)) return;
      if (typeof miniSelectedIndices !== "undefined" && miniSelectedIndices.size > 0) return;
      e.preventDefault();
      focusCurrentViewSearch();
      return;
    }

    if (isGlobalShortcutBlocked(e.target)) return;

    // Digit keys follow the nav order: logo (Home) first, then the tabs.
    const viewShortcuts = {
      1: "dashboard",
      2: "sales",
      3: "po",
      4: "shipments",
      5: "requests",
      6: "invoices",
      7: "chargebacks",
      8: "customers",
    };
    const viewShortcutTabs = {
      dashboard: "navLogoDashboard",
      sales: "navTabSalesOrders",
      po: "navTabPo",
      shipments: "navTabShipments",
      requests: "navTabRequests",
      invoices: "navTabInvoices",
      chargebacks: "navTabChargebacks",
      customers: "navTabCustomers",
    };
    if (Object.prototype.hasOwnProperty.call(viewShortcuts, e.key)) {
      const view = viewShortcuts[e.key];
      // Skip views whose tab is feature-hidden (e.g. Chargebacks turned off).
      const tab = document.getElementById(viewShortcutTabs[view]);
      if (tab && tab.hidden) return;
      e.preventDefault();
      switchAppViewFromShortcut(view);
      return;
    }

    const key = e.key.toLowerCase();
    if (key === "a") {
      if (applyCurrentViewDivisionShortcut("")) e.preventDefault();
    } else if (key === "e") {
      if (applyCurrentViewDivisionShortcut("Elevator Disco")) e.preventDefault();
    } else if (key === "f") {
      if (applyCurrentViewDivisionShortcut("Freesia")) e.preventDefault();
    }
  });
}

function updateHeaderMenuChecks() {
  if (typeof updateSettingsUi === "function") updateSettingsUi();
}

function closeHeaderMenu() {
  const menu = document.getElementById("headerMenuDropdown");
  const btn = document.getElementById("headerMenuBtn");
  if (menu) menu.hidden = true;
  if (btn) btn.setAttribute("aria-expanded", "false");
}

function openHeaderMenu() {
  const menu = document.getElementById("headerMenuDropdown");
  const btn = document.getElementById("headerMenuBtn");
  if (!menu || !btn) return;
  menu.hidden = false;
  btn.setAttribute("aria-expanded", "true");
  updateHeaderMenuChecks();
}

let thTooltipEl = null;

function getThTooltipEl() {
  if (thTooltipEl) return thTooltipEl;
  thTooltipEl = document.createElement("div");
  thTooltipEl.id = "thTooltipCard";
  thTooltipEl.className = "th-tooltip-card";
  thTooltipEl.hidden = true;
  document.body.appendChild(thTooltipEl);
  return thTooltipEl;
}

function hideThTooltip() {
  const tooltip = getThTooltipEl();
  tooltip.hidden = true;
}

function positionThTooltip(targetEl, text) {
  const tooltip = getThTooltipEl();
  tooltip.textContent = text;
  tooltip.hidden = false;
  const rect = targetEl.getBoundingClientRect();
  tooltip.style.left = `${rect.left + rect.width / 2}px`;
  tooltip.style.top = `${rect.bottom + 6}px`;
}

function isTextTruncated(el) {
  return el.scrollWidth > el.clientWidth + 1;
}

function getThTooltipTarget(th) {
  if (th.classList.contains("th-flag-col")
    || th.classList.contains("th-packing-list-col")
    || th.classList.contains("th-select-col")) {
    return null;
  }
  const label = th.querySelector(".th-label");
  if (label) return label;
  if (th.querySelector("input, svg, button")) return null;
  return th;
}

function initHeaderTooltips() {
  document.querySelectorAll("table thead th").forEach(th => {
    const target = getThTooltipTarget(th);
    if (!target) return;
    const text = target.textContent.trim();
    if (!text) return;

    target.addEventListener("mouseenter", () => {
      if (!isTextTruncated(target)) return;
      positionThTooltip(target, text);
    });
    target.addEventListener("mouseleave", hideThTooltip);
  });

  window.addEventListener("scroll", hideThTooltip, true);
  window.addEventListener("resize", hideThTooltip);
}

function initHeaderMenu() {
  const btn = document.getElementById("headerMenuBtn");
  const menu = document.getElementById("headerMenuDropdown");
  if (!btn || !menu) return;

  btn.addEventListener("click", e => {
    e.stopPropagation();
    if (menu.hidden) openHeaderMenu();
    else closeHeaderMenu();
  });

  initCsvImport();

  document.getElementById("headerMenuSettings")?.addEventListener("click", e => {
    e.stopPropagation();
    closeHeaderMenu();
    if (typeof openSettingsModal === "function") openSettingsModal("general");
  });

  document.addEventListener("click", e => {
    if (menu.hidden) return;
    if (menu.contains(e.target) || btn.contains(e.target)) return;
    closeHeaderMenu();
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeHeaderMenu();
  });

  updateHeaderMenuChecks();
}
