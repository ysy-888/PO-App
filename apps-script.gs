const SHEET_NAME = "POs";
const SHIPMENTS_SHEET_NAME = "Shipments";
const DELIVERY_REQUESTS_SHEET_NAME = "Delivery Requests";
const PICKUP_REQUESTS_SHEET_NAME = "Pickup Requests";
const CHARGEBACKS_SHEET_NAME = "Chargebacks";
const PACKING_LISTS_SHEET_NAME = "Packing Lists";
const PACKING_CARTONS_SHEET_NAME = "Packing List Cartons";
const COLUMN_DEFAULT_KEY = "defaultVisibleColumns";
const STATUS_DEFAULT_KEY = "defaultStatusFilter";
const SHIPMENT_ID_FIELD = "Shipment ID";
const DELIVERY_REQUEST_ID_FIELD = "Delivery Request ID";
const PICKUP_REQUEST_ID_FIELD = "Pickup Request ID";
const EXF_REQUESTED_FIELD = "EXF Requested";
const CHARGEBACK_ID_FIELD = "Chargeback ID";
const PACKING_LIST_ID_FIELD = "Packing List ID";

/*
  POs sheet row 1 headers (see po-table.js COLUMNS). Add column: Shipment ID

  Shipments sheet row 1 headers (auto-created if missing):
    Shipment ID, Ship Method, Vessel, House #, EXF, Shipped, ETD, ETA, IHD, Notes

  Selected is session-local in the app only.
*/

const SHIPMENT_DATA_FIELDS = [
  "Ship Method", "Vessel", "House #", "EXF", "Shipped", "ETD", "ETA", "IHD", "Notes"
];

const DELIVERY_REQUEST_DATA_FIELDS = ["Request Date", "Location", "Notes"];
const PICKUP_REQUEST_DATA_FIELDS = ["Request Date", "Location", "Notes"];

const EDITABLE_FIELDS = [
  "Flag",
  "PO Qty", "Status", "N41 Status", "Ship Method",
  "Vessel", "House #", "Shipped", "ETD", "ETA", "IHD",
  "EST EXF", "EST IHD", "EXF", "CXL Date", "Assign Date", "Notes",
  EXF_REQUESTED_FIELD, DELIVERY_REQUEST_ID_FIELD, PICKUP_REQUEST_ID_FIELD,
  "FOB Cost", "Price", "PO Total Cost",
  "Received Qty", "Style Category",
  "OG", "PROTO", "FIT/PP", "BULK", "TOP", "TRIM",
  "PO Unit 1", "PO Unit 2", "PO Unit 3", "PO Unit 4", "PO Unit 5",
  "PO Unit 6", "PO Unit 7", "PO Unit 8", "PO Unit 9", "PO Unit 10",
  "PO Unit 11", "PO Unit 12", "PO Unit 13", "PO Unit 14", "PO Unit 15"
];

const CHARGEBACK_DATA_FIELDS = [
  "PO #", "Amount", "Reason", "Status", "Date", "Notes", "Created At", "Updated At"
];

const CHARGEBACK_EDITABLE_FIELDS = [
  "Amount", "Reason", "Status", "Notes"
];

const PACKING_UNIT_FIELDS = Array.from({ length: 15 }, (_, i) => `Unit ${i + 1}`);

const PACKING_LIST_DATA_FIELDS = [
  "PO #", "Carton Count", "Notes", "Created At", "Updated At"
];

const PACKING_CARTON_DATA_FIELDS = [
  PACKING_LIST_ID_FIELD, "Carton #", ...PACKING_UNIT_FIELDS, "Total Units"
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

function getDeliveryRequestsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(DELIVERY_REQUESTS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(DELIVERY_REQUESTS_SHEET_NAME);
    sheet.getRange(1, 1, 1, DELIVERY_REQUEST_DATA_FIELDS.length + 1).setValues([[
      DELIVERY_REQUEST_ID_FIELD, ...DELIVERY_REQUEST_DATA_FIELDS
    ]]);
  }
  return sheet;
}

function getPickupRequestsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(PICKUP_REQUESTS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(PICKUP_REQUESTS_SHEET_NAME);
    sheet.getRange(1, 1, 1, PICKUP_REQUEST_DATA_FIELDS.length + 1).setValues([[
      PICKUP_REQUEST_ID_FIELD, ...PICKUP_REQUEST_DATA_FIELDS
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

function getPackingListsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(PACKING_LISTS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(PACKING_LISTS_SHEET_NAME);
    sheet.getRange(1, 1, 1, PACKING_LIST_DATA_FIELDS.length + 1).setValues([[
      PACKING_LIST_ID_FIELD, ...PACKING_LIST_DATA_FIELDS
    ]]);
  }
  return sheet;
}

function getPackingCartonsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(PACKING_CARTONS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(PACKING_CARTONS_SHEET_NAME);
    sheet.getRange(1, 1, 1, PACKING_CARTON_DATA_FIELDS.length).setValues([PACKING_CARTON_DATA_FIELDS]);
  }
  return sheet;
}

function corsResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Optional shared-secret auth. Set REQUIRE_REQUEST_TOKEN to true and store a
 * "REQUEST_TOKEN" Script Property to require clients to send a matching token.
 * Left disabled by default so existing deployments keep working; enabling it
 * also requires the frontend to include the token in each request.
 */
const REQUIRE_REQUEST_TOKEN = false;

function isAuthorizedRequest_(payload) {
  if (!REQUIRE_REQUEST_TOKEN) return true;
  const expected = PropertiesService.getScriptProperties().getProperty("REQUEST_TOKEN");
  if (!expected) return false;
  return payload && String(payload.token || "") === expected;
}

/** Generic client error message; full detail is logged server-side only. */
function errorResponse_(err) {
  console.error(err && err.stack ? err.stack : err);
  return corsResponse({ success: false, error: "Request failed. Please try again." });
}

/**
 * Neutralize spreadsheet formula injection: prefix a leading =, +, -, @ (or
 * control chars) on string values with an apostrophe so Sheets treats them as
 * literal text rather than executable formulas.
 */
function sanitizeCellValue_(value) {
  if (typeof value !== "string") return value;
  if (/^[=+\-@\t\r]/.test(value)) return "'" + value;
  return value;
}

function sanitizeUpdatesMap_(updates) {
  const out = {};
  Object.entries(updates || {}).forEach(([field, value]) => {
    out[field] = sanitizeCellValue_(value);
  });
  return out;
}

/** PO fields the CSV import is allowed to write (allowlist, not denylist). */
const IMPORT_ALLOWED_PO_FIELDS = (function () {
  const fields = [
    "PO Date", "EST IHD", "Vendor", "N41 Status", "Division", "Ship Method",
    "SO #", "Buyer", "Buyer PO #", "Style #", "Color", "Style Category",
    "PO Qty", "Received Qty", "CXL Date", "FOB Cost", "PO Total Cost",
  ];
  for (let i = 1; i <= 15; i++) {
    fields.push("Size " + i);
    fields.push("PO Unit " + i);
  }
  return new Set(fields);
})();

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

function parsePackingListIdSequence_(id) {
  const s = String(id ?? "").trim();
  const m = /^PL-(\d+)$/.exec(s);
  return m ? Number(m[1]) : 0;
}

function formatPackingListId_(sequence) {
  return "PL-" + String(sequence).padStart(4, "0");
}

function generatePackingListId_(packingLists) {
  let max = 0;
  packingLists.forEach(packingList => {
    max = Math.max(max, parsePackingListIdSequence_(packingList[PACKING_LIST_ID_FIELD]));
  });
  return formatPackingListId_(max + 1);
}

function getNextPackingListId_(packingListsSheet) {
  const rows = packingListsSheet.getDataRange().getValues();
  if (rows.length < 2) return formatPackingListId_(1);
  const headers = rows[0].map(h => String(h ?? "").trim());
  const idCol = headers.indexOf(PACKING_LIST_ID_FIELD);
  if (idCol === -1) return formatPackingListId_(1);
  let max = 0;
  for (let i = 1; i < rows.length; i++) {
    max = Math.max(max, parsePackingListIdSequence_(rows[i][idCol]));
  }
  return formatPackingListId_(max + 1);
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
    return chargebackData[h] !== undefined ? sanitizeCellValue_(chargebackData[h]) : "";
  });
  chargebacksSheet.appendRow(row);
}

function findPackingListRowIndex_(packingListsSheet, packingListId) {
  const rows = packingListsSheet.getDataRange().getValues();
  const headers = rows[0].map(h => String(h ?? "").trim());
  const idCol = headers.indexOf(PACKING_LIST_ID_FIELD);
  if (idCol === -1) throw new Error("Packing List ID column not found.");
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][idCol]) === String(packingListId)) {
      return { rowIndex: i + 1, headers: headers };
    }
  }
  return null;
}

function findPackingListForPo_(packingListsSheet, poNumber) {
  const rows = packingListsSheet.getDataRange().getValues();
  if (rows.length < 2) return null;
  const headers = rows[0].map(h => String(h ?? "").trim());
  const poCol = headers.indexOf("PO #");
  const idCol = headers.indexOf(PACKING_LIST_ID_FIELD);
  if (poCol === -1 || idCol === -1) throw new Error("Packing Lists sheet is missing required columns.");
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][poCol]) === String(poNumber)) {
      return { rowIndex: i + 1, headers: headers, packingListId: rows[i][idCol] };
    }
  }
  return null;
}

function toPackingQty_(value) {
  const n = Number(String(value ?? "").trim());
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function normalizePackingCartons_(cartons) {
  const list = Array.isArray(cartons) ? cartons : [];
  return list.map((carton, index) => {
    const out = { "Carton #": carton["Carton #"] || index + 1 };
    let total = 0;
    PACKING_UNIT_FIELDS.forEach(field => {
      const qty = toPackingQty_(carton[field]);
      out[field] = qty || "";
      total += qty;
    });
    out["Total Units"] = total;
    return out;
  });
}

function rewritePackingCartonsForList_(cartonsSheet, packingListId, cartons) {
  const data = cartonsSheet.getDataRange().getValues();
  if (data.length === 0) return;
  const headers = data[0].map(h => String(h ?? "").trim());
  const idCol = headers.indexOf(PACKING_LIST_ID_FIELD);
  if (idCol === -1) throw new Error("Packing List ID column not found in cartons sheet.");

  const key = String(packingListId);
  const keptRows = [];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) !== key) keptRows.push(data[i]);
  }

  const normalized = normalizePackingCartons_(cartons || []);
  const newRows = normalized.map(carton =>
    headers.map(h => {
      if (h === PACKING_LIST_ID_FIELD) return key;
      return carton[h] !== undefined ? carton[h] : "";
    })
  );

  const outRows = [data[0]].concat(keptRows, newRows);
  const lastCol = headers.length;
  const oldLastRow = Math.max(cartonsSheet.getLastRow(), 1);
  cartonsSheet.getRange(1, 1, outRows.length, lastCol).setValues(outRows);
  if (oldLastRow > outRows.length) {
    cartonsSheet.getRange(outRows.length + 1, 1, oldLastRow - outRows.length, lastCol).clearContent();
  }
}

