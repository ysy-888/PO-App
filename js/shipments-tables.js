/** Shipment list, modals, and PO ↔ shipment linking. Requires po-table.js loaded first. */

const SHIPMENT_ID_FIELD = "Shipment ID";

const SHIPMENT_EXF_REQUEST_ID_FIELD = "EXF Request ID";

// Shipment lifecycle: Open (default) until "received" into the warehouse.
const SHIPMENT_STATUS_FIELD = "Status";
const SHIPMENT_RECEIVED_DATE_FIELD = "Received Date";
const SHIPMENT_STATUS_RECEIVED = "Received";
const SHIPMENT_STATUS_OPEN = "Open";

const SHIPMENT_STATUS_FILTER_ALL = "";
const SHIPMENT_STATUS_FILTER_BUTTONS = [
  { label: "All", value: SHIPMENT_STATUS_FILTER_ALL },
  { divider: true },
  { label: "Open", value: SHIPMENT_STATUS_OPEN },
  { label: "Received", value: SHIPMENT_STATUS_RECEIVED },
];

let shipmentActiveStatusFilter = SHIPMENT_STATUS_OPEN;

const SHIPMENT_TABLE_COLUMNS = [
  "Shipment ID", SHIPMENT_STATUS_FIELD, SHIPMENT_EXF_REQUEST_ID_FIELD, "Ship Method", "PO Count", "Vessel", "House #", "EXF",
  "Shipped", "ETD", "ETA", "IHD", "Notes"
];

const SHIPMENT_FORM_FIELDS = [
  SHIPMENT_EXF_REQUEST_ID_FIELD, "Ship Method", "Vessel", "House #", "EXF", "Shipped", "ETD", "ETA", "IHD", "Notes"
];

const SHIPMENT_DATE_FIELDS = new Set(["EXF", "Shipped", "ETD", "ETA", "IHD"]);

const SHIPMENT_MODAL_INFO_FIELDS = [SHIPMENT_EXF_REQUEST_ID_FIELD, "Ship Method", "Vessel", "House #"];
const SHIPMENT_MODAL_DATE_FIELDS = ["EXF", "Shipped", "ETD", "ETA", "IHD"];

/** Shared by the Shipment and ASN Request form tables (same columns/order). */
const SHIPMENT_LINKED_PO_COLUMNS = [
  { col: "PO #", label: "PO #", cellClass: "shipment-po-cell-id" },
  { col: "Vendor", label: "Vendor", cellClass: "shipment-po-cell-vendor" },
  { col: "Buyer", label: "Buyer", cellClass: "shipment-po-cell-buyer" },
  { col: "Buyer PO #", label: "Buyer PO #", cellClass: "shipment-po-cell-buyer-po" },
  { col: "SO CXL Date", label: "SO CXL Date", cellClass: "shipment-po-cell-date" },
  { col: "Style #", label: "Style #", cellClass: "shipment-po-cell-wrap shipment-po-cell-style" },
  { col: "Color", label: "Color", cellClass: "shipment-po-cell-wrap" },
  { col: "PO Qty", label: "Ord Qty", cellClass: "shipment-po-cell-qty" },
  { col: "Actual Qty", label: "Act Qty", cellClass: "shipment-po-cell-qty" },
  { col: "Ctn Qty", label: "Ctn Qty", cellClass: "shipment-po-cell-qty" },
  { col: "Status", label: "Status", cellClass: "shipment-po-cell-status" },
];

const SHIPMENT_LINKED_PO_COL_CLASSES = [
  "shipment-po-col-select",
  "shipment-po-col-id",
  "shipment-po-col-vendor",
  "shipment-po-col-buyer",
  "shipment-po-col-buyer-po",
  "shipment-po-col-date",
  "shipment-po-col-style-num",
  "shipment-po-col-style",
  "shipment-po-col-qty",
  "shipment-po-col-qty",
  "shipment-po-col-qty",
  "shipment-po-col-status",
];

/** Linked PO table column widths (px), select column first. */
const SHIPMENT_LINKED_PO_COLUMN_WIDTHS = [52, 72, 120, 160, 104, 88, 140, 96, 58, 58, 58, 96];

/** PO fields synced from / cleared with a shipment. */
const SHIPMENT_PO_CLEAR_FIELDS = [
  "Ship Method", "Vessel", "House #", "EXF", "Shipped", "ETD", "ETA", "IHD"
];

