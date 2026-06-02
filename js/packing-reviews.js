/** Vendor packing list submission review queue. */

const PENDING_PACKING_LIST_ID_FIELD = "Submission ID";
const PACKING_REVIEW_SELECT_COL = "__select";

const PACKING_REVIEW_PO_FIELDS = [
  "Style #", "SO #", "Buyer PO #", "Buyer", "PO Qty", "Actual Qty",
];

const PACKING_REVIEW_TABLE_COLUMNS = [
  PACKING_REVIEW_SELECT_COL,
  PENDING_PACKING_LIST_ID_FIELD,
  "PO #",
  ...PACKING_REVIEW_PO_FIELDS,
  "Vendor",
  "Carton Count",
  "Status",
  "Submitted At",
];

const PACKING_REVIEW_SEARCH_COLUMNS = PACKING_REVIEW_TABLE_COLUMNS.filter(
  col => col !== PACKING_REVIEW_SELECT_COL
);

const PACKING_REVIEW_DATE_COLS = new Set(["Submitted At", "Reviewed At"]);

let allPendingPackingLists = [];
let filteredPendingPackingLists = [];
let vendorSubmitMode = "review";
let packingReviewOpInProgress = false;
let packingReviewSelectedIds = new Set();

// ── Data loading ─────────────────────────────────────────────────────────────

function enrichPendingPackingListsFromPos(rows) {
  const poByNumber = new Map();
  (typeof allRows !== "undefined" ? allRows : []).forEach(po => {
    const key = String(po["PO #"] ?? "").trim();
    if (key && !poByNumber.has(key)) poByNumber.set(key, po);
  });
  return (rows ?? []).map(row => {
    const enriched = { ...row };
    const po = poByNumber.get(String(row["PO #"] ?? "").trim());
    PACKING_REVIEW_PO_FIELDS.forEach(field => {
      if (!String(enriched[field] ?? "").trim() && po) {
        enriched[field] = po[field] ?? "";
      }
    });
    return enriched;
  });
}

function onPendingPackingListsDataLoaded(rows, mode) {
  allPendingPackingLists = enrichPendingPackingListsFromPos(rows);
  packingReviewSelectedIds = new Set();
  if (mode) vendorSubmitMode = mode;
  applyPackingReviewFilters();
}

// ── Filtering & sorting ───────────────────────────────────────────────────────

function applyPackingReviewFilters() {
  allPendingPackingLists = enrichPendingPackingListsFromPos(allPendingPackingLists);
  const q = (document.getElementById("packingReviewSearchInput")?.value ?? "").toLowerCase();
  filteredPendingPackingLists = allPendingPackingLists.filter(row => {
    if (!q) return true;
    return PACKING_REVIEW_SEARCH_COLUMNS
      .map(col => String(row[col] ?? ""))
      .join(" ")
      .toLowerCase()
      .includes(q);
  });
  filteredPendingPackingLists.sort((a, b) => {
    const aId = String(a[PENDING_PACKING_LIST_ID_FIELD] ?? "");
    const bId = String(b[PENDING_PACKING_LIST_ID_FIELD] ?? "");
    return bId.localeCompare(aId, undefined, { numeric: true });
  });
  renderPackingReviewTable();
  updatePackingReviewRowCounter();
  updateVendorSubmitModeCheck();
  updatePackingReviewSelectionUi();
}

function getPendingSubmissionId(row) {
  return String(row?.[PENDING_PACKING_LIST_ID_FIELD] ?? "").trim();
}

function isPendingPackingSubmission(row) {
  return String(row?.["Status"] ?? "").trim().toLowerCase() === "pending";
}

function getFilteredPendingSubmissionIds() {
  return filteredPendingPackingLists
    .filter(isPendingPackingSubmission)
    .map(getPendingSubmissionId)
    .filter(Boolean);
}

// ── Selection ────────────────────────────────────────────────────────────────

function updatePackingReviewSelectionUi() {
  const approveAllBtn = document.getElementById("packingReviewApproveAllBtn");
  const selectAllCb = document.getElementById("packingReviewSelectAllCheckbox");
  const pendingIds = getFilteredPendingSubmissionIds();
  const selectedPendingCount = pendingIds.filter(id => packingReviewSelectedIds.has(id)).length;

  if (approveAllBtn) {
    approveAllBtn.hidden = selectedPendingCount < 2;
    approveAllBtn.disabled = packingReviewOpInProgress || isAppSaving();
  }

  if (selectAllCb) {
    const allSelected = pendingIds.length > 0 && selectedPendingCount === pendingIds.length;
    const someSelected = selectedPendingCount > 0 && !allSelected;
    selectAllCb.checked = allSelected;
    selectAllCb.indeterminate = someSelected;
    selectAllCb.disabled = pendingIds.length === 0 || packingReviewOpInProgress || isAppSaving();
  }
}