function deletePackingCartons_(cartonsSheet, packingListId) {
  rewritePackingCartonsForList_(cartonsSheet, packingListId, []);
}

function writePoUpdatesFromPackingSave_(poSheet, poFound, extraUpdates) {
  const updates = Object.assign({}, extraUpdates || {});
  updates["Has Packing List"] = true;
  writePoFields_(poSheet, poFound.rowIndex, poFound.headers, updates);
  return updates;
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
  const rowValues = poSheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
  Object.entries(updates).forEach(([field, value]) => {
    const colIndex = headers.indexOf(field);
    if (colIndex !== -1) rowValues[colIndex] = sanitizeCellValue_(value);
  });
  poSheet.getRange(rowIndex, 1, 1, headers.length).setValues([rowValues]);
}

/**
 * Apply field updates to many POs with a single sheet read + targeted row
 * writes (instead of a full-sheet scan per PO). `items` is [{poNumber, updates}].
 */
function applyPoUpdatesBatch_(poSheet, items) {
  if (!Array.isArray(items) || items.length === 0) return;
  const colCount = Math.max(poSheet.getLastColumn(), 1);
  const lastRow = Math.max(poSheet.getLastRow(), 1);
  const values = poSheet.getRange(1, 1, lastRow, colCount).getValues()
    .map(row => padSheetRowToWidth_(row, colCount));
  const headers = values[0].map(h => String(h ?? "").trim());
  const poCol = headers.indexOf("PO #");
  if (poCol === -1) throw new Error("PO # column not found in sheet.");
  const indexMap = buildPoIndexMap_(values, poCol);
  const changed = new Set();
  items.forEach(item => {
    const idx = indexMap.get(String(item.poNumber ?? "").trim());
    if (idx === undefined) throw new Error("PO # not found: " + item.poNumber);
    Object.entries(item.updates || {}).forEach(([field, value]) => {
      const colIndex = headers.indexOf(field);
      if (colIndex !== -1) {
        values[idx][colIndex] = sanitizeCellValue_(value);
        changed.add(idx);
      }
    });
  });
  changed.forEach(idx => {
    poSheet.getRange(idx + 1, 1, 1, colCount).setValues([values[idx]]);
  });
}

function syncPosFromShipment_(poSheet, shipmentId, shipmentData, poNumbers) {
  const syncData = pickShipmentData_(shipmentData);
  syncData[SHIPMENT_ID_FIELD] = shipmentId;
  syncData["Status"] = "OTW";
  const list = Array.isArray(poNumbers) ? poNumbers.map(String) : [];
  applyPoUpdatesBatch_(poSheet, list.map(poNumber => ({ poNumber: poNumber, updates: syncData })));
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
  const exfCol = headers.indexOf(EXF_REQUESTED_FIELD);
  const statusCol = headers.indexOf("Status");
  if (exfCol !== -1) {
    const exfRequested = poSheet.getRange(rowIndex, exfCol + 1).getValue();
    if (isTruthyCell_(exfRequested) && statusCol !== -1) {
      updates["Status"] = "Requested";
    }
  }
  writePoFields_(poSheet, rowIndex, headers, updates);
}

