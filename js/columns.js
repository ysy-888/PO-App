function setDisplayText(el, text) {
  el.textContent = text;
  el.classList.toggle("empty-display", text === EMPTY_DISPLAY);
}

function wrapEditablePreview(cell) {
  if (!cell || cell.classList.contains("select-cell") || cell.dataset.editing === "active") return;
  if (cell.querySelector(":scope > .editable-preview")) return;

  const preview = document.createElement("span");
  preview.className = "editable-preview";
  while (cell.firstChild) preview.appendChild(cell.firstChild);
  cell.appendChild(preview);
}

function isEmptyValue(v) {
  if (v === null || v === undefined) return true;
  const s = String(v).trim();
  if (s === "") return true;
  return /^[\u2014\u2013\u2212-]+$/.test(s);
}

const COLUMNS = [
  "Selected","Flag","Packing List",
  "Status","N41 Status","Division","Vendor","Buyer","Buyer PO #","SO #","PO Date","PO #",
  "Old PO #","Style #","Color","Style Category","PO Qty","Actual Qty","Ctn Qty","Received Qty","FOB Cost","PO Total Cost",
  "Vessel","House #","Shipped","ETD",
  "EST EXF","EST IHD","Ship Method","Shipment ID","EXF Requested",
  "Delivery Request ID","Pickup Request ID","EXF","ETA","IHD","CXL Date","Assign Date","Notes"
];

const COLUMN_WIDTHS = [
  52, 36, 36,
  130, 100, 120, 130, 120, 100, 80, 80, 80, 80, 100, 100, 100, 60, 60, 60, 70, 70, 80,
  100, 80, 96, 80, 80, 80, 100, 80, 72, 100, 100, 80, 80, 80, 80, 80, 80, 200
];

const COLUMN_LABELS = {
  "Actual Qty": "Act Qty",
  "Ctn Qty": "CTN",
  "Assign Date": "Assigned",
  "Style Category": "Category",
  "PO Total Cost": "PO Cost",
};

const UI_ONLY_COLS = new Set(["Selected", "Flag", "Packing List"]);
/** Session-local only — never read from or written to the sheet. */
const LOCAL_ONLY_COLS = new Set(["Selected", "Packing List"]);

const ALWAYS_VISIBLE_COLUMNS = new Set(["Selected", "Flag", "Packing List", "Status"]);

function getEditableColumnOptions() {
  return COLUMNS.filter(col => !ALWAYS_VISIBLE_COLUMNS.has(col));
}

function ensureAlwaysVisibleColumns(cols) {
  ALWAYS_VISIBLE_COLUMNS.forEach(col => cols.add(col));
  return cols;
}

function getSelectableColumnsFromVisible(visible) {
  return new Set([...visible].filter(col => !ALWAYS_VISIBLE_COLUMNS.has(col)));
}

function buildVisibleColumnsFromDraft(draft) {
  return ensureAlwaysVisibleColumns(new Set(draft));
}

function getColumnLabel(col) {
  return COLUMN_LABELS[col] ?? col;
}

const ROW_KEY_ALIASES = {
  "PO\nQty": "PO Qty",
  "Actual\nQty": "Actual Qty",
  "Assign\nDate": "Assign Date",
  "TOP ": "TOP",
};

function normalizeDivision(value) {
  const s = String(value ?? "").trim();
  if (/^elevator\s*disco$/i.test(s)) return "Elevator Disco";
  if (/^freesia$/i.test(s)) return "Freesia";
  return s;
}

function normalizeRow(row) {
  const out = { ...row };
  for (const [from, to] of Object.entries(ROW_KEY_ALIASES)) {
    if (from in out && !(to in out)) out[to] = out[from];
    delete out[from];
  }
  delete out[""];
  if ("Division" in out) out["Division"] = normalizeDivision(out["Division"]);
  if ("Shipment ID" in out && isEmptyValue(out["Shipment ID"])) {
    out["Shipment ID"] = "";
  }
  return out;
}

/** Shared default column view — shipped with the app for all users/sessions. */
const DEFAULT_VISIBLE_COLUMNS = [...COLUMNS];

/** @type {Set<string>} */
let visibleColumns = new Set(COLUMNS);
/** @type {Set<string>} */
let columnVisibilityDraft = new Set(COLUMNS);

function visibleColumnCount() {
  return visibleColumns.size;
}

function getDefaultVisibleColumnsSet() {
  const ordered = COLUMNS.filter(col => DEFAULT_VISIBLE_COLUMNS.includes(col));
  return ensureAlwaysVisibleColumns(new Set(ordered.length > 0 ? ordered : COLUMNS));
}

function setProgramDefaultVisibleColumns(cols) {
  const withFixed = buildVisibleColumnsFromDraft(cols);
  const ordered = COLUMNS.filter(col => withFixed.has(col));
  if (ordered.length === 0) return false;
  DEFAULT_VISIBLE_COLUMNS.splice(0, DEFAULT_VISIBLE_COLUMNS.length, ...ordered);
  return true;
}

function loadColumnVisibility() {
  visibleColumns = getDefaultVisibleColumnsSet();
}

function applyDefaultColumnsFromServer(columns) {
  if (!Array.isArray(columns) || columns.length === 0) return false;
  const cols = ensureAlwaysVisibleColumns(new Set(columns.filter(col => COLUMNS.includes(col))));
  if (cols.size === 0) return false;
  setProgramDefaultVisibleColumns(cols);
  visibleColumns = getDefaultVisibleColumnsSet();
  applyColumnVisibility();
  return true;
}

