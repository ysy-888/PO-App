function bringModalToFront(overlay) {
  document.querySelectorAll(".modal-backdrop.open").forEach(el => {
    el.style.zIndex = "1000";
  });
  if (overlay) {
    overlay.classList.add("open");
    overlay.style.zIndex = "1010";
  }
}

function openShipmentDetail(shipmentOrId) {
  if (isAppSaving()) return;
  const shipment = typeof shipmentOrId === "string"
    ? getShipmentById(shipmentOrId)
    : shipmentOrId;
  if (!shipment) return;

  closeCellSelectDropdown(false);
  shipmentModalRow = shipment;
  renderShipmentModalContent(shipment);
  bringModalToFront(document.getElementById("shipmentModalOverlay"));
}

function closeShipmentModalForce() {
  shipmentModalRow = null;
  shipmentAddPoPanelOpen = false;
  shipmentRequestedPanelSelection.clear();
  const overlay = document.getElementById("shipmentModalOverlay");
  if (overlay) overlay.classList.remove("open");
}

function openLinkedShipmentFromPo(row) {
  const id = String(row[SHIPMENT_ID_FIELD] ?? "").trim();
  if (!id) return;
  openShipmentDetail(id);
}

function openPoFromShipment(poNumber) {
  const row = allRows.find(r => String(r["PO #"]) === String(poNumber));
  if (!row) return;
  openPODetail(row);
  bringModalToFront(document.getElementById("modalOverlay"));
}

function createShipmentFormField(col, value, { readOnly = false } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "shipment-form-field";

  const label = document.createElement("label");
  label.className = "shipment-form-label";
  label.textContent = col;

  let input;
  if (col === "Notes") {
    input = document.createElement("textarea");
    input.rows = 3;
  } else if (SHIPMENT_DATE_FIELDS.has(col)) {
    input = document.createElement("input");
    input.type = "date";
    input.value = normalizeToYmd(value);
    input.classList.add("shipment-form-input--date");
    input.classList.toggle("shipment-form-input--empty", isEmptyValue(input.value));
    input.addEventListener("input", () => {
      input.classList.toggle("shipment-form-input--empty", isEmptyValue(input.value));
    });
  } else if (col === "Ship Method") {
    input = document.createElement("select");
    ["", ...SHIP_OPTIONS].forEach(opt => {
      const o = document.createElement("option");
      o.value = opt;
      o.textContent = opt || EMPTY_DISPLAY;
      if (String(value ?? "") === opt) o.selected = true;
      input.appendChild(o);
    });
  } else {
    input = document.createElement("input");
    input.type = "text";
    input.value = isEmptyValue(value) ? "" : String(value);
  }

  input.classList.add("shipment-form-input");
  input.dataset.field = col;
  if (readOnly) input.readOnly = true;

  wrap.appendChild(label);
  wrap.appendChild(input);
  return wrap;
}

function buildShipmentFormEdit(shipment, formId) {
  const form = document.createElement("div");
  form.className = "shipment-form-edit";
  form.id = formId;

  const mainGrid = document.createElement("div");
  mainGrid.className = "shipment-form-main-grid";
  SHIPMENT_MODAL_INFO_FIELDS.forEach(col => {
    mainGrid.appendChild(createShipmentFormField(col, shipment[col] ?? ""));
  });
  form.appendChild(mainGrid);

  const dateStack = document.createElement("div");
  dateStack.className = "shipment-form-date-stack";
  SHIPMENT_MODAL_DATE_FIELDS.forEach(col => {
    const field = createShipmentFormField(col, shipment[col] ?? "");
    field.classList.add("shipment-form-field--date");
    dateStack.appendChild(field);
  });
  form.appendChild(dateStack);

  const notesField = createShipmentFormField("Notes", shipment["Notes"] ?? "");
  notesField.classList.add("shipment-form-field--notes");
  form.appendChild(notesField);

  return form;
}

