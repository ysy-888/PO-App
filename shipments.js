/** Shipment list, modals, and PO ↔ shipment linking. Requires po-table.js loaded first. */

const SHIPMENT_ID_FIELD = "Shipment ID";

const SHIPMENT_TABLE_COLUMNS = [
  "Shipment ID", "Ship Method", "PO Count", "Vessel", "House #", "EXF",
  "Shipped", "ETD", "ETA", "IHD", "Notes"
];

const SHIPMENT_FORM_FIELDS = [
  "Ship Method", "Vessel", "House #", "EXF", "Shipped", "ETD", "ETA", "IHD", "Notes"
];

const SHIPMENT_DATE_FIELDS = new Set(["EXF", "Shipped", "ETD", "ETA", "IHD"]);

const SHIPMENT_MODAL_INFO_FIELDS = ["Ship Method", "Vessel", "House #"];
const SHIPMENT_MODAL_DATE_FIELDS = ["EXF", "Shipped", "ETD", "ETA", "IHD"];

const SHIPMENT_LINKED_PO_COLUMNS = [
  { col: "PO #", label: "PO #", cellClass: "shipment-po-cell-id" },
  { col: "Style #", label: "Style #", cellClass: "shipment-po-cell-wrap" },
  { col: "Vendor", label: "Vendor", cellClass: "shipment-po-cell-vendor" },
  { col: "Buyer", label: "Buyer", cellClass: "shipment-po-cell-buyer" },
  { col: "Buyer PO #", label: "Buyer PO #", cellClass: "shipment-po-cell-buyer-po" },
  { col: "PO Qty", label: "Order Qty", cellClass: "shipment-po-cell-qty" },
  { col: "Actual Qty", label: "Actual Qty", cellClass: "shipment-po-cell-qty" },
  { col: "Ctn Qty", label: "Ctn Qty", cellClass: "shipment-po-cell-qty" },
  { col: "CXL Date", label: "CXL Date", cellClass: "shipment-po-cell-date" },
  { col: "Notes", label: "Notes", cellClass: "shipment-po-cell-notes" },
];

const SHIPMENT_LINKED_PO_COL_CLASSES = [
  "shipment-po-col-select",
  "shipment-po-col-id",
  "shipment-po-col-style",
  "shipment-po-col-vendor",
  "shipment-po-col-buyer",
  "shipment-po-col-buyer-po",
  "shipment-po-col-qty",
  "shipment-po-col-qty",
  "shipment-po-col-qty",
  "shipment-po-col-date",
  "shipment-po-col-notes",
];

/** Linked PO table column widths (px); Notes column is flexible (null). */
const SHIPMENT_LINKED_PO_COLUMN_WIDTHS = [52, 72, 120, 88, 120, 120, 58, 58, 58, 92, null];

/** PO fields cleared when a shipment is deleted (matches apps-script.gs sync fields). */
const SHIPMENT_PO_CLEAR_FIELDS = [
  "Ship Method", "Vessel", "House #", "EXF", "Shipped", "ETD", "ETA", "IHD", "Notes"
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
let currentAppView = "po";

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
}

function getShipmentById(id) {
  const key = String(id ?? "").trim();
  if (!key) return null;
  return allShipments.find(s => String(s[SHIPMENT_ID_FIELD] ?? "").trim() === key) ?? null;
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
  td.className = "readonly readonly-no-select td-shipment-id-cell";
  const id = String(row[SHIPMENT_ID_FIELD] ?? "").trim();
  if (!id) {
    setDisplayText(td, EMPTY_DISPLAY);
    return;
  }
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "shipment-id-link";
  btn.textContent = id;
  btn.title = "Open shipment";
  btn.addEventListener("click", e => {
    e.stopPropagation();
    openShipmentDetail(id);
  });
  td.appendChild(btn);
}