const SHIPMENT_TABLE_COLSPAN = SHIPMENT_TABLE_COLUMNS.length + 1;

const CHARGEBACK_PO_COLUMNS = [
  "PO #", "SO #", "Style #", "Color", "Buyer", "Buyer PO #",
  "PO Date", "CXL Date", "PO Qty", "Actual Qty", "EXF", "IHD"
];

const CHARGEBACK_TABLE_COLUMNS = [
  "Created At", ...CHARGEBACK_PO_COLUMNS,
  "Reason", "Amount", "Notes", "Status", "Updated At",
  "Chargeback ID"
];

const CHARGEBACK_DATE_FIELDS = new Set(["Date", "Created At", "Updated At", "PO Date", "CXL Date", "EXF", "IHD"]);
const CHARGEBACK_AMOUNT_FIELDS = new Set(["Amount"]);
const CHARGEBACK_TABLE_COLSPAN = CHARGEBACK_TABLE_COLUMNS.length + 1;

let allShipments = [];
let filteredShipments = [];
let filteredChargebacks = [];
let shipmentModalRow = null;
let createShipmentPoNumbers = [];
/** @type {{ exfRequestId: string, lockExfDate: boolean } | null} */
let createShipmentContext = null;
let currentAppView = "sales";
let shipmentAddPoPanelOpen = false;

function normalizeShipment(row) {
  return { ...row, Selected: false };
}

function resetLocalShipmentSelectedState(shipments) {
  shipments.forEach(shipment => { shipment["Selected"] = false; });
}

function clearPoShipmentData(row) {
  row[SHIPMENT_ID_FIELD] = "";
  SHIPMENT_PO_CLEAR_FIELDS.forEach(field => { row[field] = ""; });
  row["EST IHD"] = calculateEstIhd(row["Ship Method"], row["EST EXF"]);
  row["Status"] = isExfRequested(row) ? "Requested" : "WIP";
}

function getShipmentById(id) {
  const key = String(id ?? "").trim();
  if (!key) return null;
  return allShipments.find(s => String(s[SHIPMENT_ID_FIELD] ?? "").trim() === key) ?? null;
}

function getShipmentStatus(shipment) {
  const status = String(shipment?.[SHIPMENT_STATUS_FIELD] ?? "").trim();
  return status === SHIPMENT_STATUS_RECEIVED ? SHIPMENT_STATUS_RECEIVED : SHIPMENT_STATUS_OPEN;
}

function isShipmentReceived(shipment) {
  return getShipmentStatus(shipment) === SHIPMENT_STATUS_RECEIVED;
}

function getOpenShipments() {
  return (allShipments ?? []).filter(shipment => !isShipmentReceived(shipment));
}

function getPosForShipment(shipmentId) {
  const key = String(shipmentId ?? "").trim();
  if (isEmptyValue(key)) return [];
  return allRows.filter(row => getPoShipmentId(row) === key);
}

function countPosForShipment(shipmentId) {
  return getPosForShipment(shipmentId).length;
}

function getCheckedFilteredPos() {
  return filteredRows.filter(row => isTruthy(row["Selected"]));
}

function getUnassignedCheckedFilteredPos() {
  return getCheckedFilteredPos().filter(row => !poHasShipment(row));
}

function getEligibleCheckedFilteredPosForShipment() {
  return getCheckedFilteredPos().filter(isPoEligibleForShipment);
}

function getPoShipmentId(row) {
  return String(row[SHIPMENT_ID_FIELD] ?? "").trim();
}

function poHasShipment(row) {
  const id = getPoShipmentId(row);
  if (isEmptyValue(id)) return false;
  return getShipmentById(id) != null;
}

function getCheckedFilteredShipments() {
  return filteredShipments.filter(shipment => isTruthy(shipment["Selected"]));
}

function getFilteredShipmentSelectedCount() {
  return filteredShipments.filter(shipment => isTruthy(shipment["Selected"])).length;
}

function getCheckedFilteredChargebacks() {
  return filteredChargebacks.filter(chargeback => isTruthy(chargeback["Selected"]));
}

function getFilteredChargebackSelectedCount() {
  return filteredChargebacks.filter(chargeback => isTruthy(chargeback["Selected"])).length;
}

function toggleShipmentSelected(shipment, selected) {
  const next = toSheetBool(selected);
  if (isTruthy(shipment["Selected"]) === next) return;
  shipment["Selected"] = next;
  renderShipmentsTable();
  updateShipmentSelectAllHeader();
  updateDeleteShipmentButton();
}

