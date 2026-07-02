/** ASN Request records and modal. */

const ASN_DATE_FIELD = "ASN Date";
const ASN_REQ_NOTES_FIELD = "ASN Req Notes";
const ASN_REQ_SUBMIT_DATE_FIELD = "Request Date";
const ASN_PICKUP_EMAIL_STATUS_FIELD = "ASN Pickup Email Status";
const ASN_PICKUP_EMAIL_SENT_AT_FIELD = "ASN Pickup Email Sent At";
const ASN_PICKUP_EMAIL_ERROR_FIELD = "ASN Pickup Email Error";
const ASN_PICKUP_LABEL_DATA_FIELD = "ASN Pickup Label Data";
const ASN_PICKUP_BUYER_12TH_TRIBE = "12TH TRIBE";

const ASN_REQUEST_TABLE_COLUMNS = [
  ASN_REQUEST_ID_FIELD,
  ASN_DATE_FIELD,
  ASN_REQ_SUBMIT_DATE_FIELD,
  "Buyer",
  "Buyer Email",
  "CC",
  ASN_REQ_NOTES_FIELD,
  "PO Count",
  "Email Status",
  "Email Sent At",
  "Last Email Attempt At",
  "Email Error",
  "Action",
];

const ASN_REQUEST_TABLE_COLUMN_LABELS = {
  [ASN_REQ_SUBMIT_DATE_FIELD]: "Request Date",
  [ASN_REQ_NOTES_FIELD]: "Notes",
  "CC": "CC",
};

let asnRequestPoNumbers = [];
let asnRequestAddPoPanelOpen = false;
const asnRequestAvailablePoSelection = createAvailablePoPickerSelection();
let asnRequestDraftByPo = {};
let asnRequestDraftEmail = {};
let asnRequestDraftAsnDate = "";
let asnRequestDraftNotes = "";
let asnRequestBuyer = "";
let asnRequestModalRow = null;
let asnRequestOpInProgress = false;
let asnPickupPendingRequestId = "";
// allAsnRequests is declared in state-api.js
let filteredAsnRequests = [];

function isAsnRequestEligibleForPickup(request) {
  return Boolean(request) && isRequestEmailSent(request);
}

function is12thTribeAsnBuyer(buyer) {
  return String(buyer ?? "").trim().toUpperCase() === ASN_PICKUP_BUYER_12TH_TRIBE;
}

function getLogisticsEmailInfo(entityName = DEFAULT_WAREHOUSE_ENTITY) {
  const entityKey = String(entityName ?? "").trim().toLowerCase();
  const contactRows = allContactRows ?? allVendorEmailRows ?? [];
  const row = [...contactRows].reverse().find(r => {
    const name = String(r["Name"] ?? r["Vendor"] ?? "").trim().toLowerCase();
    return name === entityKey;
  });
  return {
    email: String(row?.["Email"] ?? "").trim(),
    cc: String(row?.["CC"] ?? "").trim(),
  };
}

