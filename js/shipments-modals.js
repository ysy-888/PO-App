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
  clearMainTableSelection();
  clearShipmentFormSelection();
  shipmentModalRow = shipment;
  renderShipmentModalContent(shipment);
  bringModalToFront(document.getElementById("shipmentModalOverlay"));
}

function closeShipmentModalForce() {
  shipmentModalRow = null;
  shipmentAddPoPanelOpen = false;
  clearShipmentFormSelection();
  clearShipmentFooterMessage("shipmentModalFooterMessage");
  const overlay = document.getElementById("shipmentModalOverlay");
  if (overlay) overlay.classList.remove("open");
  setShipmentModalAddPanelClass(document.getElementById("shipmentModalBody"), false);
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
    input.classList.add("shipment-form-input");
    input.value = isEmptyValue(value) ? "" : String(value);
    wrap.appendChild(label);
    wrap.appendChild(input);
  } else if (SHIPMENT_DATE_FIELDS.has(col)) {
    const dateInput = createCompactDateInput({
      initialYmd: value,
      readOnly,
      inputClassName: "shipment-form-input shipment-form-input--date",
      placeholder: "",
    });
    input = dateInput.input;
    wrap.appendChild(label);
    wrap.appendChild(dateInput.wrap);
  } else if (col === "Ship Method") {
    input = document.createElement("select");
    ["", ...SHIP_OPTIONS].forEach(opt => {
      const o = document.createElement("option");
      o.value = opt;
      o.textContent = opt || EMPTY_DISPLAY;
      if (String(value ?? "") === opt) o.selected = true;
      input.appendChild(o);
    });
    input.classList.add("shipment-form-input");
    wrap.appendChild(label);
    wrap.appendChild(input);
  } else {
    input = document.createElement("input");
    input.type = "text";
    input.value = isEmptyValue(value) ? "" : String(value);
    input.classList.add("shipment-form-input");
    wrap.appendChild(label);
    wrap.appendChild(input);
  }

  input.dataset.field = col;
  if (readOnly) input.readOnly = true;
  return wrap;
}

const CREATE_SHIPMENT_ENTER_FIELDS = [
  "Vessel", "House #", "EXF", "Shipped", "ETD", "ETA", "IHD",
];

function bindCreateShipmentEnterNavigation(form) {
  form.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;
    const target = e.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
    const field = target.dataset.field;
    if (!field) return;

    if (field === "Notes") {
      if (e.shiftKey) return;
      e.preventDefault();
      target.blur();
      return;
    }

    const idx = CREATE_SHIPMENT_ENTER_FIELDS.indexOf(field);
    if (idx === -1) return;

    e.preventDefault();
    const nextField = CREATE_SHIPMENT_ENTER_FIELDS[idx + 1];
    if (nextField) {
      const nextEl = form.querySelector(`[data-field="${CSS.escape(nextField)}"]`);
      if (nextEl) {
        nextEl.focus();
        if (nextEl instanceof HTMLInputElement) nextEl.select();
      }
    } else {
      target.blur();
    }
  });
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

  if (formId === "createShipmentForm") {
    bindCreateShipmentEnterNavigation(form);
  }

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
    const available = getRequestedPoPanelRows(linkedSource);
    outer.appendChild(renderRequestedPoPickerPanel(available));
    outer.classList.add("shipment-modal-outer--add-panel-open");
  }

  return outer;
}

function setShipmentModalAddPanelClass(body, isOpen) {
  body?.closest(".shipment-modal-card")?.classList.toggle("shipment-modal-card--add-panel-open", isOpen);
}

function getActiveShipmentModalButtons() {
  if (document.getElementById("createShipmentOverlay")?.classList.contains("open")) {
    return {
      addBtn: document.getElementById("shipmentAddPosBtn"),
      removeBtn: document.getElementById("shipmentRemovePosBtn"),
    };
  }
  if (document.getElementById("shipmentModalOverlay")?.classList.contains("open")) {
    return {
      addBtn: document.getElementById("shipmentDetailAddPosBtn"),
      removeBtn: document.getElementById("shipmentDetailRemovePosBtn"),
    };
  }
  return { addBtn: null, removeBtn: null };
}

