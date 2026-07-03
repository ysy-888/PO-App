/** Sales Order table column filters. */

const SO_COLUMN_FILTER_COLS = [
  "Customer",
  "Customer PO #",
  "INVOICE STATUS",
  "Store",
  "N41 Status",
  "Order Type",
  "Customer Type",
  "Order Date",
  "Ship Date",
  "CXL Date",
];

const soColumnFilters = Object.fromEntries(SO_COLUMN_FILTER_COLS.map(col => [col, null]));
const soDateColumnRangeFilters = Object.fromEntries(
  [...SO_DATE_FILTER_COLUMNS].map(col => [col, null])
);

let soOpenFilterCol = null;
let soFilterDraft = new Set();
let soDateRangeDraft = { from: null, to: null };

function normalizeSoFilterValue(val) {
  const s = String(val ?? "").trim();
  return s === "" ? BLANK_FILTER_LABEL : s;
}

function getSoColumnFilterRawValue(col, order) {
  if (typeof getSoComputedColumnValue === "function") {
    const computed = getSoComputedColumnValue(col, order);
    if (computed !== undefined) return computed;
  }
  return order[col];
}

function getSoFilterValueKey(col, order) {
  const raw = getSoColumnFilterRawValue(col, order);
  if (SO_DATE_FILTER_COLUMNS.has(col)) {
    if (isEmptyValue(raw)) return BLANK_FILTER_LABEL;
    return normalizeToYmd(raw) || BLANK_FILTER_LABEL;
  }
  return normalizeSoFilterValue(raw);
}

function getSoFilterValueLabel(col, key) {
  if (key === BLANK_FILTER_LABEL) return BLANK_FILTER_LABEL;
  if (SO_DATE_FILTER_COLUMNS.has(col)) return formatDateForDisplay(key);
  return key;
}

function compareSoFilterValues(a, b, col) {
  if (a === BLANK_FILTER_LABEL) return 1;
  if (b === BLANK_FILTER_LABEL) return -1;
  return a.localeCompare(b, undefined, { numeric: !SO_DATE_FILTER_COLUMNS.has(col) });
}

function getSoUniqueColumnValues(col) {
  const values = new Set();
  (allSalesOrders ?? []).forEach(order => values.add(getSoFilterValueKey(col, order)));
  return [...values].sort((a, b) => compareSoFilterValues(a, b, col));
}

function isSoColumnFilterActive(col) {
  if (SO_DATE_FILTER_COLUMNS.has(col)) return soDateColumnRangeFilters[col] != null;
  return soColumnFilters[col] != null;
}

function hasActiveSoColumnFilters() {
  return soFlagFilterActive || SO_COLUMN_FILTER_COLS.some(col => isSoColumnFilterActive(col));
}

function updateSoClearAllFiltersButton() {
  const btn = document.getElementById("soClearAllColumnFiltersBtn");
  if (btn) btn.hidden = !hasActiveSoColumnFilters();
}

function clearAllSoColumnFilters() {
  soFlagFilterActive = false;
  SO_COLUMN_FILTER_COLS.forEach(col => { soColumnFilters[col] = null; });
  [...SO_DATE_FILTER_COLUMNS].forEach(col => { soDateColumnRangeFilters[col] = null; });
  closeSoColumnFilterPopover();
  updateSoColumnFilterHeaderStates();
  updateSoFlagFilterHeaderState();
  applySalesOrderFilters();
}

function rowPassesSoColumnFilters(order) {
  for (const col of SO_COLUMN_FILTER_COLS) {
    if (SO_DATE_FILTER_COLUMNS.has(col)) {
      const range = soDateColumnRangeFilters[col];
      if (!range) continue;
      const key = getSoFilterValueKey(col, order);
      if (key === BLANK_FILTER_LABEL) return false;
      const from = range.from || range.to;
      const to = range.to || range.from;
      if (!from || !to) continue;
      if (key < from || key > to) return false;
      continue;
    }
    const selected = soColumnFilters[col];
    if (selected == null) continue;
    if (selected.size === 0) return false;
    if (!selected.has(getSoFilterValueKey(col, order))) return false;
  }
  return true;
}

function getSoEffectiveFilterSelection(col) {
  const selected = soColumnFilters[col];
  if (selected == null) return new Set(getSoUniqueColumnValues(col));
  return new Set(selected);
}

function updateSoColumnFilterHeaderStates() {
  document.querySelectorAll("#salesOrderTable th.th-filterable").forEach(th => {
    th.classList.toggle("filter-active", isSoColumnFilterActive(th.dataset.col));
  });
}

