const latestPackingUnitTotalsByPo = new Map();
let modalSaveInProgress = false;
let modalPackingEditorSnapshot = null;
let modalPackingListEditMode = false;

let modalPendingSubmissionId = null;
let modalPendingSubmissionDraft = null;

function isModalPendingSubmissionReview() {
  return Boolean(modalPendingSubmissionId);
}

function clearModalPendingSubmission() {
  modalPendingSubmissionId = null;
  modalPendingSubmissionDraft = null;
}

function parsePendingSubmissionCartons(submission) {
  try {
    const raw = JSON.parse(String(submission?.["Cartons JSON"] ?? "[]"));
    return Array.isArray(raw) ? raw : [];
  } catch (_e) {
    return [];
  }
}

function buildPendingSubmissionDraft(submission) {
  const cartons = parsePendingSubmissionCartons(submission);
  const cartonCount = Math.max(
    1,
    Number(submission?.["Carton Count"]) || cartons.length || 1
  );
  return {
    packingList: {
      "Carton Count": cartonCount,
      "Notes": String(submission?.["Notes"] ?? ""),
    },
    cartons,
  };
}

function isModalSaveInProgress() {
  return modalSaveInProgress;
}

function bindFieldInteractions(fieldEl, col, row) {
  fieldEl.dataset.col = col;

  if (col === "Flag" || col === "N41 Status") {
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

  // Overlay pending approval values in amber before the PO is updated
  if (col === "CXL Date" && typeof getPendingApprovalDisplay === "function") {
    const pending = getPendingApprovalDisplay(row["PO #"]);
    if (pending && pending.cxlDate) {
      fieldEl.classList.add("has-pending-approval");
      const span = document.createElement("span");
      span.className = "pending-approval-value";
      span.title = "Pending approval";
      span.textContent = formatDateForDisplay(pending.cxlDate);
      fieldEl.appendChild(span);
      return;
    }
  }

  if (col === "Status") {
    fieldEl.innerHTML = renderStatus(val);
  } else if (col === "N41 Status") {
    applyN41StatusFieldDisplay(fieldEl, row, val);
  } else if (col === "Flag") {
    renderFlagCell(fieldEl, row);
  } else if (DATE_FIELDS.has(col)) {
    applyDateCellDisplay(fieldEl, col, row, { context: "modal" });
  } else if (col === "SO #" && typeof mountSalesOrderLink === "function") {
    mountSalesOrderLink(fieldEl, val, {
      closePo: true,
      navFrom: { type: "po", id: String(row["PO #"] ?? "").trim() },
    });
  } else if (COPY_ON_CLICK_COLS.has(col)) {
    mountCopyableText(fieldEl, col, val);
  } else if ((col === "Actual Qty" || col === "Ctn Qty") && toQtyNumber(val) <= 0) {
    setDisplayText(fieldEl, EMPTY_DISPLAY);
  } else if (PO_CURRENCY_FIELDS.has(col)) {
    const formatted = formatPoCurrency(val);
    if (formatted === "") {
      setDisplayText(fieldEl, EMPTY_DISPLAY);
    } else {
      fieldEl.textContent = formatted;
      fieldEl.classList.remove("empty-display");
    }
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

function createModalPlainCurrencyField(col, row) {
  const fieldWrap = document.createElement("div");
  fieldWrap.className = `modal-field modal-field--${getModalFieldSize(col)}`;
  fieldWrap.dataset.col = col;

  const labelEl = document.createElement("label");
  labelEl.className = "modal-field-label";
  labelEl.textContent = getColumnLabel(col);

  const valueEl = document.createElement("div");
  valueEl.className = "modal-field-plain-value";
  valueEl.dataset.col = col;
  setFieldDisplayContent(valueEl, col, row);

  fieldWrap.appendChild(labelEl);
  fieldWrap.appendChild(valueEl);
  return fieldWrap;
}

function createModalStyleMetaText(col, row) {
  const wrap = document.createElement("div");
  wrap.className = "modal-style-meta-item";
  wrap.dataset.col = col;

  const labelEl = document.createElement("span");
  labelEl.className = "modal-style-meta-label";
  labelEl.textContent = getColumnLabel(col);

  const valueEl = document.createElement("span");
  valueEl.className = "modal-style-meta-value";
  valueEl.dataset.col = col;
  const value = getColumnFilterRawValue(col, row);

  if (PO_CURRENCY_FIELDS.has(col)) {
    const formatted = formatPoCurrency(value);
    setDisplayText(valueEl, formatted === "" ? EMPTY_DISPLAY : formatted);
  } else {
    setDisplayText(valueEl, isEmptyValue(value) ? EMPTY_DISPLAY : String(value));
  }

  wrap.append(labelEl, valueEl);
  return wrap;
}

function createModalStyleMetaGroup(row, cols = ["PO Total Cost"]) {
  const group = document.createElement("div");
  group.className = "modal-style-meta-group";
  cols.forEach(col => {
    group.appendChild(createModalStyleMetaText(col, row));
  });
  return group;
}

function createModalPlainStyleText(col, row) {
  const valueEl = document.createElement("span");
  valueEl.className = "modal-style-text-value";
  valueEl.dataset.col = col;
  const value = getColumnFilterRawValue(col, row);
  setDisplayText(valueEl, isEmptyValue(value) ? EMPTY_DISPLAY : String(value));
  return valueEl;
}

function createModalStyleInfoRow(row) {
  const rowEl = document.createElement("div");
  rowEl.className = "modal-style-info-row";

  const textGroup = document.createElement("div");
  textGroup.className = "modal-style-text-group";
  ["Style #", "Color", "Style Category"].forEach(col => {
    textGroup.appendChild(createModalPlainStyleText(col, row));
  });

  rowEl.appendChild(textGroup);
  return rowEl;
}

function createModalStyleCostRow(row) {
  const rowEl = document.createElement("div");
  rowEl.className = "modal-style-cost-row";
  rowEl.appendChild(createModalStyleMetaGroup(row));
  rowEl.appendChild(createModalField("FOB Cost", row));
  rowEl.appendChild(createModalField("Price", row));
  return rowEl;
}

function shouldShowAssignDate(row) {
  return String(row["Division"] ?? "").trim() === "Freesia";
}

function createModalOrderSection(row) {
  const { block, content } = createModalBlock(null);
  block.classList.add("modal-block--order");

  [
    ["Status", "N41 Status", "SO #", "Old PO #"],
    ["Division", "Buyer", "Buyer PO #"],
  ].forEach(cols => {
    content.appendChild(createModalFieldRow(
      cols,
      row,
      { rowClass: "modal-field-row--order-grid" }
    ));
  });
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

  const details = document.createElement("div");
  details.className = "modal-style-details";

  const info = document.createElement("div");
  info.className = "modal-style-info";
  info.appendChild(createModalStyleInfoRow(row));

  details.appendChild(info);

  const qtyRow = document.createElement("div");
  qtyRow.className = "modal-style-qty-row";
  qtyRow.appendChild(createModalSizeGrid(row));
  details.appendChild(qtyRow);

  grid.appendChild(details);
  grid.appendChild(createModalStylePhotosColumn(row));

  content.appendChild(grid);
  return block;
}

function createModalProductionSection(row) {
  const { block, content } = createModalBlock(null);
  block.classList.add("modal-block--production");
  appendModalFieldRows(content, MODAL_PRODUCTION_ROWS, row);
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
  applyModalSizeChartDensity(chart, colCount);

  const headRow = createSizeChartRow("modal-size-chart-row--head");
  const rowHead = document.createElement("div");
  rowHead.className = "modal-size-rowhead modal-size-rowhead--blank";
  headRow.appendChild(rowHead);

  const headValues = createSizeChartValuesWrap(headRow);
  const totalHead = document.createElement("div");
  totalHead.className = "modal-size-totalhead";
  totalHead.textContent = "Total";
  headValues.appendChild(totalHead);

  labels.forEach(label => {
    const head = document.createElement("div");
    head.className = "modal-size-colhead";
    head.textContent = label;
    headValues.appendChild(head);
  });
  chart.appendChild(headRow);

  const packingActualUnits = getPackingUnitsForStyleChart(row);
  const hasPackingActualUnits = packingActualUnits.some(qty => toQtyNumber(qty) > 0);
  const showPackingVariance = hasPackingActualUnits || hasPackingList(row["PO #"]);
  let actTotalCell = null;
  if (showPackingVariance) {
    const actRow = createSizeChartRow("modal-size-chart-row--qty");
    actTotalCell = buildSizeGridRow(actRow, row, "Actual Qty", packingActualUnits, colCount, "act");
    chart.appendChild(actRow);
  }
  const poRow = createSizeChartRow("modal-size-chart-row--qty");
  const poTotalCell = buildSizeGridRow(poRow, row, "PO Qty", PO_UNIT_FIELDS, colCount, "po");
  chart.appendChild(poRow);

  // Pending approval row — overlay proposed qty in amber while status is Pending Approval
  if (typeof getPendingApprovalDisplay === "function") {
    const pendingDisplay = getPendingApprovalDisplay(row["PO #"]);
    if (pendingDisplay?.units) {
      const pendingRow = createSizeChartRow("modal-size-chart-row--qty");
      const pendingHead = document.createElement("div");
      pendingHead.className = "modal-size-rowhead";
      setModalSizeRowheadLabel(pendingHead, "Approval Qty");
      pendingRow.appendChild(pendingHead);
      const pendingValues = createSizeChartValuesWrap(pendingRow);
      let pendingTotal = 0;
      const pendingTotalCell = document.createElement("div");
      pendingTotalCell.className = "modal-size-total modal-size-total--po modal-size-cell--pending";
      pendingValues.appendChild(pendingTotalCell);
      for (let i = 0; i < colCount; i++) {
        const cell = document.createElement("div");
        cell.className = "modal-size-static modal-size-cell--pending";
        const qty = toQtyNumber(pendingDisplay.units[`PO Unit ${i + 1}`]);
        cell.textContent = qty > 0 ? String(qty) : "";
        pendingValues.appendChild(cell);
        pendingTotal += qty;
      }
      pendingTotalCell.textContent = String(pendingTotal);
      chart.appendChild(pendingRow);
    }
  }

  if (showPackingVariance) {
    const varianceRow = createSizeChartRow("modal-size-chart-row--variance");
    buildSizeVarianceRow(varianceRow, colCount);
    chart.appendChild(varianceRow);
  }
  body.appendChild(chart);

  refreshSizeGridTotals(row, poTotalCell, actTotalCell, packingActualUnits);
  if (showPackingVariance) refreshSizeGridVariance(row, chart, packingActualUnits);
}

function applyModalSizeChartDensity(chart, colCount) {
  let unitWidth = 40;
  let gap = 8;
  let totalWidth = 44;
  if (colCount > 4) {
    unitWidth = 34;
    gap = 7;
    totalWidth = 40;
  }
  if (colCount > 6) {
    unitWidth = 28;
    gap = 6;
    totalWidth = 36;
  }
  if (colCount > 9) {
    unitWidth = 24;
    gap = 5;
    totalWidth = 32;
  }
  chart.style.setProperty("--modal-size-unit-width", `${unitWidth}px`);
  chart.style.setProperty("--modal-size-gap", `${gap}px`);
  chart.style.setProperty("--modal-size-total-width", `${totalWidth}px`);
}

function createSizeChartRow(extraClass = "") {
  const rowEl = document.createElement("div");
  rowEl.className = extraClass ? `modal-size-chart-row ${extraClass}` : "modal-size-chart-row";
  return rowEl;
}

function createSizeChartValuesWrap(rowEl) {
  const wrap = document.createElement("div");
  wrap.className = "modal-size-chart-values";
  if (rowEl.classList.contains("modal-size-chart-row--qty")) {
    wrap.classList.add("modal-size-chart-values--bar");
  }
  rowEl.appendChild(wrap);
  return wrap;
}

function setModalSizeRowheadLabel(el, label) {
  const parts = String(label ?? "").trim().split(/\s+/);
  if (parts.length !== 2) {
    el.textContent = label;
    return;
  }
  el.classList.add("modal-size-rowhead--stacked");
  parts.forEach(part => {
    const line = document.createElement("span");
    line.className = "modal-size-rowhead-line";
    line.textContent = part;
    el.appendChild(line);
  });
}

function buildSizeGridRow(rowEl, row, label, unitFields, colCount, rowType) {
  const head = document.createElement("div");
  head.className = "modal-size-rowhead";
  setModalSizeRowheadLabel(head, label);
  rowEl.appendChild(head);

  const valuesWrap = createSizeChartValuesWrap(rowEl);

  const totalCell = document.createElement("div");
  totalCell.className = `modal-size-total modal-size-total--${rowType}`;
  valuesWrap.appendChild(totalCell);

  for (let i = 0; i < colCount; i++) {
    const field = unitFields[i];
    if (rowType === "act") {
      const cell = document.createElement("div");
      cell.className = "modal-size-static";
      cell.dataset.index = String(i);
      cell.dataset.rowType = rowType;
      const qty = toQtyNumber(unitFields[i]);
      cell.textContent = qty > 0 ? String(qty) : "";
      valuesWrap.appendChild(cell);
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
    if (typeof isPoClosed === "function" && isPoClosed(row)) {
      input.readOnly = true;
      input.tabIndex = -1;
    }
    bindNumberInput(input);
    valuesWrap.appendChild(input);
  }

  return totalCell;
}

function buildSizeVarianceRow(rowEl, colCount) {
  const head = document.createElement("div");
  head.className = "modal-size-rowhead modal-size-rowhead--variance";
  rowEl.appendChild(head);

  const valuesWrap = createSizeChartValuesWrap(rowEl);

  const totalCell = document.createElement("div");
  totalCell.className = "modal-size-variance modal-size-variance--total";
  valuesWrap.appendChild(totalCell);

  for (let i = 0; i < colCount; i++) {
    const cell = document.createElement("div");
    cell.className = "modal-size-variance";
    cell.dataset.index = String(i);
    valuesWrap.appendChild(cell);
  }
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
  const poTotal = computePoQtyFromUnits(row);
  if (poTotalCell) poTotalCell.textContent = formatSizeGridTotal(poTotal);
  if (actTotalCell) {
    const actualTotal = packingActualUnits.reduce((sum, qty) => sum + toQtyNumber(qty), 0);
    actTotalCell.textContent = formatSizeGridTotal(actualTotal);
    actTotalCell.classList.toggle(
      "modal-size-total--match",
      poTotal > 0 && actualTotal === poTotal
    );
  }
}

function setSizeVarianceCell(cell, poQty, actualQty) {
  cell.classList.remove("modal-size-variance--ok", "modal-size-variance--warn");
  cell.replaceChildren();

  const po = toQtyNumber(poQty);
  const actual = toQtyNumber(actualQty);
  if (po <= 0) {
    cell.classList.remove("empty-display");
    return;
  }

  const diff = actual - po;
  if (diff === 0) {
    cell.classList.remove("empty-display");
    return;
  }

  const value = computeQtyVariancePercent(poQty, actualQty);
  if (!Number.isFinite(value)) {
    cell.classList.remove("empty-display");
    return;
  }

  cell.classList.remove("empty-display");
  cell.classList.add(value <= 10 ? "modal-size-variance--ok" : "modal-size-variance--warn");

  const chevron = document.createElement("span");
  chevron.className = `modal-size-variance-chevron modal-size-variance-chevron--${diff > 0 ? "up" : "down"}`;
  chevron.setAttribute("aria-hidden", "true");

  const valueEl = document.createElement("span");
  valueEl.className = "modal-size-variance-value";
  valueEl.textContent = formatQtyVariancePercent(value);

  cell.append(chevron, valueEl);
}

function refreshSizeGridVariance(row, chartEl, packingActualUnits = getPackingUnitsForStyleChart(row)) {
  chartEl.querySelectorAll(".modal-size-variance[data-index]").forEach(cell => {
    const index = Number(cell.dataset.index);
    setSizeVarianceCell(cell, row[PO_UNIT_FIELDS[index]], packingActualUnits[index]);
  });

  const totalCell = chartEl.querySelector(".modal-size-variance--total");
  if (totalCell) {
    setSizeVarianceCell(
      totalCell,
      computePoQtyFromUnits(row),
      packingActualUnits.reduce((sum, qty) => sum + toQtyNumber(qty), 0)
    );
  }
}

function handleSizeGridInput(target, row) {
  if (!(target instanceof HTMLInputElement)) return;
  if (typeof isPoClosed === "function" && isPoClosed(row)) return;
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
  const actualCols = ["EXF Date", "IHD"];
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

const MODAL_FREIGHT_DATE_FIELDS = new Set(["Shipped", "ETD", "ETA"]);
const MODAL_FREIGHT_FIELDS = ["Shipped", "ETD", "ETA", "Vessel", "House #"];

const MODAL_FREIGHT_REQUEST_TYPES = [
  {
    key: "asn",
    label: "ASN",
    requestedField: "ASN Requested",
    idField: ASN_REQUEST_ID_FIELD,
    openDetail: id => typeof openAsnRequestDetail === "function" && openAsnRequestDetail(id),
  },
  {
    key: "delivery",
    label: "Delivery",
    requestedField: "Delivery Requested",
    idField: DELIVERY_REQUEST_ID_FIELD,
    openDetail: id => typeof openDeliveryRequestDetail === "function" && openDeliveryRequestDetail(id),
  },
  {
    key: "pickup",
    label: "Pickup",
    requestedField: "Pickup Requested",
    idField: PICKUP_REQUEST_ID_FIELD,
    openDetail: id => typeof openPickupRequestDetail === "function" && openPickupRequestDetail(id),
  },
];

function getPoFreightData(row) {
  const shipmentId = typeof getPoShipmentId === "function" ? getPoShipmentId(row) : "";
  const shipment = shipmentId && typeof getShipmentById === "function"
    ? getShipmentById(shipmentId)
    : null;
  const source = shipment || row;
  const data = {};
  MODAL_FREIGHT_FIELDS.forEach(field => {
    data[field] = source[field];
  });
  return data;
}

function formatModalFreightValue(col, value) {
  if (isEmptyValue(value)) return EMPTY_DISPLAY;
  if (MODAL_FREIGHT_DATE_FIELDS.has(col)) return formatDateForDisplay(value);
  return String(value);
}

function createModalStaticField(col, row, { source = row } = {}) {
  const fieldWrap = document.createElement("div");
  fieldWrap.className = "modal-static-field";
  fieldWrap.dataset.col = col;

  const labelEl = document.createElement("span");
  labelEl.className = "modal-static-label";
  labelEl.textContent = getColumnLabel(col);

  const valueEl = document.createElement("span");
  valueEl.className = "modal-static-value";
  const displayValue = formatModalFreightValue(col, source[col]);
  if (displayValue === EMPTY_DISPLAY) {
    valueEl.textContent = EMPTY_DISPLAY;
    valueEl.classList.add("empty-display");
  } else {
    valueEl.textContent = displayValue;
  }

  fieldWrap.appendChild(labelEl);
  fieldWrap.appendChild(valueEl);
  return fieldWrap;
}

function createModalFreightRequestChip(row, config) {
  const requestId = String(row[config.idField] ?? "").trim();
  const requested = isTruthy(row[config.requestedField]);
  const status = requestId ? "done" : requested ? "pending" : "none";

  const chip = document.createElement("div");
  chip.className = `modal-freight-request-chip modal-freight-request-chip--${status}`;
  chip.title = config.label;

  const indicator = document.createElement("span");
  indicator.className = "modal-freight-request-indicator";
  indicator.setAttribute("aria-hidden", "true");
  indicator.textContent = status === "done" ? "\u2713" : status === "pending" ? "\u2022" : "\u2013";

  const label = document.createElement("span");
  label.className = "modal-freight-request-label";
  label.textContent = config.label;

  chip.appendChild(indicator);
  chip.appendChild(label);

  if (requestId) {
    const link = document.createElement("button");
    link.type = "button";
    link.className = "modal-freight-request-link";
    link.textContent = requestId;
    link.title = `Open ${config.label} request ${requestId}`;
    link.addEventListener("click", e => {
      e.stopPropagation();
      config.openDetail(requestId);
    });
    chip.appendChild(link);
  }

  return chip;
}

function createModalFreightRequests(row) {
  const wrap = document.createElement("div");
  wrap.className = "modal-freight-requests";
  MODAL_FREIGHT_REQUEST_TYPES.forEach(config => {
    wrap.appendChild(createModalFreightRequestChip(row, config));
  });
  return wrap;
}

function createModalFreightInfo(row) {
  const freightData = getPoFreightData(row);
  const wrap = document.createElement("div");
  wrap.className = "modal-freight-info";
  MODAL_FREIGHT_FIELDS.forEach(col => {
    wrap.appendChild(createModalStaticField(col, row, { source: freightData }));
  });
  return wrap;
}

function createModalFreightPackingTotals() {
  const wrap = document.createElement("div");
  wrap.className = "modal-freight-packing-totals";

  [
    ["unit", "Total Unit Qty"],
    ["ctn", "Total Ctn Qty"],
  ].forEach(([kind, label]) => {
    const line = document.createElement("div");
    line.className = "packing-list-total-compare";
    line.dataset.packingTotal = kind;
    line.textContent = label;
    wrap.appendChild(line);
  });

  return wrap;
}

function formatPackingQtyCompareLine(label, current, target) {
  const cur = toQtyNumber(current);
  const tgt = toQtyNumber(target);
  if (tgt > 0) return `${label}: ${cur} / ${tgt}`;
  if (cur > 0) return `${label}: ${cur}`;
  return `${label}: ${EMPTY_DISPLAY}`;
}

function refreshModalFreightPackingTotals(editor, row, cartons) {
  const wrap = editor?.querySelector(".modal-freight-packing-totals");
  if (!wrap) return;

  const unitEl = wrap.querySelector('[data-packing-total="unit"]');
  const ctnEl = wrap.querySelector('[data-packing-total="ctn"]');
  if (!unitEl || !ctnEl) return;

  const packingUnits = computePackingTotalsByUnit(cartons).reduce((sum, qty) => sum + toQtyNumber(qty), 0);
  const packingCtns = cartons.length;
  const poUnits = toQtyNumber(row["Actual Qty"]) || computePoQtyFromUnits(row);
  const poCtns = toQtyNumber(row["Ctn Qty"]);

  unitEl.textContent = formatPackingQtyCompareLine("Total Unit Qty", packingUnits, poUnits);
  ctnEl.textContent = formatPackingQtyCompareLine("Total Ctn Qty", packingCtns, poCtns);

  unitEl.classList.toggle("packing-list-total-compare--match", poUnits > 0 && packingUnits === poUnits);
  ctnEl.classList.toggle("packing-list-total-compare--match", poCtns > 0 && packingCtns === poCtns);
}

function createModalFreightSection(row, { includePackingTotals = false } = {}) {
  if (typeof poHasShipment !== "function" || !poHasShipment(row)) return null;

  const block = document.createElement("section");
  block.className = "modal-block modal-block--freight";

  const header = document.createElement("div");
  header.className = "modal-freight-header";

  const title = document.createElement("h4");
  title.className = "modal-section-title modal-freight-title";
  title.textContent = "Freight Information";
  header.appendChild(title);

  if (typeof createModalLinkedShipmentCard === "function") {
    const shipmentCard = createModalLinkedShipmentCard(row);
    if (shipmentCard) header.appendChild(shipmentCard);
  }

  const content = document.createElement("div");
  content.className = "modal-block-content modal-freight-body";
  content.appendChild(createModalFreightInfo(row));
  content.appendChild(createModalFreightRequests(row));
  if (includePackingTotals) {
    content.appendChild(createModalFreightPackingTotals());
  }

  block.appendChild(header);
  block.appendChild(content);
  return block;
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

  content.appendChild(datesCol);

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
    bindNumberInput(input);
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

let openChargebackRowMenuDropdown = null;
let chargebackRowMenuDismissBound = false;

function closeChargebackRowMenu() {
  if (!openChargebackRowMenuDropdown) return;
  openChargebackRowMenuDropdown.hidden = true;
  const btn = openChargebackRowMenuDropdown.previousElementSibling;
  btn?.setAttribute("aria-expanded", "false");
  openChargebackRowMenuDropdown = null;
}

function bindChargebackRowMenuDismiss() {
  if (chargebackRowMenuDismissBound) return;
  chargebackRowMenuDismissBound = true;
  document.addEventListener("click", closeChargebackRowMenu);
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeChargebackRowMenu();
  });
}

function createChargebackRowMenuItem(label, onSelect, { danger = false } = {}) {
  const item = document.createElement("button");
  item.type = "button";
  item.className = "chargeback-row-menu-item" + (danger ? " chargeback-row-menu-item--danger" : "");
  item.setAttribute("role", "menuitem");
  item.textContent = label;
  item.addEventListener("click", e => {
    e.stopPropagation();
    closeChargebackRowMenu();
    onSelect();
  });
  return item;
}

function createChargebackRowMenu(rowEl, poNumber, chargeback) {
  bindChargebackRowMenuDismiss();

  const wrap = document.createElement("div");
  wrap.className = "chargeback-row-menu-wrap";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn-icon-sm chargeback-row-menu-btn";
  btn.title = "More options";
  btn.setAttribute("aria-label", "Chargeback options");
  btn.setAttribute("aria-haspopup", "menu");
  btn.setAttribute("aria-expanded", "false");
  btn.innerHTML = "&#8943;";

  const dropdown = document.createElement("div");
  dropdown.className = "chargeback-row-menu-dropdown";
  dropdown.hidden = true;
  dropdown.setAttribute("role", "menu");

  dropdown.appendChild(createChargebackRowMenuItem("Edit", () => {
    const block = getChargebacksBlockFromEl(rowEl);
    if (isChargebackEditActive(block)) return;
    setChargebackEditActive(block, true);
    rowEl.replaceWith(createChargebackRow(chargeback, poNumber, { editing: true }));
  }));

  dropdown.appendChild(createChargebackRowMenuItem("Delete", () => {
    deleteChargebackRow(rowEl, poNumber);
  }, { danger: true }));

  btn.addEventListener("click", e => {
    e.stopPropagation();
    if (openChargebackRowMenuDropdown === dropdown && !dropdown.hidden) {
      closeChargebackRowMenu();
      return;
    }
    closeChargebackRowMenu();
    dropdown.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    openChargebackRowMenuDropdown = dropdown;
  });

  wrap.addEventListener("click", e => e.stopPropagation());
  wrap.appendChild(btn);
  wrap.appendChild(dropdown);
  return wrap;
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
    actions.appendChild(createChargebackRowMenu(rowEl, poNumber, chargeback));
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
    removeModalChargebacksSectionIfEmpty(poNumber);
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
const CARTON_WEIGHT_LBS_SAVE_FIELD = "Carton Weight (lbs)";
const CARTON_WEIGHT_KG_TO_LBS = 2.2046226218;

function roundCartonWeight(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function cartonWeightLbsToKg(lbs) {
  const n = toQtyNumber(lbs);
  return n > 0 ? roundCartonWeight(n / CARTON_WEIGHT_KG_TO_LBS, 6) : 0;
}

function cartonWeightKgToLbs(kg) {
  const n = toQtyNumber(kg);
  return n > 0 ? roundCartonWeight(n * CARTON_WEIGHT_KG_TO_LBS, 2) : 0;
}

function formatCartonWeightValue(value) {
  const n = toQtyNumber(value);
  return n > 0 ? String(n) : "";
}

let poModalMenuOpen = false;
let poModalMenuDismissBound = false;

function closePoModalMenu() {
  const menu = document.getElementById("modalHeaderMenuDropdown");
  const btn = document.getElementById("modalHeaderMenuBtn");
  if (menu) menu.hidden = true;
  if (btn) btn.setAttribute("aria-expanded", "false");
  poModalMenuOpen = false;
}

function bindPoModalMenuDismiss() {
  if (poModalMenuDismissBound) return;
  poModalMenuDismissBound = true;

  document.addEventListener("pointerdown", e => {
    if (!poModalMenuOpen) return;
    const wrap = document.querySelector("#modalOverlay .modal-header-menu-wrap");
    if (wrap?.contains(e.target)) return;
    closePoModalMenu();
  }, true);

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && poModalMenuOpen) closePoModalMenu();
  });
}

function createPoModalMenuItem(label, onSelect) {
  const item = document.createElement("button");
  item.type = "button";
  item.className = "header-menu-item";
  item.setAttribute("role", "menuitem");
  item.textContent = label;
  item.addEventListener("click", e => {
    e.stopPropagation();
    closePoModalMenu();
    onSelect();
  });
  return item;
}

function openModalPackingListPanel({ edit = true } = {}) {
  if (modalRow && typeof isPoClosed === "function" && isPoClosed(modalRow)) return;
  packingListPanelOpen = true;
  modalPackingListEditMode = Boolean(edit);
  updateModalIfOpen();
  if (modalPackingListEditMode) requestAnimationFrame(focusPackingListCartonInput);
}

function isModalPackingListEditable(row = modalRow) {
  if (!packingListPanelOpen) return false;
  if (isModalPendingSubmissionReview()) return true;
  if (!modalPackingListEditMode) return false;
  return !(row && typeof isPoClosed === "function" && isPoClosed(row));
}

function rebuildPoModalMenuItems(row) {
  const menu = document.getElementById("modalHeaderMenuDropdown");
  if (!menu || !row) return;
  menu.innerHTML = "";

  const poNumber = String(row["PO #"] ?? "").trim();
  const packingList = getPackingListForPo(poNumber);
  const closed = typeof isPoClosed === "function" && isPoClosed(row);

  if (!closed && !isTruthy(row["Flag"])) {
    menu.appendChild(createPoModalMenuItem("Flag PO", () => toggleRowFlag(row)));
  }
  menu.appendChild(createPoModalMenuItem("New Approval", () => {
    if (typeof openNewApprovalFromPo === "function") openNewApprovalFromPo(row);
  }));
  menu.appendChild(createPoModalMenuItem("New Chargeback", () => beginNewChargeback(row)));
  if (!closed) {
    menu.appendChild(createPoModalMenuItem(
      packingList ? "Edit Packing List" : "Add Packing List",
      () => openModalPackingListPanel({ edit: true })
    ));
  }

  if (packingList) {
    menu.appendChild(createPoModalMenuItem("Print Packing List", () => {
      if (typeof printPackingList === "function") {
        printPackingList({ poNumbers: [row["PO #"]], mode: "individual" });
      }
    }));

    if (!closed) {
      menu.appendChild(createPoModalMenuItem("Delete Packing List", () => {
        deletePackingListFromPanel(row, packingList);
      }));
    }
  }
}

function openPoModalMenu(row) {
  const menu = document.getElementById("modalHeaderMenuDropdown");
  const btn = document.getElementById("modalHeaderMenuBtn");
  if (!menu || !btn) return;
  rebuildPoModalMenuItems(row);
  menu.hidden = false;
  btn.setAttribute("aria-expanded", "true");
  poModalMenuOpen = true;
}

function updatePoModalMenu(row) {
  if (poModalMenuOpen && row) rebuildPoModalMenuItems(row);
}

function updateModalFlagButton(row) {
  const btn = document.getElementById("modalFlagBtn");
  if (!btn) return;
  const flagged = row && isTruthy(row["Flag"]);
  const closed = row && typeof isPoClosed === "function" && isPoClosed(row);
  btn.hidden = !flagged || closed;
}

function initPoModalFlagButton() {
  const btn = document.getElementById("modalFlagBtn");
  if (!btn) return;
  btn.addEventListener("click", e => {
    e.stopPropagation();
    if (!modalRow || !isTruthy(modalRow["Flag"])) return;
    toggleRowFlag(modalRow);
  });
}

function initPoModalHeaderMenu() {
  const btn = document.getElementById("modalHeaderMenuBtn");
  const menu = document.getElementById("modalHeaderMenuDropdown");
  if (!btn || !menu) return;

  btn.addEventListener("click", e => {
    e.stopPropagation();
    if (poModalMenuOpen) {
      closePoModalMenu();
      return;
    }
    if (!modalRow) return;
    openPoModalMenu(modalRow);
  });

  bindPoModalMenuDismiss();
}

function ensureModalChargebacksSection(row) {
  let block = document.querySelector("#modalOverlay .modal-block--chargebacks");
  if (block) return block;
  block = createModalChargebacksSection(row, { showEmpty: true });
  document.querySelector("#modalOverlay .modal-layout-main")?.appendChild(block);
  return block;
}

function beginNewChargeback(row) {
  const poNumber = String(row["PO #"] ?? "").trim();
  const block = ensureModalChargebacksSection(row);
  if (!block || isChargebackEditActive(block)) return;
  const grid = block.querySelector(".chargebacks-grid");
  if (!grid) return;
  setChargebackEditActive(block, true);
  appendChargebackGridHeaders(grid);
  grid.appendChild(createChargebackAddRow(poNumber));
  block.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function removeModalChargebacksSectionIfEmpty(poNumber) {
  const block = document.querySelector("#modalOverlay .modal-block--chargebacks");
  if (!block) return;
  if (getChargebacksForPo(poNumber).length > 0) return;
  if (block.querySelector(".chargeback-row")) return;
  block.remove();
}

function clonePackingCarton(carton, fallbackIndex) {
  const out = { "Carton #": carton?.["Carton #"] || fallbackIndex + 1 };
  for (let i = 1; i <= QTY_UNIT_COUNT; i++) {
    out[`Unit ${i}`] = carton?.[`Unit ${i}`] ?? "";
  }
  out[CARTON_WEIGHT_FIELD] = carton?.[CARTON_WEIGHT_FIELD] ?? "";
  out[CARTON_WEIGHT_LBS_SAVE_FIELD] = carton?.[CARTON_WEIGHT_LBS_SAVE_FIELD] ?? "";
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
  return cartons.reduce((sum, carton) => sum + getCartonWeightLbs(carton), 0);
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
  refreshModalFreightPackingTotals(container, row, cartons);
}

function openPackingDuplicateDialog() {
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.className = "packing-dup-dialog-overlay";

    const box = document.createElement("div");
    box.className = "packing-dup-dialog-box";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.addEventListener("click", e => e.stopPropagation());

    const title = document.createElement("div");
    title.className = "packing-dup-dialog-title";
    title.textContent = "Duplicate Carton";

    const field = document.createElement("div");
    field.className = "packing-dup-dialog-field";
    const inputLabel = document.createElement("label");
    inputLabel.className = "packing-dup-dialog-label";
    inputLabel.htmlFor = "packingDupCount";
    inputLabel.textContent = "Number of cartons (2–99)";
    const numInput = document.createElement("input");
    numInput.type = "number";
    numInput.id = "packingDupCount";
    numInput.className = "packing-dup-dialog-input";
    numInput.min = "2";
    numInput.max = "99";
    numInput.step = "1";
    numInput.value = "2";
    numInput.addEventListener("focus", () => numInput.select());
    field.append(inputLabel, numInput);

    const checkRow = document.createElement("label");
    checkRow.className = "packing-dup-dialog-checkbox-row";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    const checkSpan = document.createElement("span");
    checkSpan.textContent = "Insert rows";
    checkRow.append(checkbox, checkSpan);

    const footer = document.createElement("div");
    footer.className = "modal-footer";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn btn-sm";
    cancelBtn.textContent = "Cancel";
    const okBtn = document.createElement("button");
    okBtn.type = "button";
    okBtn.className = "btn btn-primary btn-sm";
    okBtn.textContent = "OK";
    footer.append(cancelBtn, okBtn);

    box.append(title, field, checkRow, footer);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => { numInput.focus(); numInput.select(); });

    function cleanup(result) {
      overlay.remove();
      resolve(result);
    }

    function submit() {
      const n = Math.round(Number(numInput.value));
      if (!Number.isFinite(n) || n < 2 || n > 99) {
        numInput.focus();
        numInput.select();
        return;
      }
      cleanup({ count: n, insert: checkbox.checked });
    }

    cancelBtn.addEventListener("click", () => cleanup(null));
    okBtn.addEventListener("click", submit);
    overlay.addEventListener("click", () => cleanup(null));
    overlay.addEventListener("keydown", e => {
      if (e.key === "Escape") { e.preventDefault(); cleanup(null); }
      if (e.key === "Enter") { e.preventDefault(); submit(); }
    });
  });
}

function createPackingListEditor(row, packingList, sourceCartons, { editable = false } = {}) {
  const labels = getSizeLabelsFromRow(row);
  const readOnly = !editable || (typeof isPoClosed === "function" && isPoClosed(row));
  const editor = document.createElement("div");
  editor.className = "packing-list-editor" + (readOnly ? " packing-list-editor--readonly" : "");
  const draftCount = modalPendingSubmissionDraft?.packingList?.["Carton Count"];
  const initialCount = Math.max(
    1,
    Number(packingList?.["Carton Count"] || draftCount || sourceCartons.length || 1)
  );
  let cartons = normalizePackingEditorCartons(sourceCartons, initialCount);

  const controls = document.createElement("div");
  controls.className = "packing-list-controls";

  const headingWrap = document.createElement("div");
  headingWrap.className = "packing-list-editor-heading";

  const heading = document.createElement("h4");
  heading.className = "packing-list-editor-title";
  heading.textContent = "Packing List";

  headingWrap.appendChild(heading);

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
  bindNumberInput(countInput);

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
    if (readOnly) return;
    const next = Math.max(1, Math.floor(Number(countInput.value) || 1) + delta);
    countInput.value = String(next);
    renderGrid();
    updateModalSaveState();
  }

  countDecrease.addEventListener("click", () => adjustCartonCount(-1));
  countIncrease.addEventListener("click", () => adjustCartonCount(1));
  if (readOnly) {
    countDecrease.disabled = true;
    countIncrease.disabled = true;
    countInput.readOnly = true;
  }

  controlsRight.appendChild(countBlock);
  controlsRight.querySelectorAll(".packing-list-total-compare, .packing-list-header-total").forEach(el => el.remove());

  controls.appendChild(headingWrap);
  controls.appendChild(controlsRight);
  editor.appendChild(controls);

  const gridPanel = document.createElement("div");
  gridPanel.className = "packing-list-grid-panel";
  const gridWrap = document.createElement("div");
  gridWrap.className = "packing-list-grid-wrap";
  const headGrid = document.createElement("div");
  headGrid.className = "packing-list-grid packing-list-grid--head";
  const bodyScroll = document.createElement("div");
  bodyScroll.className = "packing-list-grid-scroll";
  const bodyGrid = document.createElement("div");
  bodyGrid.className = "packing-list-grid packing-list-grid--body";
  bodyScroll.appendChild(bodyGrid);
  gridWrap.appendChild(headGrid);
  gridWrap.appendChild(bodyScroll);
  gridPanel.appendChild(gridWrap);
  editor.appendChild(gridPanel);

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
    const totalHead = document.createElement("div");
    totalHead.className = "packing-list-totalhead";
    totalHead.textContent = "Total";
    headGrid.appendChild(totalHead);
    labels.forEach((label, index) => {
      const head = document.createElement("div");
      head.className = "packing-list-colhead";
      head.textContent = label;
      headGrid.appendChild(head);
    });

    const weightHead = document.createElement("div");
    weightHead.className = "packing-list-weighthead packing-list-weighthead--hidden";
    weightHead.setAttribute("aria-hidden", "true");
    headGrid.appendChild(weightHead);

    const actionSpacerHead = document.createElement("div");
    actionSpacerHead.setAttribute("aria-hidden", "true");
    headGrid.appendChild(actionSpacerHead);

    const totalsLabel = document.createElement("div");
    totalsLabel.className = "packing-list-rowhead packing-list-rowhead--blank";
    headGrid.appendChild(totalsLabel);
    const grandTotal = document.createElement("div");
    grandTotal.className = "packing-list-total packing-list-grand-total";
    headGrid.appendChild(grandTotal);
    labels.forEach((_, index) => {
      const cell = document.createElement("div");
      cell.className = "packing-list-static packing-list-total-cell";
      cell.dataset.index = String(index);
      headGrid.appendChild(cell);
    });

    const totalsWeightBlank = document.createElement("div");
    totalsWeightBlank.className = "packing-list-weight-blank";
    headGrid.appendChild(totalsWeightBlank);

    const actionSpacerTotals = document.createElement("div");
    actionSpacerTotals.setAttribute("aria-hidden", "true");
    headGrid.appendChild(actionSpacerTotals);

    const totalsDivider = document.createElement("div");
    totalsDivider.className = "packing-list-grid-divider packing-list-grid-divider--horizontal";
    totalsDivider.setAttribute("aria-hidden", "true");
    headGrid.appendChild(totalsDivider);

    cartons.forEach((carton, cartonIndex) => {
      const gridRow = document.createElement("div");
      gridRow.className = "packing-list-grid-row";

      const rowHead = document.createElement("div");
      rowHead.className = "packing-list-rowhead packing-list-rowhead--carton";
      rowHead.textContent = String(cartonIndex + 1);
      gridRow.appendChild(rowHead);

      const rowTotal = document.createElement("div");
      rowTotal.className = "packing-list-total packing-list-row-total";
      rowTotal.dataset.cartonIndex = String(cartonIndex);
      rowTotal.textContent = formatPackingListTotal(computeCartonTotal(carton));
      gridRow.appendChild(rowTotal);

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
        if (readOnly) input.readOnly = true;
        bindNumberInput(input);
        gridRow.appendChild(input);
      });

      const weightField = document.createElement("div");
      weightField.className = "packing-list-weight-field";
      const weightInner = document.createElement("div");
      weightInner.className = "packing-list-weight-inner";
      const weightInput = document.createElement("input");
      weightInput.type = "number";
      weightInput.min = "0";
      weightInput.step = "0.01";
      weightInput.inputMode = "decimal";
      weightInput.className = "packing-list-weight-input";
      weightInput.placeholder = EN_DASH;
      weightInput.value = (() => {
        const lbs = getCartonWeightLbs(carton);
        return lbs > 0 ? String(lbs) : "";
      })();
      weightInput.dataset.cartonIndex = String(cartonIndex);
      weightInput.dataset.field = CARTON_WEIGHT_FIELD;
      if (readOnly) weightInput.readOnly = true;
      bindNumberInput(weightInput);
      const weightSuffix = document.createElement("span");
      weightSuffix.className = "packing-list-weight-suffix";
      weightSuffix.textContent = "lbs";
      weightInner.append(weightInput, weightSuffix);
      weightField.appendChild(weightInner);
      gridRow.appendChild(weightField);

      const actionCell = document.createElement("div");
      actionCell.className = "packing-list-action-cell";
      if (!readOnly) {
        const dupBtn = document.createElement("button");
        dupBtn.type = "button";
        dupBtn.className = "packing-list-dup-btn";
        dupBtn.title = "Duplicate carton";
        dupBtn.setAttribute("aria-label", "Duplicate carton");
        dupBtn.dataset.cartonIndex = String(cartonIndex);
        dupBtn.textContent = "⧉";
        actionCell.appendChild(dupBtn);
      }
      gridRow.appendChild(actionCell);

      bodyGrid.appendChild(gridRow);
    });

    setPackingEditorTotals(editor, row, cartons);
  }

  function parsePackingClipboardTable(text) {
    const normalized = String(text ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const withoutTrailingNewline = normalized.endsWith("\n") ? normalized.slice(0, -1) : normalized;
    return withoutTrailingNewline.split("\n").map(line => line.split("\t"));
  }

  function normalizePackingPastedQty(value) {
    const raw = String(value ?? "").trim();
    if (raw === "") return "";
    const n = Number(raw.replace(/,/g, ""));
    return Number.isFinite(n) && n >= 0 ? String(n) : null;
  }

  function getPackingUnitIndex(field) {
    const match = /^Unit (\d+)$/.exec(String(field ?? ""));
    return match ? Number(match[1]) - 1 : -1;
  }

  function refreshPackingQtyRows(cartonIndexes) {
    cartonIndexes.forEach(cartonIndex => {
      const rowTotal = bodyGrid.querySelector(`.packing-list-row-total[data-carton-index="${cartonIndex}"]`);
      if (rowTotal) rowTotal.textContent = formatPackingListTotal(computeCartonTotal(cartons[cartonIndex]));
    });
    setPackingEditorTotals(editor, row, cartons);
    updateModalSaveState();
  }

  function writePackingQtyInput(input, value, { updateInputValue = false } = {}) {
    const cartonIndex = Number(input.dataset.cartonIndex);
    const field = input.dataset.field;
    if (!field || !Number.isInteger(cartonIndex) || !cartons[cartonIndex]) return null;
    if (getPackingUnitIndex(field) < 0) return null;
    cartons[cartonIndex][field] = value;
    if (updateInputValue) input.value = value;
    return cartonIndex;
  }

  function handlePackingListPaste(e) {
    if (readOnly) return;
    const target = e.target;
    if (!(target instanceof HTMLInputElement) || !target.classList.contains("packing-list-input")) return;
    const clipboardText = e.clipboardData?.getData("text/plain") ?? "";
    if (!clipboardText || !/[\t\r\n]/.test(clipboardText)) return;

    const startCartonIndex = Number(target.dataset.cartonIndex);
    const startUnitIndex = getPackingUnitIndex(target.dataset.field);
    if (!Number.isInteger(startCartonIndex) || startUnitIndex < 0) return;

    e.preventDefault();
    setChargebackError(editor, "");

    const changedCartonIndexes = new Set();
    parsePackingClipboardTable(clipboardText).forEach((cells, rowOffset) => {
      const cartonIndex = startCartonIndex + rowOffset;
      if (!cartons[cartonIndex]) return;
      cells.forEach((cellValue, colOffset) => {
        const unitIndex = startUnitIndex + colOffset;
        if (unitIndex >= labels.length) return;
        const normalizedValue = normalizePackingPastedQty(cellValue);
        if (normalizedValue === null) return;
        const input = bodyGrid.querySelector(
          `.packing-list-input[data-carton-index="${cartonIndex}"][data-field="Unit ${unitIndex + 1}"]`
        );
        if (!(input instanceof HTMLInputElement)) return;
        const changedCartonIndex = writePackingQtyInput(input, normalizedValue, { updateInputValue: true });
        if (changedCartonIndex !== null) changedCartonIndexes.add(changedCartonIndex);
      });
    });

    if (changedCartonIndexes.size > 0) refreshPackingQtyRows(changedCartonIndexes);
  }

  countInput.addEventListener("change", renderGrid);
  countInput.addEventListener("input", updateModalSaveState);
  gridPanel.addEventListener("paste", handlePackingListPaste);
  gridPanel.addEventListener("click", async e => {
    if (readOnly) return;
    const btn = e.target.closest(".packing-list-dup-btn");
    if (!btn) return;
    const R = Number(btn.dataset.cartonIndex);
    if (!Number.isFinite(R) || R < 0 || R >= cartons.length) return;

    const result = await openPackingDuplicateDialog();
    if (!result) return;

    const { count: n, insert } = result;
    const copies = n - 1;
    const source = clonePackingCarton(cartons[R], R);

    if (insert) {
      const newRows = Array.from({ length: copies }, (_, k) => clonePackingCarton(source, R + 1 + k));
      cartons.splice(R + 1, 0, ...newRows);
    } else {
      const needed = R + 1 + copies;
      while (cartons.length < needed) cartons.push(clonePackingCarton(null, cartons.length));
      for (let k = 0; k < copies; k++) {
        cartons[R + 1 + k] = clonePackingCarton(source, R + 1 + k);
      }
    }

    countInput.value = String(cartons.length);
    renderGrid();
    updateModalSaveState();
  });
  gridPanel.addEventListener("input", e => {
    if (readOnly) return;
    const target = e.target;
    if (!(target instanceof HTMLInputElement)) return;
    setChargebackError(editor, "");
    const cartonIndex = Number(target.dataset.cartonIndex);
    const field = target.dataset.field;
    if (!field || !Number.isFinite(cartonIndex)) return;
    if (field === CARTON_WEIGHT_FIELD) {
      const weightRaw = target.value.trim();
      const weightLbs = toQtyNumber(weightRaw);
      cartons[cartonIndex][CARTON_WEIGHT_LBS_SAVE_FIELD] = weightRaw === "" ? "" : formatCartonWeightValue(weightLbs);
      cartons[cartonIndex][CARTON_WEIGHT_FIELD] = weightRaw === "" ? "" : formatCartonWeightValue(cartonWeightLbsToKg(weightLbs));
      setPackingEditorTotals(editor, row, cartons);
      updateModalSaveState();
    } else {
      const changedCartonIndex = writePackingQtyInput(
        target,
        target.value.trim() === "" ? "" : String(toQtyNumber(target.value))
      );
      if (changedCartonIndex !== null) refreshPackingQtyRows(new Set([changedCartonIndex]));
    }
  });

  function focusNextPackingListRowInput(input) {
    const currentRow = input.closest(".packing-list-grid-row");
    const nextRow = currentRow?.nextElementSibling;
    const nextInput = nextRow?.querySelector(".packing-list-input:not(.packing-list-weight-input)");
    if (nextInput instanceof HTMLInputElement) {
      nextInput.focus();
      nextInput.select();
      return;
    }

    const saveBtn = document.getElementById("modalSaveBtn");
    if (saveBtn instanceof HTMLButtonElement) saveBtn.focus();
  }

  gridPanel.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;
    const target = e.target;
    if (!(target instanceof HTMLInputElement)) return;
    e.preventDefault();
    if (readOnly) {
      target.blur();
      return;
    }
    focusNextPackingListRowInput(target);
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

function updateModalPackingListButton() {
  const btn = document.getElementById("modalPackingListBtn");
  if (!btn) return;
  btn.hidden = true;
  btn.onclick = null;
}

function createPackingListSidePanel(row) {
  const poNumber = String(row["PO #"] ?? "").trim();
  let packingList = getPackingListForPo(poNumber);
  let cartons = packingList ? getPackingCartonsForList(getPackingListId(packingList)) : [];

  if (modalPendingSubmissionDraft) {
    packingList = null;
    cartons = modalPendingSubmissionDraft.cartons;
  }

  const panel = document.createElement("aside");
  panel.className = "packing-list-side-panel";

  const editor = createPackingListEditor(row, packingList, cartons, {
    editable: isModalPackingListEditable(row),
  });
  panel.appendChild(editor);
  return panel;
}

function createModalChargebacksSection(row, { showEmpty = false } = {}) {
  const poNumber = String(row["PO #"] ?? "").trim();
  const poChargebacks = getChargebacksForPo(poNumber);
  if (poChargebacks.length === 0 && !showEmpty) return null;

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

  if (poChargebacks.length > 0) appendChargebackGridHeaders(grid);
  poChargebacks.forEach(chargeback => {
    grid.appendChild(createChargebackRow(chargeback, poNumber));
  });

  block.appendChild(grid);
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

  wrap.appendChild(createModalStylePhotos(row));
  return wrap;
}

function isStylePhotoUrl(url) {
  return /^https?:\/\/.+/i.test(url);
}

function getStylePhotoMaxDimensions(contextEl) {
  const style = getComputedStyle(contextEl || document.getElementById("modalOverlay") || document.documentElement);
  const maxW = parseFloat(style.getPropertyValue("--po-modal-photo-max-width")) || 204;
  const maxH = parseFloat(style.getPropertyValue("--po-modal-photo-max-height")) || 340;
  return { maxW, maxH };
}

function applyStylePhotoImageSize(img) {
  const { maxW, maxH } = getStylePhotoMaxDimensions(img);
  const naturalW = img.naturalWidth;
  const naturalH = img.naturalHeight;
  if (!naturalW || !naturalH) return;

  const scale = Math.min(1, maxW / naturalW, maxH / naturalH);
  img.style.width = `${Math.round(naturalW * scale)}px`;
  img.style.height = `${Math.round(naturalH * scale)}px`;
}

function bindStylePhotoImageSizing(img) {
  const apply = () => applyStylePhotoImageSize(img);
  if (img.complete && img.naturalWidth) {
    apply();
    return;
  }
  img.addEventListener("load", apply, { once: true });
}

function renderStylePhotoSlot(photoEl, url, photoIndex) {
  photoEl.innerHTML = "";
  photoEl.classList.remove("modal-style-photo--has-image", "modal-style-photo--error");

  const normalizedUrl = normalizeStylePhotoUrl(url);
  const openUrl = String(url ?? "").trim() || normalizedUrl;

  if (isStylePhotoUrl(normalizedUrl)) {
    photoEl.classList.add("modal-style-photo--has-image");
    const img = document.createElement("img");
    img.className = "modal-style-photo-img";
    img.src = normalizedUrl;
    img.alt = `Style photo ${photoIndex}`;
    img.loading = "lazy";
    img.title = "Open in new tab";
    img.addEventListener("click", e => {
      e.stopPropagation();
      window.open(openUrl, "_blank", "noopener,noreferrer");
    });
    bindStylePhotoImageSizing(img);
    img.addEventListener("error", () => {
      photoEl.classList.remove("modal-style-photo--has-image");
      photoEl.classList.add("modal-style-photo--error");
      img.remove();
      const label = document.createElement("span");
      label.className = "modal-style-photo-label";
      label.textContent = "Image unavailable";
      photoEl.appendChild(label);
      if (openUrl && openUrl !== normalizedUrl) {
        photoEl.title = "Open original link";
        photoEl.addEventListener("click", () => {
          window.open(openUrl, "_blank", "noopener,noreferrer");
        }, { once: true });
      }
    });
    photoEl.appendChild(img);
    return;
  }

  const label = document.createElement("span");
  label.className = "modal-style-photo-label";
  label.textContent = `Photo ${photoIndex}`;
  photoEl.appendChild(label);
}

function createModalStylePhotos(row) {
  const stylePhotos = getStylePhotosForRow(row);
  const wrap = document.createElement("div");
  wrap.className = "modal-style-photos";

  STYLE_PHOTO_FIELDS.forEach((field, index) => {
    const photo = document.createElement("div");
    photo.className = "modal-style-photo";
    photo.setAttribute("aria-label", field);
    renderStylePhotoSlot(photo, stylePhotos?.[field] ?? "", index + 1);
    wrap.appendChild(photo);
  });

  return wrap;
}

function syncPackingListPanelOpenForRow(row) {
  if (hasPackingList(row?.["PO #"])) {
    packingListPanelOpen = true;
    return;
  }
  if (typeof poHasShipment === "function" && poHasShipment(row)) {
    packingListPanelOpen = true;
  }
}

function updateModalVendor(row) {
  const vendorEl = document.getElementById("modalPoVendor");
  if (!vendorEl) return;
  const vendorVal = String(getColumnFilterRawValue("Vendor", row) ?? "").trim();
  if (vendorVal) {
    vendorEl.textContent = vendorVal;
    vendorEl.hidden = false;
  } else {
    vendorEl.textContent = "";
    vendorEl.hidden = true;
  }
}

function renderModalHeadingMeta(container, row) {
  if (!container) return;
  container.replaceChildren();

  const styleVal = String(getColumnFilterRawValue("Style #", row) ?? "").trim();
  const colorVal = String(getColumnFilterRawValue("Color", row) ?? "").trim();
  if (!styleVal && !colorVal) return;

  const item = document.createElement("span");
  item.className = "modal-po-heading-meta-item";
  if (styleVal) {
    const styleEl = document.createElement("span");
    styleEl.className = "modal-po-heading-meta-style";
    styleEl.textContent = styleVal;
    item.appendChild(styleEl);
  }
  if (colorVal) {
    const colorEl = document.createElement("span");
    colorEl.className = "modal-po-heading-meta-color";
    colorEl.textContent = colorVal;
    item.appendChild(colorEl);
  }
  container.appendChild(item);
}

function renderModalContent(row) {
  syncPackingListPanelOpenForRow(row);

  const poNumEl = document.getElementById("modalPoNum");
  const poMetaEl = document.getElementById("modalPoMeta");
  const bodyEl = document.getElementById("modalBody");
  if (!poNumEl || !bodyEl) return;

  const poNum = isEmptyValue(row["PO #"]) ? EMPTY_DISPLAY : row["PO #"];
  poNumEl.className = "modal-po-num";
  poNumEl.onclick = null;
  if (COPY_ON_CLICK_COLS.has("PO #") && !isEmptyValue(row["PO #"])) {
    mountCopyableText(poNumEl, "PO #", row["PO #"]);
  } else {
    setDisplayText(poNumEl, poNum);
  }

  renderModalHeadingMeta(poMetaEl, row);
  updateModalVendor(row);

  updateModalPackingListButton(row);
  updateModalFlagButton(row);
  updatePoModalMenu(row);

  bodyEl.innerHTML = "";

  const layout = document.createElement("div");
  layout.className = "modal-layout";
  layout.classList.toggle("modal-layout--packing-open", packingListPanelOpen);
  const modalCard = document.querySelector("#modalOverlay .modal-card");
  if (modalCard) modalCard.classList.toggle("modal-card--packing-open", packingListPanelOpen);

  const main = document.createElement("div");
  main.className = "modal-layout-main";

  main.appendChild(createModalOrderProductSplit(row));
  main.appendChild(createModalStyleSection(row));
  const freightSection = createModalFreightSection(row);
  if (freightSection) main.appendChild(freightSection);
  const chargebacksSection = createModalChargebacksSection(row);
  if (chargebacksSection) main.appendChild(chargebacksSection);

  layout.appendChild(main);
  if (packingListPanelOpen) {
    layout.appendChild(createPackingListSidePanel(row));
  }
  bodyEl.appendChild(layout);
  if (packingListPanelOpen) {
    requestAnimationFrame(() => {
      syncModalPackingEditorSnapshot();
      updateModalSaveState();
    });
  } else {
    modalPackingEditorSnapshot = null;
    updateModalSaveState();
  }
}

function shouldIgnoreRowDblClick(e) {
  const target = e.target;
  if (!(target instanceof Element)) return false;

  return Boolean(target.closest(
    "input, textarea, select, button, .cell-select-dropdown, .po-flag-btn, .td-select-cell, .select-cell, .editing, [data-editing='active'], .shipment-id-link"
  ));
}

function openPODetail(row) {
  if (isAppSaving() || modalSaveInProgress) return;
  const poBackBtn = document.getElementById("modalBackBtn");
  if (poBackBtn) poBackBtn.hidden = !(typeof modalNavOnOpen === "function" && modalNavOnOpen());
  closeCellSelectDropdown(false);
  if (typeof closeCellDatePopover === "function") closeCellDatePopover(false);
  clearModalPendingSubmission();
  packingListPanelOpen = hasPackingList(row?.["PO #"])
    || (typeof poHasShipment === "function" && poHasShipment(row));
  modalPackingListEditMode = false;
  modalRow = snapshotModalRow(row);
  modalSnapshot = snapshotModalRow(row);
  renderModalContent(modalRow);
  if (typeof bringModalToFront === "function") {
    bringModalToFront(document.getElementById("modalOverlay"));
  } else {
    document.getElementById("modalOverlay").classList.add("open");
  }
}

function openPODetailForPendingSubmission(row, submission) {
  if (isAppSaving() || modalSaveInProgress) return;
  const poBackBtn = document.getElementById("modalBackBtn");
  if (poBackBtn) poBackBtn.hidden = !(typeof modalNavOnOpen === "function" && modalNavOnOpen());
  closeCellSelectDropdown(false);
  if (typeof closeCellDatePopover === "function") closeCellDatePopover(false);

  modalPendingSubmissionId = String(submission?.["Submission ID"] ?? "").trim();
  modalPendingSubmissionDraft = buildPendingSubmissionDraft(submission);
  packingListPanelOpen = true;
  modalPackingListEditMode = true;
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
  closePoModalMenu();
  closeCellSelectDropdown(false);
  if (typeof closeCellDatePopover === "function") closeCellDatePopover(false);
  modalRow = null;
  modalSnapshot = null;
  modalPackingEditorSnapshot = null;
  packingListPanelOpen = false;
  modalPackingListEditMode = false;
  clearModalPendingSubmission();
  clearModalFooterMessageForOverlay("modalOverlay");
  document.getElementById("modalOverlay")?.classList.remove("open");
  document.querySelector("#modalOverlay .modal-card")?.classList.remove("modal-card--packing-open");
  updateModalSaveState();
}

function refreshChargebacksForPo(poNumber) {
  if (!modalRow || String(modalRow["PO #"]) !== String(poNumber)) return;
  updateModalIfOpen();
  if (typeof refreshChargebacksView === "function") refreshChargebacksView();
}

function snapshotPackingRelatedRowFields(row) {
  const fields = ["Has Packing List", "Ctn Qty", "Actual Qty"];
  for (let i = 1; i <= QTY_UNIT_COUNT; i++) fields.push(`Act Unit ${i}`);
  const out = {};
  fields.forEach(field => { out[field] = row[field]; });
  return out;
}

function snapshotPackingStateForPo(poNumber, row) {
  const key = normalizePoNumber(poNumber);
  const packingList = getPackingListForPo(key);
  return {
    poNumber: key,
    packingList: packingList ? { ...packingList } : null,
    cartons: getPackingCartonsForPo(key).map(carton => ({ ...carton })),
    rowFields: row ? snapshotPackingRelatedRowFields(row) : {},
  };
}

function restorePackingStateForPo(snapshot, row) {
  const key = snapshot.poNumber;
  const current = getPackingListForPo(key);
  const currentId = current ? getPackingListId(current) : "";
  if (currentId) {
    allPackingLists = allPackingLists.filter(item => getPackingListPoNumber(item) !== key);
    allPackingCartons = allPackingCartons.filter(carton =>
      String(carton?.[PACKING_LIST_ID_FIELD] ?? "").trim() !== currentId
    );
  }
  if (snapshot.packingList) {
    upsertLocalPackingList(
      key,
      getPackingListId(snapshot.packingList),
      snapshot.packingList,
      snapshot.cartons
    );
  }
  latestPackingUnitTotalsByPo.set(
    key,
    snapshot.cartons.length ? computePackingTotalsByUnit(snapshot.cartons) : getPackingUnitTotalsForPo(key)
  );
  if (row && snapshot.rowFields) {
    Object.assign(row, snapshot.rowFields);
    applyModalUpdatesToTableRow(key, snapshot.rowFields);
  }
  invalidatePackingIndex();
}

function applyPackingListLocally(poNumber, existingPackingList, packingList, cartons, filteredPoUpdates, row) {
  const provisionalId = getPackingListId(existingPackingList) || generateProvisionalPackingListId();
  const packingPoUpdates = buildPackingPoUpdatesFromCartons(cartons, cartons.length);
  const mergedUpdates = { ...filteredPoUpdates, ...packingPoUpdates };
  upsertLocalPackingList(poNumber, provisionalId, packingList, cartons);
  latestPackingUnitTotalsByPo.set(poNumber, computePackingTotalsByUnit(cartons));
  Object.assign(row, mergedUpdates);
  applyModalUpdatesToTableRow(poNumber, mergedUpdates);
  return { mergedUpdates, provisionalId };
}

async function syncPackingListToServer(poNumber, packingList, cartons, filteredPoUpdates, provisionalId, row) {
  const json = await postApi("/api/packing-list/save", { poNumber, packingList, cartons, updates: filteredPoUpdates });
  if (!json.success) throw new Error(json.error);

  const packingListId = json.packingListId || provisionalId;
  if (packingListId !== provisionalId) {
    allPackingLists = allPackingLists.filter(item => getPackingListId(item) !== provisionalId);
    allPackingCartons = allPackingCartons.filter(carton =>
      String(carton?.[PACKING_LIST_ID_FIELD] ?? "").trim() !== provisionalId
    );
  }
  upsertLocalPackingList(poNumber, packingListId, packingList, cartons);
  latestPackingUnitTotalsByPo.set(poNumber, computePackingTotalsByUnit(cartons));
  const poUpdates = json.poUpdates || {};
  if (Object.keys(poUpdates).length > 0) {
    Object.assign(row, poUpdates);
    applyModalUpdatesToTableRow(poNumber, poUpdates);
  }
  return poUpdates;
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
  if (modalSaveInProgress || isAppSaving()) return;
  if (typeof isPoClosed === "function" && isPoClosed(row)) {
    showIndicator("Closed POs cannot be edited", "error");
    return;
  }
  const packingListId = getPackingListId(packingList);
  const poNumber = String(row["PO #"] ?? "").trim();
  if (!packingListId && !poNumber) return;
  if (!confirm("Delete this packing list?")) return;

  modalSaveInProgress = true;
  showIndicator(`Deleting packing list${ELLIPSIS}`, "");
  try {
    const json = await postApi("/api/packing-list/delete", { packingListId, poNumber });
    if (!json.success) throw new Error(json.error);
    allPackingLists = allPackingLists.filter(item => getPackingListId(item) !== packingListId);
    allPackingCartons = allPackingCartons.filter(carton =>
      String(carton?.[PACKING_LIST_ID_FIELD] ?? "").trim() !== packingListId
    );
    invalidatePackingIndex();
    if (typeof closePoPackingPane === "function") closePoPackingPane({ clearSelection: false });
    else closePackingListPanelInModal(row);
    renderTable();
    showIndicator("Packing list deleted", "success");
  } catch (err) {
    showIndicator("Packing list delete failed: " + err.message, "error");
  } finally {
    modalSaveInProgress = false;
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
    const weightLbsRaw = String(carton[CARTON_WEIGHT_LBS_SAVE_FIELD] ?? "").trim();
    const weightKgRaw = String(carton[CARTON_WEIGHT_FIELD] ?? "").trim();
    const weightKg = weightLbsRaw === ""
      ? toQtyNumber(weightKgRaw)
      : cartonWeightLbsToKg(weightLbsRaw);
    const weightLbs = weightLbsRaw === ""
      ? cartonWeightKgToLbs(weightKg)
      : toQtyNumber(weightLbsRaw);
    out[CARTON_WEIGHT_FIELD] = formatCartonWeightValue(weightKg);
    out[CARTON_WEIGHT_LBS_SAVE_FIELD] = formatCartonWeightValue(weightLbs);
    return out;
  });
}

