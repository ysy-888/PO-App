/** ASN Request records and modal. */

const ASN_DATE_FIELD = "ASN Date";
const ASN_REQ_NOTES_FIELD = "ASN Req Notes";
const ASN_REQ_SUBMIT_DATE_FIELD = "Request Date";

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
let asnRequestDraftByPo = {};
let asnRequestDraftEmail = {};
let asnRequestDraftAsnDate = "";
let asnRequestDraftNotes = "";
let asnRequestBuyer = "";
// allAsnRequests is declared in state-api.js
let filteredAsnRequests = [];

function normalizeAsnRequest(row) {
  return { ...row };
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
  const request = getAsnRequestById(id);
  if (!request) return;
  asnRequestPoNumbers = allRows
    .filter(row => String(row[ASN_REQUEST_ID_FIELD] ?? "").trim() === String(id).trim())
    .map(row => row["PO #"]);
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

function renderAsnRequestActionCell(td, request) {
  const requestId = getAsnRequestRecordId(request);
  td.className = "readonly readonly-no-select asn-request-action-cell";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-secondary asn-request-resend-btn";
  btn.textContent = "Resend";
  btn.disabled = !requestId || isAppSaving();
  btn.addEventListener("click", e => {
    e.stopPropagation();
    resendAsnRequestEmail(requestId);
  });
  td.appendChild(btn);
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
  });
  updateAsnRequestRowCounter();
}

async function resendAsnRequestEmail(requestId) {
  if (isAppSaving() || !requestId) return;
  setAppSaving(true, "Resending ASN email…");
  showIndicator(`Resending ASN email${ELLIPSIS}`, "");
  try {
    if (isDemoMode()) {
      const request = allAsnRequests.find(r => getAsnRequestRecordId(r) === requestId);
      if (request) {
        request["Email Status"] = "Sent";
        request["Email Error"] = "";
        request["Email Sent At"] = formatDateToYmd(new Date());
        request["Last Email Attempt At"] = formatDateToYmd(new Date());
      }
      applyAsnRequestFilters();
    } else {
      const json = await postAppsScript({ action: "resendAsnRequestEmail", asnRequestId: requestId });
      if (!json.success) throw new Error(json.error);
      await loadData();
      if (!json.emailSent) {
        showIndicator(`ASN email not sent: ${json.emailError || "Missing buyer email"}`, "error");
        return;
      }
    }
    showIndicator(`ASN email sent ${CHECK_MARK}`, "success");
  } catch (err) {
    showIndicator("Resend failed: " + err.message, "error");
  } finally {
    setAppSaving(false);
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
    email: String(row?.["Email"] ?? "").trim() || String(previousRequest?.["Buyer Email"] ?? "").trim(),
    cc: String(row?.["CC"] ?? "").trim(),
  };
}

function setAsnRequestFooterMessage(message = "") {
  const overlay = document.getElementById("asnRequestOverlay");
  if (!overlay) return;
  clearModalFooterMessageForOverlay(overlay);
  if (message) setModalFooterMessage(message, "error", { persist: true, overlay });
}