function buildShipmentModalLayout({ shipment = {}, formId, linkedSource, showAddPanel = false }) {
  const outer = document.createElement("div");
  outer.className = "shipment-modal-outer";
  outer.id = "shipmentModalOuter";

  const layout = document.createElement("div");
  layout.className = "shipment-modal-layout";

  const left = document.createElement("div");
  left.className = "shipment-modal-left";
  left.appendChild(buildShipmentFormEdit(shipment, formId));

  const right = document.createElement("div");
  right.className = "shipment-modal-right";
  right.appendChild(renderShipmentLinkedPoSection(linkedSource));

  layout.appendChild(left);
  layout.appendChild(right);
  outer.appendChild(layout);

  if (showAddPanel) {
    const available = getAvailableRequestedPos();
    outer.appendChild(renderRequestedPoPickerPanel(available, shipmentRequestedPanelSelection));
    outer.classList.add("shipment-modal-outer--add-panel-open");
  }

  return outer;
}

function getActiveShipmentModalButtons() {
  if (document.getElementById("createShipmentOverlay")?.classList.contains("open")) {
    return {
      addBtn: document.getElementById("shipmentAddPosBtn"),
      removeBtn: document.getElementById("shipmentRemovePosBtn"),
      confirmAddBtn: document.getElementById("shipmentConfirmAddPosBtn"),
    };
  }
  if (document.getElementById("shipmentModalOverlay")?.classList.contains("open")) {
    return {
      addBtn: document.getElementById("shipmentDetailAddPosBtn"),
      removeBtn: document.getElementById("shipmentDetailRemovePosBtn"),
      confirmAddBtn: document.getElementById("shipmentDetailConfirmAddPosBtn"),
    };
  }
  return { addBtn: null, removeBtn: null, confirmAddBtn: null };
}

function updateShipmentModalActionButtons() {
  const { addBtn, removeBtn, confirmAddBtn } = getActiveShipmentModalButtons();
  if (!addBtn && !removeBtn) return;

  const linked = getLinkedPosFromModalTable();
  const linkedSelected = linked.filter(row => isTruthy(row["Selected"])).length;

  if (addBtn) addBtn.hidden = shipmentAddPoPanelOpen || linkedSelected > 0;
  if (removeBtn) removeBtn.hidden = shipmentAddPoPanelOpen || linkedSelected === 0;
  if (confirmAddBtn) confirmAddBtn.hidden = !shipmentAddPoPanelOpen;
}

function openShipmentAddPoPanel() {
  shipmentAddPoPanelOpen = true;
  clearRequestedPanelSelections();
  rerenderOpenShipmentModalBody();
  updateShipmentModalActionButtons();
}

function closeShipmentAddPoPanel() {
  shipmentAddPoPanelOpen = false;
  clearRequestedPanelSelections();
  rerenderOpenShipmentModalBody();
  updateShipmentModalActionButtons();
}

function rerenderOpenShipmentModalBody() {
  const createOverlay = document.getElementById("createShipmentOverlay");
  const createForm = document.getElementById("createShipmentForm");
  const savedCreateShipment = createForm ? readShipmentForm(createForm) : {};

  if (createOverlay?.classList.contains("open")) {
    const body = document.getElementById("createShipmentBody");
    const pos = createShipmentPoNumbers
      .map(po => allRows.find(r => String(r["PO #"]) === String(po)))
      .filter(Boolean);
    if (body) {
      body.innerHTML = "";
      body.appendChild(buildShipmentModalLayout({
        shipment: savedCreateShipment,
        formId: "createShipmentForm",
        linkedSource: pos,
        showAddPanel: shipmentAddPoPanelOpen,
      }));
    }
    setShipmentModalPoCount(document.getElementById("createShipmentPoCount"), pos);
    return;
  }

  const detailBody = document.getElementById("shipmentModalBody");
  if (shipmentModalRow && detailBody) {
    detailBody.innerHTML = "";
    detailBody.appendChild(buildShipmentModalLayout({
      shipment: shipmentModalRow,
      formId: "shipmentEditForm",
      linkedSource: shipmentModalRow,
      showAddPanel: shipmentAddPoPanelOpen,
    }));
    setShipmentModalPoCount(document.getElementById("shipmentModalPoCount"), shipmentModalRow);
  }
}

