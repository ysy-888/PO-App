const SHEET_NAME = "POs";
const SHIPMENTS_SHEET_NAME = "Shipments";
const CHARGEBACKS_SHEET_NAME = "Chargebacks";
const COLUMN_DEFAULT_KEY = "defaultVisibleColumns";
const STATUS_DEFAULT_KEY = "defaultStatusFilter";
const SHIPMENT_ID_FIELD = "Shipment ID";
const CHARGEBACK_ID_FIELD = "Chargeback ID";

/*
  POs sheet row 1 headers (see po-table.js COLUMNS). Add column: Shipment ID

  Shipments sheet row 1 headers (auto-created if missing):
    Shipment ID, Ship Method, Vessel, House #, EXF, Shipped, ETD, ETA, IHD, Notes

  Selected is session-local in the app only.
*/

const SHIPMENT_DATA_FIELDS = [
  "Ship Method", "Vessel", "House #", "EXF", "Shipped", "ETD", "ETA", "IHD", "Notes"
];

const PO_SYNC_FROM_SHIPMENT_FIELDS = [
  "Ship Method", "Vessel", "House #", "EXF", "Shipped", "ETD", "ETA", "IHD"
];

const EDITABLE_FIELDS = [
  "Flag",
  "PO Qty", "Actual Qty", "Status", "Ship Method", "Ctn Qty",
  "Vessel", "House #", "Shipped", "ETD", "ETA", "IHD",
  "EST EXF", "EST IHD", "EXF", "CXL Date", "Assign Date", "Notes",
  "Size",
  "PO Unit 1", "PO Unit 2", "PO Unit 3", "PO Unit 4",
  "PO Unit 5", "PO Unit 6", "PO Unit 7", "PO Unit 8",
  "Act Unit 1", "Act Unit 2", "Act Unit 3", "Act Unit 4",
  "Act Unit 5", "Act Unit 6", "Act Unit 7", "Act Unit 8"
];

const SHIPMENT_EDITABLE_FIELDS = SHIPMENT_DATA_FIELDS.slice();

const CHARGEBACK_DATA_FIELDS = [
  "PO #", "Amount", "Reason", "Status", "Date", "Notes", "Created At", "Updated At"
];

const CHARGEBACK_EDITABLE_FIELDS = [
  "Amount", "Reason", "Status", "Notes"
];

function getSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
}

function getShipmentsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHIPMENTS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHIPMENTS_SHEET_NAME);
    sheet.getRange(1, 1, 1, SHIPMENT_DATA_FIELDS.length + 1).setValues([[
      SHIPMENT_ID_FIELD, ...SHIPMENT_DATA_FIELDS
    ]]);
  }
  return sheet;
}

function getChargebacksSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CHARGEBACKS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CHARGEBACKS_SHEET_NAME);
    sheet.getRange(1, 1, 1, CHARGEBACK_DATA_FIELDS.length + 1).setValues([[
      CHARGEBACK_ID_FIELD, ...CHARGEBACK_DATA_FIELDS
    ]]);
  }
  return sheet;
}

function corsResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function sheetToObjects_(sheet, requiredField) {
  const range = sheet.getDataRange();
  const rows = range.getValues();
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => String(h ?? "").trim());
  return rows.slice(1)
    .map((row, i) => {
      const obj = { _rowIndex: i + 2 };
      headers.forEach((h, j) => {
        if (h) obj[h] = row[j];
      });
      return obj;
    })
    .filter(obj => {
      if (!requiredField) return true;
      return String(obj[requiredField] ?? "").trim() !== "";
    });
}