function setPackingReviewSelectAll(checked) {
  const pendingIds = getFilteredPendingSubmissionIds();
  if (checked) pendingIds.forEach(id => packingReviewSelectedIds.add(id));
  else pendingIds.forEach(id => packingReviewSelectedIds.delete(id));
  renderPackingReviewTable();
  updatePackingReviewSelectionUi();
}

function togglePackingReviewSelection(submissionId, checked) {
  if (!submissionId) return;
  if (checked) packingReviewSelectedIds.add(submissionId);
  else packingReviewSelectedIds.delete(submissionId);
  updatePackingReviewSelectionUi();
}

// ── Counter ──────────────────────────────────────────────────────────────────

function updatePackingReviewRowCounter() {
  const el = document.getElementById("packingReviewRowCounter");
  if (!el) return;
  const pending = filteredPendingPackingLists.filter(isPendingPackingSubmission).length;
  const total = filteredPendingPackingLists.length;
  el.textContent = pending
    ? `${pending} pending of ${total} submission${total !== 1 ? "s" : ""}`
    : `${total} submission${total !== 1 ? "s" : ""}`;
}

// ── Table rendering ───────────────────────────────────────────────────────────

function formatPackingReviewCell(col, row) {
  const val = row[col] ?? "";
  if (PACKING_REVIEW_DATE_COLS.has(col)) return formatDateForDisplay(val);
  if (col === "PO Qty" || col === "Actual Qty") {
    const n = Number(val);
    if (Number.isFinite(n) && n > 0) return String(n);
    if (isEmptyValue(val)) return EMPTY_DISPLAY;
    return String(val);
  }
  if (isEmptyValue(val)) return EMPTY_DISPLAY;
  return String(val);
}

function renderPackingReviewSelectCell(td, row) {
  td.className = "readonly readonly-no-select packing-review-select-cell";
  const submissionId = getPendingSubmissionId(row);
  const pending = isPendingPackingSubmission(row);
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.className = "packing-review-select-checkbox";
  cb.checked = packingReviewSelectedIds.has(submissionId);
  cb.disabled = !pending || !submissionId || packingReviewOpInProgress || isAppSaving();
  cb.setAttribute("aria-label", pending ? `Select submission ${submissionId}` : "Not selectable");
  cb.addEventListener("click", e => e.stopPropagation());
  cb.addEventListener("change", () => togglePackingReviewSelection(submissionId, cb.checked));
  td.appendChild(cb);
}

function renderPackingReviewStatusCell(td, row) {
  const status = String(row["Status"] ?? "").trim();
  if (!status) {
    setDisplayText(td, EMPTY_DISPLAY);
    return;
  }
  const badge = document.createElement("span");
  badge.className = "packing-review-status-badge packing-review-status-badge--" + status.toLowerCase();
  badge.textContent = status;
  td.appendChild(badge);
}