function getActiveShipmentModalScope() {
  return document.querySelector("#createShipmentOverlay.open, #shipmentModalOverlay.open") ?? document;
}

function getActiveShipmentModalOverlay() {
  return document.querySelector("#createShipmentOverlay.open, #shipmentModalOverlay.open");
}

function setShipmentFooterMessage(message = "") {
  const overlay = getActiveShipmentModalOverlay();
  if (!overlay) return;
  clearModalFooterMessageForOverlay(overlay);
  if (message) {
    setModalFooterMessage(message, "error", { persist: true, overlay });
  }
}

function clearShipmentFooterMessage(id) {
  const overlay = document.getElementById(id)?.closest(".modal-backdrop");
  clearModalFooterMessageForOverlay(overlay || id);
}

function updateShipmentModalActionButtons() {
  const { addBtn, removeBtn } = getActiveShipmentModalButtons();
  const scope = getActiveShipmentModalScope();
  const footerAddBtn = scope.querySelector(".shipment-linked-po-footer-add");
  const footerRemoveBtn = scope.querySelector(".shipment-linked-po-footer-remove");
  if (!addBtn && !removeBtn && !footerAddBtn && !footerRemoveBtn) return;

  const linked = getLinkedPosFromModalTable();
  const linkedSelected = linked.filter(isShipmentFormPoSelected).length;
  const showAdd = !shipmentAddPoPanelOpen && linkedSelected === 0;
  const showRemove = !shipmentAddPoPanelOpen && linkedSelected > 0;

  if (addBtn) addBtn.hidden = true;
  if (removeBtn) removeBtn.hidden = true;
  if (footerAddBtn) footerAddBtn.hidden = !showAdd;
  if (footerRemoveBtn) footerRemoveBtn.hidden = !showRemove;
}

function openShipmentAddPoPanel() {
  clearShipmentFormSelection();
  shipmentAddPoPanelOpen = true;
  rerenderOpenShipmentModalBody();
  updateShipmentModalActionButtons();
}

function closeShipmentAddPoPanel() {
  shipmentAddPoPanelOpen = false;
  rerenderOpenShipmentModalBody();
  updateShipmentModalActionButtons();
}

function getRequestedPoPanelRows(linkedSource) {
  const linkedPoNumbers = new Set(
    getLinkedPoRows(linkedSource).map(row => String(row["PO #"] ?? ""))
  );
  return getAvailableRequestedPos()
    .filter(row => !linkedPoNumbers.has(String(row["PO #"] ?? "")));
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
      setShipmentModalAddPanelClass(body, shipmentAddPoPanelOpen);
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
    setShipmentModalAddPanelClass(detailBody, shipmentAddPoPanelOpen);
    setShipmentModalPoCount(document.getElementById("shipmentModalPoCount"), shipmentModalRow);
  }
}

async function addRequestedPoToShipment(poNumber) {
  if (isAppSaving()) return;
  const po = String(poNumber ?? "").trim();
  if (!po) return;
  await addPosToShipment([po], { keepPanelOpen: true });
}

