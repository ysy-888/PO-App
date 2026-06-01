/** Vendor packing list submission review queue. */

const PENDING_PACKING_LIST_ID_FIELD = "Submission ID";

const PACKING_REVIEW_TABLE_COLUMNS = [
  PENDING_PACKING_LIST_ID_FIELD,
  "PO #",
  "Vendor",
  "Carton Count",
  "Status",
  "Submitted At",
  "Action",
];

const PACKING_REVIEW_DATE_COLS = new Set(["Submitted At", "Reviewed At"]);

let allPendingPackingLists = [];
let filteredPendingPackingLists = [];
let vendorSubmitMode = "review";
let packingReviewOpInProgress = false;

// ── Data loading ─────────────────────────────────────────────────────────────

function onPendingPackingListsDataLoaded(rows, mode) {
  allPendingPackingLists = (rows ?? []).map(r => ({ ...r }));
  if (mode) vendorSubmitMode = mode;
  applyPackingReviewFilters();
}

// ── Filtering & sorting ───────────────────────────────────────────────────────

function applyPackingReviewFilters() {
  const q = (document.getElementById("packingReviewSearchInput")?.value ?? "").toLowerCase();
  filteredPendingPackingLists = allPendingPackingLists.filter(row => {
    if (!q) return true;
    return PACKING_REVIEW_TABLE_COLUMNS
      .filter(col => col !== "Action")
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
}

// ── Counter ──────────────────────────────────────────────────────────────────

function updatePackingReviewRowCounter() {
  const el = document.getElementById("packingReviewRowCounter");
  if (!el) return;
  const pending = filteredPendingPackingLists.filter(r =>
    String(r["Status"] ?? "").trim().toLowerCase() === "pending"
  ).length;
  const total = filteredPendingPackingLists.length;
  el.textContent = pending
    ? `${pending} pending of ${total} submission${total !== 1 ? "s" : ""}`
    : `${total} submission${total !== 1 ? "s" : ""}`;
}

// ── Table rendering ───────────────────────────────────────────────────────────

function formatPackingReviewCell(col, row) {
  const val = row[col] ?? "";
  if (PACKING_REVIEW_DATE_COLS.has(col)) return formatDateForDisplay(val);
  if (isEmptyValue(val)) return EMPTY_DISPLAY;
  return String(val);
}

function renderPackingReviewActionCell(td, row) {
  td.className = "readonly readonly-no-select packing-review-action-cell";
  const status = String(row["Status"] ?? "").trim();
  if (status !== "Pending") {
    const badge = document.createElement("span");
    badge.className = "packing-review-status-badge packing-review-status-badge--" + status.toLowerCase();
    badge.textContent = status;
    td.appendChild(badge);
    return;
  }
  const submissionId = String(row[PENDING_PACKING_LIST_ID_FIELD] ?? "").trim();

  const approveBtn = document.createElement("button");
  approveBtn.type = "button";
  approveBtn.className = "btn btn-secondary packing-review-approve-btn";
  approveBtn.textContent = "Approve";
  approveBtn.disabled = !submissionId || packingReviewOpInProgress || isAppSaving();
  approveBtn.addEventListener("click", e => {
    e.stopPropagation();
    approvePendingPackingList(submissionId);
  });

  const rejectBtn = document.createElement("button");
  rejectBtn.type = "button";
  rejectBtn.className = "btn btn-danger packing-review-reject-btn";
  rejectBtn.textContent = "Reject";
  rejectBtn.disabled = !submissionId || packingReviewOpInProgress || isAppSaving();
  rejectBtn.addEventListener("click", e => {
    e.stopPropagation();
    rejectPendingPackingList(submissionId);
  });

  td.appendChild(approveBtn);
  td.appendChild(rejectBtn);
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
    const status = String(row["Status"] ?? "").trim().toLowerCase();
    if (status === "pending") tr.classList.add("packing-review-row--pending");

    PACKING_REVIEW_TABLE_COLUMNS.forEach(col => {
      const td = document.createElement("td");
      td.dataset.col = col;
      if (col === "Action") {
        renderPackingReviewActionCell(td, row);
      } else {
        const text = formatPackingReviewCell(col, row);
        if (text === EMPTY_DISPLAY) setDisplayText(td, EMPTY_DISPLAY);
        else { td.textContent = text; td.title = text; }
      }
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}

// ── Approve / reject actions ─────────────────────────────────────────────────

async function approvePendingPackingList(submissionId) {
  if (packingReviewOpInProgress || !submissionId) return;
  if (!confirm("Approve this packing list submission? This will save it as the official packing list for the PO.")) return;
  packingReviewOpInProgress = true;
  showIndicator(`Approving submission${ELLIPSIS}`, "");
  try {
    const json = await postAppsScript({ action: "approvePendingPackingList", submissionId });
    if (!json.success) throw new Error(json.error);
    const row = allPendingPackingLists.find(r =>
      String(r[PENDING_PACKING_LIST_ID_FIELD] ?? "") === submissionId
    );
    if (row) {
      row["Status"] = "Approved";
      row["Reviewed At"] = new Date().toISOString().slice(0, 10);
    }
    // Refresh PO data so the new packing list shows up in the PO table
    await loadData();
    showIndicator(`Submission approved ${CHECK_MARK}`, "success");
  } catch (err) {
    showIndicator("Approve failed: " + err.message, "error");
  } finally {
    packingReviewOpInProgress = false;
    applyPackingReviewFilters();
  }
}

async function rejectPendingPackingList(submissionId) {
  if (packingReviewOpInProgress || !submissionId) return;
  if (!confirm("Reject this packing list submission?")) return;
  packingReviewOpInProgress = true;
  showIndicator(`Rejecting submission${ELLIPSIS}`, "");
  try {
    const json = await postAppsScript({ action: "rejectPendingPackingList", submissionId });
    if (!json.success) throw new Error(json.error);
    const row = allPendingPackingLists.find(r =>
      String(r[PENDING_PACKING_LIST_ID_FIELD] ?? "") === submissionId
    );
    if (row) {
      row["Status"] = "Rejected";
      row["Reviewed At"] = new Date().toISOString().slice(0, 10);
    }
    showIndicator(`Submission rejected ${CHECK_MARK}`, "success");
  } catch (err) {
    showIndicator("Reject failed: " + err.message, "error");
  } finally {
    packingReviewOpInProgress = false;
    applyPackingReviewFilters();
  }
}

// ── Submit-mode toggle display ────────────────────────────────────────────────

function updateVendorSubmitModeCheck() {
  const btn = document.getElementById("headerMenuVendorModeToggle");
  const label = document.getElementById("headerMenuVendorModeLabel");
  const check = document.getElementById("headerMenuVendorModeCheck");
  const isDirect = vendorSubmitMode === "direct";
  if (label) {
    label.textContent = isDirect
      ? "Vendor submissions: Direct"
      : "Vendor submissions: Review";
  }
  if (check) check.hidden = !isDirect;
  if (btn) btn.setAttribute("aria-checked", isDirect ? "true" : "false");
}

async function toggleVendorSubmitMode() {
  if (isAppSaving()) return;
  const newMode = vendorSubmitMode === "direct" ? "review" : "direct";
  try {
    const json = await postAppsScript({ action: "setVendorSubmitMode", mode: newMode });
    if (!json.success) throw new Error(json.error);
    vendorSubmitMode = newMode;
    updateVendorSubmitModeCheck();
    showIndicator(`Vendor submissions: ${newMode === "direct" ? "Direct (immediate)" : "Review queue"} ${CHECK_MARK}`, "success");
  } catch (err) {
    showIndicator("Mode change failed: " + err.message, "error");
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

function initPackingReviews() {
  document.getElementById("packingReviewSearchInput")?.addEventListener("input", applyPackingReviewFilters);
}

initPackingReviews();
