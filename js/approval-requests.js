/** Approval Request records and modals. */

const APPROVAL_ID_FIELD_FE = "Approval ID";
const APPROVAL_TYPE_FIELD_FE = "Approval Type";
const APPROVAL_REQ_NOTES_FIELD_FE = "Approval Notes";
const EXT_CXL_DATE_FIELD_FE = "Ext CXL Date";
const APPROVAL_STATUS_FIELD_FE = "Status";

const APPROVAL_TYPES = ["Shortage", "Overage", "Extension"];
const APPROVAL_STATUSES = ["Pending Approval", "Approved", "Updated"];

const APPROVAL_UNIT_FIELDS_FE = Array.from({ length: 15 }, (_, i) => `Approval Unit ${i + 1}`);

const APPROVAL_REQUEST_TABLE_COLUMNS = [
  APPROVAL_ID_FIELD_FE,
  "PO #",
  APPROVAL_TYPE_FIELD_FE,
  APPROVAL_STATUS_FIELD_FE,
  "Request Date",
  EXT_CXL_DATE_FIELD_FE,
  "Total Approval Qty",
  "Email To",
  "Email CC",
  APPROVAL_REQ_NOTES_FIELD_FE,
  "Email Status",
  "Email Sent At",
  "Email Error",
  "Action",
];

let allApprovals = [];
let filteredApprovals = [];
let approvalModalRow = null;
let approvalModalPoRow = null;
let approvalOpInProgress = false;
let approvalDraftEmail = {};
let approvalDraftType = "";
let approvalDraftNotes = "";
let approvalDraftExtCxlDate = "";
let approvalDraftUnits = {};

function normalizeApproval(row) {
  return { ...row };
}

function onApprovalsDataLoaded(approvals) {
  allApprovals = (approvals ?? []).map(normalizeApproval);
  filteredApprovals = allApprovals.slice();
  applyApprovalFilters();
}

function getApprovalById(id) {
  const key = String(id ?? "").trim();
  if (!key) return null;
  return allApprovals.find(r => String(r[APPROVAL_ID_FIELD_FE] ?? "").trim() === key) ?? null;
}

/** Returns the most recent Pending Approval for a given PO number, or null. */
function getPendingApprovalForPo(poNumber) {
  const key = String(poNumber ?? "").trim();
  if (!key) return null;
  const candidates = allApprovals.filter(a =>
    String(a["PO #"] ?? "").trim() === key &&
    String(a[APPROVAL_STATUS_FIELD_FE] ?? "").trim() === "Pending Approval"
  );
  if (!candidates.length) return null;
  candidates.sort((a, b) =>
    String(b["Created At"] ?? "").localeCompare(String(a["Created At"] ?? ""))
  );
  return candidates[0];
}

/**
 * Returns pending display overrides for a PO, or null.
 * { type, poQty?, cxlDate?, units? }
 */
function getPendingApprovalDisplay(poNumber) {
  const approval = getPendingApprovalForPo(poNumber);
  if (!approval) return null;
  const type = String(approval[APPROVAL_TYPE_FIELD_FE] ?? "").trim();
  if (type === "Extension") {
    const cxlDate = String(approval[EXT_CXL_DATE_FIELD_FE] ?? "").trim();
    if (!cxlDate) return null;
    return { type, cxlDate };
  }
  if (type === "Shortage" || type === "Overage") {
    const units = {};
    let total = 0;
    for (let i = 1; i <= 15; i++) {
      const qty = toQtyNumber(approval[`Approval Unit ${i}`]);
      units[`PO Unit ${i}`] = qty;
      total += qty;
    }
    if (total === 0) return null;
    return { type, poQty: total, units };
  }
  return null;
}

function refreshPendingApprovalDisplay() {
  if (typeof applyFilters === "function") applyFilters();
  const openModal = document.querySelector("#modalOverlay.open");
  if (openModal && typeof currentOpenModalRow !== "undefined" && currentOpenModalRow) {
    if (typeof rerenderModalPendingApproval === "function") rerenderModalPendingApproval();
  }
}

