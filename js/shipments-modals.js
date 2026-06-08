const shipmentAvailablePoSelection = createAvailablePoPickerSelection();

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

function createShipmentFormMetaRow(col, value, { readOnly = false } = {}) {
  const { tr, valueTd } = createFormMetaRow(col);
  let input;
  const fieldReadOnly = readOnly || col === SHIPMENT_EXF_REQUEST_ID_FIELD;

  if (col === "Notes") {
    return null;
  } else if (SHIPMENT_DATE_FIELDS.has(col)) {
    const dateInput = createCompactDateInput({
      initialYmd: value,
      readOnly: fieldReadOnly,
      inputClassName: "shipment-form-input shipment-form-input--date email-meta-input",
      placeholder: "",
    });
    input = dateInput.input;
    valueTd.appendChild(dateInput.wrap);
  } else if (col === "Ship Method") {
    input = document.createElement("select");
    ["", ...SHIP_OPTIONS].forEach(opt => {
      const o = document.createElement("option");
      o.value = opt;
      o.textContent = opt || EMPTY_DISPLAY;
      if (String(value ?? "") === opt) o.selected = true;
      input.appendChild(o);
    });
    input.className = "shipment-form-input email-meta-input";
    valueTd.appendChild(input);
  } else {
    input = document.createElement("input");
    input.type = "text";
    input.value = isEmptyValue(value) ? "" : String(value);
    input.className = "shipment-form-input email-meta-input";
    valueTd.appendChild(input);
  }

  input.dataset.field = col;
  if (fieldReadOnly) input.readOnly = true;
  return { tr, input };
}

/** @deprecated Use createShipmentFormMetaRow instead. */
function createShipmentFormField(col, value, { readOnly = false } = {}) {
  const result = createShipmentFormMetaRow(col, value, { readOnly });
  if (!result) {
    const wrap = document.createElement("div");
    wrap.className = "shipment-form-field";
    return wrap;
  }
  const wrap = document.createElement("div");
  wrap.className = "shipment-form-field";
  wrap.appendChild(result.tr);
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

function buildShipmentFormEdit(shipment, formId, { lockExfDate = false } = {}) {
  const hasExfLink = Boolean(String(shipment[SHIPMENT_EXF_REQUEST_ID_FIELD] ?? "").trim());
  const exfReadOnly = lockExfDate || hasExfLink;
  const metaRows = [];
  SHIPMENT_MODAL_INFO_FIELDS.forEach(col => {
    const row = createShipmentFormMetaRow(col, shipment[col] ?? "");
    if (row) metaRows.push(row.tr);
  });
  SHIPMENT_MODAL_DATE_FIELDS.forEach(col => {
    const row = createShipmentFormMetaRow(col, shipment[col] ?? "", {
      readOnly: col === "EXF" && exfReadOnly,
    });
    if (row) metaRows.push(row.tr);
  });

  const form = buildEmailStyleForm({
    formId,
    metaRows,
    notesField: "Notes",
    notesValue: shipment["Notes"] ?? "",
  });

  if (formId === "createShipmentForm") {
    bindCreateShipmentEnterNavigation(form);
  }

  return form;
}

function buildShipmentModalLayout({ shipment = {}, formId, linkedSource, showAddPanel = false, lockExfDate = false }) {
  const outer = document.createElement("div");
  outer.className = "shipment-modal-outer";
  outer.id = "shipmentModalOuter";

  outer.appendChild(buildShipmentModalSplitLayout(
    buildShipmentFormEdit(shipment, formId, { lockExfDate }),
    renderShipmentLinkedPoSection(linkedSource)
  ));

  if (showAddPanel) {
    const available = getRequestedPoPanelRows(linkedSource);
    appendAvailablePoPanelToModalRight(outer, renderRequestedPoPickerPanel(available, {
      selection: shipmentAvailablePoSelection,
      onSelectionChange: updateShipmentModalActionButtons,
    }));
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
      doneBtn: document.getElementById("createShipmentAddPoDoneBtn"),
      addSelectedBtn: document.getElementById("createShipmentAddSelectedPosBtn"),
    };
  }
  if (document.getElementById("shipmentModalOverlay")?.classList.contains("open")) {
    return {
      addBtn: document.getElementById("shipmentDetailAddPosBtn"),
      removeBtn: document.getElementById("shipmentDetailRemovePosBtn"),
      doneBtn: document.getElementById("shipmentDetailAddPoDoneBtn"),
      addSelectedBtn: document.getElementById("shipmentDetailAddSelectedPosBtn"),
    };
  }
  return { addBtn: null, removeBtn: null, doneBtn: null, addSelectedBtn: null };
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
  const { addBtn, removeBtn, doneBtn, addSelectedBtn } = getActiveShipmentModalButtons();
  if (!addBtn && !removeBtn && !doneBtn && !addSelectedBtn) return;

  if (shipmentAddPoPanelOpen) {
    if (addBtn) addBtn.hidden = true;
    if (removeBtn) removeBtn.hidden = true;
    if (doneBtn) doneBtn.hidden = false;
    if (addSelectedBtn) addSelectedBtn.hidden = shipmentAvailablePoSelection.size === 0;
    return;
  }

  if (doneBtn) doneBtn.hidden = true;
  if (addSelectedBtn) addSelectedBtn.hidden = true;

  const linked = getLinkedPosFromModalTable();
  const linkedSelected = linked.filter(isShipmentFormPoSelected).length;
  const showAdd = linkedSelected === 0;
  const showRemove = linkedSelected > 0;

  if (addBtn) addBtn.hidden = !showAdd;
  if (removeBtn) removeBtn.hidden = !showRemove;
}

