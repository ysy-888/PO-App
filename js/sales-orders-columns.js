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
  "Tracking #",
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
  if (typeof isPortalHiddenSoColumn === "function" && isPortalHiddenSoColumn(col)) return false;
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

function getSoColumnLayoutPreferencePayload() {
  return {
    order: soColumnOrder,
    visible: [...soVisibleColumns],
  };
}

function saveSoColumnLayoutPreference() {
  try {
    localStorage.setItem(
      scopedStorageKey(SO_COLUMN_LAYOUT_STORAGE_BASE),
      JSON.stringify(getSoColumnLayoutPreferencePayload())
    );
  } catch {
    /* ignore */
  }
}

function migrateSoColumnName(col) {
  return col === "INVOICE UNIT QTY" ? "INV QTY" : col;
}

function applySoColumnLayoutPreferenceData(data, { updateDom = false } = {}) {
  if (!data || typeof data !== "object") return false;
  if (!Array.isArray(data.order) || !Array.isArray(data.visible)) return false;
  const storedOrder = data.order.map(migrateSoColumnName).filter(col => SO_COLUMNS.includes(col));
  soColumnOrder = normalizeSoColumnOrder(data.order.map(migrateSoColumnName));
  soVisibleColumns = ensureSoAlwaysVisibleColumns(
    new Set(data.visible.map(migrateSoColumnName).filter(col => SO_COLUMNS.includes(col)))
  );
  SO_COLUMNS.forEach(col => {
    if (!storedOrder.includes(col)) soVisibleColumns.add(col);
  });
  if (soVisibleColumns.size === SO_NON_TOGGLEABLE_COLUMNS.size) soVisibleColumns = new Set(SO_COLUMNS);
  if (updateDom) {
    indexSoTableColumns();
    applySoColumnOrder();
    applySoColumnVisibility();
  }
  return true;
}

function loadSoColumnLayoutPreference() {
  try {
    const raw = localStorage.getItem(scopedStorageKey(SO_COLUMN_LAYOUT_STORAGE_BASE));
    if (!raw) return false;
    return applySoColumnLayoutPreferenceData(JSON.parse(raw));
  } catch {
    return false;
  }
}

function applySoColumnLayoutFromServer(data) {
  const ok = applySoColumnLayoutPreferenceData(data, { updateDom: true });
  if (ok) saveSoColumnLayoutPreference();
  return ok;
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
  if (typeof persistUserPreferencePatch === "function") {
    persistUserPreferencePatch({ soColumnLayout: getSoColumnLayoutPreferencePayload() });
  }
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
async function saveSoEditTableDefault() {
  const visible = getSoEditTableOrderKeys(soColumnOrderDraft);
  if (visible.length === 0) return;
  soColumnOrder = normalizeSoColumnOrder(soColumnOrderDraft);
  soVisibleColumns = ensureSoAlwaysVisibleColumns(new Set(visible));
  saveSoColumnLayoutPreference();
  indexSoTableColumns();
  applySoColumnOrder();
  applySoColumnVisibility();
  if (typeof renderSalesOrdersTable === "function") renderSalesOrdersTable();

  try {
    if (typeof setEditTableFooterMessage === "function") {
      setEditTableFooterMessage(`Saving default${typeof ELLIPSIS !== "undefined" ? ELLIPSIS : "..."}`, "");
    }
    const json = await postApi("/api/settings/save-column", {
      soColumnLayout: getSoColumnLayoutPreferencePayload(),
    });
    if (!json.success) throw new Error(json.error);
    if (typeof setEditTableFooterMessage === "function") {
      setEditTableFooterMessage("Default view saved", "success");
    }
  } catch (err) {
    if (typeof setEditTableFooterMessage === "function") {
      setEditTableFooterMessage("Save default failed: " + err.message, "error");
    }
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

/* ------------------------------------------------------------------ *
 * Place Showroom Portal — admin-facing editor for the tenant-wide
 * Sales Orders column layout shown to showroom portal accounts.
 * The same SO_COLUMNS drive both tables; this editor persists its
 * choice to the server (tenant_settings.portalColumns) so it applies
 * to portal users, who have no Settings access of their own.
 * ------------------------------------------------------------------ */

let portalColumnOrderDraft = [...SO_COLUMNS];
let portalColumnVisibilityDraft = new Set(SO_COLUMNS);
let portalEditTableDragFromIndex = null;

/** Default portal columns when the tenant hasn't saved a custom layout. */
function getDefaultPortalVisibleColumns() {
  const hidden = typeof PORTAL_HIDDEN_SO_COLUMNS !== "undefined" ? PORTAL_HIDDEN_SO_COLUMNS : new Set();
  return SO_COLUMNS.filter(col => !hidden.has(col));
}

/** Current saved portal layout, or a sensible default. */
function getPortalConfigOrDefault() {
  const cfg = typeof getPortalColumnConfig === "function" ? getPortalColumnConfig() : null;
  const visible = Array.isArray(cfg?.visible)
    ? cfg.visible.filter(c => SO_COLUMNS.includes(c))
    : getDefaultPortalVisibleColumns();
  const order = Array.isArray(cfg?.order)
    ? cfg.order.filter(c => SO_COLUMNS.includes(c))
    : [...SO_COLUMNS];
  return {
    order: order.length ? order : [...SO_COLUMNS],
    visible: visible.length ? visible : getDefaultPortalVisibleColumns(),
  };
}

function preparePortalEditTableDraft() {
  const { order, visible } = getPortalConfigOrDefault();
  portalColumnOrderDraft = normalizeSoColumnOrder(order);
  portalColumnVisibilityDraft = ensureSoAlwaysVisibleColumns(new Set(visible));
  renderPortalEditTablePicker();
  renderPortalEditTableOrder();
}

function getPortalEditTableOrderKeys(order) {
  return normalizeSoColumnOrder(order).filter(col =>
    portalColumnVisibilityDraft.has(col) && !SO_NON_TOGGLEABLE_COLUMNS.has(col)
  );
}

function renderPortalEditTablePicker() {
  const list = document.getElementById("portalEditTableColumnPicker");
  if (!list) return;
  list.replaceChildren();
  getSoEditableColumns().sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })).forEach(col => {
    const label = document.createElement("label");
    label.className = "edit-table-picker-option";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = portalColumnVisibilityDraft.has(col);
    cb.addEventListener("change", () => {
      if (cb.checked) {
        portalColumnVisibilityDraft.add(col);
        if (!getPortalEditTableOrderKeys(portalColumnOrderDraft).includes(col)) {
          portalColumnOrderDraft = normalizeSoColumnOrder([...portalColumnOrderDraft, col]);
        }
      } else {
        portalColumnVisibilityDraft.delete(col);
        portalColumnOrderDraft = normalizeSoColumnOrder(
          getPortalEditTableOrderKeys(portalColumnOrderDraft).filter(key => key !== col)
        );
      }
      renderPortalEditTableOrder();
    });
    const span = document.createElement("span");
    span.textContent = col;
    label.appendChild(cb);
    label.appendChild(span);
    list.appendChild(label);
  });
}

