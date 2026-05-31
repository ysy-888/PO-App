/** Shared modal layout for EXF / delivery / pickup request modals. */

const REQUEST_LINKED_PO_COLUMNS = [
  { col: "PO #", label: "PO #", cellClass: "shipment-po-cell-id" },
  { col: "Status", label: "Status", cellClass: "shipment-po-cell-wrap" },
  { col: "Style #", label: "Style #", cellClass: "shipment-po-cell-wrap" },
  { col: "Vendor", label: "Vendor", cellClass: "shipment-po-cell-vendor" },
  { col: "Buyer", label: "Buyer", cellClass: "shipment-po-cell-buyer" },
  { col: "PO Qty", label: "Order Qty", cellClass: "shipment-po-cell-qty" },
];

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

function renderRequestedPoPickerPanel(pos, { disabled = false } = {}) {
  const panel = document.createElement("aside");
  panel.className = "shipment-add-po-panel";
  panel.id = "shipmentAddPoPanel";

  const header = document.createElement("div");
  header.className = "shipment-add-po-panel-header";
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "shipment-add-po-panel-close";
  closeBtn.setAttribute("aria-label", "Close requested POs panel");
  closeBtn.innerHTML = '<span aria-hidden="true"></span>';
  closeBtn.addEventListener("click", closeShipmentAddPoPanel);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  if (pos.length === 0) {
    const empty = document.createElement("p");
    empty.className = "shipment-linked-empty";
    empty.textContent = "No requested POs available.";
    panel.appendChild(empty);
    return panel;
  }

  const wrap = document.createElement("div");
  wrap.className = "shipment-linked-po-table-wrap shipment-requested-po-table-wrap";

  const table = document.createElement("table");
  table.className = "shipment-linked-po-table shipment-requested-po-table";

  const colgroup = document.createElement("colgroup");
  [
    "shipment-requested-po-col-select",
    "shipment-requested-po-col-id",
    "shipment-requested-po-col-buyer",
    "shipment-requested-po-col-buyer-po",
    "shipment-requested-po-col-style",
  ].forEach(className => {
    const col = document.createElement("col");
    col.className = className;
    colgroup.appendChild(col);
  });
  table.appendChild(colgroup);

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const selectTh = document.createElement("th");
  selectTh.className = "th-select-col";
  selectTh.textContent = "";
  headRow.appendChild(selectTh);

  [
    { label: "PO #" },
    { label: "Buyer" },
    { label: "Buyer PO #" },
    { label: "Style #" },
  ].forEach(({ label }) => {
    const th = document.createElement("th");
    th.textContent = label;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  pos.forEach(row => {
    const po = String(row["PO #"] ?? "");
    const tr = document.createElement("tr");
    tr.dataset.po = po;

    const selectTd = document.createElement("td");
    selectTd.className = "td-select-cell";
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "shipment-requested-po-add";
    addBtn.disabled = disabled;
    addBtn.setAttribute("aria-label", `Add PO ${po} to shipment`);
    addBtn.title = "Add PO to shipment";
    addBtn.textContent = "+";
    addBtn.addEventListener("click", e => {
      e.stopPropagation();
      addRequestedPoToShipment(po);
    });
    selectTd.appendChild(addBtn);
    tr.appendChild(selectTd);

    ["PO #", "Buyer", "Buyer PO #", "Style #"].forEach(col => {
      const td = document.createElement("td");
      const text = formatShipmentLinkedPoCell(col, row);
      if (text === EMPTY_DISPLAY) setDisplayText(td, EMPTY_DISPLAY);
      else {
        td.textContent = text;
        td.title = text;
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  panel.appendChild(wrap);
  return panel;
}

