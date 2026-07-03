/** EXF Request — batch WIP POs into the EXF Requested queue. */

const EXF_REQUEST_DATE_FIELD = "EXF Request Date";
const EXF_MEMO_FIELD = "EXF Memo";
const EXF_REQUEST_ID_FIELD = "EXF Request ID";
const EXF_REQ_SUBMIT_DATE_FIELD = "exfReqSubmitDate";
const EXF_DATE_FIELD = "EXF Date";
const EXF_REQ_NOTES_FIELD = "ExfReqNotes";
const EXF_REQ_CC_FIELD = "CC";

const EXF_REQUEST_TABLE_COLUMN_LABELS = {
  [EXF_REQ_SUBMIT_DATE_FIELD]: "Request Date",
  [SHIPMENT_ID_FIELD]: "Shipment",
};

function getExfRequestTableColumnLabel(col) {
  return EXF_REQUEST_TABLE_COLUMN_LABELS[col] ?? col;
}

const EXF_REQUEST_TABLE_COLUMNS = [
  EXF_REQUEST_ID_FIELD,
  EXF_DATE_FIELD,
  EXF_REQ_SUBMIT_DATE_FIELD,
  "Vendor",
  "Vendor Email",
  EXF_REQ_CC_FIELD,
  EXF_REQ_NOTES_FIELD,
  "PO Count",
  "Total Qty",
  SHIPMENT_ID_FIELD,
  "Email Status",
  "Email Sent At",
  "Last Email Attempt At",
  "Email Error",
  "Action",
];

const EXF_REQUEST_LINKED_PO_COLUMNS = [
  { col: "PO #", label: "PO #", cellClass: "shipment-po-cell-id" },
  { col: "Style #", label: "Style #", cellClass: "shipment-po-cell-wrap" },
  { col: "Ship Method", label: "Ship Method", cellClass: "shipment-po-cell-wrap", editable: true, editor: "select" },
  { col: "Buyer", label: "Buyer", cellClass: "shipment-po-cell-buyer" },
  { col: "Buyer PO #", label: "Buyer PO #", cellClass: "shipment-po-cell-buyer-po" },
  { col: "PO Qty", label: "Order Qty", cellClass: "shipment-po-cell-qty" },
  { col: "Actual Qty", label: "Actual Qty", cellClass: "shipment-po-cell-qty" },
  { col: "CXL Date", label: "CXL Date", cellClass: "shipment-po-cell-date" },
  { col: EXF_MEMO_FIELD, label: "EXF Memo", cellClass: "shipment-po-cell-notes", editable: true, editor: "text" },
];

const EXF_REQUEST_LINKED_PO_COL_CLASSES = [
  "shipment-po-col-select",
  "exf-request-po-col-id",
  "exf-request-po-col-style",
  "exf-request-po-col-ship-method",
  "exf-request-po-col-buyer",
  "exf-request-po-col-buyer-po",
  "exf-request-po-col-qty",
  "exf-request-po-col-qty",
  "exf-request-po-col-date",
  "shipment-po-col-notes",
];

const EXF_REQUEST_LINKED_PO_COLUMN_WIDTHS = [52, 64, 110, 102, 160, 112, 54, 54, 88, 120];

let exfRequestPoNumbers = [];
let exfRequestAddPoPanelOpen = false;
const exfRequestAvailablePoSelection = createAvailablePoPickerSelection();
let exfRequestDraftByPo = {};
let exfRequestDraftEmail = {};
let exfRequestDraftExfDate = "";
let exfRequestDraftNotes = "";
let exfRequestVendor = "";
let exfRequestModalRow = null;
let allExfRequests = [];
let exfRequestOpInProgress = false;
let filteredExfRequests = [];

function normalizeExfRequestRecord(row) {
  const out = { ...row };
  if (!out[EXF_DATE_FIELD] && out["Request Date"]) out[EXF_DATE_FIELD] = out["Request Date"];
  if (!out[EXF_REQ_SUBMIT_DATE_FIELD]) {
    out[EXF_REQ_SUBMIT_DATE_FIELD] = out["Created At"] ?? out["Request Date"] ?? "";
  }
  if (!out[EXF_REQ_CC_FIELD] && out["Vendor CC"]) out[EXF_REQ_CC_FIELD] = out["Vendor CC"];
  return out;
}

function onExfRequestsDataLoaded(requests) {
  allExfRequests = (requests ?? []).map(normalizeExfRequestRecord);
  if (typeof allRows !== "undefined") syncExfRequestIdsFromRequests(allRows, allExfRequests);
  applyExfRequestFilters();
}

function syncExfRequestIdsFromRequests(rows, requests) {
  if (!Array.isArray(rows) || !Array.isArray(requests)) return;
  const poToRequestId = new Map();
  requests.forEach(request => {
    const id = getExfRequestRecordId(request);
    if (!id) return;
    parseRequestPoNumbers(request).forEach(po => poToRequestId.set(String(po), id));
  });
  rows.forEach(row => {
    if (String(row[EXF_REQUEST_ID_FIELD] ?? "").trim()) return;
    const id = poToRequestId.get(String(row["PO #"] ?? ""));
    if (id) row[EXF_REQUEST_ID_FIELD] = id;
  });
}