function switchAppView(view) {
  currentAppView = view;
  const poToolbar = document.getElementById("poToolbar");
  const shipmentToolbar = document.getElementById("shipmentToolbar");
  const chargebackToolbar = document.getElementById("chargebackToolbar");
  const poTableWrap = document.getElementById("poTableWrap");
  const shipmentTableWrap = document.getElementById("shipmentTableWrap");
  const chargebackTableWrap = document.getElementById("chargebackTableWrap");
  const poTab = document.getElementById("navTabPo");
  const shipTab = document.getElementById("navTabShipments");
  const chargebackTab = document.getElementById("navTabChargebacks");

  if (poToolbar) poToolbar.hidden = view !== "po";
  if (shipmentToolbar) shipmentToolbar.hidden = view !== "shipments";
  if (chargebackToolbar) chargebackToolbar.hidden = view !== "chargebacks";
  if (poTableWrap) poTableWrap.hidden = view !== "po";
  if (shipmentTableWrap) shipmentTableWrap.hidden = view !== "shipments";
  if (chargebackTableWrap) chargebackTableWrap.hidden = view !== "chargebacks";
  const poFooterEnd = document.getElementById("poFooterEnd");
  if (poFooterEnd) poFooterEnd.hidden = view !== "po";
  if (typeof updateHeaderMenuSelectionModeCheck === "function") {
    updateHeaderMenuSelectionModeCheck();
  }
  poTab?.classList.toggle("is-active", view === "po");
  poTab?.setAttribute("aria-selected", view === "po" ? "true" : "false");
  shipTab?.classList.toggle("is-active", view === "shipments");
  shipTab?.setAttribute("aria-selected", view === "shipments" ? "true" : "false");
  chargebackTab?.classList.toggle("is-active", view === "chargebacks");
  chargebackTab?.setAttribute("aria-selected", view === "chargebacks" ? "true" : "false");

  if (view === "shipments") applyShipmentFilters();
  if (view === "chargebacks") applyChargebackFilters();
  updateDeleteShipmentButton();
  updateDeleteChargebackButton();
}

