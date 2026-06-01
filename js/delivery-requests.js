/** Delivery Request records and modals. */

const DELIVERY_DATE_FIELD = "Delivery Date";
const DELIVERY_REQ_NOTES_FIELD = "Delivery Req Notes";
const DELIVERY_REQ_SUBMIT_DATE_FIELD = "Request Date";

const DELIVERY_REQUEST_TABLE_COLUMNS = [
  DELIVERY_REQUEST_ID_FIELD,
  DELIVERY_DATE_FIELD,
  DELIVERY_REQ_SUBMIT_DATE_FIELD,
  "From",
  "To",
  "Email To",
  "Email CC",
  DELIVERY_REQ_NOTES_FIELD,
  "PO Count",
  "Email Status",
  "Email Sent At",
  "Email Error",
  "Action",
];

let allDeliveryRequests = [];
let filteredDeliveryRequests = [];
let deliveryRequestPoNumbers = [];
let deliveryRequestAddPoPanelOpen = false;
let deliveryRequestDraftEmail = {};
let deliveryRequestDraftDeliveryDate = "";
let deliveryRequestDraftFrom = "";
let deliveryRequestDraftTo = "";
let deliveryRequestDraftNotes = "";
let deliveryRequestModalRow = null;
let deliveryRequestOpInProgress = false;

function normalizeDeliveryRequest(row) {
  return { ...row };
}

function onDeliveryPickupDataLoaded(deliveryRequests, pickupRequests) {
  allDeliveryRequests = (deliveryRequests ?? []).map(normalizeDeliveryRequest);
  filteredDeliveryRequests = allDeliveryRequests.slice();
  if (typeof onPickupRequestsDataLoaded === "function") {
    onPickupRequestsDataLoaded(pickupRequests);
  }
  applyDeliveryRequestFilters();
}

function getDeliveryRequestById(id) {
  const key = String(id ?? "").trim();
  if (!key) return null;
  return allDeliveryRequests.find(r => String(r[DELIVERY_REQUEST_ID_FIELD] ?? "").trim() === key) ?? null;
}

function applyDeliveryRequestFilters() {
  const q = (document.getElementById("deliveryRequestSearchInput")?.value ?? "").toLowerCase();
  filteredDeliveryRequests = allDeliveryRequests.filter(request => {
    if (!q) return true;
    return DELIVERY_REQUEST_TABLE_COLUMNS
      .filter(col => col !== "Action")
      .map(col => String(request[col] ?? ""))
      .join(" ")
      .toLowerCase()
      .includes(q);
  });
  filteredDeliveryRequests.sort((a, b) =>
    normalizeToYmd(b[DELIVERY_REQ_SUBMIT_DATE_FIELD] || b["Created At"])
      .localeCompare(normalizeToYmd(a[DELIVERY_REQ_SUBMIT_DATE_FIELD] || a["Created At"]))
  );
  renderDeliveryRequestTable();
  updateDeliveryRequestRowCounter();
}

function updateDeliveryRequestRowCounter() {
  if (typeof updateRequestsRowCounter === "function") updateRequestsRowCounter();
}

function formatDeliveryRequestTableCell(col, request) {
  const val = request[col] ?? "";
  if ([DELIVERY_DATE_FIELD, DELIVERY_REQ_SUBMIT_DATE_FIELD, "Email Sent At", "Created At", "Updated At"].includes(col)) {
    return formatDateForDisplay(val);
  }
  if (col === DELIVERY_REQ_NOTES_FIELD) return isEmptyValue(val) ? EMPTY_DISPLAY : String(val);
  if (isEmptyValue(val)) return EMPTY_DISPLAY;
  return String(val);
}

function renderDeliveryRequestEmailStatusCell(td, request) {
  const status = String(request["Email Status"] ?? "").trim();
  td.className = "readonly readonly-no-select delivery-request-email-status-cell";
  td.dataset.status = status.toLowerCase();
  if (isEmptyValue(status)) setDisplayText(td, EMPTY_DISPLAY);
  else td.textContent = status;
}

