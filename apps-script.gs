const SHEET_NAME = "POs";
const SHIPMENTS_SHEET_NAME = "Shipments";
const EXF_REQUESTS_SHEET_NAME = "EXF Requests";
const VENDORS_SHEET_NAME = "Vendors";
const ASN_REQUESTS_SHEET_NAME = "ASN Requests";
const DELIVERY_REQUESTS_SHEET_NAME = "Delivery Requests";
const PICKUP_REQUESTS_SHEET_NAME = "Pickup Requests";
const CHARGEBACKS_SHEET_NAME = "Chargebacks";
const PACKING_LISTS_SHEET_NAME = "Packing Lists";
const PACKING_CARTONS_SHEET_NAME = "Packing List Cartons";
const COLUMN_DEFAULT_KEY = "defaultVisibleColumns";
const STATUS_DEFAULT_KEY = "defaultStatusFilter";
const EXF_REQUEST_EMAIL_TRIGGER_HANDLER = "processPendingExfRequestEmails_";
const EXF_REQUEST_EMAIL_TRIGGER_DELAY_MS = 60 * 1000;
const SHIPMENT_ID_FIELD = "Shipment ID";
const EXF_REQUEST_ID_FIELD = "EXF Request ID";
const ASN_REQUEST_ID_FIELD = "ASN Request ID";
const DELIVERY_REQUEST_ID_FIELD = "Delivery Request ID";
const PICKUP_REQUEST_ID_FIELD = "Pickup Request ID";
const EXF_REQUESTED_FIELD = "EXF Requested";
const EXF_REQUEST_DATE_FIELD = "EXF Request Date";
const EXF_MEMO_FIELD = "EXF Memo";
const CHARGEBACK_ID_FIELD = "Chargeback ID";
const PACKING_LIST_ID_FIELD = "Packing List ID";

/*
  POs sheet row 1 headers (see po-table.js COLUMNS). Add columns: Shipment ID, EXF Request Date, EXF Memo

  Shipments sheet row 1 headers (auto-created if missing):
    Shipment ID, Ship Method, Vessel, House #, EXF, Shipped, ETD, ETA, IHD, Notes

  Selected is session-local in the app only.
*/

const SHIPMENT_DATA_FIELDS = [
  "Ship Method", "Vessel", "House #", "EXF", "Shipped", "ETD", "ETA", "IHD", "Notes"
];

const EXF_REQUEST_DATA_FIELDS = [
  "Request Date", "Vendor", "Vendor Email", "PO Numbers", "PO Count", "Total Qty",
  "Email Status", "Email Sent At", "Email Error", "Last Email Attempt At", "Created At", "Updated At"
];

const ASN_REQUEST_DATA_FIELDS = [
  "Request Date", "Notes"
];

const DELIVERY_REQUEST_DATA_FIELDS = [
  "Request Date", "Location", "Email To", "Email CC", "Email Status", "Email Sent At", "Email Error", "Notes"
];
const PICKUP_REQUEST_DATA_FIELDS = [
  "Request Date", "Location", "Email To", "Email CC", "Email Status", "Email Sent At", "Email Error", "Notes"
];

const EDITABLE_FIELDS = [
  "Flag",
  "PO Qty", "Status", "N41 Status", "Ship Method",
  "Vessel", "House #", "Shipped", "ETD", "ETA", "IHD",
  "EST EXF", "EST IHD", "EXF", "CXL Date", "Assign Date", "Notes",
  EXF_REQUESTED_FIELD, EXF_REQUEST_DATE_FIELD, EXF_MEMO_FIELD, ASN_REQUEST_ID_FIELD, DELIVERY_REQUEST_ID_FIELD, PICKUP_REQUEST_ID_FIELD,
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
  PACKING_LIST_ID_FIELD, "Carton #", ...PACKING_UNIT_FIELDS, "Total Units", "Carton Weight"
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

function getExfRequestsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(EXF_REQUESTS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(EXF_REQUESTS_SHEET_NAME);
    sheet.getRange(1, 1, 1, EXF_REQUEST_DATA_FIELDS.length + 1).setValues([[
      EXF_REQUEST_ID_FIELD, ...EXF_REQUEST_DATA_FIELDS
    ]]);
  }
  return sheet;
}

function getVendorsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(VENDORS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(VENDORS_SHEET_NAME);
    sheet.getRange(1, 1, 1, 3).setValues([["Vendor", "Email", "CC"]]);
  }
  return sheet;
}

function ensurePoWorkflowHeaders_() {
  const sheet = getSheet();
  ensureSheetHeaders_(sheet, [
    ASN_REQUEST_ID_FIELD,
    DELIVERY_REQUEST_ID_FIELD,
    PICKUP_REQUEST_ID_FIELD,
    "Has Packing List",
  ]);
  return sheet;
}

function ensureSheetHeaders_(sheet, requiredHeaders) {
  const lastCol = sheet.getLastColumn();
  const headers = lastCol > 0
    ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h ?? "").trim())
    : [];
  const missing = requiredHeaders.filter(header => headers.indexOf(header) === -1);
  if (missing.length > 0) {
    sheet.getRange(1, headers.length + 1, 1, missing.length).setValues([missing]);
  }
}

function getAsnRequestsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(ASN_REQUESTS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(ASN_REQUESTS_SHEET_NAME);
    sheet.getRange(1, 1, 1, ASN_REQUEST_DATA_FIELDS.length + 1).setValues([[
      ASN_REQUEST_ID_FIELD, ...ASN_REQUEST_DATA_FIELDS
    ]]);
  }
  ensureSheetHeaders_(sheet, [ASN_REQUEST_ID_FIELD, ...ASN_REQUEST_DATA_FIELDS]);
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
  ensureSheetHeaders_(sheet, [DELIVERY_REQUEST_ID_FIELD, ...DELIVERY_REQUEST_DATA_FIELDS]);
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
  ensureSheetHeaders_(sheet, [PICKUP_REQUEST_ID_FIELD, ...PICKUP_REQUEST_DATA_FIELDS]);
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
  ensureSheetHeaders_(sheet, [PACKING_LIST_ID_FIELD, ...PACKING_LIST_DATA_FIELDS]);
  return sheet;
}

function getPackingCartonsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(PACKING_CARTONS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(PACKING_CARTONS_SHEET_NAME);
    sheet.getRange(1, 1, 1, PACKING_CARTON_DATA_FIELDS.length).setValues([PACKING_CARTON_DATA_FIELDS]);
  }
  ensureSheetHeaders_(sheet, PACKING_CARTON_DATA_FIELDS);
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

/** Return a safe client error message; full detail is logged server-side. */
function errorResponse_(err) {
  console.error(err && err.stack ? err.stack : err);
  const message = err && err.message ? String(err.message).trim() : "";
  return corsResponse({
    success: false,
    error: message || "Request failed. Please try again.",
  });
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

function parseExfRequestIdSequence_(id) {
  const s = String(id ?? "").trim();
  const m = /^EXF-(\d+)$/.exec(s);
  return m ? Number(m[1]) : 0;
}

function formatExfRequestId_(sequence) {
  return "EXF-" + String(sequence).padStart(4, "0");
}

function generateExfRequestId_(requests) {
  let max = 0;
  requests.forEach(request => {
    max = Math.max(max, parseExfRequestIdSequence_(request[EXF_REQUEST_ID_FIELD]));
  });
  return formatExfRequestId_(max + 1);
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
    if (poNumbersEqual_(rows[i][poCol], poNumber)) {
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
    const weight = Number(String(carton["Carton Weight"] ?? "").trim());
    out["Carton Weight"] = Number.isFinite(weight) && weight > 0 ? weight : "";
    return out;
  });
}

function rewritePackingCartonsForList_(cartonsSheet, packingListId, cartons) {
  const lastRow = cartonsSheet.getLastRow();
  const lastCol = Math.max(cartonsSheet.getLastColumn(), 1);
  if (lastRow < 1) return;

  const headers = cartonsSheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(h => String(h ?? "").trim());
  const idCol = headers.indexOf(PACKING_LIST_ID_FIELD);
  if (idCol === -1) throw new Error("Packing List ID column not found in cartons sheet.");

  const key = String(packingListId);
  if (lastRow >= 2) {
    const idValues = cartonsSheet.getRange(2, idCol + 1, lastRow - 1, 1).getValues();
    const rowsToDelete = [];
    for (let i = 0; i < idValues.length; i++) {
      if (String(idValues[i][0]) === key) rowsToDelete.push(i + 2);
    }
    rowsToDelete.sort((a, b) => b - a).forEach(rowIndex => cartonsSheet.deleteRow(rowIndex));
  }

  const normalized = normalizePackingCartons_(cartons || []);
  if (normalized.length === 0) return;

  const newRows = normalized.map(carton =>
    headers.map(h => {
      if (h === PACKING_LIST_ID_FIELD) return key;
      return carton[h] !== undefined ? carton[h] : "";
    })
  );
  const startRow = cartonsSheet.getLastRow() + 1;
  cartonsSheet.getRange(startRow, 1, newRows.length, headers.length).setValues(newRows);
}

function deletePackingCartons_(cartonsSheet, packingListId) {
  rewritePackingCartonsForList_(cartonsSheet, packingListId, []);
}

function poNumbersEqual_(left, right) {
  const a = String(left ?? "").trim();
  const b = String(right ?? "").trim();
  if (!a || !b) return false;
  if (a === b) return true;
  const na = Number(a);
  const nb = Number(b);
  return Number.isFinite(na) && Number.isFinite(nb) && na === nb;
}

function computePackingTotalsFromCartons_(cartons) {
  const totals = Array.from({ length: PACKING_UNIT_FIELDS.length }, () => 0);
  (Array.isArray(cartons) ? cartons : []).forEach(carton => {
    PACKING_UNIT_FIELDS.forEach((field, index) => {
      totals[index] += toPackingQty_(carton[field]);
    });
  });
  return totals;
}

