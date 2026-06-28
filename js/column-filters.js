function normalizeFilterValue(val) {
  const s = String(val ?? "").trim();
  return s === "" ? BLANK_FILTER_LABEL : s;
}

function isOpenRow(row) {
  const status = getRowWorkflowStatus(row);
  if (status) return OPEN_STATUSES.has(status);
  return isN41OpenRow(row);
}

function getColumnFilterRawValue(col, row) {
  if (col === "EST IHD") return calculateEstIhd(row["Ship Method"], row["EST EXF"]);
  if (col === "EXF Date") {
    return row["EXF Date"] ?? row["EXF Request Date"] ?? "";
  }
  if (col === "Actual Qty") {
    const qty = getPackingActualQtyForRow(row);
    return qty > 0 ? qty : "";
  }
  if (col === "Ctn Qty") {
    const qty = getPackingCtnQtyForRow(row);
    return qty > 0 ? qty : "";
  }
  if (col === "PO Qty") {
    const total = toQtyNumber(row["PO Qty"]);
    if (total > 0) return total;
    if (typeof computePoQtyFromUnits === "function") {
      const fromUnits = computePoQtyFromUnits(row);
      if (fromUnits > 0) return fromUnits;
    }
    return row[col];
  }
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

function getBuyerFilterValues() {
  if (activeDivision && DIVISION_BUYERS[activeDivision]) {
    return [...DIVISION_BUYERS[activeDivision]];
  }
  return [
    ...DIVISION_BUYERS["Elevator Disco"],
    ...DIVISION_BUYERS["Freesia"],
  ];
}

function pruneBuyerColumnFilter() {
  const allowed = new Set(getBuyerFilterValues());
  const selected = columnFilters["Buyer"];
  if (selected == null) return;

  const next = new Set([...selected].filter(value => allowed.has(value)));
  if (next.size === selected.size) return;

  if (next.size === 0) {
    columnFilters["Buyer"] = new Set();
  } else if (next.size === allowed.size) {
    columnFilters["Buyer"] = null;
  } else {
    columnFilters["Buyer"] = next;
  }
  updateColumnFilterHeaderStates();
}

function getUniqueColumnValues(col) {
  if (col === "Status") {
    return getStatusFilterHeaderValues();
  }

  if (col === "Buyer") {
    return getBuyerFilterValues();
  }

  const values = new Set();
  const sourceRows = DATE_FILTER_COLS.has(col)
    ? allRows.filter(isOpenRow)
    : allRows;
  sourceRows.forEach(row => values.add(getFilterValueKey(col, row)));
  return [...values].sort((a, b) => compareFilterValues(a, b, col));
}

function isColumnFilterActive(col) {
  if (DATE_FILTER_COLS.has(col)) return dateColumnRangeFilters[col] != null;
  return columnFilters[col] != null;
}

function hasActiveColumnFilters() {
  return flagFilterActive ||
    isStatusHeaderFilterActive() ||
    COLUMN_FILTER_COLS.some(col => isColumnFilterActive(col));
}

function updateClearAllFiltersButton() {
  const btn = document.getElementById("clearAllColumnFiltersBtn");
  if (btn) btn.hidden = !hasActiveColumnFilters();
}

function clearAllColumnFilters() {
  flagFilterActive = false;
  activeStatus = STATUS_FILTER_OPEN;
  statusFilterSelection = new Set([STATUS_FILTER_OPEN]);
  COLUMN_FILTER_COLS.forEach(col => { columnFilters[col] = null; });
  DATE_FILTER_COLS.forEach(col => { dateColumnRangeFilters[col] = null; });
  closeColumnFilterPopover();
  syncStatusFilterToolbar();
  updateColumnFilterHeaderStates();
  updateFlagFilterHeaderState();
  applyFilters();
}

function rowPassesDateColumnRange(col, row) {
  const range = dateColumnRangeFilters[col];
  if (!range) return true;
  const key = getFilterValueKey(col, row);
  if (key === BLANK_FILTER_LABEL) return false;
  const from = range.from || range.to;
  const to = range.to || range.from;
  if (!from || !to) return true;
  return key >= from && key <= to;
}

function rowPassesColumnFilters(row) {
  for (const col of COLUMN_FILTER_COLS) {
    if (DATE_FILTER_COLS.has(col)) {
      if (!rowPassesDateColumnRange(col, row)) return false;
      continue;
    }
    const selected = columnFilters[col];
    if (selected == null) continue;
    if (selected.size === 0) return false;
    if (!selected.has(getFilterValueKey(col, row))) return false;
  }
  return true;
}

function getEffectiveFilterSelection(col) {
  if (col === "Status") {
    return getEffectiveStatusFilterSelection();
  }
  const selected = columnFilters[col];
  if (selected == null) return new Set(getUniqueColumnValues(col));
  return new Set(selected);
}

function updateColumnFilterHeaderStates() {
  document.querySelectorAll("th.th-filterable").forEach(th => {
    const col = th.dataset.col;
    if (col === "Status") {
      th.classList.toggle("filter-active", isStatusHeaderFilterActive());
    } else {
      th.classList.toggle("filter-active", isColumnFilterActive(col));
    }
  });
}

function createColumnFilterOption(value, col) {
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
  span.textContent = col === "Status"
    ? getStatusFilterHeaderLabel(value)
    : getFilterValueLabel(col, value);

  label.appendChild(cb);
  label.appendChild(span);
  return label;
}

function renderGroupedBuyerFilterList(list) {
  DIVISIONS.forEach((division, index) => {
    if (index > 0) {
      const divider = document.createElement("div");
      divider.className = "column-filter-group-divider";
      divider.setAttribute("aria-hidden", "true");
      list.appendChild(divider);
    }

    const heading = document.createElement("div");
    heading.className = "column-filter-group-heading";
    heading.textContent = division;
    list.appendChild(heading);

    DIVISION_BUYERS[division].forEach(value => {
      list.appendChild(createColumnFilterOption(value, "Buyer"));
    });
  });
}

function renderStatusFilterHeaderList(list) {
  const appendDivider = () => {
    const divider = document.createElement("div");
    divider.className = "column-filter-group-divider";
    divider.setAttribute("aria-hidden", "true");
    list.appendChild(divider);
  };

  STATUS_FILTER_PRIMARY_GROUPS.forEach(item => {
    list.appendChild(createColumnFilterOption(item.value, "Status"));
  });
  appendDivider();
  STATUS_FILTER_SECONDARY_GROUPS.forEach(item => {
    list.appendChild(createColumnFilterOption(item.value, "Status"));
  });

  const groupValues = new Set(STATUS_FILTER_HEADER_GROUPS.map(item => item.value));
  const remaining = STATUS_SORT_ORDER.filter(status => !groupValues.has(status));
  if (remaining.length > 0) {
    appendDivider();
    remaining.forEach(value => {
      list.appendChild(createColumnFilterOption(value, "Status"));
    });
  }
}

/**
 * Build a scroll-snap wheel for date options.
 * @param {string[]} options - sorted YMD keys
 * @param {string|null} selectedKey
 * @param {function(string):void} onSelect - called with the newly centred key
 * @returns {{ wrap: HTMLElement, scrollToKey: function(string|null):void }}
 */
function buildDateWheel(options, selectedKey, onSelect) {
  const wrap = document.createElement("div");
  wrap.className = "date-wheel-wrap";

  const centerLine = document.createElement("div");
  centerLine.className = "date-wheel-center-line";
  wrap.appendChild(centerLine);

  const wheel = document.createElement("div");
  wheel.className = "date-wheel";
  wrap.appendChild(wheel);

  const ITEM_H = 36;

  // Padding sentinels so first/last items can scroll to centre
  const topPad = document.createElement("div");
  topPad.style.height = "48px";
  topPad.style.flexShrink = "0";
  wheel.appendChild(topPad);

  options.forEach(key => {
    const item = document.createElement("div");
    item.className = "date-wheel-item";
    if (key === selectedKey) item.classList.add("is-selected");
    item.dataset.key = key;
    item.textContent = formatDateForDisplay(key);
    wheel.appendChild(item);
  });

  const bottomPad = document.createElement("div");
  bottomPad.style.height = "48px";
  bottomPad.style.flexShrink = "0";
  wheel.appendChild(bottomPad);

  function getItems() {
    return [...wheel.querySelectorAll(".date-wheel-item")];
  }

  function markSelected(key) {
    getItems().forEach(el => el.classList.toggle("is-selected", el.dataset.key === key));
  }

  function scrollToKey(key) {
    if (!key) return;
    const items = getItems();
    const idx = items.findIndex(el => el.dataset.key === key);
    if (idx === -1) return;
    const centerOffset = 48 + idx * ITEM_H + ITEM_H / 2 - wheel.clientHeight / 2;
    wheel.scrollTo({ top: Math.max(0, centerOffset), behavior: "instant" });
  }

  // Scroll-snap settle detection
  let scrollTimer = null;
  function onScrollSettle() {
    const wheelTop = wheel.getBoundingClientRect().top;
    const centerY = wheelTop + wheel.clientHeight / 2;
    const items = getItems();
    let closest = null;
    let closestDist = Infinity;
    items.forEach(el => {
      const r = el.getBoundingClientRect();
      const itemCenterY = r.top + r.height / 2;
      const dist = Math.abs(itemCenterY - centerY);
      if (dist < closestDist) { closestDist = dist; closest = el; }
    });
    if (closest) {
      markSelected(closest.dataset.key);
      onSelect(closest.dataset.key);
    }
  }

  wheel.addEventListener("scrollend", onScrollSettle);
  // Fallback debounce for browsers without scrollend
  wheel.addEventListener("scroll", () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(onScrollSettle, 120);
  }, { passive: true });

  function scrollItemToCenter(item, behavior = "smooth") {
    const items = getItems();
    const idx = items.indexOf(item);
    if (idx === -1) return;
    const centerOffset = 48 + idx * ITEM_H + ITEM_H / 2 - wheel.clientHeight / 2;
    wheel.scrollTo({ top: Math.max(0, centerOffset), behavior });
  }

  function selectItem(item, behavior = "smooth") {
    if (!item) return;
    const key = item.dataset.key;
    markSelected(key);
    onSelect(key);
    scrollItemToCenter(item, behavior);
  }

  function navigateAdjacent(delta) {
    const items = getItems();
    if (!items.length) return;
    const currentIdx = items.findIndex(el => el.classList.contains("is-selected"));
    const nextIdx = Math.max(0, Math.min(items.length - 1, (currentIdx === -1 ? 0 : currentIdx) + delta));
    selectItem(items[nextIdx]);
  }

  // Click to select
  wheel.addEventListener("click", e => {
    wheel.focus();
    const item = e.target.closest(".date-wheel-item");
    if (!item) return;
    selectItem(item);
  });

  wheel.tabIndex = -1;
  wheel.setAttribute("role", "listbox");
  wheel.addEventListener("keydown", e => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      navigateAdjacent(-1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      navigateAdjacent(1);
    }
  });

  // Scroll selected item into centre after DOM is painted
  requestAnimationFrame(() => scrollToKey(selectedKey || options[0]));

  return { wrap, scrollToKey, markSelected, navigateAdjacent, wheel };
}

