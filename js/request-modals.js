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

function renderRequestLinkedPoTable(pos) {
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
  REQUEST_LINKED_PO_COLUMNS.forEach(({ label, cellClass }) => {
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
    REQUEST_LINKED_PO_COLUMNS.forEach(({ col, cellClass }) => {
      const td = document.createElement("td");
      if (cellClass) td.className = cellClass;
      if (col === "Status") {
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

function buildRequestModalLayout({ formFields, formId, linkedPos }) {
  const layout = document.createElement("div");
  layout.className = "shipment-modal-layout";

  const left = document.createElement("div");
  left.className = "shipment-modal-left";
  const form = document.createElement("div");
  form.className = "shipment-form-edit";
  form.id = formId;
  formFields.forEach(field => form.appendChild(field));
  left.appendChild(form);

  const right = document.createElement("div");
  right.className = "shipment-modal-right";
  right.appendChild(renderRequestLinkedPoTable(linkedPos));

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

function renderRequestedPoPickerPanel(pos, selectedSet, { disabled = false } = {}) {
  const panel = document.createElement("aside");
  panel.className = "shipment-add-po-panel";
  panel.id = "shipmentAddPoPanel";

  const header = document.createElement("div");
  header.className = "shipment-add-po-panel-header";
  header.innerHTML = "<h4>Requested POs</h4>";
  panel.appendChild(header);

  if (pos.length === 0) {
    const empty = document.createElement("p");
    empty.className = "shipment-linked-empty";
    empty.textContent = "No requested POs available.";
    panel.appendChild(empty);
    return panel;
  }

  const wrap = document.createElement("div");
  wrap.className = "shipment-linked-po-table-wrap";

  const table = document.createElement("table");
  table.className = "shipment-linked-po-table";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const selectTh = document.createElement("th");
  selectTh.className = "th-select-col";
  const selectAllCb = document.createElement("input");
  selectAllCb.type = "checkbox";
  selectAllCb.id = "requestedPoPanelSelectAll";
  selectAllCb.disabled = disabled;
  selectAllCb.addEventListener("change", () => {
    if (disabled) return;
    clearLinkedPoSelectionsForAddPanel();
    pos.forEach(row => {
      const po = String(row["PO #"] ?? "");
      if (selectAllCb.checked) selectedSet.add(po);
      else selectedSet.delete(po);
    });
    syncRequestedPoPanelCheckboxes(pos, selectedSet);
    updateShipmentModalActionButtons();
  });
  selectTh.appendChild(selectAllCb);
  headRow.appendChild(selectTh);

  [
    { label: "PO #" },
    { label: "Style #" },
    { label: "Vendor" },
    { label: "Buyer" },
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
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "po-select-checkbox requested-panel-checkbox";
    cb.checked = selectedSet.has(po);
    cb.disabled = disabled;
    cb.addEventListener("change", () => {
      if (disabled) return;
      clearLinkedPoSelectionsForAddPanel();
      if (cb.checked) selectedSet.add(po);
      else selectedSet.delete(po);
      syncRequestedPoPanelCheckboxes(pos, selectedSet);
      updateShipmentModalActionButtons();
    });
    selectTd.appendChild(cb);
    tr.appendChild(selectTd);

    ["PO #", "Style #", "Vendor", "Buyer"].forEach(col => {
      const td = document.createElement("td");
      const text = formatShipmentLinkedPoCell(col, row);
      if (text === EMPTY_DISPLAY) setDisplayText(td, EMPTY_DISPLAY);
      else td.textContent = text;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  panel.appendChild(wrap);
  syncRequestedPoPanelCheckboxes(pos, selectedSet);
  return panel;
}

function syncRequestedPoPanelCheckboxes(pos, selectedSet) {
  const tbody = document.querySelector("#shipmentAddPoPanel tbody");
  if (!tbody) return;
  pos.forEach(row => {
    const po = String(row["PO #"] ?? "");
    const tr = tbody.querySelector(`tr[data-po="${CSS.escape(po)}"]`);
    const cb = tr?.querySelector(".requested-panel-checkbox");
    if (cb) cb.checked = selectedSet.has(po);
  });
  const cb = document.getElementById("requestedPoPanelSelectAll");
  if (!cb) return;
  const count = pos.filter(row => selectedSet.has(String(row["PO #"] ?? ""))).length;
  cb.checked = pos.length > 0 && count === pos.length;
  cb.indeterminate = count > 0 && count < pos.length;
}

function clearLinkedPoSelectionsForAddPanel() {
  shipmentRequestedPanelSelection.clear();
  const linked = getLinkedPosFromModalTable();
  linked.forEach(row => {
    if (isTruthy(row["Selected"])) toggleRowSelected(row, false);
  });
  syncLinkedPoTableCheckboxes(linked);
}

function clearRequestedPanelSelections() {
  shipmentRequestedPanelSelection.clear();
  syncRequestedPoPanelCheckboxes(getAvailableRequestedPos(), shipmentRequestedPanelSelection);
}