function buildPoUpdatesFromPackingSave_(cartons, cartonCount, extraUpdates) {
  const updates = Object.assign({}, sanitizeUpdatesMap_(extraUpdates || {}));
  const totals = computePackingTotalsFromCartons_(cartons);
  updates["Has Packing List"] = true;
  updates["Ctn Qty"] = cartonCount;
  updates["Actual Qty"] = totals.reduce((sum, qty) => sum + qty, 0);
  totals.forEach((qty, index) => {
    updates["Act Unit " + (index + 1)] = qty || "";
  });
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
    if (poNumbersEqual_(rows[i][poCol], poNumber)) return { rowIndex: i + 1, headers: headers };
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

  const poSheet = ensurePoWorkflowHeaders_();
  if (!poSheet) {
    return corsResponse({ success: false, error: "POs sheet not found." });
  }

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
  if (cartons.length === 0) {
    return corsResponse({ success: false, error: "At least one carton is required." });
  }
  if (cartons.some(carton => Number(carton["Total Units"] || 0) <= 0)) {
    return corsResponse({ success: false, error: "A carton quantity cannot be zero." });
  }

  const now = new Date();
  const cartonCount = payload.packingList?.["Carton Count"] || cartons.length;
  const notes = payload.packingList?.["Notes"] || "";
  const poEditUpdates = sanitizeUpdatesMap_(payload.updates || {});
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
  const poHeaders = poSheet.getRange(1, 1, 1, poSheet.getLastColumn()).getValues()[0]
    .map(h => String(h ?? "").trim());
  const combinedPoUpdates = buildPoUpdatesFromPackingSave_(cartons, cartonCount, poEditUpdates);
  writePoFields_(poSheet, poFound.rowIndex, poHeaders, combinedPoUpdates);

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

function generateAsnRequestId_(existing) {
  let max = 0;
  existing.forEach(row => {
    const m = /^ASN-(\d+)$/.exec(String(row[ASN_REQUEST_ID_FIELD] ?? ""));
    if (m) max = Math.max(max, Number(m[1]));
  });
  return "ASN-" + String(max + 1).padStart(4, "0");
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

function findRequestRowIndex_(sheet, idField, requestId) {
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 1) return null;
  const headers = rows[0].map(h => String(h ?? "").trim());
  const idCol = headers.indexOf(idField);
  if (idCol === -1) throw new Error(idField + " column not found.");
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][idCol]) === String(requestId)) {
      return { rowIndex: i + 1, headers: headers, values: rows[i] };
    }
  }
  return null;
}

function updateRequestRowFields_(sheet, rowIndex, headers, updates) {
  const rowValues = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
  Object.entries(updates).forEach(([field, value]) => {
    const colIndex = headers.indexOf(field);
    if (colIndex !== -1) rowValues[colIndex] = sanitizeCellValue_(value);
  });
  sheet.getRange(rowIndex, 1, 1, headers.length).setValues([rowValues]);
}

function getPoObjectsByNumbers_(poSheet, poNumbers) {
  const wanted = new Set((Array.isArray(poNumbers) ? poNumbers : []).map(po => String(po ?? "").trim()));
  const rows = sheetToObjects_(poSheet, "PO #").filter(row => wanted.has(String(row["PO #"] ?? "").trim()));
  if (rows.length !== wanted.size) {
    const found = new Set(rows.map(row => String(row["PO #"] ?? "").trim()));
    const missing = Array.from(wanted).filter(po => !found.has(po));
    throw new Error("PO # not found: " + missing.join(", "));
  }
  return rows;
}

function getPackingListPoSet_() {
  const sheet = getPackingListsSheet_();
  return new Set(sheetToObjects_(sheet, PACKING_LIST_ID_FIELD)
    .map(row => {
      const po = String(row["PO #"] ?? "").trim();
      if (!po) return "";
      const n = Number(po);
      return Number.isFinite(n) ? String(n) : po;
    })
    .filter(Boolean));
}

function assertRowsHavePackingLists_(rows) {
  const packingPoSet = getPackingListPoSet_();
  const missing = rows
    .filter(row => !packingPoSet.has(String(row["PO #"] ?? "").trim()))
    .map(row => row["PO #"]);
  if (missing.length > 0) {
    throw new Error("Packing List is required for PO " + missing.join(", "));
  }
}

function isDeliveryPickupStatus_(row) {
  const status = String(row["Status"] ?? "").trim();
  return status === "OTW" || status === "Arrived at Port";
}

function isFreesiaDivision_(row) {
  return /^freesia$/i.test(String(row["Division"] ?? "").trim());
}

function assertRowsEligibleForAsnRequest_(rows) {
  assertRowsHavePackingLists_(rows);
  rows.forEach(row => {
    if (!isDeliveryPickupStatus_(row) || !isFreesiaDivision_(row)) {
      throw new Error("PO " + row["PO #"] + " must be Freesia with Status OTW or Arrived at Port.");
    }
    if (String(row[ASN_REQUEST_ID_FIELD] ?? "").trim()) {
      throw new Error("PO " + row["PO #"] + " already has an ASN request.");
    }
    if (String(row[DELIVERY_REQUEST_ID_FIELD] ?? "").trim() || String(row[PICKUP_REQUEST_ID_FIELD] ?? "").trim()) {
      throw new Error("PO " + row["PO #"] + " already has a delivery or pickup request.");
    }
  });
}

function assertRowsEligibleForDeliveryPickupRequest_(rows) {
  assertRowsHavePackingLists_(rows);
  rows.forEach(row => {
    if (!isDeliveryPickupStatus_(row)) {
      throw new Error("PO " + row["PO #"] + " must have Status OTW or Arrived at Port.");
    }
    if (String(row[DELIVERY_REQUEST_ID_FIELD] ?? "").trim() || String(row[PICKUP_REQUEST_ID_FIELD] ?? "").trim()) {
      throw new Error("PO " + row["PO #"] + " already has a delivery or pickup request.");
    }
    if (isFreesiaDivision_(row) && !String(row[ASN_REQUEST_ID_FIELD] ?? "").trim()) {
      throw new Error("PO " + row["PO #"] + " needs an ASN request before delivery or pickup.");
    }
  });
}

