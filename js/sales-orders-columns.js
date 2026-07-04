/** Sales Order table column order, visibility, and settings edit table. */

const SO_COLUMNS = [
  "Flag",
  "Selected",
  "SO #",
  "Customer",
  "Customer PO #",
  "Division",
  "INVOICE #",
  "INV QTY",
  "Subtotal",
  "TOTAL",
  "INVOICE STATUS",
  "Order Date",
  "Ship Date",
  "CXL Date",
  "Store",
  "N41 Status",
  "Order Type",
  "Customer Type",
  "Styles",
  "Style #s",
  "Total Units",
  "Total Price",
  "Memo",
];

const SO_FIXED_LEADING_COLUMNS = ["Flag", "Selected"];
const SO_NON_TOGGLEABLE_COLUMNS = new Set(SO_FIXED_LEADING_COLUMNS);

const SO_FILTERABLE_COLUMNS = new Set([
  "Customer",
  "Customer PO #",
  "Division",
  "INVOICE STATUS",
  "Store",
  "N41 Status",
  "Order Type",
  "Customer Type",
]);

const SO_DATE_FILTER_COLUMNS = new Set([
  "Order Date",
  "Ship Date",
  "CXL Date",
]);

const SO_SORTABLE_COLUMNS = new Set(SO_COLUMNS);

const SO_COLUMN_LAYOUT_STORAGE_BASE = "soColumnLayout";
const SO_PROGRAM_COLUMN_DEFAULT_STORAGE_BASE = "soProgramColumnDefault";

let soColumnOrder = [...SO_COLUMNS];
let soVisibleColumns = new Set(SO_COLUMNS);
let soColumnOrderDraft = [...SO_COLUMNS];
let soColumnVisibilityDraft = new Set(SO_COLUMNS);
let soEditTableDragFromIndex = null;

function getSoColumnOrder() {
  return soColumnOrder;
}

function getSoVisibleColumns() {
  return soVisibleColumns;
}

function isSoColumnVisible(col) {
  return soVisibleColumns.has(col);
}

function normalizeSoColumnOrder(order) {
  const seen = new Set();
  const next = [];
  (order ?? []).forEach(col => {
    if (!SO_COLUMNS.includes(col) || seen.has(col)) return;
    seen.add(col);
    next.push(col);
  });
  SO_COLUMNS.forEach(col => {
    if (!seen.has(col)) next.push(col);
  });
  return [
    ...SO_FIXED_LEADING_COLUMNS,
    ...next.filter(col => !SO_NON_TOGGLEABLE_COLUMNS.has(col)),
  ];
}

function ensureSoAlwaysVisibleColumns(cols) {
  SO_NON_TOGGLEABLE_COLUMNS.forEach(col => cols.add(col));
  return cols;
}

function getSoEditableColumns() {
  return SO_COLUMNS.filter(col => !SO_NON_TOGGLEABLE_COLUMNS.has(col));
}

function saveSoColumnLayoutPreference() {
  try {
    localStorage.setItem(
      scopedStorageKey(SO_COLUMN_LAYOUT_STORAGE_BASE),
      JSON.stringify({
        order: soColumnOrder,
        visible: [...soVisibleColumns],
      })
    );
  } catch {
    /* ignore */
  }
}

function migrateSoColumnName(col) {
  return col === "INVOICE UNIT QTY" ? "INV QTY" : col;
}

function loadSoColumnLayoutPreference() {
  try {
    const raw = localStorage.getItem(scopedStorageKey(SO_COLUMN_LAYOUT_STORAGE_BASE));
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.order) || !Array.isArray(data.visible)) return false;
    const storedOrder = data.order.map(migrateSoColumnName).filter(col => SO_COLUMNS.includes(col));
    soColumnOrder = normalizeSoColumnOrder(data.order.map(migrateSoColumnName));
    soVisibleColumns = ensureSoAlwaysVisibleColumns(new Set(data.visible.map(migrateSoColumnName).filter(col => SO_COLUMNS.includes(col))));
    SO_COLUMNS.forEach(col => {
      if (!storedOrder.includes(col)) soVisibleColumns.add(col);
    });
    if (soVisibleColumns.size === SO_NON_TOGGLEABLE_COLUMNS.size) soVisibleColumns = new Set(SO_COLUMNS);
    return true;
  } catch {
    return false;
  }
}