function getDefaultColumns_() {
  const raw = PropertiesService.getScriptProperties().getProperty(COLUMN_DEFAULT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch (e) {
    return null;
  }
}

function saveDefaultColumns_(columns) {
  if (!Array.isArray(columns) || columns.length === 0) {
    throw new Error("No columns provided");
  }
  PropertiesService.getScriptProperties().setProperty(
    COLUMN_DEFAULT_KEY,
    JSON.stringify(columns)
  );
}

function getDefaultStatusFilter_() {
  return PropertiesService.getScriptProperties().getProperty(STATUS_DEFAULT_KEY);
}

function saveDefaultStatusFilter_(statusFilter) {
  PropertiesService.getScriptProperties().setProperty(
    STATUS_DEFAULT_KEY,
    String(statusFilter)
  );
}

function handleSaveColumnDefault(payload) {
  saveDefaultColumns_(payload.columns);
  if (payload.statusFilter !== undefined) {
    saveDefaultStatusFilter_(payload.statusFilter);
  }
  return corsResponse({ success: true });
}

function parseShipmentIdSequence_(id) {
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

function formatShipmentId_(sequence) {
  return "SHP-" + String(sequence).padStart(4, "0");
}

function generateShipmentId_(shipments) {
  let max = 0;
  shipments.forEach(s => {
    max = Math.max(max, parseShipmentIdSequence_(s[SHIPMENT_ID_FIELD]));
  });
  return formatShipmentId_(max + 1);
}

function parseChargebackIdSequence_(id) {
  const s = String(id ?? "").trim();
  const m = /^CB-(\d+)$/.exec(s);
  return m ? Number(m[1]) : 0;
}

function formatChargebackId_(sequence) {
  return "CB-" + String(sequence).padStart(4, "0");
}

function generateChargebackId_(chargebacks) {
  let max = 0;
  chargebacks.forEach(chargeback => {
    max = Math.max(max, parseChargebackIdSequence_(chargeback[CHARGEBACK_ID_FIELD]));
  });
  return formatChargebackId_(max + 1);
}

function pickChargebackData_(source) {
  const out = {};
  CHARGEBACK_EDITABLE_FIELDS.forEach(field => {
    if (source && source[field] !== undefined) out[field] = source[field];
  });
  return out;
}

function findChargebackRowIndex_(chargebacksSheet, chargebackId) {
  const rows = chargebacksSheet.getDataRange().getValues();
  const headers = rows[0].map(h => String(h ?? "").trim());
  const idCol = headers.indexOf(CHARGEBACK_ID_FIELD);
  if (idCol === -1) throw new Error("Chargeback ID column not found.");
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][idCol]) === String(chargebackId)) {
      return { rowIndex: i + 1, headers: headers };
    }
  }
  return null;
}

function appendChargebackRow_(chargebacksSheet, chargebackId, poNumber, chargebackData) {
  const headers = chargebacksSheet.getRange(1, 1, 1, chargebacksSheet.getLastColumn()).getValues()[0]
    .map(h => String(h ?? "").trim());
  const now = new Date();
  const row = headers.map(h => {
    if (h === CHARGEBACK_ID_FIELD) return chargebackId;
    if (h === "PO #") return poNumber;
    if (h === "Date") return now;
    if (h === "Created At" || h === "Updated At") return now;
    return chargebackData[h] !== undefined ? chargebackData[h] : "";
  });
  chargebacksSheet.appendRow(row);
}

function pickShipmentData_(source) {
  const out = {};
  SHIPMENT_DATA_FIELDS.forEach(field => {
    if (source && source[field] !== undefined) out[field] = source[field];
  });
  return out;
}

function findPoRowIndex_(poSheet, poNumber) {
  const rows = poSheet.getDataRange().getValues();
  const headers = rows[0].map(h => String(h ?? "").trim());
  const poCol = headers.indexOf("PO #");
  if (poCol === -1) throw new Error("PO # column not found in sheet.");
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][poCol]) === String(poNumber)) return { rowIndex: i + 1, headers: headers };
  }
  return null;
}

function writePoFields_(poSheet, rowIndex, headers, updates) {
  Object.entries(updates).forEach(([field, value]) => {
    const colIndex = headers.indexOf(field);
    if (colIndex !== -1) poSheet.getRange(rowIndex, colIndex + 1).setValue(value);
  });
}