function getActivePackingListPayload() {
  const editor = document.querySelector("#modalOverlay .packing-list-side-panel .packing-list-editor");
  if (
    !isModalPackingListEditable()
    || !modalRow
    || !editor
    || typeof editor.__getPackingCartons !== "function"
  ) return null;
  return {
    editor,
    row: modalRow,
    existingPackingList: editor.__packingList || getPackingListForPo(modalRow["PO #"]),
    cartons: normalizePackingCartonsForSave(editor.__getPackingCartons()),
  };
}

function serializePackingEditorState(editor, cartons) {
  const countInput = editor?.querySelector(".packing-list-count-input");
  const cartonCount = Math.max(1, Math.floor(Number(countInput?.value) || cartons.length || 1));
  return JSON.stringify({
    cartonCount,
    cartons: normalizePackingCartonsForSave(cartons),
  });
}

function syncModalPackingEditorSnapshot() {
  const payload = getActivePackingListPayload();
  if (!payload) {
    modalPackingEditorSnapshot = null;
    return;
  }
  modalPackingEditorSnapshot = serializePackingEditorState(payload.editor, payload.editor.__getPackingCartons());
}

function hasPackingListPendingChanges() {
  if (!isModalPackingListEditable()) return false;
  const payload = getActivePackingListPayload();
  if (!payload || !modalPackingEditorSnapshot) return false;
  const current = serializePackingEditorState(payload.editor, payload.editor.__getPackingCartons());
  return current !== modalPackingEditorSnapshot;
}