function loadSoColumnVisibility() {
  if (!loadSoColumnLayoutPreference()) {
    soColumnOrder = normalizeSoColumnOrder([...SO_COLUMNS]);
    soVisibleColumns = new Set(SO_COLUMNS);
  }
}

function applySoColumnVisibility() {
  const table = document.getElementById("salesOrderTable");
  if (!table) return;
  SO_COLUMNS.forEach(col => {
    const visible = isSoColumnVisible(col);
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

function indexSoTableColumns() {
  const table = document.getElementById("salesOrderTable");
  if (!table) return;
  const cols = table.querySelectorAll("colgroup col");
  SO_COLUMNS.forEach((col, i) => cols[i]?.setAttribute("data-col", col));
}

function applySoColumnOrder() {
  const table = document.getElementById("salesOrderTable");
  if (!table) return;
  const colgroup = table.querySelector("colgroup");
  const headerRow = table.querySelector("thead tr");
  if (!colgroup || !headerRow) return;

  getSoColumnOrder().forEach(col => {
    const colEl = table.querySelector(`colgroup col[data-col="${CSS.escape(col)}"]`);
    const thEl = table.querySelector(`thead th[data-col="${CSS.escape(col)}"]`);
    if (colEl) colgroup.appendChild(colEl);
    if (thEl) headerRow.appendChild(thEl);
  });

  table.querySelectorAll("tbody tr:not(.state-row)").forEach(tr => {
    getSoColumnOrder().forEach(col => {
      const td = tr.querySelector(`td[data-col="${CSS.escape(col)}"]`);
      if (td) tr.appendChild(td);
    });
  });
}

function prepareSoEditTableDraft() {
  soColumnOrderDraft = normalizeSoColumnOrder([...soColumnOrder]);
  soColumnVisibilityDraft = new Set(soVisibleColumns);
  renderSoEditTablePicker();
  renderSoEditTableOrder();
}

function renderSoEditTablePicker() {
  const list = document.getElementById("soEditTableColumnPicker");
  if (!list) return;
  list.replaceChildren();
  getSoEditableColumns().sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })).forEach(col => {
    const label = document.createElement("label");
    label.className = "edit-table-picker-option";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = soColumnVisibilityDraft.has(col);
    cb.addEventListener("change", () => {
      if (cb.checked) {
        soColumnVisibilityDraft.add(col);
        if (!getSoEditTableOrderKeys(soColumnOrderDraft).includes(col)) {
          soColumnOrderDraft = normalizeSoColumnOrder([...soColumnOrderDraft, col]);
        }
      } else {
        soColumnVisibilityDraft.delete(col);
        soColumnOrderDraft = normalizeSoColumnOrder(
          getSoEditTableOrderKeys(soColumnOrderDraft).filter(key => key !== col)
        );
      }
      renderSoEditTableOrder();
    });
    const span = document.createElement("span");
    span.textContent = col;
    label.appendChild(cb);
    label.appendChild(span);
    list.appendChild(label);
  });
}

function getSoEditTableOrderKeys(order) {
  return normalizeSoColumnOrder(order).filter(col =>
    soColumnVisibilityDraft.has(col) && !SO_NON_TOGGLEABLE_COLUMNS.has(col)
  );
}