function applyShipmentFilters() {
  const q = (document.getElementById("shipmentSearchInput")?.value ?? "").toLowerCase();
  filteredShipments = allShipments.filter(shipment => {
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
      const text = formatShipmentCell(col, shipment);
      if (text === EMPTY_DISPLAY) {
        setDisplayText(td, EMPTY_DISPLAY);
      } else {
        td.textContent = text;
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
        td.textContent = text;
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
  updateCreateShipmentButton();
  refreshChargebacksView();
}

function updateCreateShipmentButton() {
  const btn = document.getElementById("createShipmentBtn");
  if (!btn) return;
  const eligible = getUnassignedCheckedFilteredPos();
  const count = eligible.length;
  const show = currentAppView === "po" && count > 0;
  btn.hidden = !show;
}

function bringModalToFront(overlay) {
  document.querySelectorAll(".modal-backdrop.open").forEach(el => {
    el.style.zIndex = "1000";
  });
  if (overlay) {
    overlay.classList.add("open");
    overlay.style.zIndex = "1010";
  }
}

function openShipmentDetail(shipmentOrId) {
  if (isAppSaving()) return;
  const shipment = typeof shipmentOrId === "string"
    ? getShipmentById(shipmentOrId)
    : shipmentOrId;
  if (!shipment) return;

  closeCellSelectDropdown(false);
  shipmentModalRow = shipment;
  renderShipmentModalContent(shipment);
  bringModalToFront(document.getElementById("shipmentModalOverlay"));
}

function closeShipmentModalForce() {
  shipmentModalRow = null;
  const overlay = document.getElementById("shipmentModalOverlay");
  if (overlay) overlay.classList.remove("open");
}

function openLinkedShipmentFromPo(row) {
  const id = String(row[SHIPMENT_ID_FIELD] ?? "").trim();
  if (!id) return;
  openShipmentDetail(id);
}

function openPoFromShipment(poNumber) {
  const row = allRows.find(r => String(r["PO #"]) === String(poNumber));
  if (!row) return;
  openPODetail(row);
  bringModalToFront(document.getElementById("modalOverlay"));
}

function createShipmentFormField(col, value, { readOnly = false } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "shipment-form-field";

  const label = document.createElement("label");
  label.className = "shipment-form-label";
  label.textContent = col;

  let input;
  if (col === "Notes") {
    input = document.createElement("textarea");
    input.rows = 3;
  } else if (SHIPMENT_DATE_FIELDS.has(col)) {
    input = document.createElement("input");
    input.type = "date";
    input.value = normalizeToYmd(value);
  } else if (col === "Ship Method") {
    input = document.createElement("select");
    ["", ...SHIP_OPTIONS].forEach(opt => {
      const o = document.createElement("option");
      o.value = opt;
      o.textContent = opt || EMPTY_DISPLAY;
      if (String(value ?? "") === opt) o.selected = true;
      input.appendChild(o);
    });
  } else {
    input = document.createElement("input");
    input.type = "text";
    input.value = isEmptyValue(value) ? "" : String(value);
  }

  input.className = "shipment-form-input";
  input.dataset.field = col;
  if (readOnly) input.readOnly = true;

  wrap.appendChild(label);
  wrap.appendChild(input);
  return wrap;
}

function buildShipmentFormEdit(shipment, formId) {
  const form = document.createElement("div");
  form.className = "shipment-form-edit";
  form.id = formId;

  const mainGrid = document.createElement("div");
  mainGrid.className = "shipment-form-main-grid";
  SHIPMENT_MODAL_INFO_FIELDS.forEach(col => {
    mainGrid.appendChild(createShipmentFormField(col, shipment[col] ?? ""));
  });
  form.appendChild(mainGrid);

  const dateStack = document.createElement("div");
  dateStack.className = "shipment-form-date-stack";
  SHIPMENT_MODAL_DATE_FIELDS.forEach(col => {
    const field = createShipmentFormField(col, shipment[col] ?? "");
    field.classList.add("shipment-form-field--date");
    dateStack.appendChild(field);
  });
  form.appendChild(dateStack);

  const notesField = createShipmentFormField("Notes", shipment["Notes"] ?? "");
  notesField.classList.add("shipment-form-field--notes");
  form.appendChild(notesField);

  return form;
}

function buildShipmentModalLayout({ shipment = {}, formId, linkedSource }) {
  const layout = document.createElement("div");
  layout.className = "shipment-modal-layout";

  const left = document.createElement("div");
  left.className = "shipment-modal-left";
  left.appendChild(buildShipmentFormEdit(shipment, formId));

  const right = document.createElement("div");
  right.className = "shipment-modal-right";
  right.appendChild(renderShipmentLinkedPoSection(linkedSource));

  layout.appendChild(left);
  layout.appendChild(right);
  return layout;
}

function readShipmentForm(container) {
  const data = {};
  container.querySelectorAll("[data-field]").forEach(el => {
    data[el.dataset.field] = el.value ?? "";
  });
  return data;
}

function renderCreateShipmentModal(poNumbers) {
  createShipmentPoNumbers = poNumbers.slice();
  const body = document.getElementById("createShipmentBody");
  if (!body) return;

  const pos = poNumbers
    .map(po => allRows.find(r => String(r["PO #"]) === String(po)))
    .filter(Boolean);

  body.innerHTML = "";
  body.appendChild(buildShipmentModalLayout({
    shipment: {},
    formId: "createShipmentForm",
    linkedSource: pos,
  }));
  setShipmentModalPoCount(document.getElementById("createShipmentPoCount"), pos);

  bringModalToFront(document.getElementById("createShipmentOverlay"));
}

function closeCreateShipmentModal() {
  createShipmentPoNumbers = [];
  document.getElementById("createShipmentOverlay")?.classList.remove("open");
}

async function submitCreateShipment() {
  const form = document.getElementById("createShipmentForm");
  if (!form || createShipmentPoNumbers.length === 0) return;
  if (isAppSaving()) return;

  const poNumbers = createShipmentPoNumbers.slice();
  const alreadyAssigned = poNumbers.filter(po => {
    const row = allRows.find(r => String(r["PO #"]) === String(po));
    return row && poHasShipment(row);
  });
  if (alreadyAssigned.length > 0) {
    showIndicator(
      `Cannot create: PO ${alreadyAssigned.join(", ")} already on a shipment`,
      "error"
    );
    return;
  }

  const shipment = readShipmentForm(form);
  closeCreateShipmentModal();
  setAppSaving(true, "Creating shipment…");
  showIndicator(`Creating shipment${ELLIPSIS}`, "");

  try {
    if (APPS_SCRIPT_URL === "YOUR_APPS_SCRIPT_WEB_APP_URL_HERE") {
      await demoCreateShipment(poNumbers, shipment);
    } else {
      const json = await postAppsScript({
        action: "createShipment",
        poNumbers,
        shipment,
      });
      if (!json.success) throw new Error(json.error);
      await loadData();
    }
    showIndicator(`Shipment created ${CHECK_MARK}`, "success");
    switchAppView("shipments");
  } catch (err) {
    showIndicator("Create failed: " + err.message, "error");
  } finally {
    setAppSaving(false);
  }
}

function parseShipmentIdSequence(id) {
  const s = String(id ?? "").trim();
  let m = /^SHP-(\d{4})$/.exec(s);
  if (m) return Number(m[1]);
  m = /^SHP(\d{2})-(\d+)$/.exec(s);
  if (m) return Number(m[2]);
  m = /^SHP-(\d{4})-(\d+)$/.exec(s);
  if (m) return Number(m[2]);
  m = /^SHP-(\d+)$/.exec(s);
  if (m) return Number(m[1]);
  return 0;
}

function formatShipmentId(sequence) {
  return `SHP-${String(sequence).padStart(4, "0")}`;
}

function generateDemoShipmentId() {
  let max = 0;
  allShipments.forEach(shipment => {
    max = Math.max(max, parseShipmentIdSequence(shipment[SHIPMENT_ID_FIELD]));
  });
  return formatShipmentId(max + 1);
}

async function demoCreateShipment(poNumbers, shipment) {
  const blocked = poNumbers.filter(po => {
    const row = allRows.find(r => String(r["PO #"]) === String(po));
    return row && poHasShipment(row);
  });
  if (blocked.length > 0) {
    throw new Error(`${blocked.length} PO(s) already assigned to a shipment`);
  }

  const shipmentId = generateDemoShipmentId();
  const record = { [SHIPMENT_ID_FIELD]: shipmentId, ...shipment };
  allShipments.push(record);

  poNumbers.forEach(poNumber => {
    const row = allRows.find(r => String(r["PO #"]) === String(poNumber));
    if (!row) return;
    row[SHIPMENT_ID_FIELD] = shipmentId;
    ["Ship Method", "Vessel", "House #", "EXF", "Shipped", "ETD", "ETA", "IHD"].forEach(field => {
      if (shipment[field] !== undefined) row[field] = shipment[field];
    });
    row["EST IHD"] = calculateEstIhd(row["Ship Method"], row["EST EXF"]);
  });

  resetLocalSelectedState(allRows);
  applyFilters();
  refreshShipmentsView();
}

function formatShipmentLinkedPoCell(col, row) {
  const val = row[col];
  if (col === "CXL Date") {
    if (isEmptyValue(val)) return EMPTY_DISPLAY;
    return formatDateForDisplay(val);
  }
  if (isEmptyValue(val)) return EMPTY_DISPLAY;
  return String(val);
}

function getLinkedPoRows(source) {
  if (Array.isArray(source)) return source;
  return getPosForShipment(source[SHIPMENT_ID_FIELD]);
}

function setShipmentModalPoCount(el, source) {
  if (!el) return;
  const count = getLinkedPoRows(source).length;
  const unit = count === 1 ? "PO" : "POs";
  el.innerHTML =
    `<span class="shipment-modal-po-count-num">${count}</span>` +
    `<span class="shipment-modal-po-count-unit">${unit}</span>`;
}

function getLinkedPosFromModalTable() {
  const tbody = document.querySelector(".shipment-linked-po-table tbody");
  if (!tbody) return [];
  return [...tbody.querySelectorAll("tr[data-po]")]
    .map(tr => findRowByPo(tr.dataset.po))
    .filter(Boolean);
}

function updateShipmentLinkedPoSelectAllHeader(pos) {
  const cb = document.getElementById("shipmentLinkedPoSelectAll");
  if (!cb) return;

  if (pos.length === 0) {
    cb.checked = false;
    cb.indeterminate = false;
    cb.disabled = true;
    return;
  }

  cb.disabled = false;
  const selectedCount = pos.filter(row => isTruthy(row["Selected"])).length;
  cb.checked = selectedCount === pos.length;
  cb.indeterminate = selectedCount > 0 && selectedCount < pos.length;
}

function syncLinkedPoTableCheckboxes(pos) {
  const tbody = document.querySelector(".shipment-linked-po-table tbody");
  if (!tbody) return;
  pos.forEach(row => {
    const po = String(row["PO #"] ?? "");
    const tr = [...tbody.querySelectorAll("tr[data-po]")].find(el => String(el.dataset.po) === po);
    const cb = tr?.querySelector(".po-select-checkbox");
    if (cb) cb.checked = isTruthy(row["Selected"]);
  });
  updateShipmentLinkedPoSelectAllHeader(pos);
}

function setAllLinkedPosSelected(pos, selected) {
  let changed = false;
  pos.forEach(row => {
    if (toggleRowSelected(row, selected)) changed = true;
  });
  if (changed) syncLinkedPoTableCheckboxes(pos);
}

function renderShipmentLinkedPoSection(source) {
  const section = document.createElement("section");
  section.className = "shipment-linked-pos";

  const pos = getLinkedPoRows(source);
  const count = pos.length;

  if (count === 0) {
    const empty = document.createElement("p");
    empty.className = "shipment-linked-empty";
    empty.textContent = "No POs linked to this shipment.";
    section.appendChild(empty);
    return section;
  }

  const wrap = document.createElement("div");
  wrap.className = "shipment-linked-po-table-wrap";

  const table = document.createElement("table");
  table.className = "shipment-linked-po-table";

  const colgroup = document.createElement("colgroup");
  SHIPMENT_LINKED_PO_COL_CLASSES.forEach((className, i) => {
    const col = document.createElement("col");
    col.className = className;
    const width = SHIPMENT_LINKED_PO_COLUMN_WIDTHS[i];
    if (width != null) col.style.width = `${width}px`;
    colgroup.appendChild(col);
  });
  table.appendChild(colgroup);

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");

  const selectTh = document.createElement("th");
  selectTh.className = "th-select-col";
  const selectAllCb = document.createElement("input");
  selectAllCb.type = "checkbox";
  selectAllCb.id = "shipmentLinkedPoSelectAll";
  selectAllCb.setAttribute("aria-label", "Select all linked POs");
  selectAllCb.addEventListener("change", () => {
    setAllLinkedPosSelected(pos, selectAllCb.checked);
  });
  selectTh.appendChild(selectAllCb);
  headRow.appendChild(selectTh);

  SHIPMENT_LINKED_PO_COLUMNS.forEach(({ label, cellClass }) => {
    const th = document.createElement("th");
    th.textContent = label;
    if (cellClass) th.className = cellClass;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  pos.forEach(row => {
    const tr = document.createElement("tr");
    tr.dataset.po = row["PO #"];

    const selectTd = document.createElement("td");
    renderSelectedCell(selectTd, row);
    tr.appendChild(selectTd);

    SHIPMENT_LINKED_PO_COLUMNS.forEach(({ col, cellClass }) => {
      const td = document.createElement("td");
      if (cellClass) td.className = cellClass;
      const text = formatShipmentLinkedPoCell(col, row);
      if (col === "PO #") {
        if (text === EMPTY_DISPLAY) {
          setDisplayText(td, EMPTY_DISPLAY);
        } else {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "shipment-linked-po-link";
          btn.textContent = text;
          btn.title = "Open PO detail";
          btn.addEventListener("click", e => {
            e.stopPropagation();
            openPoFromShipment(row["PO #"]);
          });
          td.appendChild(btn);
        }
      } else if (text === EMPTY_DISPLAY) {
        setDisplayText(td, EMPTY_DISPLAY);
      } else {
        td.textContent = text;
        td.title = text;
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  section.appendChild(wrap);
  updateShipmentLinkedPoSelectAllHeader(pos);
  return section;
}

function renderShipmentModalContent(shipment) {
  const idEl = document.getElementById("shipmentModalId");
  const body = document.getElementById("shipmentModalBody");
  if (!idEl || !body) return;

  idEl.textContent = shipment[SHIPMENT_ID_FIELD] ?? EMPTY_DISPLAY;
  setShipmentModalPoCount(document.getElementById("shipmentModalPoCount"), shipment);
  body.innerHTML = "";
  body.appendChild(buildShipmentModalLayout({
    shipment,
    formId: "shipmentEditForm",
    linkedSource: shipment,
  }));
}

async function saveShipmentModal() {
  if (isAppSaving() || !shipmentModalRow) return;
  const form = document.getElementById("shipmentEditForm");
  if (!form) return;

  const shipmentId = shipmentModalRow[SHIPMENT_ID_FIELD];
  const shipment = readShipmentForm(form);
  const savedRowRef = shipmentModalRow;
  closeShipmentModalForce();
  setAppSaving(true, "Saving…");
  showIndicator(`Saving${ELLIPSIS}`, "");

  try {
    if (APPS_SCRIPT_URL === "YOUR_APPS_SCRIPT_WEB_APP_URL_HERE") {
      Object.assign(savedRowRef, shipment);
      getPosForShipment(shipmentId).forEach(row => {
        ["Ship Method", "Vessel", "House #", "EXF", "Shipped", "ETD", "ETA", "IHD"].forEach(field => {
          if (shipment[field] !== undefined) row[field] = shipment[field];
        });
        row["EST IHD"] = calculateEstIhd(row["Ship Method"], row["EST EXF"]);
      });
      applyFilters();
      refreshShipmentsView();
    } else {
      const json = await postAppsScript({
        action: "updateShipment",
        shipmentId,
        shipment,
      });
      if (!json.success) throw new Error(json.error);
      await loadData();
    }
    showIndicator(`Saved ${CHECK_MARK}`, "success");
  } catch (err) {
    showIndicator("Save failed: " + err.message, "error");
  } finally {
    setAppSaving(false);
  }
}

async function deleteSelectedShipments() {
  if (isAppSaving()) return;
  const selected = getCheckedFilteredShipments();
  if (selected.length === 0) {
    showIndicator("Select shipments first", "error");
    return;
  }

  const count = selected.length;
  const noun = count === 1 ? "this shipment" : `these ${count} shipments`;
  if (!confirm(`Delete ${noun}? Linked PO shipment fields will be cleared.`)) return;

  const shipmentIds = selected.map(s => s[SHIPMENT_ID_FIELD]);
  const openId = shipmentModalRow?.[SHIPMENT_ID_FIELD];
  showIndicator(`Deleting${ELLIPSIS}`, "");

  try {
    if (APPS_SCRIPT_URL === "YOUR_APPS_SCRIPT_WEB_APP_URL_HERE") {
      demoDeleteShipments(shipmentIds);
    } else {
      const json = await postAppsScript({
        action: "deleteShipment",
        shipmentIds,
      });
      if (!json.success) throw new Error(json.error);
      await loadData();
    }

    if (openId && shipmentIds.some(id => String(id) === String(openId))) {
      closeShipmentModalForce();
    }

    showIndicator(`Deleted ${CHECK_MARK}`, "success");
  } catch (err) {
    showIndicator("Delete failed: " + err.message, "error");
  }
}

async function deleteSelectedChargebacks() {
  if (isAppSaving()) return;
  const selected = getCheckedFilteredChargebacks();
  if (selected.length === 0) {
    showIndicator("Select chargebacks first", "error");
    return;
  }

  const count = selected.length;
  const noun = count === 1 ? "this chargeback" : `these ${count} chargebacks`;
  if (!confirm(`Delete ${noun}?`)) return;

  const chargebackIds = selected.map(chargeback => chargeback[CHARGEBACK_ID_FIELD]);
  showIndicator(`Deleting${ELLIPSIS}`, "");

  try {
    if (APPS_SCRIPT_URL === "YOUR_APPS_SCRIPT_WEB_APP_URL_HERE") {
      demoDeleteChargebacks(chargebackIds);
    } else {
      const json = await postAppsScript({
        action: "deleteChargeback",
        chargebackIds,
      });
      if (!json.success) throw new Error(json.error);
      await loadData();
    }

    showIndicator(`Deleted ${CHECK_MARK}`, "success");
  } catch (err) {
    showIndicator("Delete failed: " + err.message, "error");
  }
}

function demoDeleteChargebacks(chargebackIds) {
  const idSet = new Set(chargebackIds.map(id => String(id).trim()));
  allChargebacks = allChargebacks.filter(chargeback => !idSet.has(getChargebackId(chargeback)));
  applyChargebackFilters();
  updateModalIfOpen();
}

function demoDeleteShipments(shipmentIds) {
  const idSet = new Set(shipmentIds.map(id => String(id).trim()));

  idSet.forEach(shipmentId => {
    getPosForShipment(shipmentId).forEach(row => clearPoShipmentData(row));
  });

  allShipments = allShipments.filter(s => !idSet.has(String(s[SHIPMENT_ID_FIELD] ?? "").trim()));
  resetLocalShipmentSelectedState(allShipments);
  applyFilters();
  refreshShipmentsView();
}

function openCreateShipmentFromSelection() {
  if (isAppSaving()) return;
  const selected = getCheckedFilteredPos();
  if (selected.length === 0) {
    showIndicator("Select POs first", "error");
    return;
  }

  const eligible = getUnassignedCheckedFilteredPos();
  const skipped = selected.length - eligible.length;

  if (eligible.length === 0) {
    showIndicator("Selected POs are already on a shipment", "error");
    return;
  }

  if (skipped > 0) {
    showIndicator(
      `${skipped} PO${skipped === 1 ? "" : "s"} skipped (already on a shipment)`,
      ""
    );
  }

  renderCreateShipmentModal(eligible.map(row => row["PO #"]));
}

function renderPoModalLinkedShipment(row) {
  const slot = document.getElementById("modalLinkedShipment");
  if (!slot) return;

  slot.replaceChildren();
  const id = getPoShipmentId(row);
  if (isEmptyValue(id) || !getShipmentById(id)) {
    slot.hidden = true;
    return;
  }

  slot.hidden = false;

  const label = document.createElement("span");
  label.className = "modal-linked-shipment-label";
  label.textContent = "Linked Shipment";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "modal-linked-shipment-header-link";
  btn.textContent = id;
  btn.title = "Open linked shipment";
  btn.addEventListener("click", e => {
    e.stopPropagation();
    openLinkedShipmentFromPo(row);
  });

  slot.appendChild(label);
  slot.appendChild(btn);
}

function initShipmentSelection() {
  const cb = document.getElementById("selectAllShipmentsCheckbox");
  cb?.addEventListener("click", e => {
    e.stopPropagation();
    setAllFilteredShipmentsSelected(cb.checked);
  });

  const chargebackCb = document.getElementById("selectAllChargebacksCheckbox");
  chargebackCb?.addEventListener("click", e => {
    e.stopPropagation();
    setAllFilteredChargebacksSelected(chargebackCb.checked);
  });

  document.getElementById("deleteShipmentBtn")?.addEventListener("click", deleteSelectedShipments);
  document.getElementById("deleteChargebackBtn")?.addEventListener("click", deleteSelectedChargebacks);
}

function initShipments() {
  document.getElementById("navTabPo")?.addEventListener("click", () => switchAppView("po"));
  document.getElementById("navTabShipments")?.addEventListener("click", () => switchAppView("shipments"));
  document.getElementById("navTabChargebacks")?.addEventListener("click", () => switchAppView("chargebacks"));
  document.getElementById("shipmentSearchInput")?.addEventListener("input", applyShipmentFilters);
  document.getElementById("chargebackSearchInput")?.addEventListener("input", applyChargebackFilters);
  document.getElementById("createShipmentBtn")?.addEventListener("click", openCreateShipmentFromSelection);
  document.getElementById("createShipmentSaveBtn")?.addEventListener("click", submitCreateShipment);
  document.getElementById("createShipmentCancelBtn")?.addEventListener("click", closeCreateShipmentModal);
  document.querySelector('[data-dismiss="create-shipment"]')?.addEventListener("click", closeCreateShipmentModal);
  document.getElementById("shipmentModalSaveBtn")?.addEventListener("click", saveShipmentModal);
  document.getElementById("shipmentModalCloseBtn")?.addEventListener("click", closeShipmentModalForce);
  document.querySelector('[data-dismiss="shipment-modal"]')?.addEventListener("click", closeShipmentModalForce);

  document.getElementById("shipmentModalOverlay")?.addEventListener("click", e => {
    if (e.target.id === "shipmentModalOverlay") closeShipmentModalForce();
  });
  document.getElementById("createShipmentOverlay")?.addEventListener("click", e => {
    if (e.target.id === "createShipmentOverlay") closeCreateShipmentModal();
  });

  initShipmentSelection();
  switchAppView("po");
}

// Hook called from po-table.js after load
function onShipmentsDataLoaded(shipments) {
  allShipments = (shipments ?? []).map(normalizeShipment);
  resetLocalShipmentSelectedState(allShipments);
  refreshShipmentsView();
}

// Hook called from po-table.js after renderTable / selection changes
function onPoSelectionChanged() {
  updateCreateShipmentButton();
  const pos = getLinkedPosFromModalTable();
  if (pos.length) updateShipmentLinkedPoSelectAllHeader(pos);
}

initShipments();
if (window.__pendingShipments && typeof onShipmentsDataLoaded === "function") {
  onShipmentsDataLoaded(window.__pendingShipments);
  window.__pendingShipments = null;
}
