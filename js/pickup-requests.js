/** Pickup Request records and modals. */

const PICKUP_DATE_FIELD = "Pickup Date";
const PICKUP_REQ_NOTES_FIELD = "Pickup Req Notes";
const PICKUP_REQ_SUBMIT_DATE_FIELD = "Request Date";

const PICKUP_REQUEST_TABLE_COLUMNS = [
  PICKUP_REQUEST_ID_FIELD,
  PICKUP_DATE_FIELD,
  PICKUP_REQ_SUBMIT_DATE_FIELD,
  "From",
  "To",
  "Email To",
  "Email CC",
  PICKUP_REQ_NOTES_FIELD,
  "PO Count",
  "Email Status",
  "Email Sent At",
  "Email Error",
  "Action",
];

let allPickupRequests = [];
let filteredPickupRequests = [];
let pickupRequestPoNumbers = [];
let pickupRequestAddPoPanelOpen = false;
const pickupRequestAvailablePoSelection = createAvailablePoPickerSelection();
let pickupRequestDraftEmail = {};
let pickupRequestDraftPickupDate = "";
let pickupRequestDraftFrom = "";
let pickupRequestDraftTo = "";
let pickupRequestDraftNotes = "";
let pickupRequestModalRow = null;
let pickupRequestOpInProgress = false;

function normalizePickupRequest(row) {
  return { ...row };
}

function onPickupRequestsDataLoaded(pickupRequests) {
  allPickupRequests = (pickupRequests ?? []).map(normalizePickupRequest);
  filteredPickupRequests = allPickupRequests.slice();
  applyPickupRequestFilters();
  if (typeof syncAllAssignDatesFromPickupRequests === "function") {
    syncAllAssignDatesFromPickupRequests(allRows);
  }
}

function getPickupRequestById(id) {
  const key = String(id ?? "").trim();
  if (!key) return null;
  return allPickupRequests.find(r => String(r[PICKUP_REQUEST_ID_FIELD] ?? "").trim() === key) ?? null;
}

function applyPickupRequestFilters() {
  const q = (document.getElementById("pickupRequestSearchInput")?.value ?? "").toLowerCase();
  filteredPickupRequests = allPickupRequests.filter(request => {
    if (!q) return true;
    return PICKUP_REQUEST_TABLE_COLUMNS
      .filter(col => col !== "Action")
      .map(col => String(request[col] ?? ""))
      .join(" ")
      .toLowerCase()
      .includes(q);
  });
  filteredPickupRequests.sort((a, b) =>
    normalizeToYmd(b[PICKUP_REQ_SUBMIT_DATE_FIELD] || b["Created At"])
      .localeCompare(normalizeToYmd(a[PICKUP_REQ_SUBMIT_DATE_FIELD] || a["Created At"]))
  );
  renderPickupRequestTable();
  updatePickupRequestRowCounter();
}

function updatePickupRequestRowCounter() {
  if (typeof updateRequestsRowCounter === "function") updateRequestsRowCounter();
}

function formatPickupRequestTableCell(col, request) {
  const val = request[col] ?? "";
  if ([PICKUP_DATE_FIELD, PICKUP_REQ_SUBMIT_DATE_FIELD, "Email Sent At", "Created At", "Updated At"].includes(col)) {
    return formatDateForDisplay(val);
  }
  if (col === PICKUP_REQ_NOTES_FIELD) return isEmptyValue(val) ? EMPTY_DISPLAY : String(val);
  if (isEmptyValue(val)) return EMPTY_DISPLAY;
  return String(val);
}

function renderPickupRequestEmailStatusCell(td, request) {
  const status = String(request["Email Status"] ?? "").trim();
  td.className = "readonly readonly-no-select pickup-request-email-status-cell";
  td.dataset.status = status.toLowerCase();
  if (isEmptyValue(status)) setDisplayText(td, EMPTY_DISPLAY);
  else td.textContent = status;
}

function renderPickupRequestActionCell(td, request) {
  const requestId = String(request[PICKUP_REQUEST_ID_FIELD] ?? "").trim();
  td.className = "readonly readonly-no-select pickup-request-action-cell";
  const resendBtn = document.createElement("button");
  resendBtn.type = "button";
  resendBtn.className = "btn btn-secondary pickup-request-resend-btn";
  resendBtn.textContent = "Resend";
  resendBtn.disabled = !requestId || isAppSaving();
  resendBtn.addEventListener("click", e => {
    e.stopPropagation();
    resendPickupRequestEmail(requestId);
  });
  td.appendChild(resendBtn);
}