function createDateRangeInput(initialYmd, onCommit, { tabIndex, onNavigateWheel } = {}) {
  return createCompactDateInput({
    initialYmd,
    onCommit,
    inputClassName: "date-range-field",
    tabIndex,
    onNavigateWheel,
    onKeydown: (e, field) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      field.blur();
      if (tabIndex === 1) {
        field.closest(".date-range-filter")?.querySelector('input.date-range-field[tabindex="2"]')?.focus();
      } else if (tabIndex === 2) {
        document.getElementById("columnFilterOk")?.focus();
      }
    },
  });
}

function validateDateRangeToBeforeFrom(fromField, toField) {
  const fromYmd = readCompactDateInputValue(fromField) || null;
  const toYmd = readCompactDateInputValue(toField) || null;
  const invalid = Boolean(fromYmd && toYmd && toYmd < fromYmd);
  toField.classList.toggle("is-invalid", invalid);
  return !invalid;
}

function renderDateRangeFilter(list, col) {
  list.style.cssText = "border:none;padding:0;max-height:none;overflow:visible;margin-bottom:0;";

  const allDates = getUniqueColumnValues(col).filter(k => k !== BLANK_FILTER_LABEL);

  const container = document.createElement("div");
  container.className = "date-range-filter";
  list.appendChild(container);

  // -- From column --
  const fromCol = document.createElement("div");
  fromCol.className = "date-range-col";

  const fromLabel = document.createElement("div");
  fromLabel.className = "date-range-label";
  fromLabel.textContent = "From";
  fromCol.appendChild(fromLabel);

  const toCol = document.createElement("div");
  toCol.className = "date-range-col";

  const toLabel = document.createElement("div");
  toLabel.className = "date-range-label";
  toLabel.textContent = "To";
  toCol.appendChild(toLabel);

  let fromField;
  let toField;

  // Build wheels with forward refs so From can refresh To
  let toWheelHandle = null;

  function refreshToWheel() {
    const toOptions = allDates.filter(k => !dateRangeDraft.from || k >= dateRangeDraft.from);
    const oldWrap = toCol.querySelector(".date-wheel-wrap");
    if (oldWrap) oldWrap.remove();
    const toSnap = dateRangeDraft.to && toOptions.includes(dateRangeDraft.to)
      ? dateRangeDraft.to
      : toOptions[0];
    const newHandle = buildDateWheel(toOptions, toSnap, key => {
      dateRangeDraft.to = key;
      toField.value = formatDateForDisplay(key);
      updateCompactDateInputState(toField);
      toField.classList.remove("is-invalid");
    });
    toWheelHandle = newHandle;
    toCol.appendChild(newHandle.wrap);
  }

  let fromWheelHandle = null;

  const fromDateInput = createDateRangeInput(dateRangeDraft.from, ymd => {
    dateRangeDraft.from = ymd;
    if (ymd) {
      dateRangeDraft.to = ymd;
      toField.value = formatDateForDisplay(ymd);
      updateCompactDateInputState(toField);
      toField.classList.remove("is-invalid");
    }
    refreshToWheel();
    validateDateRangeToBeforeFrom(fromField, toField);
  }, {
    tabIndex: 1,
    onNavigateWheel: delta => fromWheelHandle?.navigateAdjacent(delta),
  });
  fromField = fromDateInput.input;
  fromCol.appendChild(fromDateInput.wrap);

  const toDateInput = createDateRangeInput(dateRangeDraft.to, ymd => {
    dateRangeDraft.to = ymd;
    validateDateRangeToBeforeFrom(fromField, toField);
  }, {
    tabIndex: 2,
    onNavigateWheel: delta => toWheelHandle?.navigateAdjacent(delta),
  });
  toField = toDateInput.input;
  toCol.appendChild(toDateInput.wrap);

  // From wheel (all dates)
  fromWheelHandle = buildDateWheel(allDates, dateRangeDraft.from, key => {
    dateRangeDraft.from = key;
    dateRangeDraft.to = key;
    fromField.value = formatDateForDisplay(key);
    updateCompactDateInputState(fromField);
    fromField.classList.remove("is-invalid");
    toField.value = formatDateForDisplay(key);
    updateCompactDateInputState(toField);
    toField.classList.remove("is-invalid");
    refreshToWheel();
  });
  fromCol.appendChild(fromWheelHandle.wrap);
  container.appendChild(fromCol);

  // To wheel (dates >= from)
  const toOptions = allDates.filter(k => !dateRangeDraft.from || k >= dateRangeDraft.from);
  const toHandle = buildDateWheel(toOptions, dateRangeDraft.to, key => {
    dateRangeDraft.to = key;
    toField.value = formatDateForDisplay(key);
    updateCompactDateInputState(toField);
    toField.classList.remove("is-invalid");
  });
  toWheelHandle = toHandle;
  toCol.appendChild(toHandle.wrap);
  container.appendChild(toCol);
}