function syncPosFromShipment_(poSheet, shipmentId, shipmentData, poNumbers) {
  const syncData = pickShipmentData_(shipmentData);
  syncData[SHIPMENT_ID_FIELD] = shipmentId;
  const list = Array.isArray(poNumbers) ? poNumbers.map(String) : [];
  list.forEach(poNumber => {
    const found = findPoRowIndex_(poSheet, poNumber);
    if (!found) throw new Error("PO # not found: " + poNumber);
    writePoFields_(poSheet, found.rowIndex, found.headers, syncData);
  });
}

function findPoRowsByShipmentId_(poSheet, shipmentId) {
  const rows = poSheet.getDataRange().getValues();
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => String(h ?? "").trim());
  const shipCol = headers.indexOf(SHIPMENT_ID_FIELD);
  if (shipCol === -1) return [];
  const key = String(shipmentId ?? "").trim();
  const matches = [];
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][shipCol] ?? "").trim() !== key) continue;
    matches.push({ rowIndex: i + 1, headers: headers });
  }
  return matches;
}

function clearPoShipmentDataAtRow_(poSheet, rowIndex, headers) {
  const updates = {};
  updates[SHIPMENT_ID_FIELD] = "";
  SHIPMENT_DATA_FIELDS.forEach(field => {
    updates[field] = "";
  });
  writePoFields_(poSheet, rowIndex, headers, updates);
}

function findShipmentRowIndex_(shipmentsSheet, shipmentId) {
  const rows = shipmentsSheet.getDataRange().getValues();
  const headers = rows[0].map(h => String(h ?? "").trim());
  const idCol = headers.indexOf(SHIPMENT_ID_FIELD);
  if (idCol === -1) throw new Error("Shipment ID column not found.");
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][idCol]) === String(shipmentId)) {
      return { rowIndex: i + 1, headers: headers };
    }
  }
  return null;
}

function appendShipmentRow_(shipmentsSheet, shipmentId, shipmentData) {
  const headers = shipmentsSheet.getRange(1, 1, 1, shipmentsSheet.getLastColumn()).getValues()[0]
    .map(h => String(h ?? "").trim());
  const row = headers.map(h => {
    if (h === SHIPMENT_ID_FIELD) return shipmentId;
    return shipmentData[h] !== undefined ? shipmentData[h] : "";
  });
  shipmentsSheet.appendRow(row);
}

function isEmptyShipmentId_(value) {
  const s = String(value ?? "").trim();
  if (s === "") return true;
  return /^[\u2014\u2013\u2212-]+$/.test(s);
}

function getPoShipmentId_(poSheet, poNumber) {
  const found = findPoRowIndex_(poSheet, poNumber);
  if (!found) return "";
  const col = found.headers.indexOf(SHIPMENT_ID_FIELD);
  if (col === -1) return "";
  const value = String(poSheet.getRange(found.rowIndex, col + 1).getValue() ?? "").trim();
  if (isEmptyShipmentId_(value)) return "";
  return value;
}

function assertPosNotAssigned_(poSheet, poNumbers) {
  const shipmentsSheet = getShipmentsSheet_();
  const list = Array.isArray(poNumbers) ? poNumbers.map(String) : [];
  for (let i = 0; i < list.length; i++) {
    const poNumber = list[i];
    const existing = getPoShipmentId_(poSheet, poNumber);
    if (!existing) continue;
    const shipmentFound = findShipmentRowIndex_(shipmentsSheet, existing);
    if (!shipmentFound) continue;
    throw new Error("PO " + poNumber + " is already assigned to " + existing);
  }
}

function handleCreateShipment(payload) {
  const poNumbers = payload.poNumbers || [];
  if (!Array.isArray(poNumbers) || poNumbers.length === 0) {
    return corsResponse({ success: false, error: "Select at least one PO." });
  }

  const shipmentData = pickShipmentData_(payload.shipment || {});
  const shipmentsSheet = getShipmentsSheet_();
  const poSheet = getSheet();

  try {
    assertPosNotAssigned_(poSheet, poNumbers);
  } catch (err) {
    return corsResponse({ success: false, error: err.message });
  }

  const existing = sheetToObjects_(shipmentsSheet, SHIPMENT_ID_FIELD);
  const shipmentId = generateShipmentId_(existing);

  appendShipmentRow_(shipmentsSheet, shipmentId, shipmentData);
  syncPosFromShipment_(poSheet, shipmentId, shipmentData, poNumbers);

  return corsResponse({ success: true, shipmentId: shipmentId });
}