function renderSoEditTableOrder() {
  const list = document.getElementById("soEditTableColumnOrder");
  if (!list) return;
  list.replaceChildren();
  getSoEditTableOrderKeys(soColumnOrderDraft).forEach((col, index) => {
    const item = document.createElement("div");
    item.className = "edit-table-order-item";
    item.draggable = true;
    item.dataset.col = col;

    const handle = document.createElement("span");
    handle.className = "edit-table-drag-handle";
    handle.textContent = "⋮⋮";
    handle.setAttribute("aria-hidden", "true");
    item.appendChild(handle);

    const labelSpan = document.createElement("span");
    labelSpan.className = "edit-table-order-item-label";
    labelSpan.textContent = col;
    item.appendChild(labelSpan);

    item.addEventListener("dragstart", () => { soEditTableDragFromIndex = index; });
    item.addEventListener("dragend", () => { soEditTableDragFromIndex = null; });
    item.addEventListener("dragover", e => {
      e.preventDefault();
      item.classList.add("is-drag-over");
    });
    item.addEventListener("dragleave", () => item.classList.remove("is-drag-over"));
    item.addEventListener("drop", e => {
      e.preventDefault();
      item.classList.remove("is-drag-over");
      const keys = getSoEditTableOrderKeys(soColumnOrderDraft);
      const from = soEditTableDragFromIndex;
      const to = keys.indexOf(col);
      if (from == null || from < 0 || to < 0 || from === to) return;
      const next = [...keys];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      soColumnOrderDraft = normalizeSoColumnOrder([
        ...SO_COLUMNS.filter(c => !next.includes(c)),
        ...next,
      ]);
      renderSoEditTableOrder();
    });
    list.appendChild(item);
  });
}

function applySoEditTableFromPopover() {
  const visible = getSoEditTableOrderKeys(soColumnOrderDraft);
  if (visible.length === 0) return false;
  soColumnOrder = normalizeSoColumnOrder(soColumnOrderDraft);
  soVisibleColumns = ensureSoAlwaysVisibleColumns(new Set(visible));
  saveSoColumnLayoutPreference();
  indexSoTableColumns();
  applySoColumnOrder();
  applySoColumnVisibility();
  if (typeof renderSalesOrdersTable === "function") renderSalesOrdersTable();
  return true;
}

function cancelSoEditTableFromPopover() {
  prepareSoEditTableDraft();
}

/** Global "Reset to default" dispatched from the shared edit-table button. */
function resetSoEditTableToDefault() {
  soColumnOrderDraft = normalizeSoColumnOrder([...SO_COLUMNS]);
  soColumnVisibilityDraft = new Set(SO_COLUMNS);
  renderSoEditTablePicker();
  renderSoEditTableOrder();
  if (typeof setEditTableFooterMessage === "function") {
    setEditTableFooterMessage("Reset to default", "success");
  }
}

/** Global "Save as default": commit the current layout as the saved view. */
function saveSoEditTableDefault() {
  if (applySoEditTableFromPopover() && typeof setEditTableFooterMessage === "function") {
    setEditTableFooterMessage("Default view saved", "success");
  }
}

function setSoEditTableDraftSelectAll(selectAll) {
  if (selectAll) soColumnVisibilityDraft = new Set(SO_COLUMNS);
  else soColumnVisibilityDraft = new Set();
  soColumnOrderDraft = normalizeSoColumnOrder([...SO_COLUMNS]);
  renderSoEditTablePicker();
  renderSoEditTableOrder();
}

function initSoEditTable() {
  document.getElementById("soEditTableSelectAll")?.addEventListener("click", () => setSoEditTableDraftSelectAll(true));
  document.getElementById("soEditTableClearAll")?.addEventListener("click", () => setSoEditTableDraftSelectAll(false));
  document.getElementById("soEditTableOk")?.addEventListener("click", () => {
    if (applySoEditTableFromPopover()) {
      document.getElementById("settingsOverlay")?.classList.remove("open");
    }
  });
  document.getElementById("soEditTableCancel")?.addEventListener("click", () => {
    cancelSoEditTableFromPopover();
    document.getElementById("settingsOverlay")?.classList.remove("open");
  });
}