function openAsnRequestFromSelection() {
  if (isAppSaving()) return;
  const selected = getCheckedFilteredPos();
  if (!areRowsEligibleForAsnRequest(selected)) {
    showIndicator("Select OTW or Arrived at Port POs with packing lists, all LULU'S or all 12TH TRIBE, and no ASN request yet", "error");
    return;
  }
  asnRequestPoNumbers = selected.map(row => row["PO #"]);
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
  const titleEl = document.getElementById("asnRequestModalTitle");
  const submitBtn = document.getElementById("asnRequestSubmitBtn");
  if (!body) return;

  const isView = Boolean(request?.[ASN_REQUEST_ID_FIELD]);
  if (titleEl) {
    titleEl.textContent = isView
      ? `ASN Request ${request[ASN_REQUEST_ID_FIELD]}`
      : "ASN Request";
  }
  if (submitBtn) submitBtn.hidden = isView;

  asnRequestPoNumbers = poNumbers.slice();
  const pos = getAsnRequestRows();
  const buyer = isView
    ? (request["Buyer"] ?? "")
    : (asnRequestBuyer || getAsnRequestBuyerForRows(pos));
  const buyerEmailInfo = getAsnRequestBuyerEmailInfo(buyer);
  const submitDate = formatDateToYmd(new Date());

  body.innerHTML = "";
  const outer = document.createElement("div");
  outer.className = "shipment-modal-outer";

  const layout = document.createElement("div");
  layout.className = "shipment-modal-layout";

  const left = document.createElement("div");
  left.className = "shipment-modal-left";
  const form = document.createElement("div");
  form.className = "shipment-form-edit";
  form.id = "asnRequestForm";

  form.appendChild(createRequestFormField(
    "ASN Date",
    ASN_DATE_FIELD,
    isView ? (request[ASN_DATE_FIELD] ?? "") : (asnRequestDraftAsnDate || asnDate),
    { type: "date", readOnly: isView }
  ));
  form.appendChild(createRequestFormField(
    "Request Date",
    ASN_REQ_SUBMIT_DATE_FIELD,
    isView ? (request[ASN_REQ_SUBMIT_DATE_FIELD] ?? submitDate) : submitDate,
    { type: "date", readOnly: true }
  ));
  form.appendChild(createRequestFormField("Buyer", "Buyer", buyer, { readOnly: true }));
  form.appendChild(createRequestFormField(
    "Buyer Email",
    "Buyer Email",
    isView ? (request["Buyer Email"] ?? "") : (asnRequestDraftEmail.email ?? buyerEmailInfo.email),
    { readOnly: isView }
  ));
  form.appendChild(createRequestFormField(
    "CC",
    "CC",
    isView ? (request["CC"] ?? "") : (asnRequestDraftEmail.cc ?? buyerEmailInfo.cc),
    { readOnly: isView }
  ));
  form.appendChild(createRequestFormField(
    "Notes",
    ASN_REQ_NOTES_FIELD,
    isView ? (request[ASN_REQ_NOTES_FIELD] ?? "") : asnRequestDraftNotes,
    { type: "textarea", readOnly: isView }
  ));
  left.appendChild(form);

  const right = document.createElement("div");
  right.className = "shipment-modal-right";
  right.appendChild(renderAsnRequestLinkedPoSection(pos, isView));

  layout.appendChild(left);
  layout.appendChild(right);
  outer.appendChild(layout);

  if (!isView && asnRequestAddPoPanelOpen) {
    outer.classList.add("shipment-modal-outer--add-panel-open");
    outer.appendChild(renderAvailablePoPickerPanel(getAvailableAsnRequestPanelRows(), {
      panelId: "asnRequestAddPoPanel",
      emptyMessage: "No eligible POs available.",
      closeLabel: "Close available POs panel",
      onClose: closeAsnRequestAddPoPanel,
      onAddPo: addPoToAsnRequest,
    }));
  }

  body.appendChild(outer);
  setAsnRequestModalAddPanelClass(body, asnRequestAddPoPanelOpen);
  const headerCount = document.getElementById("asnRequestPoCount");
  setRequestModalPoCount(headerCount, pos.length);
  bringModalToFront(document.getElementById("asnRequestOverlay"));
}

function getAvailableAsnRequestPanelRows() {
  const linked = new Set(asnRequestPoNumbers.map(String));
  const buyer = asnRequestBuyer || getAsnRequestBuyerForRows(getAsnRequestRows());
  const buyerKey = String(buyer ?? "").trim().toUpperCase();
  return allRows.filter(row =>
    isPoEligibleForAsnRequest(row) &&
    String(row["Buyer"] ?? "").trim().toUpperCase() === buyerKey &&
    !linked.has(String(row["PO #"] ?? ""))
  );
}

function openAsnRequestAddPoPanel() {
  captureAsnRequestDraft();
  asnRequestAddPoPanelOpen = true;
  renderAsnRequestModal(asnRequestPoNumbers, { asnDate: getAsnRequestAsnDateValue() });
}

function closeAsnRequestAddPoPanel() {
  captureAsnRequestDraft();
  asnRequestAddPoPanelOpen = false;
  renderAsnRequestModal(asnRequestPoNumbers, { asnDate: getAsnRequestAsnDateValue() });
}

