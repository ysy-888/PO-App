const latestPackingUnitTotalsByPo = new Map();

function bindFieldInteractions(fieldEl, col, row) {
  fieldEl.dataset.col = col;

  if (col === "Flag") {
    fieldEl.classList.add("readonly", "readonly-no-select");
    return;
  }

  if (isPoFieldEditable(col, row)) {
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

  if (
    READONLY_NO_SELECT_COLS.has(col)
    || SHIPMENT_MANAGED_PO_FIELDS.has(col)
    || (col === "Ship Method" && typeof poHasShipment === "function" && poHasShipment(row))
  ) {
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
  const val = getColumnFilterRawValue(col, row);

  if (col === "Status") {
    fieldEl.innerHTML = renderStatus(val);
  } else if (col === "Flag") {
    renderFlagCell(fieldEl, row);
  } else if (DATE_FIELDS.has(col)) {
    applyDateCellDisplay(fieldEl, col, row, { context: "modal" });
  } else if (COPY_ON_CLICK_COLS.has(col)) {
    mountCopyableText(fieldEl, col, val);
  } else if ((col === "Actual Qty" || col === "Ctn Qty") && toQtyNumber(val) <= 0) {
    setDisplayText(fieldEl, EMPTY_DISPLAY);
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
  if (isPoFieldEditable(col, row) && !SELECT_EDIT_COLS.has(col)) {
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

  appendModalFieldRows(content, MODAL_ORDER_INFO_ROWS, row);
  content.appendChild(createModalFieldRow(
    ["Notes"],
    row,
    { rowClass: "modal-field-row--notes" }
  ));
  return block;
}

function createModalOrderProductSplit(row) {
  const split = document.createElement("div");
  split.className = "modal-top-split";
  split.appendChild(createModalOrderSection(row));
  split.appendChild(createModalShippingSection(row));
  return split;
}

function createModalStyleSection(row) {
  const { block, content } = createModalBlock(null);
  block.classList.add("modal-block--product", "modal-block--style-full");

  const grid = document.createElement("div");
  grid.className = "modal-style-section-grid";

  const info = document.createElement("div");
  info.className = "modal-style-info";
  info.appendChild(createModalField("Style #", row));
  info.appendChild(createModalField("Color", row));
  info.appendChild(createModalFieldRow(
    ["FOB Cost", "Price"],
    row,
    { rowClass: "modal-field-row--style-costs" }
  ));
  info.appendChild(createModalFieldRow(
    ["PO Total Cost", "Received Qty"],
    row,
    { rowClass: "modal-field-row--style-costs" }
  ));

  grid.appendChild(info);
  grid.appendChild(createModalSizeGrid(row));
  grid.appendChild(createModalStylePhotosColumn(row));
  content.appendChild(grid);
  return block;
}

/**
 * Size-breakdown grid: a Size selector, size labels as column headers, and two
 * rows of editable unit inputs (Actual Qty when a packing list exists, PO Qty
 * underneath) with a computed total per row. Edits write directly to the modal row copy.
 */
function createModalSizeGrid(row) {
  const wrap = document.createElement("div");
  wrap.className = "modal-size-grid";

  const body = document.createElement("div");
  body.className = "modal-size-grid-body";
  body.addEventListener("input", e => handleSizeGridInput(e.target, row));
  body.addEventListener("keydown", handleSizeGridKeydown);
  wrap.appendChild(body);

  renderSizeGridBody(body, row);
  return wrap;
}

function renderSizeGridBody(body, row) {
  body.innerHTML = "";
  const labels = getSizeLabelsFromRow(row);

  if (labels.length === 0) {
    const hint = document.createElement("p");
    hint.className = "modal-size-grid-hint";
    hint.textContent = "No size breakdown available for this PO.";
    body.appendChild(hint);
    return;
  }

  const colCount = labels.length;
  const chart = document.createElement("div");
  chart.className = "modal-size-chart";
  chart.style.setProperty("--size-col-count", String(colCount));

  const rowHead = document.createElement("div");
  rowHead.className = "modal-size-rowhead modal-size-rowhead--blank";
  chart.appendChild(rowHead);

  labels.forEach(label => {
    const head = document.createElement("div");
    head.className = "modal-size-colhead";
    head.textContent = label;
    chart.appendChild(head);
  });

  const totalHead = document.createElement("div");
  totalHead.className = "modal-size-totalhead";
  totalHead.textContent = "Total";
  chart.appendChild(totalHead);

  const packingActualUnits = getPackingUnitsForStyleChart(row);
  const hasPackingActualUnits = packingActualUnits.some(qty => toQtyNumber(qty) > 0);
  const showPackingVariance = hasPackingActualUnits || hasPackingList(row["PO #"]);
  const actTotalCell = showPackingVariance
    ? buildSizeGridRow(chart, row, "Actual Qty", packingActualUnits, colCount, "act")
    : null;
  const poTotalCell = buildSizeGridRow(chart, row, "PO Qty", PO_UNIT_FIELDS, colCount, "po");
  if (showPackingVariance) buildSizeVarianceRow(chart, colCount);
  body.appendChild(chart);

  refreshSizeGridTotals(row, poTotalCell, actTotalCell, packingActualUnits);
  if (showPackingVariance) refreshSizeGridVariance(row, chart, packingActualUnits);
}

function buildSizeGridRow(chart, row, label, unitFields, colCount, rowType) {
  const head = document.createElement("div");
  head.className = "modal-size-rowhead";
  head.textContent = label;
  chart.appendChild(head);

  for (let i = 0; i < colCount; i++) {
    const field = unitFields[i];
    if (rowType === "act") {
      const cell = document.createElement("div");
      cell.className = "modal-size-static";
      cell.dataset.index = String(i);
      cell.dataset.rowType = rowType;
      const qty = toQtyNumber(unitFields[i]);
      cell.textContent = qty > 0 ? String(qty) : "";
      chart.appendChild(cell);
      continue;
    }

    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.inputMode = "numeric";
    input.className = "modal-size-input";
    input.placeholder = "–";
    input.value = isEmptyValue(row[field]) ? "" : String(row[field]);
    input.dataset.field = field;
    input.dataset.rowType = rowType;
    chart.appendChild(input);
  }

  const totalCell = document.createElement("div");
  totalCell.className = `modal-size-total modal-size-total--${rowType}`;
  chart.appendChild(totalCell);

  return totalCell;
}

function buildSizeVarianceRow(chart, colCount) {
  const head = document.createElement("div");
  head.className = "modal-size-rowhead modal-size-rowhead--variance";
  head.textContent = "Difference %";
  chart.appendChild(head);

  for (let i = 0; i < colCount; i++) {
    const cell = document.createElement("div");
    cell.className = "modal-size-variance";
    cell.dataset.index = String(i);
    chart.appendChild(cell);
  }

  const totalCell = document.createElement("div");
  totalCell.className = "modal-size-variance modal-size-variance--total";
  chart.appendChild(totalCell);
}

function formatSizeGridTotal(qty) {
  const n = toQtyNumber(qty);
  return n > 0 ? String(n) : "";
}

function getPackingUnitsForStyleChart(row) {
  const poNumber = String(row?.["PO #"] ?? "").trim();
  const activeEditor = document.querySelector("#modalOverlay .packing-list-side-panel .packing-list-editor");
  if (
    packingListPanelOpen &&
    poNumber &&
    String(modalRow?.["PO #"] ?? "").trim() === poNumber &&
    typeof activeEditor?.__getPackingCartons === "function"
  ) {
    return computePackingTotalsByUnit(activeEditor.__getPackingCartons());
  }
  return latestPackingUnitTotalsByPo.get(poNumber) ?? getPackingUnitTotalsForPo(poNumber);
}

function refreshSizeGridTotals(row, poTotalCell, actTotalCell, packingActualUnits = getPackingUnitsForStyleChart(row)) {
  if (poTotalCell) poTotalCell.textContent = formatSizeGridTotal(computePoQtyFromUnits(row));
  if (actTotalCell) {
    actTotalCell.textContent = formatSizeGridTotal(
      packingActualUnits.reduce((sum, qty) => sum + toQtyNumber(qty), 0)
    );
  }
}

function setSizeVarianceCell(cell, value) {
  cell.classList.remove("modal-size-variance--ok", "modal-size-variance--warn");
  if (!Number.isFinite(value)) {
    cell.textContent = "";
    cell.classList.remove("empty-display");
    return;
  }

  cell.classList.remove("empty-display");
  cell.textContent = formatQtyVariancePercent(value);
  cell.classList.add(value <= 10 ? "modal-size-variance--ok" : "modal-size-variance--warn");
}

function refreshSizeGridVariance(row, chartEl, packingActualUnits = getPackingUnitsForStyleChart(row)) {
  chartEl.querySelectorAll(".modal-size-variance[data-index]").forEach(cell => {
    const index = Number(cell.dataset.index);
    const value = computeQtyVariancePercent(row[PO_UNIT_FIELDS[index]], packingActualUnits[index]);
    setSizeVarianceCell(cell, value);

    const actualCell = chartEl.querySelector(
      `[data-row-type="act"][data-index="${index}"]`
    );
    if (actualCell) {
      actualCell.classList.toggle("modal-size-input--variance-warn", Number.isFinite(value) && value > 10);
    }
  });

  const totalCell = chartEl.querySelector(".modal-size-variance--total");
  if (totalCell) {
    setSizeVarianceCell(
      totalCell,
      computeQtyVariancePercent(
        computePoQtyFromUnits(row),
        packingActualUnits.reduce((sum, qty) => sum + toQtyNumber(qty), 0)
      )
    );
  }
}

function handleSizeGridInput(target, row) {
  if (!(target instanceof HTMLInputElement)) return;
  const field = target.dataset.field;
  if (!field) return;
  const raw = target.value.trim();
  row[field] = raw === "" ? "" : String(toQtyNumber(raw));
  syncQtyTotalsForRow(row);

  const chartEl = target.closest(".modal-size-chart");
  if (chartEl) {
    const poTotal = chartEl.querySelector(".modal-size-total--po");
    const actTotal = chartEl.querySelector(".modal-size-total--act");
    refreshSizeGridTotals(row, poTotal, actTotal);
    if (hasPackingList(row["PO #"])) refreshSizeGridVariance(row, chartEl);
  }
  updateModalSaveState();
}

function handleSizeGridKeydown(e) {
  if (e.key !== "Enter") return;
  const target = e.target;
  if (!(target instanceof HTMLInputElement)) return;

  const rowType = target.dataset.rowType;
  if (!rowType) return;

  e.preventDefault();
  const chartEl = target.closest(".modal-size-chart");
  if (!chartEl) {
    target.blur();
    return;
  }

  const rowInputs = Array.from(
    chartEl.querySelectorAll(`.modal-size-input[data-row-type="${rowType}"]`)
  );
  const currentIndex = rowInputs.indexOf(target);
  const nextInput = rowInputs[currentIndex + 1];
  if (nextInput instanceof HTMLInputElement) {
    nextInput.focus();
    nextInput.select();
  } else {
    target.blur();
  }
}

function createModalActualDateRow(row) {
  const actualCols = ["EXF", "IHD"];
  if (shouldShowAssignDate(row)) actualCols.push("Assign Date");
  const actualRow = createModalFieldRow(
    actualCols,
    row,
    { dateSlot: true, rowClass: "modal-field-row--date-grid" }
  );
  if (!shouldShowAssignDate(row)) {
    const spacer = document.createElement("div");
    spacer.className = "modal-field modal-field--date modal-field--date-spacer";
    spacer.setAttribute("aria-hidden", "true");
    actualRow.appendChild(spacer);
  }
  return actualRow;
}

function createModalShippingTopRow(row) {
  const rowEl = document.createElement("div");
  rowEl.className = "modal-field-row modal-field-row--ship-po-date";
  rowEl.appendChild(createModalField("Ship Method", row));
  rowEl.appendChild(createModalField("PO Date", row, { dateSlot: true }));
  return rowEl;
}

function createModalStaticField(col, row) {
  const fieldWrap = document.createElement("div");
  fieldWrap.className = "modal-static-field";
  fieldWrap.dataset.col = col;

  const labelEl = document.createElement("span");
  labelEl.className = "modal-static-label";
  labelEl.textContent = getColumnLabel(col);

  const valueEl = document.createElement("span");
  valueEl.className = "modal-static-value";
  if (isEmptyValue(row[col])) {
    valueEl.textContent = EMPTY_DISPLAY;
    valueEl.classList.add("empty-display");
  } else {
    valueEl.textContent = row[col];
  }

  fieldWrap.appendChild(labelEl);
  fieldWrap.appendChild(valueEl);
  return fieldWrap;
}

function createModalFreightInfo(row) {
  const wrap = document.createElement("div");
  wrap.className = "modal-freight-info";
  ["Vessel", "House #", "Shipped", "ETD", "ETA"].forEach(col => {
    wrap.appendChild(createModalStaticField(col, row));
  });
  return wrap;
}

function createModalShippingSection(row) {
  const block = document.createElement("section");
  block.className = "modal-block modal-block--shipping";

  const content = document.createElement("div");
  content.className = "modal-block-content modal-shipping-body";

  const datesCol = document.createElement("div");
  datesCol.className = "modal-shipping-dates";
  datesCol.appendChild(createModalShippingTopRow(row));
  datesCol.appendChild(createModalFieldRow(
    ["EST EXF", "EST IHD", "CXL Date"],
    row,
    { dateSlot: true, rowClass: "modal-field-row--date-grid" }
  ));
  datesCol.appendChild(createModalActualDateRow(row));

  const productionCol = document.createElement("div");
  productionCol.className = "modal-production-inline";
  appendModalFieldRows(productionCol, MODAL_PRODUCTION_ROWS, row);

  const detailGrid = document.createElement("div");
  detailGrid.className = "modal-shipping-production-grid";
  detailGrid.appendChild(datesCol);
  detailGrid.appendChild(productionCol);
  content.appendChild(detailGrid);

  block.appendChild(content);
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

function createChargebackInput(field, value = "") {
  let input;
  if (field === "Status") {
    input = document.createElement("select");
    CHARGEBACK_STATUSES.forEach(status => {
      const opt = document.createElement("option");
      opt.value = status;
      opt.textContent = status;
      input.appendChild(opt);
    });
    input.value = value || CHARGEBACK_STATUSES[0];
  } else if (field === "Reason") {
    input = document.createElement("select");
    CHARGEBACK_REASONS.forEach(reason => {
      const opt = document.createElement("option");
      opt.value = reason;
      opt.textContent = reason;
      input.appendChild(opt);
    });
    input.value = CHARGEBACK_REASONS.includes(value) ? value : CHARGEBACK_REASONS[0];
  } else if (field === "Amount") {
    input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "0.01";
    input.inputMode = "decimal";
    input.value = isEmptyValue(value) ? "" : String(value);
  } else {
    input = document.createElement("input");
    input.type = "text";
    input.value = isEmptyValue(value) ? "" : String(value);
  }

  input.className = "chargeback-input";
  input.dataset.field = field;
  input.setAttribute("aria-label", field);
  return input;
}

function readChargebackForm(rowEl) {
  const data = {};
  rowEl.querySelectorAll("[data-field]").forEach(input => {
    data[input.dataset.field] = input.value.trim();
  });
  return data;
}

function isValidChargebackAmount(value) {
  const n = Number(String(value ?? "").replace(/[$,]/g, ""));
  return Number.isFinite(n) && n > 0;
}

function setChargebackError(sourceEl, message) {
  if (setModalFooterMessage(message, message ? "error" : "", { persist: Boolean(message) })) return;
  if (message) showIndicator(message, "error");
}

function validateChargebackForm(rowEl, chargeback) {
  if (!isValidChargebackAmount(chargeback.Amount)) {
    setChargebackError(rowEl, "Chargeback amount must be greater than $0");
    return false;
  }
  setChargebackError(rowEl, "");
  return true;
}

function createChargebackTextCell(field, value) {
  const cell = document.createElement("div");
  cell.className = `chargeback-text chargeback-text--${field.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  if (field === "Amount") {
    cell.textContent = formatChargebackAmount(value);
  } else if (field === "Date") {
    cell.textContent = isEmptyValue(value) ? EMPTY_DISPLAY : formatDateForDisplay(value);
  } else {
    cell.textContent = isEmptyValue(value) ? EMPTY_DISPLAY : String(value);
  }
  if (isEmptyValue(cell.textContent) || cell.textContent === EMPTY_DISPLAY) {
    cell.classList.add("empty-display");
  }
  return cell;
}

function createChargebackBlankCell(field) {
  const cell = document.createElement("div");
  cell.className = `chargeback-text chargeback-text--${field.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return cell;
}

function getChargebacksBlockFromEl(el) {
  return el.closest(".modal-block--chargebacks");
}

function isChargebackEditActive(block) {
  return Boolean(block?.classList.contains("chargebacks--mutating"));
}

function setChargebackEditActive(block, active) {
  block?.classList.toggle("chargebacks--mutating", active);
}

function createChargebackRow(chargeback, poNumber, { editing = false } = {}) {
  const rowEl = document.createElement("div");
  rowEl.className = "chargeback-row" + (editing ? " chargeback-row--editing" : "");
  rowEl.dataset.chargebackId = getChargebackId(chargeback);

  if (editing) {
    rowEl.appendChild(createChargebackTextCell("Date", chargeback["Date"]));
    ["Reason", "Amount", "Notes", "Status"].forEach(field => {
      rowEl.appendChild(createChargebackInput(field, chargeback[field]));
    });
  } else {
    ["Date", "Reason", "Amount", "Notes", "Status"].forEach(field => {
      rowEl.appendChild(createChargebackTextCell(field, chargeback[field]));
    });
  }

  const actions = document.createElement("div");
  actions.className = "chargeback-actions";

  if (editing) {
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "btn btn-secondary chargeback-action-btn chargeback-save-btn";
    saveBtn.textContent = "Save";
    saveBtn.addEventListener("click", () => saveChargebackRow(rowEl, poNumber));

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn btn-secondary chargeback-action-btn chargeback-cancel-btn";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => {
      setChargebackError(rowEl, "");
      refreshChargebacksForPo(poNumber);
    });

    actions.appendChild(saveBtn);
    actions.appendChild(cancelBtn);
  } else {
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn btn-secondary chargeback-action-btn chargeback-edit-btn";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => {
      const block = getChargebacksBlockFromEl(rowEl);
      if (isChargebackEditActive(block)) return;
      setChargebackEditActive(block, true);
      rowEl.replaceWith(createChargebackRow(chargeback, poNumber, { editing: true }));
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn btn-secondary chargeback-action-btn chargeback-delete-btn";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => deleteChargebackRow(rowEl, poNumber));

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
  }
  rowEl.appendChild(actions);
  return rowEl;
}

function createChargebackAddRow(poNumber) {
  const rowEl = document.createElement("div");
  rowEl.className = "chargeback-row chargeback-row--new";
  rowEl.appendChild(createChargebackBlankCell("Date"));
  rowEl.appendChild(createChargebackInput("Reason", ""));
  rowEl.appendChild(createChargebackInput("Amount", ""));

  const notesWrap = document.createElement("div");
  notesWrap.className = "chargeback-notes-actions";
  notesWrap.appendChild(createChargebackInput("Notes", ""));

  const actions = document.createElement("div");
  actions.className = "chargeback-actions";
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "btn btn-secondary chargeback-action-btn chargeback-add-btn";
  addBtn.textContent = "Save";
  addBtn.addEventListener("click", () => addChargebackRow(rowEl, poNumber));
  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "btn btn-secondary chargeback-action-btn chargeback-cancel-btn";
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", () => {
    const block = getChargebacksBlockFromEl(rowEl);
    setChargebackError(rowEl, "");
    rowEl.remove();
    removeChargebackGridHeadersIfEmpty(block);
    setChargebackEditActive(block, false);
    block?.querySelector(".chargeback-new-btn")?.removeAttribute("hidden");
  });
  actions.appendChild(addBtn);
  actions.appendChild(cancelBtn);
  notesWrap.appendChild(actions);
  rowEl.appendChild(notesWrap);

  rowEl.appendChild(createChargebackBlankCell("Status"));
  return rowEl;
}

function appendChargebackGridHeaders(grid) {
  if (!grid || grid.querySelector(".chargeback-grid-head")) return;
  ["Date", "Reason", "Amount", "Notes", "Status", ""].forEach(label => {
    const head = document.createElement("div");
    head.className = "chargeback-grid-head";
    head.textContent = label;
    grid.appendChild(head);
  });
}

function removeChargebackGridHeadersIfEmpty(block) {
  const grid = block?.querySelector(".chargebacks-grid");
  if (!grid || grid.querySelector(".chargeback-row")) return;
  grid.querySelectorAll(".chargeback-grid-head").forEach(head => head.remove());
}

const CARTON_WEIGHT_FIELD = "Carton Weight";

const PACKING_LIST_DELETE_ICON_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">` +
  `<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>` +
  `<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;

function clonePackingCarton(carton, fallbackIndex) {
  const out = { "Carton #": carton?.["Carton #"] || fallbackIndex + 1 };
  for (let i = 1; i <= QTY_UNIT_COUNT; i++) {
    out[`Unit ${i}`] = carton?.[`Unit ${i}`] ?? "";
  }
  out[CARTON_WEIGHT_FIELD] = carton?.[CARTON_WEIGHT_FIELD] ?? "";
  return out;
}

function normalizePackingEditorCartons(cartons, count) {
  const next = [];
  for (let i = 0; i < count; i++) {
    next.push(clonePackingCarton(cartons[i], i));
  }
  return next;
}

function formatPackingListTotal(qty) {
  const n = toQtyNumber(qty);
  return n > 0 ? String(n) : "";
}

function computePackingWeightTotal(cartons) {
  return cartons.reduce((sum, carton) => sum + toQtyNumber(carton[CARTON_WEIGHT_FIELD]), 0);
}

function formatPackingWeightTotal(weight) {
  const n = toQtyNumber(weight);
  return n > 0 ? `${n} lbs` : "";
}

function setPackingEditorTotals(container, row, cartons) {
  const totals = computePackingTotalsByUnit(cartons);
  const totalQty = totals.reduce((sum, qty) => sum + qty, 0);
  container.querySelectorAll(".packing-list-total-cell[data-index]").forEach(cell => {
    const index = Number(cell.dataset.index);
    cell.textContent = formatPackingListTotal(totals[index] || 0);
  });
  const grandTotal = container.querySelector(".packing-list-grand-total");
  if (grandTotal) grandTotal.textContent = formatPackingListTotal(totalQty);
  const weightSummary = container.querySelector(".packing-list-weight-summary");
  if (weightSummary) weightSummary.textContent = formatPackingWeightTotal(computePackingWeightTotal(cartons));
}

function createPackingListEditor(row, packingList, sourceCartons) {
  const labels = getSizeLabelsFromRow(row);
  const editor = document.createElement("div");
  editor.className = "packing-list-editor";
  const initialCount = Math.max(1, Number(packingList?.["Carton Count"] || sourceCartons.length || 1));
  let cartons = normalizePackingEditorCartons(sourceCartons, initialCount);

  const controls = document.createElement("div");
  controls.className = "packing-list-controls";

  const headingWrap = document.createElement("div");
  headingWrap.className = "packing-list-editor-heading";

  const heading = document.createElement("h4");
  heading.className = "packing-list-editor-title";
  heading.textContent = "Packing List";

  headingWrap.appendChild(heading);
  if (packingList) {
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn btn-icon packing-list-delete-icon-btn";
    deleteBtn.setAttribute("aria-label", "Delete packing list");
    deleteBtn.innerHTML = PACKING_LIST_DELETE_ICON_SVG;
    deleteBtn.addEventListener("click", () => deletePackingListFromPanel(row, packingList));
    headingWrap.appendChild(deleteBtn);
  }

  const controlsRight = document.createElement("div");
  controlsRight.className = "packing-list-controls-right";

  const countLabel = document.createElement("label");
  countLabel.className = "packing-list-count-label";
  const countText = document.createElement("span");
  countText.className = "packing-list-count-text";
  countText.textContent = "Cartons";

  const countStepper = document.createElement("div");
  countStepper.className = "packing-list-count-stepper";

  const countDecrease = document.createElement("button");
  countDecrease.type = "button";
  countDecrease.className = "packing-list-count-step packing-list-count-step--minus";
  countDecrease.setAttribute("aria-label", "Fewer cartons");
  countDecrease.textContent = "−";

  const countInput = document.createElement("input");
  countInput.type = "number";
  countInput.min = "1";
  countInput.step = "1";
  countInput.className = "packing-list-count-input";
  countInput.value = String(initialCount);
  countInput.setAttribute("aria-label", "Carton count");

  const countIncrease = document.createElement("button");
  countIncrease.type = "button";
  countIncrease.className = "packing-list-count-step packing-list-count-step--plus";
  countIncrease.setAttribute("aria-label", "More cartons");
  countIncrease.textContent = "+";

  countStepper.append(countDecrease, countInput, countIncrease);
  countLabel.append(countText, countStepper);

  const countBlock = document.createElement("div");
  countBlock.className = "packing-list-count-block";
  const weightSummary = document.createElement("div");
  weightSummary.className = "packing-list-weight-summary";
  weightSummary.setAttribute("aria-live", "polite");
  countBlock.append(countLabel, weightSummary);

  function adjustCartonCount(delta) {
    const next = Math.max(1, Math.floor(Number(countInput.value) || 1) + delta);
    countInput.value = String(next);
    renderGrid();
    updateModalSaveState();
  }

  countDecrease.addEventListener("click", () => adjustCartonCount(-1));
  countIncrease.addEventListener("click", () => adjustCartonCount(1));

  controlsRight.appendChild(countBlock);

  controls.appendChild(headingWrap);
  controls.appendChild(controlsRight);
  editor.appendChild(controls);

  const gridPanel = document.createElement("div");
  gridPanel.className = "packing-list-grid-panel";
  const totalColShade = document.createElement("div");
  totalColShade.className = "packing-list-total-col-shade";
  totalColShade.setAttribute("aria-hidden", "true");
  gridPanel.appendChild(totalColShade);
  const headGrid = document.createElement("div");
  headGrid.className = "packing-list-grid packing-list-grid--head";
  const bodyScroll = document.createElement("div");
  bodyScroll.className = "packing-list-grid-scroll";
  const bodyGrid = document.createElement("div");
  bodyGrid.className = "packing-list-grid packing-list-grid--body";
  bodyScroll.appendChild(bodyGrid);
  gridPanel.appendChild(headGrid);
  gridPanel.appendChild(bodyScroll);
  editor.appendChild(gridPanel);

  function updateTotalColShade() {
    const topCell = headGrid.querySelector(".packing-list-grand-total");
    if (!topCell) {
      totalColShade.hidden = true;
      return;
    }
    const panelRect = gridPanel.getBoundingClientRect();
    const topRect = topCell.getBoundingClientRect();
    const bottomRect = bodyScroll.getBoundingClientRect();
    totalColShade.hidden = false;
    totalColShade.style.left = `${topRect.left - panelRect.left}px`;
    totalColShade.style.width = `${topRect.width}px`;
    totalColShade.style.top = `${topRect.top - panelRect.top}px`;
    totalColShade.style.height = `${Math.max(0, bottomRect.bottom - topRect.top)}px`;
  }

  function renderGrid() {
    headGrid.innerHTML = "";
    bodyGrid.innerHTML = "";
    const count = Math.max(1, Math.floor(Number(countInput.value) || 1));
    countInput.value = String(count);
    cartons = normalizePackingEditorCartons(cartons, count);
    const colCount = labels.length;
    headGrid.style.setProperty("--size-col-count", String(colCount));
    bodyGrid.style.setProperty("--size-col-count", String(colCount));

    const blankHead = document.createElement("div");
    blankHead.className = "packing-list-rowhead packing-list-rowhead--blank";
    headGrid.appendChild(blankHead);
    labels.forEach(label => {
      const head = document.createElement("div");
      head.className = "packing-list-colhead";
      head.textContent = label;
      headGrid.appendChild(head);
    });
    const totalHead = document.createElement("div");
    totalHead.className = "packing-list-totalhead packing-list-totalhead--hidden";
    totalHead.setAttribute("aria-hidden", "true");
    headGrid.appendChild(totalHead);

    const weightHead = document.createElement("div");
    weightHead.className = "packing-list-weighthead packing-list-weighthead--hidden";
    weightHead.setAttribute("aria-hidden", "true");
    headGrid.appendChild(weightHead);

    const totalsLabel = document.createElement("div");
    totalsLabel.className = "packing-list-rowhead packing-list-rowhead--carton";
    totalsLabel.textContent = "ctn";
    headGrid.appendChild(totalsLabel);
    labels.forEach((_, index) => {
      const cell = document.createElement("div");
      cell.className = "packing-list-static packing-list-total-cell";
      cell.dataset.index = String(index);
      headGrid.appendChild(cell);
    });
    const grandTotal = document.createElement("div");
    grandTotal.className = "packing-list-total packing-list-grand-total";
    headGrid.appendChild(grandTotal);

    const totalsWeightBlank = document.createElement("div");
    totalsWeightBlank.className = "packing-list-weight-blank";
    headGrid.appendChild(totalsWeightBlank);

    cartons.forEach((carton, cartonIndex) => {
      const rowHead = document.createElement("div");
      rowHead.className = "packing-list-rowhead packing-list-rowhead--carton";
      rowHead.textContent = String(cartonIndex + 1);
      bodyGrid.appendChild(rowHead);

      labels.forEach((_, unitIndex) => {
        const field = `Unit ${unitIndex + 1}`;
        const input = document.createElement("input");
        input.type = "number";
        input.min = "0";
        input.inputMode = "numeric";
        input.className = "packing-list-input";
        input.placeholder = EN_DASH;
        input.value = isEmptyValue(carton[field]) ? "" : String(carton[field]);
        input.dataset.cartonIndex = String(cartonIndex);
        input.dataset.field = field;
        bodyGrid.appendChild(input);
      });

      const rowTotal = document.createElement("div");
      rowTotal.className = "packing-list-total packing-list-row-total";
      rowTotal.dataset.cartonIndex = String(cartonIndex);
      rowTotal.textContent = formatPackingListTotal(computeCartonTotal(carton));
      bodyGrid.appendChild(rowTotal);

      const weightField = document.createElement("div");
      weightField.className = "packing-list-weight-field";
      const weightInput = document.createElement("input");
      weightInput.type = "number";
      weightInput.min = "0";
      weightInput.step = "0.01";
      weightInput.inputMode = "decimal";
      weightInput.className = "packing-list-input packing-list-weight-input";
      weightInput.placeholder = EN_DASH;
      weightInput.value = isEmptyValue(carton[CARTON_WEIGHT_FIELD]) ? "" : String(carton[CARTON_WEIGHT_FIELD]);
      weightInput.dataset.cartonIndex = String(cartonIndex);
      weightInput.dataset.field = CARTON_WEIGHT_FIELD;
      const weightSuffix = document.createElement("span");
      weightSuffix.className = "packing-list-weight-suffix";
      weightSuffix.textContent = "lbs";
      weightField.append(weightInput, weightSuffix);
      bodyGrid.appendChild(weightField);
    });

    setPackingEditorTotals(editor, row, cartons);
    requestAnimationFrame(updateTotalColShade);
  }

  countInput.addEventListener("change", renderGrid);
  countInput.addEventListener("input", updateModalSaveState);
  gridPanel.addEventListener("input", e => {
    const target = e.target;
    if (!(target instanceof HTMLInputElement)) return;
    setChargebackError(editor, "");
    const cartonIndex = Number(target.dataset.cartonIndex);
    const field = target.dataset.field;
    if (!field || !Number.isFinite(cartonIndex)) return;
    cartons[cartonIndex][field] = target.value.trim() === "" ? "" : String(toQtyNumber(target.value));
    if (field === CARTON_WEIGHT_FIELD) {
      setPackingEditorTotals(editor, row, cartons);
    } else {
      const rowTotal = bodyGrid.querySelector(`.packing-list-row-total[data-carton-index="${cartonIndex}"]`);
      if (rowTotal) rowTotal.textContent = formatPackingListTotal(computeCartonTotal(cartons[cartonIndex]));
      setPackingEditorTotals(editor, row, cartons);
    }
    updateModalSaveState();
  });
  gridPanel.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;
    const target = e.target;
    if (!(target instanceof HTMLInputElement)) return;
    e.preventDefault();
    target.blur();
  });

  renderGrid();
  editor.__getPackingCartons = () => cartons;
  editor.__packingList = packingList;
  return editor;
}

function focusPackingListCartonInput() {
  const cartonInput = document.querySelector("#modalOverlay .packing-list-side-panel .packing-list-count-input");
  if (cartonInput instanceof HTMLInputElement) {
    cartonInput.focus();
    cartonInput.select();
  }
}

function updateModalPackingListButton(row) {
  const btn = document.getElementById("modalPackingListBtn");
  if (!btn) return;
  btn.hidden = packingListPanelOpen;
  if (packingListPanelOpen) return;
  const poNumber = String(row["PO #"] ?? "").trim();
  btn.textContent = getPackingListForPo(poNumber) ? "Edit Packing List" : "Add Packing List";
  btn.onclick = () => {
    packingListPanelOpen = true;
    updateModalIfOpen();
    requestAnimationFrame(focusPackingListCartonInput);
  };
}

function createPackingListSidePanel(row) {
  const poNumber = String(row["PO #"] ?? "").trim();
  const packingList = getPackingListForPo(poNumber);
  const cartons = packingList ? getPackingCartonsForList(getPackingListId(packingList)) : [];

  const panel = document.createElement("aside");
  panel.className = "packing-list-side-panel";
  panel.appendChild(createPackingListEditor(row, packingList, cartons));
  return panel;
}

function createModalChargebacksSection(row) {
  const poNumber = String(row["PO #"] ?? "").trim();
  const block = document.createElement("section");
  block.className = "modal-block modal-block--chargebacks";

  const header = document.createElement("div");
  header.className = "chargebacks-header";
  const title = document.createElement("h4");
  title.className = "modal-section-title chargebacks-title";
  title.textContent = "Chargebacks";

  header.appendChild(title);
  const chargebackTotal = getChargebackTotalForPo(poNumber);
  if (chargebackTotal > 0) {
    const total = document.createElement("span");
    total.className = "chargebacks-total";
    total.textContent = formatChargebackAmount(chargebackTotal);
    header.appendChild(total);
  }
  block.appendChild(header);

  const grid = document.createElement("div");
  grid.className = "chargebacks-grid";

  const poChargebacks = getChargebacksForPo(poNumber);
  if (poChargebacks.length > 0) appendChargebackGridHeaders(grid);
  poChargebacks.forEach(chargeback => {
    grid.appendChild(createChargebackRow(chargeback, poNumber));
  });

  block.appendChild(grid);
  const newBtn = document.createElement("button");
  newBtn.type = "button";
  newBtn.className = "btn btn-secondary chargeback-action-btn chargeback-new-btn";
  newBtn.textContent = "+ New Chargeback";
  newBtn.addEventListener("click", () => {
    if (isChargebackEditActive(block)) return;
    setChargebackEditActive(block, true);
    appendChargebackGridHeaders(grid);
    grid.appendChild(createChargebackAddRow(poNumber));
    newBtn.hidden = true;
  });
  block.appendChild(newBtn);
  return block;
}

function createModalFieldRow(cols, row, options = {}) {
  const rowEl = document.createElement("div");
  rowEl.className = "modal-field-row";
  if (options.rowClass) {
    rowEl.classList.add(options.rowClass);
  } else if (cols.length === 2) {
    rowEl.classList.add("modal-field-row--2");
  } else if (cols.length === 3) {
    rowEl.classList.add("modal-field-row--3");
  }
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

function createModalStylePhotosColumn(row) {
  const wrap = document.createElement("div");
  wrap.className = "modal-style-photos-column";

  const category = document.createElement("div");
  category.className = "modal-style-category";

  const value = document.createElement("span");
  value.className = "modal-style-category-value";
  const categoryValue = getColumnFilterRawValue("Style Category", row);
  setDisplayText(
    value,
    isEmptyValue(categoryValue) ? EMPTY_DISPLAY : String(categoryValue)
  );

  category.appendChild(value);
  wrap.appendChild(category);
  wrap.appendChild(createStylePhotoPlaceholders());
  return wrap;
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

function syncPackingListPanelOpenForRow(row) {
  if (hasPackingList(row?.["PO #"])) {
    packingListPanelOpen = true;
  }
}

function renderModalContent(row) {
  syncPackingListPanelOpenForRow(row);

  const poNumEl = document.getElementById("modalPoNum");
  const flagEl = document.getElementById("modalFlagBtn");
  const bodyEl = document.getElementById("modalBody");
  if (!poNumEl || !flagEl || !bodyEl) return;

  const poNum = isEmptyValue(row["PO #"]) ? EMPTY_DISPLAY : row["PO #"];
  poNumEl.className = "modal-po-num";
  poNumEl.onclick = null;
  if (COPY_ON_CLICK_COLS.has("PO #") && !isEmptyValue(row["PO #"])) {
    mountCopyableText(poNumEl, "PO #", row["PO #"]);
  } else {
    setDisplayText(poNumEl, poNum);
  }

  flagEl.replaceChildren(createPoFlagButton(row));

  if (typeof renderPoModalLinkedShipment === "function") {
    renderPoModalLinkedShipment(row);
  }
  updateModalPackingListButton(row);

  bodyEl.innerHTML = "";

  const layout = document.createElement("div");
  layout.className = "modal-layout";
  layout.classList.toggle("modal-layout--packing-open", packingListPanelOpen);

  const main = document.createElement("div");
  main.className = "modal-layout-main";

  main.appendChild(createModalOrderProductSplit(row));
  main.appendChild(createModalStyleSection(row));
  main.appendChild(createModalChargebacksSection(row));

  layout.appendChild(main);
  if (packingListPanelOpen) {
    layout.appendChild(createPackingListSidePanel(row));
  }
  bodyEl.appendChild(layout);
  updateModalSaveState();
}

function shouldIgnoreRowDblClick(e) {
  const target = e.target;
  if (!(target instanceof Element)) return false;

  return Boolean(target.closest(
    "input, textarea, select, button, .cell-select-dropdown, .po-flag-btn, .td-select-cell, .select-cell, .editing, [data-editing='active'], .shipment-id-link"
  ));
}

function openPODetail(row) {
  if (isAppSaving()) return;
  closeCellSelectDropdown(false);
  packingListPanelOpen = hasPackingList(row?.["PO #"]);
  modalRow = snapshotModalRow(row);
  modalSnapshot = snapshotModalRow(row);
  renderModalContent(modalRow);
  if (typeof bringModalToFront === "function") {
    bringModalToFront(document.getElementById("modalOverlay"));
  } else {
    document.getElementById("modalOverlay").classList.add("open");
  }
}

function closeModal(event) {
  if (isDirectBackdropClick(event, document.getElementById("modalOverlay"))) {
    cancelModalChanges();
  }
}

function dismissModalOverlay() {
  closeCellSelectDropdown(false);
  modalRow = null;
  modalSnapshot = null;
  packingListPanelOpen = false;
  clearModalFooterMessageForOverlay("modalOverlay");
  document.getElementById("modalOverlay")?.classList.remove("open");
  updateModalSaveState();
}

function refreshChargebacksForPo(poNumber) {
  if (!modalRow || String(modalRow["PO #"]) !== String(poNumber)) return;
  updateModalIfOpen();
  if (typeof refreshChargebacksView === "function") refreshChargebacksView();
}

function upsertLocalPackingList(poNumber, packingListId, packingList, cartons) {
  const now = formatDateToYmd(new Date());
  const existing = allPackingLists.find(item => getPackingListPoNumber(item) === String(poNumber));
  const nextPackingList = {
    ...(existing || {}),
    [PACKING_LIST_ID_FIELD]: packingListId,
    "PO #": poNumber,
    "Carton Count": packingList["Carton Count"],
    "Notes": packingList["Notes"] || "",
    "Created At": existing?.["Created At"] || now,
    "Updated At": now,
  };

  if (existing) {
    Object.assign(existing, nextPackingList);
  } else {
    allPackingLists.push(nextPackingList);
  }

  allPackingCartons = allPackingCartons.filter(carton =>
    String(carton?.[PACKING_LIST_ID_FIELD] ?? "").trim() !== String(packingListId)
  );
  cartons.forEach(carton => {
    allPackingCartons.push({ [PACKING_LIST_ID_FIELD]: packingListId, ...carton });
  });
  invalidatePackingIndex();
}

async function deletePackingListFromPanel(row, packingList) {
  if (isAppSaving()) return;
  const packingListId = getPackingListId(packingList);
  const poNumber = String(row["PO #"] ?? "").trim();
  if (!packingListId && !poNumber) return;
  if (!confirm("Delete this packing list?")) return;

  if (isDemoMode()) {
    allPackingLists = allPackingLists.filter(item => getPackingListId(item) !== packingListId);
    allPackingCartons = allPackingCartons.filter(carton =>
      String(carton?.[PACKING_LIST_ID_FIELD] ?? "").trim() !== packingListId
    );
    invalidatePackingIndex();
    closePackingListPanelInModal(row);
    renderTable();
    showIndicator("Packing list deleted", "success");
    return;
  }

  setAppSaving(true, "Deleting packing list...");
  try {
    const json = await postAppsScript({
      action: "deletePackingList",
      packingListId,
      poNumber,
    });
    if (!json.success) throw new Error(json.error);
    allPackingLists = allPackingLists.filter(item => getPackingListId(item) !== packingListId);
    allPackingCartons = allPackingCartons.filter(carton =>
      String(carton?.[PACKING_LIST_ID_FIELD] ?? "").trim() !== packingListId
    );
    invalidatePackingIndex();
    closePackingListPanelInModal(row);
    renderTable();
    showIndicator("Packing list deleted", "success");
  } catch (err) {
    showIndicator("Packing list delete failed: " + err.message, "error");
  } finally {
    setAppSaving(false);
  }
}

function normalizePackingCartonsForSave(editorCartons) {
  return editorCartons.map((carton, index) => {
    const out = { "Carton #": index + 1 };
    for (let i = 1; i <= QTY_UNIT_COUNT; i++) {
      const field = `Unit ${i}`;
      const qty = toQtyNumber(carton[field]);
      out[field] = qty || "";
    }
    out["Total Units"] = computeCartonTotal(out);
    const weightRaw = String(carton[CARTON_WEIGHT_FIELD] ?? "").trim();
    out[CARTON_WEIGHT_FIELD] = weightRaw === "" ? "" : String(toQtyNumber(weightRaw));
    return out;
  });
}

function getActivePackingListPayload() {
  const editor = document.querySelector("#modalOverlay .packing-list-side-panel .packing-list-editor");
  if (!packingListPanelOpen || !modalRow || !editor || typeof editor.__getPackingCartons !== "function") return null;
  return {
    editor,
    row: modalRow,
    existingPackingList: editor.__packingList || getPackingListForPo(modalRow["PO #"]),
    cartons: normalizePackingCartonsForSave(editor.__getPackingCartons()),
  };
}

async function persistPackingListPayload({ editor, row, existingPackingList, cartons }, poEditUpdates = {}) {
  const poNumber = normalizePoNumber(row["PO #"]);
  if (!poNumber) return null;

  if (cartons.some(carton => computeCartonTotal(carton) <= 0)) {
    setChargebackError(editor, "A carton quantity cannot be zero.");
    return null;
  }

  const filteredPoUpdates = filterAppsScriptPoUpdates(poEditUpdates);
  const packingList = {
    "Carton Count": cartons.length,
    "Notes": existingPackingList?.["Notes"] || "",
  };
  const packingPoUpdates = buildPackingPoUpdatesFromCartons(cartons, cartons.length);

  if (isDemoMode()) {
    const packingListId = getPackingListId(existingPackingList) || generateDemoPackingListId();
    upsertLocalPackingList(poNumber, packingListId, packingList, cartons);
    latestPackingUnitTotalsByPo.set(poNumber, computePackingTotalsByUnit(cartons));
    const mergedUpdates = { ...filteredPoUpdates, ...packingPoUpdates };
    Object.assign(row, mergedUpdates);
    applyModalUpdatesToTableRow(poNumber, mergedUpdates);
    return mergedUpdates;
  }

  const json = await postAppsScript({
    action: "savePackingList",
    poNumber,
    packingList,
    cartons,
    updates: filteredPoUpdates,
  });
  if (!json.success) throw new Error(json.error);
  const packingListId = json.packingListId || getPackingListId(existingPackingList);
  upsertLocalPackingList(poNumber, packingListId, packingList, cartons);
  latestPackingUnitTotalsByPo.set(poNumber, computePackingTotalsByUnit(cartons));
  const poUpdates = json.poUpdates || { ...filteredPoUpdates, ...packingPoUpdates };
  Object.assign(row, poUpdates);
  applyModalUpdatesToTableRow(poNumber, poUpdates);
  return poUpdates;
}

async function addChargebackRow(rowEl, poNumber) {
  if (isAppSaving()) return;
  const chargeback = readChargebackForm(rowEl);
  chargeback.Status = chargeback.Status || CHARGEBACK_STATUSES[0];
  if (!validateChargebackForm(rowEl, chargeback)) return;
  if (isEmptyValue(chargeback.Amount) && isEmptyValue(chargeback.Reason) && isEmptyValue(chargeback.Notes)) {
    showIndicator("Add chargeback details first", "error");
    return;
  }

  if (isDemoMode()) {
    allChargebacks.push({
      [CHARGEBACK_ID_FIELD]: generateDemoChargebackId(),
      "PO #": poNumber,
      "Date": formatDateToYmd(new Date()),
      ...chargeback,
    });
    showIndicator("Chargeback added", "success");
    refreshChargebacksForPo(poNumber);
    return;
  }

  setAppSaving(true, "Adding chargeback...");
  try {
    const json = await postAppsScript({ action: "createChargeback", poNumber, chargeback });
    if (!json.success) throw new Error(json.error);
    allChargebacks.push({
      [CHARGEBACK_ID_FIELD]: json.chargebackId,
      "PO #": poNumber,
      "Date": formatDateToYmd(new Date()),
      ...chargeback,
    });
    showIndicator("Chargeback added", "success");
    refreshChargebacksForPo(poNumber);
  } catch (err) {
    showIndicator("Chargeback add failed: " + err.message, "error");
  } finally {
    setAppSaving(false);
  }
}

async function saveChargebackRow(rowEl, poNumber) {
  if (isAppSaving()) return;
  const chargebackId = rowEl.dataset.chargebackId;
  const chargeback = readChargebackForm(rowEl);
  if (!chargebackId) return;
  if (!validateChargebackForm(rowEl, chargeback)) return;

  if (isDemoMode()) {
    const existing = allChargebacks.find(item => getChargebackId(item) === chargebackId);
    if (existing) Object.assign(existing, chargeback);
    showIndicator("Chargeback saved", "success");
    refreshChargebacksForPo(poNumber);
    return;
  }

  setAppSaving(true, "Saving chargeback...");
  try {
    const json = await postAppsScript({ action: "updateChargeback", chargebackId, chargeback });
    if (!json.success) throw new Error(json.error);
    const existing = allChargebacks.find(item => getChargebackId(item) === chargebackId);
    if (existing) Object.assign(existing, chargeback);
    showIndicator("Chargeback saved", "success");
    refreshChargebacksForPo(poNumber);
  } catch (err) {
    showIndicator("Chargeback save failed: " + err.message, "error");
  } finally {
    setAppSaving(false);
  }
}

async function deleteChargebackRow(rowEl, poNumber) {
  if (isAppSaving()) return;
  const chargebackId = rowEl.dataset.chargebackId;
  if (!chargebackId) return;

  if (isDemoMode()) {
    allChargebacks = allChargebacks.filter(item => getChargebackId(item) !== chargebackId);
    showIndicator("Chargeback deleted", "success");
    refreshChargebacksForPo(poNumber);
    return;
  }

  setAppSaving(true, "Deleting chargeback...");
  try {
    const json = await postAppsScript({ action: "deleteChargeback", chargebackId });
    if (!json.success) throw new Error(json.error);
    allChargebacks = allChargebacks.filter(item => getChargebackId(item) !== chargebackId);
    showIndicator("Chargeback deleted", "success");
    refreshChargebacksForPo(poNumber);
  } catch (err) {
    showIndicator("Chargeback delete failed: " + err.message, "error");
  } finally {
    setAppSaving(false);
  }
}

function cancelModalChanges() {
  if (isAppSaving()) return;
  commitActiveModalEditor();
  dismissModalOverlay();
}

function applyModalUpdatesToTableRow(poNumber, updates) {
  const actualRow = findRowByPo(poNumber);
  if (!actualRow) return;
  Object.assign(actualRow, updates);
}

async function saveModalChanges() {
  if (isAppSaving() || !modalRow || !modalSnapshot) return;
  commitActiveModalEditor();

  const updates = getModalPendingUpdates();
  const packingPayload = getActivePackingListPayload();
  if (Object.keys(updates).length === 0 && !packingPayload) {
    dismissModalOverlay();
    return;
  }

  const poNumber = modalRow["PO #"];
  setAppSaving(true, "Saving…");
  try {
    if (packingPayload) {
      const savedPackingUpdates = await persistPackingListPayload(packingPayload, updates);
      if (!savedPackingUpdates) return;
      applyModalUpdatesToTableRow(poNumber, savedPackingUpdates);
      modalSnapshot = snapshotModalRow(modalRow);
      renderModalContent(modalRow);
      updateModalSaveState();
      queuePoTableRefresh();
      showIndicator(`Saved ${CHECK_MARK}`, "success");
      return;
    }

    const ok = await saveUpdate(poNumber, updates, { silent: true });
    if (!ok) {
      showIndicator("Save failed", "error");
      return;
    }
    applyModalUpdatesToTableRow(poNumber, updates);
    dismissModalOverlay();
    queuePoTableRefresh();
    showIndicator(`Saved ${CHECK_MARK}`, "success");
  } catch (err) {
    showIndicator("Save failed: " + err.message, "error");
  } finally {
    setAppSaving(false);
  }
}

function initPoModalActions() {
  bindDirectBackdropDismiss(document.getElementById("modalOverlay"), cancelModalChanges);
  document.getElementById("modalSaveBtn")?.addEventListener("click", () => {
    saveModalChanges();
  });
  document.getElementById("modalCancelBtn")?.addEventListener("click", () => {
    cancelModalChanges();
  });
  document.getElementById("modalCloseBtn")?.addEventListener("click", () => {
    cancelModalChanges();
  });
}