function setAllFilteredShipmentsSelected(selected) {
  const next = toSheetBool(selected);
  let changed = false;
  filteredShipments.forEach(shipment => {
    if (isTruthy(shipment["Selected"]) === next) return;
    shipment["Selected"] = next;
    changed = true;
  });
  if (!changed) return;
  renderShipmentsTable();
  updateShipmentSelectAllHeader();
  updateDeleteShipmentButton();
}

function updateShipmentSelectAllHeader() {
  const cb = document.getElementById("selectAllShipmentsCheckbox");
  if (!cb) return;

  if (filteredShipments.length === 0) {
    cb.checked = false;
    cb.indeterminate = false;
    cb.disabled = true;
    updateShipmentRowCounter();
    return;
  }

  cb.disabled = false;
  const selectedCount = getFilteredShipmentSelectedCount();
  cb.checked = selectedCount === filteredShipments.length;
  cb.indeterminate = selectedCount > 0 && selectedCount < filteredShipments.length;
  updateShipmentRowCounter();
}

function updateDeleteShipmentButton() {
  const btn = document.getElementById("deleteShipmentBtn");
  if (!btn) return;
  const count = getCheckedFilteredShipments().length;
  const show = currentAppView === "shipments" && count > 0;
  btn.hidden = !show;
  syncViewActionToolbars();
  if (!show) return;
  btn.textContent = count === 1 ? "Delete shipment" : `Delete shipments (${count})`;
}

function toggleChargebackSelected(chargeback, selected) {
  const next = toSheetBool(selected);
  if (isTruthy(chargeback["Selected"]) === next) return;
  chargeback["Selected"] = next;
  renderChargebacksTable();
  updateChargebackSelectAllHeader();
  updateDeleteChargebackButton();
}

function setAllFilteredChargebacksSelected(selected) {
  const next = toSheetBool(selected);
  let changed = false;
  filteredChargebacks.forEach(chargeback => {
    if (isTruthy(chargeback["Selected"]) === next) return;
    chargeback["Selected"] = next;
    changed = true;
  });
  if (!changed) return;
  renderChargebacksTable();
  updateChargebackSelectAllHeader();
  updateDeleteChargebackButton();
}

function updateChargebackSelectAllHeader() {
  const cb = document.getElementById("selectAllChargebacksCheckbox");
  if (!cb) return;

  if (filteredChargebacks.length === 0) {
    cb.checked = false;
    cb.indeterminate = false;
    cb.disabled = true;
    updateChargebackRowCounter();
    return;
  }

  cb.disabled = false;
  const selectedCount = getFilteredChargebackSelectedCount();
  cb.checked = selectedCount === filteredChargebacks.length;
  cb.indeterminate = selectedCount > 0 && selectedCount < filteredChargebacks.length;
  updateChargebackRowCounter();
}

function updateDeleteChargebackButton() {
  const btn = document.getElementById("deleteChargebackBtn");
  if (!btn) return;
  const count = getCheckedFilteredChargebacks().length;
  const show = currentAppView === "chargebacks" && count > 0;
  btn.hidden = !show;
  syncViewActionToolbars();
  if (!show) return;
  btn.textContent = count === 1 ? "Delete chargeback" : `Delete chargebacks (${count})`;
}

function renderChargebackSelectedCell(td, chargeback) {
  td.className = "td-select-cell readonly-no-select";
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.className = "po-select-checkbox";
  cb.checked = isTruthy(chargeback["Selected"]);
  cb.setAttribute("aria-label", `Select chargeback ${chargeback[CHARGEBACK_ID_FIELD] ?? ""}`);
  cb.addEventListener("click", e => {
    e.stopPropagation();
    toggleChargebackSelected(chargeback, cb.checked);
  });
  td.appendChild(cb);
}

function renderShipmentSelectedCell(td, shipment) {
  td.className = "td-select-cell readonly-no-select";
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.className = "po-select-checkbox";
  cb.checked = isTruthy(shipment["Selected"]);
  cb.setAttribute("aria-label", `Select shipment ${shipment[SHIPMENT_ID_FIELD] ?? ""}`);
  cb.addEventListener("click", e => {
    e.stopPropagation();
    toggleShipmentSelected(shipment, cb.checked);
  });
  td.appendChild(cb);
}


