/** Sales Orders list view and detail modal. */

const SO_SEARCH_COLUMNS = [
  "SO #",
  "Customer",
  "Customer PO #",
  "Division",
  "INVOICE #",
  "INVOICE STATUS",
  "Store",
  "N41 Status",
  "Order Type",
  "Customer Type",
];

const SO_DEFAULT_SORT_COLUMNS = ["SO #", "Order Date"];
const SO_PAGE_SIZE_STORAGE_BASE = "soPageSize";

let filteredSalesOrders = [];
let soFlagFilterActive = false;

const SO_FLAG_ICON_SVG = typeof FLAG_ICON_SVG !== "undefined"
  ? FLAG_ICON_SVG
  : `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`;

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizeSoNumber(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const n = Number(raw);
  return Number.isFinite(n) ? String(n) : raw;
}

function normalizeInvoiceNumber(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const n = Number(raw);
  return Number.isFinite(n) ? String(n) : raw;
}

function findSalesOrderByNumber(soNumber) {
  const key = normalizeSoNumber(soNumber);
  if (!key) return null;
  return (allSalesOrders ?? []).find(order => normalizeSoNumber(order["SO #"]) === key) ?? null;
}

function findInvoiceByNumber(invoiceNo) {
  const key = normalizeInvoiceNumber(invoiceNo);
  if (!key) return null;
  return (allInvoices ?? []).find(inv => normalizeInvoiceNumber(inv["Invoice #"]) === key) ?? null;
}

function getLinkedInvoicesForSalesOrder(order) {
  const soNum = normalizeSoNumber(order?.["SO #"]);
  if (!soNum) return [];
  const seen = new Set();
  return (allInvoices ?? []).filter(inv => {
    if (normalizeSoNumber(inv["SO #"]) !== soNum) return false;
    const invoiceNo = normalizeInvoiceNumber(inv["Invoice #"]);
    if (!invoiceNo || seen.has(invoiceNo)) return false;
    seen.add(invoiceNo);
    return true;
  });
}

function getInvoiceUnitQtyForSalesOrder(order) {
  return getLinkedInvoicesForSalesOrder(order).reduce((sum, inv) => sum + toInvNumberForSo(inv["Unit Qty"]), 0);
}

function getInvoiceSubtotalForSalesOrder(order) {
  return getLinkedInvoicesForSalesOrder(order).reduce((sum, inv) => sum + toInvNumberForSo(inv.Subtotal), 0);
}

function getInvoiceTotalForSalesOrder(order) {
  return getLinkedInvoicesForSalesOrder(order).reduce((sum, inv) => sum + toInvNumberForSo(inv.Total), 0);
}

function getInvoiceStatusesForSalesOrder(order) {
  const statuses = [];
  const seen = new Set();
  getLinkedInvoicesForSalesOrder(order).forEach(inv => {
    const status = String(inv.Status ?? "").trim();
    const key = status.toLowerCase();
    if (!status || seen.has(key)) return;
    seen.add(key);
    statuses.push(status);
  });
  return statuses;
}