async function confirmAddPosToShipment() {
  if (shipmentRequestedPanelSelection.size === 0) {
    showIndicator("Select POs to add", "error");
    return;
  }

  const poNumbers = [...shipmentRequestedPanelSelection];
  const createOverlay = document.getElementById("createShipmentOverlay");

  if (createOverlay?.classList.contains("open")) {
    const merged = new Set(createShipmentPoNumbers.map(String));
    poNumbers.forEach(po => merged.add(String(po)));
    createShipmentPoNumbers = [...merged];
    closeShipmentAddPoPanel();
    renderCreateShipmentModal(createShipmentPoNumbers);
    return;
  }

  if (!shipmentModalRow) return;
  const shipmentId = shipmentModalRow[SHIPMENT_ID_FIELD];
  if (!shipmentId) return;

  closeShipmentAddPoPanel();
  setAppSaving(true, "Adding POs…");
  showIndicator(`Adding POs${ELLIPSIS}`, "");

  try {
    if (isDemoMode()) {
      demoAddPosToShipment(shipmentId, poNumbers, shipmentModalRow);
    } else {
      const json = await postAppsScript({
        action: "addPosToShipment",
        shipmentId,
        poNumbers,
      });
      if (!json.success) throw new Error(json.error);
      await loadData();
      openShipmentDetail(shipmentId);
    }
    showIndicator(`POs added ${CHECK_MARK}`, "success");
  } catch (err) {
    showIndicator("Add failed: " + err.message, "error");
  } finally {
    setAppSaving(false);
  }
}

async function removePosFromShipment() {
  const linked = getLinkedPosFromModalTable().filter(row => isTruthy(row["Selected"]));
  if (linked.length === 0) {
    showIndicator("Select POs to remove", "error");
    return;
  }

  const createOverlay = document.getElementById("createShipmentOverlay");
  if (createOverlay?.classList.contains("open")) {
    const removeSet = new Set(linked.map(row => String(row["PO #"])));
    createShipmentPoNumbers = createShipmentPoNumbers.filter(po => !removeSet.has(String(po)));
    linked.forEach(row => toggleRowSelected(row, false));
    renderCreateShipmentModal(createShipmentPoNumbers);
    return;
  }

  if (!shipmentModalRow) return;
  const shipmentId = shipmentModalRow[SHIPMENT_ID_FIELD];
  const poNumbers = linked.map(row => row["PO #"]);

  setAppSaving(true, "Removing POs…");
  showIndicator(`Removing POs${ELLIPSIS}`, "");

  try {
    if (isDemoMode()) {
      demoRemovePosFromShipment(shipmentId, poNumbers);
    } else {
      const json = await postAppsScript({
        action: "removePosFromShipment",
        shipmentId,
        poNumbers,
      });
      if (!json.success) throw new Error(json.error);
      await loadData();
      openShipmentDetail(shipmentId);
    }
    showIndicator(`POs removed ${CHECK_MARK}`, "success");
  } catch (err) {
    showIndicator("Remove failed: " + err.message, "error");
  } finally {
    setAppSaving(false);
  }
}

function demoAddPosToShipment(shipmentId, poNumbers, shipment) {
  poNumbers.forEach(poNumber => {
    const row = allRows.find(r => String(r["PO #"]) === String(poNumber));
    if (!row) return;
    row[SHIPMENT_ID_FIELD] = shipmentId;
    row["Status"] = "OTW";
    SHIPMENT_PO_CLEAR_FIELDS.forEach(field => {
      if (shipment[field] !== undefined) row[field] = shipment[field];
    });
    row["EST IHD"] = calculateEstIhd(row["Ship Method"], row["EST EXF"]);
  });
  applyFilters();
  refreshShipmentsView();
}

function demoRemovePosFromShipment(shipmentId, poNumbers) {
  poNumbers.forEach(poNumber => {
    const row = allRows.find(r => String(r["PO #"]) === String(poNumber));
    if (!row) return;
    if (String(row[SHIPMENT_ID_FIELD]) !== String(shipmentId)) return;
    clearPoShipmentData(row);
  });
  applyFilters();
  refreshShipmentsView();
}

function readShipmentForm(container) {
  const data = {};
  container.querySelectorAll("[data-field]").forEach(el => {
    data[el.dataset.field] = el.value ?? "";
  });
  return data;
}

function renderCreateShipmentModal(poNumbers) {
  createShipmentPoNumbers = poNumbers.slice();
  shipmentAddPoPanelOpen = false;
  shipmentRequestedPanelSelection.clear();
  const body = document.getElementById("createShipmentBody");
  if (!body) return;

  const pos = poNumbers
    .map(po => allRows.find(r => String(r["PO #"]) === String(po)))
    .filter(Boolean);

  body.innerHTML = "";
  body.appendChild(buildShipmentModalLayout({
    shipment: {},
    formId: "createShipmentForm",
    linkedSource: pos,
    showAddPanel: false,
  }));
  setShipmentModalPoCount(document.getElementById("createShipmentPoCount"), pos);
  updateShipmentModalActionButtons();

  bringModalToFront(document.getElementById("createShipmentOverlay"));
}

