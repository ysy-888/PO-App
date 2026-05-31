/** EXF Request — batch WIP POs into the EXF Requested queue. */

const EXF_REQUEST_DATE_FIELD = "EXF Request Date";
const EXF_MEMO_FIELD = "EXF Memo";
const EXF_REQUEST_ID_FIELD = "EXF Request ID";

const EXF_REQUEST_TABLE_COLUMNS = [
  EXF_REQUEST_ID_FIELD,
  "Request Date",
  "Vendor",
  "Vendor Email",
  "PO Count",
  "Total Qty",
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

const EXF_REQUEST_LINKED_PO_COLUMN_WIDTHS = [52, 64, 110, 102, 160, 112, 54, 54, 88, null];

let exfRequestPoNumbers = [];
let exfRequestAddPoPanelOpen = false;
let exfRequestDraftByPo = {};
let exfRequestDraftEmail = {};
let exfRequestVendor = "";
let allExfRequests = [];
let filteredExfRequests = [];

function normalizeExfRequestRecord(row) {
  return { ...row };
}

function onExfRequestsDataLoaded(requests) {
  allExfRequests = (requests ?? []).map(normalizeExfRequestRecord);
  applyExfRequestFilters();
}

function getExfRequestRecordId(request) {
  return String(request?.[EXF_REQUEST_ID_FIELD] ?? "").trim();
}

function applyExfRequestFilters() {
  const q = (document.getElementById("exfRequestSearchInput")?.value ?? "").toLowerCase();
  filteredExfRequests = allExfRequests.filter(request => {
    if (!q) return true;
    return EXF_REQUEST_TABLE_COLUMNS
      .filter(col => col !== "Action")
      .map(col => String(request[col] ?? ""))
      .join(" ")
      .toLowerCase()
      .includes(q);
  });
  filteredExfRequests.sort((a, b) => {
    const dateCompare = normalizeToYmd(b["Created At"] || b["Request Date"])
      .localeCompare(normalizeToYmd(a["Created At"] || a["Request Date"]));
    if (dateCompare !== 0) return dateCompare;
    return getExfRequestRecordId(b).localeCompare(getExfRequestRecordId(a), undefined, { numeric: true });
  });
  renderExfRequestTable();
  updateExfRequestRowCounter();
}

function updateExfRequestRowCounter() {
  const el = document.getElementById("exfRequestRowCounter");
  if (!el) return;
  const total = filteredExfRequests.length;
  el.textContent = total === 1 ? "1 EXF request" : `${total} EXF requests`;
}

function formatExfRequestTableCell(col, request) {
  const val = request[col] ?? "";
  if (["Request Date", "Email Sent At", "Last Email Attempt At", "Created At", "Updated At"].includes(col)) {
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
  });
  updateExfRequestRowCounter();
}