function preparePackingListSave({ editor, row, existingPackingList, cartons }, poEditUpdates = {}) {
  const poNumber = normalizePoNumber(row["PO #"]);
  if (!poNumber) return null;

  if (cartons.some(carton => computeCartonTotal(carton) <= 0)) {
    setChargebackError(editor, "A carton quantity cannot be zero.");
    return null;
  }

  const filteredPoUpdates = filterPoUpdatePayload(poEditUpdates);
  const packingList = {
    "Carton Count": cartons.length,
    "Notes": existingPackingList?.["Notes"]
      || modalPendingSubmissionDraft?.packingList?.["Notes"]
      || "",
  };

  const snapshot = snapshotPackingStateForPo(poNumber, row);
  const { mergedUpdates, provisionalId } = applyPackingListLocally(
    poNumber,
    existingPackingList,
    packingList,
    cartons,
    filteredPoUpdates,
    row
  );

  return {
    mergedUpdates,
    syncToServer: async () => {
      try {
        return await syncPackingListToServer(
          poNumber,
          packingList,
          cartons,
          filteredPoUpdates,
          provisionalId,
          row
        );
      } catch (err) {
        restorePackingStateForPo(snapshot, row);
        throw err;
      }
    },
  };
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

  setAppSaving(true, "Adding chargeback...");
  try {
    const json = await postApi("/api/chargebacks/create", { poNumber, chargeback });
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

  setAppSaving(true, "Saving chargeback...");
  try {
    const json = await postApi("/api/chargebacks/update", { chargebackId, chargeback });
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

  setAppSaving(true, "Deleting chargeback...");
  try {
    const json = await postApi("/api/chargebacks/delete", { chargebackId });
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
  if (isAppSaving() || modalSaveInProgress) return;
  commitActiveModalEditor();
  dismissModalOverlay();
}

function applyModalUpdatesToTableRow(poNumber, updates) {
  const actualRow = findRowByPo(poNumber);
  if (!actualRow) return;
  Object.assign(actualRow, updates);
}

async function saveModalChanges() {
  if (isAppSaving() || modalSaveInProgress || !modalRow || !modalSnapshot) return;
  if (typeof isPoClosed === "function" && isPoClosed(modalRow) && !isModalPendingSubmissionReview()) {
    showIndicator("Closed POs cannot be edited", "error");
    return;
  }
  if (!hasModalPendingChanges()) return;
  commitActiveModalEditor();

  const updates = getModalPendingUpdates();
  const packingPayload = getActivePackingListPayload();
  const hasPackingChanges = hasPackingListPendingChanges();
  const pendingSubmissionId = modalPendingSubmissionId;
  const reviewingPending = Boolean(pendingSubmissionId);
  if (Object.keys(updates).length === 0 && !hasPackingChanges && !reviewingPending) return;

  const poNumber = modalRow["PO #"];

  if (packingPayload && (hasPackingChanges || reviewingPending)) {
    const prepared = preparePackingListSave(packingPayload, updates);
    if (!prepared) return;

    const poNumber = modalRow["PO #"];
    if (prepared.mergedUpdates) {
      applyModalUpdatesToTableRow(poNumber, prepared.mergedUpdates);
    }

    dismissModalOverlay();
    queuePoTableRefresh();

    if (!prepared.syncToServer) {
      if (pendingSubmissionId && typeof completePendingSubmissionAfterModalSave === "function") {
        await completePendingSubmissionAfterModalSave(pendingSubmissionId);
      }
      showIndicator(
        pendingSubmissionId ? `Submission approved ${CHECK_MARK}` : `Saved ${CHECK_MARK}`,
        "success"
      );
      return;
    }

    modalSaveInProgress = true;
    showIndicator(
      pendingSubmissionId ? `Approving submission${ELLIPSIS}` : `Saving packing list${ELLIPSIS}`,
      ""
    );
    try {
      await prepared.syncToServer();
      if (pendingSubmissionId && typeof completePendingSubmissionAfterModalSave === "function") {
        const approved = await completePendingSubmissionAfterModalSave(pendingSubmissionId);
        if (!approved) throw new Error("Packing list saved but submission could not be approved.");
      }
      queuePoTableRefresh();
      showIndicator(
        pendingSubmissionId ? `Submission approved ${CHECK_MARK}` : `Saved ${CHECK_MARK}`,
        "success"
      );
    } catch (err) {
      queuePoTableRefresh();
      showIndicator("Save failed: " + err.message, "error");
    } finally {
      modalSaveInProgress = false;
    }
    return;
  }

  modalSaveInProgress = true;
  showIndicator(`Saving${ELLIPSIS}`, "");
  try {
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
    modalSaveInProgress = false;
  }
}

function initPoModalActions() {
  bindDirectBackdropDismiss(document.getElementById("modalOverlay"), cancelModalChanges);
  initPoModalFlagButton();
  initPoModalHeaderMenu();
  document.getElementById("modalSaveBtn")?.addEventListener("click", () => {
    saveModalChanges();
  });
  document.getElementById("modalCancelBtn")?.addEventListener("click", () => {
    cancelModalChanges();
  });
  document.getElementById("modalBackBtn")?.addEventListener("click", () => {
    if (isAppSaving() || modalSaveInProgress) return;
    if (typeof modalNavBack === "function") modalNavBack(cancelModalChanges);
  });
}