async function addPosToShipment(poNumbers, { keepPanelOpen = false } = {}) {
  const createOverlay = document.getElementById("createShipmentOverlay");

  if (createOverlay?.classList.contains("open")) {
    const merged = new Set(createShipmentPoNumbers.map(String));
    poNumbers.forEach(po => merged.add(String(po)));
    createShipmentPoNumbers = [...merged];
    if (keepPanelOpen) {
      shipmentAddPoPanelOpen = true;
      rerenderOpenShipmentModalBody();
      updateShipmentModalActionButtons();
    } else {
      closeShipmentAddPoPanel();
      renderCreateShipmentModal(createShipmentPoNumbers);
    }
    return;
  }

  if (!shipmentModalRow) return;
  const shipmentId = shipmentModalRow[SHIPMENT_ID_FIELD];
  if (!shipmentId) return;

  if (shipmentOpInProgress) return;
  if (!keepPanelOpen) closeShipmentAddPoPanel();
  shipmentOpInProgress = true;
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
      applyPosAddedToShipmentLocally(shipmentId, poNumbers, shipmentModalRow);
      shipmentModalRow = getShipmentById(shipmentId) ?? shipmentModalRow;
    }
    if (keepPanelOpen) {
      shipmentAddPoPanelOpen = true;
      rerenderOpenShipmentModalBody();
      updateShipmentModalActionButtons();
    } else {
      openShipmentDetail(shipmentId);
    }
    showIndicator(`${poNumbers.length === 1 ? "PO" : "POs"} added ${CHECK_MARK}`, "success");
  } catch (err) {
    showIndicator("Add failed: " + err.message, "error");
  } finally {
    shipmentOpInProgress = false;
  }
}

async function removePosFromShipment() {
  const linked = getLinkedPosFromModalTable().filter(isShipmentFormPoSelected);
  if (linked.length === 0) {
    showIndicator("Select POs to remove", "error");
    return;
  }

  const createOverlay = document.getElementById("createShipmentOverlay");
  if (createOverlay?.classList.contains("open")) {
    const removeSet = new Set(linked.map(row => String(row["PO #"])));
    createShipmentPoNumbers = createShipmentPoNumbers.filter(po => !removeSet.has(String(po)));
    linked.forEach(row => toggleShipmentFormPoSelected(row, false));
    rerenderOpenShipmentModalBody();
    updateShipmentModalActionButtons();
    return;
  }

  if (!shipmentModalRow) return;
  if (shipmentOpInProgress) return;
  const shipmentId = shipmentModalRow[SHIPMENT_ID_FIELD];
  const poNumbers = linked.map(row => row["PO #"]);

  shipmentOpInProgress = true;
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
      applyPosRemovedFromShipmentLocally(shipmentId, poNumbers);
      openShipmentDetail(shipmentId);
    }
    showIndicator(`POs removed ${CHECK_MARK}`, "success");
  } catch (err) {
    showIndicator("Remove failed: " + err.message, "error");
  } finally {
    shipmentOpInProgress = false;
  }
}

function demoAddPosToShipment(shipmentId, poNumbers, shipment) {
  applyPosAddedToShipmentLocally(shipmentId, poNumbers, shipment);
}

function demoRemovePosFromShipment(shipmentId, poNumbers) {
  applyPosRemovedFromShipmentLocally(shipmentId, poNumbers);
}

function readShipmentForm(container) {
  const data = {};
  container.querySelectorAll("[data-field]").forEach(el => {
    const field = el.dataset.field;
    data[field] = SHIPMENT_DATE_FIELDS.has(field)
      ? readCompactDateInputValue(el)
      : el.value ?? "";
  });
  return data;
}

function getMajorityShipMethodFromPoRows(rows) {
  const counts = new Map();
  rows.forEach(row => {
    const method = normalizeShipMethod(row["Ship Method"]);
    if (isEmptyValue(method)) return;
    counts.set(method, (counts.get(method) ?? 0) + 1);
  });
  if (counts.size === 0) return "";

  let best = "";
  let bestCount = 0;
  SHIP_OPTIONS.forEach(opt => {
    const count = counts.get(opt) ?? 0;
    if (count > bestCount) {
      bestCount = count;
      best = opt;
    }
  });
  return best;
}