function renderPickupRequestTable() {
  const tbody = document.getElementById("pickupRequestTableBody");
  if (!tbody) return;
  if (filteredPickupRequests.length === 0) {
    tbody.innerHTML = `<tr class="state-row"><td colspan="${PICKUP_REQUEST_TABLE_COLUMNS.length}">No pickup requests yet.</td></tr>`;
    updatePickupRequestRowCounter();
    return;
  }
  tbody.innerHTML = "";
  filteredPickupRequests.forEach(request => {
    const tr = document.createElement("tr");
    tr.dataset.pickupRequestId = String(request[PICKUP_REQUEST_ID_FIELD] ?? "").trim();
    PICKUP_REQUEST_TABLE_COLUMNS.forEach(col => {
      const td = document.createElement("td");
      td.dataset.col = col;
      if (col === "Action") renderPickupRequestActionCell(td, request);
      else if (col === "Email Status") renderPickupRequestEmailStatusCell(td, request);
      else {
        const text = formatPickupRequestTableCell(col, request);
        if (text === EMPTY_DISPLAY) setDisplayText(td, EMPTY_DISPLAY);
        else { td.textContent = text; td.title = text; }
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
    attachRequestTableRowDblClick(tr, () => {
      const id = String(request[PICKUP_REQUEST_ID_FIELD] ?? "").trim();
      if (id) openPickupRequestDetail(id);
    });
  });
  updatePickupRequestRowCounter();
}

async function resendPickupRequestEmail(requestId) {
  if (pickupRequestOpInProgress || !requestId) return;
  pickupRequestOpInProgress = true;
  showIndicator(`Resending pickup email${ELLIPSIS}`, "");
  try {
    if (isDemoMode()) {
      const request = allPickupRequests.find(r => String(r[PICKUP_REQUEST_ID_FIELD] ?? "").trim() === requestId);
      if (request) {
        request["Email Status"] = "Sent";
        request["Email Error"] = "";
        request["Email Sent At"] = formatDateToYmd(new Date());
      }
      applyPickupRequestFilters();
    } else {
      const json = await postAppsScript({ action: "resendPickupRequestEmail", pickupRequestId: requestId });
      if (!json.success) throw new Error(json.error);
      const request = allPickupRequests.find(r => String(r[PICKUP_REQUEST_ID_FIELD] ?? "").trim() === requestId);
      if (request) {
        request["Email Status"] = json.emailSent ? "Sent" : "Failed";
        request["Email Error"] = json.emailError ?? "";
        if (json.emailSent) request["Email Sent At"] = formatDateToYmd(new Date());
        applyPickupRequestFilters();
      }
      if (!json.emailSent) {
        showIndicator(`Pickup email not sent: ${json.emailError || "Missing email"}`, "error");
        return;
      }
    }
    showIndicator(`Pickup email sent ${CHECK_MARK}`, "success");
  } catch (err) {
    showIndicator("Resend failed: " + err.message, "error");
  } finally {
    pickupRequestOpInProgress = false;
  }
}

function updatePickupRequestButton() {
  const btn = document.getElementById("pickupRequestBtn");
  if (!btn) return;
  const selected = getCheckedFilteredPos();
  btn.hidden = currentAppView !== "po" ||
    !areRowsEligibleForPickupRequest(selected);
}

function renderPickupRequestIdCell(td, row) {
  td.className = "readonly readonly-no-select td-shipment-id-cell";
  const id = String(row[PICKUP_REQUEST_ID_FIELD] ?? "").trim();
  if (!id) { setDisplayText(td, EMPTY_DISPLAY); return; }
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "shipment-id-link";
  btn.textContent = id;
  btn.title = "Open pickup request";
  btn.addEventListener("click", e => {
    e.stopPropagation();
    openPickupRequestDetail(id);
  });
  td.appendChild(btn);
}

function getPickupRequestDateForRow(row) {
  const id = String(row[PICKUP_REQUEST_ID_FIELD] ?? "").trim();
  if (!id || typeof getPickupRequestById !== "function") {
    return row["Assign Date"] ?? "";
  }
  const request = getPickupRequestById(id);
  return request?.[PICKUP_DATE_FIELD] ?? request?.["Request Date"] ?? row["Assign Date"] ?? "";
}

function setPickupRequestFooterMessage(message = "") {
  const overlay = document.getElementById("pickupRequestOverlay");
  if (!overlay) return;
  clearModalFooterMessageForOverlay(overlay);
  if (message) setModalFooterMessage(message, "error", { persist: true, overlay });
}

function getPickupRequestBuyerForRows(rows) {
  if (rows.length === 0) return "";
  const first = String(rows[0]["Buyer"] ?? "").trim();
  return rows.every(r => String(r["Buyer"] ?? "").trim() === first) ? first : "";
}

function getBuyerEmailInfo(buyer) {
  const buyerKey = String(buyer ?? "").trim().toLowerCase();
  const contactRows = allContactRows ?? allVendorEmailRows ?? [];
  const row = [...contactRows].reverse().find(r => {
    const name = String(r["Name"] ?? r["Vendor"] ?? "").trim().toLowerCase();
    return name === buyerKey;
  });
  const previousRequest = [...allPickupRequests].reverse().find(r =>
    String(r["To"] ?? "").trim().toLowerCase() === buyerKey &&
    !isEmptyValue(r["Email To"])
  );
  return {
    email: String(row?.["Email"] ?? "").trim() || String(previousRequest?.["Email To"] ?? "").trim(),
    cc: String(row?.["CC"] ?? "").trim(),
  };
}

function openPickupRequestFromSelection() {
  if (isAppSaving() || isToolbarCreateActionBlocked()) return;
  const selected = getCheckedFilteredPos();
  if (!areRowsEligibleForPickupRequest(selected)) {
    showIndicator("Select LULU'S FASHION LOUNGE or 12TH TRIBE OTW or Arrived at Port POs with packing lists and ASN requests submitted", "error");
    return;
  }
  pickupRequestPoNumbers = selected.map(row => row["PO #"]);
  pickupRequestModalRow = null;
  pickupRequestAddPoPanelOpen = false;
  pickupRequestDraftEmail = {};
  pickupRequestDraftPickupDate = "";
  pickupRequestDraftFrom = DEFAULT_WAREHOUSE_ENTITY;
  pickupRequestDraftTo = getPickupRequestBuyerForRows(selected);
  pickupRequestDraftNotes = "";
  clearMainTableSelection();
  renderPickupRequestModal(pickupRequestPoNumbers);
}

function openPickupRequestDetail(id) {
  if (isAppSaving()) return;
  const request = getPickupRequestById(id);
  if (!request) return;
  pickupRequestModalRow = request;
  pickupRequestPoNumbers = getRequestPoNumbers(request, PICKUP_REQUEST_ID_FIELD);
  pickupRequestAddPoPanelOpen = false;
  renderPickupRequestModal(pickupRequestPoNumbers, request);
}

function capturePickupRequestDraft() {
  const form = document.getElementById("pickupRequestForm");
  if (!form) return;
  const formData = readRequestForm(form);
  pickupRequestDraftEmail = {
    emailTo: formData["Email To"] ?? pickupRequestDraftEmail.emailTo ?? "",
    emailCc: formData["Email CC"] ?? pickupRequestDraftEmail.emailCc ?? "",
  };
  pickupRequestDraftPickupDate = formData[PICKUP_DATE_FIELD] ?? pickupRequestDraftPickupDate ?? "";
  pickupRequestDraftFrom = formData["From"] ?? pickupRequestDraftFrom ?? "";
  pickupRequestDraftTo = formData["To"] ?? pickupRequestDraftTo ?? "";
  pickupRequestDraftNotes = formData[PICKUP_REQ_NOTES_FIELD] ?? pickupRequestDraftNotes ?? "";
}

function setPickupRequestModalAddPanelClass(body, isOpen) {
  body?.closest(".shipment-modal-card")?.classList.toggle("shipment-modal-card--add-panel-open", isOpen);
}

function renderPickupRequestModal(poNumbers, request = {}) {
  const body = document.getElementById("pickupRequestBody");
  const submitBtn = document.getElementById("pickupRequestSubmitBtn");
  if (!body) return;

  const pos = poNumbers
    .map(po => allRows.find(r => String(r["PO #"]) === String(po)))
    .filter(Boolean);

  const activeRequest = request[PICKUP_REQUEST_ID_FIELD] ? request : (pickupRequestModalRow ?? request);
  const isExisting = Boolean(activeRequest[PICKUP_REQUEST_ID_FIELD]);
  const isReadOnly = isExisting && isRequestEmailSent(activeRequest);
  const submitDate = formatDateToYmd(new Date());
  setEmailStyleModalHeader(document.querySelector("#pickupRequestOverlay .modal-header"), {
    typeLabel: "Pickup Request",
    recordId: isExisting ? activeRequest[PICKUP_REQUEST_ID_FIELD] : "New",
    requestDate: isExisting
      ? (activeRequest[PICKUP_REQ_SUBMIT_DATE_FIELD] ?? submitDate)
      : submitDate,
  });
  if (submitBtn) submitBtn.hidden = isReadOnly;

  const defaultFrom = isExisting ? (activeRequest["From"] ?? "") : (pickupRequestDraftFrom || DEFAULT_WAREHOUSE_ENTITY);
  const buyer = isExisting ? (activeRequest["To"] ?? "") : (pickupRequestDraftTo || getPickupRequestBuyerForRows(pos));
  const buyerEmailInfo = getBuyerEmailInfo(buyer);

  body.innerHTML = "";
  const outer = document.createElement("div");
  outer.className = "shipment-modal-outer";

  const fromFields = createRequestLocationField("From", "From", "Pickup Address", defaultFrom, { readOnly: isReadOnly });
  const toFields = createRequestLocationField("To", "To", "Delivery Address", buyer, { readOnly: isReadOnly });
  if (isReadOnly) {
    fromFields.addressEl.value = activeRequest["Pickup Address"] ?? fromFields.addressEl.value;
    toFields.addressEl.value = activeRequest["Delivery Address"] ?? toFields.addressEl.value;
  }

  const metaRows = [
    createRequestFormMetaRow("Pickup Date", PICKUP_DATE_FIELD,
      isExisting ? (activeRequest[PICKUP_DATE_FIELD] ?? "") : (pickupRequestDraftPickupDate || ""),
      { type: "date", readOnly: isReadOnly }).tr,
    createRequestFormMetaRow("Request Date", PICKUP_REQ_SUBMIT_DATE_FIELD,
      isExisting ? (activeRequest[PICKUP_REQ_SUBMIT_DATE_FIELD] ?? submitDate) : submitDate,
      { type: "date", readOnly: true }).tr,
    fromFields.row,
    toFields.row,
    createRequestFormMetaRow("Email", "Email To",
      isExisting ? (activeRequest["Email To"] ?? "") : (pickupRequestDraftEmail.emailTo ?? buyerEmailInfo.email),
      { readOnly: isReadOnly }).tr,
    createRequestFormMetaRow("CC", "Email CC",
      isExisting ? (activeRequest["Email CC"] ?? "") : (pickupRequestDraftEmail.emailCc ?? buyerEmailInfo.cc),
      { readOnly: isReadOnly }).tr,
  ];

  outer.appendChild(buildShipmentModalSplitLayout(
    buildEmailStyleForm({
      formId: "pickupRequestForm",
      metaRows,
      notesField: PICKUP_REQ_NOTES_FIELD,
      notesValue: isExisting
        ? (activeRequest[PICKUP_REQ_NOTES_FIELD] ?? "")
        : pickupRequestDraftNotes,
      notesReadOnly: isReadOnly,
      requestForm: true,
    }),
    renderPickupRequestLinkedPoSection(pos, isReadOnly)
  ));

  if (!isReadOnly && pickupRequestAddPoPanelOpen) {
    appendAvailablePoPanelToModalRight(outer, renderAvailablePoLinkedSection(getAvailablePickupRequestPanelRows(), {
      sectionId: "pickupRequestAddPoPanel",
      columns: DELIVERY_PICKUP_LINKED_PO_COLUMNS,
      appendColgroup: appendDeliveryPickupLinkedPoColgroup,
      emptyMessage: "No eligible POs available.",
      selection: pickupRequestAvailablePoSelection,
      onSelectionChange: updatePickupRequestActionButtons,
      selectAllId: "pickupRequestAvailablePoSelectAll",
    }));
  }

  body.appendChild(outer);
  setPickupRequestModalAddPanelClass(body, pickupRequestAddPoPanelOpen);
  setRequestModalPoCount(document.getElementById("pickupRequestPoCount"), pos.length);

  const printBtn = document.getElementById("pickupRequestPrintBtn");
  if (printBtn) {
    const hasPacking = poNumbers.length > 0;
    printBtn.hidden = !hasPacking;
    printBtn.onclick = () => {
      if (typeof printPackingList === "function") {
        printPackingList({ poNumbers: poNumbers.slice(), mode: "group" });
      }
    };
  }

  bringModalToFront(document.getElementById("pickupRequestOverlay"));
  updatePickupRequestActionButtons();
  updateToolbarRequestButtons();
}

function getAvailablePickupRequestPanelRows() {
  const linked = new Set(pickupRequestPoNumbers.map(String));
  const buyer = pickupRequestDraftTo || getPickupRequestBuyerForRows(
    pickupRequestPoNumbers.map(po => allRows.find(r => String(r["PO #"]) === String(po))).filter(Boolean)
  );
  const buyerKey = String(buyer ?? "").trim().toUpperCase();
  return allRows.filter(row =>
    isPoEligibleForPickupRequest(row) &&
    String(row["Buyer"] ?? "").trim().toUpperCase() === buyerKey &&
    !linked.has(String(row["PO #"] ?? ""))
  );
}

function getPickupRequestModalContext() {
  return pickupRequestModalRow ?? {};
}

function openPickupRequestAddPoPanel() {
  capturePickupRequestDraft();
  clearPickupFormSelection();
  pickupRequestAvailablePoSelection.clear();
  pickupRequestAddPoPanelOpen = true;
  renderPickupRequestModal(pickupRequestPoNumbers, getPickupRequestModalContext());
}

function closePickupRequestAddPoPanel() {
  capturePickupRequestDraft();
  pickupRequestAvailablePoSelection.clear();
  pickupRequestAddPoPanelOpen = false;
  renderPickupRequestModal(pickupRequestPoNumbers, getPickupRequestModalContext());
}

function addSelectedPosToPickupRequest() {
  const selected = pickupRequestAvailablePoSelection.getAll();
  if (selected.length === 0) return;
  capturePickupRequestDraft();
  const existing = new Set(pickupRequestPoNumbers.map(String));
  const toAdd = selected.filter(po => !existing.has(po));
  if (toAdd.length === 0) return;
  pickupRequestAvailablePoSelection.clear();
  pickupRequestPoNumbers = [...pickupRequestPoNumbers, ...toAdd];
  pickupRequestAddPoPanelOpen = true;
  renderPickupRequestModal(pickupRequestPoNumbers, getPickupRequestModalContext());
}

function addPoToPickupRequest(poNumber) {
  capturePickupRequestDraft();
  const po = String(poNumber ?? "").trim();
  if (!po || pickupRequestPoNumbers.map(String).includes(po)) return;
  pickupRequestPoNumbers = [...pickupRequestPoNumbers, po];
  pickupRequestAddPoPanelOpen = true;
  renderPickupRequestModal(pickupRequestPoNumbers, getPickupRequestModalContext());
}

const _pickupFormSelectedPos = new Set();
function isPickupFormPoSelected(row) {
  return _pickupFormSelectedPos.has(String(row["PO #"] ?? ""));
}
function togglePickupFormPoSelected(row, selected) {
  const po = String(row["PO #"] ?? "");
  if (selected) _pickupFormSelectedPos.add(po);
  else _pickupFormSelectedPos.delete(po);
}
function clearPickupFormSelection() {
  _pickupFormSelectedPos.clear();
}

function removePosFromPickupRequest() {
  capturePickupRequestDraft();
  const linked = pickupRequestPoNumbers
    .map(po => allRows.find(r => String(r["PO #"]) === String(po)))
    .filter(row => row && isPickupFormPoSelected(row));
  if (linked.length === 0) { showIndicator("Select POs to remove", "error"); return; }
  const removeSet = new Set(linked.map(row => String(row["PO #"])));
  pickupRequestPoNumbers = pickupRequestPoNumbers.filter(po => !removeSet.has(String(po)));
  renderPickupRequestModal(pickupRequestPoNumbers, getPickupRequestModalContext());
}

function renderPickupRequestLinkedPoSection(pos, isReadOnly = false) {
  const section = document.createElement("section");
  section.className = "shipment-linked-pos";
  section.classList.toggle("shipment-linked-pos--selection-disabled", pickupRequestAddPoPanelOpen || isReadOnly);

  const wrap = document.createElement("div");
  wrap.className = "email-po-table-wrap";

  const table = document.createElement("table");
  table.className = "email-po-table shipment-linked-po-table request-linked-po-table";
  appendDeliveryPickupLinkedPoColgroup(table);

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const selectTh = document.createElement("th");
  selectTh.className = "th-select-col";

  if (!isReadOnly) {
    const selectAllCb = document.createElement("input");
    selectAllCb.type = "checkbox";
    selectAllCb.setAttribute("aria-label", "Select all");
    selectAllCb.disabled = pickupRequestAddPoPanelOpen;
    selectAllCb.addEventListener("change", () => {
      pos.forEach(row => togglePickupFormPoSelected(row, selectAllCb.checked));
      updatePickupRequestActionButtons();
    });
    selectTh.appendChild(selectAllCb);
  }

  headRow.appendChild(selectTh);
  DELIVERY_PICKUP_LINKED_PO_COLUMNS.forEach(({ label, cellClass }) => {
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
    attachRequestLinkedPoRowOpen(tr, row["PO #"]);
    const selectTd = document.createElement("td");
    if (!isReadOnly) {
      renderFormSelectedCell(selectTd, row, isPickupFormPoSelected(row), selected => {
        togglePickupFormPoSelected(row, selected);
        updatePickupRequestActionButtons();
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
  if (pos.length > 0) {
    appendEmailPoTableFooter(table, pos, DELIVERY_PICKUP_LINKED_PO_COLUMNS, { hasSelectCol: true });
  }
  wrap.appendChild(table);
  section.appendChild(wrap);
  return section;
}

function updatePickupRequestActionButtons() {
  const overlay = document.getElementById("pickupRequestOverlay");
  if (!overlay?.classList.contains("open")) return;
  const addBtn = document.getElementById("pickupRequestAddPosBtn");
  const removeBtn = document.getElementById("pickupRequestRemovePosBtn");
  const doneBtn = document.getElementById("pickupRequestAddPoDoneBtn");
  const addSelectedBtn = document.getElementById("pickupRequestAddSelectedPosBtn");
  const submitBtn = document.getElementById("pickupRequestSubmitBtn");

  const isView = submitBtn?.hidden === true;
  if (isView) {
    if (addBtn) addBtn.hidden = true;
    if (removeBtn) removeBtn.hidden = true;
    if (doneBtn) doneBtn.hidden = true;
    if (addSelectedBtn) addSelectedBtn.hidden = true;
    return;
  }

  if (pickupRequestAddPoPanelOpen) {
    if (addBtn) addBtn.hidden = true;
    if (removeBtn) removeBtn.hidden = true;
    if (doneBtn) doneBtn.hidden = false;
    if (addSelectedBtn) addSelectedBtn.hidden = pickupRequestAvailablePoSelection.size === 0;
    return;
  }

  if (doneBtn) doneBtn.hidden = true;
  if (addSelectedBtn) addSelectedBtn.hidden = true;

  const anySelected = pickupRequestPoNumbers
    .map(po => allRows.find(r => String(r["PO #"]) === String(po)))
    .some(row => row && isPickupFormPoSelected(row));
  if (addBtn) addBtn.hidden = anySelected;
  if (removeBtn) removeBtn.hidden = !anySelected;
}

function closePickupRequestModal() {
  pickupRequestPoNumbers = [];
  pickupRequestModalRow = null;
  pickupRequestAddPoPanelOpen = false;
  pickupRequestDraftEmail = {};
  pickupRequestDraftPickupDate = "";
  pickupRequestDraftFrom = "";
  pickupRequestDraftTo = "";
  pickupRequestDraftNotes = "";
  clearPickupFormSelection();
  clearModalFooterMessageForOverlay("pickupRequestOverlay");
  document.getElementById("pickupRequestOverlay")?.classList.remove("open");
  setPickupRequestModalAddPanelClass(document.getElementById("pickupRequestBody"), false);
  const printBtn = document.getElementById("pickupRequestPrintBtn");
  if (printBtn) printBtn.hidden = true;
  updateToolbarRequestButtons();
}

async function submitPickupRequest() {
  if (pickupRequestOpInProgress || pickupRequestPoNumbers.length === 0) return;
  setPickupRequestFooterMessage("");

  const form = document.getElementById("pickupRequestForm");
  const data = readRequestForm(form);
  if (isEmptyValue(data[PICKUP_DATE_FIELD])) {
    setPickupRequestFooterMessage("Pickup Date is required");
    return;
  }
  if (isEmptyValue(data["Email To"])) {
    setPickupRequestFooterMessage("Email is required to send the pickup request");
    return;
  }

  const poNumbers = pickupRequestPoNumbers.slice();
  const savedRow = pickupRequestModalRow;
  const isEdit = Boolean(savedRow?.[PICKUP_REQUEST_ID_FIELD]);
  if (!isEdit) beginToolbarCreatePending();
  closePickupRequestModal();
  pickupRequestOpInProgress = true;
  showIndicator(
    isEdit ? `Saving${ELLIPSIS}` : `Creating pickup request${ELLIPSIS}`,
    ""
  );

  try {
    if (isDemoMode()) {
      if (isEdit) {
        applyPickupRequestUpdatedLocally(savedRow[PICKUP_REQUEST_ID_FIELD], data);
      } else {
        applyPickupRequestCreatedLocally(generateDemoPickupRequestId(), poNumbers, data);
      }
    } else {
      const json = await postAppsScript(
        isEdit
          ? { action: "updatePickupRequest", pickupRequestId: savedRow[PICKUP_REQUEST_ID_FIELD], request: data }
          : { action: "createPickupRequest", poNumbers, request: data }
      );
      if (!json.success) throw new Error(json.error || "Pickup request failed");
      if (isEdit) {
        applyPickupRequestUpdatedLocally(savedRow[PICKUP_REQUEST_ID_FIELD], data);
      } else {
        applyPickupRequestCreatedLocally(json.pickupRequestId, poNumbers, data);
      }
    }
    showIndicator(
      isEdit ? `Saved ${CHECK_MARK}` : `Pickup request created and email sent ${CHECK_MARK}`,
      "success"
    );
  } catch (err) {
    showIndicator("Pickup request failed: " + err.message, "error");
  } finally {
    pickupRequestOpInProgress = false;
    if (!isEdit) endToolbarCreatePending();
  }
}

function generateDemoPickupRequestId() {
  let max = 0;
  allPickupRequests.forEach(r => {
    const m = /^PR-(\d+)$/.exec(String(r[PICKUP_REQUEST_ID_FIELD] ?? ""));
    if (m) max = Math.max(max, Number(m[1]));
  });
  return `PR-${String(max + 1).padStart(4, "0")}`;
}

function applyPickupRequestCreatedLocally(requestId, poNumbers, data) {
  const now = formatDateToYmd(new Date());
  allPickupRequests.push({
    [PICKUP_REQUEST_ID_FIELD]: requestId,
    [PICKUP_DATE_FIELD]: data[PICKUP_DATE_FIELD] ?? "",
    "Request Date": data[PICKUP_REQ_SUBMIT_DATE_FIELD] ?? now,
    "From": data["From"] ?? "",
    "Pickup Address": data["Pickup Address"] ?? "",
    "To": data["To"] ?? "",
    "Delivery Address": data["Delivery Address"] ?? "",
    "Email To": data["Email To"] ?? "",
    "Email CC": data["Email CC"] ?? "",
    [PICKUP_REQ_NOTES_FIELD]: data[PICKUP_REQ_NOTES_FIELD] ?? "",
    "PO Numbers": poNumbers.join(", "),
    "PO Count": poNumbers.length,
    "Email Status": !isEmptyValue(data["Email To"]) ? "Sent" : "Not Sent",
    "Email Sent At": !isEmptyValue(data["Email To"]) ? now : "",
    "Email Error": "",
    "Created At": now,
    "Updated At": now,
  });

  poNumbers.forEach(poNumber => {
    const row = allRows.find(r => String(r["PO #"]) === String(poNumber));
    if (!row) return;
    row[PICKUP_REQUEST_ID_FIELD] = requestId;
    row["Pickup Requested"] = true;
    row["Pickup Date"] = data[PICKUP_DATE_FIELD] ?? "";
    row["Pickup Req Date"] = data[PICKUP_REQ_SUBMIT_DATE_FIELD] ?? now;
    row["Assign Date"] = data[PICKUP_DATE_FIELD] ?? "";
    if (String(row["Division"] ?? "").trim() === "Freesia") {
      row["Status"] = "Assigned";
    }
  });
  resetLocalSelectedState(allRows);
  applyFilters();
  applyPickupRequestFilters();
  if (typeof updateToolbarRequestButtons === "function") updateToolbarRequestButtons();
}

function applyPickupRequestUpdatedLocally(requestId, data) {
  const existing = getPickupRequestById(requestId);
  if (existing) Object.assign(existing, data);
  applyPickupRequestFilters();
}

function demoCreateOrUpdatePickupRequest(poNumbers, data, existing) {
  if (existing?.[PICKUP_REQUEST_ID_FIELD]) {
    applyPickupRequestUpdatedLocally(existing[PICKUP_REQUEST_ID_FIELD], data);
  } else {
    applyPickupRequestCreatedLocally(generateDemoPickupRequestId(), poNumbers, data);
  }
}

function renderAssignDateCell(td, row) {
  const pickupId = String(row[PICKUP_REQUEST_ID_FIELD] ?? "").trim();
  const dateVal = getPickupRequestDateForRow(row);

  if (pickupId) {
    td.className = "readonly readonly-no-select";
    if (isEmptyValue(dateVal)) {
      setDisplayText(td, EMPTY_DISPLAY);
      return;
    }
    const link = document.createElement("button");
    link.type = "button";
    link.className = "shipment-id-link pickup-request-date-link";
    link.textContent = formatDateForDisplay(dateVal);
    link.title = "Open pickup request";
    link.addEventListener("click", e => {
      e.stopPropagation();
      openPickupRequestDetail(pickupId);
    });
    td.appendChild(link);
    return;
  }

  if (isPoFieldEditable("Assign Date", row)) {
    td.className = "editable";
    td.title = "Click to edit";
    bindEditableCell(td, "Assign Date", row);
    applyDateCellDisplay(td, "Assign Date", row, { context: "table" });
    wrapEditablePreview(td);
    return;
  }

  td.className = "readonly readonly-no-select";
  applyDateCellDisplay(td, "Assign Date", { ...row, "Assign Date": dateVal }, { context: "table" });
}

function syncAssignDateFromPickupRequest(row) {
  if (!row) return row;
  const id = String(row[PICKUP_REQUEST_ID_FIELD] ?? "").trim();
  if (!id) return row;
  const date = getPickupRequestDateForRow(row);
  if (date) row["Assign Date"] = date;
  return row;
}

function syncAllAssignDatesFromPickupRequests(rows) {
  rows.forEach(syncAssignDateFromPickupRequest);
}

function initPickupRequests() {
  document.getElementById("pickupRequestBtn")?.addEventListener("click", openPickupRequestFromSelection);
  document.getElementById("pickupRequestSubmitBtn")?.addEventListener("click", submitPickupRequest);
  document.getElementById("pickupRequestAddPosBtn")?.addEventListener("click", openPickupRequestAddPoPanel);
  document.getElementById("pickupRequestRemovePosBtn")?.addEventListener("click", removePosFromPickupRequest);
  document.getElementById("pickupRequestAddPoDoneBtn")?.addEventListener("click", closePickupRequestAddPoPanel);
  document.getElementById("pickupRequestAddSelectedPosBtn")?.addEventListener("click", addSelectedPosToPickupRequest);
  document.getElementById("pickupRequestCancelBtn")?.addEventListener("click", closePickupRequestModal);
  document.querySelector('[data-dismiss="pickup-request"]')?.addEventListener("click", closePickupRequestModal);
  bindDirectBackdropDismiss(document.getElementById("pickupRequestOverlay"), closePickupRequestModal);
  document.getElementById("pickupRequestSearchInput")?.addEventListener("input", applyPickupRequestFilters);
}

initPickupRequests();