function applyApprovalFilters() {
  const q = (document.getElementById("approvalRequestSearchInput")?.value ?? "").toLowerCase();
  filteredApprovals = allApprovals.filter(approval => {
    if (!q) return true;
    return APPROVAL_REQUEST_TABLE_COLUMNS
      .filter(col => col !== "Action" && col !== "Total Approval Qty")
      .map(col => String(approval[col] ?? ""))
      .join(" ")
      .toLowerCase()
      .includes(q);
  });
  filteredApprovals.sort((a, b) =>
    String(b["Created At"] ?? "").localeCompare(String(a["Created At"] ?? ""))
  );
  renderApprovalRequestTable();
  updateApprovalRequestRowCounter();
}

function updateApprovalRequestRowCounter() {
  if (typeof updateRequestsRowCounter === "function") updateRequestsRowCounter();
}

function formatApprovalRequestTableCell(col, approval) {
  const val = approval[col] ?? "";
  if (col === "Request Date" || col === "Email Sent At" || col === "Created At" || col === "Updated At") {
    return formatDateForDisplay(val);
  }
  if (col === EXT_CXL_DATE_FIELD_FE) {
    return isEmptyValue(val) ? EMPTY_DISPLAY : formatDateForDisplay(val);
  }
  if (col === "Total Approval Qty") {
    const total = APPROVAL_UNIT_FIELDS_FE.reduce((sum, f) => sum + toQtyNumber(approval[f]), 0);
    const type = String(approval[APPROVAL_TYPE_FIELD_FE] ?? "").trim();
    if (type === "Extension") return EMPTY_DISPLAY;
    return total > 0 ? String(total) : EMPTY_DISPLAY;
  }
  if (isEmptyValue(val)) return EMPTY_DISPLAY;
  return String(val);
}

function renderApprovalEmailStatusCell(td, approval) {
  const status = String(approval["Email Status"] ?? "").trim();
  td.className = "readonly readonly-no-select approval-request-email-status-cell";
  td.dataset.status = status.toLowerCase();
  if (isEmptyValue(status)) setDisplayText(td, EMPTY_DISPLAY);
  else td.textContent = status;
}

function renderApprovalStatusCell(td, approval) {
  const status = String(approval[APPROVAL_STATUS_FIELD_FE] ?? "").trim();
  td.className = "readonly readonly-no-select approval-request-status-cell";
  td.dataset.approvalStatus = status.toLowerCase().replace(/\s+/g, "-");
  td.textContent = status || EMPTY_DISPLAY;
}

function renderApprovalActionCell(td, approval) {
  const approvalId = String(approval[APPROVAL_ID_FIELD_FE] ?? "").trim();
  td.className = "readonly readonly-no-select approval-request-action-cell";
  const resendBtn = document.createElement("button");
  resendBtn.type = "button";
  resendBtn.className = "btn btn-secondary approval-request-resend-btn";
  resendBtn.textContent = "Resend";
  resendBtn.disabled = !approvalId || isAppSaving();
  resendBtn.addEventListener("click", e => {
    e.stopPropagation();
    resendApprovalRequestEmail(approvalId);
  });
  td.appendChild(resendBtn);
}