function handleUpdateShipment(payload) {
  const shipmentId = String(payload.shipmentId ?? "").trim();
  if (!shipmentId) {
    return corsResponse({ success: false, error: "Shipment ID is required." });
  }

  const shipmentData = pickShipmentData_(payload.shipment || {});
  const poNumbers = payload.poNumbers;

  const shipmentsSheet = getShipmentsSheet_();
  const poSheet = getSheet();
  const found = findShipmentRowIndex_(shipmentsSheet, shipmentId);
  if (!found) {
    return corsResponse({ success: false, error: "Shipment not found: " + shipmentId });
  }

  found.headers.forEach((field, colIndex) => {
    if (field === SHIPMENT_ID_FIELD) return;
    if (shipmentData[field] !== undefined) {
      shipmentsSheet.getRange(found.rowIndex, colIndex + 1).setValue(shipmentData[field]);
    }
  });

  let linkedPos = poNumbers;
  if (!Array.isArray(linkedPos)) {
    const allPos = sheetToObjects_(poSheet, "PO #");
    linkedPos = allPos
      .filter(row => String(row[SHIPMENT_ID_FIELD] ?? "") === shipmentId)
      .map(row => String(row["PO #"]));
  }

  syncPosFromShipment_(poSheet, shipmentId, shipmentData, linkedPos);

  return corsResponse({ success: true, shipmentId: shipmentId });
}

function handleDeleteShipment(payload) {
  const shipmentIds = payload.shipmentIds || [];
  if (!Array.isArray(shipmentIds) || shipmentIds.length === 0) {
    return corsResponse({ success: false, error: "Select at least one shipment." });
  }

  const shipmentsSheet = getShipmentsSheet_();
  const poSheet = getSheet();
  const rowsToDelete = [];

  shipmentIds.forEach(rawId => {
    const shipmentId = String(rawId ?? "").trim();
    if (!shipmentId) return;

    findPoRowsByShipmentId_(poSheet, shipmentId).forEach(match => {
      clearPoShipmentDataAtRow_(poSheet, match.rowIndex, match.headers);
    });

    const found = findShipmentRowIndex_(shipmentsSheet, shipmentId);
    if (found) rowsToDelete.push(found.rowIndex);
  });

  rowsToDelete.sort((a, b) => b - a);
  rowsToDelete.forEach(rowIndex => shipmentsSheet.deleteRow(rowIndex));

  return corsResponse({ success: true, deleted: rowsToDelete.length });
}

function handleCreateChargeback(payload) {
  const poNumber = String(payload.poNumber ?? "").trim();
  if (!poNumber) {
    return corsResponse({ success: false, error: "PO # is required." });
  }

  const poSheet = getSheet();
  const poFound = findPoRowIndex_(poSheet, poNumber);
  if (!poFound) {
    return corsResponse({ success: false, error: "PO # not found: " + poNumber });
  }

  const chargebackData = pickChargebackData_(payload.chargeback || {});
  const chargebacksSheet = getChargebacksSheet_();
  const existing = sheetToObjects_(chargebacksSheet, CHARGEBACK_ID_FIELD);
  const chargebackId = generateChargebackId_(existing);

  appendChargebackRow_(chargebacksSheet, chargebackId, poNumber, chargebackData);
  return corsResponse({ success: true, chargebackId: chargebackId });
}

