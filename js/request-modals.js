/** Shared modal layout for EXF / ASN / delivery / pickup request modals. */

const DEFAULT_WAREHOUSE_ENTITY = "FORERUNNER LOGISTICS";
const DEFAULT_DELIVERY_TO_ENTITY = "ELEVATOR DISCO";

function isRequestEmailSent(request) {
  return String(request?.["Email Status"] ?? "").trim().toLowerCase() === "sent";
}

function shouldIgnoreRequestTableDblClick(e) {
  const target = e.target;
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(
    "input, textarea, select, button, .btn, .exf-request-resend-btn, .asn-request-resend-btn, .delivery-request-resend-btn, .pickup-request-resend-btn"
  ));
}

function attachRequestTableRowDblClick(tr, openDetail) {
  tr.className = "clickable-row";
  tr.ondblclick = e => {
    if (shouldIgnoreRequestTableDblClick(e)) return;
    e.preventDefault();
    e.stopPropagation();
    openDetail();
  };
}

function parseRequestPoNumbers(request) {
  return String(request?.["PO Numbers"] ?? "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

function getRequestPoNumbers(request, idField) {
  const fromRequest = parseRequestPoNumbers(request);
  if (fromRequest.length > 0) return fromRequest;
  const id = String(request?.[idField] ?? "").trim();
  if (!id) return [];
  return allRows
    .filter(row => String(row[idField] ?? "").trim() === id)
    .map(row => row["PO #"])
    .filter(po => !isEmptyValue(po));
}

function openRequestLinkedPoDetail(poNumber) {
  if (typeof openPoFromShipment === "function") {
    openPoFromShipment(poNumber);
    return;
  }
  const row = allRows.find(r => String(r["PO #"]) === String(poNumber));
  if (row && typeof openPODetail === "function") openPODetail(row);
}

function shouldIgnoreRequestLinkedPoRowDblClick(e) {
  const target = e.target;
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(
    "input, textarea, select, .po-select-checkbox, .td-select-cell"
  )) || Boolean(target.closest("button:not(.shipment-linked-po-link)"));
}

function attachRequestLinkedPoRowOpen(tr, poNumber) {
  tr.classList.add("clickable-row");
  tr.ondblclick = e => {
    if (shouldIgnoreRequestLinkedPoRowDblClick(e)) return;
    e.preventDefault();
    e.stopPropagation();
    openRequestLinkedPoDetail(poNumber);
  };
}

function appendRequestLinkedPoIdCell(td, row) {
  td.classList.add("shipment-po-cell-id");
  const text = formatShipmentLinkedPoCell("PO #", row);
  if (text === EMPTY_DISPLAY) {
    setDisplayText(td, EMPTY_DISPLAY);
    return;
  }
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "shipment-linked-po-link";
  btn.textContent = text;
  btn.title = "Open PO detail";
  btn.addEventListener("click", e => {
    e.stopPropagation();
    openRequestLinkedPoDetail(row["PO #"]);
  });
  td.appendChild(btn);
}

function renderRequestLinkedPoDataCell(td, col, row, { cellClass } = {}) {
  if (cellClass) td.className = cellClass;
  if (col === "PO #") {
    appendRequestLinkedPoIdCell(td, row);
    return;
  }
  if (col === "Status") {
    td.innerHTML = renderStatus(row[col]);
    return;
  }
  const text = formatShipmentLinkedPoCell(col, row);
  if (text === EMPTY_DISPLAY) setDisplayText(td, EMPTY_DISPLAY);
  else {
    td.textContent = text;
    td.title = text;
  }
}

function getLocationEntities() {
  return (allLocationRows ?? []).map(r => String(r["Entity"] ?? "").trim()).filter(Boolean);
}

function getLocationAddress(entity) {
  const row = (allLocationRows ?? []).find(r =>
    String(r["Entity"] ?? "").trim().toLowerCase() === String(entity ?? "").trim().toLowerCase()
  );
  return String(row?.["Address"] ?? "").trim();
}

function createFormMetaRow(label) {
  const tr = document.createElement("tr");
  const labelTd = document.createElement("td");
  labelTd.className = "email-meta-label";
  labelTd.textContent = label;
  const valueTd = document.createElement("td");
  valueTd.className = "email-meta-value";
  tr.appendChild(labelTd);
  tr.appendChild(valueTd);
  return { tr, valueTd };
}

function createFormMetaInputElement(fieldName, value, { type = "text", readOnly = false, selectOptions = null } = {}) {
  let control;
  let input;

  if (type === "date") {
    const dateInput = createCompactDateInput({
      initialYmd: value,
      readOnly,
      inputClassName: "shipment-form-input shipment-form-input--date email-meta-input",
    });
    input = dateInput.input;
    control = dateInput.wrap;
  } else if (type === "textarea") {
    input = document.createElement("textarea");
    input.rows = 3;
    input.value = isEmptyValue(value) ? "" : String(value);
    input.className = "shipment-form-input email-meta-input";
    control = input;
  } else if (selectOptions) {
    input = document.createElement("select");
    selectOptions.forEach(({ value: optVal, label: optLabel, selected = false }) => {
      const option = document.createElement("option");
      option.value = optVal;
      option.textContent = optLabel;
      if (selected) option.selected = true;
      input.appendChild(option);
    });
    input.className = "shipment-form-input email-meta-input";
    control = input;
  } else {
    input = document.createElement("input");
    input.type = "text";
    input.value = isEmptyValue(value) ? "" : String(value);
    input.className = "shipment-form-input email-meta-input";
    control = input;
  }

  input.dataset.field = fieldName;
  if (readOnly) {
    if (input instanceof HTMLSelectElement) input.disabled = true;
    else input.readOnly = true;
  }
  return { control, input };
}

function createRequestFormMetaRow(label, fieldName, value, { type = "text", readOnly = false, selectOptions = null } = {}) {
  const { tr, valueTd } = createFormMetaRow(label);
  const { control, input } = createFormMetaInputElement(fieldName, value, { type, readOnly, selectOptions });
  valueTd.appendChild(control);
  return { tr, input };
}

function createFormNotesPanel(fieldName, value, { readOnly = false } = {}) {
  const panel = document.createElement("div");
  panel.className = "email-notes-panel";

  const title = document.createElement("div");
  title.className = "email-section-title";
  title.textContent = "Notes";

  const textarea = document.createElement("textarea");
  textarea.className = "email-notes-input";
  textarea.dataset.field = fieldName;
  textarea.rows = 5;
  textarea.value = isEmptyValue(value) ? "" : String(value);
  if (readOnly) textarea.readOnly = true;

  panel.appendChild(title);
  panel.appendChild(textarea);
  return { panel, input: textarea };
}

function buildEmailStyleForm({ formId, metaRows = [], notesField = null, notesValue = "", notesReadOnly = false } = {}) {
  const form = document.createElement("div");
  form.className = "shipment-form-edit shipment-form-edit--email-style";
  if (formId) form.id = formId;

  const infoRow = document.createElement("div");
  infoRow.className = "email-info-row";

  const metaWrap = document.createElement("div");
  metaWrap.className = "email-info-meta";
  if (!notesField) metaWrap.classList.add("email-info-meta--full");

  const table = document.createElement("table");
  table.className = "email-meta";
  const tbody = document.createElement("tbody");
  metaRows.forEach(row => tbody.appendChild(row));
  table.appendChild(tbody);
  metaWrap.appendChild(table);
  infoRow.appendChild(metaWrap);

  if (notesField) {
    const notesWrap = document.createElement("div");
    notesWrap.className = "email-info-notes";
    const { panel } = createFormNotesPanel(notesField, notesValue, { readOnly: notesReadOnly });
    notesWrap.appendChild(panel);
    infoRow.appendChild(notesWrap);
  }

  form.appendChild(infoRow);
  return form;
}

function buildShipmentModalSplitLayout(form, linkedSection) {
  const layout = document.createElement("div");
  layout.className = "shipment-modal-layout";

  const left = document.createElement("div");
  left.className = "shipment-modal-left";
  left.appendChild(form);

  const right = document.createElement("div");
  right.className = "shipment-modal-right";
  if (linkedSection) right.appendChild(linkedSection);

  layout.appendChild(left);
  layout.appendChild(right);
  return layout;
}

/**
 * Entity select + read-only address sub-line in a single meta row (matches email From/To blocks).
 * Returns { row, selectEl, addressEl }.
 */
function createRequestLocationField(label, entityFieldName, addressFieldName, defaultEntity = "", { readOnly = false } = {}) {
  const { tr, valueTd } = createFormMetaRow(label);

  const selectWrap = document.createElement("div");
  selectWrap.className = "email-meta-control-wrap";

  const select = document.createElement("select");
  select.className = "shipment-form-input email-meta-input";
  select.dataset.field = entityFieldName;

  const entities = getLocationEntities();
  if (!entities.includes("")) {
    const blankOpt = document.createElement("option");
    blankOpt.value = "";
    blankOpt.textContent = "— Select —";
    select.appendChild(blankOpt);
  }
  entities.forEach(entity => {
    const opt = document.createElement("option");
    opt.value = entity;
    opt.textContent = entity;
    if (entity === defaultEntity) opt.selected = true;
    select.appendChild(opt);
  });
  if (defaultEntity && !entities.includes(defaultEntity)) {
    const opt = document.createElement("option");
    opt.value = defaultEntity;
    opt.textContent = defaultEntity;
    opt.selected = true;
    select.appendChild(opt);
  }
  if (readOnly) select.disabled = true;

  const addressSub = document.createElement("textarea");
  addressSub.className = "email-meta-sub email-meta-address";
  addressSub.dataset.field = addressFieldName;
  addressSub.rows = 2;
  addressSub.readOnly = true;
  addressSub.value = getLocationAddress(select.value);

  if (!readOnly) {
    select.addEventListener("change", () => {
      addressSub.value = getLocationAddress(select.value);
    });
  }

  selectWrap.appendChild(select);
  valueTd.appendChild(selectWrap);
  valueTd.appendChild(addressSub);

  return { row: tr, selectEl: select, addressEl: addressSub };
}



const REQUEST_LINKED_PO_COLUMNS = [
  { col: "PO #", label: "PO #", cellClass: "shipment-po-cell-id" },
  { col: "Status", label: "Status", cellClass: "shipment-po-cell-wrap" },
  { col: "Style #", label: "Style #", cellClass: "shipment-po-cell-wrap" },
  { col: "Vendor", label: "Vendor", cellClass: "shipment-po-cell-vendor" },
  { col: "Buyer", label: "Buyer", cellClass: "shipment-po-cell-buyer" },
  { col: "PO Qty", label: "Order Qty", cellClass: "shipment-po-cell-qty" },
];

const DELIVERY_PICKUP_LINKED_PO_COLUMNS = [
  { col: "PO #", label: "PO #", cellClass: "shipment-po-cell-id" },
  { col: "Status", label: "Status", cellClass: "shipment-po-cell-status" },
  { col: "Style #", label: "Style #", cellClass: "shipment-po-cell-wrap" },
  { col: "Vendor", label: "Vendor", cellClass: "shipment-po-cell-vendor" },
  { col: "Buyer", label: "Buyer", cellClass: "shipment-po-cell-buyer" },
  { col: "Buyer PO #", label: "Buyer PO #", cellClass: "shipment-po-cell-buyer-po" },
  { col: "Color", label: "Color", cellClass: "shipment-po-cell-wrap" },
  { col: "House #", label: "House #", cellClass: "shipment-po-cell-wrap" },
  { col: "PO Qty", label: "Order Qty", cellClass: "shipment-po-cell-qty" },
  { col: "Actual Qty", label: "Actual Qty", cellClass: "shipment-po-cell-qty" },
  { col: "Ctn Qty", label: "Ctn Qty", cellClass: "shipment-po-cell-qty" },
];

/** Select col + linked PO cols for ASN / pickup / delivery request modals. */
const DELIVERY_PICKUP_LINKED_PO_COLUMN_WIDTHS = [
  52, 52, 100, 96, 80, 72, 108, 72, 72, 58, 58, 58,
];

function appendDeliveryPickupLinkedPoColgroup(table) {
  const colgroup = document.createElement("colgroup");
  DELIVERY_PICKUP_LINKED_PO_COLUMN_WIDTHS.forEach(width => {
    const col = document.createElement("col");
    col.style.width = `${width}px`;
    colgroup.appendChild(col);
  });
  table.appendChild(colgroup);
}

function getRequestLinkedPoTotals(pos) {
  return pos.reduce((totals, row) => {
    totals.orderQty += toQtyNumber(row["PO Qty"]);
    totals.unitQty += toQtyNumber(row["Actual Qty"]);
    totals.ctnQty += toQtyNumber(row["Ctn Qty"]);
    if (typeof getPackingWeightForPo === "function") {
      totals.totalWeight += getPackingWeightForPo(row["PO #"]);
    }
    return totals;
  }, { orderQty: 0, unitQty: 0, ctnQty: 0, totalWeight: 0 });
}

function appendEmailPoTableFooter(table, pos, colDefs, { hasSelectCol = false, qtyCol = "Actual Qty" } = {}) {
  const totals = getRequestLinkedPoTotals(pos);
  const cols = hasSelectCol ? [{ col: "_select" }, ...colDefs.map(c => ({ col: c.col }))] : colDefs.map(c => ({ col: c.col }));
  const qtyIndex = cols.findIndex(c => c.col === qtyCol);
  const labelIndex = qtyIndex > 0 ? qtyIndex - 1 : -1;

  const tfoot = document.createElement("tfoot");
  const tr = document.createElement("tr");
  cols.forEach(({ col }, index) => {
    const td = document.createElement("td");
    if (col === "_select") {
      td.className = "email-po-footer-cell";
    } else if (index === labelIndex) {
      td.className = "email-po-footer-cell email-po-footer-label";
      td.textContent = "Total";
    } else if (col === "PO Qty") {
      td.className = "email-po-footer-cell email-num";
      td.textContent = formatShipmentLinkedPoTotal(totals.orderQty);
    } else if (col === qtyCol) {
      td.className = "email-po-footer-cell email-num";
      td.textContent = formatShipmentLinkedPoTotal(totals.unitQty);
    } else if (col === "Ctn Qty") {
      td.className = "email-po-footer-cell email-num";
      td.textContent = formatShipmentLinkedPoTotal(totals.ctnQty);
    } else {
      td.className = "email-po-footer-cell";
    }
    tr.appendChild(td);
  });
  tfoot.appendChild(tr);
  table.appendChild(tfoot);
  return tfoot;
}

function renderRequestLinkedPoFooterTotals(pos) {
  const totals = getRequestLinkedPoTotals(pos);
  const wrap = document.createElement("div");
  wrap.className = "shipment-linked-po-footer-totals";
  [
    ["Unit Qty", totals.unitQty],
    ["Ctn Qty", totals.ctnQty],
    ["Total Weight", totals.totalWeight > 0 ? `${totals.totalWeight} lbs` : EMPTY_DISPLAY],
    ["PO Count", pos.length],
  ].forEach(([label, value]) => {
    const item = document.createElement("div");
    item.className = "shipment-linked-po-footer-item";
    const labelEl = document.createElement("span");
    labelEl.className = "shipment-linked-po-footer-label";
    labelEl.textContent = label;
    const valueEl = document.createElement("span");
    valueEl.className = "shipment-linked-po-footer-value";
    valueEl.textContent = typeof value === "number"
      ? formatShipmentLinkedPoTotal(value)
      : String(value);
    item.appendChild(labelEl);
    item.appendChild(valueEl);
    wrap.appendChild(item);
  });
  return wrap;
}

/** @deprecated Use createRequestFormMetaRow + buildEmailStyleForm instead. */
function createRequestFormField(label, fieldName, value, { type = "text", readOnly = false } = {}) {
  const { tr } = createRequestFormMetaRow(label, fieldName, value, { type, readOnly });
  return tr;
}

function readRequestForm(container) {
  const data = {};
  container.querySelectorAll("[data-field]").forEach(el => {
    data[el.dataset.field] = el.classList.contains("compact-date-input")
      ? readCompactDateInputValue(el)
      : el.value ?? "";
  });
  return data;
}

function createRequestLinkedPoEditableControl(col, row, { editor = "textarea", rows = 2 } = {}) {
  let input;
  if (editor === "select" && col === "Ship Method") {
    input = document.createElement("select");
    ["", ...SHIP_OPTIONS].forEach(opt => {
      const option = document.createElement("option");
      option.value = opt;
      option.textContent = opt || EMPTY_DISPLAY;
      if (String(row[col] ?? "") === opt) option.selected = true;
      input.appendChild(option);
    });
  } else if (editor === "text") {
    input = document.createElement("input");
    input.type = "text";
    input.value = isEmptyValue(row[col]) ? "" : String(row[col]);
  } else {
    input = document.createElement("textarea");
    input.rows = rows;
    input.value = isEmptyValue(row[col]) ? "" : String(row[col]);
  }

  input.className = "shipment-form-input request-linked-po-input";
  input.dataset.field = col;
  return input;
}

function renderRequestLinkedPoTable(pos, { columns } = {}) {
  const colDefs = columns ?? REQUEST_LINKED_PO_COLUMNS;
  const section = document.createElement("section");
  section.className = "shipment-linked-pos";

  if (pos.length === 0) {
    const empty = document.createElement("p");
    empty.className = "shipment-linked-empty";
    empty.textContent = "No POs selected.";
    section.appendChild(empty);
    return section;
  }

  const wrap = document.createElement("div");
  wrap.className = "email-po-table-wrap";

  const table = document.createElement("table");
  table.className = "email-po-table shipment-linked-po-table request-linked-po-table";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  colDefs.forEach(({ label, cellClass }) => {
    const th = document.createElement("th");
    th.textContent = label;
    if (cellClass) th.className = cellClass;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  pos.forEach(row => {
    const tr = document.createElement("tr");
    tr.dataset.po = row["PO #"];
    attachRequestLinkedPoRowOpen(tr, row["PO #"]);
    colDefs.forEach(({ col, cellClass, editable, editor, rows }) => {
      const td = document.createElement("td");
      if (editable) {
        if (cellClass) td.className = cellClass;
        const input = createRequestLinkedPoEditableControl(col, row, { editor, rows });
        td.appendChild(input);
      } else {
        renderRequestLinkedPoDataCell(td, col, row, { cellClass });
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  if (pos.length > 0) {
    appendEmailPoTableFooter(table, pos, colDefs, { qtyCol: "PO Qty" });
  }
  wrap.appendChild(table);
  section.appendChild(wrap);
  return section;
}

function readRequestLinkedPoFields(container, fieldName) {
  const data = {};
  container?.querySelectorAll("tbody tr").forEach(tr => {
    const po = tr.dataset.po;
    const el = tr.querySelector(`[data-field="${fieldName}"]`);
    if (po && el) data[po] = el.value ?? "";
  });
  return data;
}

function createRequestModalBodyPoCount(count) {
  const wrap = document.createElement("div");
  wrap.className = "request-body-po-count";
  wrap.textContent = `PO Qty: ${count}`;
  return wrap;
}

function buildRequestModalLayout({
  metaRows = [],
  formId,
  notesField = null,
  notesValue = "",
  notesReadOnly = false,
  linkedPos,
  linkedPoColumns,
  showBodyPoCount = false,
} = {}) {
  const form = buildEmailStyleForm({
    formId,
    metaRows,
    notesField,
    notesValue,
    notesReadOnly,
  });

  if (showBodyPoCount) {
    const count = createRequestModalBodyPoCount(linkedPos.length);
    form.insertBefore(count, form.firstChild);
  }

  return buildShipmentModalSplitLayout(
    form,
    renderRequestLinkedPoTable(linkedPos, { columns: linkedPoColumns })
  );
}

function setRequestModalPoCount(el, count) {
  if (!el) return;
  const unit = count === 1 ? "PO" : "POs";
  el.innerHTML =
    `<span class="shipment-modal-po-count-num">${count}</span>` +
    `<span class="shipment-modal-po-count-unit">${unit}</span>`;
}

/** Update modal header to match email request header (templates/email-exf.html). */
function setEmailStyleModalHeader(headerEl, { typeLabel = "", recordId = "", requestDate = "" } = {}) {
  if (!headerEl) return;

  const subheading = headerEl.querySelector(".email-subheading");
  const idEl = headerEl.querySelector(".email-request-id");
  const dateEl = headerEl.querySelector(".email-request-date");

  if (subheading) subheading.textContent = typeLabel;

  if (idEl) {
    const id = String(recordId ?? "").trim();
    if (id) {
      idEl.textContent = id;
      idEl.hidden = false;
    } else {
      idEl.textContent = "";
      idEl.hidden = true;
    }
  }

  if (dateEl) {
    const date = String(requestDate ?? "").trim();
    if (date) {
      dateEl.textContent = formatDateForDisplay(date);
      dateEl.hidden = false;
    } else {
      dateEl.textContent = "";
      dateEl.hidden = true;
    }
  }
}

const AVAILABLE_PO_PICKER_COLUMNS = [
  { col: "PO #", label: "PO #" },
  { col: "Buyer", label: "Buyer" },
  { col: "Buyer PO #", label: "Buyer PO #" },
  { col: "Style #", label: "Style #" },
];

function renderAvailablePoPickerPanel(pos, {
  panelId = "shipmentAddPoPanel",
  emptyMessage = "No POs available.",
  closeLabel = "Close available POs panel",
  onClose,
  onAddPo,
  disabled = false,
} = {}) {
  const panel = document.createElement("aside");
  panel.className = "shipment-add-po-panel";
  panel.id = panelId;

  const header = document.createElement("div");
  header.className = "shipment-add-po-panel-header";
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "shipment-add-po-panel-close";
  closeBtn.setAttribute("aria-label", closeLabel);
  closeBtn.innerHTML = '<span aria-hidden="true"></span>';
  closeBtn.addEventListener("click", onClose);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  if (pos.length === 0) {
    const empty = document.createElement("p");
    empty.className = "shipment-linked-empty";
    empty.textContent = emptyMessage;
    panel.appendChild(empty);
    return panel;
  }

  const colCount = AVAILABLE_PO_PICKER_COLUMNS.length;
  const gridPanel = document.createElement("div");
  gridPanel.className = "packing-list-grid-panel available-po-grid-panel";

  const headGrid = document.createElement("div");
  headGrid.className = "packing-list-grid packing-list-grid--head available-po-grid";
  headGrid.style.setProperty("--available-po-col-count", String(colCount));

  const blankHead = document.createElement("div");
  blankHead.className = "packing-list-rowhead packing-list-rowhead--blank";
  headGrid.appendChild(blankHead);

  AVAILABLE_PO_PICKER_COLUMNS.forEach(({ label }) => {
    const head = document.createElement("div");
    head.className = "packing-list-colhead";
    head.textContent = label;
    headGrid.appendChild(head);
  });

  const bodyScroll = document.createElement("div");
  bodyScroll.className = "packing-list-grid-scroll";

  const bodyGrid = document.createElement("div");
  bodyGrid.className = "packing-list-grid packing-list-grid--body available-po-grid";
  bodyGrid.style.setProperty("--available-po-col-count", String(colCount));

  pos.forEach(row => {
    const po = String(row["PO #"] ?? "");

    const addCell = document.createElement("div");
    addCell.className = "available-po-add-cell";
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "shipment-requested-po-add";
    addBtn.disabled = disabled;
    addBtn.setAttribute("aria-label", `Add PO ${po}`);
    addBtn.title = "Add PO";
    addBtn.textContent = "+";
    addBtn.addEventListener("click", e => {
      e.stopPropagation();
      onAddPo?.(po);
    });
    addCell.appendChild(addBtn);
    bodyGrid.appendChild(addCell);

    AVAILABLE_PO_PICKER_COLUMNS.forEach(({ col }) => {
      const cell = document.createElement("div");
      cell.className = "packing-list-static available-po-static";
      const text = formatShipmentLinkedPoCell(col, row);
      if (text === EMPTY_DISPLAY) {
        cell.classList.add("empty-display");
        cell.textContent = EMPTY_DISPLAY;
      } else {
        cell.textContent = text;
        cell.title = text;
      }
      bodyGrid.appendChild(cell);
    });
  });

  bodyScroll.appendChild(bodyGrid);
  gridPanel.appendChild(headGrid);
  gridPanel.appendChild(bodyScroll);
  panel.appendChild(gridPanel);
  return panel;
}

function renderRequestedPoPickerPanel(pos, { disabled = false } = {}) {
  return renderAvailablePoPickerPanel(pos, {
    panelId: "shipmentAddPoPanel",
    emptyMessage: "No requested POs available.",
    closeLabel: "Close requested POs panel",
    onClose: closeShipmentAddPoPanel,
    onAddPo: addRequestedPoToShipment,
    disabled,
  });
}