function isTruthyCell_(value) {
  if (value === true) return true;
  const s = String(value ?? "").trim().toLowerCase();
  return s === "true" || s === "yes" || s === "1";
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
    return shipmentData[h] !== undefined ? sanitizeCellValue_(shipmentData[h]) : "";
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
  const list = Array.isArray(poNumbers) ? poNumbers.map(String) : [];
  if (list.length === 0) return;

  // Read the PO sheet once and map each PO to its (non-empty) shipment id.
  const colCount = Math.max(poSheet.getLastColumn(), 1);
  const lastRow = Math.max(poSheet.getLastRow(), 1);
  const values = poSheet.getRange(1, 1, lastRow, colCount).getValues();
  const headers = values[0].map(h => String(h ?? "").trim());
  const poCol = headers.indexOf("PO #");
  const shipCol = headers.indexOf(SHIPMENT_ID_FIELD);
  if (poCol === -1) throw new Error("PO # column not found in sheet.");
  const poToShipment = new Map();
  for (let i = 1; i < values.length; i++) {
    const po = String(values[i][poCol] ?? "").trim();
    if (!po) continue;
    const ship = shipCol === -1 ? "" : String(values[i][shipCol] ?? "").trim();
    poToShipment.set(po, isEmptyShipmentId_(ship) ? "" : ship);
  }

  // Read the shipments sheet once to confirm the assigned shipment still exists.
  const shipmentsSheet = getShipmentsSheet_();
  const shipRows = shipmentsSheet.getDataRange().getValues();
  const shipHeaders = shipRows.length ? shipRows[0].map(h => String(h ?? "").trim()) : [];
  const shipIdCol = shipHeaders.indexOf(SHIPMENT_ID_FIELD);
  const existingShipments = new Set();
  for (let i = 1; i < shipRows.length; i++) {
    const id = shipIdCol === -1 ? "" : String(shipRows[i][shipIdCol] ?? "").trim();
    if (id) existingShipments.add(id);
  }

  list.forEach(poNumber => {
    const assigned = poToShipment.get(String(poNumber).trim()) || "";
    if (assigned && existingShipments.has(assigned)) {
      throw new Error("PO " + poNumber + " is already assigned to " + assigned);
    }
  });
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
    assertPosEligibleForShipment_(poSheet, poNumbers);
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
      shipmentsSheet.getRange(found.rowIndex, colIndex + 1).setValue(sanitizeCellValue_(shipmentData[field]));
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
      chargebacksSheet.getRange(found.rowIndex, colIndex + 1).setValue(sanitizeCellValue_(updates[field]));
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

function handleSavePackingList(payload) {
  const poNumber = String(payload.poNumber ?? "").trim();
  if (!poNumber) {
    return corsResponse({ success: false, error: "PO # is required." });
  }

  const poSheet = getSheet();
  const poFound = findPoRowIndex_(poSheet, poNumber);
  if (!poFound) {
    return corsResponse({ success: false, error: "PO # not found: " + poNumber });
  }

  const packingListsSheet = getPackingListsSheet_();
  const cartonsSheet = getPackingCartonsSheet_();
  const existing = findPackingListForPo_(packingListsSheet, poNumber);
  const packingListId = existing
    ? String(existing.packingListId)
    : getNextPackingListId_(packingListsSheet);
  const cartons = normalizePackingCartons_(payload.cartons || []);
  const now = new Date();
  const cartonCount = payload.packingList?.["Carton Count"] || cartons.length;
  const notes = payload.packingList?.["Notes"] || "";
  const poEditUpdates = payload.updates || {};
  const invalidFields = Object.keys(poEditUpdates).filter(f => !EDITABLE_FIELDS.includes(f));
  if (invalidFields.length > 0) {
    return corsResponse({
      success: false,
      error: "Not allowed to edit: " + invalidFields.join(", ")
    });
  }

  if (existing) {
    writePoFields_(packingListsSheet, existing.rowIndex, existing.headers, {
      "Carton Count": cartonCount,
      "Notes": notes,
      "Updated At": now,
    });
  } else {
    const headers = packingListsSheet.getRange(1, 1, 1, packingListsSheet.getLastColumn()).getValues()[0]
      .map(h => String(h ?? "").trim());
    const row = headers.map(h => {
      if (h === PACKING_LIST_ID_FIELD) return packingListId;
      if (h === "PO #") return poNumber;
      if (h === "Carton Count") return cartonCount;
      if (h === "Notes") return notes;
      if (h === "Created At" || h === "Updated At") return now;
      return "";
    });
    packingListsSheet.appendRow(row);
  }

  rewritePackingCartonsForList_(cartonsSheet, packingListId, cartons);
  const combinedPoUpdates = writePoUpdatesFromPackingSave_(poSheet, poFound, poEditUpdates);

  return corsResponse({
    success: true,
    packingListId: packingListId,
    poUpdates: combinedPoUpdates
  });
}

function handleDeletePackingList(payload) {
  const packingListId = String(payload.packingListId ?? "").trim();
  const poNumber = String(payload.poNumber ?? "").trim();
  const packingListsSheet = getPackingListsSheet_();
  const cartonsSheet = getPackingCartonsSheet_();
  const found = packingListId
    ? findPackingListRowIndex_(packingListsSheet, packingListId)
    : findPackingListForPo_(packingListsSheet, poNumber);
  if (!found) return corsResponse({ success: true, deleted: 0 });

  const id = String(found.packingListId || packingListId);
  deletePackingCartons_(cartonsSheet, id);
  packingListsSheet.deleteRow(found.rowIndex);

  if (poNumber) {
    const poSheet = getSheet();
    const poFound = findPoRowIndex_(poSheet, poNumber);
    if (poFound) {
      writePoFields_(poSheet, poFound.rowIndex, poFound.headers, { "Has Packing List": false });
    }
  }

  return corsResponse({ success: true, deleted: 1 });
}

const IMPORT_PROTECTED_PO_FIELDS = new Set([
  "Actual Qty", "Selected", "Packing List", "Status"
]);

const IMPORT_DATE_FIELDS = new Set(["PO Date", "EST IHD", "CXL Date"]);

const IMPORT_NUMERIC_FIELDS = (function () {
  const fields = new Set(["PO Qty", "Received Qty", "FOB Cost", "PO Total Cost"]);
  for (let i = 1; i <= 15; i++) fields.add("PO Unit " + i);
  return fields;
})();

function normalizeImportDivision_(value) {
  const s = String(value ?? "").trim();
  if (/^elevator\s*disco$/i.test(s)) return "Elevator Disco";
  if (/^freesia$/i.test(s)) return "Freesia";
  return s;
}

function normalizeImportDateToYmd_(value) {
  if (value == null || value === "") return "";
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
    return Utilities.formatDate(value, tz, "yyyy-MM-dd");
  }
  const s = String(value).trim();
  if (!s || s === "1/1/1900" || s === "1900-01-01") return "";
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (slash) {
    const [, month, day, year] = slash;
    return year + "-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0");
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return iso[1] + "-" + iso[2] + "-" + iso[3];
  return s;
}