async function resendExfRequestEmail(requestId) {
  if (isAppSaving() || !requestId) return;
  setAppSaving(true, "Resending EXF email…");
  showIndicator(`Resending EXF email${ELLIPSIS}`, "");
  try {
    if (isDemoMode()) {
      const request = allExfRequests.find(r => getExfRequestRecordId(r) === requestId);
      if (request) {
        request["Email Status"] = "Sent";
        request["Email Error"] = "";
        request["Email Sent At"] = formatDateToYmd(new Date());
        request["Last Email Attempt At"] = formatDateToYmd(new Date());
      }
      applyExfRequestFilters();
    } else {
      const json = await postAppsScript({
        action: "resendExfRequestEmail",
        exfRequestId: requestId,
      });
      if (!json.success) throw new Error(json.error);
      await loadData();
      if (!json.emailSent) {
        showIndicator(`EXF email not sent: ${json.emailError || "Missing vendor email"}`, "error");
        return;
      }
    }
    showIndicator(`EXF email sent ${CHECK_MARK}`, "success");
  } catch (err) {
    showIndicator("Resend failed: " + err.message, "error");
  } finally {
    setAppSaving(false);
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
  const eligible = checked.filter(isPoEligibleForExfRequest);
  btn.hidden = currentAppView !== "po" || eligible.length === 0 || !rowsHaveSingleExfRequestVendor(checked);
}

function setExfRequestFooterMessage(message = "") {
  const el = document.getElementById("exfRequestFooterMessage");
  if (!el) return;
  el.textContent = message;
  el.hidden = !message;
}

function openExfRequestFromSelection() {
  if (isAppSaving()) return;
  const checked = getCheckedFilteredPos();
  const eligible = checked.filter(isPoEligibleForExfRequest);
  if (eligible.length === 0) {
    showIndicator("Select WIP POs first", "error");
    return;
  }
  if (!rowsHaveSingleExfRequestVendor(checked)) {
    showIndicator("Select POs from one vendor only", "error");
    return;
  }
  exfRequestPoNumbers = eligible.map(row => row["PO #"]);
  exfRequestVendor = getExfRequestVendorForRows(eligible);
  exfRequestDraftByPo = {};
  exfRequestDraftEmail = {};
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

function getExfRequestDateValue() {
  const form = document.getElementById("exfRequestForm");
  return form ? readRequestForm(form)["Request Date"] : formatDateToYmd(new Date());
}

function captureExfRequestDraft() {
  const body = document.getElementById("exfRequestBody");
  if (!body) return;
  const form = document.getElementById("exfRequestForm");
  const formData = form ? readRequestForm(form) : {};
  exfRequestDraftEmail = {
    email: formData["Vendor Email"] ?? exfRequestDraftEmail.email ?? "",
    cc: formData["Vendor CC"] ?? exfRequestDraftEmail.cc ?? "",
  };
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

function renderExfRequestModal(poNumbers, { requestDate = formatDateToYmd(new Date()) } = {}) {
  const body = document.getElementById("exfRequestBody");
  if (!body) return;

  exfRequestPoNumbers = poNumbers.slice();
  const originalPos = getExfRequestRows();
  pruneExfFormSelection(originalPos);
  const pos = originalPos.map(applyExfRequestDraft);
  const vendor = exfRequestVendor || getExfRequestVendorForRows(originalPos);

  body.innerHTML = "";
  body.appendChild(buildExfRequestModalLayout({
    requestDate,
    vendor,
    linkedPos: pos,
    showAddPanel: exfRequestAddPoPanelOpen,
  }));
  setExfRequestModalAddPanelClass(body, exfRequestAddPoPanelOpen);
  const headerCount = document.getElementById("exfRequestPoCount");
  if (headerCount) headerCount.textContent = "";
  bringModalToFront(document.getElementById("exfRequestOverlay"));
  updateExfRequestModalActionButtons();
}

function closeExfRequestModal() {
  exfRequestPoNumbers = [];
  exfRequestAddPoPanelOpen = false;
  exfRequestDraftByPo = {};
  exfRequestDraftEmail = {};
  exfRequestVendor = "";
  clearExfFormSelection();
  setExfRequestFooterMessage("");
  document.getElementById("exfRequestOverlay")?.classList.remove("open");
  setExfRequestModalAddPanelClass(document.getElementById("exfRequestBody"), false);
}

function buildExfRequestModalLayout({ requestDate, vendor, linkedPos, showAddPanel = false }) {
  const outer = document.createElement("div");
  outer.className = "shipment-modal-outer";

  const layout = document.createElement("div");
  layout.className = "shipment-modal-layout";

  const left = document.createElement("div");
  left.className = "shipment-modal-left";
  const form = document.createElement("div");
  form.className = "shipment-form-edit";
  form.id = "exfRequestForm";
  const vendorEmailInfo = getExfRequestVendorEmailInfo(vendor);
  form.appendChild(createRequestFormField("Vendor", "Vendor", vendor, { readOnly: true }));
  form.appendChild(createRequestFormField("Vendor Email", "Vendor Email", exfRequestDraftEmail.email ?? vendorEmailInfo.email));
  form.appendChild(createRequestFormField("CC", "Vendor CC", exfRequestDraftEmail.cc ?? vendorEmailInfo.cc));
  form.appendChild(createRequestFormField("Request Date", "Request Date", requestDate, { type: "date" }));
  left.appendChild(form);

  const right = document.createElement("div");
  right.className = "shipment-modal-right";
  right.appendChild(renderExfRequestLinkedPoSection(linkedPos));

  layout.appendChild(left);
  layout.appendChild(right);
  outer.appendChild(layout);

  if (showAddPanel) {
    outer.classList.add("shipment-modal-outer--add-panel-open");
    outer.appendChild(renderExfWipPoPickerPanel(getAvailableExfRequestPanelRows()));
  }

  return outer;
}

function getAvailableExfRequestPanelRows() {
  const linkedPoNumbers = new Set(exfRequestPoNumbers.map(String));
  const linkedVendor = exfRequestVendor || getExfRequestVendorForRows(getExfRequestRows());
  return allRows.filter(row =>
    isPoEligibleForExfRequest(row) &&
    (!linkedVendor || normalizeExfRequestVendor(row) === linkedVendor) &&
    !linkedPoNumbers.has(String(row["PO #"] ?? ""))
  );
}

function openExfRequestAddPoPanel() {
  captureExfRequestDraft();
  clearExfFormSelection();
  exfRequestAddPoPanelOpen = true;
  renderExfRequestModal(exfRequestPoNumbers, { requestDate: getExfRequestDateValue() });
}

function closeExfRequestAddPoPanel() {
  captureExfRequestDraft();
  exfRequestAddPoPanelOpen = false;
  renderExfRequestModal(exfRequestPoNumbers, { requestDate: getExfRequestDateValue() });
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
  renderExfRequestModal(exfRequestPoNumbers, { requestDate: getExfRequestDateValue() });
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
  renderExfRequestModal(exfRequestPoNumbers, { requestDate: getExfRequestDateValue() });
}

function updateExfRequestModalActionButtons() {
  const scope = document.getElementById("exfRequestOverlay")?.classList.contains("open")
    ? document.getElementById("exfRequestOverlay")
    : document;
  const addBtn = scope.querySelector(".exf-request-linked-po-footer-add");
  const removeBtn = scope.querySelector(".exf-request-linked-po-footer-remove");
  if (!addBtn && !removeBtn) return;

  const linkedSelected = getExfRequestRows().filter(isExfRequestRowSelected).length;
  if (addBtn) addBtn.hidden = exfRequestAddPoPanelOpen || linkedSelected > 0;
  if (removeBtn) removeBtn.hidden = exfRequestAddPoPanelOpen || linkedSelected === 0;
}

function getExfRequestLinkedPoTotals(pos) {
  return pos.reduce((totals, row) => {
    totals.totalQty += toQtyNumber(row["PO Qty"]);
    return totals;
  }, { totalQty: 0 });
}

function renderExfRequestLinkedPoFooter(pos) {
  const totals = getExfRequestLinkedPoTotals(pos);
  const footer = document.createElement("footer");
  footer.className = "shipment-linked-po-footer";

  const actions = document.createElement("div");
  actions.className = "shipment-linked-po-footer-actions";

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "btn shipment-linked-po-footer-btn exf-request-linked-po-footer-add";
  addBtn.textContent = "Add POs";
  addBtn.addEventListener("click", openExfRequestAddPoPanel);

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn shipment-linked-po-footer-btn exf-request-linked-po-footer-remove";
  removeBtn.textContent = "Remove POs";
  removeBtn.hidden = true;
  removeBtn.addEventListener("click", removePosFromExfRequest);

  actions.appendChild(addBtn);
  actions.appendChild(removeBtn);
  footer.appendChild(actions);

  const totalsWrap = document.createElement("div");
  totalsWrap.className = "shipment-linked-po-footer-totals";
  [
    ["Total Qty", totals.totalQty],
    ["PO Count", pos.length],
  ].forEach(([label, value]) => {
    const item = document.createElement("div");
    item.className = "shipment-linked-po-footer-item";

    const labelEl = document.createElement("span");
    labelEl.className = "shipment-linked-po-footer-label";
    labelEl.textContent = label;

    const valueEl = document.createElement("span");
    valueEl.className = "shipment-linked-po-footer-value";
    valueEl.textContent = formatShipmentLinkedPoTotal(value);

    item.appendChild(labelEl);
    item.appendChild(valueEl);
    totalsWrap.appendChild(item);
  });
  footer.appendChild(totalsWrap);

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

function renderExfRequestLinkedPoSection(pos) {
  const section = document.createElement("section");
  section.className = "shipment-linked-pos";
  section.classList.toggle("shipment-linked-pos--selection-disabled", exfRequestAddPoPanelOpen);

  const wrap = document.createElement("div");
  wrap.className = "shipment-linked-po-table-wrap shipment-linked-po-table-wrap--with-footer";

  const table = document.createElement("table");
  table.className = "shipment-linked-po-table request-linked-po-table exf-request-linked-po-table";

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
  const selectAllCb = document.createElement("input");
  selectAllCb.type = "checkbox";
  selectAllCb.id = "exfRequestLinkedPoSelectAll";
  selectAllCb.disabled = exfRequestAddPoPanelOpen;
  selectAllCb.setAttribute("aria-label", "Select all EXF request POs");
  selectAllCb.addEventListener("change", () => {
    setAllExfRequestLinkedPosSelected(pos, selectAllCb.checked);
  });
  selectTh.appendChild(selectAllCb);
  headRow.appendChild(selectTh);

  EXF_REQUEST_LINKED_PO_COLUMNS.forEach(({ label, cellClass }) => {
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
    const linkedCb = renderFormSelectedCell(selectTd, row, isExfRequestRowSelected(row), selected => {
      toggleExfFormPoSelected(row, selected);
      onFormPoSelectionChanged();
    });
    linkedCb.disabled = exfRequestAddPoPanelOpen;
    tr.appendChild(selectTd);

    EXF_REQUEST_LINKED_PO_COLUMNS.forEach(({ col, cellClass, editable, editor, rows }) => {
      const td = document.createElement("td");
      if (cellClass) td.className = cellClass;
      if (editable) {
        const input = createRequestLinkedPoEditableControl(col, row, { editor, rows });
        if (col === "Ship Method") {
          input.addEventListener("change", () => {
            input.classList.remove("request-linked-po-input--error");
            input.removeAttribute("aria-invalid");
          });
        }
        td.appendChild(input);
      } else {
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
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  wrap.appendChild(table);
  section.appendChild(wrap);
  section.appendChild(renderExfRequestLinkedPoFooter(pos));
  updateExfRequestLinkedPoSelectAllHeader(pos);
  return section;
}

function renderExfWipPoPickerPanel(pos) {
  const panel = document.createElement("aside");
  panel.className = "shipment-add-po-panel";
  panel.id = "exfRequestAddPoPanel";

  const header = document.createElement("div");
  header.className = "shipment-add-po-panel-header";
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "shipment-add-po-panel-close";
  closeBtn.setAttribute("aria-label", "Close WIP POs panel");
  closeBtn.innerHTML = '<span aria-hidden="true"></span>';
  closeBtn.addEventListener("click", closeExfRequestAddPoPanel);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  if (pos.length === 0) {
    const empty = document.createElement("p");
    empty.className = "shipment-linked-empty";
    empty.textContent = "No WIP POs available.";
    panel.appendChild(empty);
    return panel;
  }

  const wrap = document.createElement("div");
  wrap.className = "shipment-linked-po-table-wrap shipment-requested-po-table-wrap";

  const table = document.createElement("table");
  table.className = "shipment-linked-po-table shipment-requested-po-table";

  const colgroup = document.createElement("colgroup");
  [
    "shipment-requested-po-col-select",
    "shipment-requested-po-col-id",
    "shipment-requested-po-col-buyer",
    "shipment-requested-po-col-buyer-po",
    "shipment-requested-po-col-style",
  ].forEach(className => {
    const col = document.createElement("col");
    col.className = className;
    colgroup.appendChild(col);
  });
  table.appendChild(colgroup);

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const selectTh = document.createElement("th");
  selectTh.className = "th-select-col";
  headRow.appendChild(selectTh);

  ["PO #", "Buyer", "Buyer PO #", "Style #"].forEach(label => {
    const th = document.createElement("th");
    th.textContent = label;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  pos.forEach(row => {
    const po = String(row["PO #"] ?? "");
    const tr = document.createElement("tr");
    tr.dataset.po = po;

    const selectTd = document.createElement("td");
    selectTd.className = "td-select-cell";
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "shipment-requested-po-add";
    addBtn.setAttribute("aria-label", `Add PO ${po} to EXF request`);
    addBtn.title = "Add PO to EXF request";
    addBtn.textContent = "+";
    addBtn.addEventListener("click", e => {
      e.stopPropagation();
      addWipPoToExfRequest(po);
    });
    selectTd.appendChild(addBtn);
    tr.appendChild(selectTd);

    ["PO #", "Buyer", "Buyer PO #", "Style #"].forEach(col => {
      const td = document.createElement("td");
      const text = formatShipmentLinkedPoCell(col, row);
      if (text === EMPTY_DISPLAY) setDisplayText(td, EMPTY_DISPLAY);
      else {
        td.textContent = text;
        td.title = text;
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  panel.appendChild(wrap);
  return panel;
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
  if (isAppSaving()) return;
  setExfRequestFooterMessage("");
  if (exfRequestPoNumbers.length === 0) {
    setExfRequestFooterMessage("Add at least one PO");
    return;
  }

  const form = document.getElementById("exfRequestForm");
  const data = readRequestForm(form);
  if (isEmptyValue(data["Request Date"])) {
    setExfRequestFooterMessage("Request Date is required");
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
  const requestDate = data["Request Date"];
  const memos = readRequestLinkedPoFields(document.getElementById("exfRequestBody"), EXF_MEMO_FIELD);
  const shipMethods = readRequestLinkedPoFields(document.getElementById("exfRequestBody"), "Ship Method");
  const missingShipMethods = getExfRequestMissingShipMethodPos(shipMethods, poNumbers);
  if (missingShipMethods.length > 0) {
    markExfRequestMissingShipMethods(missingShipMethods);
    setExfRequestFooterMessage("Select Shipping Method for all POs before submitting");
    return;
  }
  closeExfRequestModal();
  setAppSaving(true, "Submitting EXF request…");
  showIndicator(`Submitting EXF request${ELLIPSIS}`, "");

  try {
    let emailSent = true;
    let emailError = "";
    if (isDemoMode()) {
      demoExfRequest(poNumbers, requestDate, memos, shipMethods, data["Vendor Email"]);
    } else {
      const json = await postAppsScript({
        action: "exfRequest",
        poNumbers,
        requestDate,
        vendorEmail: data["Vendor Email"],
        vendorCc: data["Vendor CC"],
        memos,
        shipMethods,
      });
      if (!json.success) throw new Error(json.error);
      emailSent = json.emailSent !== false;
      emailError = json.emailError || "";
      await loadData();
    }
    if (emailSent) {
      showIndicator(`EXF requested and email sent ${CHECK_MARK}`, "success");
    } else {
      showIndicator(`EXF email not sent; POs remain WIP until resend succeeds: ${emailError || "Missing vendor email"}`, "error");
    }
  } catch (err) {
    showIndicator("EXF request failed: " + err.message, "error");
  } finally {
    setAppSaving(false);
  }
}

function demoExfRequest(poNumbers, requestDate, memos, shipMethods, vendorEmail = "demo@example.com") {
  const rows = poNumbers
    .map(poNumber => allRows.find(r => String(r["PO #"]) === String(poNumber)))
    .filter(Boolean);
  const vendor = getExfRequestVendorForRows(rows);
  const requestId = `EXF-${String(allExfRequests.length + 1).padStart(4, "0")}`;
  allExfRequests.push({
    [EXF_REQUEST_ID_FIELD]: requestId,
    "Request Date": requestDate,
    "Vendor": vendor,
    "Vendor Email": vendorEmail,
    "PO Numbers": poNumbers.join(", "),
    "PO Count": poNumbers.length,
    "Total Qty": rows.reduce((sum, row) => sum + toQtyNumber(row["PO Qty"]), 0),
    "Email Status": "Sent",
    "Email Sent At": formatDateToYmd(new Date()),
    "Email Error": "",
    "Last Email Attempt At": formatDateToYmd(new Date()),
    "Created At": formatDateToYmd(new Date()),
    "Updated At": formatDateToYmd(new Date()),
  });
  poNumbers.forEach(poNumber => {
    const row = allRows.find(r => String(r["PO #"]) === String(poNumber));
    if (!row) return;
    row[EXF_REQUESTED_FIELD] = true;
    row["Status"] = "Requested";
    row[EXF_REQUEST_DATE_FIELD] = requestDate;
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

function initExfRequest() {
  document.getElementById("exfRequestBtn")?.addEventListener("click", openExfRequestFromSelection);
  document.getElementById("exfRequestSubmitBtn")?.addEventListener("click", submitExfRequest);
  document.getElementById("exfRequestCancelBtn")?.addEventListener("click", closeExfRequestModal);
  document.querySelector('[data-dismiss="exf-request"]')?.addEventListener("click", closeExfRequestModal);
  document.getElementById("exfRequestOverlay")?.addEventListener("click", e => {
    if (e.target.id === "exfRequestOverlay") closeExfRequestModal();
  });
}

initExfRequest();
if (window.__pendingExfRequests && typeof onExfRequestsDataLoaded === "function") {
  onExfRequestsDataLoaded(window.__pendingExfRequests);
  window.__pendingExfRequests = null;
}
