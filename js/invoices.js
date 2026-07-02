/** Invoices list view and detail modal. */

const INV_SEARCH_COLUMNS = [
  "Invoice #",
  "Status",
  "Customer",
  "Pick #",
  "Tracking #",
  "SO #",
  "Memo",
];

const INV_DEFAULT_SORT_COLUMNS = ["Invoice #", "INV DATE"];
const INV_PAGE_SIZE_STORAGE_BASE = "invPageSize";

let filteredInvoices = [];

const INV_FLAG_ICON_SVG = typeof FLAG_ICON_SVG !== "undefined"
  ? FLAG_ICON_SVG
  : `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`;

// ── Helpers ──────────────────────────────────────────────────────────────────

function toInvNumber(val) {
  const n = Number(String(val ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function formatInvCurrency(val) {
  const n = toInvNumber(val);
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function formatInvDate(val) {
  if (!val) return "—";
  const s = String(val).trim();
  if (!s) return "—";
  if (typeof formatDateForDisplay === "function") return formatDateForDisplay(s) || s;
  return s;
}

function escInv(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInvSelectedCell(td, inv) {
  td.className = "td-select-cell readonly-no-select";
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.className = "po-select-checkbox";
  cb.checked = isTruthy(inv.Selected);
  cb.setAttribute("aria-label", `Select Invoice ${inv["Invoice #"] ?? ""}`);
  cb.addEventListener("click", e => {
    e.stopPropagation();
    inv.Selected = cb.checked;
    updateInvSelectAllHeader();
  });
  td.appendChild(cb);
}

function createInvFlagButton(inv) {
  const flagged = isTruthy(inv.Flag);
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "po-flag-btn" + (flagged ? " is-flagged" : "");
  btn.setAttribute("aria-label", flagged ? "Unflag invoice" : "Flag invoice");
  btn.title = flagged ? "Unflag" : "Flag";
  btn.innerHTML = INV_FLAG_ICON_SVG;
  btn.addEventListener("click", e => {
    e.stopPropagation();
    toggleInvoiceFlag(inv);
  });
  return btn;
}

function renderInvFlagCell(td, inv) {
  td.className = "td-flag-cell readonly-no-select";
  td.replaceChildren(createInvFlagButton(inv));
}

async function toggleInvoiceFlag(inv) {
  if (isAppSaving()) return;
  const invoiceNo = String(inv["Invoice #"] ?? "").trim();
  if (!invoiceNo) return;

  const previous = isTruthy(inv.Flag);
  const next = !previous;
  inv.Flag = next;
  renderInvoicesTable();

  try {
    const json = await postApi("/api/invoices/flag", { invoiceNo, flag: next });
    if (!json.success) throw new Error(json.error || "Failed to save flag.");
    inv.Flag = json.flag;
    renderInvoicesTable();
  } catch (err) {
    inv.Flag = previous;
    renderInvoicesTable();
    if (typeof showIndicator === "function") {
      showIndicator("Flag save failed: " + (err.message || err), "error");
    }
  }
}

function updateInvSelectAllHeader() {
  const cb = document.getElementById("invSelectAllRowsCheckbox");
  if (!cb) return;

  if (filteredInvoices.length === 0) {
    cb.checked = false;
    cb.indeterminate = false;
    cb.disabled = true;
    return;
  }

  cb.disabled = false;
  const selectedCount = filteredInvoices.filter(inv => isTruthy(inv.Selected)).length;
  cb.checked = selectedCount === filteredInvoices.length;
  cb.indeterminate = selectedCount > 0 && selectedCount < filteredInvoices.length;
}

function setAllFilteredInvoicesSelected(selected) {
  const next = toSheetBool(selected);
  filteredInvoices.forEach(inv => { inv.Selected = next; });
  renderInvoicesTable();
}

function updateInvFlagFilterHeaderState() {
  const th = document.querySelector('#invoiceTable th.th-flag-col[data-col="Flag"]');
  if (!th) return;
  th.classList.toggle("filter-active", invFlagFilterActive);
  th.setAttribute("aria-pressed", invFlagFilterActive ? "true" : "false");
  th.title = invFlagFilterActive ? "Show all invoices" : "Show flagged only";
}

function toggleInvFlagFilter() {
  invFlagFilterActive = !invFlagFilterActive;
  updateInvFlagFilterHeaderState();
  applyInvoiceFilters();
}

function initInvSelectionAndFlagControls() {
  const selectAll = document.getElementById("invSelectAllRowsCheckbox");
  selectAll?.addEventListener("click", e => {
    e.stopPropagation();
    setAllFilteredInvoicesSelected(selectAll.checked);
  });

  const flagHeader = document.querySelector('#invoiceTable th.th-flag-col[data-col="Flag"]');
  if (flagHeader) {
    flagHeader.setAttribute("role", "button");
    flagHeader.setAttribute("aria-pressed", "false");
    flagHeader.title = "Show flagged only";
    flagHeader.addEventListener("click", toggleInvFlagFilter);
  }
}

// ── State ────────────────────────────────────────────────────────────────────

function onInvoicesDataLoaded(rows) {
  allInvoices = (rows ?? []).map(row => ({ ...row }));
  applyInvoiceFilters();
}

function getInvSortValue(inv, col) {
  if (INV_CURRENCY_COLUMNS.has(col) || INV_NUMERIC_COLUMNS.has(col)) return toInvNumber(inv[col]);
  if (col === "Invoice #") {
    const n = Number(String(inv["Invoice #"] ?? ""));
    return Number.isFinite(n) ? n : String(inv["Invoice #"] ?? "");
  }
  return inv[col];
}

function compareInvByColumn(col, a, b) {
  if (INV_DATE_FILTER_COLUMNS.has(col)) {
    return compareDateFieldValues(a[col], b[col]);
  }
  if (INV_CURRENCY_COLUMNS.has(col) || INV_NUMERIC_COLUMNS.has(col)) {
    return toInvNumber(a[col]) - toInvNumber(b[col]);
  }
  if (col === "Invoice #") {
    const an = Number(String(a["Invoice #"] ?? ""));
    const bn = Number(String(b["Invoice #"] ?? ""));
    if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
  }
  return compareTextFieldValues(a[col], b[col]);
}

function compareInvoicesForSort(a, b) {
  if (invSortCol) {
    const primary = compareInvByColumn(invSortCol, a, b) * invSortDir;
    if (primary !== 0) return primary;
    for (const col of INV_DEFAULT_SORT_COLUMNS) {
      if (col === invSortCol) continue;
      const cmp = compareInvByColumn(col, a, b);
      if (cmp !== 0) return cmp;
    }
    return 0;
  }
  for (const col of INV_DEFAULT_SORT_COLUMNS) {
    const cmp = compareInvByColumn(col, a, b);
    if (cmp !== 0) return cmp;
  }
  return 0;
}

function applyInvoiceFilters() {
  const q = (document.getElementById("invoiceSearchInput")?.value ?? "").trim().toLowerCase();
  filteredInvoices = (allInvoices ?? []).filter(inv => {
    if (invFlagFilterActive && !isTruthy(inv.Flag)) return false;
    if (typeof rowPassesInvColumnFilters === "function" && !rowPassesInvColumnFilters(inv)) return false;
    if (!q) return true;
    const haystack = INV_SEARCH_COLUMNS
      .map(col => String(inv[col] ?? ""))
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });

  filteredInvoices.sort(compareInvoicesForSort);
  invCurrentPage = 1;
  renderInvoicesTable();
  updateInvoiceRowCounter();
  updateInvSelectAllHeader();
  updateInvClearAllFiltersButton();
  if (typeof updateInvPaginationUI === "function") updateInvPaginationUI();
  updateInvFlagFilterHeaderState();
}

function sortByInv(col) {
  if (invSortCol === col) {
    if (invSortDir === 1) invSortDir = -1;
    else {
      invSortCol = null;
      invSortDir = 1;
    }
  } else {
    invSortCol = col;
    invSortDir = 1;
  }
  updateInvSortHeaders();
  applyInvoiceFilters();
}

function updateInvSortHeaders() {
  document.querySelectorAll("#invoiceTable thead th[data-col]").forEach(th => {
    th.classList.remove("sorted-asc", "sorted-desc");
    if (invSortCol && th.dataset.col === invSortCol) {
      th.classList.add(invSortDir === 1 ? "sorted-asc" : "sorted-desc");
    }
  });
}

function isInvPageSizeAll() {
  return !Number.isFinite(invPageSize);
}

function getInvTotalPages() {
  if (isInvPageSizeAll() || filteredInvoices.length === 0) return 1;
  return Math.ceil(filteredInvoices.length / invPageSize);
}

function getPagedInvoices() {
  if (isInvPageSizeAll()) return filteredInvoices;
  const totalPages = getInvTotalPages();
  invCurrentPage = Math.min(Math.max(1, invCurrentPage), totalPages);
  const start = (invCurrentPage - 1) * invPageSize;
  return filteredInvoices.slice(start, start + invPageSize);
}

function getInvoiceRowCounterText() {
  const total = filteredInvoices.length;
  if (total === 0) return "0 invoices";
  if (isInvPageSizeAll()) {
    return total === 1 ? "1 invoice" : `${total} invoices`;
  }
  const start = (invCurrentPage - 1) * invPageSize + 1;
  const end = Math.min(invCurrentPage * invPageSize, total);
  return `${start}${typeof EN_DASH !== "undefined" ? EN_DASH : "–"}${end} of ${total}`;
}

function updateInvoiceRowCounter() {
  const el = document.getElementById("invoiceRowCounter");
  if (!el) return;
  el.textContent = getInvoiceRowCounterText();
}

function updateInvPaginationUI() {
  const nav = document.getElementById("paginationNav");
  if (!nav) return;

  const totalPages = getInvTotalPages();
  const showPagination = !isInvPageSizeAll() && filteredInvoices.length > invPageSize;
  nav.hidden = !showPagination;
  if (!showPagination) return;

  const indicator = document.getElementById("pageIndicator");
  if (indicator) indicator.textContent = `${invCurrentPage} / ${totalPages}`;

  const first = document.getElementById("pageFirst");
  const prev = document.getElementById("pagePrev");
  const next = document.getElementById("pageNext");
  const last = document.getElementById("pageLast");
  const onFirst = invCurrentPage <= 1;
  const onLast = invCurrentPage >= totalPages;

  if (first) first.disabled = onFirst;
  if (prev) prev.disabled = onFirst;
  if (next) next.disabled = onLast;
  if (last) last.disabled = onLast;
}

function scrollInvoiceTableToTop() {
  document.getElementById("invoiceTableWrap")?.scrollTo({ top: 0 });
}

function goToInvPage(page) {
  const totalPages = getInvTotalPages();
  const nextPage = Math.min(Math.max(1, page), totalPages);
  if (nextPage === invCurrentPage) return;
  invCurrentPage = nextPage;
  renderInvoicesTable();
  updateInvoiceRowCounter();
  updateInvPaginationUI();
  scrollInvoiceTableToTop();
}

function loadInvPageSizePreference() {
  try {
    const stored = localStorage.getItem(scopedStorageKey(INV_PAGE_SIZE_STORAGE_BASE));
    if (stored == null) return DEFAULT_PAGE_SIZE;
    return normalizePageSizeValue(stored);
  } catch {
    return DEFAULT_PAGE_SIZE;
  }
}

function saveInvPageSizePreference(value) {
  const normalized = normalizePageSizeValue(value);
  try {
    localStorage.setItem(scopedStorageKey(INV_PAGE_SIZE_STORAGE_BASE), normalized);
  } catch {
    /* ignore */
  }
}

function applyInvPageSize(value) {
  const normalized = normalizePageSizeValue(value);
  invPageSize = normalized === "all" ? Infinity : Number(normalized);
  invCurrentPage = 1;
  const select = document.getElementById("pageSizeSelect");
  if (select) select.value = normalized;
}

function setInvPageSize(value) {
  const normalized = normalizePageSizeValue(value);
  saveInvPageSizePreference(normalized);
  invPageSize = normalized === "all" ? Infinity : Number(normalized);
  invCurrentPage = 1;
  renderInvoicesTable();
  updateInvoiceRowCounter();
  updateInvPaginationUI();
}

function syncPaginationFooterForInvoices() {
  applyInvPageSize(loadInvPageSizePreference());
  updateInvPaginationUI();
  updateInvoiceRowCounter();
}

// ── Table render ─────────────────────────────────────────────────────────────

function renderInvoicesTable() {
  const tbody = document.getElementById("invoiceTableBody");
  if (!tbody) return;

  const visibleColCount = typeof getInvVisibleColumns === "function"
    ? getInvColumnOrder().filter(col => isInvColumnVisible(col)).length
    : INV_COLUMNS.length;

  if (filteredInvoices.length === 0) {
    const msg = (allInvoices ?? []).length === 0
      ? "No invoices yet. Import an Invoice CSV to get started."
      : "No invoices match the current filters.";
    tbody.innerHTML = `<tr class="state-row"><td colspan="${visibleColCount || 1}">${msg}</td></tr>`;
    return;
  }

  const pageInvoices = getPagedInvoices();
  tbody.replaceChildren();
  pageInvoices.forEach(inv => {
    const tr = document.createElement("tr");
    tr.className = "clickable-row";
    if (isTruthy(inv.Flag)) tr.classList.add("row-flagged");
    tr.dataset.inv = String(inv["Invoice #"] ?? "");

    const columnOrder = typeof getInvColumnOrder === "function" ? getInvColumnOrder() : INV_COLUMNS;
    columnOrder.forEach(col => {
      if (typeof isInvColumnVisible === "function" && !isInvColumnVisible(col)) return;

      const td = document.createElement("td");
      td.dataset.col = col;

      if (col === "Selected") {
        renderInvSelectedCell(td, inv);
      } else if (col === "Flag") {
        renderInvFlagCell(td, inv);
      } else if (INV_CURRENCY_COLUMNS.has(col)) {
        const n = toInvNumber(inv[col]);
        td.textContent = n !== 0 ? formatInvCurrency(n) : "—";
        td.className = "td-num";
      } else if (INV_NUMERIC_COLUMNS.has(col)) {
        const n = toInvNumber(inv[col]);
        td.textContent = n !== 0 ? n.toLocaleString() : "—";
        td.className = "td-num";
      } else if (col === "INV DATE") {
        td.textContent = formatInvDate(inv[col]);
      } else if (col === "Status") {
        const status = String(inv[col] ?? "").trim();
        td.textContent = status || "—";
        if (status) td.dataset.status = status.toLowerCase();
      } else {
        td.textContent = String(inv[col] ?? "") || "—";
      }
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
  updateInvSelectAllHeader();
}

// ── Modal ────────────────────────────────────────────────────────────────────

let currentInvoiceModal = null;

function openInvoiceModal(inv) {
  const overlay = document.getElementById("invoiceModalOverlay");
  if (!overlay) return;

  currentInvoiceModal = inv;

  const invoiceNo = String(inv["Invoice #"] ?? "").trim();
  const customer = String(inv.Customer ?? "").trim();
  const status = String(inv.Status ?? "").trim();

  const headingEl = overlay.querySelector(".inv-modal-heading");
  if (headingEl) headingEl.textContent = `Invoice #${invoiceNo}`;
  const subEl = overlay.querySelector(".inv-modal-subheading");
  if (subEl) subEl.textContent = customer || "—";
  const statusEl = overlay.querySelector(".inv-modal-status");
  if (statusEl) {
    statusEl.textContent = status || "";
    statusEl.dataset.status = status.toLowerCase();
    statusEl.hidden = !status;
  }

  const bodyEl = overlay.querySelector(".inv-modal-body");
  if (!bodyEl) return;

  bodyEl.innerHTML = `
<div class="so-header-fields">
  <div class="so-field"><span class="so-field-label">INV DATE</span><span class="so-field-value">${formatInvDate(inv["INV DATE"])}</span></div>
  <div class="so-field"><span class="so-field-label">SO #</span><span class="so-field-value">${escInv(inv["SO #"] ?? "—")}</span></div>
  <div class="so-field"><span class="so-field-label">Pick #</span><span class="so-field-value">${escInv(inv["Pick #"] ?? "—")}</span></div>
  <div class="so-field"><span class="so-field-label">Tracking #</span><span class="so-field-value">${escInv(inv["Tracking #"] ?? "—")}</span></div>
  <div class="so-field"><span class="so-field-label">Unit Qty</span><span class="so-field-value">${escInv(inv["Unit Qty"] ?? "—")}</span></div>
  <div class="so-field"><span class="so-field-label">Sales Commission</span><span class="so-field-value">${escInv(inv["Sales Commission"] ?? "—")}</span></div>
</div>

<div class="so-totals-bar">
  <div class="so-total-item"><span class="so-total-label">Subtotal</span><span class="so-total-value">${formatInvCurrency(inv.Subtotal)}</span></div>
  <div class="so-total-item"><span class="so-total-label">Discount</span><span class="so-total-value">${formatInvCurrency(inv.Discount)}</span></div>
  <div class="so-total-item"><span class="so-total-label">Freight</span><span class="so-total-value">${formatInvCurrency(inv.Freight)}</span></div>
  <div class="so-total-item"><span class="so-total-label">Total</span><span class="so-total-value">${formatInvCurrency(inv.Total)}</span></div>
  <div class="so-total-item"><span class="so-total-label">Received</span><span class="so-total-value">${formatInvCurrency(inv.Received)}</span></div>
  <div class="so-total-item"><span class="so-total-label">Balance</span><span class="so-total-value">${formatInvCurrency(inv.Balance)}</span></div>
</div>

<div class="so-memo-section">
  <div class="so-section-title">Memo</div>
  <textarea class="so-memo-textarea" id="invMemoTextarea" placeholder="Add a memo…" rows="3">${escInv(inv.Memo ?? "")}</textarea>
</div>

<div class="so-memo-section">
  <div class="so-section-title">House Memo</div>
  <textarea class="so-memo-textarea" id="invHouseMemoTextarea" placeholder="Add a house memo…" rows="3">${escInv(inv["House Memo"] ?? "")}</textarea>
  <div class="so-memo-footer">
    <span class="so-memo-status" id="invMemoStatus"></span>
    <button type="button" class="so-memo-save-btn" id="invMemoSaveBtn">Save</button>
  </div>
</div>`;

  const memoTextarea = bodyEl.querySelector("#invMemoTextarea");
  const houseMemoTextarea = bodyEl.querySelector("#invHouseMemoTextarea");
  const memoSaveBtn = bodyEl.querySelector("#invMemoSaveBtn");
  const memoStatus = bodyEl.querySelector("#invMemoStatus");

  if (memoSaveBtn) {
    memoSaveBtn.addEventListener("click", async () => {
      const memo = memoTextarea?.value ?? "";
      const houseMemo = houseMemoTextarea?.value ?? "";
      memoSaveBtn.disabled = true;
      if (memoStatus) { memoStatus.textContent = "Saving…"; memoStatus.className = "so-memo-status"; }
      try {
        const json = await postApi("/api/invoices/memo", { invoiceNo, memo, houseMemo });
        if (!json.success) throw new Error(json.error || "Failed to save.");
        inv.Memo = json.memo;
        inv["House Memo"] = json.houseMemo;
        if (memoStatus) { memoStatus.textContent = "Saved"; memoStatus.className = "so-memo-status is-saved"; }
        renderInvoicesTable();
        setTimeout(() => { if (memoStatus) memoStatus.textContent = ""; }, 2500);
      } catch (err) {
        if (memoStatus) { memoStatus.textContent = err.message || "Error"; memoStatus.className = "so-memo-status is-error"; }
      } finally {
        memoSaveBtn.disabled = false;
      }
    });
  }

  overlay.classList.add("open");
}

function closeInvoiceModal() {
  document.getElementById("invoiceModalOverlay")?.classList.remove("open");
  currentInvoiceModal = null;
}

// ── Init ─────────────────────────────────────────────────────────────────────

function initInvoicesView() {
  loadInvColumnVisibility();
  indexInvTableColumns();
  applyInvColumnOrder();
  applySoInvColumnVisibility();
  applyInvPageSize(loadInvPageSizePreference());
  initInvColumnFilterHeaders();

  initInvSelectionAndFlagControls();

  document.querySelectorAll("#invoiceTable thead th[data-col]:not(.th-filterable):not(.th-flag-col):not(.th-select-col)").forEach(th => {
    th.addEventListener("click", () => sortByInv(th.dataset.col));
  });

  document.getElementById("invoiceSearchInput")?.addEventListener("input", applyInvoiceFilters);

  document.getElementById("navTabInvoices")?.addEventListener("click", () => {
    if (typeof switchAppView === "function") switchAppView("invoices");
  });

  const tbody = document.getElementById("invoiceTableBody");
  if (tbody) {
    tbody.addEventListener("dblclick", e => {
      if (e.target.closest("input, button, .td-select-cell, .td-flag-cell")) return;
      const tr = e.target.closest("tr[data-inv]");
      if (!tr) return;
      const inv = (filteredInvoices ?? []).find(i => String(i["Invoice #"] ?? "") === tr.dataset.inv);
      if (inv) openInvoiceModal(inv);
    });
  }

  document.getElementById("invoiceModalCloseBtn")?.addEventListener("click", closeInvoiceModal);

  const overlay = document.getElementById("invoiceModalOverlay");
  if (overlay) {
    overlay.addEventListener("click", e => {
      if (e.target === overlay) closeInvoiceModal();
    });
  }

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && document.getElementById("invoiceModalOverlay")?.classList.contains("open")) {
      closeInvoiceModal();
    }
  });

  updateInvSortHeaders();
  updateInvColumnFilterHeaderStates();
  updateInvFlagFilterHeaderState();
  updateInvSelectAllHeader();
}

initInvoicesView();
