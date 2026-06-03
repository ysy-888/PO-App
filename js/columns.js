function setDisplayText(el, text) {
  el.textContent = text;
  el.classList.toggle("empty-display", text === EMPTY_DISPLAY);
}

function buildSearchHighlightedHtml(text, query) {
  const str = String(text ?? "");
  const q = String(query ?? "").trim();
  if (!q) return escapeHtml(str);

  const lowerStr = str.toLowerCase();
  const lowerQ = q.toLowerCase();
  if (!lowerStr.includes(lowerQ)) return escapeHtml(str);

  let html = "";
  let start = 0;
  let idx = lowerStr.indexOf(lowerQ, start);
  while (idx !== -1) {
    html += escapeHtml(str.slice(start, idx));
    html += `<mark class="search-match">${escapeHtml(str.slice(idx, idx + q.length))}</mark>`;
    start = idx + q.length;
    idx = lowerStr.indexOf(lowerQ, start);
  }
  html += escapeHtml(str.slice(start));
  return html;
}

function getSearchHighlightedFragment(displayText, searchableText) {
  const display = String(displayText ?? "");
  const q = (activeSearchQuery ?? "").trim();
  if (!q) return escapeHtml(display);

  const hay = String(searchableText ?? display).toLowerCase();
  if (!hay.includes(q.toLowerCase())) return escapeHtml(display);
  if (display.toLowerCase().includes(q.toLowerCase())) return buildSearchHighlightedHtml(display, q);
  return `<mark class="search-match">${escapeHtml(display)}</mark>`;
}

function mountSearchHighlightedText(el, displayText, searchableText) {
  if (displayText === EMPTY_DISPLAY || isEmptyValue(displayText)) {
    setDisplayText(el, EMPTY_DISPLAY);
    return;
  }
  const q = (activeSearchQuery ?? "").trim();
  if (!q) {
    setDisplayText(el, displayText);
    return;
  }
  const hay = String(searchableText ?? displayText).toLowerCase();
  if (!hay.includes(q.toLowerCase())) {
    setDisplayText(el, displayText);
    return;
  }
  el.classList.remove("empty-display");
  el.innerHTML = getSearchHighlightedFragment(displayText, searchableText);
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
  "Flag","Selected",
  "Status","N41 Status","Division","Vendor","Buyer","Buyer PO #","SO #","PO Date","PO #",
  "Old PO #","Style #","Color","Style Category","PO Qty","Actual Qty","Ctn Qty","Received Qty","FOB Cost","PO Total Cost",
  "Vessel","House #","Shipped","ETD",
  "EST EXF","EST IHD","Ship Method","Shipment ID","Packing List",
  "EXF Requested","EXF Date","EXF Req Date","EXF Memo",
  "ASN Requested","ASN Date","ASN Req Date","ASN Request ID",
  "Delivery Requested","Delivery Date","Delivery Req Date","Delivery Request ID",
  "Pickup Requested","Pickup Date","Pickup Req Date","Pickup Request ID",
  "EXF","ETA","IHD","CXL Date","Assign Date","Notes"
];

/** PO table column width tiers (see #poTable col-w-* in po-table.css). */
const COLUMN_WIDTH_TIER_MAX = {
  xs: 56,
  s: 84,
  m: 132,
  l: 240,
  flag: 58,
  select: 36,
  packing: 36,
};

const PO_COL_WIDTH_CLASSES = [
  "col-w-xs", "col-w-s", "col-w-m", "col-w-l",
  "col-w-flag", "col-w-select", "col-w-packing",
];

const COLUMN_WIDTH_TIER_XS = new Set([
  "PO Qty", "Actual Qty", "Ctn Qty", "Received Qty",
]);

const COLUMN_WIDTH_TIER_S = new Set([
  "Vendor",
  "PO Date", "Shipped", "ETD", "EST EXF", "EST IHD",
  "EXF Date", "EXF Req Date", "ASN Date", "ASN Req Date",
  "Delivery Date", "Delivery Req Date", "Pickup Date", "Pickup Req Date",
  "EXF", "ETA", "IHD", "CXL Date", "Assign Date",
  "PO #", "Old PO #", "SO #", "FOB Cost", "PO Total Cost",
  "N41 Status",
  "EXF Requested", "ASN Requested", "Delivery Requested", "Pickup Requested",
  "ASN Request ID", "Delivery Request ID", "Pickup Request ID",
]);

