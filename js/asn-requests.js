/** ASN Request records and modal. */

const ASN_DATE_FIELD = "ASN Date";
const ASN_REQ_NOTES_FIELD = "ASN Req Notes";
const ASN_REQ_SUBMIT_DATE_FIELD = "Request Date";
const ASN_PICKUP_EMAIL_STATUS_FIELD = "ASN Pickup Email Status";
const ASN_PICKUP_EMAIL_SENT_AT_FIELD = "ASN Pickup Email Sent At";
const ASN_PICKUP_EMAIL_ERROR_FIELD = "ASN Pickup Email Error";
const ASN_PICKUP_LABEL_DATA_FIELD = "ASN Pickup Label Data";
const ASN_PICKUP_BUYER_12TH_TRIBE = "12TH TRIBE";

// ASN lifecycle: Open (default) until the cartons are picked up.
const ASN_STATUS_FIELD = "Status";
const ASN_PICKED_UP_DATE_FIELD = "Picked Up Date";
const ASN_STATUS_PICKED_UP = "Picked Up";
const ASN_STATUS_OPEN = "Open";

const ASN_REQUEST_TABLE_COLUMNS = [
  ASN_REQUEST_ID_FIELD,
  ASN_STATUS_FIELD,
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

const ASN_REQUEST_LINKED_PO_COLUMNS = DELIVERY_PICKUP_LINKED_PO_COLUMNS.filter(({ col }) => col !== "Buyer");

const ASN_REQUEST_LINKED_PO_COLUMN_WIDTHS = [
  52, 52, 170, 72, 108, 72, 64, 64, 64, 76,
];

function appendAsnRequestLinkedPoColgroup(table) {
  const colgroup = document.createElement("colgroup");
  ASN_REQUEST_LINKED_PO_COLUMN_WIDTHS.forEach(width => {
    const col = document.createElement("col");
    col.style.width = `${width}px`;
    colgroup.appendChild(col);
  });
  table.appendChild(colgroup);
}

let asnRequestPoNumbers = [];
let asnRequestAddPoPanelOpen = false;
const asnRequestAvailablePoSelection = createAvailablePoPickerSelection();
let asnRequestDraftByPo = {};
let asnRequestDraftEmail = {};
let asnRequestDraftAsnDate = "";
let asnRequestSavedAsnDate = "";
let asnRequestDraftNotes = "";
let asnRequestBuyer = "";
let asnRequestDraftCarrier = "";
let asnRequestDraftCarrierEmail = "";
let asnRequestDraftCarrierCc = "";
let asnRequestSendBuyer = true;
let asnRequestSendCarrier = true;
let asnRequestModalRow = null;
let asnRequestOpInProgress = false;
let asnPickupPendingRequestId = "";
// allAsnRequests is declared in state-api.js
let filteredAsnRequests = [];

function isAsnRequestEligibleForPickup(request) {
  return Boolean(request) && isRequestEmailSent(request);
}

function getAsnDefaultCarrierInfoForBuyer(buyer) {
  const carrier = typeof getAsnDefaultCarrierForBuyer === "function" ? getAsnDefaultCarrierForBuyer(buyer) : null;
  return {
    name: carrier?.name ?? "",
    email: carrier?.email ?? "",
    cc: carrier?.cc ?? "",
  };
}

function getAsnCarrierInfoByName(name) {
  if (!name) return { name: "", email: "", cc: "" };
  const carriers = typeof getAsnCarriers === "function" ? getAsnCarriers() : [];
  const c = carriers.find(c => c.name === name);
  return c ? { ...c } : { name, email: "", cc: "" };
}

function createAsnCarrierSelectMetaRow(selectedCarrierName, { readOnly = false } = {}) {
  const tr = document.createElement("tr");
  const labelTd = document.createElement("td");
  labelTd.className = "email-meta-label";
  labelTd.textContent = "Carrier";
  const valueTd = document.createElement("td");
  valueTd.className = "email-meta-value";

  const carriers = typeof getAsnCarriers === "function" ? getAsnCarriers() : [];
  const select = document.createElement("select");
  select.className = "shipment-form-input email-meta-input";
  select.dataset.field = "Carrier";

  const blankOpt = document.createElement("option");
  blankOpt.value = "";
  blankOpt.textContent = "— No carrier —";
  select.appendChild(blankOpt);

  carriers.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.name;
    opt.textContent = c.name;
    if (c.name === selectedCarrierName) opt.selected = true;
    select.appendChild(opt);
  });

  if (readOnly) select.disabled = true;
  valueTd.appendChild(select);
  tr.appendChild(labelTd);
  tr.appendChild(valueTd);
  return { tr, selectEl: select };
}