function renderShipmentIdCell(td, row) {
  td.className = "readonly readonly-no-select";
  const id = String(row[SHIPMENT_ID_FIELD] ?? "").trim();
  if (!id) {
    setDisplayText(td, EMPTY_DISPLAY);
    return;
  }
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "shipment-id-link";
  btn.textContent = id;
  btn.title = `Open shipment ${id}`;
  btn.setAttribute("aria-label", `Open shipment ${id}`);
  btn.addEventListener("click", e => {
    e.stopPropagation();
    openShipmentDetail(id);
  });
  td.appendChild(btn);
}

/** @type {null | "approval" | "exf" | "asn"} */
let currentRequestType = null;

const ALL_REQUEST_TYPES = ["approval", "exf", "asn"];

function clearRequestTypeSelection() {
  currentRequestType = null;
  ALL_REQUEST_TYPES.forEach(t => {
    const btn = document.querySelector(`[data-request-type="${t}"]`);
    if (btn) btn.classList.remove("active");
  });
}

function switchRequestType(type) {
  if (!type) return;
  currentRequestType = type;

  ALL_REQUEST_TYPES.forEach(t => {
    const wrap = document.getElementById(t === "exf" ? "exfRequestTableWrap" : t + "RequestTableWrap");
    if (wrap) wrap.hidden = t !== type;
    const btn = document.querySelector(`[data-request-type="${t}"]`);
    if (btn) btn.classList.toggle("active", t === type);
  });

  // Route the shared search input to the active type's filter function
  const searchInput = document.getElementById("requestsSearchInput");
  const q = (searchInput?.value ?? "").toLowerCase();
  if (type === "approval" && typeof applyApprovalFilters === "function") {
    document.getElementById("approvalRequestSearchInput").value = q;
    applyApprovalFilters();
  } else if (type === "exf" && typeof applyExfRequestFilters === "function") {
    document.getElementById("exfRequestSearchInput").value = q;
    applyExfRequestFilters();
  } else if (type === "asn" && typeof applyAsnRequestFilters === "function") {
    document.getElementById("asnRequestSearchInput").value = q;
    applyAsnRequestFilters();
  }

  updateRequestsRowCounter();
  syncViewActionToolbars(currentAppView);
}

function updateRequestsRowCounter() {
  const counterEl = document.getElementById("requestsRowCounter");
  if (!counterEl) return;
  if (!currentRequestType) {
    counterEl.textContent = "— requests";
    return;
  }
  let count = 0;
  let label = "requests";
  if (currentRequestType === "approval") {
    count = typeof filteredApprovals !== "undefined" ? filteredApprovals.length : 0;
    label = count === 1 ? "approval" : "approvals";
  } else if (currentRequestType === "exf") {
    count = typeof filteredExfRequests !== "undefined" ? filteredExfRequests.length : 0;
    label = count === 1 ? "EXF request" : "EXF requests";
  } else if (currentRequestType === "asn") {
    count = typeof filteredAsnRequests !== "undefined" ? filteredAsnRequests.length : 0;
    label = count === 1 ? "ASN request" : "ASN requests";
  }
  counterEl.textContent = `${count} ${label}`;
}

function isSplitViewTab(view) {
  return view === "shipments" || view === "requests" || view === "chargebacks";
}

function isSplitViewLayoutEnabled() {
  if (typeof isSplitViewEnabled === "function") return isSplitViewEnabled();
  return document.body.classList.contains("split-view-enabled");
}

function syncViewActionToolbars(view = currentAppView) {
  const allToolbars = [
    "shipmentToolbar",
    "requestsToolbar",
    "chargebackToolbar",
    "customersToolbar",
    "packingReviewToolbar",
    "stylesToolbar",
  ];
  allToolbars.forEach(id => {
    const toolbar = document.getElementById(id);
    if (toolbar) toolbar.hidden = true;
  });

  const viewToolbarMap = {
    shipments: "shipmentToolbar",
    requests: "requestsToolbar",
    chargebacks: "chargebackToolbar",
    customers: "customersToolbar",
    packingReviews: "packingReviewToolbar",
    styles: "stylesToolbar",
  };
  const activeId = viewToolbarMap[view];
  if (activeId) {
    const toolbar = document.getElementById(activeId);
    if (toolbar) toolbar.hidden = false;
  }

  const asnStatusCluster = document.getElementById("asnStatusFilterCluster");
  if (asnStatusCluster) asnStatusCluster.hidden = !(view === "requests" && currentRequestType === "asn");
}

