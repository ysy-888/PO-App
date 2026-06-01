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
  if (col === "Actual Qty") {
    const qty = getPackingActualQtyForRow(row);
    return qty > 0 ? qty : "";
  }
  if (col === "Ctn Qty") {
    const qty = getPackingCtnQtyForRow(row);
    return qty > 0 ? qty : "";
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
  return columnFilters[col] != null;
}

function hasActiveColumnFilters() {
  return flagFilterActive ||
    isStatusHeaderFilterActive() ||
    COLUMN_FILTER_COLS.some(col => columnFilters[col] != null);
}

function updateClearAllFiltersButton() {
  const btn = document.getElementById("clearAllColumnFiltersBtn");
  if (btn) btn.hidden = !hasActiveColumnFilters();
}

function clearAllColumnFilters() {
  flagFilterActive = false;
  statusFilterSelection = null;
  activeStatus = "";
  COLUMN_FILTER_COLS.forEach(col => { columnFilters[col] = null; });
  closeColumnFilterPopover();
  syncStatusFilterToolbar();
  updateColumnFilterHeaderStates();
  updateFlagFilterHeaderState();
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

function renderColumnFilterList() {
  const list = document.getElementById("columnFilterList");
  if (!list || !openFilterCol) return;

  list.innerHTML = "";

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
  if (col === "Status") {
    applyStatusFilterFromPopover(filterDraft);
    closeColumnFilterPopover();
    updateColumnFilterHeaderStates();
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
  "Pending":"badge-pending","WIP":"badge-wip","Requested":"badge-requested",
  "OTW":"badge-otw","Arrived at Port":"badge-port","Scheduled":"badge-scheduled",
  "In Warehouse":"badge-wh","Assigned":"badge-assigned","Hold":"badge-hold",
  "CXL":"badge-cancelled","Closed":"badge-closed",
};

const DATE_FIELDS = new Set([
  "PO Date","Shipped","ETD","ETA","IHD","EST EXF","EST IHD","EXF","CXL Date","Assign Date",
  "EXF Request Date","EXF Date","EXF Req Date",
  "ASN Date","ASN Req Date",
  "Delivery Date","Delivery Req Date",
  "Pickup Date","Pickup Req Date",
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
