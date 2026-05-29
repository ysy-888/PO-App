const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzE1aQiqIUnQ2zSDrMhlnpfNBT2G2poY7_C6PJ9wHYv9olX3xGpOXWDjgzQQBR-7epoTw/exec";

const EMPTY_DISPLAY = "\u2014";
const EN_DASH = "\u2013";
const ELLIPSIS = "\u2026";
const CHECK_MARK = "\u2713";
const CXL_COUNTDOWN_STORAGE_KEY = "poTable.cxlCountdown";

let cxlCountdownEnabled = false;

function loadCxlCountdownPreference() {
  try {
    cxlCountdownEnabled = localStorage.getItem(CXL_COUNTDOWN_STORAGE_KEY) === "1";
  } catch {
    cxlCountdownEnabled = false;
  }
}

function saveCxlCountdownPreference() {
  try {
    localStorage.setItem(CXL_COUNTDOWN_STORAGE_KEY, cxlCountdownEnabled ? "1" : "0");
  } catch {
    /* ignore storage failures */
  }
}

function updateHeaderMenuCountdownCheck() {
  const check = document.getElementById("headerMenuCountdownCheck");
  const toggleBtn = document.getElementById("headerMenuToggleCountdown");
  if (check) check.hidden = !cxlCountdownEnabled;
  if (toggleBtn) toggleBtn.setAttribute("aria-checked", cxlCountdownEnabled ? "true" : "false");
}

function setCxlCountdownEnabled(enabled) {
  cxlCountdownEnabled = enabled;
  saveCxlCountdownPreference();
  updateHeaderMenuCountdownCheck();
  renderTable();
  updateModalIfOpen();
}

function toggleCxlCountdown() {
  setCxlCountdownEnabled(!cxlCountdownEnabled);
}

function closeHeaderMenu() {
  const menu = document.getElementById("headerMenuDropdown");
  const btn = document.getElementById("headerMenuBtn");
  if (menu) menu.hidden = true;
  if (btn) btn.setAttribute("aria-expanded", "false");
}

function openHeaderMenu() {
  const menu = document.getElementById("headerMenuDropdown");
  const btn = document.getElementById("headerMenuBtn");
  if (!menu || !btn) return;
  menu.hidden = false;
  btn.setAttribute("aria-expanded", "true");
  updateHeaderMenuCountdownCheck();
}

function initHeaderMenu() {
  const btn = document.getElementById("headerMenuBtn");
  const menu = document.getElementById("headerMenuDropdown");
  if (!btn || !menu) return;

  btn.addEventListener("click", e => {
    e.stopPropagation();
    if (menu.hidden) openHeaderMenu();
    else closeHeaderMenu();
  });

  document.getElementById("headerMenuEditTable")?.addEventListener("click", e => {
    e.stopPropagation();
    closeHeaderMenu();
    openEditTablePopover(btn);
  });

  document.getElementById("headerMenuToggleCountdown")?.addEventListener("click", e => {
    e.stopPropagation();
    toggleCxlCountdown();
  });

  document.addEventListener("click", e => {
    if (menu.hidden) return;
    if (menu.contains(e.target) || btn.contains(e.target)) return;
    closeHeaderMenu();
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeHeaderMenu();
  });

  updateHeaderMenuCountdownCheck();
}

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
  "Selected","Flag",
  "Status","Division","Vendor","Buyer","Buyer PO #","SO #","PO Date","PO #",
  "Old PO #","Style #","Color","PO Qty","Actual Qty","Ctn Qty","Ship Method",
  "Vessel","House #","Shipped","ETD",
  "EST EXF","EST IHD","EXF","ETA","IHD","CXL Date","Assign Date","Notes"
];

const COLUMN_WIDTHS = [
  52, 36,
  130, 120, 130, 120, 100, 80, 80, 80, 80, 100, 100, 60, 60, 60, 100,
  100, 80, 80, 80,
  80, 80, 80, 80, 80, 80, 80, 200
];

const COLUMN_LABELS = {
  "Actual Qty": "Act Qty",
  "Ctn Qty": "CTN",
  "Assign Date": "Assigned",
};

const UI_ONLY_COLS = new Set(["Selected", "Flag"]);

const ALWAYS_VISIBLE_COLUMNS = new Set(["Selected", "Flag", "Status"]);

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

function normalizeRow(row) {
  const out = { ...row };
  for (const [from, to] of Object.entries(ROW_KEY_ALIASES)) {
    if (from in out && !(to in out)) out[to] = out[from];
    delete out[from];
  }
  delete out[""];
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

  if (APPS_SCRIPT_URL === "YOUR_APPS_SCRIPT_WEB_APP_URL_HERE") {
    showIndicator("Default view saved", "success");
    return;
  }

  try {
    showIndicator(`Saving default${ELLIPSIS}`, "");
    const res = await fetch(APPS_SCRIPT_URL, {
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

const EDITABLE = new Set([
  "Selected","Flag",
  "PO Qty","Status","Ship Method","Ctn Qty","Vessel","House #",
  "Shipped","ETD","ETA","IHD","EST EXF","EXF","CXL Date","Assign Date","Notes",
  "FOB Cost","Price","OG","PROTO","FIT/PP","BULK","TOP","TRIM",
  "Production Status","EOD/DISCLAIMER",
]);

const READONLY_NO_SELECT_COLS = new Set(["Division", "PO Date", "Vendor"]);

const COPY_ON_CLICK_COLS = new Set([
  "Buyer", "Buyer PO #", "SO #", "PO #", "Old PO #", "Style #", "Color",
]);

const MODAL_FIELD_SIZE = {
  short: new Set([
    "PO #", "Old PO #", "SO #",
    "PO Qty", "Actual Qty", "Ctn Qty",
    "FOB Cost", "Price",
    "PO Date", "Shipped", "ETD", "ETA", "IHD",
    "EST EXF", "EST IHD", "EXF", "CXL Date", "Assign Date",
  ]),
  medium: new Set([
    "Division", "Buyer PO #", "Status", "Vendor", "Buyer", "Flag",
    "Vessel", "House #", "Ship Method",
    "Style #", "Color",
    "OG", "PROTO", "FIT/PP", "BULK", "TOP", "TRIM",
    "Production Status", "EOD/DISCLAIMER",
  ]),
  long: new Set(["Notes"]),
};

function getModalFieldSize(col) {
  if (MODAL_FIELD_SIZE.long.has(col)) return "long";
  if (MODAL_FIELD_SIZE.short.has(col)) return "short";
  if (MODAL_FIELD_SIZE.medium.has(col)) return "medium";
  return "medium";
}

const MODAL_ORDER_INFO_ROWS = [
  ["Status", "Division", "Vendor", "Buyer"],
  ["Buyer PO #", "SO #", "Old PO #", "Flag"],
];

const MODAL_ORDER_DATE_ROWS = [
  ["PO Date", "EST EXF", "EST IHD"],
  ["EXF", "IHD", "CXL Date"],
  ["Shipped", "ETD", "ETA"],
];

const MODAL_SHIPPING_ROWS = [
  ["Ship Method"],
];

const MODAL_SHIPPING_FREIGHT_FIELDS = [
  "Vessel", "House #",
];

const MODAL_PRODUCT_ROWS = [
  ["Style #", "Color"],
  ["PO Qty", "Actual Qty", "Ctn Qty"],
];

const MODAL_PRODUCTION_ROWS = [
  ["FOB Cost", "Price", "Production Status"],
  ["OG", "PROTO", "FIT/PP", "BULK", "TOP", "TRIM"],
  ["EOD/DISCLAIMER"],
];

/** @type {Record<string, unknown> | null} */
let modalRow = null;
let modalFreightExpanded = false;

const EST_IHD_DAYS_BY_SHIP_METHOD = {
  "Air": 7,
  "Sea&Air": 14,
  "Matson": 21,
};

// Single source of truth for status filter, cell editor, and default table sort.
// Reorder entries to change sort priority (top = first). Add/remove statuses here only.
const STATUS_SORT_ORDER = [
  "OTW", "Received", "Arrived at Port", "Arrived at WH", 
  "Assigned", "WIP", "Requested", "Hold",  
  "Shipped", "CXL", "Closed", 
];

const STATUS_FILTER_OPEN = "__open__";
const OPEN_STATUSES = new Set(
  STATUS_SORT_ORDER.filter(status => status !== "CXL" && status !== "Closed")
);

/** Shared default status filter — Open POs until saved otherwise. */
let defaultStatusFilter = STATUS_FILTER_OPEN;

function isValidStatusFilter(value) {
  return value === "" ||
    value === STATUS_FILTER_OPEN ||
    STATUS_SORT_ORDER.includes(value);
}

function setProgramDefaultStatusFilter(status) {
  if (!isValidStatusFilter(status)) return false;
  defaultStatusFilter = status;
  return true;
}

function applyDefaultStatusFilter(status) {
  if (!setProgramDefaultStatusFilter(status)) return false;
  setStatusFilter(status);
  return true;
}

function applyDefaultStatusFilterFromServer(statusFilter) {
  if (statusFilter === null || statusFilter === undefined) return false;
  return applyDefaultStatusFilter(statusFilter);
}

function rowMatchesStatusFilter(row) {
  if (!activeStatus) return true;
  if (activeStatus === STATUS_FILTER_OPEN) {
    return OPEN_STATUSES.has(row["Status"]);
  }
  return row["Status"] === activeStatus;
}

function statusSortIndex(status) {
  const i = STATUS_SORT_ORDER.indexOf(String(status ?? "").trim());
  return i === -1 ? STATUS_SORT_ORDER.length : i;
}

const DIVISIONS = ["Elevator Disco", "Freesia"];

let activeDivision = "";
let activeStatus = STATUS_FILTER_OPEN;

function initStatusFilters() {
  const group = document.getElementById("statusFilters");
  if (!group) return;

  const makeBtn = (label, value) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "filter-btn";
    btn.dataset.status = value;
    btn.textContent = label;
    btn.onclick = () => setStatusFilter(value);
    return btn;
  };

  group.innerHTML = "";
  group.appendChild(makeBtn("All", ""));
  group.appendChild(makeBtn("Open", STATUS_FILTER_OPEN));
  STATUS_SORT_ORDER.forEach(s => group.appendChild(makeBtn(s, s)));
  document.querySelectorAll("#statusFilters .filter-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.status === activeStatus);
  });
}

function setStatusFilter(status) {
  activeStatus = status;
  document.querySelectorAll("#statusFilters .filter-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.status === status);
  });
  applyFilters();
}

function initDivisionFilters() {
  const group = document.getElementById("divisionFilters");
  if (!group) return;

  const makeBtn = (label, value) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "filter-btn";
    btn.dataset.division = value;
    btn.textContent = label;
    btn.onclick = () => setDivisionFilter(value);
    return btn;
  };

  group.innerHTML = "";
  group.appendChild(makeBtn("All", ""));
  DIVISIONS.forEach(d => group.appendChild(makeBtn(d, d)));
  document.querySelectorAll("#divisionFilters .filter-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.division === activeDivision);
  });
}