function switchAppView(view) {
  // Showroom portal accounts only ever see the Sales Orders view.
  if (typeof isPortalMode === "function" && isPortalMode() && view !== "sales") view = "sales";
  currentAppView = view;
  const splitView = isSplitViewLayoutEnabled();
  const splitActive = splitView && isSplitViewTab(view);
  const salesOrderToolbar = document.getElementById("salesOrderToolbar");
  const poToolbar = document.getElementById("poToolbar");
  const appMain = document.getElementById("appMain");
  const poViewContent = document.getElementById("poViewContent");
  const poTableWrap = document.getElementById("poTableWrap");
  const shipmentTableWrap = document.getElementById("shipmentTableWrap");
  const requestsTableWrap = document.getElementById("requestsTableWrap");
  const chargebackTableWrap = document.getElementById("chargebackTableWrap");
  const packingReviewTableWrap = document.getElementById("packingReviewTableWrap");
  const customersTableWrap = document.getElementById("customersTableWrap");
  const stylesTableWrap = document.getElementById("stylesTableWrap");
  const salesOrderTableWrap = document.getElementById("salesOrderTableWrap");
  const invoiceTableWrap = document.getElementById("invoiceTableWrap");
  const poTab = document.getElementById("navTabPo");
  const requestsTab = document.getElementById("navTabRequests");
  const shipTab = document.getElementById("navTabShipments");
  const chargebackTab = document.getElementById("navTabChargebacks");
  const packingReviewTab = document.getElementById("navTabPackingReviews");
  const customersTab = document.getElementById("navTabCustomers");
  const stylesTab = document.getElementById("navTabStyles");
  const salesOrdersTab = document.getElementById("navTabSalesOrders");
  const invoicesTab = document.getElementById("navTabInvoices");

  if (appMain) appMain.classList.toggle("is-split-active", splitActive);

  const invoiceToolbar = document.getElementById("invoiceToolbar");
  if (poToolbar) poToolbar.hidden = view !== "po" && !splitActive;
  if (salesOrderToolbar) salesOrderToolbar.hidden = view !== "sales";
  if (invoiceToolbar) invoiceToolbar.hidden = view !== "invoices";
  syncViewActionToolbars(view);

  if (splitActive) {
    if (poViewContent) poViewContent.hidden = false;
    if (poTableWrap) poTableWrap.hidden = false;
  } else {
    if (poViewContent) poViewContent.hidden = view !== "po";
    if (poTableWrap) poTableWrap.hidden = view !== "po";
    if (view !== "po" && typeof closePoPackingPane === "function") {
      closePoPackingPane({ clearSelection: false });
    }
  }

  const dashboardWrap = document.getElementById("dashboardWrap");
  if (dashboardWrap) dashboardWrap.hidden = view !== "dashboard";
  document.getElementById("navLogoDashboard")?.classList.toggle("is-active", view === "dashboard");

  if (shipmentTableWrap) shipmentTableWrap.hidden = view !== "shipments";
  if (requestsTableWrap) requestsTableWrap.hidden = view !== "requests";
  if (chargebackTableWrap) chargebackTableWrap.hidden = view !== "chargebacks";
  if (packingReviewTableWrap) packingReviewTableWrap.hidden = view !== "packingReviews";
  if (customersTableWrap) customersTableWrap.hidden = view !== "customers";
  if (stylesTableWrap) stylesTableWrap.hidden = view !== "styles";
  if (salesOrderTableWrap) salesOrderTableWrap.hidden = view !== "sales";
  if (invoiceTableWrap) invoiceTableWrap.hidden = view !== "invoices";
  const poFooterEnd = document.getElementById("poFooterEnd");
  if (poFooterEnd) poFooterEnd.hidden = view !== "po" && view !== "sales" && view !== "invoices" && !splitActive;
  if (view === "sales" && typeof syncPaginationFooterForSales === "function") {
    syncPaginationFooterForSales();
  } else if (view === "invoices" && typeof syncPaginationFooterForInvoices === "function") {
    syncPaginationFooterForInvoices();
  } else if (view === "po" && typeof syncPaginationFooterForPo === "function") {
    syncPaginationFooterForPo();
  }
  poTab?.classList.toggle("is-active", view === "po");
  poTab?.setAttribute("aria-selected", view === "po" ? "true" : "false");
  requestsTab?.classList.toggle("is-active", view === "requests");
  requestsTab?.setAttribute("aria-selected", view === "requests" ? "true" : "false");
  shipTab?.classList.toggle("is-active", view === "shipments");
  shipTab?.setAttribute("aria-selected", view === "shipments" ? "true" : "false");
  chargebackTab?.classList.toggle("is-active", view === "chargebacks");
  chargebackTab?.setAttribute("aria-selected", view === "chargebacks" ? "true" : "false");
  packingReviewTab?.classList.toggle("is-active", view === "packingReviews");
  packingReviewTab?.setAttribute("aria-selected", view === "packingReviews" ? "true" : "false");
  customersTab?.classList.toggle("is-active", view === "customers");
  customersTab?.setAttribute("aria-selected", view === "customers" ? "true" : "false");
  stylesTab?.classList.toggle("is-active", view === "styles");
  stylesTab?.setAttribute("aria-selected", view === "styles" ? "true" : "false");
  salesOrdersTab?.classList.toggle("is-active", view === "sales");
  salesOrdersTab?.setAttribute("aria-selected", view === "sales" ? "true" : "false");
  invoicesTab?.classList.toggle("is-active", view === "invoices");
  invoicesTab?.setAttribute("aria-selected", view === "invoices" ? "true" : "false");

  if (view !== "requests") {
    clearRequestTypeSelection();
  } else if (currentRequestType) {
    switchRequestType(currentRequestType);
  }

  if (view === "dashboard" && typeof renderDashboard === "function") renderDashboard();
  if (view === "shipments") applyShipmentFilters();
  if (view === "chargebacks") applyChargebackFilters();
  if (view === "packingReviews" && typeof applyPackingReviewFilters === "function") applyPackingReviewFilters();
  if (view === "customers" && typeof applyCustomerFilters === "function") applyCustomerFilters();
  if (view === "styles" && typeof applyStyleFilters === "function") applyStyleFilters();
  if (view === "sales" && typeof applySalesOrderFilters === "function") applySalesOrderFilters();
  if (view === "invoices" && typeof applyInvoiceFilters === "function") applyInvoiceFilters();
  updateDeleteShipmentButton();
  updateDeleteChargebackButton();
  updateToolbarRequestButtons();
}

