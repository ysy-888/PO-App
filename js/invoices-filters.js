/** Invoice table column filters. */

let invFlagFilterActive = false;
const INV_STATUS_FILTER_ALL = "";
const INV_STATUS_FILTER_OPEN = typeof STATUS_FILTER_OPEN !== "undefined" ? STATUS_FILTER_OPEN : "__open__";
const INV_STATUS_FILTER_BUTTONS = [
  { label: "All", value: INV_STATUS_FILTER_ALL },
  { label: "Closed", value: "Closed" },
  { label: "Open", value: INV_STATUS_FILTER_OPEN },
];

let invActiveDivision = "";
let invActiveStatusFilter = INV_STATUS_FILTER_OPEN;

const INV_COLUMN_FILTER_COLS = [
  "Status",
  "Customer",
  "INV DATE",
];

const invColumnFilters = Object.fromEntries(INV_COLUMN_FILTER_COLS.map(col => [col, null]));
const invDateColumnRangeFilters = Object.fromEntries(
  [...INV_DATE_FILTER_COLUMNS].map(col => [col, null])
);

let invOpenFilterCol = null;
let invFilterDraft = new Set();
let invDateRangeDraft = { from: null, to: null };

function getInvDivisionFilterValues() {
  return typeof DIVISIONS !== "undefined" ? DIVISIONS : ["Elevator Disco", "Freesia"];
}

function getInvDivisionValue(inv) {
  const stored = String(inv?.Division ?? "").trim();
  if (stored) return typeof normalizeDivision === "function" ? normalizeDivision(stored) : stored;

  const linkedOrder = typeof findSalesOrderByNumber === "function"
    ? findSalesOrderByNumber(inv?.["SO #"])
    : null;
  const linked = String(linkedOrder?.Division ?? "").trim();
  return typeof normalizeDivision === "function" ? normalizeDivision(linked) : linked;
}

function getInvToolbarStatusValue(inv) {
  return String(inv?.Status ?? "").trim();
}

function rowMatchesInvToolbarStatusFilter(inv) {
  if (invActiveStatusFilter === INV_STATUS_FILTER_ALL) return true;

  const status = getInvToolbarStatusValue(inv);
  if (invActiveStatusFilter === INV_STATUS_FILTER_OPEN) {
    const normalized = status.toLowerCase();
    return normalized !== "closed" && normalized !== "cxl";
  }

  return status.toLowerCase() === String(invActiveStatusFilter).toLowerCase();
}

function rowPassesInvToolbarFilters(inv) {
  if (invActiveDivision && getInvDivisionValue(inv) !== invActiveDivision) return false;
  return rowMatchesInvToolbarStatusFilter(inv);
}

function syncInvDivisionFilterToolbar() {
  document.querySelectorAll("#invDivisionFilters .filter-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.division === invActiveDivision);
  });
}

function syncInvStatusFilterToolbar() {
  document.querySelectorAll("#invStatusFilters .filter-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.status === invActiveStatusFilter);
  });
}

function setInvDivisionFilter(division) {
  invActiveDivision = typeof normalizeDivision === "function" ? normalizeDivision(division) : String(division ?? "").trim();
  syncInvDivisionFilterToolbar();
  applyInvoiceFilters();
}

function setInvStatusFilter(status) {
  invActiveStatusFilter = status;
  syncInvStatusFilterToolbar();
  applyInvoiceFilters();
}

function initInvToolbarFilters() {
  const divisionGroup = document.getElementById("invDivisionFilters");
  if (divisionGroup) {
    const makeDivisionBtn = (label, value) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "filter-btn";
      btn.dataset.division = value;
      btn.textContent = label;
      btn.addEventListener("click", () => setInvDivisionFilter(value));
      return btn;
    };

    divisionGroup.replaceChildren(
      makeDivisionBtn("All", ""),
      ...getInvDivisionFilterValues().map(division => makeDivisionBtn(division, division))
    );
    syncInvDivisionFilterToolbar();
  }

  const statusGroup = document.getElementById("invStatusFilters");
  if (statusGroup) {
    statusGroup.replaceChildren();
    INV_STATUS_FILTER_BUTTONS.forEach(item => {
      if (item.divider) {
        const divider = document.createElement("div");
        divider.className = "filter-btn-group-divider";
        divider.setAttribute("aria-hidden", "true");
        statusGroup.appendChild(divider);
        return;
      }

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "filter-btn";
      btn.dataset.status = item.value;
      btn.textContent = item.label;
      btn.addEventListener("click", () => setInvStatusFilter(item.value));
      statusGroup.appendChild(btn);
    });
    syncInvStatusFilterToolbar();
  }
}