const COLUMN_WIDTH_TIER_M = new Set([
  "Status", "Division", "Buyer", "Buyer PO #", "Style #", "Color",
  "Style Category", "Vessel", "House #", "Ship Method", "EXF Memo",
]);

const COLUMN_WIDTH_TIER_L = new Set(["Notes"]);

const COLUMN_CUSTOM_WIDTHS = {
  Buyer: 160,
  Vendor: 84,
};

const COLUMN_LABELS = {
  "Actual Qty": "Act Qty",
  "Ctn Qty": "CTN",
  "Assign Date": "Assigned",
  "Style Category": "Category",
  "PO Total Cost": "PO Cost",
  "EXF Requested": "EXF Req",
  "EXF Date": "EXF Date",
  "EXF Req Date": "EXF Req Date",
  "EXF Memo": "EXF Memo",
  "ASN Requested": "ASN Req",
  "ASN Date": "ASN Date",
  "ASN Req Date": "ASN Req Date",
  "ASN Request ID": "ASN",
  "Delivery Requested": "Dlv Req",
  "Delivery Date": "Dlv Date",
  "Delivery Req Date": "Dlv Req Date",
  "Delivery Request ID": "Delivery",
  "Pickup Requested": "Pkp Req",
  "Pickup Date": "Pkp Date",
  "Pickup Req Date": "Pkp Req Date",
  "Pickup Request ID": "Pickup",
};

const UI_ONLY_COLS = new Set(["Selected", "Flag", "Packing List"]);
/** Session-local only — never read from or written to the sheet. */
const LOCAL_ONLY_COLS = new Set(["Selected", "Packing List"]);

const ALWAYS_VISIBLE_COLUMNS = new Set(["Selected", "Flag", "Packing List", "Status"]);

/** Merged table cells — always adjacent and move together in Edit Table. */
const MERGED_COLUMN_GROUP = ["Ship Method", "Shipment ID", "Packing List"];
const MERGED_GROUP_KEY = "__merged_shipment__";
const MERGED_GROUP_LABEL = "Ship Method / Shipment / Packing List";
const FIXED_LEADING_COLUMNS = ["Flag", "Selected", "Status"];
const NON_TOGGLEABLE_COLUMNS = new Set(["Selected", "Flag", "Packing List", "Status"]);

function getEditableColumnOptions() {
  return COLUMNS.filter(col => !ALWAYS_VISIBLE_COLUMNS.has(col) && !MERGED_COLUMN_GROUP.includes(col));
}

function ensureAlwaysVisibleColumns(cols) {
  ALWAYS_VISIBLE_COLUMNS.forEach(col => cols.add(col));
  return cols;
}

/** Ship Method + Shipment ID stay with the always-visible Packing List column group. */
function ensureMergedShipmentColumnsVisible(cols) {
  cols.add("Ship Method");
  cols.add("Shipment ID");
  return cols;
}

function getSelectableColumnsFromVisible(visible) {
  return new Set([...visible].filter(col => !ALWAYS_VISIBLE_COLUMNS.has(col)));
}

function buildVisibleColumnsFromDraft(draft) {
  return ensureMergedShipmentColumnsVisible(ensureAlwaysVisibleColumns(new Set(draft)));
}

function getColumnLabel(col) {
  return COLUMN_LABELS[col] ?? col;
}

/** Split exactly two-word labels onto two lines for compact column headers. */
function formatTwoLineHeaderLabel(text) {
  const trimmed = String(text ?? "").trim();
  if (trimmed.includes("#")) return trimmed;
  const parts = trimmed.split(/\s+/);
  if (parts.length === 2) return `${parts[0]}\n${parts[1]}`;
  return trimmed;
}

