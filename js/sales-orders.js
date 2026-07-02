/** Sales Orders list view and detail modal. */

const SO_SEARCH_COLUMNS = [
  "SO #",
  "Customer",
  "Customer PO #",
  "Store",
  "N41 Status",
  "Order Type",
  "Customer Type",
];

const SO_DEFAULT_SORT_COLUMNS = ["SO #", "Order Date"];
const SO_PAGE_SIZE_STORAGE_BASE = "soPageSize";

let filteredSalesOrders = [];

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── State ────────────────────────────────────────────────────────────────────

function onSalesOrdersDataLoaded(rows) {
  allSalesOrders = (rows ?? []).map(row => ({ ...row }));
  applySalesOrderFilters();
}

function getSoSortValue(order, col) {
  if (col === "Styles") return (order.Lines ?? []).length;
  if (col === "Total Units") return soTotalUnits(order);
  if (col === "Total Price") return soTotalPrice(order);
  return order[col];
}

function compareSoOrdersByColumn(col, a, b) {
  if (SO_DATE_FILTER_COLUMNS.has(col)) {
    return compareDateFieldValues(a[col], b[col]);
  }
  if (col === "Styles" || col === "Total Units" || col === "Total Price") {
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
    if (typeof rowPassesSoColumnFilters === "function" && !rowPassesSoColumnFilters(order)) return false;
    if (!q) return true;
    const haystack = SO_SEARCH_COLUMNS
      .map(col => String(order[col] ?? ""))
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
  updateSoClearAllFiltersButton();
  if (typeof updateSoPaginationUI === "function") updateSoPaginationUI();
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
  if (typeof isApiMode === "function" && isApiMode()) return DEFAULT_PAGE_SIZE;
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
    tr.dataset.so = String(order["SO #"] ?? "");

    const columnOrder = typeof getSoColumnOrder === "function" ? getSoColumnOrder() : SO_COLUMNS;
    columnOrder.forEach(col => {
      if (typeof isSoColumnVisible === "function" && !isSoColumnVisible(col)) return;

      const td = document.createElement("td");
      td.dataset.col = col;

      if (col === "Styles") {
        td.textContent = String((order.Lines ?? []).length);
        td.className = "td-num";
      } else if (col === "Total Units") {
        td.textContent = soTotalUnits(order).toLocaleString();
        td.className = "td-num";
      } else if (col === "Total Price") {
        td.textContent = formatSoPrice(soTotalPrice(order));
        td.className = "td-num";
      } else if (["Order Date", "Ship Date", "CXL Date"].includes(col)) {
        td.textContent = formatSoDate(order[col]);
      } else if (col === "N41 Status") {
        const status = String(order[col] ?? "").trim();
        td.textContent = status || "—";
        if (status) td.dataset.status = status.toLowerCase();
      } else {
        td.textContent = String(order[col] ?? "") || "—";
      }
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
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

function buildSoLineItemsTable(lines) {
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

  let html = `
<div class="so-line-table-wrap">
<table class="so-line-table">
<thead>
<tr>
  <th>Style #</th>
  <th>Description</th>
  <th>Color</th>
  <th>Status</th>
  ${sizeHeaders.map(h => `<th class="so-size-col">${escSo(h)}</th>`).join("")}
  <th class="so-size-col">Total</th>
  <th class="so-price-col">Price</th>
  <th class="so-price-col">Ext Price</th>
</tr>
</thead>
<tbody>`;

  lines.forEach(line => {
    const sizeQty = Math.min(Number(line["Size Qty"] ?? maxSizeQty), 15);
    const unitCells = [];
    let lineTotal = 0;
    for (let i = 1; i <= maxSizeQty; i++) {
      if (i <= sizeQty) {
        const qty = toSoQty(line[`Unit ${i}`]);
        lineTotal += qty;
        unitCells.push(`<td class="so-size-col td-num">${qty > 0 ? qty.toLocaleString() : "—"}</td>`);
      } else {
        unitCells.push(`<td class="so-size-col td-num so-cell-empty">—</td>`);
      }
    }
    const totalUnits = toSoQty(line["Total Units"]) || lineTotal;
    const price = toSoQty(line["Price"]);
    const extPrice = toSoQty(line["Ext Price"]);
    const statusVal = String(line["Style Order Status"] ?? "").trim();
    html += `
<tr>
  <td class="so-style-col">${escSo(line["Style #"] ?? "—")}</td>
  <td class="so-desc-col">${escSo(line["Style Description"] ?? "")}</td>
  <td>${escSo(line.Color ?? "—")}</td>
  <td><span class="so-status-badge" data-status="${escSo(statusVal.toLowerCase())}">${escSo(statusVal || "—")}</span></td>
  ${unitCells.join("")}
  <td class="so-size-col td-num so-total-col">${totalUnits.toLocaleString()}</td>
  <td class="so-price-col td-num">${price > 0 ? formatSoPrice(price) : "—"}</td>
  <td class="so-price-col td-num">${extPrice > 0 ? formatSoPrice(extPrice) : "—"}</td>
</tr>`;
  });

  html += "</tbody></table></div>";
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

function openSalesOrderModal(order) {
  const overlay = document.getElementById("salesOrderModalOverlay");
  if (!overlay) return;

  currentSalesOrderModal = order;

  const soNum = String(order["SO #"] ?? "").trim();
  const customer = String(order.Customer ?? "").trim();
  const status = String(order["N41 Status"] ?? "").trim();

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
  const totalStyles = lines.length;
  const totalUnits = soTotalUnits(order);
  const totalPrice = soTotalPrice(order);

  // Build modal body
  const bodyEl = overlay.querySelector(".so-modal-body");
  if (!bodyEl) return;

  bodyEl.innerHTML = `
<div class="so-header-fields">
  <div class="so-field"><span class="so-field-label">Customer PO #</span><span class="so-field-value">${escSo(order["Customer PO #"] ?? "—")}</span></div>
  <div class="so-field"><span class="so-field-label">Order Date</span><span class="so-field-value">${formatSoDate(order["Order Date"])}</span></div>
  <div class="so-field"><span class="so-field-label">Ship Date</span><span class="so-field-value">${formatSoDate(order["Ship Date"])}</span></div>
  <div class="so-field"><span class="so-field-label">CXL Date</span><span class="so-field-value">${formatSoDate(order["CXL Date"])}</span></div>
  <div class="so-field"><span class="so-field-label">Store</span><span class="so-field-value">${escSo(order.Store ?? "—")}</span></div>
  <div class="so-field"><span class="so-field-label">Order Type</span><span class="so-field-value">${escSo(order["Order Type"] ?? "—")}</span></div>
  <div class="so-field"><span class="so-field-label">Customer Type</span><span class="so-field-value">${escSo(order["Customer Type"] ?? "—")}</span></div>
</div>

<div class="so-totals-bar">
  <div class="so-total-item"><span class="so-total-label">Styles</span><span class="so-total-value">${totalStyles}</span></div>
  <div class="so-total-item"><span class="so-total-label">Total Units</span><span class="so-total-value">${totalUnits.toLocaleString()}</span></div>
  <div class="so-total-item"><span class="so-total-label">Total Price</span><span class="so-total-value">${formatSoPrice(totalPrice)}</span></div>
</div>

<div class="so-lines-section">
  <div class="so-section-title">Style Lines</div>
  ${buildSoLineItemsTable(lines)}
</div>

${buildLinkedPosSection(order)}`;

  // Wire linked PO buttons
  bodyEl.querySelectorAll(".so-linked-po-btn[data-po]").forEach(btn => {
    btn.addEventListener("click", () => {
      const poNumber = btn.dataset.po;
      const poRow = (typeof allRows !== "undefined" ? allRows : [])
        .find(po => String(po["PO #"] ?? "").trim() === poNumber);
      closeSalesOrderModal();
      if (typeof switchAppView === "function") switchAppView("po");
      if (poRow && typeof openPODetail === "function") {
        setTimeout(() => openPODetail(poRow), 50);
      }
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

    const soOrder = (allSalesOrders ?? []).find(o => String(o["SO #"] ?? "").trim() === soNum);
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
  initSoColumnFilterHeaders();
  initSoEditTable();

  document.querySelectorAll("#salesOrderTable thead th[data-col]:not(.th-filterable)").forEach(th => {
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
      const tr = e.target.closest("tr[data-so]");
      if (!tr) return;
      const order = (filteredSalesOrders ?? []).find(o => String(o["SO #"] ?? "") === tr.dataset.so);
      if (order) openSalesOrderModal(order);
    });

    // Single click also opens modal (same as row-click pattern)
    tbody.addEventListener("click", e => {
      const tr = e.target.closest("tr[data-so]");
      if (!tr) return;
      const order = (filteredSalesOrders ?? []).find(o => String(o["SO #"] ?? "") === tr.dataset.so);
      if (order) openSalesOrderModal(order);
    });
  }

  // Close button
  document.getElementById("salesOrderModalCloseBtn")?.addEventListener("click", closeSalesOrderModal);

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
}

initSalesOrdersView();