function handleUpdateChargeback(payload) {
  const chargebackId = String(payload.chargebackId ?? "").trim();
  if (!chargebackId) {
    return corsResponse({ success: false, error: "Chargeback ID is required." });
  }

  const updates = pickChargebackData_(payload.chargeback || {});
  const invalidFields = Object.keys(payload.chargeback || {}).filter(f => !CHARGEBACK_EDITABLE_FIELDS.includes(f));
  if (invalidFields.length > 0) {
    return corsResponse({
      success: false,
      error: "Not allowed to edit chargeback field(s): " + invalidFields.join(", ")
    });
  }

  const chargebacksSheet = getChargebacksSheet_();
  const found = findChargebackRowIndex_(chargebacksSheet, chargebackId);
  if (!found) {
    return corsResponse({ success: false, error: "Chargeback not found: " + chargebackId });
  }

  found.headers.forEach((field, colIndex) => {
    if (updates[field] !== undefined) {
      chargebacksSheet.getRange(found.rowIndex, colIndex + 1).setValue(updates[field]);
    }
    if (field === "Updated At") {
      chargebacksSheet.getRange(found.rowIndex, colIndex + 1).setValue(new Date());
    }
  });

  return corsResponse({ success: true, chargebackId: chargebackId });
}

function handleDeleteChargeback(payload) {
  const rawIds = payload.chargebackIds || payload.chargebackId;
  const ids = Array.isArray(rawIds) ? rawIds : [rawIds];
  if (ids.length === 0 || ids.every(id => !String(id ?? "").trim())) {
    return corsResponse({ success: false, error: "Chargeback ID is required." });
  }

  const chargebacksSheet = getChargebacksSheet_();
  const rowsToDelete = [];
  ids.forEach(rawId => {
    const chargebackId = String(rawId ?? "").trim();
    if (!chargebackId) return;
    const found = findChargebackRowIndex_(chargebacksSheet, chargebackId);
    if (found) rowsToDelete.push(found.rowIndex);
  });

  rowsToDelete.sort((a, b) => b - a);
  rowsToDelete.forEach(rowIndex => chargebacksSheet.deleteRow(rowIndex));

  return corsResponse({ success: true, deleted: rowsToDelete.length });
}

function handleUpdate(payload) {
  const { poNumber, updates } = payload;

  const invalidFields = Object.keys(updates).filter(f => !EDITABLE_FIELDS.includes(f));
  if (invalidFields.length > 0) {
    return corsResponse({
      success: false,
      error: "Not allowed to edit: " + invalidFields.join(", ")
    });
  }

  const poSheet = getSheet();
  const found = findPoRowIndex_(poSheet, poNumber);
  if (!found) {
    return corsResponse({ success: false, error: "PO # not found: " + poNumber });
  }

  writePoFields_(poSheet, found.rowIndex, found.headers, updates);
  return corsResponse({ success: true, message: "PO updated successfully." });
}

function doGet(e) {
  try {
    const poSheet = getSheet();
    const shipmentsSheet = getShipmentsSheet_();
    const chargebacksSheet = getChargebacksSheet_();
    const data = sheetToObjects_(poSheet, "PO #");
    const shipments = sheetToObjects_(shipmentsSheet, SHIPMENT_ID_FIELD);
    const chargebacks = sheetToObjects_(chargebacksSheet, CHARGEBACK_ID_FIELD);

    return corsResponse({
      success: true,
      data: data,
      shipments: shipments,
      chargebacks: chargebacks,
      defaultColumns: getDefaultColumns_(),
      defaultStatusFilter: getDefaultStatusFilter_(),
    });
  } catch (err) {
    return corsResponse({ success: false, error: err.message });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;

    if (action === "update") return handleUpdate(payload);
    if (action === "saveColumnDefault") return handleSaveColumnDefault(payload);
    if (action === "createShipment") return handleCreateShipment(payload);
    if (action === "updateShipment") return handleUpdateShipment(payload);
    if (action === "deleteShipment") return handleDeleteShipment(payload);
    if (action === "createChargeback") return handleCreateChargeback(payload);
    if (action === "updateChargeback") return handleUpdateChargeback(payload);
    if (action === "deleteChargeback") return handleDeleteChargeback(payload);

    return corsResponse({ success: false, error: "Unknown action: " + action });
  } catch (err) {
    return corsResponse({ success: false, error: err.message });
  }
}