function applyTwoLineTableHeaders() {
  const table = document.getElementById("poTable");
  if (!table) return;

  table.querySelectorAll("thead th").forEach(th => {
    if (th.classList.contains("th-flag-col")
      || th.classList.contains("th-select-col")
      || th.classList.contains("th-shipment-id-col")
      || th.classList.contains("th-packing-list-col")) {
      return;
    }

    const label = th.querySelector(".th-label");
    if (label) {
      label.textContent = formatTwoLineHeaderLabel(label.textContent);
      return;
    }

    if (th.querySelector("input, svg, button")) return;
    const text = th.textContent.trim();
    if (text) th.textContent = formatTwoLineHeaderLabel(text);
  });
}

function getColumnWidthTier(col) {
  if (col === "Flag") return "flag";
  if (col === "Selected") return "select";
  if (col === "Packing List" || col === "Shipment ID") return "packing";
  if (COLUMN_WIDTH_TIER_L.has(col)) return "l";
  if (COLUMN_WIDTH_TIER_M.has(col)) return "m";
  if (COLUMN_WIDTH_TIER_XS.has(col)) return "xs";
  if (COLUMN_WIDTH_TIER_S.has(col)) return "s";
  return "s";
}

function getColumnWidthClass(col) {
  const tier = getColumnWidthTier(col);
  if (tier === "flag") return "col-w-flag";
  if (tier === "select") return "col-w-select";
  if (tier === "packing") return "col-w-packing";
  return `col-w-${tier}`;
}

function getColumnWidth(col) {
  if (COLUMN_CUSTOM_WIDTHS[col] != null) return COLUMN_CUSTOM_WIDTHS[col];
  return COLUMN_WIDTH_TIER_MAX[getColumnWidthTier(col)] ?? COLUMN_WIDTH_TIER_MAX.s;
}

function applyPoColumnWidthClass(el, col) {
  if (!el) return;
  const widthClass = getColumnWidthClass(col);
  PO_COL_WIDTH_CLASSES.forEach(c => el.classList.remove(c));
  el.classList.add(widthClass);
}

function syncPoColumnWidthClasses() {
  const table = document.getElementById("poTable");
  if (!table) return;
  getColumnOrder().forEach(col => {
    const colEl = table.querySelector(`colgroup col[data-col="${CSS.escape(col)}"]`);
    if (colEl) {
      const hidden = colEl.classList.contains("col-hidden");
      colEl.className = getColumnWidthClass(col) + (hidden ? " col-hidden" : "");
    }
    applyPoColumnWidthClass(table.querySelector(`thead th[data-col="${CSS.escape(col)}"]`), col);
    table.querySelectorAll(`tbody td[data-col="${CSS.escape(col)}"]`).forEach(td => {
      applyPoColumnWidthClass(td, col);
    });
  });
}

function normalizeColumnOrder(order) {
  const seen = new Set();
  const result = [];
  for (const col of order) {
    if (COLUMNS.includes(col) && !seen.has(col)) {
      seen.add(col);
      result.push(col);
    }
  }
  for (const col of COLUMNS) {
    if (!seen.has(col)) result.push(col);
  }
  return ensureFixedLeadingColumns(ensureMergedGroupTogether(result));
}

function ensureFixedLeadingColumns(order) {
  const rest = order.filter(col => !FIXED_LEADING_COLUMNS.includes(col));
  return [...FIXED_LEADING_COLUMNS, ...rest];
}

function ensureMergedGroupTogether(order) {
  const without = order.filter(col => !MERGED_COLUMN_GROUP.includes(col));
  const firstIdx = order.findIndex(col => MERGED_COLUMN_GROUP.includes(col));
  if (firstIdx === -1) {
    without.push(...MERGED_COLUMN_GROUP);
    return without;
  }
  const insertAt = order.slice(0, firstIdx).filter(col => !MERGED_COLUMN_GROUP.includes(col)).length;
  without.splice(insertAt, 0, ...MERGED_COLUMN_GROUP);
  return without;
}

/** @type {string[]} */
let columnOrder = [...COLUMNS];
/** @type {string[]} */
let columnOrderDraft = [...COLUMNS];
/** @type {string[]} */
const DEFAULT_COLUMN_ORDER = [...COLUMNS];