function renderDeliveryRequestActionCell(td, request) {
  const requestId = String(request[DELIVERY_REQUEST_ID_FIELD] ?? "").trim();
  td.className = "readonly readonly-no-select delivery-request-action-cell";
  const resendBtn = document.createElement("button");
  resendBtn.type = "button";
  resendBtn.className = "btn btn-secondary delivery-request-resend-btn";
  resendBtn.textContent = "Resend";
  resendBtn.disabled = !requestId || isAppSaving();
  resendBtn.addEventListener("click", e => {
    e.stopPropagation();
    resendDeliveryRequestEmail(requestId);
  });
  td.appendChild(resendBtn);
}

function renderDeliveryRequestTable() {
  const tbody = document.getElementById("deliveryRequestTableBody");
  if (!tbody) return;
  if (filteredDeliveryRequests.length === 0) {
    tbody.innerHTML = `<tr class="state-row"><td colspan="${DELIVERY_REQUEST_TABLE_COLUMNS.length}">No delivery requests yet.</td></tr>`;
    updateDeliveryRequestRowCounter();
    return;
  }
  tbody.innerHTML = "";
  filteredDeliveryRequests.forEach(request => {
    const tr = document.createElement("tr");
    tr.dataset.deliveryRequestId = String(request[DELIVERY_REQUEST_ID_FIELD] ?? "").trim();
    DELIVERY_REQUEST_TABLE_COLUMNS.forEach(col => {
      const td = document.createElement("td");
      td.dataset.col = col;
      if (col === "Action") renderDeliveryRequestActionCell(td, request);
      else if (col === "Email Status") renderDeliveryRequestEmailStatusCell(td, request);
      else {
        const text = formatDeliveryRequestTableCell(col, request);
        if (text === EMPTY_DISPLAY) setDisplayText(td, EMPTY_DISPLAY);
        else { td.textContent = text; td.title = text; }
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
    attachRequestTableRowDblClick(tr, () => {
      const id = String(request[DELIVERY_REQUEST_ID_FIELD] ?? "").trim();
      if (id) openDeliveryRequestDetail(id);
    });
  });
  updateDeliveryRequestRowCounter();
}

async function resendDeliveryRequestEmail(requestId) {
  if (deliveryRequestOpInProgress || !requestId) return;
  deliveryRequestOpInProgress = true;
  showIndicator(`Resending delivery email${ELLIPSIS}`, "");
  try {
    if (isDemoMode()) {
      const request = allDeliveryRequests.find(r => String(r[DELIVERY_REQUEST_ID_FIELD] ?? "").trim() === requestId);
      if (request) {
        request["Email Status"] = "Sent";
        request["Email Error"] = "";
        request["Email Sent At"] = formatDateToYmd(new Date());
      }
      applyDeliveryRequestFilters();
    } else {
      const json = await postAppsScript({ action: "resendDeliveryRequestEmail", deliveryRequestId: requestId });
      if (!json.success) throw new Error(json.error);
      const request = allDeliveryRequests.find(r => String(r[DELIVERY_REQUEST_ID_FIELD] ?? "").trim() === requestId);
      if (request) {
        request["Email Status"] = json.emailSent ? "Sent" : "Failed";
        request["Email Error"] = json.emailError ?? "";
        if (json.emailSent) request["Email Sent At"] = formatDateToYmd(new Date());
        applyDeliveryRequestFilters();
      }
      if (!json.emailSent) {
        showIndicator(`Delivery email not sent: ${json.emailError || "Missing email"}`, "error");
        return;
      }
    }
    showIndicator(`Delivery email sent ${CHECK_MARK}`, "success");
  } catch (err) {
    showIndicator("Resend failed: " + err.message, "error");
  } finally {
    deliveryRequestOpInProgress = false;
  }
}

function updateDeliveryRequestButton() {
  const btn = document.getElementById("deliveryRequestBtn");
  if (!btn) return;
  const selected = getCheckedFilteredPos();
  btn.hidden = currentAppView !== "po" ||
    !areRowsEligibleForDeliveryRequest(selected);
}

function renderDeliveryRequestIdCell(td, row) {
  td.className = "readonly readonly-no-select td-shipment-id-cell";
  const id = String(row[DELIVERY_REQUEST_ID_FIELD] ?? "").trim();
  if (!id) { setDisplayText(td, EMPTY_DISPLAY); return; }
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "shipment-id-link";
  btn.textContent = id;
  btn.title = "Open delivery request";
  btn.addEventListener("click", e => {
    e.stopPropagation();
    openDeliveryRequestDetail(id);
  });
  td.appendChild(btn);
}

function setDeliveryRequestFooterMessage(message = "") {
  const overlay = document.getElementById("deliveryRequestOverlay");
  if (!overlay) return;
  clearModalFooterMessageForOverlay(overlay);
  if (message) setModalFooterMessage(message, "error", { persist: true, overlay });
}

function openDeliveryRequestFromSelection() {
  if (isAppSaving() || isToolbarCreateActionBlocked()) return;
  const selected = getCheckedFilteredPos();
  if (!areRowsEligibleForDeliveryRequest(selected)) {
    showIndicator("Select Elevator Disco OTW or Arrived at Port POs with packing lists", "error");
    return;
  }
  deliveryRequestPoNumbers = selected.map(row => row["PO #"]);
  deliveryRequestModalRow = null;
  deliveryRequestAddPoPanelOpen = false;
  deliveryRequestDraftEmail = {};
  deliveryRequestDraftDeliveryDate = "";
  deliveryRequestDraftFrom = DEFAULT_WAREHOUSE_ENTITY;
  deliveryRequestDraftTo = DEFAULT_DELIVERY_TO_ENTITY;
  deliveryRequestDraftNotes = "";
  clearMainTableSelection();
  renderDeliveryRequestModal(deliveryRequestPoNumbers);
}

function openDeliveryRequestDetail(id) {
  if (isAppSaving()) return;
  const request = getDeliveryRequestById(id);
  if (!request) return;
  deliveryRequestModalRow = request;
  deliveryRequestPoNumbers = getRequestPoNumbers(request, DELIVERY_REQUEST_ID_FIELD);
  deliveryRequestAddPoPanelOpen = false;
  renderDeliveryRequestModal(deliveryRequestPoNumbers, request);
}

function captureDeliveryRequestDraft() {
  const form = document.getElementById("deliveryRequestForm");
  if (!form) return;
  const formData = readRequestForm(form);
  deliveryRequestDraftEmail = {
    emailTo: formData["Email To"] ?? deliveryRequestDraftEmail.emailTo ?? "",
    emailCc: formData["Email CC"] ?? deliveryRequestDraftEmail.emailCc ?? "",
  };
  deliveryRequestDraftDeliveryDate = formData[DELIVERY_DATE_FIELD] ?? deliveryRequestDraftDeliveryDate ?? "";
  deliveryRequestDraftFrom = formData["From"] ?? deliveryRequestDraftFrom ?? "";
  deliveryRequestDraftTo = formData["To"] ?? deliveryRequestDraftTo ?? "";
  deliveryRequestDraftNotes = formData[DELIVERY_REQ_NOTES_FIELD] ?? deliveryRequestDraftNotes ?? "";
}

function setDeliveryRequestModalAddPanelClass(body, isOpen) {
  body?.closest(".shipment-modal-card")?.classList.toggle("shipment-modal-card--add-panel-open", isOpen);
}

function renderDeliveryRequestModal(poNumbers, request = {}) {
  const body = document.getElementById("deliveryRequestBody");
  const titleEl = document.getElementById("deliveryRequestModalTitle");
  const submitBtn = document.getElementById("deliveryRequestSubmitBtn");
  if (!body) return;

  const pos = poNumbers
    .map(po => allRows.find(r => String(r["PO #"]) === String(po)))
    .filter(Boolean);

  const activeRequest = request[DELIVERY_REQUEST_ID_FIELD] ? request : (deliveryRequestModalRow ?? request);
  const isExisting = Boolean(activeRequest[DELIVERY_REQUEST_ID_FIELD]);
  const isReadOnly = isExisting && isRequestEmailSent(activeRequest);
  if (titleEl) {
    titleEl.textContent = isExisting
      ? `Delivery Request ${activeRequest[DELIVERY_REQUEST_ID_FIELD]}`
      : "Delivery Request";
  }
  if (submitBtn) submitBtn.hidden = isReadOnly;

  const submitDate = formatDateToYmd(new Date());
  const defaultFrom = isExisting ? (activeRequest["From"] ?? "") : (deliveryRequestDraftFrom || DEFAULT_WAREHOUSE_ENTITY);
  const defaultTo = isExisting ? (activeRequest["To"] ?? "") : (deliveryRequestDraftTo || DEFAULT_DELIVERY_TO_ENTITY);

  body.innerHTML = "";
  const outer = document.createElement("div");
  outer.className = "shipment-modal-outer";

  const layout = document.createElement("div");
  layout.className = "shipment-modal-layout";

  const left = document.createElement("div");
  left.className = "shipment-modal-left";
  const form = document.createElement("div");
  form.className = "shipment-form-edit";
  form.id = "deliveryRequestForm";

  form.appendChild(createRequestFormField("Delivery Date", DELIVERY_DATE_FIELD,
    isExisting ? (activeRequest[DELIVERY_DATE_FIELD] ?? "") : (deliveryRequestDraftDeliveryDate || ""),
    { type: "date", readOnly: isReadOnly }));
  form.appendChild(createRequestFormField("Request Date", DELIVERY_REQ_SUBMIT_DATE_FIELD,
    isExisting ? (activeRequest[DELIVERY_REQ_SUBMIT_DATE_FIELD] ?? submitDate) : submitDate,
    { type: "date", readOnly: true }));

  const fromFields = createRequestLocationField("From", "From", "Pickup Address", defaultFrom, { readOnly: isReadOnly });
  form.appendChild(fromFields.frag);

  const toFields = createRequestLocationField("To", "To", "Delivery Address", defaultTo, { readOnly: isReadOnly });
  form.appendChild(toFields.frag);
  if (isReadOnly) {
    fromFields.addressEl.value = activeRequest["Pickup Address"] ?? fromFields.addressEl.value;
    toFields.addressEl.value = activeRequest["Delivery Address"] ?? toFields.addressEl.value;
  }

  form.appendChild(createRequestFormField("Email", "Email To",
    isExisting ? (activeRequest["Email To"] ?? "") : (deliveryRequestDraftEmail.emailTo ?? ""),
    { readOnly: isReadOnly }));
  form.appendChild(createRequestFormField("CC", "Email CC",
    isExisting ? (activeRequest["Email CC"] ?? "") : (deliveryRequestDraftEmail.emailCc ?? ""),
    { readOnly: isReadOnly }));
  form.appendChild(createRequestFormField("Notes", DELIVERY_REQ_NOTES_FIELD,
    isExisting ? (activeRequest[DELIVERY_REQ_NOTES_FIELD] ?? activeRequest["Notes"] ?? "") : deliveryRequestDraftNotes,
    { type: "textarea", readOnly: isReadOnly }));

  left.appendChild(form);

  const right = document.createElement("div");
  right.className = "shipment-modal-right";
  right.appendChild(renderDeliveryRequestLinkedPoSection(pos, isReadOnly));

  layout.appendChild(left);
  layout.appendChild(right);
  outer.appendChild(layout);

  if (!isReadOnly && deliveryRequestAddPoPanelOpen) {
    outer.classList.add("shipment-modal-outer--add-panel-open");
    outer.appendChild(renderAvailablePoPickerPanel(getAvailableDeliveryRequestPanelRows(), {
      panelId: "deliveryRequestAddPoPanel",
      emptyMessage: "No eligible POs available.",
      closeLabel: "Close available POs panel",
      onClose: closeDeliveryRequestAddPoPanel,
      onAddPo: addPoToDeliveryRequest,
    }));
  }

  body.appendChild(outer);
  setDeliveryRequestModalAddPanelClass(body, deliveryRequestAddPoPanelOpen);
  setRequestModalPoCount(document.getElementById("deliveryRequestPoCount"), pos.length);
  bringModalToFront(document.getElementById("deliveryRequestOverlay"));
  updateToolbarRequestButtons();
}

function getAvailableDeliveryRequestPanelRows() {
  const linked = new Set(deliveryRequestPoNumbers.map(String));
  return allRows.filter(row =>
    isPoEligibleForDeliveryRequest(row) &&
    !linked.has(String(row["PO #"] ?? ""))
  );
}

function getDeliveryRequestModalContext() {
  return deliveryRequestModalRow ?? {};
}

function openDeliveryRequestAddPoPanel() {
  captureDeliveryRequestDraft();
  deliveryRequestAddPoPanelOpen = true;
  renderDeliveryRequestModal(deliveryRequestPoNumbers, getDeliveryRequestModalContext());
}

function closeDeliveryRequestAddPoPanel() {
  captureDeliveryRequestDraft();
  deliveryRequestAddPoPanelOpen = false;
  renderDeliveryRequestModal(deliveryRequestPoNumbers, getDeliveryRequestModalContext());
}

function addPoToDeliveryRequest(poNumber) {
  captureDeliveryRequestDraft();
  const po = String(poNumber ?? "").trim();
  if (!po || deliveryRequestPoNumbers.map(String).includes(po)) return;
  deliveryRequestPoNumbers = [...deliveryRequestPoNumbers, po];
  deliveryRequestAddPoPanelOpen = true;
  renderDeliveryRequestModal(deliveryRequestPoNumbers, getDeliveryRequestModalContext());
}

const _deliveryFormSelectedPos = new Set();
function isDeliveryFormPoSelected(row) {
  return _deliveryFormSelectedPos.has(String(row["PO #"] ?? ""));
}
function toggleDeliveryFormPoSelected(row, selected) {
  const po = String(row["PO #"] ?? "");
  if (selected) _deliveryFormSelectedPos.add(po);
  else _deliveryFormSelectedPos.delete(po);
}
function clearDeliveryFormSelection() {
  _deliveryFormSelectedPos.clear();
}

function removePosFromDeliveryRequest() {
  captureDeliveryRequestDraft();
  const linked = deliveryRequestPoNumbers
    .map(po => allRows.find(r => String(r["PO #"]) === String(po)))
    .filter(row => row && isDeliveryFormPoSelected(row));
  if (linked.length === 0) { showIndicator("Select POs to remove", "error"); return; }
  const removeSet = new Set(linked.map(row => String(row["PO #"])));
  deliveryRequestPoNumbers = deliveryRequestPoNumbers.filter(po => !removeSet.has(String(po)));
  renderDeliveryRequestModal(deliveryRequestPoNumbers, getDeliveryRequestModalContext());
}

function renderDeliveryRequestLinkedPoSection(pos, isReadOnly = false) {
  const section = document.createElement("section");
  section.className = "shipment-linked-pos";
  section.classList.toggle("shipment-linked-pos--selection-disabled", deliveryRequestAddPoPanelOpen || isReadOnly);

  const wrap = document.createElement("div");
  wrap.className = "shipment-linked-po-table-wrap shipment-linked-po-table-wrap--with-footer";

  const table = document.createElement("table");
  table.className = "shipment-linked-po-table request-linked-po-table";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const selectTh = document.createElement("th");
  selectTh.className = "th-select-col";

  if (!isReadOnly) {
    const selectAllCb = document.createElement("input");
    selectAllCb.type = "checkbox";
    selectAllCb.setAttribute("aria-label", "Select all");
    selectAllCb.disabled = deliveryRequestAddPoPanelOpen;
    selectAllCb.addEventListener("change", () => {
      pos.forEach(row => toggleDeliveryFormPoSelected(row, selectAllCb.checked));
      updateDeliveryRequestActionButtons();
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
      renderFormSelectedCell(selectTd, row, isDeliveryFormPoSelected(row), selected => {
        toggleDeliveryFormPoSelected(row, selected);
        updateDeliveryRequestActionButtons();
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
  if (!isReadOnly) section.appendChild(renderDeliveryRequestLinkedPoFooter(pos));
  return section;
}

function renderDeliveryRequestLinkedPoFooter(pos) {
  const footer = document.createElement("footer");
  footer.className = "shipment-linked-po-footer";
  const actions = document.createElement("div");
  actions.className = "shipment-linked-po-footer-actions";

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "btn shipment-linked-po-footer-btn delivery-request-linked-po-footer-add";
  addBtn.textContent = "Add POs";
  addBtn.addEventListener("click", openDeliveryRequestAddPoPanel);

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn shipment-linked-po-footer-btn delivery-request-linked-po-footer-remove";
  removeBtn.textContent = "Remove POs";
  removeBtn.hidden = true;
  removeBtn.addEventListener("click", removePosFromDeliveryRequest);

  actions.appendChild(addBtn);
  actions.appendChild(removeBtn);
  footer.appendChild(actions);

  footer.appendChild(renderRequestLinkedPoFooterTotals(pos));
  return footer;
}

function updateDeliveryRequestActionButtons() {
  const overlay = document.getElementById("deliveryRequestOverlay");
  if (!overlay?.classList.contains("open")) return;
  const addBtn = overlay.querySelector(".delivery-request-linked-po-footer-add");
  const removeBtn = overlay.querySelector(".delivery-request-linked-po-footer-remove");
  if (!addBtn && !removeBtn) return;
  const anySelected = deliveryRequestPoNumbers
    .map(po => allRows.find(r => String(r["PO #"]) === String(po)))
    .some(row => row && isDeliveryFormPoSelected(row));
  if (addBtn) addBtn.hidden = deliveryRequestAddPoPanelOpen || anySelected;
  if (removeBtn) removeBtn.hidden = deliveryRequestAddPoPanelOpen || !anySelected;
}

function closeDeliveryRequestModal() {
  deliveryRequestPoNumbers = [];
  deliveryRequestModalRow = null;
  deliveryRequestAddPoPanelOpen = false;
  deliveryRequestDraftEmail = {};
  deliveryRequestDraftDeliveryDate = "";
  deliveryRequestDraftFrom = "";
  deliveryRequestDraftTo = "";
  deliveryRequestDraftNotes = "";
  clearDeliveryFormSelection();
  clearModalFooterMessageForOverlay("deliveryRequestOverlay");
  document.getElementById("deliveryRequestOverlay")?.classList.remove("open");
  setDeliveryRequestModalAddPanelClass(document.getElementById("deliveryRequestBody"), false);
  updateToolbarRequestButtons();
}

async function submitDeliveryRequest() {
  if (deliveryRequestOpInProgress || deliveryRequestPoNumbers.length === 0) return;
  setDeliveryRequestFooterMessage("");

  const form = document.getElementById("deliveryRequestForm");
  const data = readRequestForm(form);
  if (isEmptyValue(data[DELIVERY_DATE_FIELD])) {
    setDeliveryRequestFooterMessage("Delivery Date is required");
    return;
  }
  if (isEmptyValue(data["Email To"])) {
    setDeliveryRequestFooterMessage("Email is required to send the delivery request");
    return;
  }

  const poNumbers = deliveryRequestPoNumbers.slice();
  const savedRow = deliveryRequestModalRow;
  const isEdit = Boolean(savedRow?.[DELIVERY_REQUEST_ID_FIELD]);
  if (!isEdit) beginToolbarCreatePending();
  closeDeliveryRequestModal();
  deliveryRequestOpInProgress = true;
  showIndicator(
    isEdit ? `Saving${ELLIPSIS}` : `Creating delivery request${ELLIPSIS}`,
    ""
  );

  try {
    if (isDemoMode()) {
      if (isEdit) {
        applyDeliveryRequestUpdatedLocally(savedRow[DELIVERY_REQUEST_ID_FIELD], data);
      } else {
        applyDeliveryRequestCreatedLocally(generateDemoDeliveryRequestId(), poNumbers, data);
      }
    } else {
      const json = await postAppsScript(
        isEdit
          ? { action: "updateDeliveryRequest", deliveryRequestId: savedRow[DELIVERY_REQUEST_ID_FIELD], request: data }
          : { action: "createDeliveryRequest", poNumbers, request: data }
      );
      if (!json.success) throw new Error(json.error || "Delivery request failed");
      if (isEdit) {
        applyDeliveryRequestUpdatedLocally(savedRow[DELIVERY_REQUEST_ID_FIELD], data);
      } else {
        applyDeliveryRequestCreatedLocally(json.deliveryRequestId, poNumbers, data);
      }
    }
    showIndicator(
      isEdit ? `Saved ${CHECK_MARK}` : `Delivery request created and email sent ${CHECK_MARK}`,
      "success"
    );
  } catch (err) {
    showIndicator("Delivery request failed: " + err.message, "error");
  } finally {
    deliveryRequestOpInProgress = false;
    if (!isEdit) endToolbarCreatePending();
  }
}

function generateDemoDeliveryRequestId() {
  let max = 0;
  allDeliveryRequests.forEach(r => {
    const m = /^DR-(\d+)$/.exec(String(r[DELIVERY_REQUEST_ID_FIELD] ?? ""));
    if (m) max = Math.max(max, Number(m[1]));
  });
  return `DR-${String(max + 1).padStart(4, "0")}`;
}

function applyDeliveryRequestCreatedLocally(requestId, poNumbers, data) {
  const now = formatDateToYmd(new Date());
  allDeliveryRequests.push({
    [DELIVERY_REQUEST_ID_FIELD]: requestId,
    [DELIVERY_DATE_FIELD]: data[DELIVERY_DATE_FIELD] ?? "",
    "Request Date": data[DELIVERY_REQ_SUBMIT_DATE_FIELD] ?? now,
    "From": data["From"] ?? "",
    "Pickup Address": data["Pickup Address"] ?? "",
    "To": data["To"] ?? "",
    "Delivery Address": data["Delivery Address"] ?? "",
    "Email To": data["Email To"] ?? "",
    "Email CC": data["Email CC"] ?? "",
    [DELIVERY_REQ_NOTES_FIELD]: data[DELIVERY_REQ_NOTES_FIELD] ?? "",
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
    row[DELIVERY_REQUEST_ID_FIELD] = requestId;
    row["Delivery Requested"] = true;
    row["Delivery Date"] = data[DELIVERY_DATE_FIELD] ?? "";
    row["Delivery Req Date"] = data[DELIVERY_REQ_SUBMIT_DATE_FIELD] ?? now;
    row["Status"] = "Scheduled";
  });
  resetLocalSelectedState(allRows);
  applyFilters();
  applyDeliveryRequestFilters();
  if (typeof updateToolbarRequestButtons === "function") updateToolbarRequestButtons();
}

function applyDeliveryRequestUpdatedLocally(requestId, data) {
  const existing = getDeliveryRequestById(requestId);
  if (existing) Object.assign(existing, data);
  applyDeliveryRequestFilters();
}

function demoCreateOrUpdateDeliveryRequest(poNumbers, data, existing) {
  if (existing?.[DELIVERY_REQUEST_ID_FIELD]) {
    applyDeliveryRequestUpdatedLocally(existing[DELIVERY_REQUEST_ID_FIELD], data);
  } else {
    applyDeliveryRequestCreatedLocally(generateDemoDeliveryRequestId(), poNumbers, data);
  }
}

function initDeliveryRequests() {
  document.getElementById("deliveryRequestBtn")?.addEventListener("click", openDeliveryRequestFromSelection);
  document.getElementById("deliveryRequestSubmitBtn")?.addEventListener("click", submitDeliveryRequest);
  document.getElementById("deliveryRequestCancelBtn")?.addEventListener("click", closeDeliveryRequestModal);
  document.querySelector('[data-dismiss="delivery-request"]')?.addEventListener("click", closeDeliveryRequestModal);
  bindDirectBackdropDismiss(document.getElementById("deliveryRequestOverlay"), closeDeliveryRequestModal);
  document.getElementById("deliveryRequestSearchInput")?.addEventListener("input", applyDeliveryRequestFilters);
}

initDeliveryRequests();