function renderCreateShipmentModal(poNumbers) {
  createShipmentPoNumbers = poNumbers.slice();
  shipmentAddPoPanelOpen = false;
  clearShipmentFooterMessage("createShipmentFooterMessage");
  const body = document.getElementById("createShipmentBody");
  if (!body) return;

  const pos = poNumbers
    .map(po => allRows.find(r => String(r["PO #"]) === String(po)))
    .filter(Boolean);
  pruneShipmentFormSelection(pos);

  const shipMethod = getMajorityShipMethodFromPoRows(pos);
  const defaultShipment = shipMethod ? { "Ship Method": shipMethod } : {};

  body.innerHTML = "";
  body.appendChild(buildShipmentModalLayout({
    shipment: defaultShipment,
    formId: "createShipmentForm",
    linkedSource: pos,
    showAddPanel: false,
  }));
  setShipmentModalAddPanelClass(body, false);
  setShipmentModalPoCount(document.getElementById("createShipmentPoCount"), pos);

  bringModalToFront(document.getElementById("createShipmentOverlay"));
  updateShipmentModalActionButtons();
  updateToolbarRequestButtons();
}

function closeCreateShipmentModal() {
  createShipmentPoNumbers = [];
  shipmentAddPoPanelOpen = false;
  clearShipmentFormSelection();
  clearShipmentFooterMessage("createShipmentFooterMessage");
  document.getElementById("createShipmentOverlay")?.classList.remove("open");
  setShipmentModalAddPanelClass(document.getElementById("createShipmentBody"), false);
  updateToolbarRequestButtons();
}

