
function isTruthy(val) {
  if (val === true || val === 1) return true;
  const s = String(val ?? "").trim().toLowerCase();
  return s === "true" || s === "yes" || s === "1" || s === "x";
}

function toSheetBool(val) {
  return !!val;
}

function toggleRowSelected(row, selected) {
  const next = toSheetBool(selected);
  if (isTruthy(row["Selected"]) === next) return false;
  row["Selected"] = next;
  updateSelectAllHeader();
  if (typeof onPoSelectionChanged === "function") onPoSelectionChanged();
  requestAnimationFrame(updateCheckboxSelectAntsOverlay);
  return true;
}

let exfFormSelectedPos = new Set();
let shipmentFormSelectedPos = new Set();

function getPoSelectionKey(poOrRow) {
  const po = poOrRow && typeof poOrRow === "object" ? poOrRow["PO #"] : poOrRow;
  return String(po ?? "");
}

function clearMainTableSelection() {
  resetLocalSelectedState(allRows);
  clearMiniSelection();
  document.querySelectorAll("#tableBody .po-select-checkbox").forEach(cb => {
    cb.checked = false;
  });
  updateSelectAllHeader();
  requestAnimationFrame(updateCheckboxSelectAntsOverlay);
}

function clearExfFormSelection() {
  exfFormSelectedPos.clear();
}

function clearShipmentFormSelection() {
  shipmentFormSelectedPos.clear();
}

function isExfFormPoSelected(poOrRow) {
  return exfFormSelectedPos.has(getPoSelectionKey(poOrRow));
}

function isShipmentFormPoSelected(poOrRow) {
  return shipmentFormSelectedPos.has(getPoSelectionKey(poOrRow));
}

function toggleExfFormPoSelected(poOrRow, selected) {
  const key = getPoSelectionKey(poOrRow);
  if (!key) return;
  if (selected) exfFormSelectedPos.add(key);
  else exfFormSelectedPos.delete(key);
}

function toggleShipmentFormPoSelected(poOrRow, selected) {
  const key = getPoSelectionKey(poOrRow);
  if (!key) return;
  if (selected) shipmentFormSelectedPos.add(key);
  else shipmentFormSelectedPos.delete(key);
}

function pruneExfFormSelection(rows) {
  const allowed = new Set(rows.map(getPoSelectionKey));
  exfFormSelectedPos = new Set([...exfFormSelectedPos].filter(po => allowed.has(po)));
}

function pruneShipmentFormSelection(rows) {
  const allowed = new Set(rows.map(getPoSelectionKey));
  shipmentFormSelectedPos = new Set([...shipmentFormSelectedPos].filter(po => allowed.has(po)));
}

function renderFormSelectedCell(td, poOrRow, isSelected, onToggle) {
  td.className = "td-select-cell readonly-no-select";

  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.className = "po-select-checkbox";
  cb.checked = !!isSelected;
  cb.setAttribute("aria-label", `Select PO ${getPoSelectionKey(poOrRow)}`);
  cb.addEventListener("click", e => {
    e.stopPropagation();
    onToggle(cb.checked, cb);
  });
  td.appendChild(cb);
  return cb;
}

function onFormPoSelectionChanged() {
  const exfOverlay = document.getElementById("exfRequestOverlay");
  if (exfOverlay?.classList.contains("open") && typeof updateExfRequestModalActionButtons === "function") {
    updateExfRequestModalActionButtons();
    if (typeof getExfRequestRows === "function" && typeof updateExfRequestLinkedPoSelectAllHeader === "function") {
      updateExfRequestLinkedPoSelectAllHeader(getExfRequestRows());
    }
  }

  const shipmentOverlay = document.querySelector("#createShipmentOverlay.open, #shipmentModalOverlay.open");
  if (shipmentOverlay && typeof getLinkedPosFromModalTable === "function") {
    const pos = getLinkedPosFromModalTable();
    if (pos.length && typeof updateShipmentLinkedPoSelectAllHeader === "function") {
      updateShipmentLinkedPoSelectAllHeader(pos);
    }
    if (typeof updateShipmentModalActionButtons === "function") updateShipmentModalActionButtons();
  }
}