function importNumericValuesEqual_(existing, incoming) {
  const toCompareNumber = value => {
    if (value == null || value === "") return 0;
    const n = Number(value);
    return Number.isFinite(n) ? n : NaN;
  };
  const a = toCompareNumber(existing);
  const b = toCompareNumber(incoming);
  if (Number.isFinite(a) && Number.isFinite(b)) return a === b;
  return String(existing ?? "").trim() === String(incoming ?? "").trim();
}

function importFieldValuesEqual_(field, existing, incoming) {
  if (IMPORT_DATE_FIELDS.has(field)) {
    return normalizeImportDateToYmd_(existing) === normalizeImportDateToYmd_(incoming);
  }
  if (IMPORT_NUMERIC_FIELDS.has(field)) {
    return importNumericValuesEqual_(existing, incoming);
  }
  if (field === "Division") {
    return normalizeImportDivision_(existing) === normalizeImportDivision_(incoming);
  }
  return String(existing ?? "").trim() === String(incoming ?? "").trim();
}

function pickChangedImportUpdates_(rowValues, headers, updates) {
  const changed = {};
  Object.entries(updates || {}).forEach(([field, value]) => {
    const colIndex = headers.indexOf(field);
    const existing = colIndex !== -1 ? rowValues[colIndex] : "";
    if (!importFieldValuesEqual_(field, existing, value)) {
      changed[field] = value;
    }
  });
  return changed;
}

function ensurePoHeaders_(poSheet, requiredHeaders) {
  const lastCol = Math.max(poSheet.getLastColumn(), 1);
  const headers = poSheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(h => String(h ?? "").trim());
  const existing = new Set(headers.filter(Boolean));
  let changed = false;
  requiredHeaders.forEach(field => {
    if (!field || existing.has(field)) return;
    headers.push(field);
    existing.add(field);
    changed = true;
  });
  if (changed) {
    poSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return poSheet.getRange(1, 1, 1, poSheet.getLastColumn()).getValues()[0]
    .map(h => String(h ?? "").trim());
}

function padSheetRowToWidth_(row, width) {
  const padded = row.slice();
  while (padded.length < width) padded.push("");
  return padded;
}

function applyImportUpdatesToRowValues_(rowValues, headers, updates) {
  Object.entries(updates).forEach(([field, value]) => {
    const colIndex = headers.indexOf(field);
    if (colIndex !== -1) rowValues[colIndex] = sanitizeCellValue_(value);
  });
}

function buildPoRowValues_(headers, rowData) {
  return headers.map(h => rowData[h] !== undefined ? sanitizeCellValue_(rowData[h]) : "");
}

function buildPoIndexMap_(sheetValues, poCol) {
  const poIndexMap = new Map();
  for (let i = 1; i < sheetValues.length; i++) {
    const poNumber = String(sheetValues[i][poCol] ?? "").trim();
    if (poNumber) poIndexMap.set(poNumber, i);
  }
  return poIndexMap;
}

function pickImportUpdates_(rowData) {
  const updates = {};
  Object.entries(rowData || {}).forEach(([field, value]) => {
    if (field === "PO #") return;
    if (IMPORT_PROTECTED_PO_FIELDS.has(field)) return;
    if (!IMPORT_ALLOWED_PO_FIELDS.has(field)) return;
    updates[field] = value;
  });
  return updates;
}

function handleBulkUpsertPos(payload) {
  const rows = payload.rows || [];
  if (!Array.isArray(rows) || rows.length === 0) {
    return corsResponse({ success: false, error: "No rows to import." });
  }

  const poSheet = getSheet();
  const requiredHeaders = new Set(["PO #"]);
  rows.forEach(rowData => {
    Object.keys(rowData || {}).forEach(field => requiredHeaders.add(field));
  });
  const headers = ensurePoHeaders_(poSheet, Array.from(requiredHeaders));
  const colCount = headers.length;
  const poCol = headers.indexOf("PO #");
  if (poCol === -1) {
    return corsResponse({ success: false, error: "PO # column not found in sheet." });
  }

  const lastRow = Math.max(poSheet.getLastRow(), 1);
  let sheetValues = poSheet.getRange(1, 1, lastRow, colCount).getValues()
    .map(row => padSheetRowToWidth_(row, colCount));
  sheetValues[0] = headers.slice();

  const poIndexMap = buildPoIndexMap_(sheetValues, poCol);
  const rowsToAppend = [];
  const updatedRowIndices = new Set();
  const insertedPoNumbers = [];
  const updatedPoNumbers = [];
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const errors = [];

  rows.forEach((rowData, index) => {
    const poNumber = String(rowData["PO #"] ?? "").trim();
    if (!poNumber) {
      skipped++;
      errors.push({ row: index + 1, error: "Missing PO #" });
      return;
    }

    const updates = pickImportUpdates_(rowData);
    const existingIdx = poIndexMap.get(poNumber);

    if (existingIdx !== undefined) {
      const targetRow = existingIdx < sheetValues.length
        ? sheetValues[existingIdx]
        : rowsToAppend[existingIdx - sheetValues.length];
      const changedUpdates = pickChangedImportUpdates_(targetRow, headers, updates);
      if (Object.keys(changedUpdates).length === 0) return;

      applyImportUpdatesToRowValues_(targetRow, headers, changedUpdates);
      if (existingIdx < sheetValues.length) updatedRowIndices.add(existingIdx);
      updatedPoNumbers.push(poNumber);
      updated++;
      return;
    }

    const newRowValues = buildPoRowValues_(headers, { "PO #": poNumber, ...updates });
    rowsToAppend.push(newRowValues);
    poIndexMap.set(poNumber, sheetValues.length + rowsToAppend.length - 1);
    insertedPoNumbers.push(poNumber);
    inserted++;
  });

  // Write updated rows in batched contiguous runs (fewer setValues round-trips).
  const sortedIdx = Array.from(updatedRowIndices).sort((a, b) => a - b);
  let runStart = 0;
  while (runStart < sortedIdx.length) {
    const start = sortedIdx[runStart];
    let end = start;
    let runEnd = runStart;
    while (runEnd + 1 < sortedIdx.length && sortedIdx[runEnd + 1] === end + 1) {
      runEnd++;
      end = sortedIdx[runEnd];
    }
    const block = [];
    for (let r = start; r <= end; r++) block.push(sheetValues[r]);
    poSheet.getRange(start + 1, 1, block.length, colCount).setValues(block);
    runStart = runEnd + 1;
  }

  if (rowsToAppend.length > 0) {
    poSheet.getRange(sheetValues.length + 1, 1, rowsToAppend.length, colCount).setValues(rowsToAppend);
  }

  return corsResponse({
    success: true,
    inserted,
    updated,
    skipped,
    errors,
    insertedPoNumbers,
    updatedPoNumbers,
  });
}

function assertPosEligibleForShipment_(poSheet, poNumbers) {
  const list = Array.isArray(poNumbers) ? poNumbers.map(String) : [];
  list.forEach(poNumber => {
    const found = findPoRowIndex_(poSheet, poNumber);
    if (!found) throw new Error("PO # not found: " + poNumber);
    const statusCol = found.headers.indexOf("Status");
    const exfCol = found.headers.indexOf(EXF_REQUESTED_FIELD);
    const status = statusCol === -1 ? "" : String(poSheet.getRange(found.rowIndex, statusCol + 1).getValue() ?? "").trim();
    const exfRequested = exfCol === -1 ? false : isTruthyCell_(poSheet.getRange(found.rowIndex, exfCol + 1).getValue());
    if (status !== "Requested" || !exfRequested) {
      throw new Error("PO " + poNumber + " must be EXF Requested with Status Requested.");
    }
  });
}

function generateDeliveryRequestId_(existing) {
  let max = 0;
  existing.forEach(row => {
    const m = /^DR-(\d+)$/.exec(String(row[DELIVERY_REQUEST_ID_FIELD] ?? ""));
    if (m) max = Math.max(max, Number(m[1]));
  });
  return "DR-" + String(max + 1).padStart(4, "0");
}

function generatePickupRequestId_(existing) {
  let max = 0;
  existing.forEach(row => {
    const m = /^PR-(\d+)$/.exec(String(row[PICKUP_REQUEST_ID_FIELD] ?? ""));
    if (m) max = Math.max(max, Number(m[1]));
  });
  return "PR-" + String(max + 1).padStart(4, "0");
}

function appendRequestRow_(sheet, idField, requestId, dataFields, data) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(h => String(h ?? "").trim());
  const row = headers.map(h => {
    if (h === idField) return requestId;
    return data[h] !== undefined ? sanitizeCellValue_(data[h]) : "";
  });
  sheet.appendRow(row);
}