function createAsnSendCheckboxMetaRow(labelText, cbId, defaultChecked, { readOnly = false } = {}) {
  const tr = document.createElement("tr");
  const labelTd = document.createElement("td");
  labelTd.className = "email-meta-label";
  const valueTd = document.createElement("td");
  valueTd.className = "email-meta-value asn-send-checkbox-td";

  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.id = cbId;
  cb.className = "asn-send-checkbox";
  cb.checked = defaultChecked;
  if (readOnly) cb.disabled = true;

  const lbl = document.createElement("label");
  lbl.htmlFor = cbId;
  lbl.className = "asn-send-checkbox-label";
  lbl.textContent = labelText;

  valueTd.appendChild(cb);
  valueTd.appendChild(lbl);
  tr.appendChild(labelTd);
  tr.appendChild(valueTd);
  return { tr, checkbox: cb };
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

function getAsnRequestStatus(request) {
  const status = String(request?.[ASN_STATUS_FIELD] ?? "").trim();
  return status === ASN_STATUS_PICKED_UP ? ASN_STATUS_PICKED_UP : ASN_STATUS_OPEN;
}

function isAsnRequestPickedUp(request) {
  return getAsnRequestStatus(request) === ASN_STATUS_PICKED_UP;
}

/** Close (or reopen) an ASN request; picking up stamps Status/Picked Up Date. */
async function setAsnRequestPickedUp(requestId, pickedUp) {
  if (asnRequestOpInProgress || isAppSaving()) return;
  const id = String(requestId ?? "").trim();
  const request = getAsnRequestById(id);
  if (!request) return;

  const patch = pickedUp
    ? {
        [ASN_STATUS_FIELD]: ASN_STATUS_PICKED_UP,
        [ASN_PICKED_UP_DATE_FIELD]: formatDateToYmd(new Date()),
      }
    : { [ASN_STATUS_FIELD]: "", [ASN_PICKED_UP_DATE_FIELD]: "" };

  asnRequestOpInProgress = true;
  showIndicator(`${pickedUp ? "Closing" : "Reopening"} ${id}${ELLIPSIS}`, "");
  try {
    const json = await postApi("/api/requests/asn/update", { asnRequestId: id, request: patch });
    if (!json.success) throw new Error(json.error || "Failed to update ASN request.");
    Object.assign(request, patch);
    applyAsnRequestFilters();
    if (typeof refreshDashboardIfActive === "function") refreshDashboardIfActive();
    showIndicator(pickedUp ? `${id} picked up ${CHECK_MARK}` : `${id} reopened`, "success");
  } catch (err) {
    showIndicator(`${pickedUp ? "Pickup" : "Reopen"} failed: ` + err.message, "error");
  } finally {
    asnRequestOpInProgress = false;
  }
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
  asnRequestSavedAsnDate = normalizeToYmd(request[ASN_DATE_FIELD] ?? "");
  asnRequestDraftNotes = request[ASN_REQ_NOTES_FIELD] ?? "";
  asnRequestDraftCarrier = request["Carrier"] ?? "";
  asnRequestDraftCarrierEmail = request["Carrier Email"] ?? "";
  asnRequestDraftCarrierCc = request["Carrier CC"] ?? "";
  asnRequestSendBuyer = true;
  asnRequestSendCarrier = true;
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

  const pickedUp = isAsnRequestPickedUp(request);
  const pickupToggleBtn = document.createElement("button");
  pickupToggleBtn.type = "button";
  pickupToggleBtn.className = "btn btn-secondary asn-request-picked-up-btn";
  pickupToggleBtn.textContent = pickedUp ? "Reopen" : "Picked Up";
  pickupToggleBtn.disabled = !requestId || isAppSaving();
  pickupToggleBtn.addEventListener("click", e => {
    e.stopPropagation();
    setAsnRequestPickedUp(requestId, !pickedUp);
  });
  wrap.appendChild(pickupToggleBtn);

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

  // Resend Carrier button
  if (isAsnRequestEligibleForPickup(request)) {
    const resendCarrierBtn = document.createElement("button");
    resendCarrierBtn.type = "button";
    resendCarrierBtn.className = "btn btn-secondary asn-request-pickup-btn";
    resendCarrierBtn.textContent = "Resend Carrier";
    resendCarrierBtn.disabled = !requestId || isAppSaving();
    resendCarrierBtn.addEventListener("click", e => {
      e.stopPropagation();
      resendAsnCarrierEmail(requestId);
    });
    wrap.appendChild(resendCarrierBtn);
  }

  // Carton Label button
  const cartonLabelBtn = document.createElement("button");
  cartonLabelBtn.type = "button";
  cartonLabelBtn.className = "btn btn-secondary asn-request-carton-btn";
  const hasLabelData = Boolean(request?.["ASN Pickup Label Data"]);
  cartonLabelBtn.textContent = hasLabelData ? "Reprint Labels" : "Carton Label";
  cartonLabelBtn.disabled = !requestId || isAppSaving();
  cartonLabelBtn.addEventListener("click", e => {
    e.stopPropagation();
    openCartonLabelModal(requestId);
  });
  wrap.appendChild(cartonLabelBtn);

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
      } else if (col === ASN_STATUS_FIELD) {
        const status = getAsnRequestStatus(request);
        const badge = document.createElement("span");
        badge.className = "badge " + (status === ASN_STATUS_PICKED_UP ? "badge-received" : "badge-otw");
        badge.textContent = status;
        td.className = "readonly readonly-no-select";
        td.appendChild(badge);
      } else if (col === "Email Status") {
        renderAsnRequestEmailStatusCell(td, request);
      } else {
        const text = formatAsnRequestTableCell(col, request);
        if (text === EMPTY_DISPLAY) setDisplayText(td, EMPTY_DISPLAY);
        else {
          mountSearchHighlightedText(td, text, request[col]);
          td.title = text;
        }
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
  asnRequestSavedAsnDate = "";
  asnRequestDraftNotes = "";
  asnRequestDraftCarrier = "";
  asnRequestDraftCarrierEmail = "";
  asnRequestDraftCarrierCc = "";
  asnRequestSendBuyer = true;
  asnRequestSendCarrier = true;
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

function isAsnRequestAsnDateDirty() {
  return normalizeToYmd(getAsnRequestAsnDateValue()) !== normalizeToYmd(asnRequestSavedAsnDate);
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
  asnRequestDraftCarrier = formData["Carrier"] ?? asnRequestDraftCarrier ?? "";
  asnRequestDraftCarrierEmail = formData["Carrier Email"] ?? asnRequestDraftCarrierEmail ?? "";
  asnRequestDraftCarrierCc = formData["Carrier CC"] ?? asnRequestDraftCarrierCc ?? "";
  const sendBuyerCb = document.getElementById("asnSendToBuyerCb");
  const sendCarrierCb = document.getElementById("asnSendToCarrierCb");
  if (sendBuyerCb) asnRequestSendBuyer = sendBuyerCb.checked;
  if (sendCarrierCb) asnRequestSendCarrier = sendCarrierCb.checked;
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

  // Resolve carrier info
  const defaultCarrierInfo = !isExisting
    ? getAsnDefaultCarrierInfoForBuyer(buyer)
    : { name: "", email: "", cc: "" };
  const resolvedCarrierName = isExisting
    ? (request["Carrier"] ?? "")
    : (asnRequestDraftCarrier || defaultCarrierInfo.name);
  const resolvedCarrierEmail = isExisting
    ? (request["Carrier Email"] ?? "")
    : (asnRequestDraftCarrierEmail || defaultCarrierInfo.email);
  const resolvedCarrierCc = isExisting
    ? (request["Carrier CC"] ?? "")
    : (asnRequestDraftCarrierCc || defaultCarrierInfo.cc);

  // Build carrier select row + carrier email/cc rows
  const carrierSelectRow = createAsnCarrierSelectMetaRow(resolvedCarrierName, { readOnly: isView });
  const carrierEmailRow = createRequestFormMetaRow(
    "Carrier Email", "Carrier Email", resolvedCarrierEmail, { readOnly: isView }
  );
  const carrierCcRow = createRequestFormMetaRow(
    "Carrier CC", "Carrier CC", resolvedCarrierCc, { readOnly: isView }
  );

  // Wire carrier select → auto-fill email/cc
  if (!isView) {
    carrierSelectRow.selectEl.addEventListener("change", () => {
      const info = getAsnCarrierInfoByName(carrierSelectRow.selectEl.value);
      if (info.email) carrierEmailRow.input.value = info.email;
      if (info.cc !== undefined) carrierCcRow.input.value = info.cc;
    });
  }

  // Build send checkboxes (only on new/edit, not on view)
  const sendBuyerRow = !isView
    ? createAsnSendCheckboxMetaRow("Send to Buyer", "asnSendToBuyerCb", asnRequestSendBuyer)
    : null;
  const sendCarrierRow = !isView
    ? createAsnSendCheckboxMetaRow("Send to Carrier", "asnSendToCarrierCb", asnRequestSendCarrier)
    : null;

  if (!isView && sendBuyerRow) {
    sendBuyerRow.checkbox.addEventListener("change", () => { asnRequestSendBuyer = sendBuyerRow.checkbox.checked; });
  }
  if (!isView && sendCarrierRow) {
    sendCarrierRow.checkbox.addEventListener("change", () => { asnRequestSendCarrier = sendCarrierRow.checkbox.checked; });
  }

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
    ...(sendBuyerRow ? [sendBuyerRow.tr] : []),
    createRequestFormMetaRow(
      "CC",
      "CC",
      isExisting ? (request["CC"] ?? "") : (asnRequestDraftEmail.cc ?? buyerEmailInfo.cc),
      { readOnly: isView }
    ).tr,
    carrierSelectRow.tr,
    carrierEmailRow.tr,
    carrierCcRow.tr,
    ...(sendCarrierRow ? [sendCarrierRow.tr] : []),
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

  if (asnRequestAddPoPanelOpen) {
    appendAvailablePoPanelToModalRight(outer, renderAvailablePoLinkedSection(getAvailableAsnRequestPanelRows(), {
      sectionId: "asnRequestAddPoPanel",
      columns: ASN_REQUEST_LINKED_PO_COLUMNS,
      appendColgroup: appendAsnRequestLinkedPoColgroup,
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
  if (isView) {
    const asnDateInput = asnForm?.querySelector(`[data-field="${ASN_DATE_FIELD}"]`);
    const onAsnDateChange = () => updateAsnRequestActionButtons();
    asnDateInput?.addEventListener("input", onAsnDateChange);
    asnDateInput?.addEventListener("change", onAsnDateChange);
  }
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
  return allRows.filter(row =>
    isPoEligibleForAsnRequest(row) &&
    !linked.has(String(row["PO #"] ?? ""))
  );
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

async function addSelectedPosToAsnRequest() {
  const selected = asnRequestAvailablePoSelection.getAll();
  if (selected.length === 0) return;
  captureAsnRequestDraft();
  const existing = new Set(asnRequestPoNumbers.map(String));
  const toAdd = selected.filter(po => !existing.has(po));
  if (toAdd.length === 0) return;
  asnRequestAvailablePoSelection.clear();
  await addPosToAsnRequest(toAdd, { keepPanelOpen: true });
}

async function addPoToAsnRequest(poNumber) {
  captureAsnRequestDraft();
  const po = String(poNumber ?? "").trim();
  if (!po || asnRequestPoNumbers.map(String).includes(po)) return;
  await addPosToAsnRequest([po], { keepPanelOpen: true });
}

async function addPosToAsnRequest(poNumbers, { keepPanelOpen = false } = {}) {
  const toAdd = [...new Set((poNumbers ?? []).map(po => String(po ?? "").trim()).filter(Boolean))]
    .filter(po => !asnRequestPoNumbers.map(String).includes(po));
  if (toAdd.length === 0) return;

  const requestId = getAsnRequestRecordId(asnRequestModalRow);
  if (!requestId) {
    asnRequestPoNumbers = [...asnRequestPoNumbers, ...toAdd];
    asnRequestAddPoPanelOpen = keepPanelOpen;
    renderAsnRequestModal(asnRequestPoNumbers, getAsnRequestModalRenderOptions());
    return;
  }

  if (asnRequestOpInProgress) return;
  asnRequestOpInProgress = true;
  setAsnRequestFooterMessage("");
  showIndicator(`Adding POs${ELLIPSIS}`, "");

  const nextPoNumbers = [...asnRequestPoNumbers, ...toAdd];
  const form = document.getElementById("asnRequestForm");
  const data = form ? readRequestForm(form) : {};
  const patch = {
    "PO Numbers": nextPoNumbers.join(", "),
    "PO Count": nextPoNumbers.length,
    [ASN_DATE_FIELD]: data[ASN_DATE_FIELD] ?? asnRequestModalRow?.[ASN_DATE_FIELD] ?? "",
    [ASN_REQ_SUBMIT_DATE_FIELD]: data[ASN_REQ_SUBMIT_DATE_FIELD] ?? asnRequestModalRow?.[ASN_REQ_SUBMIT_DATE_FIELD] ?? "",
  };

  try {
    const json = await postApi("/api/requests/asn/update", { asnRequestId: requestId, request: patch });
    if (!json.success) throw new Error(json.error || "Failed to add POs.");

    asnRequestPoNumbers = nextPoNumbers;
    const request = allAsnRequests.find(r => getAsnRequestRecordId(r) === requestId);
    const mergedRequest = json.request || { ...(asnRequestModalRow || {}), ...patch };
    if (request) Object.assign(request, mergedRequest);
    asnRequestModalRow = request || mergedRequest;

    nextPoNumbers.forEach(poNumber => {
      const row = allRows.find(r => String(r["PO #"]) === String(poNumber));
      if (!row) return;
      row[ASN_REQUEST_ID_FIELD] = requestId;
      row["ASN Requested"] = true;
      row[ASN_DATE_FIELD] = mergedRequest[ASN_DATE_FIELD] ?? "";
      row["ASN Req Date"] = mergedRequest[ASN_REQ_SUBMIT_DATE_FIELD] ?? "";
    });

    asnRequestAddPoPanelOpen = keepPanelOpen;
    applyAsnRequestFilters();
    applyFilters();
    renderAsnRequestModal(asnRequestPoNumbers, { request: asnRequestModalRow });
    showIndicator(`POs added to ASN ${CHECK_MARK}`, "success");
  } catch (err) {
    setAsnRequestFooterMessage("Add POs failed: " + err.message);
    showIndicator("Add POs failed: " + err.message, "error");
  } finally {
    asnRequestOpInProgress = false;
  }
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
  appendAsnRequestLinkedPoColgroup(table);

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

  ASN_REQUEST_LINKED_PO_COLUMNS.forEach(({ col, label, cellClass }) => {
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
      renderFormSelectedCell(selectTd, row, isAsnFormPoSelected(row), selected => {
        toggleAsnFormPoSelected(row, selected);
        updateAsnRequestActionButtons();
      });
    }
    tr.appendChild(selectTd);

    ASN_REQUEST_LINKED_PO_COLUMNS.forEach(({ col, cellClass }) => {
      const td = document.createElement("td");
      td.dataset.col = col;
      renderRequestLinkedPoDataCell(td, col, row, { cellClass });
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  wrap.appendChild(table);
  section.appendChild(wrap);
  if (typeof wireLinkedPoTableSorting === "function") wireLinkedPoTableSorting(table);
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
  if (saveDateBtn) saveDateBtn.hidden = !isView || !isAsnRequestAsnDateDirty();
  const cartonLabelBtn = document.getElementById("asnCartonLabelBtn");
  const printBtn = document.getElementById("asnRequestPrintBtn");
  if (printBtn) printBtn.hidden = !isView || asnRequestPoNumbers.length === 0;
  if (cartonLabelBtn) {
    cartonLabelBtn.hidden = !isView;
    cartonLabelBtn.disabled = asnRequestOpInProgress || isAppSaving();
  }
  if (isView) {
    const hasAvailablePos = getAvailableAsnRequestPanelRows().length > 0;
    if (addBtn) addBtn.hidden = asnRequestAddPoPanelOpen || !hasAvailablePos;
    if (removeBtn) removeBtn.hidden = true;
    if (doneBtn) doneBtn.hidden = !asnRequestAddPoPanelOpen;
    if (addSelectedBtn) addSelectedBtn.hidden = !asnRequestAddPoPanelOpen || asnRequestAvailablePoSelection.size === 0;
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
    asnRequestSavedAsnDate = normalizeToYmd(newDate);

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
  asnRequestSavedAsnDate = "";
  asnRequestDraftNotes = "";
  asnRequestBuyer = "";
  asnRequestDraftCarrier = "";
  asnRequestDraftCarrierEmail = "";
  asnRequestDraftCarrierCc = "";
  asnRequestSendBuyer = true;
  asnRequestSendCarrier = true;
  asnRequestModalRow = null;
  clearAsnFormSelection();
  const printBtn = document.getElementById("asnRequestPrintBtn");
  if (printBtn) printBtn.hidden = true;
  const saveDateBtn = document.getElementById("asnRequestSaveDateBtn");
  if (saveDateBtn) saveDateBtn.hidden = true;
  const cartonLabelBtnEl = document.getElementById("asnCartonLabelBtn");
  if (cartonLabelBtnEl) cartonLabelBtnEl.hidden = true;
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

  // Read checkbox states
  const sendBuyerCb = document.getElementById("asnSendToBuyerCb");
  const sendCarrierCb = document.getElementById("asnSendToCarrierCb");
  const sendBuyer = sendBuyerCb ? sendBuyerCb.checked : asnRequestSendBuyer;
  const sendCarrier = sendCarrierCb ? sendCarrierCb.checked : asnRequestSendCarrier;

  if (isEmptyValue(data[ASN_DATE_FIELD])) {
    setAsnRequestFooterMessage("ASN Date is required");
    return;
  }
  if (isEmptyValue(data[ASN_REQ_SUBMIT_DATE_FIELD])) {
    setAsnRequestFooterMessage("Request Date is required");
    return;
  }
  if (sendBuyer && isEmptyValue(data["Buyer Email"])) {
    setAsnRequestFooterMessage("Buyer Email is required when Send to Buyer is checked");
    return;
  }
  if (sendCarrier && isEmptyValue(data["Carrier Email"])) {
    setAsnRequestFooterMessage("Carrier Email is required when Send to Carrier is checked");
    return;
  }

  const poNumbers = asnRequestPoNumbers.slice();
  beginToolbarCreatePending();
  closeAsnRequestModal();
  asnRequestOpInProgress = true;
  showIndicator(`Sending ASN${ELLIPSIS}`, "");

  try {
    const json = await postApi("/api/requests/asn/create", {
      poNumbers,
      request: data,
      sendBuyer,
      sendCarrier,
    });
    if (!json.success) throw new Error(json.error || json.emailError || "ASN request failed");
    applyAsnRequestCreatedLocally(json.asnRequestId, poNumbers, data, { sendBuyer, sendCarrier });
    if (json.request) {
      const request = allAsnRequests.find(r => getAsnRequestRecordId(r) === json.asnRequestId);
      if (request) Object.assign(request, json.request);
      applyAsnRequestFilters();
    }
    const warnings = [];
    if (sendBuyer && json.emailSent === false) warnings.push(`Buyer email: ${json.emailError || "unknown error"}`);
    if (sendCarrier && json.carrierEmailSent === false) warnings.push(`Carrier email: ${json.carrierEmailError || "unknown error"}`);
    showIndicator(
      warnings.length ? `ASN requested, email issues: ${warnings.join("; ")}` : `ASN requested and email(s) sent ${CHECK_MARK}`,
      warnings.length ? "error" : "success"
    );
  } catch (err) {
    showIndicator("ASN request failed: " + err.message, "error");
  } finally {
    asnRequestOpInProgress = false;
    endToolbarCreatePending();
  }
}

function applyAsnRequestCreatedLocally(requestId, poNumbers, data, { sendBuyer = true, sendCarrier = true } = {}) {
  const now = formatDateToYmd(new Date());
  allAsnRequests.push({
    [ASN_REQUEST_ID_FIELD]: requestId,
    [ASN_DATE_FIELD]: data[ASN_DATE_FIELD] ?? "",
    [ASN_REQ_SUBMIT_DATE_FIELD]: data[ASN_REQ_SUBMIT_DATE_FIELD] ?? now,
    "Buyer": data["Buyer"] ?? "",
    "Buyer Email": data["Buyer Email"] ?? "",
    "CC": data["CC"] ?? "",
    "Carrier": data["Carrier"] ?? "",
    "Carrier Email": data["Carrier Email"] ?? "",
    "Carrier CC": data["Carrier CC"] ?? "",
    [ASN_REQ_NOTES_FIELD]: data[ASN_REQ_NOTES_FIELD] ?? "",
    "PO Numbers": poNumbers.join(", "),
    "PO Count": poNumbers.length,
    "Email Status": sendBuyer ? "Sent" : "",
    "Email Sent At": sendBuyer ? now : "",
    "Last Email Attempt At": now,
    "Email Error": "",
    "ASN Pickup Email Status": sendCarrier ? "Sent" : "",
    "ASN Pickup Email Sent At": sendCarrier ? now : "",
    "ASN Pickup Email Error": "",
    "ASN Pickup Label Data": "",
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

function openCartonLabelModal(asnRequestId) {
  if (asnRequestOpInProgress || !asnRequestId) return;
  const request = getAsnRequestById(asnRequestId);
  if (!request) return;
  asnPickupPendingRequestId = asnRequestId;
  renderAsnPickupLabelModal(request);
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
  if (subtitle) subtitle.textContent = requestId ? `ASN · ${requestId}` : "ASN Request";

  const poNumbers = getRequestPoNumbers(request, ASN_REQUEST_ID_FIELD);
  const pos = poNumbers
    .map(po => allRows.find(r => String(r["PO #"]) === String(po)))
    .filter(Boolean);
  const stored = parseAsnPickupLabelData(request);
  const storedByPo = Object.fromEntries(stored.map(entry => [String(entry.poNumber ?? ""), entry]));

  body.innerHTML = "";
  const intro = document.createElement("p");
  intro.className = "asn-pickup-label-intro";
  intro.textContent = "Enter Ship Notice # and Color Code for each PO. Click Generate & Print to create the carton label PDF.";
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
  request["Updated At"] = now;
  applyAsnRequestFilters();
  if (asnRequestModalRow && getAsnRequestRecordId(asnRequestModalRow) === asnRequestId) {
    renderAsnRequestModal(asnRequestPoNumbers, { request });
  }
}

async function resendAsnCarrierEmail(asnRequestId) {
  if (asnRequestOpInProgress || !asnRequestId) return;
  const request = getAsnRequestById(asnRequestId);
  if (!isAsnRequestEligibleForPickup(request)) return;

  const carrierEmail = request["Carrier Email"] || "";
  if (!window.confirm(`Resend carrier email${carrierEmail ? ` to ${carrierEmail}` : ""}?`)) return;

  asnRequestOpInProgress = true;
  showIndicator(`Resending carrier email${ELLIPSIS}`, "");

  try {
    const json = await postApi("/api/requests/asn-pickup/send-email", { asnRequestId });
    if (!json.success) throw new Error(json.error || json.emailError || "Carrier email failed to send.");
    applyAsnPickupSentLocally(asnRequestId, [], {
      emailSent: json.emailSent,
      emailError: json.emailError ?? "",
    });
    if (!json.emailSent) {
      showIndicator(`Carrier email not sent: ${json.emailError || "Unknown error"}`, "error");
      return;
    }
    showIndicator(`Carrier email sent ${CHECK_MARK}`, "success");
  } catch (err) {
    applyAsnPickupSentLocally(asnRequestId, [], { emailSent: false, emailError: err.message });
    showIndicator("Carrier resend failed: " + err.message, "error");
  } finally {
    asnRequestOpInProgress = false;
  }
}

async function submitAsnPickupLabelModal() {
  if (!asnPickupPendingRequestId) return;
  const labelInputs = readAsnPickupLabelInputs();
  const validationError = validateAsnPickupLabelInputs(labelInputs);
  if (validationError) {
    setAsnPickupLabelFooterMessage(validationError);
    return;
  }

  // Persist label data via /asn/update
  try {
    const request = getAsnRequestById(asnPickupPendingRequestId);
    if (request) {
      const updatedData = {
        ...(request || {}),
        "ASN Pickup Label Data": JSON.stringify(labelInputs),
      };
      await postApi("/api/requests/asn/update", {
        asnRequestId: asnPickupPendingRequestId,
        request: { "ASN Pickup Label Data": JSON.stringify(labelInputs) },
      });
      request["ASN Pickup Label Data"] = JSON.stringify(labelInputs);
    }
  } catch (err) {
    console.warn("Could not persist carton label data:", err);
  }

  // Generate and print PDF client-side
  const request = getAsnRequestById(asnPickupPendingRequestId);
  const poNumbers = request ? getRequestPoNumbers(request, ASN_REQUEST_ID_FIELD) : [];
  if (poNumbers.length > 0 && typeof buildCartonLabelsPrintHtml === "function") {
    const html = buildCartonLabelsPrintHtml(poNumbers, labelInputs);
    if (typeof printPackingListHtmlDocument === "function") {
      printPackingListHtmlDocument(html);
    }
  }

  closeAsnPickupLabelModal();
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
  document.getElementById("asnCartonLabelBtn")?.addEventListener("click", () => {
    const requestId = getAsnRequestRecordId(asnRequestModalRow);
    if (requestId) openCartonLabelModal(requestId);
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