function renderPortalEditTableOrder() {
  const list = document.getElementById("portalEditTableColumnOrder");
  if (!list) return;
  list.replaceChildren();
  getPortalEditTableOrderKeys(portalColumnOrderDraft).forEach((col, index) => {
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

    item.addEventListener("dragstart", () => { portalEditTableDragFromIndex = index; });
    item.addEventListener("dragend", () => { portalEditTableDragFromIndex = null; });
    item.addEventListener("dragover", e => {
      e.preventDefault();
      item.classList.add("is-drag-over");
    });
    item.addEventListener("dragleave", () => item.classList.remove("is-drag-over"));
    item.addEventListener("drop", e => {
      e.preventDefault();
      item.classList.remove("is-drag-over");
      const keys = getPortalEditTableOrderKeys(portalColumnOrderDraft);
      const from = portalEditTableDragFromIndex;
      const to = keys.indexOf(col);
      if (from == null || from < 0 || to < 0 || from === to) return;
      const next = [...keys];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      portalColumnOrderDraft = normalizeSoColumnOrder([
        ...SO_COLUMNS.filter(c => !next.includes(c)),
        ...next,
      ]);
      renderPortalEditTableOrder();
    });
    list.appendChild(item);
  });
}

async function savePortalColumnsToServer(payload) {
  if (typeof setEditTableFooterMessage === "function") {
    setEditTableFooterMessage(`Saving portal view${typeof ELLIPSIS !== "undefined" ? ELLIPSIS : "…"}`, "");
  }
  try {
    const json = await postApi("/api/settings/portal-columns", { portalColumns: payload });
    if (!json.success) throw new Error(json.error);
    if (typeof setEditTableFooterMessage === "function") {
      setEditTableFooterMessage("Portal view saved", "success");
    }
  } catch (err) {
    if (typeof setEditTableFooterMessage === "function") {
      setEditTableFooterMessage("Save portal view failed: " + err.message, "error");
    }
  }
}

function applyPortalEditTableFromPopover() {
  const visible = getPortalEditTableOrderKeys(portalColumnOrderDraft);
  if (visible.length === 0) {
    if (typeof setEditTableFooterMessage === "function") {
      setEditTableFooterMessage("Select at least one column.", "error");
    }
    return false;
  }
  const payload = {
    order: normalizeSoColumnOrder(portalColumnOrderDraft),
    visible: [...ensureSoAlwaysVisibleColumns(new Set(visible))],
  };
  if (typeof setPortalColumnConfig === "function") setPortalColumnConfig(payload);
  savePortalColumnsToServer(payload);
  return true;
}

function cancelPortalEditTableFromPopover() {
  preparePortalEditTableDraft();
}

/** Portal layout is tenant-wide, so "Save as default" is the same commit as OK. */
function savePortalEditTableDefault() {
  applyPortalEditTableFromPopover();
}

function resetPortalEditTableToDefault() {
  portalColumnOrderDraft = normalizeSoColumnOrder([...SO_COLUMNS]);
  portalColumnVisibilityDraft = ensureSoAlwaysVisibleColumns(new Set(getDefaultPortalVisibleColumns()));
  renderPortalEditTablePicker();
  renderPortalEditTableOrder();
  if (typeof setEditTableFooterMessage === "function") {
    setEditTableFooterMessage("Reset to default", "success");
  }
}

function setPortalEditTableDraftSelectAll(selectAll) {
  portalColumnVisibilityDraft = selectAll ? new Set(SO_COLUMNS) : new Set();
  portalColumnOrderDraft = normalizeSoColumnOrder([...SO_COLUMNS]);
  renderPortalEditTablePicker();
  renderPortalEditTableOrder();
}