function closeCreateShipmentModal() {
  createShipmentPoNumbers = [];
  shipmentAddPoPanelOpen = false;
  shipmentRequestedPanelSelection.clear();
  document.getElementById("createShipmentOverlay")?.classList.remove("open");
}

async function submitCreateShipment() {
  const form = document.getElementById("createShipmentForm");
  if (!form || createShipmentPoNumbers.length === 0) return;
  if (isAppSaving()) return;

  const shipment = readShipmentForm(form);
  const validationError = validateShipmentRequiredFields(shipment);
  if (validationError) {
    showIndicator(validationError, "error");
    return;
  }

  const poNumbers = createShipmentPoNumbers.slice();
  const alreadyAssigned = poNumbers.filter(po => {
    const row = allRows.find(r => String(r["PO #"]) === String(po));
    return row && poHasShipment(row);
  });
  if (alreadyAssigned.length > 0) {
    showIndicator(
      `Cannot create: PO ${alreadyAssigned.join(", ")} already on a shipment`,
      "error"
    );
    return;
  }

  const ineligible = poNumbers.filter(po => {
    const row = allRows.find(r => String(r["PO #"]) === String(po));
    return row && !isPoEligibleForShipment(row);
  });
  if (ineligible.length > 0) {
    showIndicator("Only EXF Requested POs with Status Requested can be added", "error");
    return;
  }
  closeCreateShipmentModal();
  setAppSaving(true, "Creating shipment…");
  showIndicator(`Creating shipment${ELLIPSIS}`, "");

  try {
    if (isDemoMode()) {
      await demoCreateShipment(poNumbers, shipment);
    } else {
      const json = await postAppsScript({
        action: "createShipment",
        poNumbers,
        shipment,
      });
      if (!json.success) throw new Error(json.error);
      await loadData();
    }
    showIndicator(`Shipment created ${CHECK_MARK}`, "success");
    switchAppView("shipments");
  } catch (err) {
    showIndicator("Create failed: " + err.message, "error");
  } finally {
    setAppSaving(false);
  }
}

function parseShipmentIdSequence(id) {
  const s = String(id ?? "").trim();
  let m = /^SHP-(\d{4})$/.exec(s);
  if (m) return Number(m[1]);
  m = /^SHP(\d{2})-(\d+)$/.exec(s);
  if (m) return Number(m[2]);
  m = /^SHP-(\d{4})-(\d+)$/.exec(s);
  if (m) return Number(m[2]);
  m = /^SHP-(\d+)$/.exec(s);
  if (m) return Number(m[1]);
  return 0;
}

function formatShipmentId(sequence) {
  return `SHP-${String(sequence).padStart(4, "0")}`;
}

function generateDemoShipmentId() {
  let max = 0;
  allShipments.forEach(shipment => {
    max = Math.max(max, parseShipmentIdSequence(shipment[SHIPMENT_ID_FIELD]));
  });
  return formatShipmentId(max + 1);
}

async function demoCreateShipment(poNumbers, shipment) {
  const blocked = poNumbers.filter(po => {
    const row = allRows.find(r => String(r["PO #"]) === String(po));
    return row && poHasShipment(row);
  });
  if (blocked.length > 0) {
    throw new Error(`${blocked.length} PO(s) already assigned to a shipment`);
  }

  const shipmentId = generateDemoShipmentId();
  const record = { [SHIPMENT_ID_FIELD]: shipmentId, ...shipment };
  allShipments.push(record);

  poNumbers.forEach(poNumber => {
    const row = allRows.find(r => String(r["PO #"]) === String(poNumber));
    if (!row) return;
    row[SHIPMENT_ID_FIELD] = shipmentId;
    row["Status"] = "OTW";
    ["Ship Method", "Vessel", "House #", "EXF", "Shipped", "ETD", "ETA", "IHD"].forEach(field => {
      if (shipment[field] !== undefined) row[field] = shipment[field];
    });
    row["EST IHD"] = calculateEstIhd(row["Ship Method"], row["EST EXF"]);
  });

  resetLocalSelectedState(allRows);
  applyFilters();
  refreshShipmentsView();
}