const COLUMN_LAYOUT_STORAGE_BASE = "columnLayout";
const PROGRAM_COLUMN_DEFAULT_STORAGE_BASE = "programColumnDefault";

function hasStoredColumnLayout() {
  try {
    return Boolean(localStorage.getItem(scopedStorageKey(COLUMN_LAYOUT_STORAGE_BASE)));
  } catch {
    return false;
  }
}

function saveColumnLayoutPreference() {
  try {
    localStorage.setItem(scopedStorageKey(COLUMN_LAYOUT_STORAGE_BASE), JSON.stringify({
      order: getColumnOrder(),
      visible: [...visibleColumns],
    }));
  } catch {
    /* ignore storage failures */
  }
}

function loadColumnLayoutPreference() {
  try {
    const raw = localStorage.getItem(scopedStorageKey(COLUMN_LAYOUT_STORAGE_BASE));
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return false;
    const order = Array.isArray(data.order) ? normalizeColumnOrder(data.order) : null;
    const visibleList = Array.isArray(data.visible) ? data.visible : null;
    if (!order || !visibleList || visibleList.length === 0) return false;
    columnOrder = order;
    visibleColumns = buildVisibleColumnsFromDraft(
      new Set(visibleList.filter(col => COLUMNS.includes(col)))
    );
    return true;
  } catch {
    return false;
  }
}

function getColumnOrder() {
  return columnOrder;
}

function indexTableColumns() {
  const table = document.getElementById("poTable");
  if (!table) return;
  const cols = table.querySelectorAll("colgroup col");
  COLUMNS.forEach((col, i) => cols[i]?.setAttribute("data-col", col));
  syncPoColumnWidthClasses();
}

function applyColumnOrder() {
  const table = document.getElementById("poTable");
  if (!table) return;

  const colgroup = table.querySelector("colgroup");
  const headerRow = table.querySelector("thead tr");
  if (!colgroup || !headerRow) return;

  getColumnOrder().forEach(col => {
    const colEl = table.querySelector(`colgroup col[data-col="${CSS.escape(col)}"]`);
    const thEl = table.querySelector(`thead th[data-col="${CSS.escape(col)}"]`);
    if (colEl) colgroup.appendChild(colEl);
    if (thEl) headerRow.appendChild(thEl);
  });

  table.querySelectorAll("tbody tr:not(.state-row)").forEach(tr => {
    getColumnOrder().forEach(col => {
      const td = tr.querySelector(`td[data-col="${CSS.escape(col)}"]`);
      if (td) tr.appendChild(td);
    });
  });
}

function getEditTableOrderKeys(order) {
  const keys = [];
  const seenMerged = new Set();
  for (const col of order) {
    if (FIXED_LEADING_COLUMNS.includes(col)) continue;
    if (MERGED_COLUMN_GROUP.includes(col)) {
      if (!seenMerged.has(MERGED_GROUP_KEY)) {
        seenMerged.add(MERGED_GROUP_KEY);
        keys.push(MERGED_GROUP_KEY);
      }
    } else {
      keys.push(col);
    }
  }
  return keys;
}

function keysToColumnOrder(keys) {
  return normalizeColumnOrder([...FIXED_LEADING_COLUMNS, ...expandEditTableKeys(keys)]);
}

function expandEditTableKeys(keys) {
  const cols = [];
  keys.forEach(key => {
    if (key === MERGED_GROUP_KEY) cols.push(...MERGED_COLUMN_GROUP);
    else cols.push(key);
  });
  return cols;
}

function moveEditTableKeyToHover(keys, fromIndex, hoverIndex) {
  if (fromIndex === hoverIndex || fromIndex < 0 || hoverIndex < 0) return keys;
  const next = [...keys];
  const [item] = next.splice(fromIndex, 1);
  next.splice(hoverIndex, 0, item);
  return next;
}

function isColumnShownInOrderList(col) {
  if (NON_TOGGLEABLE_COLUMNS.has(col)) return true;
  if (MERGED_COLUMN_GROUP.includes(col)) {
    if (col === "Packing List") return true;
    return columnVisibilityDraft.has(col);
  }
  return columnVisibilityDraft.has(col);
}