function pickDeliveryRequestData_(raw) {
  const out = {};
  DELIVERY_REQUEST_DATA_FIELDS.forEach(field => {
    if (raw[field] !== undefined) out[field] = raw[field];
  });
  return out;
}

function pickPickupRequestData_(raw) {
  const out = {};
  PICKUP_REQUEST_DATA_FIELDS.forEach(field => {
    if (raw[field] !== undefined) out[field] = raw[field];
  });
  return out;
}

function handleExfRequest(payload) {
  const poNumbers = payload.poNumbers || [];
  if (!Array.isArray(poNumbers) || poNumbers.length === 0) {
    return corsResponse({ success: false, error: "Select at least one PO." });
  }
  const poSheet = getSheet();
  const notes = String(payload.notes ?? "").trim();
  const items = poNumbers.map(poNumber => {
    const updates = {};
    updates[EXF_REQUESTED_FIELD] = true;
    updates["Status"] = "Requested";
    if (notes) updates["Notes"] = notes;
    return { poNumber: poNumber, updates: updates };
  });
  applyPoUpdatesBatch_(poSheet, items);
  return corsResponse({ success: true });
}

function handleBatchUpdatePos(payload) {
  const items = payload.items || [];
  if (!Array.isArray(items) || items.length === 0) {
    return corsResponse({ success: false, error: "No updates provided." });
  }
  const poSheet = getSheet();
  applyPoUpdatesBatch_(poSheet, items);
  return corsResponse({ success: true });
}