function normalizeInvFilterValue(val) {
  const s = String(val ?? "").trim();
  return s === "" ? BLANK_FILTER_LABEL : s;
}

function getInvColumnFilterRawValue(col, inv) {
  return inv[col];
}

function getInvFilterValueKey(col, inv) {
  const raw = getInvColumnFilterRawValue(col, inv);
  if (INV_DATE_FILTER_COLUMNS.has(col)) {
    if (isEmptyValue(raw)) return BLANK_FILTER_LABEL;
    return normalizeToYmd(raw) || BLANK_FILTER_LABEL;
  }
  return normalizeInvFilterValue(raw);
}

function getInvFilterValueLabel(col, key) {
  if (key === BLANK_FILTER_LABEL) return BLANK_FILTER_LABEL;
  if (INV_DATE_FILTER_COLUMNS.has(col)) return formatDateForDisplay(key);
  return key;
}

function compareInvFilterValues(a, b, col) {
  if (a === BLANK_FILTER_LABEL) return 1;
  if (b === BLANK_FILTER_LABEL) return -1;
  return a.localeCompare(b, undefined, { numeric: !INV_DATE_FILTER_COLUMNS.has(col) });
}

function getInvUniqueColumnValues(col) {
  const values = new Set();
  (allInvoices ?? []).forEach(inv => values.add(getInvFilterValueKey(col, inv)));
  return [...values].sort((a, b) => compareInvFilterValues(a, b, col));
}

function isInvColumnFilterActive(col) {
  if (INV_DATE_FILTER_COLUMNS.has(col)) return invDateColumnRangeFilters[col] != null;
  return invColumnFilters[col] != null;
}

function hasActiveInvColumnFilters() {
  return invFlagFilterActive ||
    invActiveDivision !== "" ||
    invActiveStatusFilter !== INV_STATUS_FILTER_ALL ||
    INV_COLUMN_FILTER_COLS.some(col => isInvColumnFilterActive(col));
}

function updateInvClearAllFiltersButton() {
  const btn = document.getElementById("invClearAllColumnFiltersBtn");
  if (btn) btn.hidden = !hasActiveInvColumnFilters();
}

function clearAllInvColumnFilters() {
  invFlagFilterActive = false;
  invActiveDivision = "";
  invActiveStatusFilter = INV_STATUS_FILTER_OPEN;
  INV_COLUMN_FILTER_COLS.forEach(col => { invColumnFilters[col] = null; });
  [...INV_DATE_FILTER_COLUMNS].forEach(col => { invDateColumnRangeFilters[col] = null; });
  closeInvColumnFilterPopover();
  syncInvDivisionFilterToolbar();
  syncInvStatusFilterToolbar();
  updateInvColumnFilterHeaderStates();
  updateInvFlagFilterHeaderState();
  applyInvoiceFilters();
}

function rowPassesInvColumnFilters(inv) {
  for (const col of INV_COLUMN_FILTER_COLS) {
    if (INV_DATE_FILTER_COLUMNS.has(col)) {
      const range = invDateColumnRangeFilters[col];
      if (!range) continue;
      const key = getInvFilterValueKey(col, inv);
      if (key === BLANK_FILTER_LABEL) return false;
      const from = range.from || range.to;
      const to = range.to || range.from;
      if (!from || !to) continue;
      if (key < from || key > to) return false;
      continue;
    }
    const selected = invColumnFilters[col];
    if (selected == null) continue;
    if (selected.size === 0) return false;
    if (!selected.has(getInvFilterValueKey(col, inv))) return false;
  }
  return true;
}

function getInvEffectiveFilterSelection(col) {
  const selected = invColumnFilters[col];
  if (selected == null) return new Set(getInvUniqueColumnValues(col));
  return new Set(selected);
}

function updateInvColumnFilterHeaderStates() {
  document.querySelectorAll("#invoiceTable th.th-filterable").forEach(th => {
    th.classList.toggle("filter-active", isInvColumnFilterActive(th.dataset.col));
  });
}

function createInvColumnFilterOption(value, col) {
  const label = document.createElement("label");
  label.className = "column-filter-option";

  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.value = value;
  cb.checked = invFilterDraft.has(value);
  cb.addEventListener("change", () => {
    if (cb.checked) invFilterDraft.add(value);
    else invFilterDraft.delete(value);
  });

  const span = document.createElement("span");
  span.textContent = getInvFilterValueLabel(col, value);

  label.appendChild(cb);
  label.appendChild(span);
  return label;
}