function renderApprovalRequestTable() {
  const tbody = document.getElementById("approvalRequestTableBody");
  if (!tbody) return;
  if (filteredApprovals.length === 0) {
    tbody.innerHTML = `<tr class="state-row"><td colspan="${APPROVAL_REQUEST_TABLE_COLUMNS.length}">No approvals yet.</td></tr>`;
    updateApprovalRequestRowCounter();
    return;
  }
  tbody.innerHTML = "";
  filteredApprovals.forEach(approval => {
    const tr = document.createElement("tr");
    attachRequestTableRowDblClick(tr, () => {
      const id = String(approval[APPROVAL_ID_FIELD_FE] ?? "").trim();
      if (id) openApprovalDetail(id);
    });
    APPROVAL_REQUEST_TABLE_COLUMNS.forEach(col => {
      const td = document.createElement("td");
      if (col === "Email Status") {
        renderApprovalEmailStatusCell(td, approval);
      } else if (col === APPROVAL_STATUS_FIELD_FE) {
        renderApprovalStatusCell(td, approval);
      } else if (col === "Action") {
        renderApprovalActionCell(td, approval);
      } else {
        td.className = "readonly readonly-no-select";
        const text = formatApprovalRequestTableCell(col, approval);
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
}

// ─── Email info ──────────────────────────────────────────────────────────────

function getPlaceShowroomEmailInfo() {
  const contactRows = allContactRows ?? allVendorEmailRows ?? [];
  const key = "place showroom";
  const row = [...contactRows].reverse().find(r =>
    String(r["Name"] ?? "").trim().toLowerCase() === key
  );
  return {
    email: String(row?.["Email"] ?? "").trim(),
    cc: String(row?.["CC"] ?? "").trim(),
  };
}

// ─── Modal state & helpers ────────────────────────────────────────────────────

function setApprovalFooterMessage(message = "") {
  const overlay = document.getElementById("approvalRequestOverlay");
  if (!overlay) return;
  clearModalFooterMessageForOverlay(overlay);
  if (message) setModalFooterMessage(message, "error", { persist: true, overlay });
}

function openNewApprovalFromPo(poRow) {
  if (isAppSaving()) return;
  approvalModalRow = null;
  approvalModalPoRow = poRow ?? null;
  approvalDraftEmail = {};
  approvalDraftType = "";
  approvalDraftNotes = "";
  approvalDraftExtCxlDate = "";
  approvalDraftUnits = {};
  renderApprovalModal(approvalModalPoRow, null);
}

function openApprovalDetail(id) {
  if (isAppSaving()) return;
  const approval = getApprovalById(id);
  if (!approval) return;
  approvalModalRow = approval;
  const poNumber = String(approval["PO #"] ?? "").trim();
  approvalModalPoRow = allRows.find(r => String(r["PO #"]) === poNumber) ?? null;
  renderApprovalModal(approvalModalPoRow, approval);
}

function captureApprovalDraft() {
  const form = document.getElementById("approvalRequestForm");
  if (!form) return;
  const data = readRequestForm(form);
  approvalDraftEmail = {
    emailTo: data["Email To"] ?? approvalDraftEmail.emailTo ?? "",
    emailCc: data["Email CC"] ?? approvalDraftEmail.emailCc ?? "",
  };
  approvalDraftNotes = data[APPROVAL_REQ_NOTES_FIELD_FE] ?? approvalDraftNotes ?? "";
  approvalDraftExtCxlDate = data[EXT_CXL_DATE_FIELD_FE] ?? approvalDraftExtCxlDate ?? "";
  const typeEl = form.querySelector(`[data-field="${APPROVAL_TYPE_FIELD_FE}"]`);
  if (typeEl) approvalDraftType = typeEl.value;
  APPROVAL_UNIT_FIELDS_FE.forEach(f => {
    const el = form.querySelector(`[data-field="${f}"]`);
    if (el) approvalDraftUnits[f] = el.value;
  });
}

function renderApprovalModal(poRow, approval) {
  const body = document.getElementById("approvalRequestBody");
  const overlay = document.getElementById("approvalRequestOverlay");
  const submitBtn = document.getElementById("approvalRequestSubmitBtn");
  if (!body || !overlay) return;

  const isExisting = Boolean(approval?.[APPROVAL_ID_FIELD_FE]);
  const isReadOnly = isExisting && isRequestEmailSent(approval);
  const currentStatus = isExisting ? String(approval[APPROVAL_STATUS_FIELD_FE] ?? "").trim() : "";
  const submitDate = formatDateToYmd(new Date());

  setEmailStyleModalHeader(document.querySelector("#approvalRequestOverlay .modal-header"), {
    typeLabel: "Approval Request",
    recordId: isExisting ? approval[APPROVAL_ID_FIELD_FE] : "New",
    requestDate: isExisting
      ? (approval["Request Date"] ?? submitDate)
      : submitDate,
  });

  if (submitBtn) submitBtn.hidden = false;

  const selectedType = isExisting
    ? String(approval[APPROVAL_TYPE_FIELD_FE] ?? "").trim()
    : (approvalDraftType || "");

  const placeShowroom = getPlaceShowroomEmailInfo();
  const defaultEmailTo = isExisting
    ? (approval["Email To"] ?? "")
    : (approvalDraftEmail.emailTo ?? placeShowroom.email);
  const defaultEmailCc = isExisting
    ? (approval["Email CC"] ?? "")
    : (approvalDraftEmail.emailCc ?? placeShowroom.cc);

  // Build meta rows
  const poNumber = isExisting ? String(approval["PO #"] ?? "").trim() : String(poRow?.["PO #"] ?? "").trim();

  const typeOptions = [
    { value: "", label: "— Select —", selected: !selectedType },
    ...APPROVAL_TYPES.map(t => ({ value: t, label: t, selected: t === selectedType })),
  ];

  const statusOptions = APPROVAL_STATUSES.map(s => ({ value: s, label: s, selected: s === currentStatus }));

  const metaRows = [
    createRequestFormDisplayMetaRow("PO #", poNumber || EMPTY_DISPLAY),
    createRequestFormMetaRow("Approval Type", APPROVAL_TYPE_FIELD_FE, selectedType, {
      selectOptions: typeOptions,
      readOnly: isReadOnly,
    }).tr,
  ];

  if (isExisting) {
    metaRows.push(
      createRequestFormMetaRow("Status", APPROVAL_STATUS_FIELD_FE, currentStatus, {
        selectOptions: statusOptions,
        readOnly: false,
      }).tr
    );
  }

  metaRows.push(
    createRequestFormMetaRow("Request Date", "Request Date", submitDate, { type: "date", readOnly: true }).tr,
    createRequestFormMetaRow("Email To", "Email To", defaultEmailTo, { readOnly: isReadOnly }).tr,
    createRequestFormMetaRow("Email CC", "Email CC", defaultEmailCc, { readOnly: isReadOnly }).tr,
  );

  const form = buildEmailStyleForm({
    formId: "approvalRequestForm",
    metaRows,
    notesField: APPROVAL_REQ_NOTES_FIELD_FE,
    notesValue: isExisting
      ? (approval[APPROVAL_REQ_NOTES_FIELD_FE] ?? "")
      : approvalDraftNotes,
    notesReadOnly: isReadOnly,
    requestForm: true,
  });

  // Type-specific section (unit grid or date input) — appended below the form
  const typeSection = document.createElement("div");
  typeSection.className = "approval-type-section";

  function renderTypeSection(type) {
    typeSection.innerHTML = "";
    if (type === "Shortage" || type === "Overage") {
      typeSection.appendChild(createApprovalUnitGrid(poRow, approval, isReadOnly));
    } else if (type === "Extension") {
      const extValue = isExisting
        ? (approval[EXT_CXL_DATE_FIELD_FE] ?? "")
        : (approvalDraftExtCxlDate || "");
      const { tr } = createRequestFormMetaRow("Ext CXL Date", EXT_CXL_DATE_FIELD_FE, extValue, {
        type: "date",
        readOnly: isReadOnly,
      });
      const miniTable = document.createElement("table");
      miniTable.className = "email-meta approval-ext-date-meta";
      const tbody = document.createElement("tbody");
      tbody.appendChild(tr);
      miniTable.appendChild(tbody);
      typeSection.appendChild(miniTable);
    }
  }

  renderTypeSection(selectedType);

  // Wire type select to re-render type section
  if (!isReadOnly) {
    const typeSelect = form.querySelector(`[data-field="${APPROVAL_TYPE_FIELD_FE}"]`);
    if (typeSelect) {
      typeSelect.addEventListener("change", () => {
        captureApprovalDraft();
        approvalDraftType = typeSelect.value;
        renderTypeSection(typeSelect.value);
      });
    }
  }

  form.appendChild(typeSection);

  // Right pane: read-only PO info summary
  const right = buildApprovalPoInfoSection(poRow);

  body.innerHTML = "";
  body.appendChild(buildShipmentModalSplitLayout(form, right));

  bringModalToFront(overlay);
  overlay.classList.add("open");
}

function createApprovalUnitGrid(poRow, approval, readOnly) {
  const wrap = document.createElement("div");
  wrap.className = "approval-unit-grid";

  const sizeLabels = poRow ? getSizeLabelsFromRow(poRow) : [];
  const count = sizeLabels.length || 0;
  if (count === 0 && !approval) return wrap;

  const displayCount = Math.max(count, 1);

  const titleEl = document.createElement("div");
  titleEl.className = "approval-unit-grid-title";
  titleEl.textContent = "Approval Quantities";
  wrap.appendChild(titleEl);

  const table = document.createElement("table");
  table.className = "approval-unit-table";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const headLabel = document.createElement("th");
  headLabel.className = "approval-unit-row-label";
  headLabel.textContent = "";
  headRow.appendChild(headLabel);

  for (let i = 0; i < displayCount; i++) {
    const th = document.createElement("th");
    th.className = "approval-unit-col-header";
    th.textContent = sizeLabels[i] || `Unit ${i + 1}`;
    headRow.appendChild(th);
  }
  const thTotal = document.createElement("th");
  thTotal.className = "approval-unit-col-total";
  thTotal.textContent = "Total";
  headRow.appendChild(thTotal);
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  const dataRow = document.createElement("tr");

  const rowLabel = document.createElement("td");
  rowLabel.className = "approval-unit-row-label";
  rowLabel.textContent = "Approval Qty";
  dataRow.appendChild(rowLabel);

  let totalEl;
  let inputs = [];
  for (let i = 0; i < displayCount; i++) {
    const td = document.createElement("td");
    td.className = "approval-unit-cell";
    if (readOnly) {
      const val = toQtyNumber(approval?.[`Approval Unit ${i + 1}`]);
      td.textContent = val > 0 ? String(val) : EMPTY_DISPLAY;
    } else {
      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.className = "approval-unit-input";
      input.dataset.field = `Approval Unit ${i + 1}`;
      const existing = approval ? toQtyNumber(approval[`Approval Unit ${i + 1}`]) : 0;
      const draft = approvalDraftUnits[`Approval Unit ${i + 1}`];
      input.value = draft !== undefined ? draft : (existing > 0 ? String(existing) : "");
      bindNumberInput(input);
      input.addEventListener("input", () => {
        const total = inputs.reduce((sum, inp) => sum + toQtyNumber(inp.value), 0);
        if (totalEl) totalEl.textContent = String(total);
      });
      inputs.push(input);
      td.appendChild(input);
    }
    dataRow.appendChild(td);
  }

  const totalTd = document.createElement("td");
  totalTd.className = "approval-unit-cell approval-unit-cell--total";
  if (readOnly) {
    const total = APPROVAL_UNIT_FIELDS_FE
      .slice(0, displayCount)
      .reduce((sum, f) => sum + toQtyNumber(approval?.[f]), 0);
    totalTd.textContent = String(total);
  } else {
    const initialTotal = inputs.reduce((sum, inp) => sum + toQtyNumber(inp.value), 0);
    totalTd.textContent = String(initialTotal);
    totalEl = totalTd;
  }
  dataRow.appendChild(totalTd);
  tbody.appendChild(dataRow);

  // Reference row: current PO qty per size (read-only)
  if (poRow) {
    const refRow = document.createElement("tr");
    refRow.className = "approval-unit-ref-row";
    const refLabel = document.createElement("td");
    refLabel.className = "approval-unit-row-label approval-unit-row-label--ref";
    refLabel.textContent = "PO Qty";
    refRow.appendChild(refLabel);
    for (let i = 0; i < displayCount; i++) {
      const td = document.createElement("td");
      td.className = "approval-unit-cell approval-unit-cell--ref";
      const qty = toQtyNumber(poRow[`PO Unit ${i + 1}`]);
      td.textContent = qty > 0 ? String(qty) : EMPTY_DISPLAY;
      refRow.appendChild(td);
    }
    const refTotalTd = document.createElement("td");
    refTotalTd.className = "approval-unit-cell approval-unit-cell--ref approval-unit-cell--total";
    const poTotal = toQtyNumber(poRow["PO Qty"]) || computePoQtyFromUnits(poRow);
    refTotalTd.textContent = String(poTotal);
    refRow.appendChild(refTotalTd);
    tbody.appendChild(refRow);
  }

  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

function buildApprovalPoInfoSection(poRow) {
  const section = document.createElement("section");
  section.className = "approval-po-info";

  if (!poRow) {
    const empty = document.createElement("p");
    empty.className = "approval-po-info-empty";
    empty.textContent = "No PO data available.";
    section.appendChild(empty);
    return section;
  }

  const fields = [
    ["PO #", poRow["PO #"]],
    ["Style #", poRow["Style #"]],
    ["Color", poRow["Color"]],
    ["Vendor", poRow["Vendor"]],
    ["Buyer", poRow["Buyer"]],
    ["PO Qty", poRow["PO Qty"]],
    ["CXL Date", formatDateForDisplay(poRow["CXL Date"])],
    ["Status", poRow["Status"]],
  ];

  const table = document.createElement("table");
  table.className = "approval-po-info-table email-meta";
  const tbody = document.createElement("tbody");
  fields.forEach(([label, value]) => {
    const tr = document.createElement("tr");
    const tdLabel = document.createElement("td");
    tdLabel.className = "email-meta-label";
    tdLabel.textContent = label;
    const tdValue = document.createElement("td");
    tdValue.className = "email-meta-value";
    if (isEmptyValue(value)) {
      setDisplayText(tdValue, EMPTY_DISPLAY);
    } else {
      tdValue.textContent = String(value);
    }
    tr.appendChild(tdLabel);
    tr.appendChild(tdValue);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  section.appendChild(table);
  return section;
}

// ─── Submit / CRUD ────────────────────────────────────────────────────────────

async function submitApproval() {
  if (approvalOpInProgress) return;
  setApprovalFooterMessage("");

  const form = document.getElementById("approvalRequestForm");
  if (!form) return;
  const data = readRequestForm(form);

  const approvalType = data[APPROVAL_TYPE_FIELD_FE] || "";
  if (!approvalType) {
    setApprovalFooterMessage("Approval Type is required.");
    return;
  }

  if (approvalType === "Extension") {
    if (isEmptyValue(data[EXT_CXL_DATE_FIELD_FE])) {
      setApprovalFooterMessage("Ext CXL Date is required.");
      return;
    }
  } else {
    const hasQty = APPROVAL_UNIT_FIELDS_FE.some(f => toQtyNumber(data[f]) > 0);
    if (!hasQty) {
      setApprovalFooterMessage("Enter at least one approval qty.");
      return;
    }
  }

  if (isEmptyValue(data["Email To"]) && !approvalModalRow) {
    setApprovalFooterMessage("Email To is required to send the approval request.");
    return;
  }

  const savedRow = approvalModalRow;
  const isEdit = Boolean(savedRow?.[APPROVAL_ID_FIELD_FE]);
  const poNumber = String(approvalModalPoRow?.["PO #"] ?? savedRow?.["PO #"] ?? "").trim();

  if (!isEdit) beginToolbarCreatePending();
  closeApprovalModal();
  approvalOpInProgress = true;
  showIndicator(isEdit ? `Saving${ELLIPSIS}` : `Creating approval request${ELLIPSIS}`, "");
  let emailWarning = "";

  try {
    if (isDemoMode()) {
      if (isEdit) {
        applyApprovalUpdatedLocally(savedRow[APPROVAL_ID_FIELD_FE], data, poNumber);
      } else {
        applyApprovalCreatedLocally(generateDemoApprovalId(), poNumber, data);
      }
    } else {
      if (isEdit) {
        const newStatus = String(data[APPROVAL_STATUS_FIELD_FE] ?? "").trim();
        const json = (typeof isApiMode === "function" && isApiMode())
          ? await postApi("/api/requests/approval/update", { approvalId: savedRow[APPROVAL_ID_FIELD_FE], status: newStatus })
          : await postAppsScript({ action: "updateApproval", approvalId: savedRow[APPROVAL_ID_FIELD_FE], status: newStatus });
        if (!json.success) throw new Error(json.error || "Failed to update approval.");
        applyApprovalUpdatedLocally(savedRow[APPROVAL_ID_FIELD_FE], { ...data, [APPROVAL_STATUS_FIELD_FE]: newStatus }, poNumber, json.poUpdates);
      } else {
        data["Request Date"] = formatDateToYmd(new Date());
        const json = (typeof isApiMode === "function" && isApiMode())
          ? await postApi("/api/requests/approval/create", { poNumber, approval: data })
          : await postAppsScript({ action: "createApproval", poNumber, approval: data });
        if (!json.success) throw new Error(json.error || "Approval request failed.");
        applyApprovalCreatedLocally(json.approvalId, poNumber, data);
        if (json.request) {
          const approval = getApprovalById(json.approvalId);
          if (approval) Object.assign(approval, json.request);
          applyApprovalFilters();
        }
        if (json.emailSent === false) emailWarning = json.emailError || "Unknown email error";
      }
    }
    showIndicator(
      isEdit
        ? `Saved ${CHECK_MARK}`
        : (emailWarning ? `Approval request created, but email not sent: ${emailWarning}` : `Approval request created and email sent ${CHECK_MARK}`),
      emailWarning ? "error" : "success"
    );
  } catch (err) {
    showIndicator("Approval request failed: " + err.message, "error");
  } finally {
    approvalOpInProgress = false;
    if (!isEdit) endToolbarCreatePending();
  }
}

function generateDemoApprovalId() {
  let max = 0;
  allApprovals.forEach(a => {
    const m = /^APR-(\d+)$/.exec(String(a[APPROVAL_ID_FIELD_FE] ?? ""));
    if (m) max = Math.max(max, Number(m[1]));
  });
  return `APR-${String(max + 1).padStart(4, "0")}`;
}

function applyApprovalCreatedLocally(approvalId, poNumber, data) {
  const now = formatDateToYmd(new Date());
  const total = APPROVAL_UNIT_FIELDS_FE.reduce((sum, f) => sum + toQtyNumber(data[f]), 0);
  allApprovals.push({
    [APPROVAL_ID_FIELD_FE]: approvalId,
    "PO #": poNumber,
    [APPROVAL_TYPE_FIELD_FE]: data[APPROVAL_TYPE_FIELD_FE] ?? "",
    ...Object.fromEntries(APPROVAL_UNIT_FIELDS_FE.map(f => [f, data[f] ?? ""])),
    [EXT_CXL_DATE_FIELD_FE]: data[EXT_CXL_DATE_FIELD_FE] ?? "",
    [APPROVAL_STATUS_FIELD_FE]: "Pending Approval",
    "Request Date": data["Request Date"] ?? now,
    [APPROVAL_REQ_NOTES_FIELD_FE]: data[APPROVAL_REQ_NOTES_FIELD_FE] ?? "",
    "Email To": data["Email To"] ?? "",
    "Email CC": data["Email CC"] ?? "",
    "Email Status": !isEmptyValue(data["Email To"]) ? "Sent" : "Not Sent",
    "Email Sent At": !isEmptyValue(data["Email To"]) ? now : "",
    "Email Error": "",
    "Created At": now,
    "Updated At": now,
  });
  applyApprovalFilters();
  refreshPendingApprovalDisplay();
}

function applyApprovalUpdatedLocally(approvalId, data, poNumber, poUpdates) {
  const existing = getApprovalById(approvalId);
  if (existing) {
    const newStatus = String(data[APPROVAL_STATUS_FIELD_FE] ?? "").trim();
    existing[APPROVAL_STATUS_FIELD_FE] = newStatus;
    existing["Updated At"] = formatDateToYmd(new Date());

    // Apply PO updates when moving to Approved
    if (newStatus === "Approved" && poNumber) {
      const poRow = allRows.find(r => String(r["PO #"]) === String(poNumber));
      if (poRow && poUpdates) {
        Object.assign(poRow, poUpdates);
        if (typeof syncQtyTotalsForRow === "function") syncQtyTotalsForRow(poRow);
        if (typeof applyFilters === "function") applyFilters();
      } else if (poRow && isDemoMode()) {
        // Demo: apply directly from existing approval data
        const type = String(existing[APPROVAL_TYPE_FIELD_FE] ?? "").trim();
        if (type === "Extension") {
          const extDate = String(existing[EXT_CXL_DATE_FIELD_FE] ?? "").trim();
          if (extDate) poRow["CXL Date"] = extDate;
        } else if (type === "Shortage" || type === "Overage") {
          for (let i = 1; i <= 15; i++) {
            poRow[`PO Unit ${i}`] = toQtyNumber(existing[`Approval Unit ${i}`]) || "";
          }
          poRow["PO Qty"] = computePoQtyFromUnits(poRow);
          if (typeof syncQtyTotalsForRow === "function") syncQtyTotalsForRow(poRow);
        }
        if (typeof applyFilters === "function") applyFilters();
      }
    }
  }
  applyApprovalFilters();
  refreshPendingApprovalDisplay();
}

async function resendApprovalRequestEmail(approvalId) {
  if (isAppSaving()) return;
  const approval = getApprovalById(approvalId);
  if (!approval) { showIndicator("Approval not found.", "error"); return; }

  showIndicator(`Resending${ELLIPSIS}`, "");
  try {
    if (isDemoMode()) {
      throw new Error("Not available in demo mode");
    }
    const json = (typeof isApiMode === "function" && isApiMode())
      ? await postApi("/api/requests/approval/resend-email", { approvalId })
      : await postAppsScript({ action: "resendApprovalRequestEmail", approvalId });
    if (!json.success) throw new Error(json.error || "Resend failed.");
    approval["Email Status"] = json.emailSent ? "Sent" : "Failed";
    if (json.emailSent) approval["Email Sent At"] = formatDateToYmd(new Date());
    approval["Email Error"] = json.emailError ?? "";
    applyApprovalFilters();
    if (!json.emailSent) {
      showIndicator(`Email not sent: ${json.emailError || "Unknown error"}`, "error");
      return;
    }
    showIndicator(`Email resent ${CHECK_MARK}`, "success");
  } catch (err) {
    showIndicator("Resend failed: " + err.message, "error");
  }
}

function closeApprovalModal() {
  approvalModalRow = null;
  approvalModalPoRow = null;
  clearModalFooterMessageForOverlay("approvalRequestOverlay");
  document.getElementById("approvalRequestOverlay")?.classList.remove("open");
  updateToolbarRequestButtons();
}

function initApprovals() {
  document.getElementById("approvalRequestSubmitBtn")?.addEventListener("click", submitApproval);
  document.getElementById("approvalRequestCancelBtn")?.addEventListener("click", closeApprovalModal);
  document.querySelector('[data-dismiss="approval-request"]')?.addEventListener("click", closeApprovalModal);
  bindDirectBackdropDismiss(document.getElementById("approvalRequestOverlay"), closeApprovalModal);
  document.getElementById("approvalRequestSearchInput")?.addEventListener("input", applyApprovalFilters);
}

initApprovals();