function setDivisionFilter(division) {
  activeDivision = division;
  document.querySelectorAll("#divisionFilters .filter-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.division === division);
  });
  applyFilters();
}

const SHIP_OPTIONS = ["Air","Sea&Air","Matson"];

const SELECT_EDIT_COLS = new Set(["Status", "Ship Method"]);

const COLUMN_FILTER_COLS = [
  "Vendor", "Buyer", "Ship Method",
  "EST EXF", "EST IHD", "EXF", "ETA", "IHD", "CXL Date", "Assign Date",
];

const DATE_FILTER_COLS = new Set([
  "EST EXF", "EST IHD", "EXF", "ETA", "IHD", "CXL Date", "Assign Date",
]);

const BLANK_FILTER_LABEL = "(Blanks)";

/** @type {Record<string, Set<string> | null>} null = show all values */
const columnFilters = Object.fromEntries(COLUMN_FILTER_COLS.map(col => [col, null]));

let openFilterCol = null;
/** @type {Set<string>} */
let filterDraft = new Set();

function normalizeFilterValue(val) {
  const s = String(val ?? "").trim();
  return s === "" ? BLANK_FILTER_LABEL : s;
}

function isOpenRow(row) {
  return OPEN_STATUSES.has(String(row["Status"] ?? "").trim());
}

function getColumnFilterRawValue(col, row) {
  if (col === "EST IHD") return calculateEstIhd(row["Ship Method"], row["EST EXF"]);
  return row[col];
}

function getFilterValueKey(col, row) {
  const raw = getColumnFilterRawValue(col, row);
  if (DATE_FILTER_COLS.has(col)) {
    if (isEmptyValue(raw)) return BLANK_FILTER_LABEL;
    return normalizeToYmd(raw) || BLANK_FILTER_LABEL;
  }
  return normalizeFilterValue(raw);
}

function getFilterValueLabel(col, key) {
  if (key === BLANK_FILTER_LABEL) return BLANK_FILTER_LABEL;
  if (DATE_FILTER_COLS.has(col)) return formatDateForDisplay(key);
  return key;
}

function compareFilterValues(a, b, col) {
  if (a === BLANK_FILTER_LABEL) return 1;
  if (b === BLANK_FILTER_LABEL) return -1;
  return a.localeCompare(b, undefined, { numeric: !DATE_FILTER_COLS.has(col) });
}

function getUniqueColumnValues(col) {
  const values = new Set();
  const sourceRows = DATE_FILTER_COLS.has(col)
    ? allRows.filter(isOpenRow)
    : allRows;
  sourceRows.forEach(row => values.add(getFilterValueKey(col, row)));
  return [...values].sort((a, b) => compareFilterValues(a, b, col));
}

function isColumnFilterActive(col) {
  return columnFilters[col] != null;
}

function hasActiveColumnFilters() {
  return COLUMN_FILTER_COLS.some(col => columnFilters[col] != null);
}

function updateClearAllFiltersButton() {
  const btn = document.getElementById("clearAllColumnFiltersBtn");
  if (btn) btn.hidden = !hasActiveColumnFilters();
}

function clearAllColumnFilters() {
  COLUMN_FILTER_COLS.forEach(col => { columnFilters[col] = null; });
  closeColumnFilterPopover();
  updateColumnFilterHeaderStates();
  applyFilters();
}

function rowPassesColumnFilters(row) {
  for (const col of COLUMN_FILTER_COLS) {
    const selected = columnFilters[col];
    if (selected == null) continue;
    if (selected.size === 0) return false;
    if (!selected.has(getFilterValueKey(col, row))) return false;
  }
  return true;
}

function getEffectiveFilterSelection(col) {
  const selected = columnFilters[col];
  if (selected == null) return new Set(getUniqueColumnValues(col));
  return new Set(selected);
}

function updateColumnFilterHeaderStates() {
  document.querySelectorAll("th.th-filterable").forEach(th => {
    th.classList.toggle("filter-active", isColumnFilterActive(th.dataset.col));
  });
}

function renderColumnFilterList() {
  const list = document.getElementById("columnFilterList");
  if (!list || !openFilterCol) return;

  list.innerHTML = "";
  getUniqueColumnValues(openFilterCol).forEach(value => {
    const label = document.createElement("label");
    label.className = "column-filter-option";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = value;
    cb.checked = filterDraft.has(value);
    cb.addEventListener("change", () => {
      if (cb.checked) filterDraft.add(value);
      else filterDraft.delete(value);
    });

    const span = document.createElement("span");
    span.textContent = getFilterValueLabel(openFilterCol, value);

    label.appendChild(cb);
    label.appendChild(span);
    list.appendChild(label);
  });
}

function positionColumnFilterPopover(anchorTh) {
  const pop = document.getElementById("columnFilterPopover");
  if (!pop || !anchorTh) return;

  const rect = anchorTh.getBoundingClientRect();
  const maxLeft = window.innerWidth - pop.offsetWidth - 8;
  const left = Math.min(Math.max(8, rect.left), maxLeft);

  pop.style.top = `${rect.bottom + 4}px`;
  pop.style.left = `${left}px`;
}

function openColumnFilterPopover(col, anchorTh) {
  const pop = document.getElementById("columnFilterPopover");
  if (!pop) return;

  openFilterCol = col;
  filterDraft = getEffectiveFilterSelection(col);

  pop.hidden = false;
  renderColumnFilterList();
  requestAnimationFrame(() => positionColumnFilterPopover(anchorTh));
}

function closeColumnFilterPopover() {
  const pop = document.getElementById("columnFilterPopover");
  if (pop) pop.hidden = true;
  openFilterCol = null;
}

function setFilterDraftSelectAll(selectAll) {
  if (!openFilterCol) return;
  const values = getUniqueColumnValues(openFilterCol);
  filterDraft = selectAll ? new Set(values) : new Set();
  renderColumnFilterList();
}