function renderInvDateRangeFilter(list, col) {
  list.style.cssText = "border:none;padding:0;max-height:none;overflow:visible;margin-bottom:0;";

  const allDates = getInvUniqueColumnValues(col).filter(k => k !== BLANK_FILTER_LABEL);
  const container = document.createElement("div");
  container.className = "date-range-filter";
  list.appendChild(container);

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
  let toWheelHandle = null;

  function refreshToWheel() {
    const toOptions = allDates.filter(k => !invDateRangeDraft.from || k >= invDateRangeDraft.from);
    const oldWrap = toCol.querySelector(".date-wheel-wrap");
    if (oldWrap) oldWrap.remove();
    const toSnap = invDateRangeDraft.to && toOptions.includes(invDateRangeDraft.to)
      ? invDateRangeDraft.to
      : toOptions[0];
    toWheelHandle = buildDateWheel(toOptions, toSnap, key => {
      invDateRangeDraft.to = key;
      toField.value = formatDateForDisplay(key);
      updateCompactDateInputState(toField);
      toField.classList.remove("is-invalid");
    });
    toCol.appendChild(toWheelHandle.wrap);
  }

  let fromWheelHandle = null;

  const fromDateInput = createDateRangeInput(invDateRangeDraft.from, ymd => {
    invDateRangeDraft.from = ymd;
    if (ymd) {
      invDateRangeDraft.to = ymd;
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

  const toDateInput = createDateRangeInput(invDateRangeDraft.to, ymd => {
    invDateRangeDraft.to = ymd;
    validateDateRangeToBeforeFrom(fromField, toField);
  }, {
    tabIndex: 2,
    onNavigateWheel: delta => toWheelHandle?.navigateAdjacent(delta),
  });
  toField = toDateInput.input;
  toCol.appendChild(toDateInput.wrap);

  fromWheelHandle = buildDateWheel(allDates, invDateRangeDraft.from, key => {
    invDateRangeDraft.from = key;
    invDateRangeDraft.to = key;
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

  const toOptions = allDates.filter(k => !invDateRangeDraft.from || k >= invDateRangeDraft.from);
  toWheelHandle = buildDateWheel(toOptions, invDateRangeDraft.to, key => {
    invDateRangeDraft.to = key;
    toField.value = formatDateForDisplay(key);
    updateCompactDateInputState(toField);
    toField.classList.remove("is-invalid");
  });
  toCol.appendChild(toWheelHandle.wrap);
  container.appendChild(toCol);
}

function renderInvColumnFilterList() {
  const list = document.getElementById("invColumnFilterList");
  if (!list || !invOpenFilterCol) return;

  list.innerHTML = "";
  list.style.cssText = "";

  if (INV_DATE_FILTER_COLUMNS.has(invOpenFilterCol)) {
    renderInvDateRangeFilter(list, invOpenFilterCol);
    return;
  }

  getInvUniqueColumnValues(invOpenFilterCol).forEach(value => {
    list.appendChild(createInvColumnFilterOption(value, invOpenFilterCol));
  });
}

function positionInvColumnFilterPopover(anchorTh) {
  const pop = document.getElementById("invColumnFilterPopover");
  if (!pop || !anchorTh) return;

  const rect = anchorTh.getBoundingClientRect();
  const maxLeft = window.innerWidth - pop.offsetWidth - 8;
  const left = Math.min(Math.max(8, rect.left), maxLeft);

  pop.style.top = `${rect.bottom + 4}px`;
  pop.style.left = `${left}px`;
}

function syncInvDateRangeDraftFromPopoverFields() {
  const list = document.getElementById("invColumnFilterList");
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
  invDateRangeDraft = { from: fromYmd, to: toYmd };
  return validateDateRangeToBeforeFrom(fromField, toField);
}

function seedInvDateRangeDraftFromFilter(col) {
  const range = invDateColumnRangeFilters[col];
  invDateRangeDraft = range ? { from: range.from, to: range.to } : { from: null, to: null };
}

function setInvDateFilterPopoverTabOrder(active) {
  const okBtn = document.getElementById("invColumnFilterOk");
  const cancelBtn = document.getElementById("invColumnFilterCancel");
  const clearBtn = document.getElementById("invColumnFilterClearAll");
  if (okBtn) okBtn.tabIndex = active ? 3 : 0;
  if (cancelBtn) cancelBtn.tabIndex = active ? -1 : 0;
  if (clearBtn) clearBtn.tabIndex = active ? -1 : 0;
}

function openInvColumnFilterPopover(col, anchorTh) {
  const pop = document.getElementById("invColumnFilterPopover");
  if (!pop) return;

  invOpenFilterCol = col;
  const isDate = INV_DATE_FILTER_COLUMNS.has(col);

  if (isDate) seedInvDateRangeDraftFromFilter(col);
  else invFilterDraft = getInvEffectiveFilterSelection(col);

  const selectAllBtn = document.getElementById("invColumnFilterSelectAll");
  const sep = document.getElementById("invColumnFilterSelectSep");
  if (selectAllBtn) selectAllBtn.hidden = isDate;
  if (sep) sep.hidden = isDate;

  setInvDateFilterPopoverTabOrder(isDate);
  pop.hidden = false;
  pop.style.minWidth = isDate ? "260px" : "";
  renderInvColumnFilterList();
  requestAnimationFrame(() => {
    positionInvColumnFilterPopover(anchorTh);
    if (isDate) pop.querySelector('input.date-range-field[tabindex="1"]')?.focus();
  });
}

function closeInvColumnFilterPopover() {
  const pop = document.getElementById("invColumnFilterPopover");
  if (pop) pop.hidden = true;
  invOpenFilterCol = null;
  setInvDateFilterPopoverTabOrder(false);
}

function setInvFilterDraftSelectAll(selectAll) {
  if (!invOpenFilterCol || INV_DATE_FILTER_COLUMNS.has(invOpenFilterCol)) return;
  invFilterDraft = selectAll
    ? new Set(getInvUniqueColumnValues(invOpenFilterCol))
    : new Set();
  renderInvColumnFilterList();
}

function clearInvDateRangeFilter() {
  invDateRangeDraft = { from: null, to: null };
  renderInvColumnFilterList();
}

function applyInvColumnFilterFromPopover() {
  const col = invOpenFilterCol;
  if (!col) return;

  if (INV_DATE_FILTER_COLUMNS.has(col)) {
    if (!syncInvDateRangeDraftFromPopoverFields()) return;
    const { from, to } = invDateRangeDraft;
    if (!from && !to) {
      invDateColumnRangeFilters[col] = null;
      invColumnFilters[col] = null;
    } else {
      invDateColumnRangeFilters[col] = {
        from: from || to,
        to: to || from,
      };
      invColumnFilters[col] = null;
    }
    closeInvColumnFilterPopover();
    updateInvColumnFilterHeaderStates();
    applyInvoiceFilters();
    return;
  }

  const allValues = getInvUniqueColumnValues(col);
  if (invFilterDraft.size === 0) invColumnFilters[col] = new Set();
  else if (invFilterDraft.size === allValues.length) invColumnFilters[col] = null;
  else invColumnFilters[col] = new Set(invFilterDraft);

  closeInvColumnFilterPopover();
  updateInvColumnFilterHeaderStates();
  applyInvoiceFilters();
}

function initInvColumnFilterHeaders() {
  document.querySelectorAll("#invoiceTable th.th-filterable").forEach(th => {
    const col = th.dataset.col;
    if (!INV_COLUMN_FILTER_COLS.includes(col)) return;

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
        sortByInv(col);
      });
    }

    th.addEventListener("click", e => {
      if (e.target.closest(".th-label")) return;
      openInvColumnFilterPopover(col, th);
    });
  });

  document.getElementById("invColumnFilterSelectAll")?.addEventListener("click", () => setInvFilterDraftSelectAll(true));
  document.getElementById("invColumnFilterClearAll")?.addEventListener("click", () => {
    if (invOpenFilterCol && INV_DATE_FILTER_COLUMNS.has(invOpenFilterCol)) clearInvDateRangeFilter();
    else setInvFilterDraftSelectAll(false);
  });
  document.getElementById("invColumnFilterOk")?.addEventListener("click", applyInvColumnFilterFromPopover);
  document.getElementById("invColumnFilterCancel")?.addEventListener("click", closeInvColumnFilterPopover);
  document.getElementById("invClearAllColumnFiltersBtn")?.addEventListener("click", clearAllInvColumnFilters);

  document.addEventListener("click", e => {
    const pop = document.getElementById("invColumnFilterPopover");
    if (!pop || pop.hidden) return;
    if (pop.contains(e.target) || e.target.closest("#invoiceTable th.th-filterable")) return;
    closeInvColumnFilterPopover();
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeInvColumnFilterPopover();
  });

  window.addEventListener("resize", () => {
    if (invOpenFilterCol) {
      const th = document.querySelector(`#invoiceTable th.th-filterable[data-col="${CSS.escape(invOpenFilterCol)}"]`);
      if (th) positionInvColumnFilterPopover(th);
    }
  });
}