function normalizeVendorName_(value) {
  return String(value ?? "").trim();
}

function assertSingleVendorForRows_(rows) {
  if (!rows.length) throw new Error("Select at least one PO.");
  const vendor = normalizeVendorName_(rows[0]["Vendor"]);
  if (!vendor) throw new Error("Vendor is required on all EXF request POs.");
  rows.forEach(row => {
    if (normalizeVendorName_(row["Vendor"]) !== vendor) {
      throw new Error("EXF Request POs must all have the same vendor.");
    }
  });
  return vendor;
}

function getVendorEmailInfo_(vendor) {
  const sheet = getVendorsSheet_();
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return { to: "", cc: "" };
  const headers = rows[0].map(h => String(h ?? "").trim());
  const headerIndex = function(names) {
    const lowered = names.map(function(name) { return name.toLowerCase(); });
    return headers.findIndex(function(header) {
      return lowered.indexOf(header.toLowerCase()) !== -1;
    });
  };
  const vendorCol = headerIndex(["Vendor", "Vendor Name", "Name"]);
  const emailCol = headerIndex(["Email", "Vendor Email", "Email Address", "E-mail", "To"]);
  const ccCol = headerIndex(["CC", "Vendor CC", "Cc"]);
  if (vendorCol === -1 || emailCol === -1) return { to: "", cc: "" };
  const vendorKey = normalizeVendorName_(vendor).toLowerCase();
  for (let i = rows.length - 1; i >= 1; i--) {
    if (normalizeVendorName_(rows[i][vendorCol]).toLowerCase() !== vendorKey) continue;
    return {
      to: String(rows[i][emailCol] ?? "").trim(),
      cc: ccCol === -1 ? "" : String(rows[i][ccCol] ?? "").trim(),
    };
  }
  return { to: "", cc: "" };
}

function getExfRequestEmailInfo_(payload, vendor) {
  const stored = getVendorEmailInfo_(vendor);
  const submittedTo = String(payload.vendorEmail ?? "").trim();
  const submittedCc = String(payload.vendorCc ?? "").trim();
  return {
    to: submittedTo || stored.to,
    cc: submittedCc || stored.cc,
  };
}

function escapeHtml_(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatEmailDate_(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "MM/dd/yyyy");
  }
  const s = String(value).trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) return iso[2] + "/" + iso[3] + "/" + iso[1];
  return s;
}

function normalizeEmailRecipients_(value) {
  return String(value ?? "")
    .split(/[;,\n\r]+/)
    .map(email => email.trim())
    .filter(Boolean)
    .join(", ");
}

function getDeliveryPickupEmailInfo_(requestData) {
  return {
    to: normalizeEmailRecipients_(requestData["Email To"]),
    cc: normalizeEmailRecipients_(requestData["Email CC"]),
  };
}

function buildDeliveryPickupRequestEmailHtml_(requestType, requestId, rows, requestData) {
  const bodyRows = rows.map(row => {
    return "<tr>" +
      "<td>" + escapeHtml_(row["PO #"]) + "</td>" +
      "<td>" + escapeHtml_(row["Status"]) + "</td>" +
      "<td>" + escapeHtml_(row["Vendor"]) + "</td>" +
      "<td>" + escapeHtml_(row["Buyer"]) + "</td>" +
      "<td>" + escapeHtml_(row["Buyer PO #"]) + "</td>" +
      "<td>" + escapeHtml_(row["Style #"]) + "</td>" +
      "<td style=\"text-align:right;\">" + escapeHtml_(row["PO Qty"]) + "</td>" +
    "</tr>";
  }).join("");
  const notes = String(requestData["Notes"] ?? "").trim();

  return "<p>Hello,</p>" +
    "<p>Please see the " + escapeHtml_(requestType.toLowerCase()) + " request below.</p>" +
    "<p><strong>" + escapeHtml_(requestType) + " Request:</strong> " + escapeHtml_(requestId) + "<br>" +
    "<strong>Request Date:</strong> " + escapeHtml_(formatEmailDate_(requestData["Request Date"])) + "<br>" +
    "<strong>Location:</strong> " + escapeHtml_(requestData["Location"]) + "</p>" +
    (notes ? "<p><strong>Notes:</strong><br>" + escapeHtml_(notes).replace(/\n/g, "<br>") + "</p>" : "") +
    "<table border=\"1\" cellpadding=\"6\" cellspacing=\"0\" style=\"border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px;\">" +
      "<thead><tr>" +
        "<th>PO #</th><th>Status</th><th>Vendor</th><th>Buyer</th><th>Buyer PO #</th><th>Style #</th><th>Order Qty</th>" +
      "</tr></thead>" +
      "<tbody>" + bodyRows + "</tbody>" +
    "</table>" +
    "<p>Thank you.</p>";
}

function buildDeliveryPickupRequestEmailText_(requestType, requestId, rows, requestData) {
  const lines = [
    "Hello,",
    "",
    "Please see the " + requestType.toLowerCase() + " request below.",
    "",
    requestType + " Request: " + requestId,
    "Request Date: " + formatEmailDate_(requestData["Request Date"]),
    "Location: " + String(requestData["Location"] ?? ""),
  ];
  const notes = String(requestData["Notes"] ?? "").trim();
  if (notes) lines.push("Notes: " + notes);
  lines.push("");
  rows.forEach(row => {
    lines.push(
      "PO #: " + String(row["PO #"] ?? ""),
      "Status: " + String(row["Status"] ?? ""),
      "Vendor: " + String(row["Vendor"] ?? ""),
      "Buyer: " + String(row["Buyer"] ?? ""),
      "Buyer PO #: " + String(row["Buyer PO #"] ?? ""),
      "Style #: " + String(row["Style #"] ?? ""),
      "Order Qty: " + String(row["PO Qty"] ?? ""),
      ""
    );
  });
  lines.push("Thank you.");
  return lines.join("\n");
}