function applyColumnFilterFromPopover() {
  if (!openFilterCol) return;

  const col = openFilterCol;
  const allValues = getUniqueColumnValues(col);

  if (filterDraft.size === 0) {
    columnFilters[col] = new Set();
  } else if (filterDraft.size === allValues.length) {
    columnFilters[col] = null;
  } else {
    columnFilters[col] = new Set(filterDraft);
  }

  closeColumnFilterPopover();
  updateColumnFilterHeaderStates();
  applyFilters();
}

function initColumnFilterHeaders() {
  document.querySelectorAll("th.th-filterable").forEach(th => {
    const col = th.dataset.col;
    const label = th.querySelector(".th-label");
    if (label) {
      label.addEventListener("click", e => {
        e.stopPropagation();
        sortBy(col);
      });
    }
    th.addEventListener("click", () => openColumnFilterPopover(col, th));
  });

  document.getElementById("columnFilterSelectAll")?.addEventListener("click", () => setFilterDraftSelectAll(true));
  document.getElementById("columnFilterClearAll")?.addEventListener("click", () => setFilterDraftSelectAll(false));
  document.getElementById("columnFilterOk")?.addEventListener("click", applyColumnFilterFromPopover);
  document.getElementById("columnFilterCancel")?.addEventListener("click", closeColumnFilterPopover);
  document.getElementById("clearAllColumnFiltersBtn")?.addEventListener("click", clearAllColumnFilters);

  document.addEventListener("click", e => {
    const pop = document.getElementById("columnFilterPopover");
    if (!pop || pop.hidden) return;
    if (pop.contains(e.target) || e.target.closest("th.th-filterable")) return;
    closeColumnFilterPopover();
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeColumnFilterPopover();
  });

  window.addEventListener("resize", () => {
    if (openFilterCol) {
      const th = document.querySelector(`th.th-filterable[data-col="${CSS.escape(openFilterCol)}"]`);
      if (th) positionColumnFilterPopover(th);
    }
  });
}

const STATUS_BADGE = {
  "Received":"badge-received","Arrived at Port":"badge-port","Arrived at WH":"badge-wh",
  "Assigned":"badge-assigned","OTW":"badge-otw","Requested":"badge-requested",
  "Hold":"badge-hold","Cancelled":"badge-cancelled","WIP":"badge-wip",
  "Shipped":"badge-shipped","Closed":"badge-closed"
};

const DATE_FIELDS = new Set([
  "PO Date","Shipped","ETD","ETA","IHD","EST EXF","EST IHD","EXF","CXL Date","Assign Date",
]);

const COUNTDOWN_DATE_COLS = new Set([
  "Assign Date",
  "EST EXF", "EST IHD", "EXF", "ETA", "IHD", "CXL Date", "Shipped", "ETD",
]);
const CXL_PROXIMITY_COLS = new Set(["IHD", "EST IHD"]);

function getDateFieldValue(col, row) {
  if (col === "EST IHD") return calculateEstIhd(row["Ship Method"], row["EST EXF"]);
  return row[col] ?? "";
}

function diffCalendarDays(fromYmd, toYmd) {
  const from = parseYmdToLocalDate(fromYmd);
  const to = parseYmdToLocalDate(toYmd);
  if (!from || !to) return null;
  const ms = to.getTime() - from.getTime();
  return Math.round(ms / 86400000);
}

function daysFromToday(ymd) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = parseYmdToLocalDate(ymd);
  if (!target) return null;
  return diffCalendarDays(formatDateToYmd(today), normalizeToYmd(ymd));
}

function getCxlProximityLevel(ihdYmd, cxlYmd) {
  if (isEmptyValue(ihdYmd) || isEmptyValue(cxlYmd)) return null;
  const daysUntilCxl = diffCalendarDays(normalizeToYmd(ihdYmd), normalizeToYmd(cxlYmd));
  if (daysUntilCxl == null) return null;
  if (daysUntilCxl < 0 || daysUntilCxl <= 3) return "danger";
  if (daysUntilCxl <= 7) return "warning";
  return null;
}

function renderCountdownDateMarkup(display, countdownLabel, dateClasses) {
  return (
    `<span class="cxl-countdown-stack">` +
    `<span class="${dateClasses.join(" ")}">${display}</span>` +
    (countdownLabel ? `<span class="cxl-countdown-label">${countdownLabel}</span>` : "") +
    `</span>`
  );
}

function buildCountdownDateClasses(proximity, days) {
  const dateClasses = ["date-display"];
  if (proximity === "warning") dateClasses.push("date-proximity-warning");
  else if (proximity === "danger") dateClasses.push("date-proximity-danger");
  else if (days === 0) dateClasses.push("date-today");
  return dateClasses;
}

function getFutureCountdownLabel(days) {
  if (days == null || days <= 0) return "";
  return `D-${days}`;
}

function clearDateDisplayState(el) {
  el.classList.remove(
    "date-countdown-cell",
    "date-proximity-warning",
    "date-proximity-danger"
  );
}

function applyDateCellDisplay(el, col, row, { context = "table" } = {}) {
  clearDateDisplayState(el);
  const rawVal = getDateFieldValue(col, row);

  if (isEmptyValue(rawVal)) {
    setDisplayText(el, EMPTY_DISPLAY);
    return;
  }

  const ymd = normalizeToYmd(rawVal);
  const display = formatDateForDisplay(rawVal);
  const proximity = CXL_PROXIMITY_COLS.has(col)
    ? getCxlProximityLevel(ymd, row["CXL Date"])
    : null;

  if (context === "modal") {
    if (proximity === "warning") el.classList.add("date-proximity-warning");
    if (proximity === "danger") el.classList.add("date-proximity-danger");
  }

  if (cxlCountdownEnabled && COUNTDOWN_DATE_COLS.has(col)) {
    const days = daysFromToday(ymd);
    const countdownLabel = getFutureCountdownLabel(days);
    const dateClasses = buildCountdownDateClasses(proximity, days);

    if (countdownLabel || days === 0) {
      el.classList.add("date-countdown-cell");
      el.classList.remove("empty-display");
      el.innerHTML = renderCountdownDateMarkup(display, countdownLabel, dateClasses);
      return;
    }
  }

  if (context === "table" && proximity) {
    el.classList.remove("empty-display");
    el.innerHTML = `<span class="date-display date-proximity-${proximity}">${display}</span>`;
    return;
  }

  if (context === "modal" && proximity) {
    el.classList.remove("empty-display");
    el.innerHTML = `<span class="date-display date-proximity-${proximity}">${display}</span>`;
    return;
  }

  setDisplayText(el, display);
}



let allRows = [];
let filteredRows = [];
let sortCol = "Status";
let sortDir = 1;
let pageSize = Infinity;
let currentPage = 1;

const DEMO_DATA = [
  { "Division":"Elevator Disco","Status":"Received","Vendor":"Acme Textiles","Buyer":"Kim","Buyer PO #":"BP-1001","SO #":"SO-2201","PO Date":"2024-01-15","PO #":"PO-10001","Old PO #":"","Style #":"ST-100","Color":"Navy","PO Qty":500,"Actual Qty":498,"Ctn Qty":50,"Ship Method":"Sea&Air","Vessel":"Ever Given","House #":"H-001","Shipped":"2024-02-01","ETD":"2024-02-05","ETA":"2024-02-20","IHD":"2024-02-25","EST EXF":"2024-02-18","EST IHD":"2024-02-24","EXF":"2024-02-20","CXL Date":"2024-03-01","Assign Date":"2024-01-20","Notes":"Priority shipment" },
  { "Division":"Freesia","Status":"WIP","Vendor":"Blue Fabrics","Buyer":"Sam","Buyer PO #":"BP-1002","SO #":"SO-2202","PO Date":"2024-01-18","PO #":"PO-10002","Old PO #":"PO-9002","Style #":"ST-200","Color":"Blush","PO Qty":300,"Actual Qty":0,"Ctn Qty":30,"Ship Method":"Air","Vessel":"","House #":"","Shipped":"","ETD":"2024-03-01","ETA":"2024-03-10","IHD":"2024-03-15","EST EXF":"2024-03-08","EST IHD":"2024-03-14","EXF":"","CXL Date":"2024-04-01","Assign Date":"2024-01-22","Notes":"" },
  { "Division":"Elevator Disco","Status":"Shipped","Vendor":"Orient Mfg","Buyer":"Lee","Buyer PO #":"BP-1003","SO #":"SO-2203","PO Date":"2024-01-20","PO #":"PO-10003","Old PO #":"","Style #":"ST-301","Color":"Ivory","PO Qty":1000,"Actual Qty":1000,"Ctn Qty":100,"Ship Method":"Matson","Vessel":"Matson Kona","House #":"H-202","Shipped":"2024-02-10","ETD":"2024-02-12","ETA":"2024-02-22","IHD":"2024-02-28","EST EXF":"2024-02-20","EST IHD":"2024-02-27","EXF":"2024-02-22","CXL Date":"2024-03-10","Assign Date":"2024-01-25","Notes":"Fragile - handle with care" },
  { "Division":"Freesia","Status":"Hold","Vendor":"Summit Goods","Buyer":"Kim","Buyer PO #":"BP-1004","SO #":"SO-2204","PO Date":"2024-02-01","PO #":"PO-10004","Old PO #":"","Style #":"ST-410","Color":"Sage","PO Qty":200,"Actual Qty":0,"Ctn Qty":20,"Ship Method":"Air","Vessel":"","House #":"","Shipped":"","ETD":"","ETA":"","IHD":"2024-04-01","EST EXF":"","EST IHD":"","EXF":"","CXL Date":"2024-04-15","Assign Date":"","Notes":"Awaiting quality approval" },
  { "Division":"Elevator Disco","Status":"Closed","Vendor":"Pacific Imports","Buyer":"Sam","Buyer PO #":"BP-1005","SO #":"SO-2205","PO Date":"2023-12-01","PO #":"PO-10005","Old PO #":"PO-8005","Style #":"ST-501","Color":"Black","PO Qty":750,"Actual Qty":750,"Ctn Qty":75,"Ship Method":"Sea&Air","Vessel":"MSC Maya","House #":"H-099","Shipped":"2024-01-05","ETD":"2024-01-08","ETA":"2024-01-20","IHD":"2024-01-25","EST EXF":"2024-01-18","EST IHD":"2024-01-24","EXF":"2024-01-20","CXL Date":"2024-02-01","Assign Date":"2023-12-10","Notes":"Completed" },
];