function renderColumnFilterList() {
  const list = document.getElementById("columnFilterList");
  if (!list || !openFilterCol) return;

  list.innerHTML = "";
  list.style.cssText = "";

  if (DATE_FILTER_COLS.has(openFilterCol)) {
    renderDateRangeFilter(list, openFilterCol);
    return;
  }

  if (openFilterCol === "Status") {
    renderStatusFilterHeaderList(list);
    return;
  }

  if (openFilterCol === "Buyer" && !activeDivision) {
    renderGroupedBuyerFilterList(list);
    return;
  }

  getUniqueColumnValues(openFilterCol).forEach(value => {
    list.appendChild(createColumnFilterOption(value, openFilterCol));
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

function syncDateRangeDraftFromPopoverFields() {
  const list = document.getElementById("columnFilterList");
  if (!list) return true;
  const inputs = list.querySelectorAll("input.date-range-field");
  if (inputs.length < 2) return true;

  const fromField = inputs[0];
  const toField = inputs[1];
  const fromYmd = readCompactDateInputValue(fromField) || null;
  const toYmd = readCompactDateInputValue(toField) || null;

  fromField.classList.toggle("is-invalid", Boolean(fromField.value.trim()) && !fromYmd);
  toField.classList.toggle("is-invalid", Boolean(toField.value.trim()) && !toYmd);
  if (fromYmd) fromField.value = formatDateForDisplay(fromYmd);
  if (toYmd) toField.value = formatDateForDisplay(toYmd);
  dateRangeDraft = { from: fromYmd, to: toYmd };
  return validateDateRangeToBeforeFrom(fromField, toField);
}

function seedDateRangeDraftFromFilter(col) {
  const range = dateColumnRangeFilters[col];
  if (range) {
    dateRangeDraft = { from: range.from, to: range.to };
    return;
  }
  dateRangeDraft = { from: null, to: null };
}

function setDateFilterPopoverTabOrder(active) {
  const okBtn = document.getElementById("columnFilterOk");
  const cancelBtn = document.getElementById("columnFilterCancel");
  const clearBtn = document.getElementById("columnFilterClearAll");
  if (okBtn) okBtn.tabIndex = active ? 3 : 0;
  if (cancelBtn) cancelBtn.tabIndex = active ? -1 : 0;
  if (clearBtn) clearBtn.tabIndex = active ? -1 : 0;
}

function openColumnFilterPopover(col, anchorTh) {
  const pop = document.getElementById("columnFilterPopover");
  if (!pop) return;

  openFilterCol = col;
  const isDate = DATE_FILTER_COLS.has(col);

  if (isDate) {
    seedDateRangeDraftFromFilter(col);
  } else {
    filterDraft = getEffectiveFilterSelection(col);
  }
  const selectAllBtn = document.getElementById("columnFilterSelectAll");
  const sep = document.getElementById("columnFilterSelectSep");
  if (selectAllBtn) selectAllBtn.hidden = isDate;
  if (sep) sep.hidden = isDate;

  setDateFilterPopoverTabOrder(isDate);
  pop.hidden = false;
  pop.style.minWidth = isDate ? "260px" : "";
  renderColumnFilterList();
  requestAnimationFrame(() => {
    positionColumnFilterPopover(anchorTh);
    if (isDate) {
      pop.querySelector('input.date-range-field[tabindex="1"]')?.focus();
    }
  });
}

function closeColumnFilterPopover() {
  const pop = document.getElementById("columnFilterPopover");
  if (pop) pop.hidden = true;
  setDateFilterPopoverTabOrder(false);
  openFilterCol = null;
}

function setFilterDraftSelectAll(selectAll) {
  if (!openFilterCol) return;
  const values = getUniqueColumnValues(openFilterCol);
  filterDraft = selectAll ? new Set(values) : new Set();
  renderColumnFilterList();
}

function clearDateRangeFilter() {
  if (!openFilterCol || !DATE_FILTER_COLS.has(openFilterCol)) return;
  dateRangeDraft = { from: null, to: null };
  renderColumnFilterList();
}

function applyColumnFilterFromPopover() {
  if (!openFilterCol) return;

  const col = openFilterCol;
  if (col === "Status") {
    applyStatusFilterFromPopover(filterDraft);
    closeColumnFilterPopover();
    updateColumnFilterHeaderStates();
    return;
  }

  if (DATE_FILTER_COLS.has(col)) {
    if (!syncDateRangeDraftFromPopoverFields()) return;
    const { from, to } = dateRangeDraft;
    if (!from && !to) {
      dateColumnRangeFilters[col] = null;
      columnFilters[col] = null;
    } else {
      dateColumnRangeFilters[col] = {
        from: from || to,
        to: to || from,
      };
      columnFilters[col] = null;
    }
    closeColumnFilterPopover();
    updateColumnFilterHeaderStates();
    applyFilters();
    return;
  }

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
    if (col !== "Status" && !COLUMN_FILTER_COLS.includes(col)) return;

    if (!th.querySelector(".th-filter-hit")) {
      const hit = document.createElement("span");
      hit.className = "th-filter-hit";
      hit.setAttribute("aria-hidden", "true");
      th.appendChild(hit);
    }

    const label = th.querySelector(".th-label");
    if (label) {
      label.addEventListener("click", e => {
        e.stopPropagation();
        sortBy(col);
      });
    }

    th.addEventListener("click", e => {
      if (e.target.closest(".th-label")) return;
      openColumnFilterPopover(col, th);
    });
  });

  document.getElementById("columnFilterSelectAll")?.addEventListener("click", () => setFilterDraftSelectAll(true));
  document.getElementById("columnFilterClearAll")?.addEventListener("click", () => {
    if (openFilterCol && DATE_FILTER_COLS.has(openFilterCol)) {
      clearDateRangeFilter();
    } else {
      setFilterDraftSelectAll(false);
    }
  });
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
  "Pending":"badge-pending","WIP":"badge-wip","Requested":"badge-requested",
  "OTW":"badge-otw","Scheduled":"badge-scheduled",
  "In Warehouse":"badge-wh","Assigned":"badge-assigned","Hold":"badge-hold",
  "CXL":"badge-cancelled","Closed":"badge-closed",
};

const DATE_FIELDS = new Set([
  "PO Date","Shipped","ETD","ETA","IHD","EST EXF","EST IHD","CXL Date","Assign Date",
  "EXF Date",
  "ASN Date","ASN Req Date",
  "Delivery Date","Delivery Req Date",
  "Pickup Date","Pickup Req Date",
]);

const COUNTDOWN_DATE_COLS = new Set([
  "Assign Date",
  "EST EXF", "EST IHD", "ETA", "IHD", "CXL Date", "Shipped", "ETD",
]);
const CXL_PROXIMITY_COLS = new Set(["IHD", "EST IHD"]);

function getDateFieldValue(col, row) {
  if (col === "EST IHD") return calculateEstIhd(row["Ship Method"], row["EST EXF"]);
  if (col === "EXF Date") return row["EXF Date"] ?? row["EXF Request Date"] ?? "";
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

function renderCountdownDateMarkup(display, countdownLabel, dateClasses, searchableText) {
  const dateHtml = searchableText != null
    ? getSearchHighlightedFragment(display, searchableText)
    : escapeHtml(display);
  return (
    `<span class="cxl-countdown-stack">` +
    `<span class="${dateClasses.join(" ")}">${dateHtml}</span>` +
    (countdownLabel ? `<span class="cxl-countdown-label">${escapeHtml(countdownLabel)}</span>` : "") +
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
      el.innerHTML = renderCountdownDateMarkup(
        display,
        countdownLabel,
        dateClasses,
        context === "table" ? rawVal : null
      );
      return;
    }
  }

  if (context === "table" && proximity) {
    el.classList.remove("empty-display");
    el.innerHTML = `<span class="date-display date-proximity-${proximity}">${getSearchHighlightedFragment(display, rawVal)}</span>`;
    return;
  }

  if (context === "modal" && proximity) {
    el.classList.remove("empty-display");
    el.innerHTML = `<span class="date-display date-proximity-${proximity}">${escapeHtml(display)}</span>`;
    return;
  }

  if (context === "table") {
    mountSearchHighlightedText(el, display, rawVal);
    return;
  }

  setDisplayText(el, display);
}