function createAvailablePoPickerSelection() {
  const selected = new Set();
  return {
    clear() { selected.clear(); },
    has(po) { return selected.has(String(po ?? "")); },
    toggle(po, checked) {
      const key = String(po ?? "");
      if (!key) return;
      if (checked) selected.add(key);
      else selected.delete(key);
    },
    getAll() { return [...selected]; },
    get size() { return selected.size; },
    setAll(pos, checked) {
      pos.forEach(row => {
        const key = String(row["PO #"] ?? "");
        if (!key) return;
        if (checked) selected.add(key);
        else selected.delete(key);
      });
    },
  };
}

function updateAvailablePoPickerSelectAll(pos, selectAllEl, selection) {
  if (!selectAllEl) return;
  if (pos.length === 0) {
    selectAllEl.checked = false;
    selectAllEl.indeterminate = false;
    selectAllEl.disabled = true;
    return;
  }
  selectAllEl.disabled = false;
  const count = pos.filter(row => selection.has(row["PO #"])).length;
  selectAllEl.checked = count === pos.length;
  selectAllEl.indeterminate = count > 0 && count < pos.length;
}

function syncAvailablePoPickerRowCheckboxes(section, pos, selection) {
  const tbody = section.querySelector("tbody");
  if (!tbody) return;
  pos.forEach(row => {
    const po = String(row["PO #"] ?? "");
    const tr = [...tbody.querySelectorAll("tr[data-po]")].find(el => String(el.dataset.po) === po);
    const cb = tr?.querySelector(".po-select-checkbox");
    if (cb) cb.checked = selection.has(po);
  });
}

/** @type {Set<number>} visible row indices on the current page */
let miniSelectedIndices = new Set();
let miniSelectClickAnchorIndex = -1;
let rowSelectPointerId = null;
let rowSelectAnchorIndex = -1;
let rowSelectRangeMode = false;
let rowSelectToggleOff = false;
let rowSelectPointerCaptured = false;
let rowSelectStartX = 0;
let rowSelectStartY = 0;

const ROW_SELECT_DRAG_THRESHOLD = 4;