function formatShipmentLinkedPoCell(col, row) {
  let val = row[col];
  if (col === "Actual Qty" && typeof getPackingActualQtyForRow === "function") {
    val = getPackingActualQtyForRow(row);
  }
  if (col === "Ctn Qty" && typeof getPackingCtnQtyForRow === "function") {
    val = getPackingCtnQtyForRow(row);
  }
  if (col === "CXL Date") {
    if (isEmptyValue(val)) return EMPTY_DISPLAY;
    return formatDateForDisplay(val);
  }
  if (col === "Actual Qty" || col === "Ctn Qty") {
    if (toQtyNumber(val) <= 0) return EMPTY_DISPLAY;
    return String(val);
  }
  if (isEmptyValue(val)) return EMPTY_DISPLAY;
  return String(val);
}

function getLinkedPoRows(source) {
  if (Array.isArray(source)) return source;
  return getPosForShipment(source[SHIPMENT_ID_FIELD]);
}

function setShipmentModalPoCount(el, source) {
  if (!el) return;
  const count = getLinkedPoRows(source).length;
  const unit = count === 1 ? "PO" : "POs";
  el.innerHTML =
    `<span class="shipment-modal-po-count-num">${count}</span>` +
    `<span class="shipment-modal-po-count-unit">${unit}</span>`;
}

function getLinkedPosFromModalTable() {
  const tbody = document.querySelector(".shipment-linked-po-table tbody");
  if (!tbody) return [];
  return [...tbody.querySelectorAll("tr[data-po]")]
    .map(tr => findRowByPo(tr.dataset.po))
    .filter(Boolean);
}

function updateShipmentLinkedPoSelectAllHeader(pos) {
  const cb = document.getElementById("shipmentLinkedPoSelectAll");
  if (!cb) return;

  if (pos.length === 0) {
    cb.checked = false;
    cb.indeterminate = false;
    cb.disabled = true;
    return;
  }

  cb.disabled = false;
  const selectedCount = pos.filter(row => isTruthy(row["Selected"])).length;
  cb.checked = selectedCount === pos.length;
  cb.indeterminate = selectedCount > 0 && selectedCount < pos.length;
}

function syncLinkedPoTableCheckboxes(pos) {
  const tbody = document.querySelector(".shipment-linked-po-table tbody");
  if (!tbody) return;
  pos.forEach(row => {
    const po = String(row["PO #"] ?? "");
    const tr = [...tbody.querySelectorAll("tr[data-po]")].find(el => String(el.dataset.po) === po);
    const cb = tr?.querySelector(".po-select-checkbox");
    if (cb) cb.checked = isTruthy(row["Selected"]);
  });
  updateShipmentLinkedPoSelectAllHeader(pos);
}

function setAllLinkedPosSelected(pos, selected) {
  let changed = false;
  if (selected && shipmentAddPoPanelOpen) {
    clearRequestedPanelSelections();
  }
  pos.forEach(row => {
    if (toggleRowSelected(row, selected)) changed = true;
  });
  if (changed) {
    syncLinkedPoTableCheckboxes(pos);
    updateShipmentModalActionButtons();
  }
}