function toInvNumberForSo(val) {
  const n = Number(String(val ?? "").replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function getSoComputedColumnValue(col, order) {
  if (col === "INVOICE #") {
    return getLinkedInvoicesForSalesOrder(order)
      .map(inv => String(inv["Invoice #"] ?? "").trim())
      .filter(Boolean)
      .join(", ");
  }
  if (col === "INV QTY") return getInvoiceUnitQtyForSalesOrder(order);
  if (col === "Subtotal") return getInvoiceSubtotalForSalesOrder(order);
  if (col === "TOTAL") return getInvoiceTotalForSalesOrder(order);
  if (col === "INVOICE STATUS") return getInvoiceStatusesForSalesOrder(order).join(", ");
  return undefined;
}

function createRecordLinkButton(text, className, onClick, title) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `record-link ${className || ""}`.trim();
  btn.textContent = text;
  btn.title = title || text;
  btn.addEventListener("click", e => {
    e.stopPropagation();
    onClick();
  });
  return btn;
}

function mountInvoiceLinks(container, invoices, { closeSalesOrder = false, navFrom = null } = {}) {
  if (!container) return;
  container.replaceChildren();
  const linked = (invoices ?? []).filter(inv => String(inv?.["Invoice #"] ?? "").trim());
  if (linked.length === 0) {
    setDisplayText(container, EMPTY_DISPLAY);
    return;
  }
  container.classList.remove("empty-display");
  const list = document.createElement("span");
  list.className = "record-link-list";
  linked.forEach((inv, index) => {
    if (index > 0) list.appendChild(document.createTextNode(", "));
    const invoiceNo = String(inv["Invoice #"] ?? "").trim();
    list.appendChild(createRecordLinkButton(
      invoiceNo,
      "invoice-record-link",
      () => {
        if (closeSalesOrder) closeSalesOrderModal();
        if (navFrom && typeof modalNavPush === "function") modalNavPush(navFrom);
        if (typeof openInvoiceModal === "function") openInvoiceModal(inv);
      },
      `Open invoice ${invoiceNo}`
    ));
  });
  container.appendChild(list);
}

function mountSalesOrderLink(container, soNumber, { closeInvoice = false, closePo = false, navFrom = null } = {}) {
  if (!container) return;
  container.replaceChildren();
  const display = String(soNumber ?? "").trim();
  if (!display) {
    setDisplayText(container, EMPTY_DISPLAY);
    return;
  }
  const order = findSalesOrderByNumber(display);
  if (!order) {
    setDisplayText(container, display);
    return;
  }
  container.classList.remove("empty-display");
  const list = document.createElement("span");
  list.className = "record-link-list";
  list.appendChild(createRecordLinkButton(
    display,
    "so-record-link",
    () => {
      if (closeInvoice && typeof closeInvoiceModal === "function") closeInvoiceModal();
      if (closePo && typeof cancelModalChanges === "function") cancelModalChanges();
      if (navFrom && typeof modalNavPush === "function") modalNavPush(navFrom);
      openSalesOrderModal(order);
    },
    `Open SO ${display}`
  ));
  container.appendChild(list);
}

function renderSalesOrderLinkCell(td, soNumber) {
  td.className = "readonly readonly-no-select";
  mountSalesOrderLink(td, soNumber);
}

function getLinkedSalesOrderForPo(poRow) {
  const orders = allSalesOrders ?? [];
  if (!orders.length || !poRow) return null;

  const soNum = normalizeSoNumber(poRow["SO #"]);
  if (soNum) {
    const bySo = orders.find(o => normalizeSoNumber(o["SO #"]) === soNum);
    if (bySo) return bySo;
  }

  const buyerPo = String(poRow["Buyer PO #"] ?? "").trim();
  if (buyerPo) {
    return orders.find(o => String(o["Customer PO #"] ?? "").trim() === buyerPo) ?? null;
  }

  return null;
}

function getSoCxlDateForPo(poRow) {
  const order = getLinkedSalesOrderForPo(poRow);
  return order?.["CXL Date"] ?? "";
}

function soTotalUnits(order) {
  return (order.Lines ?? []).reduce((sum, line) => {
    return sum + toSoQty(line["Total Units"]);
  }, 0);
}

function soTotalPrice(order) {
  return (order.Lines ?? []).reduce((sum, line) => {
    return sum + toSoQty(line["Ext Price"]);
  }, 0);
}

function toSoQty(val) {
  const n = Number(String(val ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function formatSoPrice(val) {
  const n = toSoQty(val);
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function formatSoDate(val) {
  if (!val) return "—";
  const s = String(val).trim();
  if (!s) return "—";
  if (typeof formatDateForDisplay === "function") return formatDateForDisplay(s) || s;
  return s;
}

function renderSoSelectedCell(td, order) {
  td.className = "td-select-cell readonly-no-select";
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.className = "po-select-checkbox";
  cb.checked = isTruthy(order.Selected);
  cb.setAttribute("aria-label", `Select SO ${order["SO #"] ?? ""}`);
  cb.addEventListener("click", e => {
    e.stopPropagation();
    order.Selected = cb.checked;
    updateSoSelectAllHeader();
  });
  td.appendChild(cb);
}

function createSoFlagButton(order) {
  const flagged = isTruthy(order.Flag);
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "po-flag-btn" + (flagged ? " is-flagged" : "");
  btn.setAttribute("aria-label", flagged ? "Unflag sales order" : "Flag sales order");
  btn.title = flagged ? "Unflag" : "Flag";
  btn.innerHTML = SO_FLAG_ICON_SVG;
  btn.addEventListener("click", e => {
    e.stopPropagation();
    toggleSalesOrderFlag(order);
  });
  return btn;
}

function renderSoFlagCell(td, order) {
  td.className = "td-flag-cell readonly-no-select";
  td.replaceChildren(createSoFlagButton(order));
}

async function toggleSalesOrderFlag(order) {
  if (isAppSaving()) return;
  const soNumber = String(order["SO #"] ?? "").trim();
  if (!soNumber) return;

  const previous = isTruthy(order.Flag);
  const next = !previous;
  order.Flag = next;
  renderSalesOrdersTable();

  try {
    const json = await postApi("/api/sales-orders/flag", { soNumber, flag: next });
    if (!json.success) throw new Error(json.error || "Failed to save flag.");
    order.Flag = json.flag;
    renderSalesOrdersTable();
  } catch (err) {
    order.Flag = previous;
    renderSalesOrdersTable();
    if (typeof showIndicator === "function") {
      showIndicator("Flag save failed: " + (err.message || err), "error");
    }
  }
}

function updateSoSelectAllHeader() {
  const cb = document.getElementById("soSelectAllRowsCheckbox");
  if (!cb) return;

  if (filteredSalesOrders.length === 0) {
    cb.checked = false;
    cb.indeterminate = false;
    cb.disabled = true;
    return;
  }

  cb.disabled = false;
  const selectedCount = filteredSalesOrders.filter(order => isTruthy(order.Selected)).length;
  cb.checked = selectedCount === filteredSalesOrders.length;
  cb.indeterminate = selectedCount > 0 && selectedCount < filteredSalesOrders.length;
}

function setAllFilteredSalesOrdersSelected(selected) {
  const next = toSheetBool(selected);
  filteredSalesOrders.forEach(order => {
    order.Selected = next;
  });
  renderSalesOrdersTable();
}

function updateSoFlagFilterHeaderState() {
  const th = document.querySelector('#salesOrderTable th.th-flag-col[data-col="Flag"]');
  if (!th) return;
  th.classList.toggle("filter-active", soFlagFilterActive);
  th.setAttribute("aria-pressed", soFlagFilterActive ? "true" : "false");
  th.title = soFlagFilterActive ? "Show all sales orders" : "Show flagged only";
}

function toggleSoFlagFilter() {
  soFlagFilterActive = !soFlagFilterActive;
  updateSoFlagFilterHeaderState();
  applySalesOrderFilters();
}

function initSoSelectionAndFlagControls() {
  const selectAll = document.getElementById("soSelectAllRowsCheckbox");
  selectAll?.addEventListener("click", e => {
    e.stopPropagation();
    setAllFilteredSalesOrdersSelected(selectAll.checked);
  });

  const flagHeader = document.querySelector('#salesOrderTable th.th-flag-col[data-col="Flag"]');
  if (flagHeader) {
    flagHeader.setAttribute("role", "button");
    flagHeader.setAttribute("aria-pressed", "false");
    flagHeader.title = "Show flagged only";
    flagHeader.addEventListener("click", toggleSoFlagFilter);
  }
}

// ── State ────────────────────────────────────────────────────────────────────

function onSalesOrdersDataLoaded(rows) {
  allSalesOrders = (rows ?? []).map(row => ({
    ...row,
    Division: typeof normalizeDivision === "function" ? normalizeDivision(row.Division) : String(row.Division ?? "").trim(),
  }));
  applySalesOrderFilters();
  if (typeof applyInvoiceFilters === "function") applyInvoiceFilters();
  if (
    (allRows ?? []).length > 0
    && typeof currentAppView !== "undefined"
    && currentAppView === "po"
    && typeof applyFilters === "function"
  ) {
    applyFilters();
  }
}

function getSoSortValue(order, col) {
  const computed = getSoComputedColumnValue(col, order);
  if (computed !== undefined) return computed;
  if (col === "Styles") return (order.Lines ?? []).length;
  if (col === "Style #s") return (order.Lines ?? []).map(l => l["Style #"] ?? "").join(", ");
  if (col === "Total Units") return soTotalUnits(order);
  if (col === "Total Price") return soTotalPrice(order);
  return order[col];
}

function compareSoOrdersByColumn(col, a, b) {
  if (SO_DATE_FILTER_COLUMNS.has(col)) {
    return compareDateFieldValues(a[col], b[col]);
  }
  if (
    col === "Styles"
    || col === "Style #s"
    || col === "Total Units"
    || col === "Total Price"
    || col === "INV QTY"
    || col === "Subtotal"
    || col === "TOTAL"
  ) {
    return compareTextFieldValues(getSoSortValue(a, col), getSoSortValue(b, col));
  }
  if (col === "SO #") {
    const an = Number(String(a["SO #"] ?? ""));
    const bn = Number(String(b["SO #"] ?? ""));
    if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
  }
  return compareTextFieldValues(a[col], b[col]);
}

function compareSoOrdersForSort(a, b) {
  if (soSortCol) {
    const primary = compareSoOrdersByColumn(soSortCol, a, b) * soSortDir;
    if (primary !== 0) return primary;
    for (const col of SO_DEFAULT_SORT_COLUMNS) {
      if (col === soSortCol) continue;
      const cmp = compareSoOrdersByColumn(col, a, b);
      if (cmp !== 0) return cmp;
    }
    return 0;
  }
  for (const col of SO_DEFAULT_SORT_COLUMNS) {
    const cmp = compareSoOrdersByColumn(col, a, b);
    if (cmp !== 0) return cmp;
  }
  return 0;
}

function applySalesOrderFilters() {
  const q = (document.getElementById("salesOrderSearchInput")?.value ?? "").trim().toLowerCase();
  filteredSalesOrders = (allSalesOrders ?? []).filter(order => {
    if (soFlagFilterActive && !isTruthy(order.Flag)) return false;
    if (typeof rowPassesSoToolbarFilters === "function" && !rowPassesSoToolbarFilters(order)) return false;
    if (typeof rowPassesSoColumnFilters === "function" && !rowPassesSoColumnFilters(order)) return false;
    if (!q) return true;
    const haystack = SO_SEARCH_COLUMNS
      .map(col => String(getSoComputedColumnValue(col, order) ?? order[col] ?? ""))
      .join(" ")
      .toLowerCase();
    if (haystack.includes(q)) return true;
    const lineHaystack = (order.Lines ?? [])
      .map(l => [l["Style #"], l.Color, l["Style Description"]].join(" "))
      .join(" ")
      .toLowerCase();
    return lineHaystack.includes(q);
  });

  filteredSalesOrders.sort(compareSoOrdersForSort);
  soCurrentPage = 1;
  renderSalesOrdersTable();
  updateSalesOrderRowCounter();
  updateSoSelectAllHeader();
  updateSoClearAllFiltersButton();
  if (typeof updateSoPaginationUI === "function") updateSoPaginationUI();
  updateSoFlagFilterHeaderState();
}

function sortBySo(col) {
  if (soSortCol === col) {
    if (soSortDir === 1) soSortDir = -1;
    else {
      soSortCol = null;
      soSortDir = 1;
    }
  } else {
    soSortCol = col;
    soSortDir = 1;
  }
  updateSoSortHeaders();
  applySalesOrderFilters();
}

function updateSoSortHeaders() {
  document.querySelectorAll("#salesOrderTable thead th[data-col]").forEach(th => {
    th.classList.remove("sorted-asc", "sorted-desc");
    if (soSortCol && th.dataset.col === soSortCol) {
      th.classList.add(soSortDir === 1 ? "sorted-asc" : "sorted-desc");
    }
  });
}

function isSoPageSizeAll() {
  return !Number.isFinite(soPageSize);
}

function getSoTotalPages() {
  if (isSoPageSizeAll() || filteredSalesOrders.length === 0) return 1;
  return Math.ceil(filteredSalesOrders.length / soPageSize);
}

function getPagedSalesOrders() {
  if (isSoPageSizeAll()) return filteredSalesOrders;
  const totalPages = getSoTotalPages();
  soCurrentPage = Math.min(Math.max(1, soCurrentPage), totalPages);
  const start = (soCurrentPage - 1) * soPageSize;
  return filteredSalesOrders.slice(start, start + soPageSize);
}

function getSalesOrderRowCounterText() {
  const total = filteredSalesOrders.length;
  if (total === 0) return "0 sales orders";
  if (isSoPageSizeAll()) {
    return total === 1 ? "1 sales order" : `${total} sales orders`;
  }
  const start = (soCurrentPage - 1) * soPageSize + 1;
  const end = Math.min(soCurrentPage * soPageSize, total);
  return `${start}${EN_DASH}${end} of ${total}`;
}

function updateSalesOrderRowCounter() {
  const el = document.getElementById("salesOrderRowCounter");
  if (!el) return;
  el.textContent = getSalesOrderRowCounterText();
}

function updateSoPaginationUI() {
  const nav = document.getElementById("paginationNav");
  if (!nav) return;

  const totalPages = getSoTotalPages();
  const showPagination = !isSoPageSizeAll() && filteredSalesOrders.length > soPageSize;
  nav.hidden = !showPagination;
  if (!showPagination) return;

  const indicator = document.getElementById("pageIndicator");
  if (indicator) indicator.textContent = `${soCurrentPage} / ${totalPages}`;

  const first = document.getElementById("pageFirst");
  const prev = document.getElementById("pagePrev");
  const next = document.getElementById("pageNext");
  const last = document.getElementById("pageLast");
  const onFirst = soCurrentPage <= 1;
  const onLast = soCurrentPage >= totalPages;

  if (first) first.disabled = onFirst;
  if (prev) prev.disabled = onFirst;
  if (next) next.disabled = onLast;
  if (last) last.disabled = onLast;
}

function scrollSalesOrderTableToTop() {
  document.getElementById("salesOrderTableWrap")?.scrollTo({ top: 0 });
}

function goToSoPage(page) {
  const totalPages = getSoTotalPages();
  const nextPage = Math.min(Math.max(1, page), totalPages);
  if (nextPage === soCurrentPage) return;
  soCurrentPage = nextPage;
  renderSalesOrdersTable();
  updateSalesOrderRowCounter();
  updateSoPaginationUI();
  scrollSalesOrderTableToTop();
}

function loadSoPageSizePreference() {
  try {
    const stored = localStorage.getItem(scopedStorageKey(SO_PAGE_SIZE_STORAGE_BASE));
    if (stored == null) return DEFAULT_PAGE_SIZE;
    return normalizePageSizeValue(stored);
  } catch {
    return DEFAULT_PAGE_SIZE;
  }
}

function saveSoPageSizePreference(value) {
  const normalized = normalizePageSizeValue(value);
  try {
    localStorage.setItem(scopedStorageKey(SO_PAGE_SIZE_STORAGE_BASE), normalized);
  } catch {
    /* ignore */
  }
}

function applySoPageSize(value) {
  const normalized = normalizePageSizeValue(value);
  soPageSize = normalized === "all" ? Infinity : Number(normalized);
  soCurrentPage = 1;
  const select = document.getElementById("pageSizeSelect");
  if (select) select.value = normalized;
}

function setSoPageSize(value) {
  const normalized = normalizePageSizeValue(value);
  saveSoPageSizePreference(normalized);
  soPageSize = normalized === "all" ? Infinity : Number(normalized);
  soCurrentPage = 1;
  renderSalesOrdersTable();
  updateSalesOrderRowCounter();
  updateSoPaginationUI();
}

function syncPaginationFooterForSales() {
  applySoPageSize(loadSoPageSizePreference());
  updateSoPaginationUI();
  updateSalesOrderRowCounter();
}

function syncPaginationFooterForPo() {
  if (typeof applyPageSize === "function") applyPageSize(loadPageSizePreference());
  if (typeof updatePaginationUI === "function") updatePaginationUI();
  if (typeof updateRowCounter === "function") updateRowCounter();
}

// ── Table render ─────────────────────────────────────────────────────────────

function renderSalesOrdersTable() {
  const tbody = document.getElementById("salesOrderTableBody");
  if (!tbody) return;

  const visibleColCount = typeof getSoVisibleColumns === "function"
    ? getSoColumnOrder().filter(col => isSoColumnVisible(col)).length
    : SO_COLUMNS.length;

  if (filteredSalesOrders.length === 0) {
    const msg = (allSalesOrders ?? []).length === 0
      ? "No sales orders yet. Import a Sales Order Details CSV to get started."
      : "No sales orders match the current filters.";
    tbody.innerHTML = `<tr class="state-row"><td colspan="${visibleColCount || 1}">${msg}</td></tr>`;
    return;
  }

  const pageOrders = getPagedSalesOrders();
  tbody.replaceChildren();
  pageOrders.forEach(order => {
    const tr = document.createElement("tr");
    tr.className = "clickable-row";
    if (isTruthy(order.Flag)) tr.classList.add("row-flagged");
    tr.dataset.so = String(order["SO #"] ?? "");

    const columnOrder = typeof getSoColumnOrder === "function" ? getSoColumnOrder() : SO_COLUMNS;
    columnOrder.forEach(col => {
      if (typeof isSoColumnVisible === "function" && !isSoColumnVisible(col)) return;

      const td = document.createElement("td");
      td.dataset.col = col;

      if (col === "Selected") {
        renderSoSelectedCell(td, order);
      } else if (col === "Flag") {
        renderSoFlagCell(td, order);
      } else if (col === "SO #") {
        renderSalesOrderLinkCell(td, order["SO #"]);
      } else if (col === "INVOICE #") {
        td.className = "readonly readonly-no-select";
        mountInvoiceLinks(td, getLinkedInvoicesForSalesOrder(order));
      } else if (col === "INV QTY") {
        const qty = getInvoiceUnitQtyForSalesOrder(order);
        td.className = "td-num";
        if (qty > 0) {
          td.textContent = qty.toLocaleString();
          td.classList.remove("empty-display");
        } else {
          setDisplayText(td, EMPTY_DISPLAY);
        }
      } else if (col === "Subtotal") {
        const subtotal = getInvoiceSubtotalForSalesOrder(order);
        td.className = "td-num";
        if (subtotal > 0) {
          td.textContent = formatSoPrice(subtotal);
          td.classList.remove("empty-display");
        } else {
          setDisplayText(td, EMPTY_DISPLAY);
        }
      } else if (col === "TOTAL") {
        const total = getInvoiceTotalForSalesOrder(order);
        td.className = "td-num";
        if (total > 0) {
          td.textContent = formatSoPrice(total);
          td.classList.remove("empty-display");
        } else {
          setDisplayText(td, EMPTY_DISPLAY);
        }
      } else if (col === "INVOICE STATUS") {
        const status = getInvoiceStatusesForSalesOrder(order).join(", ");
        if (status) {
          mountSearchHighlightedText(td, status, status);
          td.dataset.status = status.toLowerCase();
          td.classList.remove("empty-display");
        } else {
          setDisplayText(td, EMPTY_DISPLAY);
        }
      } else if (col === "Styles") {
        td.textContent = String((order.Lines ?? []).length);
        td.className = "td-num";
      } else if (col === "Style #s") {
        const styleNums = (order.Lines ?? []).map(l => String(l["Style #"] ?? "").trim()).filter(Boolean);
        mountSearchHighlightedText(td, styleNums.length ? styleNums.join(", ") : EMPTY_DISPLAY, styleNums.join(", "));
      } else if (col === "Memo") {
        mountSearchHighlightedText(td, String(order.Memo ?? ""), order.Memo);
      } else if (col === "Total Units") {
        td.textContent = soTotalUnits(order).toLocaleString();
        td.className = "td-num";
      } else if (col === "Total Price") {
        td.textContent = formatSoPrice(soTotalPrice(order));
        td.className = "td-num";
      } else if (["Order Date", "Ship Date", "CXL Date"].includes(col)) {
        mountSearchHighlightedText(td, formatSoDate(order[col]), order[col]);
      } else if (col === "N41 Status") {
        const status = String(order[col] ?? "").trim();
        mountSearchHighlightedText(td, status || EMPTY_DISPLAY, status);
        if (status) td.dataset.status = status.toLowerCase();
      } else {
        mountSearchHighlightedText(td, String(order[col] ?? "") || EMPTY_DISPLAY, order[col]);
      }
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
  updateSoSelectAllHeader();
}

// ── Modal ────────────────────────────────────────────────────────────────────

let currentSalesOrderModal = null;

function getSizeLabelsForLine(line) {
  // Try the style master index if available
  if (typeof getStyleMasterForRow === "function") {
    const master = getStyleMasterForRow({ "Style #": line["Style #"], Color: line.Color });
    if (master) {
      const labels = [];
      for (let i = 1; i <= 15; i++) {
        const lbl = String(master[`Size ${i}`] ?? "").trim();
        if (lbl) labels.push(lbl);
      }
      if (labels.length > 0) return labels;
    }
  }
  // Fall back to "1" … "N" up to sizeQty
  const n = Math.max(1, Number(line["Size Qty"] ?? 0));
  return Array.from({ length: n }, (_, i) => String(i + 1));
}

/** Dimmed em-dash placeholder for empty cells in the SO style table. */
const SO_EMPTY_DASH = '<span class="so-dash">—</span>';

/** escSo(value), or the dimmed em-dash placeholder when value is empty. */
function soDashOr(value) {
  const s = String(value ?? "").trim();
  return s === "" ? SO_EMPTY_DASH : escSo(s);
}

function buildSoLineItemsTable(lines, order = null) {
  if (!lines || lines.length === 0) {
    return "<p class='so-modal-empty'>No style lines.</p>";
  }

  // Determine max active size columns across all lines
  let maxSizeQty = 0;
  lines.forEach(l => {
    maxSizeQty = Math.max(maxSizeQty, Number(l["Size Qty"] ?? 0));
  });
  maxSizeQty = Math.min(Math.max(maxSizeQty, 1), 15);

  // Gather size label headers from first line that has style master data
  let sizeHeaders = [];
  for (const line of lines) {
    const labels = getSizeLabelsForLine(line);
    if (labels.length >= maxSizeQty) {
      sizeHeaders = labels.slice(0, maxSizeQty);
      break;
    }
  }
  if (sizeHeaders.length < maxSizeQty) {
    sizeHeaders = Array.from({ length: maxSizeQty }, (_, i) => String(i + 1));
  }

  const orderCxlReason = String(order?.["CXL Reason"] ?? "").trim();

  let html = `
<div class="so-line-table-wrap">
<table class="so-line-table">
<thead>
<tr>
  <th class="so-style-col">Style #</th>
  <th class="so-desc-col">Description</th>
  <th class="so-color-col">Color</th>
  <th class="so-status-col">Status</th>
  <th class="so-cxl-reason-col">CXL Reason</th>
  ${sizeHeaders.map(h => `<th class="so-size-col">${escSo(h)}</th>`).join("")}
  <th class="so-total-col">Total</th>
  <th class="so-price-col">Price</th>
  <th class="so-price-col">Ext Price</th>
</tr>
</thead>
<tbody>`;

  let sumUnits = 0;
  let sumExtPrice = 0;
  lines.forEach(line => {
    const sizeQty = Math.min(Number(line["Size Qty"] ?? maxSizeQty), 15);
    const unitCells = [];
    let lineTotal = 0;
    for (let i = 1; i <= maxSizeQty; i++) {
      if (i <= sizeQty) {
        const qty = toSoQty(line[`Unit ${i}`]);
        lineTotal += qty;
        unitCells.push(`<td class="so-size-col td-qty">${qty > 0 ? qty.toLocaleString() : SO_EMPTY_DASH}</td>`);
      } else {
        unitCells.push(`<td class="so-size-col td-qty so-cell-empty">—</td>`);
      }
    }
    const totalUnits = toSoQty(line["Total Units"]) || lineTotal;
    const price = toSoQty(line["Price"]);
    const extPrice = toSoQty(line["Ext Price"]);
    const statusVal = String(line["Style Order Status"] ?? "").trim();
    const cxlReason = String(line["CXL Reason"] ?? "").trim() || orderCxlReason;
    sumUnits += totalUnits;
    sumExtPrice += extPrice;
    html += `
<tr>
  <td class="so-style-col">${soDashOr(line["Style #"])}</td>
  <td class="so-desc-col">${escSo(line["Style Description"] ?? "")}</td>
  <td class="so-color-col">${soDashOr(line.Color)}</td>
  <td class="so-status-col"><span class="so-status-badge" data-status="${escSo(statusVal.toLowerCase())}">${statusVal ? escSo(statusVal) : SO_EMPTY_DASH}</span></td>
  <td class="so-cxl-reason-col">${cxlReason ? escSo(cxlReason) : SO_EMPTY_DASH}</td>
  ${unitCells.join("")}
  <td class="so-total-col td-qty">${totalUnits.toLocaleString()}</td>
  <td class="so-price-col td-num">${price > 0 ? formatSoPrice(price) : SO_EMPTY_DASH}</td>
  <td class="so-price-col td-num">${extPrice > 0 ? formatSoPrice(extPrice) : SO_EMPTY_DASH}</td>
</tr>`;
  });

  // Totals row: style count under Style #, total units under Total,
  // total price under Ext Price.
  html += `
</tbody>
<tfoot>
<tr class="so-line-totals-row">
  <td class="so-style-col">${lines.length} Style${lines.length === 1 ? "" : "s"}</td>
  <td class="so-desc-col"></td>
  <td class="so-color-col"></td>
  <td class="so-status-col"></td>
  <td class="so-cxl-reason-col"></td>
  ${sizeHeaders.map(() => `<td class="so-size-col"></td>`).join("")}
  <td class="so-total-col td-qty">${sumUnits.toLocaleString()}</td>
  <td class="so-price-col"></td>
  <td class="so-price-col td-num">${formatSoPrice(sumExtPrice)}</td>
</tr>
</tfoot>
</table></div>`;
  return html;
}

function buildLinkedPosSection(order) {
  const soNum = String(order["SO #"] ?? "").trim();
  const custPo = String(order["Customer PO #"] ?? "").trim();

  const linked = (typeof allRows !== "undefined" ? allRows : []).filter(po => {
    const poSo = String(po["SO #"] ?? "").trim();
    const poBuyerPo = String(po["Buyer PO #"] ?? "").trim();
    return (soNum && poSo === soNum) || (custPo && poBuyerPo === custPo);
  });

  if (linked.length === 0) {
    return `<div class="so-linked-pos">
  <div class="so-section-title">Linked Purchase Orders</div>
  <p class="so-linked-empty">No linked POs found.</p>
</div>`;
  }

  const items = linked.map(po => {
    const poNum = String(po["PO #"] ?? "").trim();
    const style = String(po["Style #"] ?? "").trim();
    const color = String(po["Color"] ?? "").trim();
    const status = String(po["Status"] ?? "").trim();
    const vendor = String(po["Vendor"] ?? "").trim();
    const qty = po["PO Qty"] ?? "";
    return `<button type="button" class="so-linked-po-btn" data-po="${escSo(poNum)}">
  <span class="so-linked-po-num">PO #${escSo(poNum)}</span>
  <span class="so-linked-po-meta">${escSo([style, color].filter(Boolean).join(" / "))}${vendor ? " · " + escSo(vendor) : ""}${qty ? " · Qty " + qty : ""}${status ? " · " + escSo(status) : ""}</span>
</button>`;
  }).join("");

  return `<div class="so-linked-pos">
  <div class="so-section-title">Linked Purchase Orders <span class="so-linked-count">(${linked.length})</span></div>
  <div class="so-linked-po-list">${items}</div>
</div>`;
}

function buildLinkedInvoicesSection(order) {
  const linked = getLinkedInvoicesForSalesOrder(order);
  if (linked.length === 0) {
    return `<div class="so-linked-invoices">
  <div class="so-section-title">Linked Invoices</div>
  <p class="so-linked-empty">No linked invoices found.</p>
</div>`;
  }

  const items = linked.map(inv => {
    const invoiceNo = String(inv["Invoice #"] ?? "").trim();
    const qty = toInvNumberForSo(inv["Unit Qty"]);
    const total = toInvNumberForSo(inv.Total);
    const status = String(inv.Status ?? "").trim();
    return `<button type="button" class="so-linked-po-btn so-linked-invoice-btn" data-invoice="${escSo(invoiceNo)}">
  <span class="so-linked-po-num">Invoice #${escSo(invoiceNo)}</span>
  <span class="so-linked-po-meta">${qty > 0 ? "Qty " + qty.toLocaleString() : "Qty —"}${total > 0 ? " · " + escSo(formatSoPrice(total)) : ""}${status ? " · " + escSo(status) : ""}</span>
</button>`;
  }).join("");

  return `<div class="so-linked-invoices">
  <div class="so-section-title">Linked Invoices <span class="so-linked-count">(${linked.length})</span></div>
  <div class="so-linked-po-list">${items}</div>
</div>`;
}

function formatSoCommentTime(at) {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "";
  const date = `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}`;
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${date}, ${time}`;
}

/** Render the conversation thread in the SO modal (DOM-built, so comment text is inert). */
function renderSoCommentsList(order) {
  const list = document.getElementById("soCommentsList");
  const count = document.getElementById("soCommentsCount");
  if (!list) return;

  const comments = Array.isArray(order?.Comments) ? order.Comments : [];
  if (count) count.textContent = comments.length ? `(${comments.length})` : "";

  list.innerHTML = "";
  if (comments.length === 0) {
    const empty = document.createElement("p");
    empty.className = "so-comments-empty";
    empty.textContent = "No comments yet.";
    list.appendChild(empty);
    return;
  }

  const myId = typeof getCurrentUserId === "function" ? getCurrentUserId() : "";
  const myEmail = typeof getCurrentUserEmail === "function" ? getCurrentUserEmail() : "";
  comments.forEach(c => {
    const authorId = String(c?.authorId ?? "");
    const isOwn = (Boolean(myId) && authorId === myId) ||
      (!authorId && Boolean(myEmail) && String(c?.author ?? "") === myEmail);
    const label = typeof getUserDisplayLabel === "function"
      ? getUserDisplayLabel(authorId, String(c?.author ?? ""))
      : String(c?.author ?? "Unknown");
    const item = document.createElement("div");
    item.className = "so-comment" + (isOwn ? " is-own" : "");

    const meta = document.createElement("div");
    meta.className = "so-comment-meta";
    const author = document.createElement("span");
    author.className = "so-comment-author";
    author.textContent = isOwn ? "You" : label;
    const time = document.createElement("span");
    time.className = "so-comment-time";
    time.textContent = formatSoCommentTime(c?.at);
    meta.appendChild(author);
    meta.appendChild(time);

    const text = document.createElement("div");
    text.className = "so-comment-text";
    text.textContent = String(c?.text ?? "");

    item.appendChild(meta);
    item.appendChild(text);
    list.appendChild(item);
  });
  list.scrollTop = list.scrollHeight;
}

function openSalesOrderModal(order) {
  const overlay = document.getElementById("salesOrderModalOverlay");
  if (!overlay) return;

  currentSalesOrderModal = order;

  const soNum = String(order["SO #"] ?? "").trim();
  const customer = String(order.Customer ?? "").trim();
  const status = String(order["N41 Status"] ?? "").trim();

  const backBtn = document.getElementById("salesOrderModalBackBtn");
  if (backBtn) backBtn.hidden = !(typeof modalNavOnOpen === "function" && modalNavOnOpen());

  // Header
  const headingEl = overlay.querySelector(".so-modal-heading");
  if (headingEl) headingEl.textContent = `SO #${soNum}`;
  const subEl = overlay.querySelector(".so-modal-subheading");
  if (subEl) subEl.textContent = customer || "—";
  const statusEl = overlay.querySelector(".so-modal-status");
  if (statusEl) {
    statusEl.textContent = status || "";
    statusEl.dataset.status = status.toLowerCase();
    statusEl.hidden = !status;
  }

  const lines = order.Lines ?? [];
  const linkedInvoices = getLinkedInvoicesForSalesOrder(order);
  const invoiceUnitQty = getInvoiceUnitQtyForSalesOrder(order);
  const invoiceTotal = getInvoiceTotalForSalesOrder(order);
  const invoiceStatus = getInvoiceStatusesForSalesOrder(order).join(", ");

  // Build modal body
  const bodyEl = overlay.querySelector(".so-modal-body");
  if (!bodyEl) return;

  // Showroom portal: no invoice fields, no linked invoices/POs, no memo.
  const portal = typeof isPortalMode === "function" && isPortalMode();

  const invoiceHeaderFields = portal ? "" : `
  <div class="so-field"><span class="so-field-label">Invoice #</span><span class="so-field-value" data-so-invoice-links></span></div>
  <div class="so-field"><span class="so-field-label">Invoice Unit Qty</span><span class="so-field-value">${invoiceUnitQty > 0 ? invoiceUnitQty.toLocaleString() : "—"}</span></div>
  <div class="so-field"><span class="so-field-label">Total</span><span class="so-field-value">${invoiceTotal > 0 ? formatSoPrice(invoiceTotal) : "—"}</span></div>
  <div class="so-field"><span class="so-field-label">Invoice Status</span><span class="so-field-value">${escSo(invoiceStatus || "—")}</span></div>`;

  const memoSection = portal ? "" : `
<div class="so-memo-section">
  <div class="so-section-title">Memo</div>
  <textarea class="so-memo-textarea" id="soMemoTextarea" placeholder="Add a note for this sales order…" rows="3">${escSo(order.Memo ?? "")}</textarea>
  <div class="so-memo-footer">
    <span class="so-memo-status" id="soMemoStatus"></span>
    <button type="button" class="so-memo-save-btn" id="soMemoSaveBtn">Save</button>
  </div>
</div>`;

  bodyEl.innerHTML = `
<div class="so-modal-columns">
<div class="so-modal-main">
<div class="so-header-fields">
  <div class="so-field"><span class="so-field-label">Customer PO #</span><span class="so-field-value">${escSo(order["Customer PO #"] ?? "—")}</span></div>
  <div class="so-field"><span class="so-field-label">Division</span><span class="so-field-value">${escSo(order.Division ?? "—")}</span></div>
  <div class="so-field"><span class="so-field-label">Order Date</span><span class="so-field-value">${formatSoDate(order["Order Date"])}</span></div>
  <div class="so-field"><span class="so-field-label">Ship Date</span><span class="so-field-value">${formatSoDate(order["Ship Date"])}</span></div>
  <div class="so-field"><span class="so-field-label">CXL Date</span><span class="so-field-value">${formatSoDate(order["CXL Date"])}</span></div>
  <div class="so-field"><span class="so-field-label">Store</span><span class="so-field-value">${escSo(order.Store ?? "—")}</span></div>
  <div class="so-field"><span class="so-field-label">Order Type</span><span class="so-field-value">${escSo(order["Order Type"] ?? "—")}</span></div>
  <div class="so-field"><span class="so-field-label">Customer Type</span><span class="so-field-value">${escSo(order["Customer Type"] ?? "—")}</span></div>${invoiceHeaderFields}
</div>

<div class="so-lines-section">
  ${buildSoLineItemsTable(lines, order)}
</div>

${portal ? "" : buildLinkedInvoicesSection(order)}
${memoSection}
${portal ? "" : buildLinkedPosSection(order)}
</div>

<aside class="so-modal-side">
<div class="so-comments-section">
  <div class="so-section-title">Comments <span class="so-linked-count" id="soCommentsCount"></span></div>
  <div class="so-comments-list" id="soCommentsList"></div>
  <div class="so-comment-composer">
    <textarea class="so-comment-input" id="soCommentInput" rows="2" placeholder="Write a comment…"></textarea>
    <button type="button" class="btn btn-primary so-comment-post-btn" id="soCommentPostBtn">Post</button>
  </div>
</div>
</aside>
</div>`;

  if (!portal) {
    mountInvoiceLinks(bodyEl.querySelector("[data-so-invoice-links]"), linkedInvoices, {
      closeSalesOrder: true,
      navFrom: { type: "so", id: soNum },
    });
  }

  // Comments thread (shared between the internal team and the portal).
  renderSoCommentsList(order);
  const commentInput = bodyEl.querySelector("#soCommentInput");
  const commentPostBtn = bodyEl.querySelector("#soCommentPostBtn");
  if (commentInput && commentPostBtn) {
    const postComment = async () => {
      const text = commentInput.value.trim();
      if (!text) return;
      commentPostBtn.disabled = true;
      try {
        const json = await postApi("/api/sales-orders/comment", { soNumber: soNum, text });
        if (!json.success) throw new Error(json.error || "Failed to post comment.");
        order.Comments = json.comments;
        commentInput.value = "";
        renderSoCommentsList(order);
      } catch (err) {
        showIndicator("Comment failed: " + err.message, "error");
      } finally {
        commentPostBtn.disabled = false;
      }
    };
    commentPostBtn.addEventListener("click", postComment);
    commentInput.addEventListener("keydown", e => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        postComment();
      }
    });
  }

  // Wire Memo save button
  const memoTextarea = bodyEl.querySelector("#soMemoTextarea");
  const memoSaveBtn = bodyEl.querySelector("#soMemoSaveBtn");
  const memoStatus = bodyEl.querySelector("#soMemoStatus");

  if (memoSaveBtn && memoTextarea) {
    let savedMemo = String(order.Memo ?? "");
    const updateMemoSaveVisibility = () => {
      memoSaveBtn.hidden = memoTextarea.value === savedMemo;
    };
    updateMemoSaveVisibility();
    memoTextarea.addEventListener("input", updateMemoSaveVisibility);

    memoSaveBtn.addEventListener("click", async () => {
      const memo = memoTextarea.value;
      memoSaveBtn.disabled = true;
      if (memoStatus) { memoStatus.textContent = "Saving…"; memoStatus.className = "so-memo-status"; }
      try {
        const json = await postApi("/api/sales-orders/memo", { soNumber: soNum, memo });
        if (!json.success) throw new Error(json.error || "Failed to save memo.");
        order.Memo = json.memo;
        savedMemo = String(json.memo ?? "");
        updateMemoSaveVisibility();
        if (memoStatus) { memoStatus.textContent = "Saved"; memoStatus.className = "so-memo-status is-saved"; }
        renderSalesOrdersTable();
        setTimeout(() => { if (memoStatus) memoStatus.textContent = ""; }, 2500);
      } catch (err) {
        if (memoStatus) { memoStatus.textContent = err.message || "Error"; memoStatus.className = "so-memo-status is-error"; }
      } finally {
        memoSaveBtn.disabled = false;
      }
    });
  }

  // Wire linked PO buttons
  bodyEl.querySelectorAll(".so-linked-po-btn[data-po]").forEach(btn => {
    btn.addEventListener("click", () => {
      const poNumber = btn.dataset.po;
      const poRow = (typeof allRows !== "undefined" ? allRows : [])
        .find(po => String(po["PO #"] ?? "").trim() === poNumber);
      if (!poRow || typeof openPODetail !== "function") return;
      closeSalesOrderModal();
      if (typeof modalNavPush === "function") modalNavPush({ type: "so", id: soNum });
      openPODetail(poRow);
    });
  });

  bodyEl.querySelectorAll(".so-linked-invoice-btn[data-invoice]").forEach(btn => {
    btn.addEventListener("click", () => {
      const inv = findInvoiceByNumber(btn.dataset.invoice);
      if (!inv) return;
      closeSalesOrderModal();
      if (typeof modalNavPush === "function") modalNavPush({ type: "so", id: soNum });
      if (typeof openInvoiceModal === "function") openInvoiceModal(inv);
    });
  });

  overlay.classList.add("open");
}

function closeSalesOrderModal() {
  document.getElementById("salesOrderModalOverlay")?.classList.remove("open");
  currentSalesOrderModal = null;
}

// ── Link from PO table SO # cell ─────────────────────────────────────────────

function initSoLinkFromPoTable() {
  const tbody = document.getElementById("tableBody");
  if (!tbody) return;

  tbody.addEventListener("click", e => {
    const td = e.target.closest("td[data-col='SO #']");
    if (!td) return;
    const tr = td.closest("tr[data-po]");
    if (!tr) return;

    const poRow = typeof findRowByPo === "function" ? findRowByPo(tr.dataset.po) : null;
    if (!poRow) return;

    const soNum = String(poRow["SO #"] ?? "").trim();
    if (!soNum) return;

    const soOrder = findSalesOrderByNumber(soNum);
    if (!soOrder) return;

    e.stopPropagation();
    openSalesOrderModal(soOrder);
  });
}

// ── Init ─────────────────────────────────────────────────────────────────────

function escSo(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function initSalesOrdersView() {
  loadSoColumnVisibility();
  indexSoTableColumns();
  applySoColumnOrder();
  applySoColumnVisibility();
  applySoPageSize(loadSoPageSizePreference());
  initSoToolbarFilters();
  initSoColumnFilterHeaders();
  initSoEditTable();

  initSoSelectionAndFlagControls();

  document.querySelectorAll("#salesOrderTable thead th[data-col]:not(.th-filterable):not(.th-flag-col):not(.th-select-col)").forEach(th => {
    th.addEventListener("click", () => sortBySo(th.dataset.col));
  });

  document.getElementById("salesOrderSearchInput")?.addEventListener("input", applySalesOrderFilters);

  document.getElementById("navTabSalesOrders")?.addEventListener("click", () => {
    if (typeof switchAppView === "function") switchAppView("sales");
  });

  // Row double-click opens modal
  const tbody = document.getElementById("salesOrderTableBody");
  if (tbody) {
    tbody.addEventListener("dblclick", e => {
      if (e.target.closest("input, button, .td-select-cell, .td-flag-cell")) return;
      const tr = e.target.closest("tr[data-so]");
      if (!tr) return;
      const order = (filteredSalesOrders ?? []).find(o => String(o["SO #"] ?? "") === tr.dataset.so);
      if (order) openSalesOrderModal(order);
    });
  }

  // Close button
  document.getElementById("salesOrderModalCloseBtn")?.addEventListener("click", closeSalesOrderModal);
  document.getElementById("salesOrderModalBackBtn")?.addEventListener("click", () => {
    if (typeof modalNavBack === "function") modalNavBack(closeSalesOrderModal);
  });

  // Close on overlay backdrop click
  const overlay = document.getElementById("salesOrderModalOverlay");
  if (overlay) {
    overlay.addEventListener("click", e => {
      if (e.target === overlay) closeSalesOrderModal();
    });
  }

  // Escape key
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && document.getElementById("salesOrderModalOverlay")?.classList.contains("open")) {
      closeSalesOrderModal();
    }
  });

  initSoLinkFromPoTable();
  updateSoSortHeaders();
  updateSoColumnFilterHeaderStates();
  updateSoFlagFilterHeaderState();
  updateSoSelectAllHeader();
}

initSalesOrdersView();
