/** Shared modal layout for EXF / ASN / delivery / pickup request modals. */

const DEFAULT_WAREHOUSE_ENTITY = "FORERUNNER LOGISTICS";
const DEFAULT_DELIVERY_TO_ENTITY = "ELEVATOR DISCO";

function getLocationEntities() {
  return (allLocationRows ?? []).map(r => String(r["Entity"] ?? "").trim()).filter(Boolean);
}

function getLocationAddress(entity) {
  const row = (allLocationRows ?? []).find(r =>
    String(r["Entity"] ?? "").trim().toLowerCase() === String(entity ?? "").trim().toLowerCase()
  );
  return String(row?.["Address"] ?? "").trim();
}

/**
 * Creates a pair of form fields: an entity <select> and a read-only address <textarea>.
 * Returns { wrap (contains both), selectEl, addressEl }.
 */
function createRequestLocationField(label, entityFieldName, addressFieldName, defaultEntity = "") {
  const frag = document.createDocumentFragment();

  // Entity select
  const entityWrap = document.createElement("div");
  entityWrap.className = "shipment-form-field";
  const entityLbl = document.createElement("label");
  entityLbl.className = "shipment-form-label";
  entityLbl.textContent = label;

  const select = document.createElement("select");
  select.className = "shipment-form-input";
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

  entityWrap.appendChild(entityLbl);
  entityWrap.appendChild(select);

  // Address textarea (read-only)
  const addrWrap = document.createElement("div");
  addrWrap.className = "shipment-form-field";
  const addrLbl = document.createElement("label");
  addrLbl.className = "shipment-form-label";
  addrLbl.textContent = label === "From" ? "Pickup Address" : "Delivery Address";

  const textarea = document.createElement("textarea");
  textarea.className = "shipment-form-input";
  textarea.dataset.field = addressFieldName;
  textarea.rows = 3;
  textarea.readOnly = true;
  textarea.value = getLocationAddress(select.value);

  select.addEventListener("change", () => {
    textarea.value = getLocationAddress(select.value);
  });

  addrWrap.appendChild(addrLbl);
  addrWrap.appendChild(textarea);

  frag.appendChild(entityWrap);
  frag.appendChild(addrWrap);

  return { frag, selectEl: select, addressEl: textarea };
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
  { col: "Status", label: "Status", cellClass: "shipment-po-cell-wrap" },
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

function getRequestLinkedPoTotals(pos) {
  return pos.reduce((totals, row) => {
    totals.unitQty += toQtyNumber(row["Actual Qty"]);
    totals.ctnQty += toQtyNumber(row["Ctn Qty"]);
    if (typeof getPackingWeightForPo === "function") {
      totals.totalWeight += getPackingWeightForPo(row["PO #"]);
    }
    return totals;
  }, { unitQty: 0, ctnQty: 0, totalWeight: 0 });
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

function createRequestFormField(label, fieldName, value, { type = "text", readOnly = false } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "shipment-form-field";

  const lbl = document.createElement("label");
  lbl.className = "shipment-form-label";
  lbl.textContent = label;

  let input;
  if (type === "date") {
    input = document.createElement("input");
    input.type = "date";
    input.value = normalizeToYmd(value);
    input.classList.add("shipment-form-input--date");
    input.classList.toggle("shipment-form-input--empty", isEmptyValue(input.value));
    input.addEventListener("input", () => {
      input.classList.toggle("shipment-form-input--empty", isEmptyValue(input.value));
    });
  } else if (type === "textarea") {
    input = document.createElement("textarea");
    input.rows = 3;
    input.value = isEmptyValue(value) ? "" : String(value);
  } else {
    input = document.createElement("input");
    input.type = "text";
    input.value = isEmptyValue(value) ? "" : String(value);
  }

  input.classList.add("shipment-form-input");
  input.dataset.field = fieldName;
  if (readOnly) input.readOnly = true;

  wrap.appendChild(lbl);
  wrap.appendChild(input);
  return wrap;
}

function readRequestForm(container) {
  const data = {};
  container.querySelectorAll("[data-field]").forEach(el => {
    data[el.dataset.field] = el.value ?? "";
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
  wrap.className = "shipment-linked-po-table-wrap";

  const table = document.createElement("table");
  table.className = "shipment-linked-po-table request-linked-po-table";

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
    colDefs.forEach(({ col, cellClass, editable, editor, rows }) => {
      const td = document.createElement("td");
      if (cellClass) td.className = cellClass;
      if (editable) {
        const input = createRequestLinkedPoEditableControl(col, row, { editor, rows });
        td.appendChild(input);
      } else if (col === "Status") {
        td.innerHTML = renderStatus(row[col]);
      } else {
        const text = formatShipmentLinkedPoCell(col, row);
        if (text === EMPTY_DISPLAY) setDisplayText(td, EMPTY_DISPLAY);
        else {
          td.textContent = text;
          td.title = text;
        }
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
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

function buildRequestModalLayout({ formFields, formId, linkedPos, linkedPoColumns, showBodyPoCount = false }) {
  const layout = document.createElement("div");
  layout.className = "shipment-modal-layout";

  const left = document.createElement("div");
  left.className = "shipment-modal-left";
  if (showBodyPoCount) left.appendChild(createRequestModalBodyPoCount(linkedPos.length));
  const form = document.createElement("div");
  form.className = "shipment-form-edit";
  form.id = formId;
  formFields.forEach(field => form.appendChild(field));
  left.appendChild(form);

  const right = document.createElement("div");
  right.className = "shipment-modal-right";
  right.appendChild(renderRequestLinkedPoTable(linkedPos, { columns: linkedPoColumns }));

  layout.appendChild(left);
  layout.appendChild(right);
  return layout;
}

function setRequestModalPoCount(el, count) {
  if (!el) return;
  const unit = count === 1 ? "PO" : "POs";
  el.innerHTML =
    `<span class="shipment-modal-po-count-num">${count}</span>` +
    `<span class="shipment-modal-po-count-unit">${unit}</span>`;
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