function isRowMiniSelectBlocked(target) {
  if (!(target instanceof Element)) return true;
  return Boolean(target.closest(
    "input, textarea, select, button, .cell-select-dropdown, .cell-date-popover, .po-flag-btn, " +
    ".td-select-cell, .select-cell, .editable, .shipment-id-link"
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

let checkboxSelectAntsEl = null;

function getCheckboxSelectedTrList() {
  return getVisibleRowTrList().filter(tr => tr.querySelector(".po-select-checkbox:checked"));
}

function ensureCheckboxSelectAntsOverlay() {
  if (checkboxSelectAntsEl) return checkboxSelectAntsEl;
  const container = document.querySelector(".table-scroll-x");
  if (!container) return null;

  checkboxSelectAntsEl = document.createElement("div");
  checkboxSelectAntsEl.id = "checkboxSelectAnts";
  checkboxSelectAntsEl.className = "checkbox-select-ants";
  checkboxSelectAntsEl.hidden = true;
  checkboxSelectAntsEl.innerHTML =
    `<svg class="checkbox-select-ants-svg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
    `<rect class="checkbox-select-ants-rect" fill="none"/></svg>`;
  container.appendChild(checkboxSelectAntsEl);
  return checkboxSelectAntsEl;
}

function updateCheckboxSelectAntsOverlay() {
  const overlay = ensureCheckboxSelectAntsOverlay();
  if (!overlay) return;

  const selectedTrs = getCheckboxSelectedTrList();
  if (selectedTrs.length === 0) {
    overlay.hidden = true;
    return;
  }

  const container = document.querySelector(".table-scroll-x");
  const table = document.getElementById("poTable");
  const firstTr = selectedTrs[0];
  const lastTr = selectedTrs[selectedTrs.length - 1];
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

  const svg = overlay.querySelector(".checkbox-select-ants-svg");
  const rect = overlay.querySelector(".checkbox-select-ants-rect");
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
}

function clearMiniSelection() {
  if (miniSelectedIndices.size === 0) return;
  miniSelectedIndices.clear();
  miniSelectClickAnchorIndex = -1;
  applyMiniSelectionClasses();
  if (typeof syncPoPackingPaneFromMiniSelection === "function") syncPoPackingPaneFromMiniSelection();
}

function getSingleMiniSelectedRow() {
  if (miniSelectedIndices.size !== 1) return null;
  const index = [...miniSelectedIndices][0];
  return getVisiblePageRow(index);
}

function getMiniSelectShiftAnchor() {
  if (miniSelectClickAnchorIndex >= 0) return miniSelectClickAnchorIndex;
  if (miniSelectedIndices.size === 0) return -1;
  return Math.min(...miniSelectedIndices);
}

function setMiniSelectionByIndexRange(startIdx, endIdx) {
  const trs = getVisibleRowTrList();
  if (startIdx < 0 || endIdx < 0 || trs.length === 0) return;

  const lo = Math.min(startIdx, endIdx);
  const hi = Math.max(startIdx, endIdx);
  miniSelectedIndices.clear();
  for (let i = lo; i <= hi; i++) miniSelectedIndices.add(i);
  applyMiniSelectionClasses();
  if (typeof syncPoPackingPaneFromMiniSelection === "function") syncPoPackingPaneFromMiniSelection();
}

function moveSingleMiniSelection(delta) {
  if (miniSelectedIndices.size !== 1) return false;

  const trs = getVisibleRowTrList();
  if (trs.length === 0) return false;

  const currentIdx = [...miniSelectedIndices][0];
  const nextIdx = currentIdx + delta;
  if (nextIdx < 0 || nextIdx >= trs.length) return false;

  setMiniSelectionByIndexRange(nextIdx, nextIdx);
  miniSelectClickAnchorIndex = nextIdx;
  trs[nextIdx]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  return true;
}

function getVisiblePageRow(index) {
  const rows = getPagedRows();
  return rows[index] ?? null;
}

function findRowByPo(po) {
  const key = typeof normalizePoNumber === "function" ? normalizePoNumber(po) : String(po ?? "").trim();
  return allRows.find(row => {
    const rowKey = typeof normalizePoNumber === "function"
      ? normalizePoNumber(row["PO #"])
      : String(row["PO #"] ?? "").trim();
    return rowKey === key;
  });
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

  let changed = false;
  rows.forEach(row => {
    if (toggleRowSelected(row, targetState)) changed = true;
  });

  if (!changed) return;
  renderTable();
}

function initRowMiniSelection() {
  const tbody = document.getElementById("tableBody");
  if (!tbody) return;

  tbody.addEventListener("dblclick", e => {
    const tr = e.target.closest("tr[data-po]");
    if (!tr) return;
    if (typeof shouldIgnoreRowDblClick === "function" && shouldIgnoreRowDblClick(e)) return;

    const row = findRowByPo(tr.dataset.po);
    if (!row) return;

    e.preventDefault();
    e.stopPropagation();
    if (typeof closeCellSelectDropdown === "function") closeCellSelectDropdown(false);
    openPODetail(row);
  }, true);

  tbody.addEventListener("pointerdown", e => {
    if (e.button !== 0) return;
    const tr = e.target.closest("tr[data-po]");
    if (!tr || isRowMiniSelectBlocked(e.target)) return;

    const idx = getRowIndexFromTr(tr);
    if (idx === -1) return;

    if (e.shiftKey) {
      e.preventDefault();
      const anchor = getMiniSelectShiftAnchor();
      if (anchor === -1) {
        setMiniSelectionByIndexRange(idx, idx);
        miniSelectClickAnchorIndex = idx;
      } else {
        setMiniSelectionByIndexRange(anchor, idx);
      }
      return;
    }

    rowSelectPointerId = e.pointerId;
    rowSelectAnchorIndex = idx;
    rowSelectRangeMode = false;
    rowSelectPointerCaptured = false;
    rowSelectStartX = e.clientX;
    rowSelectStartY = e.clientY;
    rowSelectToggleOff = miniSelectedIndices.size === 1 && miniSelectedIndices.has(idx);
    if (!rowSelectToggleOff) {
      setMiniSelectionByIndexRange(idx, idx);
    }
  });

  tbody.addEventListener("pointermove", e => {
    if (e.pointerId !== rowSelectPointerId) return;
    if (!(e.buttons & 1)) return;

    if (!rowSelectPointerCaptured) {
      const dx = e.clientX - rowSelectStartX;
      const dy = e.clientY - rowSelectStartY;
      if (Math.hypot(dx, dy) < ROW_SELECT_DRAG_THRESHOLD) return;

      rowSelectPointerCaptured = true;
      rowSelectRangeMode = true;
      rowSelectToggleOff = false;
      tbody.setPointerCapture(e.pointerId);
      document.body.classList.add("row-drag-selecting");
    }

    const currentIdx = getRowIndexAtPoint(e.clientX, e.clientY);
    if (currentIdx === -1) return;
    setMiniSelectionByIndexRange(rowSelectAnchorIndex, currentIdx);
  });

  function endRowPointerSelect(e) {
    if (e.pointerId !== rowSelectPointerId) return;

    if (!rowSelectPointerCaptured) {
      if (rowSelectToggleOff) {
        clearMiniSelection();
      } else if (rowSelectAnchorIndex >= 0) {
        setMiniSelectionByIndexRange(rowSelectAnchorIndex, rowSelectAnchorIndex);
        miniSelectClickAnchorIndex = rowSelectAnchorIndex;
      }
    } else if (rowSelectAnchorIndex >= 0) {
      miniSelectClickAnchorIndex = rowSelectAnchorIndex;
    }

    if (rowSelectPointerCaptured && tbody.hasPointerCapture(e.pointerId)) {
      tbody.releasePointerCapture(e.pointerId);
    }

    rowSelectPointerId = null;
    rowSelectAnchorIndex = -1;
    rowSelectRangeMode = false;
    rowSelectToggleOff = false;
    rowSelectPointerCaptured = false;
    document.body.classList.remove("row-drag-selecting");
  }

  tbody.addEventListener("pointerup", endRowPointerSelect);
  tbody.addEventListener("pointercancel", endRowPointerSelect);

  document.addEventListener("mousedown", e => {
    if (rowSelectPointerId !== null) return;
    if (e.target.closest("#tableBody")) return;
    if (e.target.closest("#poPackingPane, #poMultiCartonModal")) return;
    if (e.target.closest(".column-filter-popover, .cell-select-dropdown, .cell-date-popover, .header-menu-dropdown")) return;
    clearMiniSelection();
  });

  document.addEventListener("keydown", e => {
    if (isTypingInField(e.target)) return;

    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      if (miniSelectedIndices.size !== 1) return;
      if (document.querySelector(".modal-backdrop.open")) return;
      if (typeof isPoTableViewActive === "function" && !isPoTableViewActive()) return;
      const delta = e.key === "ArrowUp" ? -1 : 1;
      if (moveSingleMiniSelection(delta)) e.preventDefault();
      return;
    }

    if (e.key !== " " && e.code !== "Space") return;
    if (miniSelectedIndices.size === 0) return;
    e.preventDefault();
    toggleMiniSelectedCheckboxState();
  });

  document.querySelector(".table-scroll-y")?.addEventListener(
    "scroll",
    updateCheckboxSelectAntsOverlay,
    { passive: true }
  );
  window.addEventListener("resize", updateCheckboxSelectAntsOverlay, { passive: true });
}

function updateModalIfOpen() {
  if (modalRow && document.getElementById("modalOverlay")?.classList.contains("open")) {
    renderModalContent(modalRow);
  }
  if (typeof updatePackingPaneIfOpen === "function") updatePackingPaneIfOpen();
}

function refreshModalPackingQtyDisplay(row) {
  if (!row) return;
  const sizeBody = document.querySelector("#modalOverlay .modal-size-grid-body");
  if (sizeBody) renderSizeGridBody(sizeBody, row);
}

function closePackingListPanelInModal(row) {
  if (typeof closePoModalMenu === "function") closePoModalMenu();
  packingListPanelOpen = false;
  document.querySelector("#modalOverlay .modal-layout")?.classList.remove("modal-layout--packing-open");
  document.querySelector("#modalOverlay .modal-card")?.classList.remove("modal-card--packing-open");
  document.querySelector("#modalOverlay .packing-list-side-panel")?.remove();
  updateModalPackingListButton(row);
  if (typeof updatePoModalMenu === "function") updatePoModalMenu(modalRow ?? row);
  refreshModalPackingQtyDisplay(row);
}

function toggleRowFlag(row) {
  if (isAppSaving()) return;
  if (typeof isPoClosed === "function" && isPoClosed(row)) return;
  const next = !isTruthy(row["Flag"]);
  const poNumber = row["PO #"];
  row["Flag"] = next;

  const actualRow = findRowByPo(poNumber);
  if (actualRow && actualRow !== row) actualRow["Flag"] = next;

  if (modalRow && String(modalRow["PO #"]) === String(poNumber)) {
    modalRow["Flag"] = next;
    if (modalSnapshot) modalSnapshot["Flag"] = next;
    if (typeof updateModalFlagButton === "function") updateModalFlagButton(modalRow);
    if (typeof updatePoModalMenu === "function") updatePoModalMenu(modalRow);
    updateModalSaveState();
  }

  saveUpdate(poNumber, { Flag: next }, { silent: true });
  renderTable();
}

function setAllFilteredSelected(selected) {
  const next = toSheetBool(selected);
  let changed = false;
  filteredRows.forEach(row => {
    if (isTruthy(row["Selected"]) === next) return;
    row["Selected"] = next;
    changed = true;
  });
  if (!changed) return;
  renderTable();
  if (typeof onPoSelectionChanged === "function") onPoSelectionChanged();
}

function updateSelectAllHeader() {
  const cb = document.getElementById("selectAllRowsCheckbox");
  if (!cb) return;

  if (filteredRows.length === 0) {
    cb.checked = false;
    cb.indeterminate = false;
    cb.disabled = true;
    updateRowCounter();
    return;
  }

  cb.disabled = false;
  const selectedCount = getFilteredSelectedCount();
  cb.checked = selectedCount === filteredRows.length;
  cb.indeterminate = selectedCount > 0 && selectedCount < filteredRows.length;
  updateRowCounter();
  if (typeof onPoSelectionChanged === "function") onPoSelectionChanged();
}

function updateFlagFilterHeaderState() {
  const th = document.querySelector('th.th-flag-col[data-col="Flag"]');
  if (!th) return;
  th.classList.toggle("filter-active", flagFilterActive);
  th.setAttribute("aria-pressed", flagFilterActive ? "true" : "false");
  th.title = flagFilterActive ? "Show all rows" : "Show flagged only";
}

function toggleFlagFilter() {
  flagFilterActive = !flagFilterActive;
  updateFlagFilterHeaderState();
  applyFilters();
}

function initFlagFilterHeader() {
  const th = document.querySelector('th.th-flag-col[data-col="Flag"]');
  if (!th) return;
  th.setAttribute("role", "button");
  th.setAttribute("aria-pressed", "false");
  th.title = "Show flagged only";
  th.addEventListener("click", toggleFlagFilter);
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

const PACKING_LIST_ICON_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" ` +
  `fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">` +
  `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>` +
  `<path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h6"/></svg>`;