async function loadData() {
  showIndicator(`Refreshing${ELLIPSIS}`, "");
  try {
    if (APPS_SCRIPT_URL === "YOUR_APPS_SCRIPT_WEB_APP_URL_HERE") {
      allRows = DEMO_DATA;
    } else {
      const res = await fetch(APPS_SCRIPT_URL);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      allRows = json.data.map(normalizeRow);
      if (json.defaultColumns) applyDefaultColumnsFromServer(json.defaultColumns);
      applyDefaultStatusFilterFromServer(json.defaultStatusFilter);
    }
    syncAllEstIhd(allRows);
    updateColumnFilterHeaderStates();
    applyFilters();
    showIndicator("Loaded", "success");
  } catch (err) {
    showIndicator("Load failed: " + err.message, "error");
  }
}

function applyFilters() {
  const q = document.getElementById("searchInput").value.toLowerCase();
  const div = activeDivision;
  filteredRows = allRows.filter(row => {
    if (div && row["Division"] !== div) return false;
    if (!rowMatchesStatusFilter(row)) return false;
    if (!rowPassesColumnFilters(row)) return false;
    if (q) {
      const haystack = COLUMNS.map(c => String(row[c] ?? "")).join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  if (sortCol) {
    filteredRows.sort((a, b) => {
      if (sortCol === "Status") {
        return (statusSortIndex(a.Status) - statusSortIndex(b.Status)) * sortDir;
      }
      const av = a[sortCol] ?? "";
      const bv = b[sortCol] ?? "";
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * sortDir;
    });
  }

  currentPage = 1;
  renderTable();
  updateClearAllFiltersButton();
}

function isPageSizeAll() {
  return !Number.isFinite(pageSize);
}

function getTotalPages() {
  if (isPageSizeAll() || filteredRows.length === 0) return 1;
  return Math.ceil(filteredRows.length / pageSize);
}

function getPagedRows() {
  if (isPageSizeAll()) return filteredRows;
  const totalPages = getTotalPages();
  currentPage = Math.min(Math.max(1, currentPage), totalPages);
  const start = (currentPage - 1) * pageSize;
  return filteredRows.slice(start, start + pageSize);
}

function updateRowCounter() {
  const el = document.getElementById("rowCounter");
  if (!el) return;

  const total = filteredRows.length;
  if (total === 0) {
    el.textContent = "0 rows";
    return;
  }

  if (isPageSizeAll()) {
    el.textContent = `${total} row${total === 1 ? "" : "s"}`;
    return;
  }

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, total);
  el.textContent = `${start}${EN_DASH}${end} of ${total}`;
}

function updatePaginationUI() {
  const nav = document.getElementById("paginationNav");
  if (!nav) return;

  const totalPages = getTotalPages();
  const showPagination = !isPageSizeAll() && filteredRows.length > pageSize;
  nav.hidden = !showPagination;

  if (!showPagination) return;

  const indicator = document.getElementById("pageIndicator");
  if (indicator) indicator.textContent = `${currentPage} / ${totalPages}`;

  const first = document.getElementById("pageFirst");
  const prev = document.getElementById("pagePrev");
  const next = document.getElementById("pageNext");
  const last = document.getElementById("pageLast");
  const onFirst = currentPage <= 1;
  const onLast = currentPage >= totalPages;

  if (first) first.disabled = onFirst;
  if (prev) prev.disabled = onFirst;
  if (next) next.disabled = onLast;
  if (last) last.disabled = onLast;
}

function scrollTableToTop() {
  document.querySelector(".table-scroll-y")?.scrollTo({ top: 0 });
}

function goToPage(page) {
  const totalPages = getTotalPages();
  const nextPage = Math.min(Math.max(1, page), totalPages);
  if (nextPage === currentPage) return;
  currentPage = nextPage;
  clearMiniSelection();
  closeCellSelectDropdown(false);
  renderTable();
  scrollTableToTop();
}

function setPageSize(value) {
  pageSize = value === "all" ? Infinity : Number(value);
  currentPage = 1;
  closeCellSelectDropdown(false);
  renderTable();
}

function initPagination() {
  const select = document.getElementById("pageSizeSelect");
  select?.addEventListener("change", () => setPageSize(select.value));

  document.getElementById("pageFirst")?.addEventListener("click", () => goToPage(1));
  document.getElementById("pagePrev")?.addEventListener("click", () => goToPage(currentPage - 1));
  document.getElementById("pageNext")?.addEventListener("click", () => goToPage(currentPage + 1));
  document.getElementById("pageLast")?.addEventListener("click", () => goToPage(getTotalPages()));
}

function updateSortHeaders() {
  document.querySelectorAll("thead th[data-col]").forEach(th => {
    th.classList.remove("sorted-asc", "sorted-desc");
    if (sortCol && th.dataset.col === sortCol) {
      th.classList.add(sortDir === 1 ? "sorted-asc" : "sorted-desc");
    }
  });
}

function sortBy(col) {
  if (sortCol === col) sortDir *= -1;
  else { sortCol = col; sortDir = 1; }
  updateSortHeaders();
  applyFilters();
}

function formatDateForDisplay(v) {
  if (isEmptyValue(v)) return EMPTY_DISPLAY;

  const s = String(v).trim();

  // Accept either YYYY-MM-DD or full ISO timestamps like 2026-04-22T07:00:00.000Z
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/.exec(s);
  if (!m) return s; // fallback: don't change unknown formats

  const [, yyyy, mm, dd] = m;
  return `${Number(mm)}/${Number(dd)}/${yyyy.slice(2)}`;
}

function normalizeToYmd(v) {
  if (isEmptyValue(v)) return "";
  const s = String(v).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return s;
}

function parseYmdToLocalDate(ymd) {
  const normalized = normalizeToYmd(ymd);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function formatDateToYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function calculateEstIhd(shipMethod, estExf) {
  if (isEmptyValue(shipMethod) || isEmptyValue(estExf)) return "";

  const method = String(shipMethod).trim();
  const exfYmd = normalizeToYmd(estExf);
  if (!exfYmd) return "";

  const days = EST_IHD_DAYS_BY_SHIP_METHOD[method];
  if (days == null) return "";

  const base = parseYmdToLocalDate(exfYmd);
  if (!base) return "";

  base.setDate(base.getDate() + days);
  return formatDateToYmd(base);
}

function syncEstIhdForRow(row) {
  row["EST IHD"] = calculateEstIhd(row["Ship Method"], row["EST EXF"]);
  return row["EST IHD"];
}

function syncAllEstIhd(rows) {
  rows.forEach(syncEstIhdForRow);
}

function isTruthy(val) {
  if (val === true || val === 1) return true;
  const s = String(val ?? "").trim().toLowerCase();
  return s === "true" || s === "yes" || s === "1" || s === "x";
}

function toSheetBool(val) {
  return !!val;
}

function toggleRowSelected(row, selected, { persist = true } = {}) {
  const next = toSheetBool(selected);
  if (isTruthy(row["Selected"]) === next) return false;
  row["Selected"] = next;
  if (persist) saveUpdate(row["PO #"], { Selected: next });
  updateSelectAllHeader();
  return true;
}

/** @type {Set<number>} visible row indices on the current page */
let miniSelectedIndices = new Set();
let rowSelectPointerId = null;
let rowSelectAnchorIndex = -1;
let rowSelectRangeMode = false;
let rowSelectToggleOff = false;

function isRowMiniSelectBlocked(target) {
  if (!(target instanceof Element)) return true;
  return Boolean(target.closest(
    "input, textarea, select, button, .cell-select-dropdown, .po-flag-btn, " +
    ".td-select-cell, .select-cell, .editable, .copyable-text"
  ));
}

function isTypingInField(target) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

function getVisibleRowTrList() {
  return [...document.querySelectorAll("#tableBody tr[data-po]")];
}

function getRowIndexFromTr(tr) {
  if (!tr) return -1;
  return getVisibleRowTrList().indexOf(tr);
}

function getRowIndexAtPoint(x, y) {
  const tr = document.elementFromPoint(x, y)?.closest("#tableBody tr[data-po]");
  return getRowIndexFromTr(tr);
}

function getOffsetWithin(el, container) {
  let top = 0;
  let left = 0;
  let current = el;
  while (current && current !== container) {
    top += current.offsetTop;
    left += current.offsetLeft;
    current = current.offsetParent;
  }
  if (current !== container) {
    const er = el.getBoundingClientRect();
    const cr = container.getBoundingClientRect();
    return { top: er.top - cr.top, left: er.left - cr.left };
  }
  return { top, left };
}

let miniSelectAntsEl = null;

function ensureMiniSelectAntsOverlay() {
  if (miniSelectAntsEl) return miniSelectAntsEl;
  const container = document.querySelector(".table-scroll-x");
  if (!container) return null;

  miniSelectAntsEl = document.createElement("div");
  miniSelectAntsEl.id = "miniSelectAnts";
  miniSelectAntsEl.className = "mini-select-ants";
  miniSelectAntsEl.hidden = true;
  miniSelectAntsEl.innerHTML =
    `<svg class="mini-select-ants-svg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
    `<rect class="mini-select-ants-rect" fill="none"/></svg>`;
  container.appendChild(miniSelectAntsEl);
  return miniSelectAntsEl;
}

function updateMiniSelectAntsOverlay() {
  const overlay = ensureMiniSelectAntsOverlay();
  if (!overlay) return;

  if (miniSelectedIndices.size === 0) {
    overlay.hidden = true;
    return;
  }

  const container = document.querySelector(".table-scroll-x");
  const table = document.getElementById("poTable");
  const trs = getVisibleRowTrList();
  const sorted = [...miniSelectedIndices].sort((a, b) => a - b);
  const firstTr = trs[sorted[0]];
  const lastTr = trs[sorted[sorted.length - 1]];
  if (!container || !table || !firstTr || !lastTr) {
    overlay.hidden = true;
    return;
  }

  const firstOff = getOffsetWithin(firstTr, container);
  const lastOff = getOffsetWithin(lastTr, container);
  const tableOff = getOffsetWithin(table, container);
  const width = table.offsetWidth;
  const height = lastOff.top + lastTr.offsetHeight - firstOff.top;
  const inset = 0.75;

  overlay.style.top = `${firstOff.top}px`;
  overlay.style.left = `${tableOff.left}px`;
  overlay.style.width = `${width}px`;
  overlay.style.height = `${height}px`;
  overlay.hidden = false;

  const svg = overlay.querySelector(".mini-select-ants-svg");
  const rect = overlay.querySelector(".mini-select-ants-rect");
  if (!svg || !rect) return;

  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  rect.setAttribute("x", String(inset));
  rect.setAttribute("y", String(inset));
  rect.setAttribute("width", String(Math.max(0, width - inset * 2)));
  rect.setAttribute("height", String(Math.max(0, height - inset * 2)));
}

function applyMiniSelectionClasses() {
  getVisibleRowTrList().forEach((tr, i) => {
    tr.classList.toggle("row-mini-selected", miniSelectedIndices.has(i));
  });
  requestAnimationFrame(updateMiniSelectAntsOverlay);
}

function clearMiniSelection() {
  if (miniSelectedIndices.size === 0) return;
  miniSelectedIndices.clear();
  applyMiniSelectionClasses();
}

function setMiniSelectionByIndexRange(startIdx, endIdx) {
  const trs = getVisibleRowTrList();
  if (startIdx < 0 || endIdx < 0 || trs.length === 0) return;

  const lo = Math.min(startIdx, endIdx);
  const hi = Math.max(startIdx, endIdx);
  miniSelectedIndices.clear();
  for (let i = lo; i <= hi; i++) miniSelectedIndices.add(i);
  applyMiniSelectionClasses();
}

function getVisiblePageRow(index) {
  const rows = getPagedRows();
  return rows[index] ?? null;
}

function findRowByPo(po) {
  return allRows.find(row => String(row["PO #"]) === String(po));
}

function getMiniSelectedRows() {
  const rows = [];
  miniSelectedIndices.forEach(index => {
    const row = getVisiblePageRow(index);
    if (row) rows.push(row);
  });
  return rows;
}

function resolveMiniSelectTargetState(rows) {
  const total = rows.length;
  if (total === 0) return null;

  const selectedCount = rows.filter(row => isTruthy(row["Selected"])).length;
  if (selectedCount === total) return false;
  if (selectedCount === 0) return true;
  return selectedCount > total / 2;
}

function toggleMiniSelectedCheckboxState() {
  const rows = getMiniSelectedRows();
  if (rows.length === 0) return;

  const targetState = resolveMiniSelectTargetState(rows);
  if (targetState === null) return;

  const updates = [];
  rows.forEach(row => {
    if (toggleRowSelected(row, targetState, { persist: false })) {
      updates.push({ poNumber: row["PO #"], next: targetState });
    }
  });

  if (updates.length === 0) return;
  renderTable();
  updates.forEach(({ poNumber, next }) => saveUpdate(poNumber, { Selected: next }));
}

function initRowMiniSelection() {
  const tbody = document.getElementById("tableBody");
  if (!tbody) return;

  tbody.addEventListener("pointerdown", e => {
    if (e.button !== 0) return;
    const tr = e.target.closest("tr[data-po]");
    if (!tr || isRowMiniSelectBlocked(e.target)) return;

    const idx = getRowIndexFromTr(tr);
    if (idx === -1) return;

    rowSelectPointerId = e.pointerId;
    rowSelectAnchorIndex = idx;
    rowSelectRangeMode = false;
    rowSelectToggleOff = miniSelectedIndices.size === 1 && miniSelectedIndices.has(idx);
    if (!rowSelectToggleOff) {
      setMiniSelectionByIndexRange(idx, idx);
    }

    tbody.setPointerCapture(e.pointerId);
    document.body.classList.add("row-drag-selecting");
  });

  tbody.addEventListener("pointermove", e => {
    if (e.pointerId !== rowSelectPointerId) return;
    if (!(e.buttons & 1)) return;

    const currentIdx = getRowIndexAtPoint(e.clientX, e.clientY);
    if (currentIdx === -1) return;

    if (currentIdx !== rowSelectAnchorIndex) {
      rowSelectRangeMode = true;
      rowSelectToggleOff = false;
    }

    if (rowSelectRangeMode) {
      setMiniSelectionByIndexRange(rowSelectAnchorIndex, currentIdx);
    }
  });

  function endRowPointerSelect(e) {
    if (e.pointerId !== rowSelectPointerId) return;

    if (!rowSelectRangeMode && rowSelectToggleOff) {
      clearMiniSelection();
    } else if (!rowSelectRangeMode && rowSelectAnchorIndex >= 0) {
      setMiniSelectionByIndexRange(rowSelectAnchorIndex, rowSelectAnchorIndex);
    }

    if (tbody.hasPointerCapture(e.pointerId)) {
      tbody.releasePointerCapture(e.pointerId);
    }

    rowSelectPointerId = null;
    rowSelectAnchorIndex = -1;
    rowSelectRangeMode = false;
    rowSelectToggleOff = false;
    document.body.classList.remove("row-drag-selecting");
  }

  tbody.addEventListener("pointerup", endRowPointerSelect);
  tbody.addEventListener("pointercancel", endRowPointerSelect);

  document.addEventListener("mousedown", e => {
    if (rowSelectPointerId !== null) return;
    if (e.target.closest("#tableBody")) return;
    if (e.target.closest(".column-filter-popover, .cell-select-dropdown, .header-menu-dropdown")) return;
    clearMiniSelection();
  });

  document.addEventListener("keydown", e => {
    if (e.key !== " " && e.code !== "Space") return;
    if (miniSelectedIndices.size === 0) return;
    if (isTypingInField(e.target)) return;
    e.preventDefault();
    toggleMiniSelectedCheckboxState();
  });

  document.querySelector(".table-scroll-y")?.addEventListener(
    "scroll",
    updateMiniSelectAntsOverlay,
    { passive: true }
  );
  window.addEventListener("resize", updateMiniSelectAntsOverlay, { passive: true });
}

function updateModalIfOpen() {
  if (!modalRow || !document.getElementById("modalOverlay")?.classList.contains("open")) return;
  renderModalContent(modalRow);
}

function toggleRowFlag(row) {
  const next = !isTruthy(row["Flag"]);
  row["Flag"] = next;
  saveUpdate(row["PO #"], { Flag: next });
  renderTable();
  updateModalIfOpen();
}

function setAllFilteredSelected(selected) {
  const next = toSheetBool(selected);
  const changed = [];
  filteredRows.forEach(row => {
    if (isTruthy(row["Selected"]) === next) return;
    row["Selected"] = next;
    changed.push(row["PO #"]);
  });
  if (changed.length === 0) return;
  renderTable();
  changed.forEach(poNumber => saveUpdate(poNumber, { Selected: next }));
}

function updateSelectAllHeader() {
  const cb = document.getElementById("selectAllRowsCheckbox");
  if (!cb) return;

  if (filteredRows.length === 0) {
    cb.checked = false;
    cb.indeterminate = false;
    cb.disabled = true;
    return;
  }

  cb.disabled = false;
  const selectedCount = filteredRows.filter(row => isTruthy(row["Selected"])).length;
  cb.checked = selectedCount === filteredRows.length;
  cb.indeterminate = selectedCount > 0 && selectedCount < filteredRows.length;
}

function initRowSelection() {
  const cb = document.getElementById("selectAllRowsCheckbox");
  cb?.addEventListener("click", e => {
    e.stopPropagation();
    setAllFilteredSelected(cb.checked);
  });
  initRowMiniSelection();
}

const FLAG_ICON_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" ` +
  `fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
  `<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>` +
  `<line x1="4" y1="22" x2="4" y2="15"/></svg>`;

function renderSelectedCell(td, row) {
  td.className = "td-select-cell readonly-no-select";
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.className = "po-select-checkbox";
  cb.checked = isTruthy(row["Selected"]);
  cb.setAttribute("aria-label", `Select PO ${row["PO #"] ?? ""}`);
  cb.addEventListener("click", e => {
    e.stopPropagation();
    toggleRowSelected(row, cb.checked);
  });
  td.appendChild(cb);
}

function renderFlagCell(td, row) {
  td.className = "td-flag-cell readonly-no-select";
  const flagged = isTruthy(row["Flag"]);
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "po-flag-btn" + (flagged ? " is-flagged" : "");
  btn.setAttribute("aria-label", flagged ? "Unflag PO" : "Flag PO");
  btn.title = flagged ? "Unflag" : "Flag";
  btn.innerHTML = FLAG_ICON_SVG;
  btn.addEventListener("click", e => {
    e.stopPropagation();
    toggleRowFlag(row);
  });
  td.appendChild(btn);
}

function renderTable() {
  closeCellSelectDropdown(false);
  const tbody = document.getElementById("tableBody");
  const rowsToRender = getPagedRows();
  updateRowCounter();
  updatePaginationUI();

  if (filteredRows.length === 0) {
    tbody.innerHTML = `<tr class="state-row"><td colspan="${visibleColumnCount()}">No POs match your filters.</td></tr>`;
    applyColumnVisibility();
    return;
  }

  tbody.innerHTML = "";
  rowsToRender.forEach(row => {
    const tr = document.createElement("tr");
    tr.dataset.po = row["PO #"];

    tr.className = "clickable-row";
    if (isTruthy(row["Flag"])) tr.classList.add("row-flagged");
    tr.ondblclick = e => {
      if (shouldIgnoreRowDblClick(e)) return;
      openPODetail(row);
    };

    COLUMNS.forEach(col => {
      const td = document.createElement("td");
      td.dataset.col = col;

      if (col === "Selected") {
        renderSelectedCell(td, row);
        tr.appendChild(td);
        return;
      }
      if (col === "Flag") {
        renderFlagCell(td, row);
        tr.appendChild(td);
        return;
      }

      const editable = EDITABLE.has(col);
      const val = col === "EST IHD"
        ? calculateEstIhd(row["Ship Method"], row["EST EXF"])
        : (row[col] ?? "");

      if (editable) {
        td.className = "editable";
        td.title = SELECT_EDIT_COLS.has(col) ? "Click to choose" : "Click to edit";
        bindEditableCell(td, col, row);
      } else if (READONLY_NO_SELECT_COLS.has(col)) {
        td.className = "readonly readonly-no-select";
      } else if (COPY_ON_CLICK_COLS.has(col)) {
        td.className = "readonly";
      } else {
        td.className = "readonly";
      }

      if (col === "Status") {
        td.innerHTML = renderStatus(val);
      } else if (DATE_FIELDS.has(col)) {
        applyDateCellDisplay(td, col, row, { context: "table" });
      } else if (COPY_ON_CLICK_COLS.has(col)) {
        mountCopyableText(td, col, val);
      } else if (isEmptyValue(val)) {
        setDisplayText(td, EMPTY_DISPLAY);
      } else {
        td.textContent = val;
        td.classList.remove("empty-display");
      }

      if (editable && !SELECT_EDIT_COLS.has(col)) {
        wrapEditablePreview(td);
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  applyColumnVisibility();
  updateSelectAllHeader();
  applyMiniSelectionClasses();
}

function renderStatus(val) {
  if (isEmptyValue(val)) return `<span class="empty-display">${EMPTY_DISPLAY}</span>`;
  const cls = STATUS_BADGE[val] || "badge-cancelled";
  return `<span class="badge ${cls}">${val}</span>`;
}

function getCopyText(col, rawVal) {
  if (isEmptyValue(rawVal)) return "";
  if (DATE_FIELDS.has(col)) return formatDateForDisplay(rawVal);
  return String(rawVal).trim();
}

async function copyCellValue(col, rawVal) {
  const text = getCopyText(col, rawVal);
  if (!text || text === EMPTY_DISPLAY) {
    showIndicator("Nothing to copy", "error");
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    showIndicator(`Copied ${text}`, "success");
  } catch {
    showIndicator("Copy failed", "error");
  }
}

function mountCopyableText(container, col, rawVal) {
  container.innerHTML = "";
  const text = getCopyText(col, rawVal);
  if (!text || text === EMPTY_DISPLAY) {
    setDisplayText(container, EMPTY_DISPLAY);
    return;
  }

  container.classList.remove("empty-display");
  const span = document.createElement("span");
  span.className = "copyable-text";
  span.textContent = text;
  span.title = "Click to copy";
  span.addEventListener("click", e => {
    e.stopPropagation();
    copyCellValue(col, rawVal);
  });
  container.appendChild(span);
}

/** @type {{ anchor: HTMLElement, col: string, row: Record<string, unknown> } | null} */
let openCellSelect = null;

function getCellSelectOptions(col) {
  if (col === "Status") {
    return STATUS_SORT_ORDER.map(value => ({ value, label: value }));
  }
  if (col === "Ship Method") {
    return ["", ...SHIP_OPTIONS].map(value => ({
      value,
      label: value || EMPTY_DISPLAY,
    }));
  }
  return [];
}

function positionCellSelectDropdown(anchorEl) {
  const pop = document.getElementById("cellSelectDropdown");
  if (!pop || !anchorEl) return;

  const rect = anchorEl.getBoundingClientRect();
  pop.style.top = `${rect.bottom + 2}px`;
  pop.style.left = `${rect.left}px`;
  pop.style.width = `${rect.width}px`;
}

function renderCellSelectDropdown(col, row) {
  const pop = document.getElementById("cellSelectDropdown");
  if (!pop) return;

  const currentVal = row[col] ?? "";
  pop.dataset.col = col;
  pop.innerHTML = "";

  getCellSelectOptions(col).forEach(({ value, label }) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cell-select-option";
    if (value === currentVal) btn.classList.add("selected");

    if (col === "Status" && value) {
      btn.innerHTML = renderStatus(value);
    } else {
      btn.textContent = label;
    }

    btn.addEventListener("click", e => {
      e.stopPropagation();
      selectCellSelectOption(value);
    });

    pop.appendChild(btn);
  });
}

function closeCellSelectDropdown(clearAnchorState = true) {
  const pop = document.getElementById("cellSelectDropdown");
  if (pop) pop.hidden = true;

  if (clearAnchorState && openCellSelect?.anchor) {
    delete openCellSelect.anchor.dataset.editing;
    openCellSelect.anchor.classList.remove("select-cell-open", "select-cell-hover");
  }

  openCellSelect = null;
}

function selectCellSelectOption(value) {
  if (!openCellSelect) return;

  const { col, row } = openCellSelect;
  const currentVal = row[col] ?? "";

  if (value === currentVal) {
    closeCellSelectDropdown();
    return;
  }

  closeCellSelectDropdown(false);

  row[col] = value;
  const updates = { [col]: value };
  if (col === "Ship Method") {
    updates["EST IHD"] = syncEstIhdForRow(row);
  }

  saveUpdate(row["PO #"], updates);
  renderTable();
  updateModalIfOpen();
}

function openCellSelectDropdown(anchorEl, col, row) {
  if (openCellSelect?.anchor === anchorEl) {
    closeCellSelectDropdown();
    return;
  }

  closeCellSelectDropdown();
  openCellSelect = { anchor: anchorEl, col, row };

  anchorEl.dataset.editing = "active";
  anchorEl.classList.add("select-cell-open");
  anchorEl.classList.remove("select-cell-hover");

  renderCellSelectDropdown(col, row);
  const pop = document.getElementById("cellSelectDropdown");
  if (!pop) return;

  pop.hidden = false;
  requestAnimationFrame(() => positionCellSelectDropdown(anchorEl));
}

function initCellSelectDropdown() {
  document.addEventListener("click", e => {
    const pop = document.getElementById("cellSelectDropdown");
    if (!pop || pop.hidden) return;
    if (pop.contains(e.target) || e.target.closest(".select-cell")) return;
    closeCellSelectDropdown();
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && openCellSelect) {
      closeCellSelectDropdown();
    }
  });

  window.addEventListener("resize", () => {
    if (openCellSelect) positionCellSelectDropdown(openCellSelect.anchor);
  });

  document.querySelector(".table-scroll-y")?.addEventListener("scroll", () => {
    if (openCellSelect) positionCellSelectDropdown(openCellSelect.anchor);
  }, { passive: true });

  document.getElementById("modalBody")?.addEventListener("scroll", () => {
    if (openCellSelect) positionCellSelectDropdown(openCellSelect.anchor);
  }, { passive: true });
}

function createCellInput(col, val) {
  if (col === "Notes") {
    const textarea = document.createElement("textarea");
    textarea.className = "cell-input cell-textarea";
    textarea.value = val;
    textarea.rows = 3;
    return textarea;
  }

  if (DATE_FIELDS.has(col)) {
    const input = document.createElement("input");
    input.type = "date";
    input.className = "cell-input";
    input.value = normalizeToYmd(val);
    return input;
  }

  const input = document.createElement("input");
  input.type = "text";
  input.className = "cell-input";
  input.value = val;
  return input;
}

function getEditorComparableValue(col, val) {
  if (DATE_FIELDS.has(col)) return normalizeToYmd(val) || "";
  return String(val ?? "").trim();
}

function attachCellEditorHandlers(fieldEl, col, row, input, originalVal) {
  const originalComparable = getEditorComparableValue(col, originalVal);

  function commit() {
    const newVal = input.value;
    if (getEditorComparableValue(col, newVal) === originalComparable) {
      renderTable();
      updateModalIfOpen();
      return;
    }

    row[col] = newVal;

    const updates = { [col]: newVal };
    if (col === "Ship Method" || col === "EST EXF") {
      updates["EST IHD"] = syncEstIhdForRow(row);
    }

    saveUpdate(row["PO #"], updates);
    renderTable();
    updateModalIfOpen();
  }

  function cancelEdit() {
    renderTable();
    updateModalIfOpen();
  }

  input.onblur = commit;
  input.onkeydown = e => {
    if (e.key === "Escape") cancelEdit();
    if (col === "Notes") return;
    if (e.key === "Enter") input.blur();
  };
}

function mountFieldEditor(fieldEl, col, row) {
  if (fieldEl.dataset.editing === "active") return;

  const val = row[col] ?? "";
  const input = createCellInput(col, val);

  fieldEl.innerHTML = "";
  fieldEl.appendChild(input);
  fieldEl.classList.add("editing");
  fieldEl.dataset.editing = "active";
  attachCellEditorHandlers(fieldEl, col, row, input, val);
  input.focus();
}

function mountCellEditor(td, col, row) {
  mountFieldEditor(td, col, row);
}

function bindSelectCellInteractions(anchorEl, col, row) {
  anchorEl.classList.add("select-cell");

  anchorEl.addEventListener("mouseenter", () => {
    if (anchorEl.dataset.editing) return;
    anchorEl.classList.add("select-cell-hover");
  });

  anchorEl.addEventListener("mouseleave", () => {
    if (anchorEl.dataset.editing === "active") return;
    anchorEl.classList.remove("select-cell-hover");
  });

  anchorEl.addEventListener("mousedown", e => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    openCellSelectDropdown(anchorEl, col, row);
  });
}

function bindEditableCell(td, col, row) {
  if (SELECT_EDIT_COLS.has(col)) {
    bindSelectCellInteractions(td, col, row);
    return;
  }

  td.onclick = () => startEdit(td, col, row);
}

function startEdit(td, col, row) {
  if (td.dataset.editing === "active") return;
  mountFieldEditor(td, col, row);
}

function bindFieldInteractions(fieldEl, col, row) {
  fieldEl.dataset.col = col;

  if (col === "Flag") {
    fieldEl.classList.add("readonly", "readonly-no-select");
    return;
  }

  if (EDITABLE.has(col)) {
    if (SELECT_EDIT_COLS.has(col)) {
      fieldEl.classList.add("editable", "select-cell");
      fieldEl.title = "Click to choose";
      bindSelectCellInteractions(fieldEl, col, row);
    } else {
      fieldEl.classList.add("editable");
      fieldEl.title = "Click to edit";
      fieldEl.onclick = e => {
        e.stopPropagation();
        mountFieldEditor(fieldEl, col, row);
      };
    }
    return;
  }

  if (READONLY_NO_SELECT_COLS.has(col)) {
    fieldEl.classList.add("readonly", "readonly-no-select");
    return;
  }

  if (COPY_ON_CLICK_COLS.has(col)) {
    fieldEl.classList.add("readonly");
    return;
  }

  fieldEl.classList.add("readonly");
}

function setFieldDisplayContent(fieldEl, col, row) {
  const val = col === "EST IHD"
    ? calculateEstIhd(row["Ship Method"], row["EST EXF"])
    : (row[col] ?? "");

  if (col === "Status") {
    fieldEl.innerHTML = renderStatus(val);
  } else if (col === "Flag") {
    renderFlagCell(fieldEl, row);
  } else if (DATE_FIELDS.has(col)) {
    applyDateCellDisplay(fieldEl, col, row, { context: "modal" });
  } else if (COPY_ON_CLICK_COLS.has(col)) {
    mountCopyableText(fieldEl, col, val);
  } else if (isEmptyValue(val)) {
    setDisplayText(fieldEl, EMPTY_DISPLAY);
  } else {
    fieldEl.textContent = val;
    fieldEl.classList.remove("empty-display");
  }
}

function createModalField(col, row, { dateSlot = false } = {}) {
  const size = dateSlot ? "date" : getModalFieldSize(col);
  const fieldWrap = document.createElement("div");
  fieldWrap.className = `modal-field modal-field--${size}`;
  if (dateSlot) fieldWrap.classList.add("modal-field--date-slot");
  fieldWrap.dataset.col = col;

  const labelEl = document.createElement("label");
  labelEl.className = "modal-field-label";
  labelEl.textContent = getColumnLabel(col);

  const valueEl = document.createElement("div");
  valueEl.className = "modal-field-value";
  setFieldDisplayContent(valueEl, col, row);
  bindFieldInteractions(valueEl, col, row);

  fieldWrap.appendChild(labelEl);
  fieldWrap.appendChild(valueEl);
  if (EDITABLE.has(col) && !SELECT_EDIT_COLS.has(col)) {
    wrapEditablePreview(valueEl);
  }
  return fieldWrap;
}

function shouldShowAssignDate(row) {
  return String(row["Division"] ?? "").trim() === "Freesia";
}

function createModalOrderSection(row) {
  const { block, content } = createModalBlock(null);
  block.classList.add("modal-block--order");

  const split = document.createElement("div");
  split.className = "modal-order-split";

  const infoCol = document.createElement("div");
  infoCol.className = "modal-order-info";
  appendModalFieldRows(infoCol, MODAL_ORDER_INFO_ROWS, row);

  const notesWrap = document.createElement("div");
  notesWrap.className = "modal-order-notes";
  notesWrap.appendChild(createModalField("Notes", row));
  infoCol.appendChild(notesWrap);

  const datesCol = document.createElement("div");
  datesCol.className = "modal-order-dates";
  const dateRows = MODAL_ORDER_DATE_ROWS.map(cols => [...cols]);
  if (shouldShowAssignDate(row)) dateRows[1].push("Assign Date");
  appendModalFieldRows(datesCol, dateRows, row, { dateSlot: true });

  split.appendChild(infoCol);
  split.appendChild(datesCol);
  content.appendChild(split);
  return block;
}

function createModalBlock(title) {
  const block = document.createElement("section");
  block.className = "modal-block";

  if (title) {
    const titleEl = document.createElement("h4");
    titleEl.className = "modal-section-title";
    titleEl.textContent = title;
    block.appendChild(titleEl);
  }

  const content = document.createElement("div");
  content.className = "modal-block-content";
  block.appendChild(content);
  return { block, content };
}

function createModalFieldRow(cols, row, options = {}) {
  const rowEl = document.createElement("div");
  rowEl.className = "modal-field-row";
  cols.forEach(col => rowEl.appendChild(createModalField(col, row, options)));
  return rowEl;
}

function appendModalFieldRows(container, rowDefs, row, options = {}) {
  rowDefs.forEach(cols => container.appendChild(createModalFieldRow(cols, row, options)));
}

function createModalFieldsGrid(cols, row, options = {}) {
  const gridEl = document.createElement("div");
  gridEl.className = "modal-fields-grid";

  cols.forEach(col => {
    gridEl.appendChild(createModalField(col, row, options));
  });

  return gridEl;
}

function createStylePhotoPlaceholders() {
  const wrap = document.createElement("div");
  wrap.className = "modal-style-photos";

  for (let i = 1; i <= 2; i++) {
    const photo = document.createElement("div");
    photo.className = "modal-style-photo";
    photo.setAttribute("aria-label", `Style photo ${i} placeholder`);

    const label = document.createElement("span");
    label.className = "modal-style-photo-label";
    label.textContent = `Photo ${i}`;

    photo.appendChild(label);
    wrap.appendChild(photo);
  }

  return wrap;
}

function createModalShippingSection(row) {
  const { block, content } = createModalBlock("Shipping");

  MODAL_SHIPPING_ROWS.forEach(cols => {
    content.appendChild(createModalFieldRow(cols, row));
  });

  const freightHeaderRow = document.createElement("div");
  freightHeaderRow.className = "modal-freight-header";

  const freightToggle = document.createElement("span");
  freightToggle.className = "modal-freight-toggle";
  freightToggle.setAttribute("role", "button");
  freightToggle.tabIndex = 0;
  freightToggle.setAttribute("aria-expanded", String(modalFreightExpanded));
  freightToggle.setAttribute("aria-controls", "modalFreightFields");
  freightToggle.textContent = "Freight";

  const collapsible = document.createElement("div");
  collapsible.id = "modalFreightFields";
  collapsible.className = "modal-freight-fields";
  collapsible.hidden = !modalFreightExpanded;
  collapsible.appendChild(createModalFieldsGrid(MODAL_SHIPPING_FREIGHT_FIELDS, row));

  function toggleFreight() {
    modalFreightExpanded = !modalFreightExpanded;
    freightToggle.setAttribute("aria-expanded", String(modalFreightExpanded));
    freightToggle.classList.toggle("is-open", modalFreightExpanded);
    collapsible.hidden = !modalFreightExpanded;
  }

  freightToggle.addEventListener("click", toggleFreight);
  freightToggle.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleFreight();
    }
  });
  freightToggle.classList.toggle("is-open", modalFreightExpanded);

  freightHeaderRow.appendChild(freightToggle);
  content.appendChild(freightHeaderRow);
  content.appendChild(collapsible);
  return block;
}

function renderModalContent(row) {
  const poNumEl = document.getElementById("modalPoNum");
  const badgeEl = document.getElementById("modalStatusBadge");
  const bodyEl = document.getElementById("modalBody");
  if (!poNumEl || !badgeEl || !bodyEl) return;

  const poNum = isEmptyValue(row["PO #"]) ? EMPTY_DISPLAY : row["PO #"];
  poNumEl.className = "modal-po-num";
  poNumEl.onclick = null;
  if (COPY_ON_CLICK_COLS.has("PO #") && !isEmptyValue(row["PO #"])) {
    mountCopyableText(poNumEl, "PO #", row["PO #"]);
  } else {
    setDisplayText(poNumEl, poNum);
  }

  badgeEl.innerHTML = renderStatus(row["Status"]);

  bodyEl.innerHTML = "";

  const layout = document.createElement("div");
  layout.className = "modal-layout";

  const main = document.createElement("div");
  main.className = "modal-layout-main";

  main.appendChild(createModalOrderSection(row));

  main.appendChild(createModalShippingSection(row));

  const bottomSplit = document.createElement("div");
  bottomSplit.className = "modal-bottom-split";

  const { block: productBlock, content: productContent } = createModalBlock("Product");
  appendModalFieldRows(productContent, MODAL_PRODUCT_ROWS, row);
  bottomSplit.appendChild(productBlock);

  const { block: productionBlock, content: productionContent } = createModalBlock("Production");
  appendModalFieldRows(productionContent, MODAL_PRODUCTION_ROWS, row);
  bottomSplit.appendChild(productionBlock);

  main.appendChild(bottomSplit);

  const photosCol = document.createElement("div");
  photosCol.className = "modal-layout-photos";
  photosCol.appendChild(createStylePhotoPlaceholders());

  layout.appendChild(main);
  layout.appendChild(photosCol);
  bodyEl.appendChild(layout);
}

function shouldIgnoreRowDblClick(e) {
  const target = e.target;
  if (!(target instanceof Element)) return false;

  return Boolean(target.closest(
    "input, textarea, select, button, .cell-select-dropdown, .po-flag-btn, .td-select-cell, .select-cell, .editing, [data-editing='active']"
  ));
}

function openPODetail(row) {
  closeCellSelectDropdown(false);
  if (modalRow?.["PO #"] !== row["PO #"]) {
    modalFreightExpanded = false;
  }
  modalRow = row;
  renderModalContent(row);
  document.getElementById("modalOverlay").classList.add("open");
}

function closeModal(event) {
  if (event.target.id === "modalOverlay") {
    closeModalForce();
  }
}

function closeModalForce() {
  closeCellSelectDropdown(false);
  modalRow = null;
  document.getElementById("modalOverlay").classList.remove("open");
}

async function saveUpdate(poNumber, updates) {
  if (APPS_SCRIPT_URL === "YOUR_APPS_SCRIPT_WEB_APP_URL_HERE") {
    showIndicator(`Demo mode ${EMPTY_DISPLAY} not saved to sheet`, "");
    return;
  }
  try {
    showIndicator(`Saving${ELLIPSIS}`, "");
    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({ action: "update", poNumber, updates })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    showIndicator(`Saved ${CHECK_MARK}`, "success");
  } catch (err) {
    showIndicator("Save failed: " + err.message, "error");
  }
}

let indicatorTimer;
function showIndicator(msg, type) {
  const el = document.getElementById("saveIndicator");
  el.textContent = msg;
  el.className = "save-indicator visible " + (type || "");
  clearTimeout(indicatorTimer);
  indicatorTimer = setTimeout(() => el.classList.remove("visible"), 2500);
}

loadColumnVisibility();
loadCxlCountdownPreference();
initDivisionFilters();
initStatusFilters();
initColumnFilterHeaders();
initCellSelectDropdown();
initPagination();
initHeaderMenu();
initEditTable();
initRowSelection();
updateSortHeaders();
updateColumnFilterHeaderStates();
applyColumnVisibility();
loadData();