function applyShipmentFilters() {
  const q = (document.getElementById("shipmentSearchInput")?.value ?? "").toLowerCase();
  filteredShipments = allShipments.filter(shipment => {
    if (shipmentActiveStatusFilter && getShipmentStatus(shipment) !== shipmentActiveStatusFilter) {
      return false;
    }
    if (!q) return true;
    const haystack = SHIPMENT_TABLE_COLUMNS.map(col => {
      if (col === "PO Count") return String(countPosForShipment(shipment[SHIPMENT_ID_FIELD]));
      return String(shipment[col] ?? "");
    }).join(" ").toLowerCase();
    return haystack.includes(q);
  });
  filteredShipments.sort((a, b) =>
    String(a[SHIPMENT_ID_FIELD]).localeCompare(String(b[SHIPMENT_ID_FIELD]), undefined, { numeric: true })
  );
  renderShipmentsTable();
  updateShipmentSelectAllHeader();
  updateDeleteShipmentButton();
}

function syncShipmentStatusFilterToolbar() {
  document.querySelectorAll("#shipmentStatusFilters .filter-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.status === shipmentActiveStatusFilter);
  });
}

function setShipmentStatusFilter(status) {
  shipmentActiveStatusFilter = String(status ?? "");
  syncShipmentStatusFilterToolbar();
  applyShipmentFilters();
}

