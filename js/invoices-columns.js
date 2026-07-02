/** Invoice table column order, visibility, and settings edit table. */

const INV_COLUMNS = [
  "Flag",
  "Selected",
  "Invoice #",
  "Status",
  "INV DATE",
  "Customer",
  "Subtotal",
  "Discount",
  "Freight",
  "Total",
  "Received",
  "Balance",
  "Pick #",
  "Tracking #",
  "SO #",
  "Unit Qty",
  "Memo",
  "House Memo",
  "Sales Commission",
];

const INV_FIXED_LEADING_COLUMNS = ["Flag", "Selected"];
const INV_NON_TOGGLEABLE_COLUMNS = new Set(INV_FIXED_LEADING_COLUMNS);

const INV_FILTERABLE_COLUMNS = new Set([
  "Status",
  "Customer",
]);

const INV_DATE_FILTER_COLUMNS = new Set([
  "INV DATE",
]);

const INV_CURRENCY_COLUMNS = new Set([
  "Subtotal",
  "Discount",
  "Freight",
  "Total",
  "Received",
  "Balance",
  "Sales Commission",
]);

const INV_NUMERIC_COLUMNS = new Set([
  "Unit Qty",
]);

const INV_SORTABLE_COLUMNS = new Set(INV_COLUMNS);

const INV_COLUMN_LAYOUT_STORAGE_BASE = "invColumnLayout";

let invColumnOrder = [...INV_COLUMNS];
let invVisibleColumns = new Set(INV_COLUMNS);
let invColumnOrderDraft = [...INV_COLUMNS];
let invColumnVisibilityDraft = new Set(INV_COLUMNS);
let invEditTableDragFromIndex = null;

function getInvColumnOrder() {
  return invColumnOrder;
}

function getInvVisibleColumns() {
  return invVisibleColumns;
}

function isInvColumnVisible(col) {
  return invVisibleColumns.has(col);
}

function normalizeInvColumnOrder(order) {
  const seen = new Set();
  const next = [];
  (order ?? []).forEach(col => {
    if (!INV_COLUMNS.includes(col) || seen.has(col)) return;
    seen.add(col);
    next.push(col);
  });
  INV_COLUMNS.forEach(col => {
    if (!seen.has(col)) next.push(col);
  });
  return [
    ...INV_FIXED_LEADING_COLUMNS,
    ...next.filter(col => !INV_NON_TOGGLEABLE_COLUMNS.has(col)),
  ];
}

function ensureInvAlwaysVisibleColumns(cols) {
  INV_NON_TOGGLEABLE_COLUMNS.forEach(col => cols.add(col));
  return cols;
}

function getInvEditableColumns() {
  return INV_COLUMNS.filter(col => !INV_NON_TOGGLEABLE_COLUMNS.has(col));
}

function saveInvColumnLayoutPreference() {
  try {
    localStorage.setItem(
      scopedStorageKey(INV_COLUMN_LAYOUT_STORAGE_BASE),
      JSON.stringify({
        order: invColumnOrder,
        visible: [...invVisibleColumns],
      })
    );
  } catch {
    /* ignore */
  }
}

function loadInvColumnLayoutPreference() {
  try {
    const raw = localStorage.getItem(scopedStorageKey(INV_COLUMN_LAYOUT_STORAGE_BASE));
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.order) || !Array.isArray(data.visible)) return false;
    const storedOrder = data.order.filter(col => INV_COLUMNS.includes(col));
    invColumnOrder = normalizeInvColumnOrder(data.order);
    invVisibleColumns = ensureInvAlwaysVisibleColumns(new Set(data.visible.filter(col => INV_COLUMNS.includes(col))));
    INV_COLUMNS.forEach(col => {
      if (!storedOrder.includes(col)) invVisibleColumns.add(col);
    });
    if (invVisibleColumns.size === INV_NON_TOGGLEABLE_COLUMNS.size) invVisibleColumns = new Set(INV_COLUMNS);
    return true;
  } catch {
    return false;
  }
}

function loadInvColumnVisibility() {
  if (!loadInvColumnLayoutPreference()) {
    invColumnOrder = normalizeInvColumnOrder([...INV_COLUMNS]);
    invVisibleColumns = new Set(INV_COLUMNS);
  }
}

function applySoInvColumnVisibility() {
  const table = document.getElementById("invoiceTable");
  if (!table) return;
  INV_COLUMNS.forEach(col => {
    const visible = isInvColumnVisible(col);
    table.querySelectorAll(`colgroup col[data-col="${CSS.escape(col)}"]`).forEach(el => {
      el.style.display = visible ? "" : "none";
    });
    table.querySelectorAll(`thead th[data-col="${CSS.escape(col)}"]`).forEach(el => {
      el.style.display = visible ? "" : "none";
    });
    table.querySelectorAll(`tbody td[data-col="${CSS.escape(col)}"]`).forEach(el => {
      el.style.display = visible ? "" : "none";
    });
  });
}