function isOrderKeyVisible(key) {
  if (key === MERGED_GROUP_KEY) {
    return MERGED_COLUMN_GROUP.some(col => isColumnShownInOrderList(col));
  }
  return isColumnShownInOrderList(key);
}

function getVisibleOrderKeys() {
  return getEditTableOrderKeys(columnOrderDraft).filter(isOrderKeyVisible);
}

function getEditTablePickerItems() {
  const mergedCols = new Set(MERGED_COLUMN_GROUP);
  const items = COLUMNS
    .filter(col => !mergedCols.has(col))
    .map(col => ({ key: col, label: getColumnLabel(col), type: "column" }));
  items.push({ key: MERGED_GROUP_KEY, label: MERGED_GROUP_LABEL, type: "merged" });
  items.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
  return items;
}

function isPickerItemChecked(key) {
  if (key === MERGED_GROUP_KEY) return isMergedGroupVisible(columnVisibilityDraft);
  if (NON_TOGGLEABLE_COLUMNS.has(key)) return true;
  return columnVisibilityDraft.has(key);
}

function isPickerItemDisabled(key) {
  return NON_TOGGLEABLE_COLUMNS.has(key);
}

function setPickerItemChecked(key, checked) {
  if (key === MERGED_GROUP_KEY) {
    setMergedGroupVisible(columnVisibilityDraft, checked);
    if (checked) ensureOrderKeyPresent(MERGED_GROUP_KEY);
    renderEditTableOrder();
    return;
  }
  if (isPickerItemDisabled(key)) return;
  if (checked) {
    columnVisibilityDraft.add(key);
    ensureOrderKeyPresent(key);
  } else {
    columnVisibilityDraft.delete(key);
    removeOrderKey(key);
  }
  renderEditTableOrder();
}

function ensureOrderKeyPresent(key) {
  const keys = getEditTableOrderKeys(columnOrderDraft);
  if (keys.includes(key)) return;
  columnOrderDraft = keysToColumnOrder([...keys, key]);
}

function removeOrderKey(key) {
  const keys = getEditTableOrderKeys(columnOrderDraft).filter(k => k !== key);
  columnOrderDraft = keysToColumnOrder(keys);
}

function syncOrderDraftWithVisibility() {
  const visibleKeys = new Set();
  getEditTablePickerItems().forEach(item => {
    if (isPickerItemChecked(item.key)) visibleKeys.add(item.key);
  });
  visibleKeys.add(MERGED_GROUP_KEY);

  const keys = getEditTableOrderKeys(columnOrderDraft).filter(k => visibleKeys.has(k));
  for (const item of getEditTablePickerItems()) {
    if (visibleKeys.has(item.key) && !keys.includes(item.key)) keys.push(item.key);
  }
  columnOrderDraft = keysToColumnOrder(keys);
}

function isMergedGroupVisible(draft) {
  return draft.has("Ship Method") || draft.has("Shipment ID");
}

function getOrderKeyLabel(key) {
  if (key === MERGED_GROUP_KEY) return MERGED_GROUP_LABEL;
  return getColumnLabel(key);
}

function setMergedGroupVisible(draft, visible) {
  if (visible) {
    draft.add("Ship Method");
    draft.add("Shipment ID");
  } else {
    draft.delete("Ship Method");
    draft.delete("Shipment ID");
  }
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
  if ("Ship Method" in out) out["Ship Method"] = normalizeShipMethod(out["Ship Method"]);
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
  const ordered = DEFAULT_COLUMN_ORDER.filter(col => DEFAULT_VISIBLE_COLUMNS.includes(col));
  return ensureMergedShipmentColumnsVisible(
    ensureAlwaysVisibleColumns(new Set(ordered.length > 0 ? ordered : COLUMNS))
  );
}