function renderShipmentLinkedPoSection(source) {
  const section = document.createElement("section");
  section.className = "shipment-linked-pos";

  const pos = getLinkedPoRows(source);
  const count = pos.length;

  if (count === 0) {
    const empty = document.createElement("p");
    empty.className = "shipment-linked-empty";
    empty.textContent = "No POs linked to this shipment.";
    section.appendChild(empty);
    return section;
  }

  const wrap = document.createElement("div");
  wrap.className = "shipment-linked-po-table-wrap";

  const table = document.createElement("table");
  table.className = "shipment-linked-po-table";

  const colgroup = document.createElement("colgroup");
  SHIPMENT_LINKED_PO_COL_CLASSES.forEach((className, i) => {
    const col = document.createElement("col");
    col.className = className;
    const width = SHIPMENT_LINKED_PO_COLUMN_WIDTHS[i];
    if (width != null) col.style.width = `${width}px`;
    colgroup.appendChild(col);
  });
  table.appendChild(colgroup);

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");

  const selectTh = document.createElement("th");
  selectTh.className = "th-select-col";
  const selectAllCb = document.createElement("input");
  selectAllCb.type = "checkbox";
  selectAllCb.id = "shipmentLinkedPoSelectAll";
  selectAllCb.setAttribute("aria-label", "Select all linked POs");
  selectAllCb.addEventListener("change", () => {
    setAllLinkedPosSelected(pos, selectAllCb.checked);
  });
  selectTh.appendChild(selectAllCb);
  headRow.appendChild(selectTh);

  SHIPMENT_LINKED_PO_COLUMNS.forEach(({ label, cellClass }) => {
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

    const selectTd = document.createElement("td");
    renderSelectedCell(selectTd, row);
    const linkedCb = selectTd.querySelector(".po-select-checkbox");
    linkedCb?.addEventListener("change", () => {
      if (linkedCb.checked && shipmentAddPoPanelOpen) {
        clearRequestedPanelSelections();
      }
      updateShipmentModalActionButtons();
    });
    tr.appendChild(selectTd);

    SHIPMENT_LINKED_PO_COLUMNS.forEach(({ col, cellClass }) => {
      const td = document.createElement("td");
      if (cellClass) td.className = cellClass;
      const text = formatShipmentLinkedPoCell(col, row);
      if (col === "PO #") {
        if (text === EMPTY_DISPLAY) {
          setDisplayText(td, EMPTY_DISPLAY);
        } else {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "shipment-linked-po-link";
          btn.textContent = text;
          btn.title = "Open PO detail";
          btn.addEventListener("click", e => {
            e.stopPropagation();
            openPoFromShipment(row["PO #"]);
          });
          td.appendChild(btn);
        }
      } else if (text === EMPTY_DISPLAY) {
        setDisplayText(td, EMPTY_DISPLAY);
      } else {
        td.textContent = text;
        td.title = text;
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  section.appendChild(wrap);
  updateShipmentLinkedPoSelectAllHeader(pos);
  return section;
}

function renderShipmentModalContent(shipment) {
  const idEl = document.getElementById("shipmentModalId");
  const body = document.getElementById("shipmentModalBody");
  if (!idEl || !body) return;

  shipmentAddPoPanelOpen = false;
  shipmentRequestedPanelSelection.clear();
  idEl.textContent = shipment[SHIPMENT_ID_FIELD] ?? EMPTY_DISPLAY;
  setShipmentModalPoCount(document.getElementById("shipmentModalPoCount"), shipment);
  body.innerHTML = "";
  body.appendChild(buildShipmentModalLayout({
    shipment,
    formId: "shipmentEditForm",
    linkedSource: shipment,
    showAddPanel: false,
  }));
  updateShipmentModalActionButtons();
}

async function saveShipmentModal() {
  if (isAppSaving() || !shipmentModalRow) return;
  const form = document.getElementById("shipmentEditForm");
  if (!form) return;

  const shipment = readShipmentForm(form);
  const validationError = validateShipmentRequiredFields(shipment);
  if (validationError) {
    showIndicator(validationError, "error");
    return;
  }

  const shipmentId = shipmentModalRow[SHIPMENT_ID_FIELD];
  const savedRowRef = shipmentModalRow;
  closeShipmentModalForce();
  setAppSaving(true, "Saving…");
  showIndicator(`Saving${ELLIPSIS}`, "");

  try {
    if (isDemoMode()) {
      Object.assign(savedRowRef, shipment);
      getPosForShipment(shipmentId).forEach(row => {
        ["Ship Method", "Vessel", "House #", "EXF", "Shipped", "ETD", "ETA", "IHD"].forEach(field => {
          if (shipment[field] !== undefined) row[field] = shipment[field];
        });
        row["EST IHD"] = calculateEstIhd(row["Ship Method"], row["EST EXF"]);
      });
      applyFilters();
      refreshShipmentsView();
    } else {
      const json = await postAppsScript({
        action: "updateShipment",
        shipmentId,
        shipment,
      });
      if (!json.success) throw new Error(json.error);
      await loadData();
    }
    showIndicator(`Saved ${CHECK_MARK}`, "success");
  } catch (err) {
    showIndicator("Save failed: " + err.message, "error");
  } finally {
    setAppSaving(false);
  }
}

async function deleteSelectedShipments() {
  if (isAppSaving()) return;
  const selected = getCheckedFilteredShipments();
  if (selected.length === 0) {
    showIndicator("Select shipments first", "error");
    return;
  }

  const count = selected.length;
  const noun = count === 1 ? "this shipment" : `these ${count} shipments`;
  if (!confirm(`Delete ${noun}? Linked PO shipment fields will be cleared.`)) return;

  const shipmentIds = selected.map(s => s[SHIPMENT_ID_FIELD]);
  const openId = shipmentModalRow?.[SHIPMENT_ID_FIELD];
  showIndicator(`Deleting${ELLIPSIS}`, "");

  try {
    if (isDemoMode()) {
      demoDeleteShipments(shipmentIds);
    } else {
      const json = await postAppsScript({
        action: "deleteShipment",
        shipmentIds,
      });
      if (!json.success) throw new Error(json.error);
      await loadData();
    }

    if (openId && shipmentIds.some(id => String(id) === String(openId))) {
      closeShipmentModalForce();
    }

    showIndicator(`Deleted ${CHECK_MARK}`, "success");
  } catch (err) {
    showIndicator("Delete failed: " + err.message, "error");
  }
}

async function deleteSelectedChargebacks() {
  if (isAppSaving()) return;
  const selected = getCheckedFilteredChargebacks();
  if (selected.length === 0) {
    showIndicator("Select chargebacks first", "error");
    return;
  }

  const count = selected.length;
  const noun = count === 1 ? "this chargeback" : `these ${count} chargebacks`;
  if (!confirm(`Delete ${noun}?`)) return;

  const chargebackIds = selected.map(chargeback => chargeback[CHARGEBACK_ID_FIELD]);
  showIndicator(`Deleting${ELLIPSIS}`, "");

  try {
    if (isDemoMode()) {
      demoDeleteChargebacks(chargebackIds);
    } else {
      const json = await postAppsScript({
        action: "deleteChargeback",
        chargebackIds,
      });
      if (!json.success) throw new Error(json.error);
      await loadData();
    }

    showIndicator(`Deleted ${CHECK_MARK}`, "success");
  } catch (err) {
    showIndicator("Delete failed: " + err.message, "error");
  }
}

function demoDeleteChargebacks(chargebackIds) {
  const idSet = new Set(chargebackIds.map(id => String(id).trim()));
  allChargebacks = allChargebacks.filter(chargeback => !idSet.has(getChargebackId(chargeback)));
  applyChargebackFilters();
  updateModalIfOpen();
}

function demoDeleteShipments(shipmentIds) {
  const idSet = new Set(shipmentIds.map(id => String(id).trim()));

  idSet.forEach(shipmentId => {
    getPosForShipment(shipmentId).forEach(row => clearPoShipmentData(row));
  });

  allShipments = allShipments.filter(s => !idSet.has(String(s[SHIPMENT_ID_FIELD] ?? "").trim()));
  resetLocalShipmentSelectedState(allShipments);
  applyFilters();
  refreshShipmentsView();
}

function openCreateShipmentFromSelection() {
  if (isAppSaving()) return;
  const selected = getCheckedFilteredPos();
  if (selected.length === 0) {
    showIndicator("Select POs first", "error");
    return;
  }

  const eligible = getEligibleCheckedFilteredPosForShipment();
  const skipped = selected.length - eligible.length;

  if (eligible.length === 0) {
    showIndicator("Selected POs must be EXF Requested with Status Requested", "error");
    return;
  }

  if (skipped > 0) {
    showIndicator(
      `${skipped} PO${skipped === 1 ? "" : "s"} skipped (not eligible)`,
      ""
    );
  }

  renderCreateShipmentModal(eligible.map(row => row["PO #"]));
}

function renderPoModalLinkedShipment(row) {
  const slot = document.getElementById("modalLinkedShipment");
  if (!slot) return;

  slot.replaceChildren();
  const id = getPoShipmentId(row);
  if (isEmptyValue(id) || !getShipmentById(id)) {
    slot.hidden = true;
    return;
  }

  slot.hidden = false;

  const label = document.createElement("span");
  label.className = "modal-linked-shipment-label";
  label.textContent = "Linked Shipment";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "modal-linked-shipment-header-link";
  btn.textContent = id;
  btn.title = "Open linked shipment";
  btn.addEventListener("click", e => {
    e.stopPropagation();
    openLinkedShipmentFromPo(row);
  });

  slot.appendChild(label);
  slot.appendChild(btn);
}