function handleAddPosToShipment(payload) {
  const shipmentId = String(payload.shipmentId ?? "").trim();
  const poNumbers = payload.poNumbers || [];
  if (!shipmentId) return corsResponse({ success: false, error: "Shipment ID is required." });
  if (!Array.isArray(poNumbers) || poNumbers.length === 0) {
    return corsResponse({ success: false, error: "Select at least one PO." });
  }

  const shipmentsSheet = getShipmentsSheet_();
  const poSheet = getSheet();
  const found = findShipmentRowIndex_(shipmentsSheet, shipmentId);
  if (!found) return corsResponse({ success: false, error: "Shipment not found: " + shipmentId });

  try {
    assertPosNotAssigned_(poSheet, poNumbers);
    assertPosEligibleForShipment_(poSheet, poNumbers);
  } catch (err) {
    return corsResponse({ success: false, error: err.message });
  }

  const shipmentData = {};
  found.headers.forEach((field, colIndex) => {
    if (field === SHIPMENT_ID_FIELD) return;
    shipmentData[field] = shipmentsSheet.getRange(found.rowIndex, colIndex + 1).getValue();
  });
  syncPosFromShipment_(poSheet, shipmentId, shipmentData, poNumbers);
  return corsResponse({ success: true, shipmentId: shipmentId });
}

function handleRemovePosFromShipment(payload) {
  const shipmentId = String(payload.shipmentId ?? "").trim();
  const poNumbers = payload.poNumbers || [];
  if (!shipmentId) return corsResponse({ success: false, error: "Shipment ID is required." });
  if (!Array.isArray(poNumbers) || poNumbers.length === 0) {
    return corsResponse({ success: false, error: "Select at least one PO." });
  }

  const poSheet = getSheet();
  poNumbers.forEach(poNumber => {
    const found = findPoRowIndex_(poSheet, poNumber);
    if (!found) throw new Error("PO # not found: " + poNumber);
    const shipCol = found.headers.indexOf(SHIPMENT_ID_FIELD);
    const currentShip = shipCol === -1 ? "" : String(poSheet.getRange(found.rowIndex, shipCol + 1).getValue() ?? "").trim();
    if (currentShip !== shipmentId) {
      throw new Error("PO " + poNumber + " is not on shipment " + shipmentId);
    }
    clearPoShipmentDataAtRow_(poSheet, found.rowIndex, found.headers);
  });
  return corsResponse({ success: true, shipmentId: shipmentId });
}

function handleCreateDeliveryRequest(payload) {
  const poNumbers = payload.poNumbers || [];
  if (!Array.isArray(poNumbers) || poNumbers.length === 0) {
    return corsResponse({ success: false, error: "Select at least one PO." });
  }
  const requestData = pickDeliveryRequestData_(payload.request || {});
  if (!requestData["Request Date"]) {
    return corsResponse({ success: false, error: "Request Date is required." });
  }
  if (!requestData["Location"]) {
    return corsResponse({ success: false, error: "Location is required." });
  }

  const sheet = getDeliveryRequestsSheet_();
  const poSheet = getSheet();
  const existing = sheetToObjects_(sheet, DELIVERY_REQUEST_ID_FIELD);
  const requestId = generateDeliveryRequestId_(existing);
  appendRequestRow_(sheet, DELIVERY_REQUEST_ID_FIELD, requestId, DELIVERY_REQUEST_DATA_FIELDS, requestData);

  applyPoUpdatesBatch_(poSheet, poNumbers.map(poNumber => ({
    poNumber: poNumber,
    updates: {
      [DELIVERY_REQUEST_ID_FIELD]: requestId,
      "Status": "Scheduled",
    },
  })));

  return corsResponse({ success: true, deliveryRequestId: requestId });
}

function handleUpdateDeliveryRequest(payload) {
  const requestId = String(payload.deliveryRequestId ?? "").trim();
  if (!requestId) return corsResponse({ success: false, error: "Delivery Request ID is required." });
  const requestData = pickDeliveryRequestData_(payload.request || {});
  const sheet = getDeliveryRequestsSheet_();
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0].map(h => String(h ?? "").trim());
  const idCol = headers.indexOf(DELIVERY_REQUEST_ID_FIELD);
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][idCol]) !== requestId) continue;
    headers.forEach((field, colIndex) => {
      if (field === DELIVERY_REQUEST_ID_FIELD) return;
      if (requestData[field] !== undefined) {
        sheet.getRange(i + 1, colIndex + 1).setValue(sanitizeCellValue_(requestData[field]));
      }
    });
    return corsResponse({ success: true, deliveryRequestId: requestId });
  }
  return corsResponse({ success: false, error: "Delivery request not found: " + requestId });
}

function handleCreatePickupRequest(payload) {
  const poNumbers = payload.poNumbers || [];
  if (!Array.isArray(poNumbers) || poNumbers.length === 0) {
    return corsResponse({ success: false, error: "Select at least one PO." });
  }
  const requestData = pickPickupRequestData_(payload.request || {});
  if (!requestData["Request Date"]) {
    return corsResponse({ success: false, error: "Request Date is required." });
  }
  if (!requestData["Location"]) {
    return corsResponse({ success: false, error: "Location is required." });
  }

  const sheet = getPickupRequestsSheet_();
  const poSheet = getSheet();
  const existing = sheetToObjects_(sheet, PICKUP_REQUEST_ID_FIELD);
  const requestId = generatePickupRequestId_(existing);
  appendRequestRow_(sheet, PICKUP_REQUEST_ID_FIELD, requestId, PICKUP_REQUEST_DATA_FIELDS, requestData);

  poNumbers.forEach(poNumber => {
    const found = findPoRowIndex_(poSheet, poNumber);
    if (!found) throw new Error("PO # not found: " + poNumber);
    const updates = {
      [PICKUP_REQUEST_ID_FIELD]: requestId,
      "Assign Date": requestData["Request Date"],
    };
    const divCol = found.headers.indexOf("Division");
    const division = divCol === -1 ? "" : String(poSheet.getRange(found.rowIndex, divCol + 1).getValue() ?? "").trim();
    if (/^freesia$/i.test(division)) {
      updates["Status"] = "Assigned";
    }
    writePoFields_(poSheet, found.rowIndex, found.headers, updates);
  });

  return corsResponse({ success: true, pickupRequestId: requestId });
}