function openShipmentAddPoPanel() {
  clearShipmentFormSelection();
  shipmentAvailablePoSelection.clear();
  shipmentAddPoPanelOpen = true;
  rerenderOpenShipmentModalBody();
  updateShipmentModalActionButtons();
}

function closeShipmentAddPoPanel() {
  shipmentAvailablePoSelection.clear();
  shipmentAddPoPanelOpen = false;
  rerenderOpenShipmentModalBody();
  updateShipmentModalActionButtons();
}

async function addSelectedPosToShipment() {
  const selected = shipmentAvailablePoSelection.getAll();
  if (selected.length === 0) return;
  shipmentAvailablePoSelection.clear();
  await addPosToShipment(selected, { keepPanelOpen: true });
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
    if (createShipmentContext?.exfRequestId) {
      savedCreateShipment[SHIPMENT_EXF_REQUEST_ID_FIELD] = createShipmentContext.exfRequestId;
    }
    const lockExfDate = createShipmentContext?.lockExfDate ||
      Boolean(String(savedCreateShipment[SHIPMENT_EXF_REQUEST_ID_FIELD] ?? "").trim());
    if (body) {
      body.innerHTML = "";
      body.appendChild(buildShipmentModalLayout({
        shipment: savedCreateShipment,
        formId: "createShipmentForm",
        linkedSource: pos,
        showAddPanel: shipmentAddPoPanelOpen,
        lockExfDate,
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
      lockExfDate: Boolean(String(shipmentModalRow[SHIPMENT_EXF_REQUEST_ID_FIELD] ?? "").trim()),
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

function renderCreateShipmentModal(poNumbers, { exfRequestId = "", exfDate = "", lockExfDate = false } = {}) {
  createShipmentPoNumbers = poNumbers.slice();
  shipmentAddPoPanelOpen = false;
  clearShipmentFooterMessage("createShipmentFooterMessage");
  const body = document.getElementById("createShipmentBody");
  if (!body) return;

  const pos = poNumbers
    .map(po => allRows.find(r => String(r["PO #"]) === String(po)))
    .filter(Boolean);
  pruneShipmentFormSelection(pos);

  const overlayAlreadyOpen = document.getElementById("createShipmentOverlay")?.classList.contains("open");
  const effectiveExfRequestId = exfRequestId ||
    (overlayAlreadyOpen ? createShipmentContext?.exfRequestId : "") || "";
  const effectiveLockExfDate = lockExfDate ||
    (overlayAlreadyOpen ? createShipmentContext?.lockExfDate : false) || false;
  const createForm = document.getElementById("createShipmentForm");
  const savedExf = createForm ? readShipmentForm(createForm).EXF : "";
  const effectiveExfDate = exfDate || savedExf || "";

  createShipmentContext = effectiveExfRequestId
    ? { exfRequestId: effectiveExfRequestId, lockExfDate: effectiveLockExfDate || Boolean(effectiveExfRequestId) }
    : null;

  const shipMethod = getMajorityShipMethodFromPoRows(pos);
  const defaultShipment = {
    ...(shipMethod ? { "Ship Method": shipMethod } : {}),
    ...(effectiveExfRequestId ? { [SHIPMENT_EXF_REQUEST_ID_FIELD]: effectiveExfRequestId } : {}),
    ...(effectiveExfDate ? { EXF: effectiveExfDate } : {}),
  };

  body.innerHTML = "";
  body.appendChild(buildShipmentModalLayout({
    shipment: defaultShipment,
    formId: "createShipmentForm",
    linkedSource: pos,
    showAddPanel: false,
    lockExfDate: effectiveLockExfDate || Boolean(effectiveExfRequestId),
  }));
  setEmailStyleModalHeader(document.querySelector("#createShipmentOverlay .modal-header"), {
    typeLabel: "Shipment",
    recordId: "New",
  });
  setShipmentModalAddPanelClass(body, false);
  setShipmentModalPoCount(document.getElementById("createShipmentPoCount"), pos);

  bringModalToFront(document.getElementById("createShipmentOverlay"));
  updateShipmentModalActionButtons();
  updateToolbarRequestButtons();
}

function closeCreateShipmentModal() {
  createShipmentPoNumbers = [];
  createShipmentContext = null;
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

function refreshExfRequestTableIfNeeded() {
  if (typeof applyExfRequestFilters === "function") applyExfRequestFilters();
}

function applyShipmentCreatedLocally(shipmentId, poNumbers, shipment) {
  allShipments.push(normalizeShipment({ [SHIPMENT_ID_FIELD]: shipmentId, ...shipment }));
  applyShipmentSyncToPosLocally(shipmentId, poNumbers, shipment);
  resetLocalSelectedState(allRows);
  applyFilters();
  refreshShipmentsView();
  refreshExfRequestTableIfNeeded();
}

function applyPosAddedToShipmentLocally(shipmentId, poNumbers, shipment) {
  applyShipmentSyncToPosLocally(shipmentId, poNumbers, shipment);
  applyFilters();
  refreshShipmentsView();
  refreshExfRequestTableIfNeeded();
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
  refreshExfRequestTableIfNeeded();
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
  refreshExfRequestTableIfNeeded();
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
    return section;
  }

  const wrap = document.createElement("div");
  wrap.className = "email-po-table-wrap";

  const table = document.createElement("table");
  table.className = "email-po-table shipment-linked-po-table";

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
  if (count > 0) {
    appendEmailPoTableFooter(table, pos, SHIPMENT_LINKED_PO_COLUMNS, { hasSelectCol: true, qtyCol: "Actual Qty" });
  }
  wrap.appendChild(table);
  section.appendChild(wrap);
  updateShipmentLinkedPoSelectAllHeader(pos);
  return section;
}

function renderShipmentModalContent(shipment) {
  const body = document.getElementById("shipmentModalBody");
  if (!body) return;

  shipmentAddPoPanelOpen = false;
  clearShipmentFooterMessage("shipmentModalFooterMessage");
  setEmailStyleModalHeader(document.querySelector("#shipmentModalOverlay .modal-header"), {
    typeLabel: "Shipment",
    recordId: shipment[SHIPMENT_ID_FIELD] ?? "—",
  });
  setShipmentModalPoCount(document.getElementById("shipmentModalPoCount"), shipment);
  pruneShipmentFormSelection(getLinkedPoRows(shipment));
  body.innerHTML = "";
  body.appendChild(buildShipmentModalLayout({
    shipment,
    formId: "shipmentEditForm",
    linkedSource: shipment,
    showAddPanel: false,
    lockExfDate: Boolean(String(shipment[SHIPMENT_EXF_REQUEST_ID_FIELD] ?? "").trim()),
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