function initShipmentStatusFilters() {
  const statusGroup = document.getElementById("shipmentStatusFilters");
  if (!statusGroup) return;
  statusGroup.replaceChildren();
  SHIPMENT_STATUS_FILTER_BUTTONS.forEach(item => {
    if (item.divider) {
      const divider = document.createElement("div");
      divider.className = "filter-btn-group-divider";
      divider.setAttribute("aria-hidden", "true");
      statusGroup.appendChild(divider);
      return;
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "filter-btn";
    btn.dataset.status = item.value;
    btn.textContent = item.label;
    btn.addEventListener("click", () => setShipmentStatusFilter(item.value));
    statusGroup.appendChild(btn);
  });
  syncShipmentStatusFilterToolbar();
}

function updateShipmentRowCounter() {
  const el = document.getElementById("shipmentRowCounter");
  if (!el) return;
  const total = filteredShipments.length;
  const rowText = total === 1 ? "1 shipment" : `${total} shipments`;
  const selectedCount = getFilteredShipmentSelectedCount();
  el.textContent = selectedCount >= 1
    ? `${selectedCount} selected out of ${rowText}`
    : rowText;
}

function formatShipmentCell(col, shipment) {
  if (col === "PO Count") return String(countPosForShipment(shipment[SHIPMENT_ID_FIELD]));
  if (col === SHIPMENT_STATUS_FIELD) return getShipmentStatus(shipment);
  const val = shipment[col] ?? "";
  if (SHIPMENT_DATE_FIELDS.has(col)) return formatDateForDisplay(val);
  if (isEmptyValue(val)) return EMPTY_DISPLAY;
  if (col === "Notes") {
    const s = String(val);
    return s.length > 48 ? s.slice(0, 45) + "…" : s;
  }
  return String(val);
}

function renderShipmentsTable() {
  const tbody = document.getElementById("shipmentTableBody");
  if (!tbody) return;

  if (filteredShipments.length === 0) {
    tbody.innerHTML = `<tr class="state-row"><td colspan="${SHIPMENT_TABLE_COLSPAN}">No shipments yet.</td></tr>`;
    updateShipmentSelectAllHeader();
    updateDeleteShipmentButton();
    return;
  }

  tbody.innerHTML = "";
  filteredShipments.forEach(shipment => {
    const tr = document.createElement("tr");
    tr.className = "clickable-row";
    tr.dataset.shipmentId = shipment[SHIPMENT_ID_FIELD];
    tr.ondblclick = () => openShipmentDetail(shipment);

    const selectTd = document.createElement("td");
    renderShipmentSelectedCell(selectTd, shipment);
    tr.appendChild(selectTd);

    SHIPMENT_TABLE_COLUMNS.forEach(col => {
      const td = document.createElement("td");
      td.dataset.col = col;
      if (col === SHIPMENT_STATUS_FIELD) {
        const status = getShipmentStatus(shipment);
        const badge = document.createElement("span");
        badge.className = "badge " + (status === SHIPMENT_STATUS_RECEIVED ? "badge-received" : "badge-otw");
        badge.textContent = status;
        td.className = "readonly readonly-no-select";
        td.appendChild(badge);
        tr.appendChild(td);
        return;
      }
      const text = formatShipmentCell(col, shipment);
      if (text === EMPTY_DISPLAY) {
        setDisplayText(td, EMPTY_DISPLAY);
      } else {
        mountSearchHighlightedText(td, text, text);
      }
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  updateShipmentSelectAllHeader();
  updateDeleteShipmentButton();
}

function getChargebackPoRow(chargeback) {
  return findRowByPo?.(chargeback["PO #"]) ?? null;
}

function getChargebackTableValue(chargeback, col) {
  if (CHARGEBACK_PO_COLUMNS.includes(col)) {
    return getChargebackPoRow(chargeback)?.[col] ?? "";
  }
  return chargeback[col] ?? "";
}

function formatChargebackTableCell(col, chargeback) {
  const val = getChargebackTableValue(chargeback, col);
  if (CHARGEBACK_AMOUNT_FIELDS.has(col)) return formatChargebackAmount(val);
  if (CHARGEBACK_DATE_FIELDS.has(col)) return formatDateForDisplay(val);
  if (isEmptyValue(val)) return EMPTY_DISPLAY;
  if (col === "Notes") {
    const s = String(val);
    return s.length > 56 ? s.slice(0, 53) + "..." : s;
  }
  return String(val);
}

function applyChargebackFilters() {
  const q = (document.getElementById("chargebackSearchInput")?.value ?? "").toLowerCase();
  filteredChargebacks = allChargebacks.filter(chargeback => {
    if (!q) return true;
    const haystack = CHARGEBACK_TABLE_COLUMNS
      .map(col => String(getChargebackTableValue(chargeback, col) ?? ""))
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
  filteredChargebacks.sort((a, b) => {
    const dateCompare = normalizeToYmd(b["Created At"] || b["Date"])
      .localeCompare(normalizeToYmd(a["Created At"] || a["Date"]));
    if (dateCompare !== 0) return dateCompare;
    return String(b[CHARGEBACK_ID_FIELD] ?? "").localeCompare(
      String(a[CHARGEBACK_ID_FIELD] ?? ""),
      undefined,
      { numeric: true }
    );
  });
  renderChargebacksTable();
  updateChargebackRowCounter();
  updateChargebackSelectAllHeader();
  updateDeleteChargebackButton();
}

function updateChargebackRowCounter() {
  const el = document.getElementById("chargebackRowCounter");
  if (!el) return;
  const total = filteredChargebacks.length;
  const rowText = total === 1 ? "1 chargeback" : `${total} chargebacks`;
  const selectedCount = getFilteredChargebackSelectedCount();
  el.textContent = selectedCount >= 1
    ? `${selectedCount} selected out of ${rowText}`
    : rowText;
}

function renderChargebacksTable() {
  const tbody = document.getElementById("chargebackTableBody");
  if (!tbody) return;

  if (filteredChargebacks.length === 0) {
    tbody.innerHTML = `<tr class="state-row"><td colspan="${CHARGEBACK_TABLE_COLSPAN}">No chargebacks yet.</td></tr>`;
    updateChargebackSelectAllHeader();
    updateDeleteChargebackButton();
    updateChargebackRowCounter();
    return;
  }

  tbody.innerHTML = "";
  filteredChargebacks.forEach(chargeback => {
    const tr = document.createElement("tr");
    tr.className = "clickable-row";
    tr.dataset.chargebackId = chargeback[CHARGEBACK_ID_FIELD] ?? "";
    const poRow = getChargebackPoRow(chargeback);
    if (poRow) tr.ondblclick = () => openPODetail(poRow);

    const selectTd = document.createElement("td");
    renderChargebackSelectedCell(selectTd, chargeback);
    tr.appendChild(selectTd);

    CHARGEBACK_TABLE_COLUMNS.forEach(col => {
      const td = document.createElement("td");
      td.dataset.col = col;
      const text = formatChargebackTableCell(col, chargeback);
      if (text === EMPTY_DISPLAY) {
        setDisplayText(td, EMPTY_DISPLAY);
      } else {
        mountSearchHighlightedText(td, text, getChargebackTableValue(chargeback, col));
      }
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
  updateChargebackSelectAllHeader();
  updateDeleteChargebackButton();
  updateChargebackRowCounter();
}

function refreshChargebacksView() {
  if (currentAppView === "chargebacks") applyChargebackFilters();
}

function refreshShipmentsView() {
  if (currentAppView === "shipments") applyShipmentFilters();
  updateToolbarRequestButtons();
  refreshChargebacksView();
}

let pendingShipmentOrRequestCreateCount = 0;

function beginToolbarCreatePending() {
  pendingShipmentOrRequestCreateCount++;
  updateToolbarRequestButtons();
}

function endToolbarCreatePending() {
  pendingShipmentOrRequestCreateCount = Math.max(0, pendingShipmentOrRequestCreateCount - 1);
  updateToolbarRequestButtons();
}

function isCreateShipmentModalOpen() {
  return Boolean(document.getElementById("createShipmentOverlay")?.classList.contains("open"));
}

function isCreateRequestModalOpen() {
  if (document.getElementById("exfRequestOverlay")?.classList.contains("open") && !exfRequestModalRow) return true;
  if (document.getElementById("asnRequestOverlay")?.classList.contains("open") && !asnRequestModalRow) return true;
  return false;
}

function isToolbarCreateActionBlocked() {
  return pendingShipmentOrRequestCreateCount > 0 ||
    isCreateShipmentModalOpen() ||
    isCreateRequestModalOpen();
}

function hideToolbarCreateButtons() {
  ["batchEditBtn", "exfRequestBtn", "asnRequestBtn", "createShipmentBtn"].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.hidden = true;
  });
}

function updateCreateShipmentButton() {
  const btn = document.getElementById("createShipmentBtn");
  if (!btn) return;
  const selected = getCheckedFilteredPos();
  const show = currentAppView === "po" &&
    selected.length > 0 &&
    selected.every(isPoEligibleForShipment);
  btn.hidden = !show;
}

function updateToolbarRequestButtons() {
  if (isToolbarCreateActionBlocked()) {
    hideToolbarCreateButtons();
    return;
  }
  if (typeof updateExfRequestButton === "function") updateExfRequestButton();
  if (typeof updateAsnRequestButton === "function") updateAsnRequestButton();
  updateCreateShipmentButton();
  if (typeof updateBatchEditButton === "function") updateBatchEditButton();
}