function setProgramDefaultLayout(order, visibleDraft) {
  const withFixed = buildVisibleColumnsFromDraft(visibleDraft);
  const normalizedOrder = normalizeColumnOrder(order);
  const visibleOrdered = normalizedOrder.filter(col => withFixed.has(col));
  if (visibleOrdered.length === 0) return false;

  DEFAULT_COLUMN_ORDER.splice(0, DEFAULT_COLUMN_ORDER.length, ...normalizedOrder);
  DEFAULT_VISIBLE_COLUMNS.splice(0, DEFAULT_VISIBLE_COLUMNS.length, ...visibleOrdered);
  return true;
}

function saveProgramColumnDefaultToStorage() {
  try {
    localStorage.setItem(
      scopedStorageKey(PROGRAM_COLUMN_DEFAULT_STORAGE_BASE),
      JSON.stringify({
        order: [...DEFAULT_COLUMN_ORDER],
        visible: [...DEFAULT_VISIBLE_COLUMNS],
        statusFilter: defaultStatusFilter,
      })
    );
  } catch {
    /* ignore storage failures */
  }
}

function loadProgramColumnDefaultFromStorage() {
  try {
    const raw = localStorage.getItem(scopedStorageKey(PROGRAM_COLUMN_DEFAULT_STORAGE_BASE));
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return false;
    const order = Array.isArray(data.order) ? normalizeColumnOrder(data.order) : null;
    const visibleList = Array.isArray(data.visible) ? data.visible : null;
    if (!order || !visibleList || visibleList.length === 0) return false;
    const ok = setProgramDefaultLayout(order, new Set(visibleList));
    if (ok && data.statusFilter !== undefined) {
      setProgramDefaultStatusFilter(data.statusFilter);
    }
    return ok;
  } catch {
    return false;
  }
}

function loadColumnVisibility() {
  loadProgramColumnDefaultFromStorage();
  if (loadColumnLayoutPreference()) return;
  columnOrder = normalizeColumnOrder([...DEFAULT_COLUMN_ORDER]);
  visibleColumns = getDefaultVisibleColumnsSet();
}

function applyDefaultColumnsFromServer(data) {
  if (!data) return false;

  if (Array.isArray(data)) {
    if (data.length === 0) return false;
    const cols = ensureAlwaysVisibleColumns(new Set(data.filter(col => COLUMNS.includes(col))));
    if (cols.size === 0) return false;
    const orderedVisible = data.filter(col => COLUMNS.includes(col));
    const order = normalizeColumnOrder([...orderedVisible, ...COLUMNS]);
    setProgramDefaultLayout(order, cols);
  } else if (typeof data === "object") {
    const order = Array.isArray(data.order) ? normalizeColumnOrder(data.order) : [...COLUMNS];
    const visibleList = Array.isArray(data.visible) ? data.visible : order;
    const cols = ensureAlwaysVisibleColumns(new Set(visibleList.filter(col => COLUMNS.includes(col))));
    if (cols.size === 0) return false;
    setProgramDefaultLayout(order, cols);
  } else {
    return false;
  }

  if (!hasStoredColumnLayout()) {
    columnOrder = normalizeColumnOrder([...DEFAULT_COLUMN_ORDER]);
    visibleColumns = getDefaultVisibleColumnsSet();
    applyColumnOrder();
    applyColumnVisibility();
  }
  return true;
}