function handleUpdatePickupRequest(payload) {
  const requestId = String(payload.pickupRequestId ?? "").trim();
  if (!requestId) return corsResponse({ success: false, error: "Pickup Request ID is required." });
  const requestData = pickPickupRequestData_(payload.request || {});
  const sheet = getPickupRequestsSheet_();
  const poSheet = getSheet();
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0].map(h => String(h ?? "").trim());
  const idCol = headers.indexOf(PICKUP_REQUEST_ID_FIELD);
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][idCol]) !== requestId) continue;
    headers.forEach((field, colIndex) => {
      if (field === PICKUP_REQUEST_ID_FIELD) return;
      if (requestData[field] !== undefined) {
        sheet.getRange(i + 1, colIndex + 1).setValue(sanitizeCellValue_(requestData[field]));
      }
    });
    if (requestData["Request Date"]) {
      const allPos = sheetToObjects_(poSheet, "PO #");
      allPos.filter(row => String(row[PICKUP_REQUEST_ID_FIELD] ?? "") === requestId).forEach(row => {
        writePoFields_(poSheet, findPoRowIndex_(poSheet, row["PO #"]).rowIndex, findPoRowIndex_(poSheet, row["PO #"]).headers, {
          "Assign Date": requestData["Request Date"],
        });
      });
    }
    return corsResponse({ success: true, pickupRequestId: requestId });
  }
  return corsResponse({ success: false, error: "Pickup request not found: " + requestId });
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
    const deliveryRequestsSheet = getDeliveryRequestsSheet_();
    const pickupRequestsSheet = getPickupRequestsSheet_();
    const chargebacksSheet = getChargebacksSheet_();
    const packingListsSheet = getPackingListsSheet_();
    const packingCartonsSheet = getPackingCartonsSheet_();
    const data = sheetToObjects_(poSheet, "PO #");
    const shipments = sheetToObjects_(shipmentsSheet, SHIPMENT_ID_FIELD);
    const deliveryRequests = sheetToObjects_(deliveryRequestsSheet, DELIVERY_REQUEST_ID_FIELD);
    const pickupRequests = sheetToObjects_(pickupRequestsSheet, PICKUP_REQUEST_ID_FIELD);
    const chargebacks = sheetToObjects_(chargebacksSheet, CHARGEBACK_ID_FIELD);
    const packingLists = sheetToObjects_(packingListsSheet, PACKING_LIST_ID_FIELD);
    const packingCartons = sheetToObjects_(packingCartonsSheet, PACKING_LIST_ID_FIELD);

    return corsResponse({
      success: true,
      data: data,
      shipments: shipments,
      deliveryRequests: deliveryRequests,
      pickupRequests: pickupRequests,
      chargebacks: chargebacks,
      packingLists: packingLists,
      packingCartons: packingCartons,
      defaultColumns: getDefaultColumns_(),
      defaultStatusFilter: getDefaultStatusFilter_(),
    });
  } catch (err) {
    return errorResponse_(err);
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;

    if (!isAuthorizedRequest_(payload)) {
      return corsResponse({ success: false, error: "Unauthorized." });
    }

    // Serialize writes to avoid races on ID generation and bulk upserts.
    lock.waitLock(30000);

    if (action === "update") return handleUpdate(payload);
    if (action === "saveColumnDefault") return handleSaveColumnDefault(payload);
    if (action === "createShipment") return handleCreateShipment(payload);
    if (action === "updateShipment") return handleUpdateShipment(payload);
    if (action === "deleteShipment") return handleDeleteShipment(payload);
    if (action === "addPosToShipment") return handleAddPosToShipment(payload);
    if (action === "removePosFromShipment") return handleRemovePosFromShipment(payload);
    if (action === "exfRequest") return handleExfRequest(payload);
    if (action === "batchUpdatePos") return handleBatchUpdatePos(payload);
    if (action === "createDeliveryRequest") return handleCreateDeliveryRequest(payload);
    if (action === "updateDeliveryRequest") return handleUpdateDeliveryRequest(payload);
    if (action === "createPickupRequest") return handleCreatePickupRequest(payload);
    if (action === "updatePickupRequest") return handleUpdatePickupRequest(payload);
    if (action === "createChargeback") return handleCreateChargeback(payload);
    if (action === "updateChargeback") return handleUpdateChargeback(payload);
    if (action === "deleteChargeback") return handleDeleteChargeback(payload);
    if (action === "savePackingList") return handleSavePackingList(payload);
    if (action === "deletePackingList") return handleDeletePackingList(payload);
    if (action === "bulkUpsertPos") return handleBulkUpsertPos(payload);

    return corsResponse({ success: false, error: "Unknown action: " + action });
  } catch (err) {
    return errorResponse_(err);
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}