function renderPackingReviewTable() {
  const tbody = document.getElementById("packingReviewTableBody");
  if (!tbody) return;

  if (filteredPendingPackingLists.length === 0) {
    tbody.innerHTML = `<tr class="state-row"><td colspan="${PACKING_REVIEW_TABLE_COLUMNS.length}">No vendor submissions yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";
  filteredPendingPackingLists.forEach(row => {
    const tr = document.createElement("tr");
    const submissionId = getPendingSubmissionId(row);
    const pending = isPendingPackingSubmission(row);
    if (pending) tr.classList.add("packing-review-row--pending");
    if (submissionId) tr.dataset.submissionId = submissionId;
    tr.classList.add("packing-review-row--clickable");

    PACKING_REVIEW_TABLE_COLUMNS.forEach(col => {
      const td = document.createElement("td");
      td.dataset.col = col;
      if (col === PACKING_REVIEW_SELECT_COL) {
        renderPackingReviewSelectCell(td, row);
      } else if (col === "Status") {
        renderPackingReviewStatusCell(td, row);
      } else {
        const text = formatPackingReviewCell(col, row);
        if (text === EMPTY_DISPLAY) setDisplayText(td, EMPTY_DISPLAY);
        else { td.textContent = text; td.title = text; }
      }
      tr.appendChild(td);
    });

    tr.addEventListener("click", e => {
      if (e.target.closest("input, button, label")) return;
      openPendingPackingListSubmission(row);
    });

    tbody.appendChild(tr);
  });
}

// ── Open submission in PO modal ───────────────────────────────────────────────

function openPendingPackingListSubmission(submission) {
  if (packingReviewOpInProgress || isAppSaving()) return;
  const poNumber = String(submission["PO #"] ?? "").trim();
  if (!poNumber) return;
  const row = typeof findRowByPo === "function" ? findRowByPo(poNumber) : null;
  if (!row) {
    showIndicator("PO not found for this submission.", "error");
    return;
  }
  if (isPendingPackingSubmission(submission)) {
    if (typeof openPODetailForPendingSubmission === "function") {
      openPODetailForPendingSubmission(row, submission);
      return;
    }
  }
  if (typeof openPODetail === "function") openPODetail(row);
}

// ── Approve (modal save or bulk) ─────────────────────────────────────────────

function markPendingSubmissionApprovedLocally(submissionId) {
  const row = allPendingPackingLists.find(r => getPendingSubmissionId(r) === submissionId);
  if (row) {
    row["Status"] = "Approved";
    row["Reviewed At"] = new Date().toISOString().slice(0, 10);
  }
  packingReviewSelectedIds.delete(submissionId);
}

async function approvePendingPackingList(submissionId, { skipCartonSave = false, silent = false } = {}) {
  if (packingReviewOpInProgress || !submissionId) return false;
  if (!skipCartonSave && !silent && !confirm("Approve this packing list submission? This will save it as the official packing list for the PO.")) {
    return false;
  }
  packingReviewOpInProgress = true;
  if (!silent) showIndicator(`Approving submission${ELLIPSIS}`, "");
  try {
    const json = await postAppsScript({
      action: "approvePendingPackingList",
      submissionId,
      skipCartonSave,
    });
    if (!json.success) throw new Error(json.error);
    markPendingSubmissionApprovedLocally(submissionId);
    if (!silent) {
      await loadData();
      showIndicator(`Submission approved ${CHECK_MARK}`, "success");
    }
    return true;
  } catch (err) {
    if (!silent) showIndicator("Approve failed: " + err.message, "error");
    return false;
  } finally {
    packingReviewOpInProgress = false;
    applyPackingReviewFilters();
  }
}

async function approveAllSelectedPendingPackingLists() {
  const ids = getFilteredPendingSubmissionIds().filter(id => packingReviewSelectedIds.has(id));
  if (ids.length < 2 || packingReviewOpInProgress) return;
  if (!confirm(`Approve ${ids.length} selected submissions using the submitted packing list data?`)) return;

  packingReviewOpInProgress = true;
  showIndicator(`Approving ${ids.length} submissions${ELLIPSIS}`, "");
  let ok = 0;
  let failed = 0;
  try {
    for (const submissionId of ids) {
      const json = await postAppsScript({ action: "approvePendingPackingList", submissionId });
      if (json.success) {
        markPendingSubmissionApprovedLocally(submissionId);
        ok++;
      } else {
        failed++;
      }
    }
    await loadData();
    if (failed > 0) {
      showIndicator(`Approved ${ok}; ${failed} failed`, failed === ids.length ? "error" : "");
    } else {
      showIndicator(`Approved ${ok} submission${ok !== 1 ? "s" : ""} ${CHECK_MARK}`, "success");
    }
  } catch (err) {
    showIndicator("Approve All failed: " + err.message, "error");
  } finally {
    packingReviewOpInProgress = false;
    packingReviewSelectedIds = new Set();
    applyPackingReviewFilters();
  }
}

/** Called from modal after packing list is saved during submission review. */
async function completePendingSubmissionAfterModalSave(submissionId) {
  if (!submissionId) return true;
  const ok = await approvePendingPackingList(submissionId, { skipCartonSave: true, silent: true });
  if (ok) await loadData();
  return ok;
}

// ── Submit-mode toggle display ────────────────────────────────────────────────

function updateVendorSubmitModeCheck() {
  const current = vendorSubmitMode === "direct" ? "direct" : "review";
  document.querySelectorAll("#settingsVendorSubmitModeList [data-vendor-submit-mode]").forEach(item => {
    const selected = item.dataset.vendorSubmitMode === current;
    const check = item.querySelector(".settings-option-check");
    if (check) check.hidden = !selected;
    item.setAttribute("aria-checked", selected ? "true" : "false");
  });
}

async function setVendorSubmitModeFromSettings(mode) {
  if (isAppSaving()) return;
  const newMode = mode === "direct" ? "direct" : "review";
  if (newMode === vendorSubmitMode) return;
  try {
    const json = await postAppsScript({ action: "setVendorSubmitMode", mode: newMode });
    if (!json.success) throw new Error(json.error);
    vendorSubmitMode = newMode;
    updateVendorSubmitModeCheck();
    showIndicator(`Vendor submissions: ${newMode === "direct" ? "Direct (immediate)" : "Review queue"} ${CHECK_MARK}`, "success");
  } catch (err) {
    showIndicator("Mode change failed: " + err.message, "error");
    updateVendorSubmitModeCheck();
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

function initPackingReviews() {
  document.getElementById("packingReviewSearchInput")?.addEventListener("input", applyPackingReviewFilters);
  document.getElementById("packingReviewSelectAllCheckbox")?.addEventListener("change", e => {
    setPackingReviewSelectAll(e.target.checked);
  });
  document.getElementById("packingReviewApproveAllBtn")?.addEventListener("click", () => {
    approveAllSelectedPendingPackingLists();
  });
}

initPackingReviews();