function createSoColumnFilterOption(value, col) {
  const label = document.createElement("label");
  label.className = "column-filter-option";

  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.value = value;
  cb.checked = soFilterDraft.has(value);
  cb.addEventListener("change", () => {
    if (cb.checked) soFilterDraft.add(value);
    else soFilterDraft.delete(value);
  });

  const span = document.createElement("span");
  span.textContent = getSoFilterValueLabel(col, value);

  label.appendChild(cb);
  label.appendChild(span);
  return label;
}

function renderSoDateRangeFilter(list, col) {
  list.style.cssText = "border:none;padding:0;max-height:none;overflow:visible;margin-bottom:0;";

  const allDates = getSoUniqueColumnValues(col).filter(k => k !== BLANK_FILTER_LABEL);
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
    const toOptions = allDates.filter(k => !soDateRangeDraft.from || k >= soDateRangeDraft.from);
    const oldWrap = toCol.querySelector(".date-wheel-wrap");
    if (oldWrap) oldWrap.remove();
    const toSnap = soDateRangeDraft.to && toOptions.includes(soDateRangeDraft.to)
      ? soDateRangeDraft.to
      : toOptions[0];
    toWheelHandle = buildDateWheel(toOptions, toSnap, key => {
      soDateRangeDraft.to = key;
      toField.value = formatDateForDisplay(key);
      updateCompactDateInputState(toField);
      toField.classList.remove("is-invalid");
    });
    toCol.appendChild(toWheelHandle.wrap);
  }

  let fromWheelHandle = null;

  const fromDateInput = createDateRangeInput(soDateRangeDraft.from, ymd => {
    soDateRangeDraft.from = ymd;
    if (ymd) {
      soDateRangeDraft.to = ymd;
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

  const toDateInput = createDateRangeInput(soDateRangeDraft.to, ymd => {
    soDateRangeDraft.to = ymd;
    validateDateRangeToBeforeFrom(fromField, toField);
  }, {
    tabIndex: 2,
    onNavigateWheel: delta => toWheelHandle?.navigateAdjacent(delta),
  });
  toField = toDateInput.input;
  toCol.appendChild(toDateInput.wrap);

  fromWheelHandle = buildDateWheel(allDates, soDateRangeDraft.from, key => {
    soDateRangeDraft.from = key;
    soDateRangeDraft.to = key;
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

  const toOptions = allDates.filter(k => !soDateRangeDraft.from || k >= soDateRangeDraft.from);
  toWheelHandle = buildDateWheel(toOptions, soDateRangeDraft.to, key => {
    soDateRangeDraft.to = key;
    toField.value = formatDateForDisplay(key);
    updateCompactDateInputState(toField);
    toField.classList.remove("is-invalid");
  });
  toCol.appendChild(toWheelHandle.wrap);
  container.appendChild(toCol);
}

function renderSoColumnFilterList() {
  const list = document.getElementById("soColumnFilterList");
  if (!list || !soOpenFilterCol) return;

  list.innerHTML = "";
  list.style.cssText = "";

  if (SO_DATE_FILTER_COLUMNS.has(soOpenFilterCol)) {
    renderSoDateRangeFilter(list, soOpenFilterCol);
    return;
  }

  getSoUniqueColumnValues(soOpenFilterCol).forEach(value => {
    list.appendChild(createSoColumnFilterOption(value, soOpenFilterCol));
  });
}

function positionSoColumnFilterPopover(anchorTh) {
  const pop = document.getElementById("soColumnFilterPopover");
  if (!pop || !anchorTh) return;

  const rect = anchorTh.getBoundingClientRect();
  const maxLeft = window.innerWidth - pop.offsetWidth - 8;
  const left = Math.min(Math.max(8, rect.left), maxLeft);

  pop.style.top = `${rect.bottom + 4}px`;
  pop.style.left = `${left}px`;
}

function syncSoDateRangeDraftFromPopoverFields() {
  const list = document.getElementById("soColumnFilterList");
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
  soDateRangeDraft = { from: fromYmd, to: toYmd };
  return validateDateRangeToBeforeFrom(fromField, toField);
}

function seedSoDateRangeDraftFromFilter(col) {
  const range = soDateColumnRangeFilters[col];
  soDateRangeDraft = range ? { from: range.from, to: range.to } : { from: null, to: null };
}

function setSoDateFilterPopoverTabOrder(active) {
  const okBtn = document.getElementById("soColumnFilterOk");
  const cancelBtn = document.getElementById("soColumnFilterCancel");
  const clearBtn = document.getElementById("soColumnFilterClearAll");
  if (okBtn) okBtn.tabIndex = active ? 3 : 0;
  if (cancelBtn) cancelBtn.tabIndex = active ? -1 : 0;
  if (clearBtn) clearBtn.tabIndex = active ? -1 : 0;
}

function openSoColumnFilterPopover(col, anchorTh) {
  const pop = document.getElementById("soColumnFilterPopover");
  if (!pop) return;

  soOpenFilterCol = col;
  const isDate = SO_DATE_FILTER_COLUMNS.has(col);

  if (isDate) seedSoDateRangeDraftFromFilter(col);
  else soFilterDraft = getSoEffectiveFilterSelection(col);

  const selectAllBtn = document.getElementById("soColumnFilterSelectAll");
  const sep = document.getElementById("soColumnFilterSelectSep");
  if (selectAllBtn) selectAllBtn.hidden = isDate;
  if (sep) sep.hidden = isDate;

  setSoDateFilterPopoverTabOrder(isDate);
  pop.hidden = false;
  pop.style.minWidth = isDate ? "260px" : "";
  renderSoColumnFilterList();
  requestAnimationFrame(() => {
    positionSoColumnFilterPopover(anchorTh);
    if (isDate) pop.querySelector('input.date-range-field[tabindex="1"]')?.focus();
  });
}

function closeSoColumnFilterPopover() {
  const pop = document.getElementById("soColumnFilterPopover");
  if (pop) pop.hidden = true;
  soOpenFilterCol = null;
  setSoDateFilterPopoverTabOrder(false);
}

function setSoFilterDraftSelectAll(selectAll) {
  if (!soOpenFilterCol || SO_DATE_FILTER_COLUMNS.has(soOpenFilterCol)) return;
  soFilterDraft = selectAll
    ? new Set(getSoUniqueColumnValues(soOpenFilterCol))
    : new Set();
  renderSoColumnFilterList();
}

function clearSoDateRangeFilter() {
  soDateRangeDraft = { from: null, to: null };
  renderSoColumnFilterList();
}

function applySoColumnFilterFromPopover() {
  const col = soOpenFilterCol;
  if (!col) return;

  if (SO_DATE_FILTER_COLUMNS.has(col)) {
    if (!syncSoDateRangeDraftFromPopoverFields()) return;
    const { from, to } = soDateRangeDraft;
    if (!from && !to) {
      soDateColumnRangeFilters[col] = null;
      soColumnFilters[col] = null;
    } else {
      soDateColumnRangeFilters[col] = {
        from: from || to,
        to: to || from,
      };
      soColumnFilters[col] = null;
    }
    closeSoColumnFilterPopover();
    updateSoColumnFilterHeaderStates();
    applySalesOrderFilters();
    return;
  }

  const allValues = getSoUniqueColumnValues(col);
  if (soFilterDraft.size === 0) soColumnFilters[col] = new Set();
  else if (soFilterDraft.size === allValues.length) soColumnFilters[col] = null;
  else soColumnFilters[col] = new Set(soFilterDraft);

  closeSoColumnFilterPopover();
  updateSoColumnFilterHeaderStates();
  applySalesOrderFilters();
}

function initSoColumnFilterHeaders() {
  document.querySelectorAll("#salesOrderTable th.th-filterable").forEach(th => {
    const col = th.dataset.col;
    if (!SO_COLUMN_FILTER_COLS.includes(col)) return;

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
        sortBySo(col);
      });
    }

    th.addEventListener("click", e => {
      if (e.target.closest(".th-label")) return;
      openSoColumnFilterPopover(col, th);
    });
  });

  document.getElementById("soColumnFilterSelectAll")?.addEventListener("click", () => setSoFilterDraftSelectAll(true));
  document.getElementById("soColumnFilterClearAll")?.addEventListener("click", () => {
    if (soOpenFilterCol && SO_DATE_FILTER_COLUMNS.has(soOpenFilterCol)) clearSoDateRangeFilter();
    else setSoFilterDraftSelectAll(false);
  });
  document.getElementById("soColumnFilterOk")?.addEventListener("click", applySoColumnFilterFromPopover);
  document.getElementById("soColumnFilterCancel")?.addEventListener("click", closeSoColumnFilterPopover);
  document.getElementById("soClearAllColumnFiltersBtn")?.addEventListener("click", clearAllSoColumnFilters);

  document.addEventListener("click", e => {
    const pop = document.getElementById("soColumnFilterPopover");
    if (!pop || pop.hidden) return;
    if (pop.contains(e.target) || e.target.closest("#salesOrderTable th.th-filterable")) return;
    closeSoColumnFilterPopover();
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeSoColumnFilterPopover();
  });

  window.addEventListener("resize", () => {
    if (soOpenFilterCol) {
      const th = document.querySelector(`#salesOrderTable th.th-filterable[data-col="${CSS.escape(soOpenFilterCol)}"]`);
      if (th) positionSoColumnFilterPopover(th);
    }
  });
}