async function submitCreateShipment() {
  const form = document.getElementById("createShipmentForm");
  if (!form || createShipmentPoNumbers.length === 0) return;
  if (shipmentOpInProgress) return;

  const shipment = readShipmentForm(form);
  setShipmentFooterMessage("");
  const validationError = validateShipmentRequiredFields(shipment);
  if (validationError) {
    setShipmentFooterMessage(validationError);
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
  beginToolbarCreatePending();
  closeCreateShipmentModal();
  shipmentOpInProgress = true;
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
      applyShipmentCreatedLocally(json.shipmentId, poNumbers, shipment);
    }
    showIndicator(`Shipment created ${CHECK_MARK}`, "success");
  } catch (err) {
    showIndicator("Create failed: " + err.message, "error");
  } finally {
    shipmentOpInProgress = false;
    endToolbarCreatePending();
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

// Serializes shipment write operations so overlapping optimistic updates can't
// race each other. Scoped to shipments only — the rest of the app stays usable.
let shipmentOpInProgress = false;

function isShipmentOpInProgress() {
  return shipmentOpInProgress;
}

// --- Optimistic local state updates ---------------------------------------
// These mirror the server's syncPosFromShipment_ / clearPoShipmentDataAtRow_
// so the UI can reflect a successful write without re-downloading every sheet.

function applyShipmentSyncToPosLocally(shipmentId, poNumbers, shipment) {
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
}

function applyShipmentCreatedLocally(shipmentId, poNumbers, shipment) {
  allShipments.push(normalizeShipment({ [SHIPMENT_ID_FIELD]: shipmentId, ...shipment }));
  applyShipmentSyncToPosLocally(shipmentId, poNumbers, shipment);
  resetLocalSelectedState(allRows);
  applyFilters();
  refreshShipmentsView();
}

function applyPosAddedToShipmentLocally(shipmentId, poNumbers, shipment) {
  applyShipmentSyncToPosLocally(shipmentId, poNumbers, shipment);
  applyFilters();
  refreshShipmentsView();
}

function applyPosRemovedFromShipmentLocally(shipmentId, poNumbers) {
  poNumbers.forEach(poNumber => {
    const row = allRows.find(r => String(r["PO #"]) === String(poNumber));
    if (!row) return;
    if (String(row[SHIPMENT_ID_FIELD]) !== String(shipmentId)) return;
    clearPoShipmentData(row);
  });
  applyFilters();
  refreshShipmentsView();
}

function applyShipmentUpdatedLocally(shipmentId, shipment) {
  const record = getShipmentById(shipmentId);
  if (record) Object.assign(record, shipment);
  getPosForShipment(shipmentId).forEach(row => {
    SHIPMENT_PO_CLEAR_FIELDS.forEach(field => {
      if (shipment[field] !== undefined) row[field] = shipment[field];
    });
    row["EST IHD"] = calculateEstIhd(row["Ship Method"], row["EST EXF"]);
  });
  applyFilters();
  refreshShipmentsView();
}

function applyShipmentsDeletedLocally(shipmentIds) {
  const idSet = new Set(shipmentIds.map(id => String(id).trim()));
  idSet.forEach(shipmentId => {
    getPosForShipment(shipmentId).forEach(row => clearPoShipmentData(row));
  });
  allShipments = allShipments.filter(s => !idSet.has(String(s[SHIPMENT_ID_FIELD] ?? "").trim()));
  resetLocalShipmentSelectedState(allShipments);
  applyFilters();
  refreshShipmentsView();
}

async function demoCreateShipment(poNumbers, shipment) {
  const blocked = poNumbers.filter(po => {
    const row = allRows.find(r => String(r["PO #"]) === String(po));
    return row && poHasShipment(row);
  });
  if (blocked.length > 0) {
    throw new Error(`${blocked.length} PO(s) already assigned to a shipment`);
  }
  applyShipmentCreatedLocally(generateDemoShipmentId(), poNumbers, shipment);
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
  el.textContent = "";
}

function formatShipmentLinkedPoTotal(value) {
  const rounded = Math.round(value * 100) / 100;
  return rounded.toLocaleString(undefined, {
    maximumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
  });
}

function getShipmentLinkedPoTotals(pos) {
  return pos.reduce((totals, row) => {
    const ctnQty = typeof getPackingCtnQtyForRow === "function"
      ? getPackingCtnQtyForRow(row)
      : row["Ctn Qty"];

    totals.orderQty += toQtyNumber(row["PO Qty"]);
    totals.actualQty += toQtyNumber(row["Actual Qty"]);
    totals.ctnQty += toQtyNumber(ctnQty);
    return totals;
  }, {
    orderQty: 0,
    actualQty: 0,
    ctnQty: 0,
  });
}

function renderShipmentLinkedPoFooter(pos) {
  const totals = getShipmentLinkedPoTotals(pos);
  const footer = document.createElement("footer");
  footer.className = "shipment-linked-po-footer";

  const actions = document.createElement("div");
  actions.className = "shipment-linked-po-footer-actions";

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "btn shipment-linked-po-footer-btn shipment-linked-po-footer-add";
  addBtn.textContent = "Add POs";
  addBtn.addEventListener("click", openShipmentAddPoPanel);

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn shipment-linked-po-footer-btn shipment-linked-po-footer-remove";
  removeBtn.textContent = "Remove POs";
  removeBtn.hidden = true;
  removeBtn.addEventListener("click", removePosFromShipment);

  actions.appendChild(addBtn);
  actions.appendChild(removeBtn);
  footer.appendChild(actions);

  const totalsWrap = document.createElement("div");
  totalsWrap.className = "shipment-linked-po-footer-totals";

  [
    ["Order Qty", totals.orderQty],
    ["Actual Qty", totals.actualQty],
    ["CTN Qty", totals.ctnQty],
    ["PO Count", pos.length],
  ].forEach(([label, value]) => {
    const item = document.createElement("div");
    item.className = "shipment-linked-po-footer-item";

    const labelEl = document.createElement("span");
    labelEl.className = "shipment-linked-po-footer-label";
    labelEl.textContent = label;

    const valueEl = document.createElement("span");
    valueEl.className = "shipment-linked-po-footer-value";
    valueEl.textContent = formatShipmentLinkedPoTotal(value);

    item.appendChild(labelEl);
    item.appendChild(valueEl);
    totalsWrap.appendChild(item);
  });

  footer.appendChild(totalsWrap);

  return footer;
}

function getLinkedPosFromModalTable() {
  const tbody = getActiveShipmentModalScope()
    .querySelector(".shipment-linked-po-table tbody");
  if (!tbody) return [];
  return [...tbody.querySelectorAll("tr[data-po]")]
    .map(tr => findRowByPo(tr.dataset.po))
    .filter(Boolean);
}

function updateShipmentLinkedPoSelectAllHeader(pos) {
  const cb = getActiveShipmentModalScope()
    .querySelector(".shipment-linked-po-table #shipmentLinkedPoSelectAll");
  if (!cb) return;

  if (pos.length === 0) {
    cb.checked = false;
    cb.indeterminate = false;
    cb.disabled = true;
    return;
  }

  cb.disabled = shipmentAddPoPanelOpen;
  const selectedCount = pos.filter(isShipmentFormPoSelected).length;
  cb.checked = selectedCount === pos.length;
  cb.indeterminate = selectedCount > 0 && selectedCount < pos.length;
}

function syncLinkedPoTableCheckboxes(pos) {
  const tbody = getActiveShipmentModalScope()
    .querySelector(".shipment-linked-po-table tbody");
  if (!tbody) return;
  pos.forEach(row => {
    const po = String(row["PO #"] ?? "");
    const tr = [...tbody.querySelectorAll("tr[data-po]")].find(el => String(el.dataset.po) === po);
    const cb = tr?.querySelector(".po-select-checkbox");
    if (cb) cb.checked = isShipmentFormPoSelected(row);
  });
  updateShipmentLinkedPoSelectAllHeader(pos);
}

function setAllLinkedPosSelected(pos, selected) {
  if (shipmentAddPoPanelOpen) return;
  pos.forEach(row => {
    toggleShipmentFormPoSelected(row, selected);
  });
  syncLinkedPoTableCheckboxes(pos);
  onFormPoSelectionChanged();
}

function renderShipmentLinkedPoSection(source) {
  const section = document.createElement("section");
  section.className = "shipment-linked-pos";
  section.classList.toggle("shipment-linked-pos--selection-disabled", shipmentAddPoPanelOpen);

  const pos = getLinkedPoRows(source);
  pruneShipmentFormSelection(pos);
  const count = pos.length;

  if (count === 0) {
    const empty = document.createElement("p");
    empty.className = "shipment-linked-empty";
    empty.textContent = "No POs linked to this shipment.";
    section.appendChild(empty);
    section.appendChild(renderShipmentLinkedPoFooter(pos));
    return section;
  }

  const wrap = document.createElement("div");
  wrap.className = "shipment-linked-po-table-wrap shipment-linked-po-table-wrap--with-footer";

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
  selectAllCb.disabled = shipmentAddPoPanelOpen;
  selectAllCb.setAttribute("aria-label", "Select all linked POs");
  selectAllCb.addEventListener("change", () => {
    if (shipmentAddPoPanelOpen) return;
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
    attachRequestLinkedPoRowOpen(tr, row["PO #"]);

    const selectTd = document.createElement("td");
    const linkedCb = renderFormSelectedCell(selectTd, row, isShipmentFormPoSelected(row), selected => {
      if (shipmentAddPoPanelOpen) return;
      toggleShipmentFormPoSelected(row, selected);
      onFormPoSelectionChanged();
    });
    linkedCb.disabled = shipmentAddPoPanelOpen;
    tr.appendChild(selectTd);

    SHIPMENT_LINKED_PO_COLUMNS.forEach(({ col, cellClass }) => {
      const td = document.createElement("td");
      if (cellClass) td.className = cellClass;
      const text = formatShipmentLinkedPoCell(col, row);
      if (col === "PO #") {
        renderRequestLinkedPoDataCell(td, col, row, { cellClass });
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
  section.appendChild(renderShipmentLinkedPoFooter(pos));
  updateShipmentLinkedPoSelectAllHeader(pos);
  return section;
}

function renderShipmentModalContent(shipment) {
  const idEl = document.getElementById("shipmentModalId");
  const body = document.getElementById("shipmentModalBody");
  if (!idEl || !body) return;

  shipmentAddPoPanelOpen = false;
  clearShipmentFooterMessage("shipmentModalFooterMessage");
  idEl.textContent = shipment[SHIPMENT_ID_FIELD] ?? EMPTY_DISPLAY;
  setShipmentModalPoCount(document.getElementById("shipmentModalPoCount"), shipment);
  pruneShipmentFormSelection(getLinkedPoRows(shipment));
  body.innerHTML = "";
  body.appendChild(buildShipmentModalLayout({
    shipment,
    formId: "shipmentEditForm",
    linkedSource: shipment,
    showAddPanel: false,
  }));
  setShipmentModalAddPanelClass(body, false);
  updateShipmentModalActionButtons();
}

async function saveShipmentModal() {
  if (shipmentOpInProgress || !shipmentModalRow) return;
  const form = document.getElementById("shipmentEditForm");
  if (!form) return;

  const shipment = readShipmentForm(form);
  setShipmentFooterMessage("");
  const validationError = validateShipmentRequiredFields(shipment);
  if (validationError) {
    setShipmentFooterMessage(validationError);
    return;
  }

  const shipmentId = shipmentModalRow[SHIPMENT_ID_FIELD];
  closeShipmentModalForce();
  shipmentOpInProgress = true;
  showIndicator(`Saving${ELLIPSIS}`, "");

  try {
    if (!isDemoMode()) {
      const json = await postAppsScript({
        action: "updateShipment",
        shipmentId,
        shipment,
      });
      if (!json.success) throw new Error(json.error);
    }
    applyShipmentUpdatedLocally(shipmentId, shipment);
    showIndicator(`Saved ${CHECK_MARK}`, "success");
  } catch (err) {
    showIndicator("Save failed: " + err.message, "error");
  } finally {
    shipmentOpInProgress = false;
  }
}

async function deleteSelectedShipments() {
  if (shipmentOpInProgress) return;
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
  shipmentOpInProgress = true;
  showIndicator(`Deleting${ELLIPSIS}`, "");

  try {
    if (!isDemoMode()) {
      const json = await postAppsScript({
        action: "deleteShipment",
        shipmentIds,
      });
      if (!json.success) throw new Error(json.error);
    }
    applyShipmentsDeletedLocally(shipmentIds);

    if (openId && shipmentIds.some(id => String(id) === String(openId))) {
      closeShipmentModalForce();
    }

    showIndicator(`Deleted ${CHECK_MARK}`, "success");
  } catch (err) {
    showIndicator("Delete failed: " + err.message, "error");
  } finally {
    shipmentOpInProgress = false;
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

function openCreateShipmentFromSelection() {
  if (isAppSaving() || isToolbarCreateActionBlocked()) return;
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

  clearMainTableSelection();
  clearShipmentFormSelection();
  renderCreateShipmentModal(eligible.map(row => row["PO #"]));
}

const MODAL_SHIPMENT_LINK_ICON_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">` +
  `<path d="M3 7h11v10H3z"/><path d="M14 10h4l3 3v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>`;

function createModalLinkedShipmentCard(row) {
  const id = getPoShipmentId(row);
  if (isEmptyValue(id) || !getShipmentById(id)) return null;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "modal-linked-shipment-card";
  btn.innerHTML =
    `<span class="modal-linked-shipment-card-icon">${MODAL_SHIPMENT_LINK_ICON_SVG}</span>` +
    `<span class="modal-linked-shipment-card-id">${id}</span>`;
  btn.title = `Open shipment ${id}`;
  btn.setAttribute("aria-label", `Open linked shipment ${id}`);
  btn.addEventListener("click", e => {
    e.stopPropagation();
    openLinkedShipmentFromPo(row);
  });
  return btn;
}