function indexInvTableColumns() {
  const table = document.getElementById("invoiceTable");
  if (!table) return;
  const cols = table.querySelectorAll("colgroup col");
  INV_COLUMNS.forEach((col, i) => cols[i]?.setAttribute("data-col", col));
}

function applyInvColumnOrder() {
  const table = document.getElementById("invoiceTable");
  if (!table) return;
  const colgroup = table.querySelector("colgroup");
  const headerRow = table.querySelector("thead tr");
  if (!colgroup || !headerRow) return;

  getInvColumnOrder().forEach(col => {
    const colEl = table.querySelector(`colgroup col[data-col="${CSS.escape(col)}"]`);
    const thEl = table.querySelector(`thead th[data-col="${CSS.escape(col)}"]`);
    if (colEl) colgroup.appendChild(colEl);
    if (thEl) headerRow.appendChild(thEl);
  });

  table.querySelectorAll("tbody tr:not(.state-row)").forEach(tr => {
    getInvColumnOrder().forEach(col => {
      const td = tr.querySelector(`td[data-col="${CSS.escape(col)}"]`);
      if (td) tr.appendChild(td);
    });
  });
}

function prepareInvoiceEditTableDraft() {
  invColumnOrderDraft = normalizeInvColumnOrder([...invColumnOrder]);
  invColumnVisibilityDraft = new Set(invVisibleColumns);
  renderInvEditTablePicker();
  renderInvEditTableOrder();
}

function renderInvEditTablePicker() {
  const list = document.getElementById("invEditTableColumnPicker");
  if (!list) return;
  list.replaceChildren();
  getInvEditableColumns().sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })).forEach(col => {
    const label = document.createElement("label");
    label.className = "edit-table-picker-option";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = invColumnVisibilityDraft.has(col);
    cb.addEventListener("change", () => {
      if (cb.checked) {
        invColumnVisibilityDraft.add(col);
        if (!getInvEditTableOrderKeys(invColumnOrderDraft).includes(col)) {
          invColumnOrderDraft = normalizeInvColumnOrder([...invColumnOrderDraft, col]);
        }
      } else {
        invColumnVisibilityDraft.delete(col);
        invColumnOrderDraft = normalizeInvColumnOrder(
          getInvEditTableOrderKeys(invColumnOrderDraft).filter(key => key !== col)
        );
      }
      renderInvEditTableOrder();
    });
    const span = document.createElement("span");
    span.textContent = col;
    label.appendChild(cb);
    label.appendChild(span);
    list.appendChild(label);
  });
}

function getInvEditTableOrderKeys(order) {
  return normalizeInvColumnOrder(order).filter(col =>
    invColumnVisibilityDraft.has(col) && !INV_NON_TOGGLEABLE_COLUMNS.has(col)
  );
}

function renderInvEditTableOrder() {
  const list = document.getElementById("invEditTableColumnOrder");
  if (!list) return;
  list.replaceChildren();
  getInvEditTableOrderKeys(invColumnOrderDraft).forEach((col, index) => {
    const item = document.createElement("div");
    item.className = "edit-table-order-item";
    item.draggable = true;
    item.dataset.col = col;
    item.textContent = col;
    item.addEventListener("dragstart", () => { invEditTableDragFromIndex = index; });
    item.addEventListener("dragend", () => { invEditTableDragFromIndex = null; });
    item.addEventListener("dragover", e => {
      e.preventDefault();
      item.classList.add("is-drag-over");
    });
    item.addEventListener("dragleave", () => item.classList.remove("is-drag-over"));
    item.addEventListener("drop", e => {
      e.preventDefault();
      item.classList.remove("is-drag-over");
      const keys = getInvEditTableOrderKeys(invColumnOrderDraft);
      const from = invEditTableDragFromIndex;
      const to = keys.indexOf(col);
      if (from == null || from < 0 || to < 0 || from === to) return;
      const next = [...keys];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      invColumnOrderDraft = normalizeInvColumnOrder([
        ...INV_COLUMNS.filter(c => !next.includes(c)),
        ...next,
      ]);
      renderInvEditTableOrder();
    });
    list.appendChild(item);
  });
}

function applyInvoiceEditTableFromPopover() {
  const visible = getInvEditTableOrderKeys(invColumnOrderDraft);
  if (visible.length === 0) return false;
  invColumnOrder = normalizeInvColumnOrder(invColumnOrderDraft);
  invVisibleColumns = ensureInvAlwaysVisibleColumns(new Set(visible));
  saveInvColumnLayoutPreference();
  indexInvTableColumns();
  applyInvColumnOrder();
  applySoInvColumnVisibility();
  if (typeof renderInvoicesTable === "function") renderInvoicesTable();
  return true;
}

function cancelInvoiceEditTableFromPopover() {
  prepareInvoiceEditTableDraft();
}

function setInvEditTableDraftSelectAll(selectAll) {
  if (selectAll) invColumnVisibilityDraft = new Set(INV_COLUMNS);
  else invColumnVisibilityDraft = new Set();
  invColumnOrderDraft = normalizeInvColumnOrder([...INV_COLUMNS]);
  renderInvEditTablePicker();
  renderInvEditTableOrder();
}