function addPoToAsnRequest(poNumber) {
  captureAsnRequestDraft();
  const po = String(poNumber ?? "").trim();
  if (!po || asnRequestPoNumbers.map(String).includes(po)) return;
  asnRequestPoNumbers = [...asnRequestPoNumbers, po];
  asnRequestAddPoPanelOpen = true;
  renderAsnRequestModal(asnRequestPoNumbers, { asnDate: getAsnRequestAsnDateValue() });
}

function removePosFromAsnRequest() {
  captureAsnRequestDraft();
  const linked = getAsnRequestRows().filter(isAsnFormPoSelected);
  if (linked.length === 0) { showIndicator("Select POs to remove", "error"); return; }
  const removeSet = new Set(linked.map(row => String(row["PO #"])));
  asnRequestPoNumbers = asnRequestPoNumbers.filter(po => !removeSet.has(String(po)));
  renderAsnRequestModal(asnRequestPoNumbers, { asnDate: getAsnRequestAsnDateValue() });
}

function renderAsnRequestLinkedPoSection(pos, isView = false) {
  const section = document.createElement("section");
  section.className = "shipment-linked-pos";
  section.classList.toggle("shipment-linked-pos--selection-disabled", asnRequestAddPoPanelOpen || isView);

  const wrap = document.createElement("div");
  wrap.className = "shipment-linked-po-table-wrap shipment-linked-po-table-wrap--with-footer";

  const table = document.createElement("table");
  table.className = "shipment-linked-po-table request-linked-po-table";

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

  REQUEST_LINKED_PO_COLUMNS.forEach(({ label, cellClass }) => {
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
    if (!isView) {
      renderFormSelectedCell(selectTd, row, isAsnFormPoSelected(row), selected => {
        toggleAsnFormPoSelected(row, selected);
        updateAsnRequestActionButtons();
      });
    }
    tr.appendChild(selectTd);

    REQUEST_LINKED_PO_COLUMNS.forEach(({ col, cellClass }) => {
      const td = document.createElement("td");
      if (cellClass) td.className = cellClass;
      if (col === "Status") {
        td.innerHTML = renderStatus(row[col]);
      } else {
        const text = formatShipmentLinkedPoCell(col, row);
        if (text === EMPTY_DISPLAY) setDisplayText(td, EMPTY_DISPLAY);
        else { td.textContent = text; td.title = text; }
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  wrap.appendChild(table);
  section.appendChild(wrap);
  if (!isView) section.appendChild(renderAsnRequestLinkedPoFooter(pos));
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

function renderAsnRequestLinkedPoFooter(pos) {
  const footer = document.createElement("footer");
  footer.className = "shipment-linked-po-footer";

  const actions = document.createElement("div");
  actions.className = "shipment-linked-po-footer-actions";

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "btn shipment-linked-po-footer-btn asn-request-linked-po-footer-add";
  addBtn.textContent = "Add POs";
  addBtn.addEventListener("click", openAsnRequestAddPoPanel);

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn shipment-linked-po-footer-btn asn-request-linked-po-footer-remove";
  removeBtn.textContent = "Remove POs";
  removeBtn.hidden = true;
  removeBtn.addEventListener("click", removePosFromAsnRequest);

  actions.appendChild(addBtn);
  actions.appendChild(removeBtn);
  footer.appendChild(actions);

  const totalsWrap = document.createElement("div");
  totalsWrap.className = "shipment-linked-po-footer-totals";
  [["PO Count", pos.length]].forEach(([label, value]) => {
    const item = document.createElement("div");
    item.className = "shipment-linked-po-footer-item";
    const labelEl = document.createElement("span");
    labelEl.className = "shipment-linked-po-footer-label";
    labelEl.textContent = label;
    const valueEl = document.createElement("span");
    valueEl.className = "shipment-linked-po-footer-value";
    valueEl.textContent = String(value);
    item.appendChild(labelEl);
    item.appendChild(valueEl);
    totalsWrap.appendChild(item);
  });
  footer.appendChild(totalsWrap);
  return footer;
}

function updateAsnRequestActionButtons() {
  const overlay = document.getElementById("asnRequestOverlay");
  if (!overlay?.classList.contains("open")) return;
  const addBtn = overlay.querySelector(".asn-request-linked-po-footer-add");
  const removeBtn = overlay.querySelector(".asn-request-linked-po-footer-remove");
  if (!addBtn && !removeBtn) return;
  const anySelected = getAsnRequestRows().some(isAsnFormPoSelected);
  if (addBtn) addBtn.hidden = asnRequestAddPoPanelOpen || anySelected;
  if (removeBtn) removeBtn.hidden = asnRequestAddPoPanelOpen || !anySelected;
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

function closeAsnRequestModal() {
  asnRequestPoNumbers = [];
  asnRequestAddPoPanelOpen = false;
  asnRequestDraftByPo = {};
  asnRequestDraftEmail = {};
  asnRequestDraftAsnDate = "";
  asnRequestDraftNotes = "";
  asnRequestBuyer = "";
  clearAsnFormSelection();
  setAsnRequestFooterMessage("");
  document.getElementById("asnRequestOverlay")?.classList.remove("open");
  setAsnRequestModalAddPanelClass(document.getElementById("asnRequestBody"), false);
}

async function submitAsnRequest() {
  if (isAppSaving() || asnRequestPoNumbers.length === 0) return;
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
  closeAsnRequestModal();
  setAppSaving(true, "Sending ASN email…");
  showIndicator(`Sending ASN email${ELLIPSIS}`, "");

  try {
    if (isDemoMode()) {
      demoCreateAsnRequest(poNumbers, data);
      showIndicator(`ASN requested and email sent ${CHECK_MARK}`, "success");
    } else {
      const json = await postAppsScript({
        action: "createAsnRequest",
        poNumbers,
        request: data,
      });
      if (json.asnRequestId) await loadData();
      if (!json.success) throw new Error(json.error || json.emailError || "ASN email failed to send");
      showIndicator(`ASN requested and email sent ${CHECK_MARK}`, "success");
    }
  } catch (err) {
    showIndicator("ASN email not sent: " + err.message, "error");
  } finally {
    setAppSaving(false);
  }
}

function demoCreateAsnRequest(poNumbers, data) {
  let max = 0;
  allAsnRequests.forEach(r => {
    const m = /^ASN-(\d+)$/.exec(String(r[ASN_REQUEST_ID_FIELD] ?? ""));
    if (m) max = Math.max(max, Number(m[1]));
  });
  const requestId = `ASN-${String(max + 1).padStart(4, "0")}`;
  const now = formatDateToYmd(new Date());
  allAsnRequests.push({
    [ASN_REQUEST_ID_FIELD]: requestId,
    [ASN_DATE_FIELD]: data[ASN_DATE_FIELD] ?? "",
    [ASN_REQ_SUBMIT_DATE_FIELD]: now,
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
    row["ASN Req Date"] = now;
  });
  resetLocalSelectedState(allRows);
  applyFilters();
  applyAsnRequestFilters();
  if (typeof updateToolbarRequestButtons === "function") updateToolbarRequestButtons();
}

function initAsnRequests() {
  document.getElementById("asnRequestBtn")?.addEventListener("click", openAsnRequestFromSelection);
  document.getElementById("asnRequestSubmitBtn")?.addEventListener("click", submitAsnRequest);
  document.getElementById("asnRequestCancelBtn")?.addEventListener("click", closeAsnRequestModal);
  document.querySelector('[data-dismiss="asn-request"]')?.addEventListener("click", closeAsnRequestModal);
  bindDirectBackdropDismiss(document.getElementById("asnRequestOverlay"), closeAsnRequestModal);
  document.getElementById("asnRequestSearchInput")?.addEventListener("input", applyAsnRequestFilters);
}

initAsnRequests();
if (window.__pendingAsnRequests && typeof onAsnRequestsDataLoaded === "function") {
  onAsnRequestsDataLoaded(window.__pendingAsnRequests);
  window.__pendingAsnRequests = null;
}