function parseAsnPickupLabelData(request) {
  try {
    const parsed = JSON.parse(String(request?.[ASN_PICKUP_LABEL_DATA_FIELD] ?? "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function isAsnPickupEmailSent(request) {
  return String(request?.[ASN_PICKUP_EMAIL_STATUS_FIELD] ?? "").trim() === "Sent";
}

function setAsnPickupLabelFooterMessage(message = "") {
  const overlay = document.getElementById("asnPickupLabelOverlay");
  if (!overlay) return;
  clearModalFooterMessageForOverlay(overlay);
  if (message) setModalFooterMessage(message, "error", { persist: true, overlay });
}

function onAsnRequestsDataLoaded(asnRequests) {
  allAsnRequests = (asnRequests ?? []).map(normalizeAsnRequest);
  applyAsnRequestFilters();
}

function getAsnRequestRecordId(request) {
  return String(request?.[ASN_REQUEST_ID_FIELD] ?? "").trim();
}

function getAsnRequestById(id) {
  const key = String(id ?? "").trim();
  if (!key) return null;
  return allAsnRequests.find(request => getAsnRequestRecordId(request) === key) ?? null;
}

function openAsnRequestDetail(id) {
  if (isAppSaving()) return;
  const request = getAsnRequestById(id);
  if (!request) return;
  asnRequestModalRow = request;
  asnRequestPoNumbers = getRequestPoNumbers(request, ASN_REQUEST_ID_FIELD);
  asnRequestBuyer = request["Buyer"] ?? "";
  asnRequestDraftEmail = {
    email: request["Buyer Email"] ?? "",
    cc: request["CC"] ?? "",
  };
  asnRequestDraftAsnDate = request[ASN_DATE_FIELD] ?? "";
  asnRequestDraftNotes = request[ASN_REQ_NOTES_FIELD] ?? "";
  asnRequestAddPoPanelOpen = false;
  setAsnRequestFooterMessage("");
  renderAsnRequestModal(asnRequestPoNumbers, { request });
}

function applyAsnRequestFilters() {
  const q = (document.getElementById("asnRequestSearchInput")?.value ?? "").toLowerCase();
  filteredAsnRequests = allAsnRequests.filter(request => {
    if (!q) return true;
    return ASN_REQUEST_TABLE_COLUMNS
      .filter(col => col !== "Action")
      .map(col => String(request[col] ?? ""))
      .join(" ")
      .toLowerCase()
      .includes(q);
  });
  filteredAsnRequests.sort((a, b) => {
    const dateCompare = normalizeToYmd(b[ASN_REQ_SUBMIT_DATE_FIELD] || b["Created At"])
      .localeCompare(normalizeToYmd(a[ASN_REQ_SUBMIT_DATE_FIELD] || a["Created At"]));
    if (dateCompare !== 0) return dateCompare;
    return getAsnRequestRecordId(b).localeCompare(getAsnRequestRecordId(a), undefined, { numeric: true });
  });
  renderAsnRequestTable();
  updateAsnRequestRowCounter();
}

function updateAsnRequestRowCounter() {
  if (typeof updateRequestsRowCounter === "function") updateRequestsRowCounter();
}

function formatAsnRequestTableCell(col, request) {
  const val = request[col] ?? "";
  if ([ASN_DATE_FIELD, ASN_REQ_SUBMIT_DATE_FIELD, "Email Sent At", "Last Email Attempt At", "Created At", "Updated At"].includes(col)) {
    return formatDateForDisplay(val);
  }
  if (isEmptyValue(val)) return EMPTY_DISPLAY;
  return String(val);
}

function renderAsnRequestEmailStatusCell(td, request) {
  const status = String(request["Email Status"] ?? "").trim();
  td.className = "readonly readonly-no-select asn-request-email-status-cell";
  td.dataset.status = status.toLowerCase();
  if (isEmptyValue(status)) setDisplayText(td, EMPTY_DISPLAY);
  else td.textContent = status;
}

function normalizeAsnRequest(row) {
  return { ...row };
}

function renderAsnRequestActionCell(td, request) {
  const requestId = getAsnRequestRecordId(request);
  td.className = "readonly readonly-no-select asn-request-action-cell";
  const wrap = document.createElement("div");
  wrap.className = "asn-request-action-wrap";

  const resendBtn = document.createElement("button");
  resendBtn.type = "button";
  resendBtn.className = "btn btn-secondary asn-request-resend-btn";
  resendBtn.textContent = "Resend";
  resendBtn.disabled = !requestId || isAppSaving();
  resendBtn.addEventListener("click", e => {
    e.stopPropagation();
    resendAsnRequestEmail(requestId);
  });
  wrap.appendChild(resendBtn);

  if (isAsnRequestEligibleForPickup(request)) {
    const pickupBtn = document.createElement("button");
    pickupBtn.type = "button";
    pickupBtn.className = "btn btn-secondary asn-request-pickup-btn";
    pickupBtn.textContent = isAsnPickupEmailSent(request) ? "Resend Pickup" : "ASN Pickup";
    pickupBtn.disabled = !requestId || isAppSaving();
    pickupBtn.addEventListener("click", e => {
      e.stopPropagation();
      if (isAsnPickupEmailSent(request)) resendAsnPickupEmail(requestId);
      else openAsnPickupFlow(requestId);
    });
    wrap.appendChild(pickupBtn);
  }

  td.appendChild(wrap);
}

function renderAsnRequestTable() {
  const tbody = document.getElementById("asnRequestTableBody");
  if (!tbody) return;

  if (filteredAsnRequests.length === 0) {
    tbody.innerHTML = `<tr class="state-row"><td colspan="${ASN_REQUEST_TABLE_COLUMNS.length}">No ASN requests yet.</td></tr>`;
    updateAsnRequestRowCounter();
    return;
  }

  tbody.innerHTML = "";
  filteredAsnRequests.forEach(request => {
    const tr = document.createElement("tr");
    tr.dataset.asnRequestId = getAsnRequestRecordId(request);

    ASN_REQUEST_TABLE_COLUMNS.forEach(col => {
      const td = document.createElement("td");
      td.dataset.col = col;
      if (col === "Action") {
        renderAsnRequestActionCell(td, request);
      } else if (col === "Email Status") {
        renderAsnRequestEmailStatusCell(td, request);
      } else {
        const text = formatAsnRequestTableCell(col, request);
        if (text === EMPTY_DISPLAY) setDisplayText(td, EMPTY_DISPLAY);
        else { td.textContent = text; td.title = text; }
      }
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
    attachRequestTableRowDblClick(tr, () => openAsnRequestDetail(getAsnRequestRecordId(request)));
  });
  updateAsnRequestRowCounter();
}

async function resendAsnRequestEmail(requestId) {
  if (asnRequestOpInProgress || !requestId) return;
  asnRequestOpInProgress = true;
  showIndicator(`Resending ASN email${ELLIPSIS}`, "");
  try {
    const json = await postApi("/api/requests/asn/resend-email", { asnRequestId: requestId });
    if (!json.success) throw new Error(json.error);
    const request = allAsnRequests.find(r => getAsnRequestRecordId(r) === requestId);
    if (request) {
      request["Email Status"] = json.emailSent ? "Sent" : "Failed";
      request["Email Error"] = json.emailError ?? "";
      if (json.emailSent) request["Email Sent At"] = formatDateToYmd(new Date());
      request["Last Email Attempt At"] = formatDateToYmd(new Date());
      applyAsnRequestFilters();
    }
    if (!json.emailSent) {
      showIndicator(`ASN email not sent: ${json.emailError || "Missing buyer email"}`, "error");
      return;
    }
    showIndicator(`ASN email sent ${CHECK_MARK}`, "success");
  } catch (err) {
    showIndicator("Resend failed: " + err.message, "error");
  } finally {
    asnRequestOpInProgress = false;
  }
}

function updateAsnRequestButton() {
  const btn = document.getElementById("asnRequestBtn");
  if (!btn) return;
  const selected = getCheckedFilteredPos();
  btn.hidden = currentAppView !== "po" ||
    !areRowsEligibleForAsnRequest(selected);
}

function getAsnRequestBuyerForRows(rows) {
  if (rows.length === 0) return "";
  const first = String(rows[0]["Buyer"] ?? "").trim();
  return rows.every(r => String(r["Buyer"] ?? "").trim() === first) ? first : "";
}

function getAsnRequestBuyerEmailInfo(buyer) {
  const buyerKey = String(buyer ?? "").trim().toLowerCase();
  const defaults = typeof getAsnDefaultEmailAddressForBuyer === "function"
    ? getAsnDefaultEmailAddressForBuyer(buyer)
    : { email: "", cc: "" };
  const contactRows = allContactRows ?? allVendorEmailRows ?? [];
  const row = [...contactRows].reverse().find(r => {
    const name = String(r["Name"] ?? r["Vendor"] ?? "").trim().toLowerCase();
    return name === buyerKey;
  });
  const previousRequest = [...allAsnRequests].reverse().find(r =>
    String(r["Buyer"] ?? "").trim().toLowerCase() === buyerKey &&
    !isEmptyValue(r["Buyer Email"])
  );
  return {
    email: String(defaults.email ?? "").trim() ||
      String(row?.["Email"] ?? "").trim() ||
      String(previousRequest?.["Buyer Email"] ?? "").trim(),
    cc: String(defaults.cc ?? "").trim() || String(row?.["CC"] ?? "").trim(),
  };
}

function setAsnRequestFooterMessage(message = "") {
  const overlay = document.getElementById("asnRequestOverlay");
  if (!overlay) return;
  clearModalFooterMessageForOverlay(overlay);
  if (message) setModalFooterMessage(message, "error", { persist: true, overlay });
}

function openAsnRequestFromSelection() {
  if (isAppSaving() || isToolbarCreateActionBlocked()) return;
  const selected = getCheckedFilteredPos();
  if (!areRowsEligibleForAsnRequest(selected)) {
    showIndicator("Select at least one PO", "error");
    return;
  }
  asnRequestPoNumbers = selected.map(row => row["PO #"]);
  asnRequestModalRow = null;
  asnRequestBuyer = getAsnRequestBuyerForRows(selected);
  asnRequestDraftByPo = {};
  asnRequestDraftEmail = {};
  asnRequestDraftAsnDate = "";
  asnRequestDraftNotes = "";
  asnRequestAddPoPanelOpen = false;
  setAsnRequestFooterMessage("");
  clearMainTableSelection();
  renderAsnRequestModal(asnRequestPoNumbers);
}

function getAsnRequestRows(poNumbers = asnRequestPoNumbers) {
  return poNumbers
    .map(po => allRows.find(r => String(r["PO #"]) === String(po)))
    .filter(Boolean);
}

function getAsnRequestAsnDateValue() {
  const form = document.getElementById("asnRequestForm");
  return form ? readRequestForm(form)[ASN_DATE_FIELD] : formatDateToYmd(new Date());
}

function captureAsnRequestDraft() {
  const form = document.getElementById("asnRequestForm");
  if (!form) return;
  const formData = readRequestForm(form);
  asnRequestDraftEmail = {
    email: formData["Buyer Email"] ?? asnRequestDraftEmail.email ?? "",
    cc: formData["CC"] ?? asnRequestDraftEmail.cc ?? "",
  };
  asnRequestDraftAsnDate = formData[ASN_DATE_FIELD] ?? asnRequestDraftAsnDate ?? "";
  asnRequestDraftNotes = formData[ASN_REQ_NOTES_FIELD] ?? asnRequestDraftNotes ?? "";
}

function setAsnRequestModalAddPanelClass(body, isOpen) {
  body?.closest(".shipment-modal-card")?.classList.toggle("shipment-modal-card--add-panel-open", isOpen);
}

function renderAsnRequestModal(poNumbers, { asnDate = formatDateToYmd(new Date()), request = null } = {}) {
  const body = document.getElementById("asnRequestBody");
  const submitBtn = document.getElementById("asnRequestSubmitBtn");
  if (!body) return;

  const isExisting = Boolean(request?.[ASN_REQUEST_ID_FIELD]);
  const isView = isExisting && isRequestEmailSent(request);
  const submitDate = formatDateToYmd(new Date());
  setEmailStyleModalHeader(document.querySelector("#asnRequestOverlay .modal-header"), {
    typeLabel: "ASN Request",
    recordId: isExisting ? request[ASN_REQUEST_ID_FIELD] : "New",
    requestDate: isExisting
      ? (request[ASN_REQ_SUBMIT_DATE_FIELD] ?? submitDate)
      : submitDate,
  });
  if (submitBtn) submitBtn.hidden = isView;

  asnRequestPoNumbers = poNumbers.slice();
  const pos = getAsnRequestRows();
  const buyer = isExisting
    ? (request["Buyer"] ?? "")
    : (asnRequestBuyer || getAsnRequestBuyerForRows(pos));
  const buyerEmailInfo = getAsnRequestBuyerEmailInfo(buyer);

  body.innerHTML = "";
  const outer = document.createElement("div");
  outer.className = "shipment-modal-outer";

  const metaRows = [
    createRequestFormMetaRow(
      "ASN Date",
      ASN_DATE_FIELD,
      isExisting ? (request[ASN_DATE_FIELD] ?? "") : (asnRequestDraftAsnDate || asnDate),
      { type: "date", readOnly: false }
    ).tr,
    createRequestFormMetaRow(
      "Request Date",
      ASN_REQ_SUBMIT_DATE_FIELD,
      isExisting ? (request[ASN_REQ_SUBMIT_DATE_FIELD] ?? submitDate) : submitDate,
      { type: "date", readOnly: true }
    ).tr,
    createRequestFormMetaRow("Buyer", "Buyer", buyer, { readOnly: true }).tr,
    createRequestFormMetaRow(
      "Buyer Email",
      "Buyer Email",
      isExisting ? (request["Buyer Email"] ?? "") : (asnRequestDraftEmail.email ?? buyerEmailInfo.email),
      { readOnly: isView }
    ).tr,
    createRequestFormMetaRow(
      "CC",
      "CC",
      isExisting ? (request["CC"] ?? "") : (asnRequestDraftEmail.cc ?? buyerEmailInfo.cc),
      { readOnly: isView }
    ).tr,
  ];
  outer.appendChild(buildShipmentModalSplitLayout(
    buildEmailStyleForm({
      formId: "asnRequestForm",
      metaRows,
      totalsRows: createRequestFormTotalsMetaRows(pos),
      separateTotals: true,
      notesField: ASN_REQ_NOTES_FIELD,
      notesValue: isExisting ? (request[ASN_REQ_NOTES_FIELD] ?? "") : asnRequestDraftNotes,
      notesReadOnly: isView,
      requestForm: true,
    }),
    renderAsnRequestLinkedPoSection(pos, isView)
  ));

  if (!isView && asnRequestAddPoPanelOpen) {
    appendAvailablePoPanelToModalRight(outer, renderAvailablePoLinkedSection(getAvailableAsnRequestPanelRows(), {
      sectionId: "asnRequestAddPoPanel",
      columns: DELIVERY_PICKUP_LINKED_PO_COLUMNS,
      appendColgroup: appendDeliveryPickupLinkedPoColgroup,
      emptyMessage: "No eligible POs available.",
      selection: asnRequestAvailablePoSelection,
      onSelectionChange: updateAsnRequestActionButtons,
      selectAllId: "asnRequestAvailablePoSelectAll",
      showTableFooter: false,
    }));
  }

  body.appendChild(outer);
  setAsnRequestModalAddPanelClass(body, asnRequestAddPoPanelOpen);
  const headerCount = document.getElementById("asnRequestPoCount");
  setRequestModalPoCount(headerCount, pos.length);

  const titleLabel = String(document.getElementById("asnRequestModalId")?.textContent ?? "").trim() || "ASN Request";
  const requestId = titleLabel !== "ASN Request" && titleLabel !== "New" ? titleLabel : "";
  const asnForm = document.getElementById("asnRequestForm");
  const asnFormData = asnForm ? readRequestForm(asnForm) : {};
  if (typeof wirePackingListPrintButton === "function") {
    wirePackingListPrintButton("asnRequestPrintBtn", {
      poNumbers: poNumbers.slice(),
      titleLabel,
      includeTitlePage: true,
      titlePageType: "ASN",
      typeDate: asnFormData[ASN_DATE_FIELD] ?? (isExisting ? request?.[ASN_DATE_FIELD] : asnRequestDraftAsnDate),
      requestDate: asnFormData[ASN_REQ_SUBMIT_DATE_FIELD] ?? (isExisting ? request?.[ASN_REQ_SUBMIT_DATE_FIELD] : submitDate),
      requestId,
    });
  }

  bringModalToFront(document.getElementById("asnRequestOverlay"));
  updateAsnRequestActionButtons();
  updateToolbarRequestButtons();
}

function getAvailableAsnRequestPanelRows() {
  const linked = new Set(asnRequestPoNumbers.map(String));
  return allRows.filter(row => !linked.has(String(row["PO #"] ?? "")));
}

function getAsnRequestModalRenderOptions(extra = {}) {
  return {
    asnDate: getAsnRequestAsnDateValue(),
    request: asnRequestModalRow,
    ...extra,
  };
}

function openAsnRequestAddPoPanel() {
  captureAsnRequestDraft();
  clearAsnFormSelection();
  asnRequestAvailablePoSelection.clear();
  asnRequestAddPoPanelOpen = true;
  renderAsnRequestModal(asnRequestPoNumbers, getAsnRequestModalRenderOptions());
}

function closeAsnRequestAddPoPanel() {
  captureAsnRequestDraft();
  asnRequestAvailablePoSelection.clear();
  asnRequestAddPoPanelOpen = false;
  renderAsnRequestModal(asnRequestPoNumbers, getAsnRequestModalRenderOptions());
}

function addSelectedPosToAsnRequest() {
  const selected = asnRequestAvailablePoSelection.getAll();
  if (selected.length === 0) return;
  captureAsnRequestDraft();
  const existing = new Set(asnRequestPoNumbers.map(String));
  const toAdd = selected.filter(po => !existing.has(po));
  if (toAdd.length === 0) return;
  asnRequestAvailablePoSelection.clear();
  asnRequestPoNumbers = [...asnRequestPoNumbers, ...toAdd];
  asnRequestAddPoPanelOpen = true;
  renderAsnRequestModal(asnRequestPoNumbers, getAsnRequestModalRenderOptions());
}

function addPoToAsnRequest(poNumber) {
  captureAsnRequestDraft();
  const po = String(poNumber ?? "").trim();
  if (!po || asnRequestPoNumbers.map(String).includes(po)) return;
  asnRequestPoNumbers = [...asnRequestPoNumbers, po];
  asnRequestAddPoPanelOpen = true;
  renderAsnRequestModal(asnRequestPoNumbers, getAsnRequestModalRenderOptions());
}

function removePosFromAsnRequest() {
  captureAsnRequestDraft();
  const linked = getAsnRequestRows().filter(isAsnFormPoSelected);
  if (linked.length === 0) { showIndicator("Select POs to remove", "error"); return; }
  const removeSet = new Set(linked.map(row => String(row["PO #"])));
  asnRequestPoNumbers = asnRequestPoNumbers.filter(po => !removeSet.has(String(po)));
  renderAsnRequestModal(asnRequestPoNumbers, getAsnRequestModalRenderOptions());
}

function renderAsnRequestLinkedPoSection(pos, isView = false) {
  const section = document.createElement("section");
  section.className = "shipment-linked-pos";
  section.classList.toggle("shipment-linked-pos--selection-disabled", asnRequestAddPoPanelOpen || isView);

  const wrap = document.createElement("div");
  wrap.className = "email-po-table-wrap";

  const table = document.createElement("table");
  table.className = "email-po-table shipment-linked-po-table request-linked-po-table";
  appendDeliveryPickupLinkedPoColgroup(table);

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");

  const selectTh = document.createElement("th");
  selectTh.className = "th-select-col";
  if (!isView) {
    const selectAllCb = document.createElement("input");
    selectAllCb.type = "checkbox";
    selectAllCb.setAttribute("aria-label", "Select all");
    selectAllCb.disabled = asnRequestAddPoPanelOpen;
    selectAllCb.addEventListener("change", () => {
      pos.forEach(row => toggleAsnFormPoSelected(row, selectAllCb.checked));
      syncAsnRequestLinkedPoCheckboxes(pos);
      updateAsnRequestActionButtons();
    });
    selectTh.appendChild(selectAllCb);
  }
  headRow.appendChild(selectTh);

  DELIVERY_PICKUP_LINKED_PO_COLUMNS.forEach(({ col, label, cellClass }) => {
    const th = document.createElement("th");
    renderLinkedPoTableHeaderCell(th, { label, col, cellClass });
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  pos.forEach(row => {
    const tr = document.createElement("tr");
    tr.dataset.po = row["PO #"];
    attachRequestLinkedPoRowOpen(tr, row["PO #"]);

    const selectTd = document.createElement("td");
    if (!isView) {
      renderFormSelectedCell(selectTd, row, isAsnFormPoSelected(row), selected => {
        toggleAsnFormPoSelected(row, selected);
        updateAsnRequestActionButtons();
      });
    }
    tr.appendChild(selectTd);

    DELIVERY_PICKUP_LINKED_PO_COLUMNS.forEach(({ col, cellClass }) => {
      const td = document.createElement("td");
      renderRequestLinkedPoDataCell(td, col, row, { cellClass });
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  wrap.appendChild(table);
  section.appendChild(wrap);
  return section;
}

function syncAsnRequestLinkedPoCheckboxes(pos) {
  const tbody = document.querySelector("#asnRequestOverlay .shipment-linked-po-table tbody");
  if (!tbody) return;
  pos.forEach(row => {
    const po = String(row["PO #"] ?? "");
    const tr = [...tbody.querySelectorAll("tr[data-po]")].find(el => String(el.dataset.po) === po);
    const cb = tr?.querySelector(".po-select-checkbox");
    if (cb) cb.checked = isAsnFormPoSelected(row);
  });
}

function updateAsnRequestActionButtons() {
  const overlay = document.getElementById("asnRequestOverlay");
  if (!overlay?.classList.contains("open")) return;
  const addBtn = document.getElementById("asnRequestAddPosBtn");
  const removeBtn = document.getElementById("asnRequestRemovePosBtn");
  const doneBtn = document.getElementById("asnRequestAddPoDoneBtn");
  const addSelectedBtn = document.getElementById("asnRequestAddSelectedPosBtn");
  const submitBtn = document.getElementById("asnRequestSubmitBtn");

  const isView = submitBtn?.hidden === true;
  const saveDateBtn = document.getElementById("asnRequestSaveDateBtn");
  if (saveDateBtn) saveDateBtn.hidden = !isView;
  const pickupBtn = document.getElementById("asnPickupBtn");
  const pickupResendBtn = document.getElementById("asnPickupResendBtn");
  const printBtn = document.getElementById("asnRequestPrintBtn");
  if (printBtn) printBtn.hidden = !isView || asnRequestPoNumbers.length === 0;
  if (pickupBtn || pickupResendBtn) {
    const request = asnRequestModalRow;
    const eligible = isView && isAsnRequestEligibleForPickup(request);
    const sent = eligible && isAsnPickupEmailSent(request);
    if (pickupBtn) {
      pickupBtn.hidden = !eligible || sent;
      pickupBtn.disabled = asnRequestOpInProgress || isAppSaving();
    }
    if (pickupResendBtn) {
      pickupResendBtn.hidden = !sent;
      pickupResendBtn.disabled = asnRequestOpInProgress || isAppSaving();
    }
  }
  if (isView) {
    if (addBtn) addBtn.hidden = true;
    if (removeBtn) removeBtn.hidden = true;
    if (doneBtn) doneBtn.hidden = true;
    if (addSelectedBtn) addSelectedBtn.hidden = true;
    return;
  }

  if (asnRequestAddPoPanelOpen) {
    if (addBtn) addBtn.hidden = true;
    if (removeBtn) removeBtn.hidden = true;
    if (doneBtn) doneBtn.hidden = false;
    if (addSelectedBtn) addSelectedBtn.hidden = asnRequestAvailablePoSelection.size === 0;
    return;
  }

  if (doneBtn) doneBtn.hidden = true;
  if (addSelectedBtn) addSelectedBtn.hidden = true;

  const anySelected = getAsnRequestRows().some(isAsnFormPoSelected);
  const hasAvailablePos = getAvailableAsnRequestPanelRows().length > 0;
  if (addBtn) addBtn.hidden = anySelected || !hasAvailablePos;
  if (removeBtn) removeBtn.hidden = !anySelected;
}

// Per-row selection state (reuses the existing form selection helpers pattern)
const _asnFormSelectedPos = new Set();
function isAsnFormPoSelected(row) {
  return _asnFormSelectedPos.has(String(row["PO #"] ?? ""));
}
function toggleAsnFormPoSelected(row, selected) {
  const po = String(row["PO #"] ?? "");
  if (selected) _asnFormSelectedPos.add(po);
  else _asnFormSelectedPos.delete(po);
}
function clearAsnFormSelection() {
  _asnFormSelectedPos.clear();
}

async function updateAsnRequestDate() {
  if (asnRequestOpInProgress || !asnRequestModalRow) return;
  const requestId = getAsnRequestRecordId(asnRequestModalRow);
  if (!requestId) return;

  const form = document.getElementById("asnRequestForm");
  const data = readRequestForm(form);
  const newDate = data[ASN_DATE_FIELD] ?? "";
  if (isEmptyValue(newDate)) {
    setAsnRequestFooterMessage("ASN Date is required");
    return;
  }

  setAsnRequestFooterMessage("");
  asnRequestOpInProgress = true;
  showIndicator(`Saving${ELLIPSIS}`, "");

  try {
    const json = await postApi("/api/requests/asn/update", { asnRequestId: requestId, request: { [ASN_DATE_FIELD]: newDate } });
    if (!json.success) throw new Error(json.error || "Update failed");

    // Update in-memory request record.
    const request = allAsnRequests.find(r => getAsnRequestRecordId(r) === requestId);
    if (request) request[ASN_DATE_FIELD] = newDate;
    if (asnRequestModalRow) asnRequestModalRow[ASN_DATE_FIELD] = newDate;

    // Mirror the new date to every linked PO row.
    const poNumbers = getRequestPoNumbers(asnRequestModalRow, ASN_REQUEST_ID_FIELD);
    poNumbers.forEach(poNumber => {
      const row = allRows.find(r => String(r["PO #"]) === String(poNumber));
      if (row) row[ASN_DATE_FIELD] = newDate;
    });

    applyAsnRequestFilters();
    applyFilters();
    renderAsnRequestModal(asnRequestPoNumbers, { request: asnRequestModalRow });
    showIndicator(`ASN Date updated ${CHECK_MARK}`, "success");
  } catch (err) {
    setAsnRequestFooterMessage("Save failed: " + err.message);
    showIndicator("Save failed: " + err.message, "error");
  } finally {
    asnRequestOpInProgress = false;
  }
}

function closeAsnRequestModal() {
  asnRequestPoNumbers = [];
  asnRequestAddPoPanelOpen = false;
  asnRequestDraftByPo = {};
  asnRequestDraftEmail = {};
  asnRequestDraftAsnDate = "";
  asnRequestDraftNotes = "";
  asnRequestBuyer = "";
  asnRequestModalRow = null;
  clearAsnFormSelection();
  const printBtn = document.getElementById("asnRequestPrintBtn");
  if (printBtn) printBtn.hidden = true;
  const saveDateBtn = document.getElementById("asnRequestSaveDateBtn");
  if (saveDateBtn) saveDateBtn.hidden = true;
  const pickupBtn = document.getElementById("asnPickupBtn");
  const pickupResendBtn = document.getElementById("asnPickupResendBtn");
  if (pickupBtn) pickupBtn.hidden = true;
  if (pickupResendBtn) pickupResendBtn.hidden = true;
  setAsnRequestFooterMessage("");
  document.getElementById("asnRequestOverlay")?.classList.remove("open");
  setAsnRequestModalAddPanelClass(document.getElementById("asnRequestBody"), false);
  updateToolbarRequestButtons();
}

async function submitAsnRequest() {
  if (asnRequestOpInProgress || asnRequestPoNumbers.length === 0) return;
  setAsnRequestFooterMessage("");

  const form = document.getElementById("asnRequestForm");
  const data = readRequestForm(form);
  if (isEmptyValue(data[ASN_DATE_FIELD])) {
    setAsnRequestFooterMessage("ASN Date is required");
    return;
  }
  if (isEmptyValue(data[ASN_REQ_SUBMIT_DATE_FIELD])) {
    setAsnRequestFooterMessage("Request Date is required");
    return;
  }
  if (isEmptyValue(data["Buyer Email"])) {
    setAsnRequestFooterMessage("Buyer Email is required to send the ASN request");
    return;
  }

  const poNumbers = asnRequestPoNumbers.slice();
  beginToolbarCreatePending();
  closeAsnRequestModal();
  asnRequestOpInProgress = true;
  showIndicator(`Sending ASN email${ELLIPSIS}`, "");
  let emailWarning = "";

  try {
    const json = await postApi("/api/requests/asn/create", { poNumbers, request: data });
    if (!json.success) throw new Error(json.error || json.emailError || "ASN request failed");
    applyAsnRequestCreatedLocally(json.asnRequestId, poNumbers, data);
    if (json.request) {
      const request = allAsnRequests.find(r => getAsnRequestRecordId(r) === json.asnRequestId);
      if (request) Object.assign(request, json.request);
      applyAsnRequestFilters();
    }
    if (json.emailSent === false) emailWarning = json.emailError || "Unknown email error";
    showIndicator(
      emailWarning ? `ASN requested, but email not sent: ${emailWarning}` : `ASN requested and email sent ${CHECK_MARK}`,
      emailWarning ? "error" : "success"
    );
  } catch (err) {
    showIndicator("ASN email not sent: " + err.message, "error");
  } finally {
    asnRequestOpInProgress = false;
    endToolbarCreatePending();
  }
}

function applyAsnRequestCreatedLocally(requestId, poNumbers, data) {
  const now = formatDateToYmd(new Date());
  allAsnRequests.push({
    [ASN_REQUEST_ID_FIELD]: requestId,
    [ASN_DATE_FIELD]: data[ASN_DATE_FIELD] ?? "",
    [ASN_REQ_SUBMIT_DATE_FIELD]: data[ASN_REQ_SUBMIT_DATE_FIELD] ?? now,
    "Buyer": data["Buyer"] ?? "",
    "Buyer Email": data["Buyer Email"] ?? "",
    "CC": data["CC"] ?? "",
    [ASN_REQ_NOTES_FIELD]: data[ASN_REQ_NOTES_FIELD] ?? "",
    "PO Numbers": poNumbers.join(", "),
    "PO Count": poNumbers.length,
    "Email Status": "Sent",
    "Email Sent At": now,
    "Last Email Attempt At": now,
    "Email Error": "",
    "Created At": now,
    "Updated At": now,
  });

  poNumbers.forEach(poNumber => {
    const row = allRows.find(r => String(r["PO #"]) === String(poNumber));
    if (!row) return;
    row[ASN_REQUEST_ID_FIELD] = requestId;
    row["ASN Requested"] = true;
    row["ASN Date"] = data[ASN_DATE_FIELD] ?? "";
    row["ASN Req Date"] = data[ASN_REQ_SUBMIT_DATE_FIELD] ?? now;
  });
  resetLocalSelectedState(allRows);
  applyFilters();
  applyAsnRequestFilters();
  if (typeof updateToolbarRequestButtons === "function") updateToolbarRequestButtons();
}

function openAsnPickupFlow(asnRequestId) {
  if (asnRequestOpInProgress || !asnRequestId) return;
  const request = getAsnRequestById(asnRequestId);
  if (!isAsnRequestEligibleForPickup(request)) {
    showIndicator("ASN request must be completed before sending ASN Pickup", "error");
    return;
  }
  if (is12thTribeAsnBuyer(request["Buyer"])) {
    asnPickupPendingRequestId = asnRequestId;
    renderAsnPickupLabelModal(request);
    return;
  }
  if (!window.confirm("Send ASN Pickup email to FORERUNNER LOGISTICS?")) return;
  sendAsnPickupEmail(asnRequestId, []);
}

function closeAsnPickupLabelModal() {
  asnPickupPendingRequestId = "";
  setAsnPickupLabelFooterMessage("");
  document.getElementById("asnPickupLabelOverlay")?.classList.remove("open");
}

function renderAsnPickupLabelModal(request) {
  const body = document.getElementById("asnPickupLabelBody");
  const subtitle = document.getElementById("asnPickupLabelModalSubtitle");
  if (!body) return;

  const requestId = getAsnRequestRecordId(request);
  if (subtitle) subtitle.textContent = requestId ? `ASN Pickup · ${requestId}` : "ASN Pickup";

  const poNumbers = getRequestPoNumbers(request, ASN_REQUEST_ID_FIELD);
  const pos = poNumbers
    .map(po => allRows.find(r => String(r["PO #"]) === String(po)))
    .filter(Boolean);
  const stored = parseAsnPickupLabelData(request);
  const storedByPo = Object.fromEntries(stored.map(entry => [String(entry.poNumber ?? ""), entry]));

  body.innerHTML = "";
  const intro = document.createElement("p");
  intro.className = "asn-pickup-label-intro";
  intro.textContent = "Enter Ship Notice # and Color Code for each PO. These will be used on the carton labels attached to the ASN Pickup email.";
  body.appendChild(intro);

  const wrap = document.createElement("div");
  wrap.className = "email-po-table-wrap";

  const table = document.createElement("table");
  table.className = "email-po-table shipment-linked-po-table asn-pickup-label-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>PO #</th>
        <th>Buyer PO #</th>
        <th>Style #</th>
        <th>Ship Notice #</th>
        <th>Color Code</th>
      </tr>
    </thead>
  `;

  const tbody = document.createElement("tbody");
  pos.forEach(row => {
    const po = String(row["PO #"] ?? "");
    const saved = storedByPo[po] || {};
    const tr = document.createElement("tr");
    tr.dataset.po = po;

    const poTd = document.createElement("td");
    poTd.textContent = po;
    tr.appendChild(poTd);

    const buyerPoTd = document.createElement("td");
    buyerPoTd.textContent = String(row["Buyer PO #"] ?? "");
    tr.appendChild(buyerPoTd);

    const styleTd = document.createElement("td");
    styleTd.textContent = String(row["Style #"] ?? "");
    tr.appendChild(styleTd);

    const shipNoticeTd = document.createElement("td");
    const shipNoticeInput = document.createElement("input");
    shipNoticeInput.type = "text";
    shipNoticeInput.className = "shipment-form-input asn-pickup-label-input";
    shipNoticeInput.dataset.field = "shipNotice";
    shipNoticeInput.value = String(saved.shipNotice ?? "");
    shipNoticeTd.appendChild(shipNoticeInput);
    tr.appendChild(shipNoticeTd);

    const colorCodeTd = document.createElement("td");
    const colorCodeInput = document.createElement("input");
    colorCodeInput.type = "text";
    colorCodeInput.className = "shipment-form-input asn-pickup-label-input";
    colorCodeInput.dataset.field = "colorCode";
    colorCodeInput.value = String(saved.colorCode ?? "");
    colorCodeTd.appendChild(colorCodeInput);
    tr.appendChild(colorCodeTd);

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  body.appendChild(wrap);

  setAsnPickupLabelFooterMessage("");
  bringModalToFront(document.getElementById("asnPickupLabelOverlay"));
  document.getElementById("asnPickupLabelOverlay")?.classList.add("open");
}

function readAsnPickupLabelInputs() {
  const rows = [...document.querySelectorAll("#asnPickupLabelBody .asn-pickup-label-table tbody tr")];
  return rows.map(tr => ({
    poNumber: String(tr.dataset.po ?? "").trim(),
    shipNotice: String(tr.querySelector('[data-field="shipNotice"]')?.value ?? "").trim(),
    colorCode: String(tr.querySelector('[data-field="colorCode"]')?.value ?? "").trim(),
  }));
}

function validateAsnPickupLabelInputs(labelInputs) {
  for (const entry of labelInputs) {
    if (!entry.shipNotice || !entry.colorCode) {
      return "Ship Notice # and Color Code are required for every PO.";
    }
  }
  return "";
}

function applyAsnPickupSentLocally(asnRequestId, labelInputs, { emailSent = true, emailError = "" } = {}) {
  const request = getAsnRequestById(asnRequestId);
  if (!request) return;
  const now = formatDateToYmd(new Date());
  request[ASN_PICKUP_EMAIL_STATUS_FIELD] = emailSent ? "Sent" : "Failed";
  request[ASN_PICKUP_EMAIL_SENT_AT_FIELD] = emailSent ? now : (request[ASN_PICKUP_EMAIL_SENT_AT_FIELD] ?? "");
  request[ASN_PICKUP_EMAIL_ERROR_FIELD] = emailError;
  if (is12thTribeAsnBuyer(request["Buyer"]) && labelInputs.length > 0) {
    request[ASN_PICKUP_LABEL_DATA_FIELD] = JSON.stringify(labelInputs);
  }
  request["Updated At"] = now;
  applyAsnRequestFilters();
  if (asnRequestModalRow && getAsnRequestRecordId(asnRequestModalRow) === asnRequestId) {
    renderAsnRequestModal(asnRequestPoNumbers, { request });
  }
}

async function sendAsnPickupEmail(asnRequestId, labelInputs) {
  if (asnRequestOpInProgress || !asnRequestId) return;
  const request = getAsnRequestById(asnRequestId);
  if (!isAsnRequestEligibleForPickup(request)) {
    showIndicator("ASN request must be completed before sending ASN Pickup", "error");
    return;
  }

  const inputs = Array.isArray(labelInputs) ? labelInputs : [];
  if (is12thTribeAsnBuyer(request["Buyer"])) {
    const validationError = validateAsnPickupLabelInputs(inputs);
    if (validationError) {
      setAsnPickupLabelFooterMessage(validationError);
      return;
    }
  }

  asnRequestOpInProgress = true;
  closeAsnPickupLabelModal();
  showIndicator(`Sending ASN Pickup email${ELLIPSIS}`, "");

  try {
    const json = await postApi("/api/requests/asn-pickup/send-email", { asnRequestId, labelInputs: inputs });
    if (!json.success) throw new Error(json.error || json.emailError || "ASN Pickup email failed to send.");
    applyAsnPickupSentLocally(asnRequestId, inputs, {
      emailSent: json.emailSent,
      emailError: json.emailError ?? "",
    });
    if (!json.emailSent) {
      showIndicator(`ASN Pickup email not sent: ${json.emailError || "Unknown error"}`, "error");
      return;
    }
    showIndicator(`ASN Pickup email sent ${CHECK_MARK}`, "success");
  } catch (err) {
    applyAsnPickupSentLocally(asnRequestId, inputs, { emailSent: false, emailError: err.message });
    showIndicator("ASN Pickup failed: " + err.message, "error");
  } finally {
    asnRequestOpInProgress = false;
  }
}

async function resendAsnPickupEmail(asnRequestId) {
  if (asnRequestOpInProgress || !asnRequestId) return;
  const request = getAsnRequestById(asnRequestId);
  if (!isAsnRequestEligibleForPickup(request)) return;

  if (is12thTribeAsnBuyer(request["Buyer"])) {
    const stored = parseAsnPickupLabelData(request);
    if (stored.length === 0) {
      openAsnPickupFlow(asnRequestId);
      return;
    }
    if (!window.confirm("Resend ASN Pickup email to FORERUNNER LOGISTICS?")) return;
    await sendAsnPickupEmail(asnRequestId, stored);
    return;
  }

  if (!window.confirm("Resend ASN Pickup email to FORERUNNER LOGISTICS?")) return;
  await sendAsnPickupEmail(asnRequestId, []);
}

function submitAsnPickupLabelModal() {
  if (!asnPickupPendingRequestId) return;
  const labelInputs = readAsnPickupLabelInputs();
  const validationError = validateAsnPickupLabelInputs(labelInputs);
  if (validationError) {
    setAsnPickupLabelFooterMessage(validationError);
    return;
  }
  sendAsnPickupEmail(asnPickupPendingRequestId, labelInputs);
}

function initAsnRequests() {
  document.getElementById("asnRequestBtn")?.addEventListener("click", openAsnRequestFromSelection);
  document.getElementById("asnRequestSubmitBtn")?.addEventListener("click", submitAsnRequest);
  document.getElementById("asnRequestAddPosBtn")?.addEventListener("click", openAsnRequestAddPoPanel);
  document.getElementById("asnRequestRemovePosBtn")?.addEventListener("click", removePosFromAsnRequest);
  document.getElementById("asnRequestAddPoDoneBtn")?.addEventListener("click", closeAsnRequestAddPoPanel);
  document.getElementById("asnRequestAddSelectedPosBtn")?.addEventListener("click", addSelectedPosToAsnRequest);
  document.getElementById("asnRequestCancelBtn")?.addEventListener("click", closeAsnRequestModal);
  document.getElementById("asnRequestSaveDateBtn")?.addEventListener("click", updateAsnRequestDate);
  document.getElementById("asnPickupBtn")?.addEventListener("click", () => {
    const requestId = getAsnRequestRecordId(asnRequestModalRow);
    if (requestId) openAsnPickupFlow(requestId);
  });
  document.getElementById("asnPickupResendBtn")?.addEventListener("click", () => {
    const requestId = getAsnRequestRecordId(asnRequestModalRow);
    if (requestId) resendAsnPickupEmail(requestId);
  });
  document.getElementById("asnPickupLabelSubmitBtn")?.addEventListener("click", submitAsnPickupLabelModal);
  document.getElementById("asnPickupLabelCancelBtn")?.addEventListener("click", closeAsnPickupLabelModal);
  document.getElementById("asnPickupLabelDismissBtn")?.addEventListener("click", closeAsnPickupLabelModal);
  bindDirectBackdropDismiss(document.getElementById("asnPickupLabelOverlay"), closeAsnPickupLabelModal);
  document.querySelector('[data-dismiss="asn-request"]')?.addEventListener("click", closeAsnRequestModal);
  bindDirectBackdropDismiss(document.getElementById("asnRequestOverlay"), closeAsnRequestModal);
  document.getElementById("asnRequestSearchInput")?.addEventListener("input", applyAsnRequestFilters);
}

initAsnRequests();
if (window.__pendingAsnRequests && typeof onAsnRequestsDataLoaded === "function") {
  onAsnRequestsDataLoaded(window.__pendingAsnRequests);
  window.__pendingAsnRequests = null;
}