function sendDeliveryPickupRequestEmail_(requestType, requestId, emailInfo, rows, requestData) {
  if (!emailInfo.to) return false;
  const displayDate = formatEmailDate_(requestData["Request Date"]);
  const location = String(requestData["Location"] ?? "").trim();
  const subject = "[ELEVATOR DISCO] " + requestType + " Request - " + displayDate + (location ? " - " + location : "");
  const options = {
    to: emailInfo.to,
    subject: subject,
    body: buildDeliveryPickupRequestEmailText_(requestType, requestId, rows, requestData),
    htmlBody: buildDeliveryPickupRequestEmailHtml_(requestType, requestId, rows, requestData),
  };
  if (emailInfo.cc) options.cc = emailInfo.cc;
  MailApp.sendEmail(options);
  return true;
}

function getExfRequestPoTotalQty_(rows) {
  return rows.reduce((sum, row) => {
    const n = Number(String(row["PO Qty"] ?? "").replace(/,/g, ""));
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}

function buildExfRequestEmailHtml_(requestId, vendor, rows, requestDate, memos, shipMethods) {
  const bodyRows = rows.map(row => {
    const po = String(row["PO #"] ?? "");
    return "<tr>" +
      "<td>" + escapeHtml_(po) + "</td>" +
      "<td>" + escapeHtml_(row["Style #"]) + "</td>" +
      "<td>" + escapeHtml_(row["Buyer"]) + "</td>" +
      "<td>" + escapeHtml_(row["Buyer PO #"]) + "</td>" +
      "<td style=\"text-align:right;\">" + escapeHtml_(row["PO Qty"]) + "</td>" +
      "<td>" + escapeHtml_(shipMethods[po] ?? row["Ship Method"]) + "</td>" +
      "<td>" + escapeHtml_(formatEmailDate_(row["CXL Date"])) + "</td>" +
      "<td>" + escapeHtml_(memos[po] ?? row[EXF_MEMO_FIELD]) + "</td>" +
    "</tr>";
  }).join("");

  return "<p>Hello,</p>" +
    "<p>Please confirm EXF readiness for the POs below.</p>" +
    "<p><strong>EXF Request:</strong> " + escapeHtml_(requestId) + "<br>" +
    "<strong>Vendor:</strong> " + escapeHtml_(vendor) + "<br>" +
    "<strong>Request Date:</strong> " + escapeHtml_(requestDate) + "</p>" +
    "<table border=\"1\" cellpadding=\"6\" cellspacing=\"0\" style=\"border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px;\">" +
      "<thead><tr>" +
        "<th>PO #</th><th>Style #</th><th>Buyer</th><th>Buyer PO #</th>" +
        "<th>Order Qty</th><th>Ship Method</th><th>CXL Date</th><th>EXF Memo</th>" +
      "</tr></thead>" +
      "<tbody>" + bodyRows + "</tbody>" +
    "</table>" +
    "<p>Thank you.</p>";
}

function buildExfRequestEmailText_(requestId, vendor, rows, requestDate, memos, shipMethods) {
  const lines = [
    "Hello,",
    "",
    "Please confirm EXF readiness for the POs below.",
    "",
    "EXF Request: " + requestId,
    "Vendor: " + vendor,
    "Request Date: " + requestDate,
    "",
  ];
  rows.forEach(row => {
    const po = String(row["PO #"] ?? "");
    lines.push(
      "PO #: " + po,
      "Style #: " + String(row["Style #"] ?? ""),
      "Buyer: " + String(row["Buyer"] ?? ""),
      "Buyer PO #: " + String(row["Buyer PO #"] ?? ""),
      "Order Qty: " + String(row["PO Qty"] ?? ""),
      "Ship Method: " + String(shipMethods[po] ?? row["Ship Method"] ?? ""),
      "CXL Date: " + formatEmailDate_(row["CXL Date"]),
      "EXF Memo: " + String(memos[po] ?? row[EXF_MEMO_FIELD] ?? ""),
      ""
    );
  });
  lines.push("Thank you.");
  return lines.join("\n");
}

function sendExfRequestEmail_(requestId, vendor, vendorEmailInfo, rows, requestDate, memos, shipMethods) {
  if (!vendorEmailInfo.to) {
    throw new Error("No vendor email found for " + vendor + ". Add it to the Vendors sheet.");
  }

  const displayDate = formatEmailDate_(requestDate);
  const subject = "[ELEVATOR DISCO] EXF Request - " + displayDate + " - " + vendor;
  const htmlBody = buildExfRequestEmailHtml_(requestId, vendor, rows, displayDate, memos, shipMethods);
  const options = {
    to: vendorEmailInfo.to,
    subject: subject,
    body: buildExfRequestEmailText_(requestId, vendor, rows, displayDate, memos, shipMethods),
    htmlBody: htmlBody,
  };
  if (vendorEmailInfo.cc) options.cc = vendorEmailInfo.cc;
  MailApp.sendEmail(options);
}

function isQueuedExfRequestEmailStatus_(status) {
  const s = String(status ?? "").trim().toLowerCase();
  return s === "queued" || s === "pending";
}

function getExfRequestPoNumbersFromRecord_(request) {
  return String(request["PO Numbers"] ?? "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

function removeExfRequestEmailProcessingTriggers_() {
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === EXF_REQUEST_EMAIL_TRIGGER_HANDLER) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

function scheduleExfRequestEmailProcessing_() {
  const alreadyScheduled = ScriptApp.getProjectTriggers().some(trigger =>
    trigger.getHandlerFunction() === EXF_REQUEST_EMAIL_TRIGGER_HANDLER
  );
  if (alreadyScheduled) return;
  ScriptApp.newTrigger(EXF_REQUEST_EMAIL_TRIGGER_HANDLER)
    .timeBased()
    .after(EXF_REQUEST_EMAIL_TRIGGER_DELAY_MS)
    .create();
}

function hasQueuedExfRequestEmails_(exfRequestsSheet) {
  const rows = exfRequestsSheet.getDataRange().getValues();
  if (rows.length < 2) return false;
  const headers = rows[0].map(h => String(h ?? "").trim());
  const statusCol = headers.indexOf("Email Status");
  const idCol = headers.indexOf(EXF_REQUEST_ID_FIELD);
  if (statusCol === -1 || idCol === -1) return false;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][idCol] && isQueuedExfRequestEmailStatus_(rows[i][statusCol])) return true;
  }
  return false;
}

function sendAndFinalizeExfRequestEmail_(exfRequestsSheet, found) {
  const request = {};
  found.headers.forEach((field, i) => { request[field] = found.values[i]; });

  const requestId = String(request[EXF_REQUEST_ID_FIELD] ?? "").trim();
  const poNumbers = getExfRequestPoNumbersFromRecord_(request);
  const requestDate = request["Request Date"];
  const poSheet = getSheet();
  let poRows;
  let vendor;
  let vendorEmailInfo;
  const memos = {};
  const shipMethods = {};
  let emailSent = false;
  let emailError = "";

  try {
    poRows = getPoObjectsByNumbers_(poSheet, poNumbers);
    vendor = assertSingleVendorForRows_(poRows);
    const storedVendorEmailInfo = getVendorEmailInfo_(vendor);
    vendorEmailInfo = {
      to: String(request["Vendor Email"] ?? "").trim() || storedVendorEmailInfo.to,
      cc: storedVendorEmailInfo.cc,
    };
    poRows.forEach(row => {
      const po = String(row["PO #"] ?? "");
      memos[po] = row[EXF_MEMO_FIELD] ?? "";
      shipMethods[po] = row["Ship Method"] ?? "";
    });

    sendExfRequestEmail_(requestId, vendor, vendorEmailInfo, poRows, requestDate, memos, shipMethods);
    markExfRequestPosRequested_(poSheet, poNumbers, requestDate, memos, shipMethods);
    emailSent = true;
  } catch (err) {
    emailError = err && err.message ? err.message : String(err);
  }

  updateRequestRowFields_(exfRequestsSheet, found.rowIndex, found.headers, {
    "Vendor Email": vendorEmailInfo ? vendorEmailInfo.to : request["Vendor Email"],
    "Email Status": emailSent ? "Sent" : "Failed",
    "Email Sent At": emailSent ? new Date() : request["Email Sent At"],
    "Email Error": emailError,
    "Last Email Attempt At": new Date(),
    "Updated At": new Date(),
  });

  return {
    requestId: requestId,
    emailSent: emailSent,
    emailError: emailError,
  };
}

function processPendingExfRequestEmails_() {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    removeExfRequestEmailProcessingTriggers_();

    const exfRequestsSheet = getExfRequestsSheet_();
    const rows = exfRequestsSheet.getDataRange().getValues();
    if (rows.length < 2) return;

    const headers = rows[0].map(h => String(h ?? "").trim());
    const idCol = headers.indexOf(EXF_REQUEST_ID_FIELD);
    const statusCol = headers.indexOf("Email Status");
    if (idCol === -1 || statusCol === -1) return;

    for (let i = 1; i < rows.length; i++) {
      if (!rows[i][idCol] || !isQueuedExfRequestEmailStatus_(rows[i][statusCol])) continue;
      sendAndFinalizeExfRequestEmail_(exfRequestsSheet, {
        rowIndex: i + 1,
        headers: headers,
        values: rows[i],
      });
    }

    if (hasQueuedExfRequestEmails_(exfRequestsSheet)) {
      scheduleExfRequestEmailProcessing_();
    }
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function applyExfRequestPoDraftFields_(poSheet, poNumbers, memos, shipMethods) {
  const items = poNumbers.map(poNumber => {
    const updates = {};
    if (shipMethods[poNumber] !== undefined) updates["Ship Method"] = shipMethods[poNumber];
    const memo = String(memos[poNumber] ?? "").trim();
    if (memo) updates[EXF_MEMO_FIELD] = memo;
    return { poNumber: poNumber, updates: updates };
  }).filter(item => Object.keys(item.updates).length > 0);
  applyPoUpdatesBatch_(poSheet, items);
}

function markExfRequestPosRequested_(poSheet, poNumbers, requestDate, memos, shipMethods) {
  const items = poNumbers.map(poNumber => {
    const updates = {};
    updates[EXF_REQUESTED_FIELD] = true;
    updates["Status"] = "Requested";
    updates[EXF_REQUEST_DATE_FIELD] = requestDate;
    if (shipMethods[poNumber] !== undefined) updates["Ship Method"] = shipMethods[poNumber];
    const memo = String(memos[poNumber] ?? "").trim();
    if (memo) updates[EXF_MEMO_FIELD] = memo;
    return { poNumber: poNumber, updates: updates };
  });
  applyPoUpdatesBatch_(poSheet, items);
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

function pickAsnRequestData_(raw) {
  const out = {};
  ASN_REQUEST_DATA_FIELDS.forEach(field => {
    if (raw[field] !== undefined) out[field] = raw[field];
  });
  return out;
}

function handleExfRequest(payload) {
  const poNumbers = payload.poNumbers || [];
  if (!Array.isArray(poNumbers) || poNumbers.length === 0) {
    return corsResponse({ success: false, error: "Select at least one PO." });
  }
  const requestDate = String(payload.requestDate ?? "").trim();
  if (!requestDate) {
    return corsResponse({ success: false, error: "Request Date is required." });
  }
  const memos = payload.memos || {};
  const shipMethods = payload.shipMethods || {};
  const missingShipMethods = poNumbers.filter(function(poNumber) {
    return String(shipMethods[poNumber] ?? "").trim() === "";
  });
  if (missingShipMethods.length > 0) {
    return corsResponse({ success: false, error: "Select Shipping Method for all POs before submitting." });
  }
  const poSheet = ensurePoWorkflowHeaders_();
  let poRows;
  let vendor;
  try {
    poRows = getPoObjectsByNumbers_(poSheet, poNumbers);
    assertRowsHavePackingLists_(poRows);
    vendor = assertSingleVendorForRows_(poRows);
    poRows.forEach(row => {
      const status = String(row["Status"] ?? "").trim();
      if (status !== "WIP" || isTruthyCell_(row[EXF_REQUESTED_FIELD])) {
        throw new Error("PO " + row["PO #"] + " must be WIP and not already EXF requested.");
      }
    });
  } catch (err) {
    return corsResponse({ success: false, error: err.message });
  }

  const vendorEmailInfo = getExfRequestEmailInfo_(payload, vendor);
  if (!vendorEmailInfo.to) {
    return corsResponse({ success: false, error: "Vendor Email is required to send the EXF request." });
  }

  const exfRequestsSheet = getExfRequestsSheet_();
  const existingRequests = sheetToObjects_(exfRequestsSheet, EXF_REQUEST_ID_FIELD);
  const requestId = generateExfRequestId_(existingRequests);

  applyExfRequestPoDraftFields_(poSheet, poNumbers, memos, shipMethods);

  const now = new Date();
  appendRequestRow_(exfRequestsSheet, EXF_REQUEST_ID_FIELD, requestId, EXF_REQUEST_DATA_FIELDS, {
    "Request Date": requestDate,
    "Vendor": vendor,
    "Vendor Email": vendorEmailInfo.to,
    "PO Numbers": poNumbers.join(", "),
    "PO Count": poNumbers.length,
    "Total Qty": getExfRequestPoTotalQty_(poRows),
    "Email Status": "Queued",
    "Created At": now,
    "Updated At": now,
  });

  try {
    scheduleExfRequestEmailProcessing_();
  } catch (err) {
    return corsResponse({
      success: false,
      error: "EXF request was saved, but the background email job could not be scheduled. Use Resend from EXF Requests.",
      exfRequestId: requestId,
    });
  }

  return corsResponse({
    success: true,
    exfRequestId: requestId,
    emailQueued: true,
  });
}

function handleCreateAsnRequest(payload) {
  const poNumbers = payload.poNumbers || [];
  if (!Array.isArray(poNumbers) || poNumbers.length === 0) {
    return corsResponse({ success: false, error: "Select at least one PO." });
  }
  const requestData = pickAsnRequestData_(payload.request || {});
  if (!requestData["Request Date"]) {
    return corsResponse({ success: false, error: "Request Date is required." });
  }

  const sheet = getAsnRequestsSheet_();
  const poSheet = ensurePoWorkflowHeaders_();
  let poRows;
  try {
    poRows = getPoObjectsByNumbers_(poSheet, poNumbers);
    assertRowsEligibleForAsnRequest_(poRows);
  } catch (err) {
    return corsResponse({ success: false, error: err.message });
  }

  const existing = sheetToObjects_(sheet, ASN_REQUEST_ID_FIELD);
  const requestId = generateAsnRequestId_(existing);
  appendRequestRow_(sheet, ASN_REQUEST_ID_FIELD, requestId, ASN_REQUEST_DATA_FIELDS, requestData);
  applyPoUpdatesBatch_(poSheet, poNumbers.map(poNumber => ({
    poNumber: poNumber,
    updates: {
      [ASN_REQUEST_ID_FIELD]: requestId,
    },
  })));

  return corsResponse({
    success: true,
    asnRequestId: requestId,
  });
}

function handleResendExfRequestEmail(payload) {
  const requestId = String(payload.exfRequestId ?? "").trim();
  if (!requestId) return corsResponse({ success: false, error: "EXF Request ID is required." });

  const exfRequestsSheet = getExfRequestsSheet_();
  const found = findRequestRowIndex_(exfRequestsSheet, EXF_REQUEST_ID_FIELD, requestId);
  if (!found) return corsResponse({ success: false, error: "EXF request not found: " + requestId });

  const result = sendAndFinalizeExfRequestEmail_(exfRequestsSheet, found);

  return corsResponse({
    success: true,
    exfRequestId: requestId,
    emailSent: result.emailSent,
    emailError: result.emailError,
  });
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
  const poSheet = ensurePoWorkflowHeaders_();
  let poRows;
  try {
    poRows = getPoObjectsByNumbers_(poSheet, poNumbers);
    assertRowsEligibleForDeliveryPickupRequest_(poRows);
  } catch (err) {
    return corsResponse({ success: false, error: err.message });
  }
  const existing = sheetToObjects_(sheet, DELIVERY_REQUEST_ID_FIELD);
  const requestId = generateDeliveryRequestId_(existing);
  const emailInfo = getDeliveryPickupEmailInfo_(requestData);
  let emailSent = false;
  let emailError = "";

  requestData["Email To"] = emailInfo.to;
  requestData["Email CC"] = emailInfo.cc;
  try {
    emailSent = sendDeliveryPickupRequestEmail_("Delivery", requestId, emailInfo, poRows, requestData);
  } catch (err) {
    emailError = err && err.message ? err.message : String(err);
  }
  requestData["Email Status"] = emailInfo.to ? (emailSent ? "Sent" : "Failed") : "Not Sent";
  requestData["Email Sent At"] = emailSent ? new Date() : "";
  requestData["Email Error"] = emailError;

  appendRequestRow_(sheet, DELIVERY_REQUEST_ID_FIELD, requestId, DELIVERY_REQUEST_DATA_FIELDS, requestData);

  applyPoUpdatesBatch_(poSheet, poNumbers.map(poNumber => ({
    poNumber: poNumber,
    updates: {
      [DELIVERY_REQUEST_ID_FIELD]: requestId,
      "Status": "Scheduled",
    },
  })));

  return corsResponse({
    success: true,
    deliveryRequestId: requestId,
    emailSent: emailSent,
    emailError: emailError,
  });
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
  const poSheet = ensurePoWorkflowHeaders_();
  let poRows;
  try {
    poRows = getPoObjectsByNumbers_(poSheet, poNumbers);
    assertRowsEligibleForDeliveryPickupRequest_(poRows);
  } catch (err) {
    return corsResponse({ success: false, error: err.message });
  }
  const existing = sheetToObjects_(sheet, PICKUP_REQUEST_ID_FIELD);
  const requestId = generatePickupRequestId_(existing);
  const emailInfo = getDeliveryPickupEmailInfo_(requestData);
  let emailSent = false;
  let emailError = "";

  requestData["Email To"] = emailInfo.to;
  requestData["Email CC"] = emailInfo.cc;
  try {
    emailSent = sendDeliveryPickupRequestEmail_("Pickup", requestId, emailInfo, poRows, requestData);
  } catch (err) {
    emailError = err && err.message ? err.message : String(err);
  }
  requestData["Email Status"] = emailInfo.to ? (emailSent ? "Sent" : "Failed") : "Not Sent";
  requestData["Email Sent At"] = emailSent ? new Date() : "";
  requestData["Email Error"] = emailError;

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

  return corsResponse({
    success: true,
    pickupRequestId: requestId,
    emailSent: emailSent,
    emailError: emailError,
  });
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
    const poSheet = ensurePoWorkflowHeaders_();
    const shipmentsSheet = getShipmentsSheet_();
    const exfRequestsSheet = getExfRequestsSheet_();
    const vendorsSheet = getVendorsSheet_();
    const asnRequestsSheet = getAsnRequestsSheet_();
    const deliveryRequestsSheet = getDeliveryRequestsSheet_();
    const pickupRequestsSheet = getPickupRequestsSheet_();
    const chargebacksSheet = getChargebacksSheet_();
    const packingListsSheet = getPackingListsSheet_();
    const packingCartonsSheet = getPackingCartonsSheet_();
    const data = sheetToObjects_(poSheet, "PO #");
    const shipments = sheetToObjects_(shipmentsSheet, SHIPMENT_ID_FIELD);
    const exfRequests = sheetToObjects_(exfRequestsSheet, EXF_REQUEST_ID_FIELD);
    const vendors = sheetToObjects_(vendorsSheet, "Vendor");
    const asnRequests = sheetToObjects_(asnRequestsSheet, ASN_REQUEST_ID_FIELD);
    const deliveryRequests = sheetToObjects_(deliveryRequestsSheet, DELIVERY_REQUEST_ID_FIELD);
    const pickupRequests = sheetToObjects_(pickupRequestsSheet, PICKUP_REQUEST_ID_FIELD);
    const chargebacks = sheetToObjects_(chargebacksSheet, CHARGEBACK_ID_FIELD);
    const packingLists = sheetToObjects_(packingListsSheet, PACKING_LIST_ID_FIELD);
    const packingCartons = sheetToObjects_(packingCartonsSheet, PACKING_LIST_ID_FIELD);

    return corsResponse({
      success: true,
      data: data,
      shipments: shipments,
      exfRequests: exfRequests,
      vendors: vendors,
      asnRequests: asnRequests,
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
    if (action === "createAsnRequest") return handleCreateAsnRequest(payload);
    if (action === "resendExfRequestEmail") return handleResendExfRequestEmail(payload);
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