async function saveDefaultColumnVisibility() {
  if (!setProgramDefaultVisibleColumns(columnVisibilityDraft)) return;

  visibleColumns = getDefaultVisibleColumnsSet();
  applyColumnVisibility();
  setProgramDefaultStatusFilter(activeStatus);

  if (isDemoMode()) {
    showIndicator("Default view saved", "success");
    return;
  }

  try {
    showIndicator(`Saving default${ELLIPSIS}`, "");
    const res = await fetch(getAppsScriptUrl(), {
      method: "POST",
      body: JSON.stringify({
        action: "saveColumnDefault",
        columns: [...DEFAULT_VISIBLE_COLUMNS],
        statusFilter: defaultStatusFilter,
      }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    showIndicator("Default view saved", "success");
  } catch (err) {
    showIndicator("Save default failed: " + err.message, "error");
  }
}

function resetEditTableToDefault() {
  columnVisibilityDraft = getSelectableColumnsFromVisible(getDefaultVisibleColumnsSet());
  renderEditTableList();
  showIndicator("Reset to default", "success");
}

function applyColumnVisibility() {
  const table = document.getElementById("poTable");
  if (!table) return;

  let minWidth = 0;
  let leadingSet = false;
  COLUMNS.forEach((col, i) => {
    const hidden = !visibleColumns.has(col);
    if (!hidden) minWidth += COLUMN_WIDTHS[i];
    const isLeading = !hidden && !leadingSet;
    if (isLeading) leadingSet = true;

    table.querySelector(`colgroup col:nth-child(${i + 1})`)?.classList.toggle("col-hidden", hidden);
    const thEl = table.querySelector(`thead th:nth-child(${i + 1})`);
    thEl?.classList.toggle("col-hidden", hidden);
    thEl?.classList.toggle("col-leading", isLeading);
    table.querySelectorAll(`tbody tr:not(.state-row) td:nth-child(${i + 1})`).forEach(td => {
      td.classList.toggle("col-hidden", hidden);
      td.classList.toggle("col-leading", isLeading);
    });
  });

  table.style.minWidth = `${Math.max(minWidth, 400)}px`;
}

function renderEditTableList() {
  const list = document.getElementById("editTableColumnList");
  if (!list) return;

  list.innerHTML = "";
  getEditableColumnOptions().forEach(col => {
    const label = document.createElement("label");
    label.className = "column-filter-option";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = col;
    cb.checked = columnVisibilityDraft.has(col);
    cb.addEventListener("change", () => {
      if (cb.checked) columnVisibilityDraft.add(col);
      else columnVisibilityDraft.delete(col);
    });

    const span = document.createElement("span");
    span.textContent = getColumnLabel(col);

    label.appendChild(cb);
    label.appendChild(span);
    list.appendChild(label);
  });
}

function positionEditTablePopover(anchorBtn) {
  const pop = document.getElementById("editTablePopover");
  if (!pop || !anchorBtn) return;

  const rect = anchorBtn.getBoundingClientRect();
  const maxLeft = window.innerWidth - pop.offsetWidth - 8;
  const left = Math.min(Math.max(8, rect.right - pop.offsetWidth), maxLeft);

  pop.style.top = `${rect.bottom + 4}px`;
  pop.style.left = `${left}px`;
}

function openEditTablePopover(anchorBtn) {
  columnVisibilityDraft = getSelectableColumnsFromVisible(visibleColumns);
  const pop = document.getElementById("editTablePopover");
  if (!pop) return;

  pop.hidden = false;
  renderEditTableList();
  requestAnimationFrame(() => positionEditTablePopover(anchorBtn));
}

function closeEditTablePopover() {
  const pop = document.getElementById("editTablePopover");
  if (pop) pop.hidden = true;
}

function setEditTableDraftSelectAll(selectAll) {
  columnVisibilityDraft = selectAll ? new Set(getEditableColumnOptions()) : new Set();
  renderEditTableList();
}

function applyEditTableFromPopover() {
  visibleColumns = buildVisibleColumnsFromDraft(columnVisibilityDraft);
  applyColumnVisibility();
  closeEditTablePopover();
}

function initEditTable() {
  document.getElementById("editTableSelectAll")?.addEventListener("click", () => setEditTableDraftSelectAll(true));
  document.getElementById("editTableClearAll")?.addEventListener("click", () => setEditTableDraftSelectAll(false));
  document.getElementById("editTableSaveDefault")?.addEventListener("click", saveDefaultColumnVisibility);
  document.getElementById("editTableResetDefault")?.addEventListener("click", resetEditTableToDefault);
  document.getElementById("editTableOk")?.addEventListener("click", applyEditTableFromPopover);
  document.getElementById("editTableCancel")?.addEventListener("click", closeEditTablePopover);

  document.addEventListener("click", e => {
    const pop = document.getElementById("editTablePopover");
    if (!pop || pop.hidden) return;
    if (pop.contains(e.target) || e.target.closest("#headerMenuBtn") || e.target.closest("#headerMenuEditTable")) return;
    closeEditTablePopover();
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeEditTablePopover();
  });

  window.addEventListener("resize", () => {
    const pop = document.getElementById("editTablePopover");
    if (pop && !pop.hidden) {
      positionEditTablePopover(document.getElementById("headerMenuBtn"));
    }
  });
}