function getShipmentIdsForExfRequest(request) {
  const exfRequestId = getExfRequestRecordId(request);
  if (!exfRequestId) return [];
  const ids = new Set();
  if (typeof allShipments !== "undefined") {
    allShipments.forEach(shipment => {
      const linkedExf = String(shipment[SHIPMENT_EXF_REQUEST_ID_FIELD] ?? "").trim();
      const shipmentId = String(shipment[SHIPMENT_ID_FIELD] ?? "").trim();
      if (linkedExf === exfRequestId && shipmentId) ids.add(shipmentId);
    });
  }
  getRequestPoNumbers(request, EXF_REQUEST_ID_FIELD).forEach(po => {
    const row = allRows.find(r => String(r["PO #"]) === String(po));
    const shipmentId = String(row?.[SHIPMENT_ID_FIELD] ?? "").trim();
    if (shipmentId) ids.add(shipmentId);
  });
  return [...ids].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function getExfRequestSearchText(request) {
  return EXF_REQUEST_TABLE_COLUMNS
    .filter(col => col !== "Action")
    .map(col => {
      if (col === SHIPMENT_ID_FIELD) return getShipmentIdsForExfRequest(request).join(" ");
      return String(request[col] ?? "");
    })
    .join(" ")
    .toLowerCase();
}

function renderExfRequestShipmentCell(td, request) {
  td.className = "readonly readonly-no-select td-shipment-id-cell";
  const ids = getShipmentIdsForExfRequest(request);
  if (ids.length === 0) {
    setDisplayText(td, EMPTY_DISPLAY);
    return;
  }
  ids.forEach((id, index) => {
    if (index > 0) td.appendChild(document.createTextNode(", "));
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "shipment-id-link";
    btn.textContent = id;
    btn.title = `Open shipment ${id}`;
    btn.addEventListener("click", e => {
      e.stopPropagation();
      openShipmentDetail(id);
    });
    td.appendChild(btn);
  });
}

function renderExfRequestIdCell(td, row) {
  td.className = "readonly readonly-no-select td-shipment-id-cell";
  const id = String(row[EXF_REQUEST_ID_FIELD] ?? "").trim();
  if (!id) { setDisplayText(td, EMPTY_DISPLAY); return; }
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "shipment-id-link";
  btn.textContent = id;
  btn.title = "Open EXF request";
  btn.addEventListener("click", e => {
    e.stopPropagation();
    openExfRequestDetail(id);
  });
  td.appendChild(btn);
}

function getExfRequestRecordId(request) {
  return String(request?.[EXF_REQUEST_ID_FIELD] ?? "").trim();
}

function getExfRequestById(id) {
  const key = String(id ?? "").trim();
  if (!key) return null;
  return allExfRequests.find(request => getExfRequestRecordId(request) === key) ?? null;
}

function openExfRequestDetail(id) {
  if (isAppSaving()) return;
  const request = getExfRequestById(id);
  if (!request) return;
  exfRequestModalRow = request;
  exfRequestPoNumbers = getRequestPoNumbers(request, EXF_REQUEST_ID_FIELD);
  exfRequestVendor = request["Vendor"] ?? "";
  exfRequestDraftEmail = {
    email: request["Vendor Email"] ?? "",
    cc: request[EXF_REQ_CC_FIELD] ?? "",
  };
  exfRequestDraftExfDate = request[EXF_DATE_FIELD] ?? "";
  exfRequestDraftNotes = request[EXF_REQ_NOTES_FIELD] ?? "";
  exfRequestDraftByPo = {};
  exfRequestPoNumbers.forEach(po => {
    const row = allRows.find(r => String(r["PO #"]) === String(po));
    if (!row) return;
    exfRequestDraftByPo[String(po)] = {
      memo: row[EXF_MEMO_FIELD] ?? "",
      shipMethod: row["Ship Method"] ?? "",
    };
  });
  exfRequestAddPoPanelOpen = false;
  setExfRequestFooterMessage("");
  clearExfFormSelection();
  renderExfRequestModal(exfRequestPoNumbers, { request });
}

function applyExfRequestFilters() {
  const q = (document.getElementById("exfRequestSearchInput")?.value ?? "").toLowerCase();
  filteredExfRequests = allExfRequests.filter(request => {
    if (!q) return true;
    return getExfRequestSearchText(request).includes(q);
  });
  filteredExfRequests.sort((a, b) => {
    const dateCompare = normalizeToYmd(b[EXF_REQ_SUBMIT_DATE_FIELD] || b["Created At"])
      .localeCompare(normalizeToYmd(a[EXF_REQ_SUBMIT_DATE_FIELD] || a["Created At"]));
    if (dateCompare !== 0) return dateCompare;
    return getExfRequestRecordId(b).localeCompare(getExfRequestRecordId(a), undefined, { numeric: true });
  });
  renderExfRequestTable();
  updateExfRequestRowCounter();
}

function updateExfRequestRowCounter() {
  if (typeof updateRequestsRowCounter === "function") updateRequestsRowCounter();
}

function formatExfRequestTableCell(col, request) {
  if (col === SHIPMENT_ID_FIELD) {
    const ids = getShipmentIdsForExfRequest(request);
    return ids.length > 0 ? ids.join(", ") : EMPTY_DISPLAY;
  }
  const val = request[col] ?? "";
  if ([EXF_DATE_FIELD, EXF_REQ_SUBMIT_DATE_FIELD, "Email Sent At", "Last Email Attempt At", "Created At", "Updated At"].includes(col)) {
    return formatDateForDisplay(val);
  }
  if (isEmptyValue(val)) return EMPTY_DISPLAY;
  return String(val);
}

function renderExfRequestEmailStatusCell(td, request) {
  const status = String(request["Email Status"] ?? "").trim();
  td.className = "readonly readonly-no-select exf-request-email-status-cell";
  td.dataset.status = status.toLowerCase();
  if (isEmptyValue(status)) setDisplayText(td, EMPTY_DISPLAY);
  else td.textContent = status;
}

function renderExfRequestActionCell(td, request) {
  const requestId = getExfRequestRecordId(request);
  td.className = "readonly readonly-no-select exf-request-action-cell";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-secondary exf-request-resend-btn";
  btn.textContent = "Resend";
  btn.disabled = !requestId || isAppSaving();
  btn.addEventListener("click", e => {
    e.stopPropagation();
    resendExfRequestEmail(requestId);
  });
  td.appendChild(btn);
}

function renderExfRequestTable() {
  const tbody = document.getElementById("exfRequestTableBody");
  if (!tbody) return;

  if (filteredExfRequests.length === 0) {
    tbody.innerHTML = `<tr class="state-row"><td colspan="${EXF_REQUEST_TABLE_COLUMNS.length}">No EXF requests yet.</td></tr>`;
    updateExfRequestRowCounter();
    return;
  }

  tbody.innerHTML = "";
  filteredExfRequests.forEach(request => {
    const tr = document.createElement("tr");
    tr.dataset.exfRequestId = getExfRequestRecordId(request);

    EXF_REQUEST_TABLE_COLUMNS.forEach(col => {
      const td = document.createElement("td");
      td.dataset.col = col;
      if (col === "Action") {
        renderExfRequestActionCell(td, request);
      } else if (col === SHIPMENT_ID_FIELD) {
        renderExfRequestShipmentCell(td, request);
      } else if (col === "Email Status") {
        renderExfRequestEmailStatusCell(td, request);
      } else {
        const text = formatExfRequestTableCell(col, request);
        if (text === EMPTY_DISPLAY) setDisplayText(td, EMPTY_DISPLAY);
        else {
          td.textContent = text;
          td.title = text;
        }
      }
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
    attachRequestTableRowDblClick(tr, () => openExfRequestDetail(getExfRequestRecordId(request)));
  });
  updateExfRequestRowCounter();
}

async function resendExfRequestEmail(requestId) {
  if (exfRequestOpInProgress || !requestId) return;
  exfRequestOpInProgress = true;
  showIndicator(`Resending EXF email${ELLIPSIS}`, "");
  try {
    const json = await postApi("/api/requests/exf/resend-email", { exfRequestId: requestId });
    if (!json.success) throw new Error(json.error);
    const request = allExfRequests.find(r => getExfRequestRecordId(r) === requestId);
    if (request) {
      request["Email Status"] = json.emailSent ? "Sent" : "Failed";
      request["Email Error"] = json.emailError ?? "";
      if (json.emailSent) request["Email Sent At"] = formatDateToYmd(new Date());
      request["Last Email Attempt At"] = formatDateToYmd(new Date());
      applyExfRequestFilters();
    }
    if (!json.emailSent) {
      showIndicator(`EXF email not sent: ${json.emailError || "Missing vendor email"}`, "error");
      return;
    }
    showIndicator(`EXF email sent ${CHECK_MARK}`, "success");
  } catch (err) {
    showIndicator("Resend failed: " + err.message, "error");
  } finally {
    exfRequestOpInProgress = false;
  }
}

function normalizeExfRequestVendor(rowOrValue) {
  const value = rowOrValue && typeof rowOrValue === "object" ? rowOrValue["Vendor"] : rowOrValue;
  return String(value ?? "").trim();
}

function getExfRequestVendorEmailInfo(vendor) {
  const vendorKey = normalizeExfRequestVendor(vendor).toLowerCase();
  const getValue = (row, fields) => {
    const key = Object.keys(row ?? {}).find(field =>
      fields.some(candidate => field.trim().toLowerCase() === candidate.toLowerCase())
    );
    return key ? String(row[key] ?? "").trim() : "";
  };
  const findLastMatching = (rows, predicate) => {
    for (let i = rows.length - 1; i >= 0; i--) {
      if (predicate(rows[i])) return rows[i];
    }
    return null;
  };
  const vendorRows = allVendorEmailRows ?? [];
  const row = findLastMatching(vendorRows, item =>
    normalizeExfRequestVendor(getValue(item, ["Vendor", "Vendor Name", "Name"])).toLowerCase() === vendorKey
  );
  const previousRequest = findLastMatching(allExfRequests, request =>
    normalizeExfRequestVendor(request).toLowerCase() === vendorKey &&
    !isEmptyValue(request["Vendor Email"])
  );
  return {
    email: getValue(row, ["Email", "Vendor Email", "Email Address", "E-mail", "To"]) ||
      String(previousRequest?.["Vendor Email"] ?? "").trim(),
    cc: getValue(row, ["CC", "Vendor CC", "Cc"]),
  };
}

function getExfRequestVendorForRows(rows) {
  if (rows.length === 0) return "";
  const firstVendor = normalizeExfRequestVendor(rows[0]);
  return rows.every(row => normalizeExfRequestVendor(row) === firstVendor) ? firstVendor : "";
}

function rowsHaveSingleExfRequestVendor(rows) {
  return rows.length > 0 && getExfRequestVendorForRows(rows) !== "";
}

function updateExfRequestButton() {
  const btn = document.getElementById("exfRequestBtn");
  if (!btn) return;
  const checked = getCheckedFilteredPos();
  btn.hidden = currentAppView !== "po" ||
    checked.length === 0 ||
    !checked.every(isPoEligibleForExfRequest) ||
    !rowsHaveSingleExfRequestVendor(checked);
}

function setExfRequestFooterMessage(message = "") {
  const overlay = document.getElementById("exfRequestOverlay");
  if (!overlay) return;
  clearModalFooterMessageForOverlay(overlay);
  if (message) {
    setModalFooterMessage(message, "error", { persist: true, overlay });
  }
}

function openExfRequestFromSelection() {
  if (isAppSaving() || isToolbarCreateActionBlocked()) return;
  const checked = getCheckedFilteredPos();
  if (checked.length === 0 || !checked.every(isPoEligibleForExfRequest)) {
    showIndicator("Select WIP POs that are not already EXF requested", "error");
    return;
  }
  if (!rowsHaveSingleExfRequestVendor(checked)) {
    showIndicator("Select POs from one vendor only", "error");
    return;
  }
  exfRequestPoNumbers = checked.map(row => row["PO #"]);
  exfRequestModalRow = null;
  exfRequestVendor = getExfRequestVendorForRows(checked);
  exfRequestDraftByPo = {};
  exfRequestDraftEmail = {};
  exfRequestDraftExfDate = "";
  exfRequestDraftNotes = "";
  setExfRequestFooterMessage("");
  clearMainTableSelection();
  clearExfFormSelection();
  renderExfRequestModal(exfRequestPoNumbers);
}

function getExfRequestRows(poNumbers = exfRequestPoNumbers) {
  return poNumbers
    .map(po => allRows.find(r => String(r["PO #"]) === String(po)))
    .filter(Boolean);
}

function getExfRequestExfDateValue() {
  const form = document.getElementById("exfRequestForm");
  return form ? readRequestForm(form)[EXF_DATE_FIELD] : formatDateToYmd(new Date());
}

function captureExfRequestDraft() {
  const body = document.getElementById("exfRequestBody");
  if (!body) return;
  const form = document.getElementById("exfRequestForm");
  const formData = form ? readRequestForm(form) : {};
  exfRequestDraftEmail = {
    email: formData["Vendor Email"] ?? exfRequestDraftEmail.email ?? "",
    cc: formData[EXF_REQ_CC_FIELD] ?? exfRequestDraftEmail.cc ?? "",
  };
  exfRequestDraftExfDate = formData[EXF_DATE_FIELD] ?? exfRequestDraftExfDate ?? "";
  exfRequestDraftNotes = formData[EXF_REQ_NOTES_FIELD] ?? exfRequestDraftNotes ?? "";
  const memos = readRequestLinkedPoFields(body, EXF_MEMO_FIELD);
  const shipMethods = readRequestLinkedPoFields(body, "Ship Method");
  exfRequestPoNumbers.forEach(po => {
    const key = String(po);
    exfRequestDraftByPo[key] = {
      memo: memos[key] ?? exfRequestDraftByPo[key]?.memo ?? "",
      shipMethod: shipMethods[key] ?? exfRequestDraftByPo[key]?.shipMethod ?? "",
    };
  });
}

function applyExfRequestDraft(row) {
  const key = String(row["PO #"] ?? "");
  const draft = exfRequestDraftByPo[key];
  if (!draft) return row;
  return {
    ...row,
    "Ship Method": draft.shipMethod,
    [EXF_MEMO_FIELD]: draft.memo,
  };
}

function setExfRequestModalAddPanelClass(body, isOpen) {
  body?.closest(".shipment-modal-card")?.classList.toggle("shipment-modal-card--add-panel-open", isOpen);
}

function getExfRequestModalRenderOptions(extra = {}) {
  return {
    exfDate: getExfRequestExfDateValue(),
    request: exfRequestModalRow,
    ...extra,
  };
}

function renderExfRequestModal(poNumbers, { exfDate = formatDateToYmd(new Date()), request = null } = {}) {
  const body = document.getElementById("exfRequestBody");
  if (!body) return;

  const activeRequest = request ?? exfRequestModalRow;
  const isExisting = Boolean(activeRequest?.[EXF_REQUEST_ID_FIELD]);
  const isView = isExisting && isRequestEmailSent(activeRequest);
  const submitBtn = document.getElementById("exfRequestSubmitBtn");
  const submitDate = formatDateToYmd(new Date());
  setEmailStyleModalHeader(document.querySelector("#exfRequestOverlay .modal-header"), {
    typeLabel: "EXF Request",
    recordId: isExisting ? activeRequest[EXF_REQUEST_ID_FIELD] : "New",
    requestDate: isExisting
      ? (activeRequest[EXF_REQ_SUBMIT_DATE_FIELD] ?? submitDate)
      : submitDate,
  });
  if (submitBtn) submitBtn.hidden = isView;
  const createShipmentBtn = document.getElementById("exfRequestCreateShipmentBtn");
  if (createShipmentBtn) createShipmentBtn.hidden = !isExisting;

  exfRequestPoNumbers = poNumbers.slice();
  const originalPos = getExfRequestRows();
  pruneExfFormSelection(originalPos);
  const pos = originalPos.map(applyExfRequestDraft);
  const vendor = exfRequestVendor || getExfRequestVendorForRows(originalPos) || activeRequest?.["Vendor"] || "";

  body.innerHTML = "";
  body.appendChild(buildExfRequestModalLayout({
    exfDate: isExisting ? (activeRequest[EXF_DATE_FIELD] ?? "") : (exfRequestDraftExfDate || exfDate),
    vendor,
    linkedPos: pos,
    showAddPanel: !isView && exfRequestAddPoPanelOpen,
    isView,
    request: activeRequest,
  }));
  setExfRequestModalAddPanelClass(body, exfRequestAddPoPanelOpen);
  const headerCount = document.getElementById("exfRequestPoCount");
  if (headerCount) headerCount.textContent = "";
  bringModalToFront(document.getElementById("exfRequestOverlay"));
  updateExfRequestModalActionButtons();
  updateToolbarRequestButtons();
}

function closeExfRequestModal() {
  exfRequestPoNumbers = [];
  exfRequestAddPoPanelOpen = false;
  exfRequestDraftByPo = {};
  exfRequestDraftEmail = {};
  exfRequestDraftExfDate = "";
  exfRequestDraftNotes = "";
  exfRequestVendor = "";
  exfRequestModalRow = null;
  clearExfFormSelection();
  setExfRequestFooterMessage("");
  document.getElementById("exfRequestOverlay")?.classList.remove("open");
  setExfRequestModalAddPanelClass(document.getElementById("exfRequestBody"), false);
  updateToolbarRequestButtons();
}

function buildExfRequestModalLayout({ exfDate, vendor, linkedPos, showAddPanel = false, isView = false, request = null } = {}) {
  const outer = document.createElement("div");
  outer.className = "shipment-modal-outer";

  const vendorEmailInfo = getExfRequestVendorEmailInfo(vendor);
  const submitDate = formatDateToYmd(new Date());
  const metaRows = [
    createRequestFormMetaRow(
      "EXF Date",
      EXF_DATE_FIELD,
      isView ? (request?.[EXF_DATE_FIELD] ?? "") : (exfRequestDraftExfDate || exfDate),
      { type: "date", readOnly: isView }
    ).tr,
    createRequestFormMetaRow(
      "Request Date",
      EXF_REQ_SUBMIT_DATE_FIELD,
      isView ? (request?.[EXF_REQ_SUBMIT_DATE_FIELD] ?? submitDate) : submitDate,
      { type: "date", readOnly: true }
    ).tr,
    createRequestFormMetaRow("Vendor", "Vendor", vendor, { readOnly: true }).tr,
    createRequestFormMetaRow(
      "Vendor Email",
      "Vendor Email",
      isView ? (request?.["Vendor Email"] ?? "") : (exfRequestDraftEmail.email ?? vendorEmailInfo.email),
      { readOnly: isView }
    ).tr,
    createRequestFormMetaRow(
      "CC",
      EXF_REQ_CC_FIELD,
      isView ? (request?.[EXF_REQ_CC_FIELD] ?? "") : (exfRequestDraftEmail.cc ?? vendorEmailInfo.cc),
      { readOnly: isView }
    ).tr,
  ];
  const layout = buildShipmentModalSplitLayout(
    buildEmailStyleForm({
      formId: "exfRequestForm",
      metaRows,
      totalsRows: createRequestFormTotalsMetaRows(linkedPos),
      separateTotals: true,
      notesField: EXF_REQ_NOTES_FIELD,
      notesValue: isView ? (request?.[EXF_REQ_NOTES_FIELD] ?? "") : exfRequestDraftNotes,
      notesReadOnly: isView,
      requestForm: true,
    }),
    renderExfRequestLinkedPoSection(linkedPos, isView)
  );
  outer.appendChild(layout);

  if (showAddPanel) {
    appendAvailablePoPanelToModalRight(outer, renderAvailablePoLinkedSection(getAvailableExfRequestPanelRows(), {
      sectionId: "exfRequestAddPoPanel",
      tableClass: "exf-request-linked-po-table",
      columns: EXF_REQUEST_LINKED_PO_COLUMNS,
      colClasses: EXF_REQUEST_LINKED_PO_COL_CLASSES,
      columnWidths: EXF_REQUEST_LINKED_PO_COLUMN_WIDTHS,
      emptyMessage: "No WIP POs available.",
      selection: exfRequestAvailablePoSelection,
      onSelectionChange: updateExfRequestModalActionButtons,
      selectAllId: "exfRequestAvailablePoSelectAll",
      qtyCol: "Actual Qty",
      showTableFooter: false,
    }));
  }

  return outer;
}

function getExfRequestActiveVendor() {
  const form = document.getElementById("exfRequestForm");
  const fromForm = form ? readRequestForm(form)["Vendor"] : "";
  return normalizeExfRequestVendor(
    exfRequestVendor || fromForm || getExfRequestVendorForRows(getExfRequestRows())
  );
}

function getAvailableExfRequestPanelRows() {
  const linkedPoNumbers = new Set(exfRequestPoNumbers.map(String));
  const vendor = getExfRequestActiveVendor();
  if (!vendor) return [];

  const vendorKey = vendor.toLowerCase();
  return allRows.filter(row =>
    isPoEligibleForExfRequest(row) &&
    normalizeExfRequestVendor(row).toLowerCase() === vendorKey &&
    !linkedPoNumbers.has(String(row["PO #"] ?? ""))
  );
}

function openExfRequestAddPoPanel() {
  captureExfRequestDraft();
  clearExfFormSelection();
  exfRequestAvailablePoSelection.clear();
  exfRequestAddPoPanelOpen = true;
  renderExfRequestModal(exfRequestPoNumbers, getExfRequestModalRenderOptions());
}

function closeExfRequestAddPoPanel() {
  captureExfRequestDraft();
  exfRequestAvailablePoSelection.clear();
  exfRequestAddPoPanelOpen = false;
  renderExfRequestModal(exfRequestPoNumbers, getExfRequestModalRenderOptions());
}

function addSelectedPosToExfRequest() {
  const selected = exfRequestAvailablePoSelection.getAll();
  if (selected.length === 0) return;
  captureExfRequestDraft();
  const linkedVendor = exfRequestVendor || getExfRequestVendorForRows(getExfRequestRows());
  const toAdd = [];
  for (const po of selected) {
    const row = allRows.find(r => String(r["PO #"]) === po);
    if (!row) continue;
    if (linkedVendor && normalizeExfRequestVendor(row) !== linkedVendor) {
      showIndicator("Only same-vendor POs can be added", "error");
      return;
    }
    if (!exfRequestVendor) exfRequestVendor = normalizeExfRequestVendor(row);
    if (!exfRequestPoNumbers.map(String).includes(po)) toAdd.push(po);
  }
  if (toAdd.length === 0) return;
  exfRequestAvailablePoSelection.clear();
  exfRequestPoNumbers = [...exfRequestPoNumbers, ...toAdd];
  exfRequestAddPoPanelOpen = true;
  renderExfRequestModal(exfRequestPoNumbers, getExfRequestModalRenderOptions());
}

function addWipPoToExfRequest(poNumber) {
  captureExfRequestDraft();
  const po = String(poNumber ?? "").trim();
  if (!po) return;
  const row = allRows.find(r => String(r["PO #"]) === po);
  const linkedVendor = exfRequestVendor || getExfRequestVendorForRows(getExfRequestRows());
  if (linkedVendor && normalizeExfRequestVendor(row) !== linkedVendor) {
    showIndicator("Only same-vendor POs can be added", "error");
    return;
  }
  if (!exfRequestVendor) exfRequestVendor = normalizeExfRequestVendor(row);
  if (!exfRequestPoNumbers.map(String).includes(po)) {
    exfRequestPoNumbers = [...exfRequestPoNumbers, po];
  }
  exfRequestAddPoPanelOpen = true;
  renderExfRequestModal(exfRequestPoNumbers, getExfRequestModalRenderOptions());
}

function removePosFromExfRequest() {
  captureExfRequestDraft();
  const linked = getExfRequestRows().filter(isExfRequestRowSelected);
  if (linked.length === 0) {
    showIndicator("Select POs to remove", "error");
    return;
  }
  const removeSet = new Set(linked.map(row => String(row["PO #"])));
  linked.forEach(row => toggleExfFormPoSelected(row, false));
  exfRequestPoNumbers = exfRequestPoNumbers.filter(po => !removeSet.has(String(po)));
  removeSet.forEach(po => { delete exfRequestDraftByPo[po]; });
  renderExfRequestModal(exfRequestPoNumbers, getExfRequestModalRenderOptions());
}

function updateExfRequestModalActionButtons() {
  const addBtn = document.getElementById("exfRequestAddPosBtn");
  const removeBtn = document.getElementById("exfRequestRemovePosBtn");
  const doneBtn = document.getElementById("exfRequestAddPoDoneBtn");
  const addSelectedBtn = document.getElementById("exfRequestAddSelectedPosBtn");
  const submitBtn = document.getElementById("exfRequestSubmitBtn");

  const isView = submitBtn?.hidden === true;
  if (isView) {
    if (addBtn) addBtn.hidden = true;
    if (removeBtn) removeBtn.hidden = true;
    if (doneBtn) doneBtn.hidden = true;
    if (addSelectedBtn) addSelectedBtn.hidden = true;
    return;
  }

  if (exfRequestAddPoPanelOpen) {
    if (addBtn) addBtn.hidden = true;
    if (removeBtn) removeBtn.hidden = true;
    if (doneBtn) doneBtn.hidden = false;
    if (addSelectedBtn) addSelectedBtn.hidden = exfRequestAvailablePoSelection.size === 0;
    return;
  }

  if (doneBtn) doneBtn.hidden = true;
  if (addSelectedBtn) addSelectedBtn.hidden = true;

  const linkedSelected = getExfRequestRows().filter(isExfRequestRowSelected).length;
  const hasAvailablePos = getAvailableExfRequestPanelRows().length > 0;
  if (addBtn) addBtn.hidden = linkedSelected > 0 || !hasAvailablePos;
  if (removeBtn) removeBtn.hidden = linkedSelected === 0;
}

function applyExfRequestShipMethodToAll(shipMethod) {
  if (isEmptyValue(shipMethod)) return;
  document
    .querySelectorAll("#exfRequestOverlay .exf-request-linked-po-table tbody [data-field=\"Ship Method\"]")
    .forEach(input => {
      input.value = shipMethod;
      input.classList.remove("request-linked-po-input--error");
      input.removeAttribute("aria-invalid");
    });
  exfRequestPoNumbers.forEach(po => {
    const key = String(po);
    exfRequestDraftByPo[key] = {
      memo: exfRequestDraftByPo[key]?.memo ?? "",
      shipMethod,
    };
  });
  setExfRequestFooterMessage("");
}

function renderExfRequestSetAllShipMethodControl() {
  const wrap = document.createElement("div");
  wrap.className = "exf-request-set-all-ship-method";

  const label = document.createElement("label");
  label.className = "exf-request-set-all-ship-method-label";
  label.textContent = "Set All Ship Methods";
  label.htmlFor = "exfRequestSetAllShipMethod";

  const select = document.createElement("select");
  select.id = "exfRequestSetAllShipMethod";
  select.className = "shipment-form-input exf-request-set-all-ship-method-select";
  select.disabled = exfRequestAddPoPanelOpen;
  select.setAttribute("aria-label", "Set ship method for all POs");

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "— Select —";
  select.appendChild(placeholder);
  SHIP_OPTIONS.forEach(opt => {
    const option = document.createElement("option");
    option.value = opt;
    option.textContent = opt;
    select.appendChild(option);
  });

  select.addEventListener("change", () => {
    const value = select.value;
    if (isEmptyValue(value)) return;
    applyExfRequestShipMethodToAll(value);
    select.value = "";
  });

  wrap.appendChild(label);
  wrap.appendChild(select);
  return wrap;
}

function renderExfRequestLinkedPoFooter(pos) {
  if (!pos.length) return null;

  const footer = document.createElement("footer");
  footer.className = "shipment-linked-po-footer";

  const actions = document.createElement("div");
  actions.className = "shipment-linked-po-footer-actions";
  actions.appendChild(renderExfRequestSetAllShipMethodControl());
  footer.appendChild(actions);

  return footer;
}

function updateExfRequestLinkedPoSelectAllHeader(pos) {
  const cb = document.querySelector("#exfRequestOverlay .exf-request-linked-po-table #exfRequestLinkedPoSelectAll");
  if (!cb) return;
  if (pos.length === 0) {
    cb.checked = false;
    cb.indeterminate = false;
    cb.disabled = true;
    return;
  }

  cb.disabled = exfRequestAddPoPanelOpen;
  const selectedCount = pos.filter(isExfRequestRowSelected).length;
  cb.checked = selectedCount === pos.length;
  cb.indeterminate = selectedCount > 0 && selectedCount < pos.length;
}

function getOriginalExfRequestRow(row) {
  return allRows.find(r => String(r["PO #"]) === String(row["PO #"])) ?? row;
}

function isExfRequestRowSelected(row) {
  return isExfFormPoSelected(row);
}

function syncExfRequestLinkedPoTableCheckboxes(pos) {
  const tbody = document.querySelector("#exfRequestOverlay .exf-request-linked-po-table tbody");
  if (!tbody) return;
  pos.forEach(row => {
    const po = String(row["PO #"] ?? "");
    const tr = [...tbody.querySelectorAll("tr[data-po]")].find(el => String(el.dataset.po) === po);
    const cb = tr?.querySelector(".po-select-checkbox");
    if (cb) cb.checked = isExfRequestRowSelected(row);
  });
  updateExfRequestLinkedPoSelectAllHeader(pos);
}

function setAllExfRequestLinkedPosSelected(pos, selected) {
  if (exfRequestAddPoPanelOpen) return;
  pos.forEach(row => {
    toggleExfFormPoSelected(row, selected);
  });
  syncExfRequestLinkedPoTableCheckboxes(pos);
  onFormPoSelectionChanged();
}

function renderExfRequestLinkedPoSection(pos, isView = false) {
  const section = document.createElement("section");
  section.className = "shipment-linked-pos";
  section.classList.toggle("shipment-linked-pos--selection-disabled", exfRequestAddPoPanelOpen || isView);

  const wrap = document.createElement("div");
  wrap.className = "email-po-table-wrap";

  const table = document.createElement("table");
  table.className = "email-po-table shipment-linked-po-table request-linked-po-table exf-request-linked-po-table";

  const colgroup = document.createElement("colgroup");
  EXF_REQUEST_LINKED_PO_COL_CLASSES.forEach((className, i) => {
    const col = document.createElement("col");
    col.className = className;
    const width = EXF_REQUEST_LINKED_PO_COLUMN_WIDTHS[i];
    if (width != null) col.style.width = `${width}px`;
    colgroup.appendChild(col);
  });
  table.appendChild(colgroup);

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const selectTh = document.createElement("th");
  selectTh.className = "th-select-col";
  if (!isView) {
    const selectAllCb = document.createElement("input");
    selectAllCb.type = "checkbox";
    selectAllCb.id = "exfRequestLinkedPoSelectAll";
    selectAllCb.disabled = exfRequestAddPoPanelOpen;
    selectAllCb.setAttribute("aria-label", "Select all EXF request POs");
    selectAllCb.addEventListener("change", () => {
      setAllExfRequestLinkedPosSelected(pos, selectAllCb.checked);
    });
    selectTh.appendChild(selectAllCb);
  }
  headRow.appendChild(selectTh);

  EXF_REQUEST_LINKED_PO_COLUMNS.forEach(({ col, label, cellClass }) => {
    const th = document.createElement("th");
    renderLinkedPoTableHeaderCell(th, { label, col, cellClass });
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  const sortedPos = typeof sortLinkedPoRows === "function" ? sortLinkedPoRows(pos) : pos;
  sortedPos.forEach(row => {
    const tr = document.createElement("tr");
    tr.dataset.po = row["PO #"];
    attachRequestLinkedPoRowOpen(tr, row["PO #"]);

    const selectTd = document.createElement("td");
    if (!isView) {
      const linkedCb = renderFormSelectedCell(selectTd, row, isExfRequestRowSelected(row), selected => {
        toggleExfFormPoSelected(row, selected);
        onFormPoSelectionChanged();
      });
      linkedCb.disabled = exfRequestAddPoPanelOpen;
    }
    tr.appendChild(selectTd);

    EXF_REQUEST_LINKED_PO_COLUMNS.forEach(({ col, cellClass, editable, editor, rows }) => {
      const td = document.createElement("td");
      td.dataset.col = col;
      if (cellClass) td.className = cellClass;
      if (editable && !isView) {
        const input = createRequestLinkedPoEditableControl(col, row, { editor, rows });
        if (col === "Ship Method") {
          input.addEventListener("change", () => {
            input.classList.remove("request-linked-po-input--error");
            input.removeAttribute("aria-invalid");
          });
        }
        td.appendChild(input);
      } else {
        renderRequestLinkedPoDataCell(td, col, row, { cellClass });
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  wrap.appendChild(table);
  section.appendChild(wrap);
  if (typeof wireLinkedPoTableSorting === "function") wireLinkedPoTableSorting(table);
  if (!isView) {
    const footer = renderExfRequestLinkedPoFooter(pos);
    if (footer) section.appendChild(footer);
  }
  if (!isView) updateExfRequestLinkedPoSelectAllHeader(pos);
  return section;
}

function getExfRequestMissingShipMethodPos(shipMethods, poNumbers = exfRequestPoNumbers) {
  return poNumbers.filter(poNumber => isEmptyValue(shipMethods[String(poNumber)]));
}

function markExfRequestMissingShipMethods(missingPoNumbers) {
  const missing = new Set(missingPoNumbers.map(String));
  let firstMissingInput = null;
  document.querySelectorAll("#exfRequestOverlay .exf-request-linked-po-table tbody tr").forEach(tr => {
    const input = tr.querySelector('[data-field="Ship Method"]');
    if (!input) return;
    const isMissing = missing.has(String(tr.dataset.po ?? ""));
    input.classList.toggle("request-linked-po-input--error", isMissing);
    if (isMissing) {
      input.setAttribute("aria-invalid", "true");
      if (!firstMissingInput) firstMissingInput = input;
    } else {
      input.removeAttribute("aria-invalid");
    }
  });
  firstMissingInput?.focus();
}

async function submitExfRequest() {
  if (exfRequestOpInProgress) return;
  setExfRequestFooterMessage("");
  if (exfRequestPoNumbers.length === 0) {
    setExfRequestFooterMessage("Add at least one PO");
    return;
  }

  const form = document.getElementById("exfRequestForm");
  const data = readRequestForm(form);
  if (isEmptyValue(data[EXF_DATE_FIELD])) {
    setExfRequestFooterMessage("EXF Date is required");
    return;
  }
  if (isEmptyValue(data["Vendor Email"])) {
    setExfRequestFooterMessage("Vendor Email is required to send the EXF request");
    return;
  }

  const poNumbers = exfRequestPoNumbers.slice();
  if (!rowsHaveSingleExfRequestVendor(getExfRequestRows())) {
    setExfRequestFooterMessage("EXF Request POs must all have the same vendor");
    return;
  }
  const exfDate = data[EXF_DATE_FIELD];
  const exfReqNotes = data[EXF_REQ_NOTES_FIELD] ?? "";
  const memos = readRequestLinkedPoFields(document.getElementById("exfRequestBody"), EXF_MEMO_FIELD);
  const shipMethods = readRequestLinkedPoFields(document.getElementById("exfRequestBody"), "Ship Method");
  const missingShipMethods = getExfRequestMissingShipMethodPos(shipMethods, poNumbers);
  if (missingShipMethods.length > 0) {
    markExfRequestMissingShipMethods(missingShipMethods);
    setExfRequestFooterMessage("Select Shipping Method for all POs before submitting");
    return;
  }
  beginToolbarCreatePending();
  closeExfRequestModal();
  exfRequestOpInProgress = true;
  showIndicator(`Sending EXF email${ELLIPSIS}`, "");

  const rows = getExfRequestRows();
  const vendor = getExfRequestVendorForRows(rows);
  let emailWarning = "";

  try {
    const json = await postApi("/api/requests/exf/create", {
      poNumbers, exfDate, exfReqNotes,
      vendorEmail: data["Vendor Email"], vendorCc: data[EXF_REQ_CC_FIELD],
      memos, shipMethods,
    });
    if (!json.success) throw new Error(json.error || json.emailError || "EXF request failed");
    applyExfRequestCreatedLocally(
      json.exfRequestId,
      poNumbers,
      exfDate,
      memos,
      shipMethods,
      data["Vendor Email"],
      { cc: data[EXF_REQ_CC_FIELD], exfReqNotes, vendor }
    );
    if (json.request) {
      const request = allExfRequests.find(r => getExfRequestRecordId(r) === json.exfRequestId);
      if (request) Object.assign(request, json.request);
      applyExfRequestFilters();
    }
    if (json.emailSent === false) emailWarning = json.emailError || "Unknown email error";
    showIndicator(
      emailWarning ? `EXF requested, but email not sent: ${emailWarning}` : `EXF requested and email sent ${CHECK_MARK}`,
      emailWarning ? "error" : "success"
    );
  } catch (err) {
    showIndicator("EXF email not sent: " + err.message, "error");
  } finally {
    exfRequestOpInProgress = false;
    endToolbarCreatePending();
  }
}

function applyExfRequestCreatedLocally(
  requestId,
  poNumbers,
  exfDate,
  memos,
  shipMethods,
  vendorEmail,
  { cc = "", exfReqNotes = "", vendor = "" } = {}
) {
  const rows = poNumbers
    .map(poNumber => allRows.find(r => String(r["PO #"]) === String(poNumber)))
    .filter(Boolean);
  const vendorName = vendor || getExfRequestVendorForRows(rows);
  const now = formatDateToYmd(new Date());
  allExfRequests.push({
    [EXF_REQUEST_ID_FIELD]: requestId,
    [EXF_DATE_FIELD]: exfDate,
    [EXF_REQ_SUBMIT_DATE_FIELD]: now,
    "Vendor": vendorName,
    "Vendor Email": vendorEmail,
    [EXF_REQ_CC_FIELD]: cc,
    [EXF_REQ_NOTES_FIELD]: exfReqNotes,
    "PO Numbers": poNumbers.join(", "),
    "PO Count": poNumbers.length,
    "Total Qty": rows.reduce((sum, row) => sum + toQtyNumber(row["PO Qty"]), 0),
    "Email Status": "Sent",
    "Email Sent At": now,
    "Email Error": "",
    "Last Email Attempt At": now,
    "Created At": now,
    "Updated At": now,
  });
  poNumbers.forEach(poNumber => {
    const row = allRows.find(r => String(r["PO #"]) === String(poNumber));
    if (!row) return;
    row[EXF_REQUEST_ID_FIELD] = requestId;
    row[EXF_REQUESTED_FIELD] = true;
    row["Status"] = "Requested";
    row[EXF_DATE_FIELD] = exfDate;
    row["Ship Method"] = shipMethods[poNumber] ?? shipMethods[String(poNumber)] ?? row["Ship Method"];
    row["EST IHD"] = calculateEstIhd(row["Ship Method"], row["EST EXF"]);
    const memo = String(memos[poNumber] ?? memos[String(poNumber)] ?? "").trim();
    if (memo) row[EXF_MEMO_FIELD] = memo;
  });
  resetLocalSelectedState(allRows);
  applyFilters();
  applyExfRequestFilters();
  updateExfRequestButton();
}

function openCreateShipmentFromExfRequest() {
  if (isAppSaving()) return;
  setExfRequestFooterMessage("");
  const request = exfRequestModalRow;
  const exfRequestId = getExfRequestRecordId(request);
  if (!exfRequestId) return;

  const rows = exfRequestPoNumbers
    .map(po => allRows.find(r => String(r["PO #"]) === String(po)))
    .filter(Boolean);
  const eligible = rows.filter(isPoEligibleForShipment);
  if (eligible.length === 0) {
    setExfRequestFooterMessage("No POs are eligible for shipment (already on a shipment or ineligible status)");
    return;
  }

  const skipped = rows.length - eligible.length;
  const exfDate = request?.[EXF_DATE_FIELD] || getExfRequestExfDateValue() || "";
  renderCreateShipmentModal(
    eligible.map(row => row["PO #"]),
    { exfRequestId, exfDate, lockExfDate: true }
  );
  if (skipped > 0) {
    showIndicator(`${skipped} PO(s) skipped — already on a shipment or ineligible`, "");
  }
}

function initExfRequest() {
  document.getElementById("exfRequestBtn")?.addEventListener("click", openExfRequestFromSelection);
  document.getElementById("exfRequestSubmitBtn")?.addEventListener("click", submitExfRequest);
  document.getElementById("exfRequestCreateShipmentBtn")?.addEventListener("click", openCreateShipmentFromExfRequest);
  document.getElementById("exfRequestAddPosBtn")?.addEventListener("click", openExfRequestAddPoPanel);
  document.getElementById("exfRequestRemovePosBtn")?.addEventListener("click", removePosFromExfRequest);
  document.getElementById("exfRequestAddPoDoneBtn")?.addEventListener("click", closeExfRequestAddPoPanel);
  document.getElementById("exfRequestAddSelectedPosBtn")?.addEventListener("click", addSelectedPosToExfRequest);
  document.getElementById("exfRequestCancelBtn")?.addEventListener("click", closeExfRequestModal);
  document.querySelector('[data-dismiss="exf-request"]')?.addEventListener("click", closeExfRequestModal);
  bindDirectBackdropDismiss(document.getElementById("exfRequestOverlay"), closeExfRequestModal);
}

initExfRequest();
if (window.__pendingExfRequests && typeof onExfRequestsDataLoaded === "function") {
  onExfRequestsDataLoaded(window.__pendingExfRequests);
  window.__pendingExfRequests = null;
}
