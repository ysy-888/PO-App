/** Sales Orders list view and detail modal. */

const SO_TABLE_COLUMNS = [
  "SO #",
  "Customer",
  "Customer PO #",
  "Order Date",
  "Ship Date",
  "CXL Date",
  "Store",
  "N41 Status",
  "Order Type",
  "Customer Type",
  "Styles",
  "Total Units",
  "Total Price",
];

const SO_SEARCH_COLUMNS = [
  "SO #",
  "Customer",
  "Customer PO #",
  "Store",
  "N41 Status",
  "Order Type",
  "Customer Type",
];

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

function applySalesOrderFilters() {
  const q = (document.getElementById("salesOrderSearchInput")?.value ?? "").toLowerCase();
  filteredSalesOrders = (allSalesOrders ?? []).filter(order => {
    if (!q) return true;
    const haystack = SO_SEARCH_COLUMNS
      .map(col => String(order[col] ?? ""))
      .join(" ")
      .toLowerCase();
    if (haystack.includes(q)) return true;
    // Also search style numbers/descriptions in Lines
    const lineHaystack = (order.Lines ?? [])
      .map(l => [l["Style #"], l.Color, l["Style Description"]].join(" "))
      .join(" ")
      .toLowerCase();
    return lineHaystack.includes(q);
  });
  filteredSalesOrders.sort((a, b) => {
    const an = Number(String(a["SO #"] ?? ""));
    const bn = Number(String(b["SO #"] ?? ""));
    if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
    return String(a["SO #"] ?? "").localeCompare(String(b["SO #"] ?? ""), undefined, { numeric: true });
  });
  renderSalesOrdersTable();
  updateSalesOrderRowCounter();
}

function updateSalesOrderRowCounter() {
  const el = document.getElementById("salesOrderRowCounter");
  if (!el) return;
  const total = filteredSalesOrders.length;
  el.textContent = total === 1 ? "1 sales order" : `${total} sales orders`;
}

// ── Table render ─────────────────────────────────────────────────────────────

function renderSalesOrdersTable() {
  const tbody = document.getElementById("salesOrderTableBody");
  if (!tbody) return;

  if (filteredSalesOrders.length === 0) {
    const msg = (allSalesOrders ?? []).length === 0
      ? "No sales orders yet. Import a Sales Order Details CSV to get started."
      : "No sales orders match the current search.";
    tbody.innerHTML = `<tr class="state-row"><td colspan="${SO_TABLE_COLUMNS.length}">${msg}</td></tr>`;
    return;
  }

  tbody.replaceChildren();
  filteredSalesOrders.forEach(order => {
    const tr = document.createElement("tr");
    tr.className = "clickable-row";
    tr.dataset.so = String(order["SO #"] ?? "");

    SO_TABLE_COLUMNS.forEach(col => {
      const td = document.createElement("td");
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
        if (status) {
          td.dataset.status = status.toLowerCase();
        }
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
}

initSalesOrdersView();