async function saveDefaultColumnVisibility() {
  if (!setProgramDefaultLayout(columnOrderDraft, columnVisibilityDraft)) return;

  columnOrder = normalizeColumnOrder([...DEFAULT_COLUMN_ORDER]);
  visibleColumns = getDefaultVisibleColumnsSet();
  applyColumnOrder();
  applyColumnVisibility();
  saveColumnLayoutPreference();
  setProgramDefaultStatusFilter(resolveStatusFilterForProgramDefault());
  saveProgramColumnDefaultToStorage();

  if (isDemoMode()) {
    setEditTableFooterMessage("Default view saved", "success");
    return;
  }

  try {
    setEditTableFooterMessage(`Saving default${ELLIPSIS}`, "");
    const res = await fetch(getAppsScriptUrl(), {
      method: "POST",
      body: JSON.stringify({
        action: "saveColumnDefault",
        columns: [...DEFAULT_VISIBLE_COLUMNS],
        columnOrder: [...DEFAULT_COLUMN_ORDER],
        statusFilter: defaultStatusFilter,
      }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    setEditTableFooterMessage("Default view saved", "success");
  } catch (err) {
    setEditTableFooterMessage("Save default failed: " + err.message, "error");
  }
}

function resetEditTableToDefault() {
  columnVisibilityDraft = getSelectableColumnsFromVisible(getDefaultVisibleColumnsSet());
  columnOrderDraft = normalizeColumnOrder([...DEFAULT_COLUMN_ORDER]);
  syncOrderDraftWithVisibility();
  renderEditTableList();
  setEditTableFooterMessage("Reset to default", "success");
}

function setEditTableFooterMessage(msg, type = "") {
  const overlay = document.getElementById("settingsOverlay");
  if (!overlay) return;
  if (!msg) {
    clearModalFooterMessageForOverlay(overlay);
    return;
  }
  setModalFooterMessage(msg, type, { overlay });
}

function clearEditTableFooterMessage() {
  clearModalFooterMessageForOverlay("settingsOverlay");
}

function applyColumnVisibility() {
  const table = document.getElementById("poTable");
  if (!table) return;

  let minWidth = 0;
  let leadingSet = false;
  getColumnOrder().forEach(col => {
    const hidden = !visibleColumns.has(col);
    if (!hidden) minWidth += getColumnWidth(col);
    const isLeading = !hidden && !leadingSet;
    if (isLeading) leadingSet = true;

    table.querySelector(`colgroup col[data-col="${CSS.escape(col)}"]`)?.classList.toggle("col-hidden", hidden);
    const thEl = table.querySelector(`thead th[data-col="${CSS.escape(col)}"]`);
    thEl?.classList.toggle("col-hidden", hidden);
    thEl?.classList.toggle("col-leading", isLeading);
    table.querySelectorAll(`tbody tr:not(.state-row) td[data-col="${CSS.escape(col)}"]`).forEach(td => {
      td.classList.toggle("col-hidden", hidden);
      td.classList.toggle("col-leading", isLeading);
    });
  });

  table.style.minWidth = `${Math.max(minWidth, 400)}px`;
  syncPoColumnWidthClasses();
}

let editTableDragFromIndex = null;

function clearEditTableDragIndicators() {
  document.querySelectorAll(".edit-table-order-item.drag-insert-before, .edit-table-order-item.drag-insert-after").forEach(el => {
    el.classList.remove("drag-insert-before", "drag-insert-after");
  });
}

function updateEditTableDragIndicator(item, fromIndex) {
  clearEditTableDragIndicators();
  if (fromIndex === null || !item) return;
  const hoverIndex = getEditTableOrderItemIndex(item);
  if (hoverIndex === -1 || hoverIndex === fromIndex) return;
  item.classList.add(fromIndex > hoverIndex ? "drag-insert-before" : "drag-insert-after");
}

function renderEditTablePicker() {
  const list = document.getElementById("editTableColumnPicker");
  if (!list) return;

  list.innerHTML = "";
  getEditTablePickerItems().forEach(item => {
    const label = document.createElement("label");
    label.className = "edit-table-picker-option";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = isPickerItemChecked(item.key);
    cb.disabled = isPickerItemDisabled(item.key);
    cb.addEventListener("change", () => {
      setPickerItemChecked(item.key, cb.checked);
    });

    const span = document.createElement("span");
    span.textContent = item.label;

    label.appendChild(cb);
    label.appendChild(span);
    list.appendChild(label);
  });
}

function createEditTableOrderItem(key, { fixed = false } = {}) {
  const item = document.createElement("div");
  item.className = "edit-table-order-item";
  item.dataset.key = key;
  if (fixed) item.classList.add("edit-table-order-item-fixed");
  if (key === MERGED_GROUP_KEY) item.classList.add("edit-table-order-item-merged");

  if (fixed) {
    const spacer = document.createElement("span");
    spacer.className = "edit-table-order-spacer";
    spacer.setAttribute("aria-hidden", "true");
    item.appendChild(spacer);
  } else {
    const handle = document.createElement("span");
    handle.className = "edit-table-drag-handle";
    handle.textContent = "⋮⋮";
    handle.setAttribute("aria-hidden", "true");
    item.appendChild(handle);
    item.draggable = true;

    item.addEventListener("dragstart", e => {
      editTableDragFromIndex = getEditTableOrderItemIndex(item);
      item.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", key);
    });

    item.addEventListener("dragend", () => {
      editTableDragFromIndex = null;
      item.classList.remove("dragging");
      clearEditTableDragIndicators();
    });

    item.addEventListener("dragover", e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      updateEditTableDragIndicator(item, editTableDragFromIndex);
    });

    item.addEventListener("dragleave", e => {
      if (item.contains(e.relatedTarget)) return;
      item.classList.remove("drag-insert-before", "drag-insert-after");
    });

    item.addEventListener("drop", e => {
      e.preventDefault();
      clearEditTableDragIndicators();
      const fromIndex = editTableDragFromIndex;
      const hoverIndex = getEditTableOrderItemIndex(item);
      if (fromIndex === null || hoverIndex === -1 || fromIndex === hoverIndex) return;
      const keys = getVisibleOrderKeys();
      columnOrderDraft = keysToColumnOrder(moveEditTableKeyToHover(keys, fromIndex, hoverIndex));
      renderEditTableOrder();
    });
  }

  const span = document.createElement("span");
  span.className = "edit-table-order-item-label";
  span.textContent = getOrderKeyLabel(key);
  item.appendChild(span);

  return item;
}

function getEditTableOrderItemIndex(item) {
  const list = document.getElementById("editTableColumnOrder");
  if (!list || !item) return -1;
  return [...list.querySelectorAll(".edit-table-order-item")].indexOf(item);
}

function renderEditTableOrder() {
  const list = document.getElementById("editTableColumnOrder");
  if (!list) return;

  list.innerHTML = "";
  getVisibleOrderKeys().forEach(key => {
    list.appendChild(createEditTableOrderItem(key));
  });
}

function renderEditTableList() {
  renderEditTablePicker();
  renderEditTableOrder();
}

function prepareEditTableDraft() {
  columnVisibilityDraft = getSelectableColumnsFromVisible(visibleColumns);
  columnOrderDraft = normalizeColumnOrder([...columnOrder]);
  syncOrderDraftWithVisibility();
  clearEditTableFooterMessage();
  renderEditTableList();
}

function openEditTablePopover() {
  if (typeof openSettingsModal === "function") openSettingsModal("edit-table");
  else prepareEditTableDraft();
}

function closeEditTablePopover() {
  clearEditTableFooterMessage();
}

function setEditTableDraftSelectAll(selectAll) {
  columnVisibilityDraft = selectAll ? new Set(getEditableColumnOptions()) : new Set();
  if (selectAll) setMergedGroupVisible(columnVisibilityDraft, true);
  syncOrderDraftWithVisibility();
  renderEditTableList();
}

function applyEditTableFromPopover() {
  columnOrder = normalizeColumnOrder([...columnOrderDraft]);
  visibleColumns = buildVisibleColumnsFromDraft(columnVisibilityDraft);
  applyColumnOrder();
  applyColumnVisibility();
  saveColumnLayoutPreference();
  if (typeof updateColumnFilterHeaderStates === "function") updateColumnFilterHeaderStates();
  clearEditTableFooterMessage();
}

function initEditTable() {
  indexTableColumns();

  document.getElementById("editTableSelectAll")?.addEventListener("click", () => setEditTableDraftSelectAll(true));
  document.getElementById("editTableClearAll")?.addEventListener("click", () => setEditTableDraftSelectAll(false));
  document.getElementById("editTableSaveDefault")?.addEventListener("click", saveDefaultColumnVisibility);
  document.getElementById("editTableResetDefault")?.addEventListener("click", resetEditTableToDefault);
  document.getElementById("editTableOk")?.addEventListener("click", applyEditTableFromPopover);
  document.getElementById("editTableCancel")?.addEventListener("click", prepareEditTableDraft);
}
