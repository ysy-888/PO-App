const SHEET_NAME = "POs";
const SHIPMENTS_SHEET_NAME = "Shipments";
const EXF_REQUESTS_SHEET_NAME = "EXF Requests";
const CONTACTS_SHEET_NAME = "Contacts";
const VENDORS_SHEET_NAME = "Vendors";
const LOCATIONS_SHEET_NAME = "Locations";
const ASN_REQUESTS_SHEET_NAME = "ASN Requests";
const DELIVERY_REQUESTS_SHEET_NAME = "Delivery Requests";
const PICKUP_REQUESTS_SHEET_NAME = "Pickup Requests";
const CHARGEBACKS_SHEET_NAME = "Chargebacks";
const PACKING_LISTS_SHEET_NAME = "Packing Lists";
const PACKING_CARTONS_SHEET_NAME = "Packing List Cartons";
const STYLE_PHOTOS_SHEET_NAME = "Style Photos";
const COLUMN_DEFAULT_KEY = "defaultVisibleColumns";
const STATUS_DEFAULT_KEY = "defaultStatusFilter";
const SHIPMENT_ID_FIELD = "Shipment ID";
const EXF_REQUEST_ID_FIELD = "EXF Request ID";
const ASN_REQUEST_ID_FIELD = "ASN Request ID";
const DELIVERY_REQUEST_ID_FIELD = "Delivery Request ID";
const PICKUP_REQUEST_ID_FIELD = "Pickup Request ID";
const EXF_REQUESTED_FIELD = "EXF Requested";
const EXF_REQUEST_DATE_FIELD = "EXF Request Date";
const EXF_MEMO_FIELD = "EXF Memo";
const EXF_REQ_SUBMIT_DATE_FIELD = "exfReqSubmitDate";
const EXF_DATE_FIELD = "EXF Date";
const EXF_REQ_NOTES_FIELD = "ExfReqNotes";
const EXF_REQ_CC_FIELD = "CC";
const CHARGEBACK_ID_FIELD = "Chargeback ID";
const PACKING_LIST_ID_FIELD = "Packing List ID";
const VENDOR_PORTAL_TOKENS_SHEET_NAME = "Vendor Portal Tokens";
const PENDING_PACKING_LISTS_SHEET_NAME = "Pending Packing Lists";
const PENDING_PACKING_LIST_ID_FIELD = "Submission ID";
const VENDOR_SUBMIT_MODE_KEY = "vendorSubmitMode";

// PO per-request flag/date column names
const ASN_REQUESTED_FIELD = "ASN Requested";
const ASN_DATE_FIELD = "ASN Date";
const ASN_REQ_DATE_FIELD = "ASN Req Date";
const DELIVERY_REQUESTED_FIELD = "Delivery Requested";
const DELIVERY_DATE_FIELD = "Delivery Date";
const DELIVERY_REQ_DATE_FIELD = "Delivery Req Date";
const PICKUP_REQUESTED_FIELD = "Pickup Requested";
const PICKUP_DATE_FIELD = "Pickup Date";
const PICKUP_REQ_DATE_FIELD = "Pickup Req Date";
const EXF_REQ_DATE_FIELD = "EXF Req Date";

// Request notes field names
const ASN_REQ_NOTES_FIELD = "ASN Req Notes";
const DELIVERY_REQ_NOTES_FIELD = "Delivery Req Notes";
const PICKUP_REQ_NOTES_FIELD = "Pickup Req Notes";

/*
  POs sheet row 1 headers (see po-table.js COLUMNS). Add columns: Shipment ID, EXF Request Date, EXF Memo

  Style Photos sheet row 1 headers (auto-created if missing):
    Style #, Color, Style Photo 1, Style Photo 2

  Shipments sheet row 1 headers (auto-created if missing):
    Shipment ID, Ship Method, Vessel, House #, EXF, Shipped, ETD, ETA, IHD, Notes

  Selected is session-local in the app only.
*/

const SHIPMENT_DATA_FIELDS = [
  EXF_REQUEST_ID_FIELD, "Ship Method", "Vessel", "House #", "EXF", "Shipped", "ETD", "ETA", "IHD", "Notes"
];

/** Shipment fields copied to linked PO rows. Notes stay on the shipment record only. */
const SHIPMENT_PO_SYNC_FIELDS = [
  "Ship Method", "Vessel", "House #", "EXF", "Shipped", "ETD", "ETA", "IHD"
];

const EXF_REQUEST_DATA_FIELDS = [
  EXF_DATE_FIELD, EXF_REQ_SUBMIT_DATE_FIELD, "Vendor", "Vendor Email", EXF_REQ_CC_FIELD, EXF_REQ_NOTES_FIELD,
  "PO Numbers", "PO Count", "Total Qty",
  "Email Status", "Email Sent At", "Email Error", "Last Email Attempt At", "Created At", "Updated At"
];

const ASN_REQUEST_DATA_FIELDS = [
  ASN_DATE_FIELD, "Request Date", "Buyer", "Buyer Email", EXF_REQ_CC_FIELD,
  "PO Numbers", "PO Count",
  "Email Status", "Email Sent At", "Email Error", "Last Email Attempt At",
  ASN_REQ_NOTES_FIELD, "Created At", "Updated At"
];

const DELIVERY_REQUEST_DATA_FIELDS = [
  DELIVERY_DATE_FIELD, "Request Date",
  "From", "Pickup Address", "To", "Delivery Address",
  "Email To", "Email CC", "Email Status", "Email Sent At", "Email Error",
  DELIVERY_REQ_NOTES_FIELD, "PO Numbers", "PO Count", "Created At", "Updated At"
];
const PICKUP_REQUEST_DATA_FIELDS = [
  PICKUP_DATE_FIELD, "Request Date",
  "From", "Pickup Address", "To", "Delivery Address",
  "Email To", "Email CC", "Email Status", "Email Sent At", "Email Error",
  PICKUP_REQ_NOTES_FIELD, "PO Numbers", "PO Count", "Created At", "Updated At"
];

const EDITABLE_FIELDS = [
  "Flag",
  "PO Qty", "Status", "N41 Status", "Ship Method",
  "Vessel", "House #", "Shipped", "ETD", "ETA", "IHD",
  "EST EXF", "EST IHD", "EXF", "CXL Date", "Assign Date", "Notes", "Old PO #",
  EXF_REQUESTED_FIELD, EXF_REQUEST_DATE_FIELD, EXF_MEMO_FIELD,
  EXF_DATE_FIELD, EXF_REQ_DATE_FIELD, EXF_REQUEST_ID_FIELD,
  ASN_REQUEST_ID_FIELD, ASN_REQUESTED_FIELD, ASN_DATE_FIELD, ASN_REQ_DATE_FIELD,
  DELIVERY_REQUEST_ID_FIELD, DELIVERY_REQUESTED_FIELD, DELIVERY_DATE_FIELD, DELIVERY_REQ_DATE_FIELD,
  PICKUP_REQUEST_ID_FIELD, PICKUP_REQUESTED_FIELD, PICKUP_DATE_FIELD, PICKUP_REQ_DATE_FIELD,
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

const VENDOR_PORTAL_TOKEN_FIELDS = ["Vendor", "Active", "Created At", "Last Used At"];

const PENDING_PACKING_LIST_DATA_FIELDS = [
  "PO #", "Style #", "SO #", "Buyer PO #", "Buyer", "PO Qty", "Actual Qty",
  "Vendor", "Carton Count", "Notes", "Cartons JSON",
  "Status", "Submitted At", "Reviewed At"
];

const PENDING_PACKING_LIST_PO_LOOKUP_FIELDS_ = [
  "Style #", "SO #", "Buyer PO #", "Buyer", "PO Qty", "Actual Qty"
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
  ensureSheetHeaders_(sheet, [SHIPMENT_ID_FIELD, ...SHIPMENT_DATA_FIELDS]);
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
  ensureSheetHeaders_(sheet, [EXF_REQUEST_ID_FIELD, ...EXF_REQUEST_DATA_FIELDS]);
  return sheet;
}

function getContactsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // Prefer the renamed "Contacts" tab; fall back to legacy "Vendors"
  let sheet = ss.getSheetByName(CONTACTS_SHEET_NAME) || ss.getSheetByName(VENDORS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONTACTS_SHEET_NAME);
    sheet.getRange(1, 1, 1, 4).setValues([["Name", "Type", "Email", "CC"]]);
  }
  return sheet;
}

// Legacy alias kept for any existing callers
function getVendorsSheet_() {
  return getContactsSheet_();
}

function getLocationsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(LOCATIONS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(LOCATIONS_SHEET_NAME);
    sheet.getRange(1, 1, 1, 2).setValues([["Entity", "Address"]]);
    // Seed default warehouse and delivery destinations
    sheet.getRange(2, 1, 5, 2).setValues([
      ["FORERUNNER LOGISTICS", "4577 MAYWOOD AVE.\nVERNON, CA, 90058"],
      ["ELEVATOR DISCO", "810 E PICO BLVD #B21\nLOS ANGELES, CA 90021"],
      ["LULU'S FASHION LOUNGE", ""],
      ["12TH TRIBE", ""],
      ["URBAN OUTFITTERS", ""],
    ]);
  }
  return sheet;
}

function ensurePoWorkflowHeaders_() {
  const sheet = getSheet();
  ensureSheetHeaders_(sheet, [
    // EXF
    EXF_DATE_FIELD, EXF_REQ_DATE_FIELD, EXF_REQUESTED_FIELD, EXF_REQUEST_ID_FIELD,
    // ASN
    ASN_DATE_FIELD, ASN_REQ_DATE_FIELD, ASN_REQUESTED_FIELD, ASN_REQUEST_ID_FIELD,
    // Delivery
    DELIVERY_DATE_FIELD, DELIVERY_REQ_DATE_FIELD, DELIVERY_REQUESTED_FIELD, DELIVERY_REQUEST_ID_FIELD,
    // Pickup
    PICKUP_DATE_FIELD, PICKUP_REQ_DATE_FIELD, PICKUP_REQUESTED_FIELD, PICKUP_REQUEST_ID_FIELD,
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

function getVendorPortalTokensSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(VENDOR_PORTAL_TOKENS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(VENDOR_PORTAL_TOKENS_SHEET_NAME);
    sheet.getRange(1, 1, 1, VENDOR_PORTAL_TOKEN_FIELDS.length + 1).setValues([[
      "Token", ...VENDOR_PORTAL_TOKEN_FIELDS
    ]]);
  }
  ensureSheetHeaders_(sheet, ["Token", ...VENDOR_PORTAL_TOKEN_FIELDS]);
  return sheet;
}

function getPendingPackingListsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(PENDING_PACKING_LISTS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(PENDING_PACKING_LISTS_SHEET_NAME);
    sheet.getRange(1, 1, 1, PENDING_PACKING_LIST_DATA_FIELDS.length + 1).setValues([[
      PENDING_PACKING_LIST_ID_FIELD, ...PENDING_PACKING_LIST_DATA_FIELDS
    ]]);
  }
  ensureSheetHeaders_(sheet, [PENDING_PACKING_LIST_ID_FIELD, ...PENDING_PACKING_LIST_DATA_FIELDS]);
  return sheet;
}

function getStylePhotosSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(STYLE_PHOTOS_SHEET_NAME);
  const headers = ["Style #", "Color", "Style Photo 1", "Style Photo 2"];
  if (!sheet) {
    sheet = ss.insertSheet(STYLE_PHOTOS_SHEET_NAME);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  ensureSheetHeaders_(sheet, headers);
  return sheet;
}

function normalizeStylePhotoUrl_(url) {
  let s = String(url ?? "").trim();
  if (!s) return "";
  if ((s.charAt(0) === '"' && s.charAt(s.length - 1) === '"')
    || (s.charAt(0) === "'" && s.charAt(s.length - 1) === "'")) {
    s = s.slice(1, -1).trim();
  }
  var fileIdMatch = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i.exec(s);
  if (fileIdMatch) {
    return "https://drive.google.com/thumbnail?id=" + fileIdMatch[1] + "&sz=w1000";
  }
  var openIdMatch = /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/i.exec(s);
  if (openIdMatch) {
    return "https://drive.google.com/thumbnail?id=" + openIdMatch[1] + "&sz=w1000";
  }
  var ucIdMatch = /drive\.google\.com\/uc(?:\?[^#]*)?[&?]id=([a-zA-Z0-9_-]+)/i.exec(s);
  if (ucIdMatch) {
    return "https://drive.google.com/thumbnail?id=" + ucIdMatch[1] + "&sz=w1000";
  }
  if (/dropbox\.com/i.test(s) && !/[?&](?:raw=1|dl=1)(?:&|$)/i.test(s)) {
    var base = s.replace(/[?&]dl=0(?:&|$)/, "").replace(/[?&]$/, "");
    return base + (base.indexOf("?") === -1 ? "?" : "&") + "raw=1";
  }
  return s;
}

function readUrlCellValue_(sheet, rowIndex, colIndex) {
  var range = sheet.getRange(rowIndex, colIndex);
  var rich = range.getRichTextValue();
  if (rich) {
    var cellLink = rich.getLinkUrl();
    if (cellLink) return normalizeStylePhotoUrl_(String(cellLink).trim());
    var runs = rich.getRuns();
    for (var i = 0; i < runs.length; i++) {
      var linkUrl = runs[i].getLinkUrl();
      if (linkUrl) return normalizeStylePhotoUrl_(String(linkUrl).trim());
    }
  }
  var formula = String(range.getFormula() || "").trim();
  if (formula) {
    var hyperlinkMatch = /^=HYPERLINK\s*\(\s*"((?:[^"\\]|\\.)*)"/i.exec(formula);
    if (hyperlinkMatch) {
      return normalizeStylePhotoUrl_(hyperlinkMatch[1].replace(/\\"/g, '"').trim());
    }
    var imageMatch = /^=IMAGE\s*\(\s*"((?:[^"\\]|\\.)*)"/i.exec(formula);
    if (imageMatch) {
      return normalizeStylePhotoUrl_(imageMatch[1].replace(/\\"/g, '"').trim());
    }
  }
  return normalizeStylePhotoUrl_(String(range.getDisplayValue() ?? "").trim());
}

function stylePhotosSheetToObjects_(sheet) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function(h) { return String(h ?? "").trim(); });
  var styleCol = headers.indexOf("Style #");
  var colorCol = headers.indexOf("Color");
  if (styleCol === -1 || colorCol === -1) return [];

  var photoColByField = {};
  ["Style Photo 1", "Style Photo 2"].forEach(function(field) {
    var idx = headers.indexOf(field);
    if (idx !== -1) photoColByField[field] = idx + 1;
  });

  var result = [];
  for (var rowIndex = 2; rowIndex <= lastRow; rowIndex++) {
    var styleNum = String(sheet.getRange(rowIndex, styleCol + 1).getDisplayValue() ?? "").trim();
    var color = String(sheet.getRange(rowIndex, colorCol + 1).getDisplayValue() ?? "").trim();
    if (!styleNum || !color) continue;
    var obj = { "Style #": styleNum, "Color": color, _rowIndex: rowIndex };
    Object.keys(photoColByField).forEach(function(field) {
      obj[field] = readUrlCellValue_(sheet, rowIndex, photoColByField[field]);
    });
    result.push(obj);
  }
  return result;
}

function stylePhotoLookupKey_(styleNum, color) {
  var style = String(styleNum ?? "").trim().toLowerCase();
  var shade = String(color ?? "").trim().toLowerCase();
  if (!style || !shade) return "";
  return style + "|" + shade;
}

function buildStylePhotoLookup_(sheet) {
  var map = {};
  stylePhotosSheetToObjects_(sheet).forEach(function(entry) {
    var key = stylePhotoLookupKey_(entry["Style #"], entry["Color"]);
    if (!key) return;
    map[key] = {
      "Style Photo 1": normalizeStylePhotoUrl_(entry["Style Photo 1"]),
      "Style Photo 2": normalizeStylePhotoUrl_(entry["Style Photo 2"]),
    };
  });
  return map;
}

function lookupStylePhotos_(map, row) {
  var key = stylePhotoLookupKey_(row["Style #"], row["Color"]);
  if (key && map[key]) return map[key];
  return { "Style Photo 1": "", "Style Photo 2": "" };
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
    "SO #", "Old PO #", "Buyer", "Buyer PO #", "Style #", "Color", "Style Category",
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
    if (Array.isArray(parsed)) return parsed;
    if (
      parsed &&
      typeof parsed === "object" &&
      (Array.isArray(parsed.order) || Array.isArray(parsed.visible))
    ) {
      return parsed;
    }
    return null;
  } catch (e) {
    return null;
  }
}

function saveDefaultColumns_(columns, columnOrder) {
  if (!Array.isArray(columns) || columns.length === 0) {
    throw new Error("No columns provided");
  }
  const payload = Array.isArray(columnOrder) && columnOrder.length > 0
    ? { order: columnOrder, visible: columns }
    : columns;
  PropertiesService.getScriptProperties().setProperty(
    COLUMN_DEFAULT_KEY,
    JSON.stringify(payload)
  );
}

function getDefaultStatusFilter_() {
  const saved = PropertiesService.getScriptProperties().getProperty(STATUS_DEFAULT_KEY);
  if (saved === null) {
    return "__open__";
  }
  return saved;
}

function saveDefaultStatusFilter_(statusFilter) {
  PropertiesService.getScriptProperties().setProperty(
    STATUS_DEFAULT_KEY,
    String(statusFilter)
  );
}

function handleSaveColumnDefault(payload) {
  saveDefaultColumns_(payload.columns, payload.columnOrder);
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

// --- Vendor submit mode ---

function getVendorSubmitMode_() {
  const mode = PropertiesService.getScriptProperties().getProperty(VENDOR_SUBMIT_MODE_KEY);
  return mode === "direct" ? "direct" : "review";
}

function setVendorSubmitMode_(mode) {
  PropertiesService.getScriptProperties().setProperty(
    VENDOR_SUBMIT_MODE_KEY,
    mode === "direct" ? "direct" : "review"
  );
}

// --- Pending submission ID ---

function parseSubmissionIdSequence_(id) {
  const m = /^PS-(\d+)$/.exec(String(id ?? "").trim());
  return m ? Number(m[1]) : 0;
}

function formatSubmissionId_(sequence) {
  return "PS-" + String(sequence).padStart(4, "0");
}

function getNextSubmissionId_(sheet) {
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return formatSubmissionId_(1);
  const headers = rows[0].map(h => String(h ?? "").trim());
  const idCol = headers.indexOf(PENDING_PACKING_LIST_ID_FIELD);
  if (idCol === -1) return formatSubmissionId_(1);
  let max = 0;
  for (let i = 1; i < rows.length; i++) {
    max = Math.max(max, parseSubmissionIdSequence_(rows[i][idCol]));
  }
  return formatSubmissionId_(max + 1);
}

/** Fills Style # / SO # / Buyer PO # / Buyer from PO rows when missing on pending submissions. */
function enrichPendingPackingListsWithPoFields_(pendingLists, poRows) {
  return (pendingLists || []).map(entry => {
    const out = Object.assign({}, entry);
    const poRow = (poRows || []).find(r => poNumbersEqual_(r["PO #"], out["PO #"]));
    if (!poRow) return out;
    PENDING_PACKING_LIST_PO_LOOKUP_FIELDS_.forEach(field => {
      if (!String(out[field] ?? "").trim()) out[field] = poRow[field] ?? "";
    });
    return out;
  });
}

// --- Vendor portal token helpers ---

function generateVendorToken_() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, "");
}

/**
 * @param {string} token
 * @param {{ recordUsage?: boolean }} [opts]
 */
function resolveVendorPortalToken_(token, opts) {
  if (!token) return null;
  const recordUsage = opts && opts.recordUsage === false ? false : true;
  const normalizedToken = String(token).trim();
  const sheet = getVendorPortalTokensSheet_();
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return null;
  const headers = rows[0].map(h => String(h ?? "").trim());
  const tokenCol = headers.indexOf("Token");
  const vendorCol = headers.indexOf("Vendor");
  const activeCol = headers.indexOf("Active");
  const lastUsedCol = headers.indexOf("Last Used At");
  if (tokenCol === -1 || vendorCol === -1) return null;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][tokenCol]).trim() === normalizedToken) {
      const active = rows[i][activeCol];
      const activeStr = String(active).toLowerCase().trim();
      if (active === false || activeStr === "false" || activeStr === "no") return null;
      const vendor = String(rows[i][vendorCol] ?? "").trim();
      if (!vendor) return null;
      if (recordUsage && lastUsedCol !== -1) {
        sheet.getRange(i + 1, lastUsedCol + 1).setValue(new Date());
      }
      return { vendor, rowIndex: i + 1, headers };
    }
  }
  return null;
}

// --- Vendor portal session helpers (CacheService, ~6-hour TTL) ---

const VP_SESSION_PREFIX = "vp_";
const VP_SESSION_TTL_SECONDS = 6 * 60 * 60; // 6 hours

function createVendorPortalSession_(token, vendor) {
  const sessionId = Utilities.getUuid().replace(/-/g, "");
  const cache = CacheService.getScriptCache();
  cache.put(
    VP_SESSION_PREFIX + sessionId,
    JSON.stringify({ token: token, vendor: vendor }),
    VP_SESSION_TTL_SECONDS
  );
  return sessionId;
}

/** Returns { token, vendor } or null if session is missing/expired. */
function resolveVendorPortalSession_(sessionId) {
  if (!sessionId) return null;
  const cache = CacheService.getScriptCache();
  const raw = cache.get(VP_SESSION_PREFIX + String(sessionId).trim());
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_e) {
    return null;
  }
}

/**
 * Resolves vendor from session first; falls back to raw token lookup.
 * Records Last Used At only on the token-fallback path.
 * Returns { vendor } or null.
 */
function resolveVendorPortalAuth_(sessionId, token) {
  const session = resolveVendorPortalSession_(sessionId);
  if (session && session.vendor) return { vendor: session.vendor };
  if (!token) return null;
  const tokenInfo = resolveVendorPortalToken_(token, { recordUsage: true });
  if (!tokenInfo) return null;
  return { vendor: tokenInfo.vendor };
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

/**
 * Core packing list write: upsert the Packing Lists row, rewrite cartons, and
 * sync the PO row fields. Returns { packingListId, poUpdates } or throws.
 */
function savePackingListCore_(poNumber, cartons, packingListMeta, poEditUpdates) {
  const poSheet = ensurePoWorkflowHeaders_();
  if (!poSheet) throw new Error("POs sheet not found.");
  const poFound = findPoRowIndex_(poSheet, poNumber);
  if (!poFound) throw new Error("PO # not found: " + poNumber);
  const poRowValues = poSheet.getRange(poFound.rowIndex, 1, 1, poFound.headers.length).getValues()[0];
  if (isPoClosedFromRowValues_(poRowValues, poFound.headers)) {
    throw new Error("Closed POs cannot be edited.");
  }

  const packingListsSheet = getPackingListsSheet_();
  const cartonsSheet = getPackingCartonsSheet_();
  const existing = findPackingListForPo_(packingListsSheet, poNumber);
  const packingListId = existing
    ? String(existing.packingListId)
    : getNextPackingListId_(packingListsSheet);

  const now = new Date();
  const cartonCount = packingListMeta["Carton Count"] || cartons.length;
  const notes = packingListMeta["Notes"] || "";

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

  return { packingListId, poUpdates: combinedPoUpdates };
}

function pickShipmentData_(source) {
  const out = {};
  SHIPMENT_DATA_FIELDS.forEach(field => {
    if (source && source[field] !== undefined) out[field] = source[field];
  });
  return out;
}

function pickShipmentPoSyncData_(source) {
  const out = {};
  SHIPMENT_PO_SYNC_FIELDS.forEach(field => {
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

function getPoWorkflowStatusFromRowValues_(rowValues, headers) {
  const statusCol = headers.indexOf("Status");
  const n41Col = headers.indexOf("N41 Status");
  const status = statusCol >= 0 ? String(rowValues[statusCol] ?? "").trim() : "";
  if (status) return status;
  const n41 = n41Col >= 0 ? String(rowValues[n41Col] ?? "").trim() : "";
  if (n41 === "Closed") return "Closed";
  if (n41 === "CXL") return "CXL";
  return "";
}

function isPoClosedFromRowValues_(rowValues, headers) {
  return getPoWorkflowStatusFromRowValues_(rowValues, headers) === "Closed";
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
  const syncData = pickShipmentPoSyncData_(shipmentData);
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
  SHIPMENT_PO_SYNC_FIELDS.forEach(field => {
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
  const poRowValues = poSheet.getRange(poFound.rowIndex, 1, 1, poFound.headers.length).getValues()[0];
  if (isPoClosedFromRowValues_(poRowValues, poFound.headers)) {
    return corsResponse({ success: false, error: "Closed POs cannot be edited." });
  }

  const cartons = normalizePackingCartons_(payload.cartons || []);
  if (cartons.length === 0) {
    return corsResponse({ success: false, error: "At least one carton is required." });
  }
  if (cartons.some(carton => Number(carton["Total Units"] || 0) <= 0)) {
    return corsResponse({ success: false, error: "A carton quantity cannot be zero." });
  }

  const poEditUpdates = sanitizeUpdatesMap_(payload.updates || {});
  const invalidFields = Object.keys(poEditUpdates).filter(f => !EDITABLE_FIELDS.includes(f));
  if (invalidFields.length > 0) {
    return corsResponse({
      success: false,
      error: "Not allowed to edit: " + invalidFields.join(", ")
    });
  }

  const packingListMeta = {
    "Carton Count": payload.packingList?.["Carton Count"] || cartons.length,
    "Notes": payload.packingList?.["Notes"] || "",
  };

  try {
    const result = savePackingListCore_(poNumber, cartons, packingListMeta, poEditUpdates);
    return corsResponse({ success: true, ...result });
  } catch (err) {
    return corsResponse({ success: false, error: err.message });
  }
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

  let resolvedPoNumber = poNumber;
  if (!resolvedPoNumber) {
    const poCol = found.headers.indexOf("PO #");
    if (poCol !== -1) {
      const listRowValues = packingListsSheet.getRange(found.rowIndex, 1, 1, found.headers.length).getValues()[0];
      resolvedPoNumber = String(listRowValues[poCol] ?? "").trim();
    }
  }
  if (resolvedPoNumber) {
    const poSheet = getSheet();
    const poFound = findPoRowIndex_(poSheet, resolvedPoNumber);
    if (poFound) {
      const poRowValues = poSheet.getRange(poFound.rowIndex, 1, 1, poFound.headers.length).getValues()[0];
      if (isPoClosedFromRowValues_(poRowValues, poFound.headers)) {
        return corsResponse({ success: false, error: "Closed POs cannot be edited." });
      }
    }
  }

  const id = String(found.packingListId || packingListId);
  deletePackingCartons_(cartonsSheet, id);
  packingListsSheet.deleteRow(found.rowIndex);

  if (resolvedPoNumber) {
    const poSheet = getSheet();
    const poFound = findPoRowIndex_(poSheet, resolvedPoNumber);
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
      if (isPoClosedFromRowValues_(targetRow, headers)) {
        skipped++;
        return;
      }
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

function getContactEmailInfo_(name) {
  const sheet = getContactsSheet_();
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return { to: "", cc: "" };
  const headers = rows[0].map(h => String(h ?? "").trim());
  const headerIndex = function(names) {
    const lowered = names.map(function(n) { return n.toLowerCase(); });
    return headers.findIndex(function(h) {
      return lowered.indexOf(h.toLowerCase()) !== -1;
    });
  };
  const nameCol = headerIndex(["Name", "Vendor", "Vendor Name"]);
  const emailCol = headerIndex(["Email", "Vendor Email", "Email Address", "E-mail", "To"]);
  const ccCol = headerIndex(["CC", "Vendor CC", "Cc"]);
  if (nameCol === -1 || emailCol === -1) return { to: "", cc: "" };
  const key = String(name ?? "").trim().toLowerCase();
  for (let i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][nameCol] ?? "").trim().toLowerCase() !== key) continue;
    return {
      to: String(rows[i][emailCol] ?? "").trim(),
      cc: ccCol === -1 ? "" : String(rows[i][ccCol] ?? "").trim(),
    };
  }
  return { to: "", cc: "" };
}

// Legacy alias
function getVendorEmailInfo_(vendor) {
  return getContactEmailInfo_(vendor);
}

function getLocationAddress_(entityName) {
  const sheet = getLocationsSheet_();
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return "";
  const headers = rows[0].map(h => String(h ?? "").trim());
  const nameCol = headers.indexOf("Entity");
  const addrCol = headers.indexOf("Address");
  if (nameCol === -1 || addrCol === -1) return "";
  const key = String(entityName ?? "").trim().toLowerCase();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][nameCol] ?? "").trim().toLowerCase() === key) {
      return String(rows[i][addrCol] ?? "").trim();
    }
  }
  return "";
}

function getExfRequestEmailInfo_(payload, vendor) {
  const stored = getVendorEmailInfo_(vendor);
  const submittedTo = String(payload.vendorEmail ?? "").trim();
  const submittedCc = String(payload.vendorCc ?? payload.cc ?? "").trim();
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

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function buildEmailRequestHeaderHtml_(requestTypeLabel, requestId, headerRequestDate) {
  return "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"width:100%;border-collapse:collapse;\">" +
    "<tr><td class=\"email-header-titles\" valign=\"middle\" style=\"vertical-align:middle;\">" +
    "<h1 class=\"email-heading\" style=\"margin:0 0 6px 0;font-size:20px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#ffffff;line-height:1.2;\">ELEVATOR DISCO</h1>" +
    "<p class=\"email-subheading\" style=\"margin:0;font-size:16px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#d4d9df;line-height:1.3;\">" +
    escapeHtml_(requestTypeLabel) + "</p></td>" +
    "<td class=\"email-header-id\" valign=\"middle\" align=\"right\" style=\"vertical-align:middle;text-align:right;white-space:nowrap;padding-left:16px;\">" +
    "<div class=\"email-request-id\" style=\"font-size:14px;font-weight:500;color:#ffffff;letter-spacing:0.02em;line-height:1.4;\">" +
    escapeHtml_(requestId) + "</div>" +
    "<div class=\"email-request-date\" style=\"margin-top:4px;font-size:12px;font-weight:500;color:#d4d9df;line-height:1.3;\">" +
    escapeHtml_(headerRequestDate) + "</div></td></tr></table>";
}

const EMAIL_META_LABEL_STYLE_ = "width:110px;max-width:110px;padding:8px 12px;font-size:12px;font-weight:600;color:#374151;background-color:#f7f7f8;border-bottom:1px solid #e5e7eb;white-space:nowrap;";
const EMAIL_META_VALUE_STYLE_ = "padding:8px 12px;font-size:14px;color:#1a1a18;border-bottom:1px solid #e5e7eb;";
const EMAIL_PO_TH_STYLE_ = "padding:10px 12px;text-align:left;font-size:11px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#374151;background-color:#f7f7f8;border-bottom:1px solid #e5e7eb;white-space:nowrap;";
const EMAIL_PO_TD_STYLE_ = "padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#1a1a18;vertical-align:top;font-size:13px;";
const EMAIL_PO_TD_NUM_STYLE_ = EMAIL_PO_TD_STYLE_ + "text-align:right;";
const EMAIL_PO_TD_ROW_NUM_STYLE_ = EMAIL_PO_TD_STYLE_ + "text-align:center;color:#6b7280;";
const EMAIL_PO_FOOTER_TD_STYLE_ = "padding:10px 12px;font-weight:600;background-color:#eef0f3;color:#1a1a18;border-bottom:none;font-size:13px;";
const PDF_HEADER_BG_ = "#2d2d29";
const PDF_META_LABEL_BG_ = "#f7f7f8";
const PDF_META_VALUE_BG_ = "#ffffff";
const PDF_TABLE_HEAD_BG_ = "#f7f7f8";
const PDF_TABLE_FOOTER_BG_ = "#eef0f3";
const PDF_PAGE_WIDTH_ = 816;
const PDF_PAGE_HEIGHT_ = 1056;

/** Wrap a table cell with bgcolor for reliable PDF rendering. */
function pdfBgCell_(tag, bgHex, className, innerHtml) {
  const cls = className ? " class=\"" + className + "\"" : "";
  return "<" + tag + cls + " bgcolor=\"" + bgHex + "\" style=\"background-color:" + bgHex + ";\">" +
    innerHtml + "</" + tag + ">";
}

function renderEmailTemplate_(filename, vars) {
  const template = HtmlService.createTemplateFromFile(filename);
  Object.keys(vars).forEach(key => { template[key] = vars[key]; });
  return template.evaluate().getContent();
}

function renderEmailSubject_(filename, vars) {
  return renderEmailTemplate_(filename, vars).trim();
}

function buildEmailNotesBlockHtml_(notes) {
  const trimmed = String(notes ?? "").trim();
  const body = trimmed
    ? escapeHtml_(trimmed).replace(/\n/g, "<br>")
    : "<span style=\"color:#8b929c;\">&mdash;</span>";
  return "<div class=\"email-notes-panel\" style=\"margin:0;padding:14px 16px;min-height:100px;height:100%;background:transparent;border:1px solid #e5e7eb;border-radius:6px;\">" +
    "<div class=\"email-section-title\" style=\"font-size:11px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:#374151;margin:0 0 8px 0;\">Notes</div>" +
    "<div class=\"email-notes-body\" style=\"font-size:14px;color:#1a1a18;\">" + body + "</div></div>";
}

function emailMetaRowStyles_(isLastRow) {
  if (isLastRow) {
    return {
      label: EMAIL_META_LABEL_STYLE_.replace("border-bottom:1px solid #e5e7eb;", ""),
      value: EMAIL_META_VALUE_STYLE_.replace("border-bottom:1px solid #e5e7eb;", ""),
    };
  }
  return { label: EMAIL_META_LABEL_STYLE_, value: EMAIL_META_VALUE_STYLE_ };
}

function buildDeliveryPickupFromBlockHtml_(from, pickupAddr, isLastRow) {
  from = String(from ?? "").trim();
  pickupAddr = String(pickupAddr ?? "").trim();
  if (!from) return "";
  let value = escapeHtml_(from);
  if (pickupAddr) {
    value += "<span class=\"email-meta-sub\" style=\"display:block;margin-top:4px;font-size:13px;color:#6b7280;\">" +
      escapeHtml_(pickupAddr).replace(/\n/g, "<br>") + "</span>";
  }
  const styles = emailMetaRowStyles_(isLastRow);
  return "<tr><td class=\"email-meta-label\" style=\"" + styles.label + "\">From</td>" +
    "<td class=\"email-meta-value\" style=\"" + styles.value + "\">" + value + "</td></tr>";
}

function buildDeliveryPickupToBlockHtml_(to, deliveryAddr) {
  to = String(to ?? "").trim();
  deliveryAddr = String(deliveryAddr ?? "").trim();
  if (!to) return "";
  let value = escapeHtml_(to);
  if (deliveryAddr) {
    value += "<span class=\"email-meta-sub\" style=\"display:block;margin-top:4px;font-size:13px;color:#6b7280;\">" +
      escapeHtml_(deliveryAddr).replace(/\n/g, "<br>") + "</span>";
  }
  const styles = emailMetaRowStyles_(true);
  return "<tr><td class=\"email-meta-label\" style=\"" + styles.label + "\">To</td>" +
    "<td class=\"email-meta-value\" style=\"" + styles.value + "\">" + value + "</td></tr>";
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

function getPackingWeightByPo_() {
  const lists = sheetToObjects_(getPackingListsSheet_(), PACKING_LIST_ID_FIELD);
  const cartons = sheetToObjects_(getPackingCartonsSheet_(), PACKING_LIST_ID_FIELD);
  const weightByListId = {};
  cartons.forEach(carton => {
    const listId = String(carton[PACKING_LIST_ID_FIELD] ?? "");
    const weight = Number(String(carton["Carton Weight"] ?? "").trim());
    if (!listId) return;
    if (!weightByListId[listId]) weightByListId[listId] = 0;
    if (Number.isFinite(weight) && weight > 0) weightByListId[listId] += weight;
  });
  const weightByPo = {};
  lists.forEach(list => {
    const po = String(list["PO #"] ?? "").trim();
    const listId = String(list[PACKING_LIST_ID_FIELD] ?? "");
    if (po) weightByPo[po] = weightByListId[listId] || 0;
  });
  return weightByPo;
}

function toQtyNumber_(value) {
  const n = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

// ── Packing List PDF Builders ─────────────────────────────────────────────────

/**
 * Returns { listsByPo, cartonsByListId } from the sheet data.
 * Used by the PDF builder to avoid reading sheets multiple times.
 */
function getPackingDataMaps_() {
  const lists = sheetToObjects_(getPackingListsSheet_(), PACKING_LIST_ID_FIELD);
  const cartons = sheetToObjects_(getPackingCartonsSheet_(), PACKING_LIST_ID_FIELD);
  const listsByPo = {};
  lists.forEach(list => {
    const poKey = normalizePoKey_(list["PO #"]);
    if (poKey && !listsByPo[poKey]) listsByPo[poKey] = list;
  });
  const cartonsByListId = {};
  cartons.forEach(carton => {
    const id = String(carton[PACKING_LIST_ID_FIELD] ?? "").trim();
    if (!id) return;
    if (!cartonsByListId[id]) cartonsByListId[id] = [];
    cartonsByListId[id].push(carton);
  });
  Object.values(cartonsByListId).forEach(arr =>
    arr.sort((a, b) => Number(a["Carton #"] || 0) - Number(b["Carton #"] || 0))
  );
  return { listsByPo, cartonsByListId };
}

function normalizePoKey_(poNumber) {
  const raw = String(poNumber ?? "").trim();
  if (!raw) return "";
  const n = Number(raw);
  return Number.isFinite(n) ? String(n) : raw;
}

function getPackingListForPoFromMap_(listsByPo, poNumber) {
  const key = normalizePoKey_(poNumber);
  if (key && listsByPo[key]) return listsByPo[key];
  const lists = Object.values(listsByPo);
  for (let i = 0; i < lists.length; i++) {
    if (poNumbersEqual_(lists[i]["PO #"], poNumber)) return lists[i];
  }
  return null;
}

/** Escape HTML special characters for inline insertion. */
function pdfEsc_(val) {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pdfVal_(val) {
  const s = String(val ?? "").trim();
  return s === "" ? "&mdash;" : pdfEsc_(s);
}

function pdfDate_(val) {
  return formatEmailDate_(val) || "&mdash;";
}

function pdfMoney_(val) {
  const s = String(val ?? "").trim();
  if (!s) return "&mdash;";
  const n = Number(s.replace(/[$,]/g, ""));
  if (!Number.isFinite(n)) return pdfEsc_(s);
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getPdfActiveSizeColumns_(poRow, cartons) {
  const cols = [];
  for (let i = 0; i < 15; i++) {
    const hasQty = cartons.some(c => toQtyNumber_(c["Unit " + (i + 1)]) > 0);
    if (!hasQty) continue;
    const label = String(poRow["Size " + (i + 1)] ?? "").trim() || ("Sz " + (i + 1));
    cols.push({ index: i, label: label });
  }
  return cols;
}

function pdfActiveCartons_(cartons) {
  return (Array.isArray(cartons) ? cartons : []).filter(carton => {
    for (let i = 1; i <= 15; i++) {
      if (toQtyNumber_(carton["Unit " + i]) > 0) return true;
    }
    return toQtyNumber_(carton["Carton Weight"]) > 0;
  });
}

/** Three label/value pairs per row for a compact summary grid. */
function pdfSummaryGridHtml_(pairs) {
  const colsPerRow = 3;
  const rows = [];
  for (let i = 0; i < pairs.length; i += colsPerRow) {
    let row = "<tr>";
    for (let j = 0; j < colsPerRow; j++) {
      const pair = pairs[i + j];
      if (pair) {
        row += pdfBgCell_("td", PDF_META_LABEL_BG_, "pdf-summary-label", pdfEsc_(pair[0])) +
          pdfBgCell_("td", PDF_META_VALUE_BG_, "pdf-summary-value", pair[1]);
      } else {
        row += pdfBgCell_("td", PDF_META_LABEL_BG_, "pdf-summary-label", "&nbsp;") +
          pdfBgCell_("td", PDF_META_VALUE_BG_, "pdf-summary-value", "&nbsp;");
      }
    }
    row += "</tr>";
    rows.push(row);
  }
  return "<table class=\"pdf-summary\" cellpadding=\"0\" cellspacing=\"0\">" + rows.join("") + "</table>";
}

function buildPdfPackingListHeaderHtml_(po, styleNum, color) {
  const styleSubtitle = styleNum
    ? "<div class=\"pdf-header-sub\">" + pdfEsc_(styleNum) + " / " + pdfEsc_(color) + "</div>"
    : "";
  return "<table class=\"pdf-header\" role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" bgcolor=\"" + PDF_HEADER_BG_ + "\">" +
    "<tr>" +
    "<td bgcolor=\"" + PDF_HEADER_BG_ + "\" valign=\"middle\">" +
    "<div class=\"pdf-header-brand\">ELEVATOR DISCO</div>" +
    "<div class=\"pdf-header-title\">Packing List</div>" +
    "</td>" +
    "<td bgcolor=\"" + PDF_HEADER_BG_ + "\" valign=\"middle\" align=\"right\">" +
    "<div class=\"pdf-header-po\">PO " + pdfEsc_(po) + "</div>" +
    styleSubtitle +
    "</td></tr></table>";
}

function pdfNotesPanelHtml_(notes) {
  return "<div class=\"pdf-notes\">" +
    "<div class=\"pdf-notes-title\">Notes</div>" +
    "<div>" + pdfEsc_(notes) + "</div></div>";
}

function pdfCartonColgroupHtml_(sizeColCount) {
  const contentWidth = 788;
  const fixed = 30 + 34 + 36;
  const sizeWidth = sizeColCount > 0 ? Math.max(22, Math.floor((contentWidth - fixed) / sizeColCount)) : 0;
  let cols = "<colgroup><col width=\"30\">";
  for (let i = 0; i < sizeColCount; i++) cols += "<col width=\"" + sizeWidth + "\">";
  cols += "<col width=\"34\"><col width=\"36\"></colgroup>";
  return cols;
}

/** Build HTML for a single PO page (full portrait layout). */
function buildPdfPoSectionHtml_(poRow, packingList, cartons, isLast) {
  const po = String(poRow["PO #"] ?? "");
  const styleNum = String(poRow["Style #"] ?? "").trim();
  const color = String(poRow["Color"] ?? "").trim();
  const activeCartons = pdfActiveCartons_(cartons);

  const summaryRows = [
    ["PO #", pdfVal_(poRow["PO #"])],
    ["Buyer PO #", pdfVal_(poRow["Buyer PO #"])],
    ["Style #", pdfVal_(poRow["Style #"])],
    ["Color", pdfVal_(poRow["Color"])],
    ["Vendor", pdfVal_(poRow["Vendor"])],
    ["Buyer", pdfVal_(poRow["Buyer"])],
    ["Ship Method", pdfVal_(poRow["Ship Method"])],
    ["Shipment ID", pdfVal_(poRow[SHIPMENT_ID_FIELD])],
    ["PO Date", pdfDate_(poRow["PO Date"])],
    ["EXF Date", pdfDate_(poRow["EXF Date"] || poRow["EXF Request Date"] || poRow["EXF"])],
    ["IHD", pdfDate_(poRow["IHD"])],
    ["Ctn Qty", pdfEsc_(String(activeCartons.length || toQtyNumber_(poRow["Ctn Qty"])))],
  ];

  const poDetailsHtml = "<p class=\"pdf-section-title\">PO Details</p>" + pdfSummaryGridHtml_(summaryRows);

  let packingHtml;
  if (!packingList || activeCartons.length === 0) {
    packingHtml = "<p class=\"pdf-section-title\">Cartons</p>" +
      "<p class=\"pdf-empty\">No packing list on file.</p>";
  } else {
    const sizeCols = getPdfActiveSizeColumns_(poRow, activeCartons);
    const unitTotals = sizeCols.map(col =>
      activeCartons.reduce((sum, c) => sum + toQtyNumber_(c["Unit " + (col.index + 1)]), 0)
    );
    const grandTotal = unitTotals.reduce((s, n) => s + n, 0);
    const totalWeight = activeCartons.reduce((s, c) => s + toQtyNumber_(c["Carton Weight"]), 0);

    const sizeHeads = sizeCols.map(col =>
      pdfBgCell_("th", PDF_TABLE_HEAD_BG_, "pdf-num", pdfEsc_(col.label))
    ).join("");

    const cartonRows = activeCartons.map(carton => {
      const rowTotal = sizeCols.reduce((s, col) => s + toQtyNumber_(carton["Unit " + (col.index + 1)]), 0);
      const unitCells = sizeCols.map(col => {
        const n = toQtyNumber_(carton["Unit " + (col.index + 1)]);
        return pdfBgCell_("td", PDF_META_VALUE_BG_, "pdf-num", n > 0 ? String(n) : "");
      }).join("");
      const w = toQtyNumber_(carton["Carton Weight"]);
      return "<tr>" +
        pdfBgCell_("td", PDF_META_VALUE_BG_, "pdf-center", pdfEsc_(String(carton["Carton #"] ?? ""))) +
        unitCells +
        pdfBgCell_("td", PDF_META_VALUE_BG_, "pdf-num", String(rowTotal)) +
        pdfBgCell_("td", PDF_META_VALUE_BG_, "pdf-num", w > 0 ? String(w) : "") +
        "</tr>";
    }).join("");

    const unitTotalCells = unitTotals.map(n =>
      pdfBgCell_("td", PDF_TABLE_FOOTER_BG_, "pdf-num", String(n))
    ).join("");

    const plNotes = String(packingList["Notes"] ?? "").trim();
    const plNotesHtml = plNotes ? pdfNotesPanelHtml_(plNotes) : "";

    packingHtml = "<p class=\"pdf-section-title\">Cartons (" + activeCartons.length + ")</p>" +
      "<table class=\"pdf-carton-table\" cellpadding=\"0\" cellspacing=\"0\">" +
      pdfCartonColgroupHtml_(sizeCols.length) +
      "<thead><tr>" +
      pdfBgCell_("th", PDF_TABLE_HEAD_BG_, "pdf-center", "Ctn #") +
      sizeHeads +
      pdfBgCell_("th", PDF_TABLE_HEAD_BG_, "pdf-num", "Total") +
      pdfBgCell_("th", PDF_TABLE_HEAD_BG_, "pdf-num", "Wt") +
      "</tr></thead>" +
      "<tbody>" + cartonRows + "</tbody>" +
      "<tfoot><tr>" +
      pdfBgCell_("td", PDF_TABLE_FOOTER_BG_, "pdf-center", "Total") +
      unitTotalCells +
      pdfBgCell_("td", PDF_TABLE_FOOTER_BG_, "pdf-num", String(grandTotal)) +
      pdfBgCell_("td", PDF_TABLE_FOOTER_BG_, "pdf-num", totalWeight > 0 ? String(totalWeight) : "&mdash;") +
      "</tr></tfoot>" +
      "</table>" +
      plNotesHtml;
  }

  const pageClass = "pdf-page" + (isLast ? " pdf-page-last" : "");

  return "<div class=\"" + pageClass + "\">" +
    "<table class=\"pdf-page-inner\" cellpadding=\"0\" cellspacing=\"0\" width=\"100%\">" +
    "<tr><td colspan=\"1\">" + buildPdfPackingListHeaderHtml_(po, styleNum, color) + "</td></tr>" +
    "<tr class=\"pdf-page-body\"><td>" +
    poDetailsHtml +
    packingHtml +
    "</td></tr></table></div>";
}

/**
 * Build a group packing list PDF blob for the given PO rows.
 * poRows: array of PO data objects (from getPoObjectsByNumbers_).
 * opts: { filename: string } optional.
 */
function buildGroupPackingListPdfBlob_(poRows, opts) {
  opts = opts || {};
  const rows = Array.isArray(poRows) ? poRows : [];
  const { listsByPo, cartonsByListId } = getPackingDataMaps_();

  const sections = rows.map((poRow, i) => {
    const po = String(poRow["PO #"] ?? "").trim();
    const packingList = getPackingListForPoFromMap_(listsByPo, po);
    const cartons = packingList
      ? (cartonsByListId[String(packingList[PACKING_LIST_ID_FIELD] ?? "")] || [])
      : [];
    const isLast = i === rows.length - 1;
    return buildPdfPoSectionHtml_(poRow, packingList, cartons, isLast);
  });

  const bodyHtml = sections.join("\n");
  const html = renderEmailTemplate_("templates/packing-list-pdf", { poSectionsHtml: bodyHtml });

  const filename = opts.filename || ("PackingList_" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd") + ".pdf");
  // HtmlService is required for HTML -> PDF conversion; Utilities.newBlob().getAs("application/pdf") does not work.
  return HtmlService.createHtmlOutput(html)
    .setWidth(PDF_PAGE_WIDTH_)
    .setHeight(PDF_PAGE_HEIGHT_)
    .getAs("application/pdf")
    .setName(filename);
}

// ── End Packing List PDF Builders ─────────────────────────────────────────────

function computeRequestEmailTotals_(rows, weightByPo) {
  return rows.reduce((totals, row) => {
    const po = String(row["PO #"] ?? "").trim();
    totals.unitQty += toQtyNumber_(row["Actual Qty"]);
    totals.orderQty += toQtyNumber_(row["PO Qty"]);
    totals.ctnQty += toQtyNumber_(row["Ctn Qty"]);
    totals.totalWeight += weightByPo[po] || 0;
    return totals;
  }, { unitQty: 0, orderQty: 0, ctnQty: 0, totalWeight: 0 });
}

function formatEmailQty_(value) {
  const n = toQtyNumber_(value);
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

function formatEmailWeight_(value) {
  const n = toQtyNumber_(value);
  if (n <= 0) return "";
  return Number.isInteger(n) ? String(n) + " lbs" : String(Math.round(n * 100) / 100) + " lbs";
}

function buildRequestEmailTotalsLine_(rows, weightByPo) {
  const totals = computeRequestEmailTotals_(rows, weightByPo);
  return "Total | Unit Qty: " + formatEmailQty_(totals.unitQty) +
    " | Ctn Qty: " + formatEmailQty_(totals.ctnQty) +
    " | Total Weight: " + (formatEmailWeight_(totals.totalWeight) || "—");
}

const REQUEST_EMAIL_TABLE_COLUMNS = [
  "_num", "PO #", "Style #", "Vendor", "Buyer", "Buyer PO #", "Color", "House #", "Actual Qty", "Ctn Qty", "_weight"
];

const REQUEST_EMAIL_TABLE_LABELS = {
  "Actual Qty": "Unit Qty",
  "_weight": "Weight",
};

function emailPoThExtraStyle_(col) {
  if (col === "_num") return "width:36px;min-width:36px;text-align:center;";
  if (col === "PO #") return "width:68px;min-width:68px;max-width:76px;";
  if (col === "House #") return "width:84px;min-width:84px;";
  return "";
}

function emailExfPoThExtraStyle_(col) {
  if (col === "EXF Memo") {
    return "min-width:160px;width:32%;white-space:normal;";
  }
  if (col === "_num") return "width:36px;min-width:36px;max-width:36px;text-align:center;";
  if (col === "PO #") return "width:68px;min-width:68px;max-width:76px;";
  if (col === "Style #") return "width:72px;min-width:72px;max-width:88px;";
  if (col === "Buyer") return "width:80px;min-width:80px;max-width:96px;";
  if (col === "Buyer PO #") return "width:88px;min-width:88px;max-width:100px;";
  if (col === "PO Qty") return "width:72px;min-width:72px;max-width:80px;";
  if (col === "Ship Method") return "width:88px;min-width:88px;max-width:100px;";
  if (col === "CXL Date") return "width:80px;min-width:80px;max-width:88px;";
  return "";
}

function emailExfPoCellClass_(col) {
  if (col === "EXF Memo") return " class=\"email-memo-cell\"";
  return emailPoCellClass_(col);
}

function emailExfPoCellStyle_(col) {
  if (col === "EXF Memo") {
    return EMAIL_PO_TD_STYLE_ + "min-width:160px;word-break:break-word;white-space:normal;";
  }
  return emailPoCellStyle_(col);
}

function emailPoCellClass_(col) {
  if (col === "_num") return " class=\"email-row-num\"";
  if (col === "Actual Qty" || col === "Ctn Qty" || col === "_weight" || col === "PO Qty") return " class=\"email-num\"";
  return "";
}

function emailPoCellStyle_(col) {
  if (col === "_num") return EMAIL_PO_TD_ROW_NUM_STYLE_;
  if (col === "Actual Qty" || col === "Ctn Qty" || col === "_weight" || col === "PO Qty") return EMAIL_PO_TD_NUM_STYLE_;
  return EMAIL_PO_TD_STYLE_;
}

function emailPoHeaderLabel_(col, labels) {
  if (col === "_num") return "\u00a0";
  return labels[col] || col;
}

function getRequestEmailPoCellValue_(row, col, rowIndex, weightByPo) {
  if (col === "_num") return String(rowIndex + 1);
  if (col === "_weight") {
    const po = String(row["PO #"] ?? "").trim();
    return formatEmailWeight_(weightByPo[po] || 0) || "";
  }
  return String(row[col] ?? "");
}

function getEmailPoFooterLabelCol_(columns, qtyFooterCol) {
  const qtyIdx = columns.indexOf(qtyFooterCol);
  if (qtyIdx <= 0) return null;
  for (let i = qtyIdx - 1; i >= 0; i--) {
    if (columns[i] !== "_num") return columns[i];
  }
  return null;
}

function buildEmailPoTableFooterRowHtml_(columns, totals, options) {
  options = options || {};
  const hasCtnQty = options.hasCtnQty !== false;
  const qtyFooterCol = options.qtyFooterCol || "Actual Qty";
  const labelCol = getEmailPoFooterLabelCol_(columns, qtyFooterCol);
  return "<tr>" + columns.map(col => {
    const base = EMAIL_PO_FOOTER_TD_STYLE_;
    if (col === "_num") {
      return "<td style=\"" + base + "\"></td>";
    }
    if (col === labelCol) {
      return "<td style=\"" + base + "text-align:right;\">Total</td>";
    }
    if (col === qtyFooterCol) {
      const qty = qtyFooterCol === "PO Qty" ? totals.orderQty : totals.unitQty;
      return "<td class=\"email-num\" style=\"" + base + "text-align:right;\">" +
        escapeHtml_(formatEmailQty_(qty)) + "</td>";
    }
    if (col === "Ctn Qty" && hasCtnQty) {
      return "<td class=\"email-num\" style=\"" + base + "text-align:right;\">" +
        escapeHtml_(formatEmailQty_(totals.ctnQty)) + "</td>";
    }
    if (col === "_weight") {
      return "<td class=\"email-num\" style=\"" + base + "text-align:right;\">" +
        escapeHtml_(formatEmailWeight_(totals.totalWeight) || "—") + "</td>";
    }
    return "<td style=\"" + base + "\"></td>";
  }).join("") + "</tr>";
}

function buildEmailPoTableHtml_(columns, labels, rows, weightByPo, getCellValue, footerOptions) {
  const headerCells = columns.map(col => {
    const label = emailPoHeaderLabel_(col, labels);
    return "<th style=\"" + EMAIL_PO_TH_STYLE_ + emailPoThExtraStyle_(col) + "\">" +
      escapeHtml_(label) + "</th>";
  }).join("");
  const lastRowIndex = rows.length - 1;
  const bodyRows = rows.map((row, rowIndex) => {
    const isLastRow = rowIndex === lastRowIndex;
    return "<tr>" + columns.map(col => {
      const value = getCellValue(row, col, rowIndex, weightByPo);
      let cellStyle = emailPoCellStyle_(col);
      if (isLastRow) cellStyle = cellStyle.replace("border-bottom:1px solid #e5e7eb;", "border-bottom:none;");
      return "<td" + emailPoCellClass_(col) + " style=\"" + cellStyle + "\">" +
        escapeHtml_(value) + "</td>";
    }).join("") + "</tr>";
  }).join("");
  const totals = computeRequestEmailTotals_(rows, weightByPo);
  const footerRow = buildEmailPoTableFooterRowHtml_(columns, totals, footerOptions);
  return "<table class=\"email-po-table\" role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"width:100%;border-collapse:collapse;margin-top:20px;border:1px solid #e5e7eb;font-size:13px;\">" +
    "<thead><tr>" + headerCells + "</tr></thead>" +
    "<tbody>" + bodyRows + "</tbody>" +
    "<tfoot>" + footerRow + "</tfoot></table>";
}

function buildRequestEmailPoTableHtml_(rows, weightByPo) {
  return buildEmailPoTableHtml_(
    REQUEST_EMAIL_TABLE_COLUMNS,
    REQUEST_EMAIL_TABLE_LABELS,
    rows,
    weightByPo,
    getRequestEmailPoCellValue_,
    { hasCtnQty: true }
  );
}

function buildRequestEmailPoTableText_(rows, weightByPo) {
  const textColumns = REQUEST_EMAIL_TABLE_COLUMNS.filter(col => col !== "_num" && col !== "_weight");
  const labels = [""].concat(textColumns.map(col => REQUEST_EMAIL_TABLE_LABELS[col] || col)).concat(["Weight"]);
  const lines = [labels.join(" | ")];
  rows.forEach((row, rowIndex) => {
    const po = String(row["PO #"] ?? "").trim();
    const cells = [String(rowIndex + 1)]
      .concat(textColumns.map(col => String(row[col] ?? "")))
      .concat([formatEmailWeight_(weightByPo[po] || 0) || ""]);
    lines.push(cells.join(" | "));
  });
  lines.push("");
  lines.push(buildRequestEmailTotalsLine_(rows, weightByPo));
  return lines.join("\n");
}

function buildDeliveryPickupRequestEmailHtml_(requestType, requestId, rows, requestData) {
  const dateField = requestType === "Delivery" ? DELIVERY_DATE_FIELD : PICKUP_DATE_FIELD;
  const notesField = requestType === "Delivery" ? DELIVERY_REQ_NOTES_FIELD : PICKUP_REQ_NOTES_FIELD;
  const weightByPo = getPackingWeightByPo_();

  const hasTo = !!String(requestData["To"] ?? "").trim();
  const headerRequestDate = formatEmailDate_(requestData["Request Date"]);
  const requestTypeLabel = requestType + " Request";
  return renderEmailTemplate_("templates/email-delivery-pickup", {
    requestType: requestType,
    requestTypeLower: requestType.toLowerCase(),
    requestTypeLabel: requestTypeLabel,
    requestId: requestId,
    headerRequestDate: headerRequestDate,
    requestHeaderHtml: buildEmailRequestHeaderHtml_(requestTypeLabel, requestId, headerRequestDate),
    requestDate: headerRequestDate,
    typeDate: formatEmailDate_(requestData[dateField] ?? ""),
    poCount: rows.length,
    fromBlockHtml: buildDeliveryPickupFromBlockHtml_(requestData["From"], requestData["Pickup Address"], !hasTo),
    toBlockHtml: buildDeliveryPickupToBlockHtml_(requestData["To"], requestData["Delivery Address"]),
    notesBlockHtml: buildEmailNotesBlockHtml_(requestData[notesField]),
    poTableHtml: buildRequestEmailPoTableHtml_(rows, weightByPo),
  });
}

function buildDeliveryPickupRequestEmailText_(requestType, requestId, rows, requestData) {
  const dateField = requestType === "Delivery" ? DELIVERY_DATE_FIELD : PICKUP_DATE_FIELD;
  const notesField = requestType === "Delivery" ? DELIVERY_REQ_NOTES_FIELD : PICKUP_REQ_NOTES_FIELD;
  const weightByPo = getPackingWeightByPo_();
  const lines = [
    "Hello,",
    "",
    "Please see the " + requestType.toLowerCase() + " request below.",
    "",
    requestType + " Request: " + requestId,
    "Request Date: " + formatEmailDate_(requestData["Request Date"]),
    requestType + " Date: " + formatEmailDate_(requestData[dateField] ?? ""),
    "PO Count: " + rows.length,
  ];
  if (requestData["From"]) lines.push("From: " + String(requestData["From"]));
  if (requestData["Pickup Address"]) lines.push("Pickup Address: " + String(requestData["Pickup Address"]));
  if (requestData["To"]) lines.push("To: " + String(requestData["To"]));
  if (requestData["Delivery Address"]) lines.push("Delivery Address: " + String(requestData["Delivery Address"]));
  const notes = String(requestData[notesField] ?? "").trim();
  if (notes) lines.push("Notes: " + notes);
  lines.push("");
  lines.push(buildRequestEmailPoTableText_(rows, weightByPo));
  lines.push("");
  lines.push("www.elevatordisco.com");
  return lines.join("\n");
}

function sendDeliveryPickupRequestEmail_(requestType, requestId, emailInfo, rows, requestData) {
  if (!emailInfo.to) return false;
  const dateField = requestType === "Delivery" ? DELIVERY_DATE_FIELD : PICKUP_DATE_FIELD;
  const displayDate = formatEmailDate_(requestData[dateField] ?? requestData["Request Date"]);
  const to = String(requestData["To"] ?? "").trim();
  const subject = renderEmailSubject_("templates/email-delivery-pickup-subject", {
    requestType: requestType,
    displayDate: displayDate,
    to: to,
  });
  const options = {
    to: emailInfo.to,
    subject: subject,
    body: buildDeliveryPickupRequestEmailText_(requestType, requestId, rows, requestData),
    htmlBody: buildDeliveryPickupRequestEmailHtml_(requestType, requestId, rows, requestData),
  };
  if (emailInfo.cc) options.cc = emailInfo.cc;
  try {
    const pdfFilename = requestType + "_" + requestId + "_PackingList.pdf";
    const pdfBlob = buildGroupPackingListPdfBlob_(rows, { filename: pdfFilename });
    options.attachments = [pdfBlob];
  } catch (pdfErr) {
    // Non-fatal: send without attachment if PDF generation fails
    Logger.log("Packing list PDF generation failed (" + requestType + " " + requestId + "): " + pdfErr);
  }
  MailApp.sendEmail(options);
  return true;
}

function buildAsnRequestEmailHtml_(requestId, rows, requestData) {
  const weightByPo = getPackingWeightByPo_();
  const headerRequestDate = formatEmailDate_(requestData["Request Date"]);
  const requestTypeLabel = "ASN Request";
  return renderEmailTemplate_("templates/email-asn", {
    requestTypeLabel: requestTypeLabel,
    requestId: requestId,
    headerRequestDate: headerRequestDate,
    requestHeaderHtml: buildEmailRequestHeaderHtml_(requestTypeLabel, requestId, headerRequestDate),
    requestDate: headerRequestDate,
    asnDate: formatEmailDate_(requestData[ASN_DATE_FIELD] ?? ""),
    buyer: String(requestData["Buyer"] ?? ""),
    poCount: rows.length,
    notesBlockHtml: buildEmailNotesBlockHtml_(requestData[ASN_REQ_NOTES_FIELD]),
    poTableHtml: buildRequestEmailPoTableHtml_(rows, weightByPo),
  });
}

function buildAsnRequestEmailText_(requestId, rows, requestData) {
  const weightByPo = getPackingWeightByPo_();
  const lines = [
    "Hello,",
    "",
    "Please see the ASN request below.",
    "",
    "ASN Request: " + requestId,
    "Request Date: " + formatEmailDate_(requestData["Request Date"]),
    "ASN Date: " + formatEmailDate_(requestData[ASN_DATE_FIELD] ?? ""),
    "Buyer: " + String(requestData["Buyer"] ?? ""),
    "PO Count: " + rows.length,
  ];
  const notes = String(requestData[ASN_REQ_NOTES_FIELD] ?? "").trim();
  if (notes) lines.push("Notes: " + notes);
  lines.push("");
  lines.push(buildRequestEmailPoTableText_(rows, weightByPo));
  lines.push("");
  lines.push("www.elevatordisco.com");
  return lines.join("\n");
}

function sendAsnRequestEmail_(requestId, emailInfo, rows, requestData) {
  if (!emailInfo.to) return false;
  const displayDate = formatEmailDate_(requestData[ASN_DATE_FIELD] ?? requestData["Request Date"]);
  const buyer = String(requestData["Buyer"] ?? "").trim();
  const subject = renderEmailSubject_("templates/email-asn-subject", {
    displayDate: displayDate,
    buyer: buyer,
  });
  const options = {
    to: emailInfo.to,
    subject: subject,
    body: buildAsnRequestEmailText_(requestId, rows, requestData),
    htmlBody: buildAsnRequestEmailHtml_(requestId, rows, requestData),
  };
  if (emailInfo.cc) options.cc = emailInfo.cc;
  try {
    const pdfFilename = "ASN_" + requestId + "_PackingList.pdf";
    const pdfBlob = buildGroupPackingListPdfBlob_(rows, { filename: pdfFilename });
    options.attachments = [pdfBlob];
  } catch (pdfErr) {
    Logger.log("Packing list PDF generation failed (ASN " + requestId + "): " + pdfErr);
  }
  MailApp.sendEmail(options);
  return true;
}

function getExfRequestPoTotalQty_(rows) {
  return rows.reduce((sum, row) => {
    const n = Number(String(row["PO Qty"] ?? "").replace(/,/g, ""));
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}

function getExfDateFromRequestRecord_(request) {
  return String(request[EXF_DATE_FIELD] ?? request["Request Date"] ?? "").trim();
}

function getExfReqNotesFromRequestRecord_(request) {
  return String(request[EXF_REQ_NOTES_FIELD] ?? "").trim();
}

function getExfReqCcFromRequestRecord_(request, vendor) {
  const stored = getVendorEmailInfo_(vendor);
  return String(request[EXF_REQ_CC_FIELD] ?? request["Vendor CC"] ?? "").trim() || stored.cc;
}

const EXF_EMAIL_TABLE_COLUMNS = [
  "_num", "PO #", "Style #", "Buyer", "Buyer PO #", "PO Qty", "Ship Method", "CXL Date", "EXF Memo"
];

const EXF_EMAIL_TABLE_LABELS = {
  "PO Qty": "Order Qty",
};

function buildExfEmailTotalsLine_(rows) {
  const totals = computeRequestEmailTotals_(rows, {});
  return "Total | Order Qty: " + formatEmailQty_(totals.orderQty);
}

function getExfEmailPoCellValue_(row, col, rowIndex, weightByPo, memos, shipMethods) {
  const po = String(row["PO #"] ?? "");
  if (col === "_num") return String(rowIndex + 1);
  if (col === "Ship Method") return String(shipMethods[po] ?? row["Ship Method"] ?? "");
  if (col === "CXL Date") return formatEmailDate_(row["CXL Date"]);
  if (col === "EXF Memo") return String(memos[po] ?? row[EXF_MEMO_FIELD] ?? "");
  return String(row[col] ?? "");
}

function buildExfRequestEmailPoTableHtml_(rows, memos, shipMethods, weightByPo) {
  const columns = EXF_EMAIL_TABLE_COLUMNS;
  const headerCells = columns.map(col => {
    const label = emailPoHeaderLabel_(col, EXF_EMAIL_TABLE_LABELS);
    return "<th style=\"" + EMAIL_PO_TH_STYLE_ + emailExfPoThExtraStyle_(col) + "\">" +
      escapeHtml_(label) + "</th>";
  }).join("");
  const lastRowIndex = rows.length - 1;
  const bodyRows = rows.map((row, rowIndex) => {
    const isLastRow = rowIndex === lastRowIndex;
    return "<tr>" + columns.map(col => {
      const value = getExfEmailPoCellValue_(row, col, rowIndex, weightByPo, memos, shipMethods);
      let cellStyle = emailExfPoCellStyle_(col);
      if (isLastRow) cellStyle = cellStyle.replace("border-bottom:1px solid #e5e7eb;", "border-bottom:none;");
      return "<td" + emailExfPoCellClass_(col) + " style=\"" + cellStyle + "\">" +
        escapeHtml_(value) + "</td>";
    }).join("") + "</tr>";
  }).join("");
  const totals = computeRequestEmailTotals_(rows, weightByPo);
  const footerRow = buildEmailPoTableFooterRowHtml_(columns, totals, {
    hasCtnQty: false,
    qtyFooterCol: "PO Qty",
  });
  return "<table class=\"email-po-table email-exf-table\" role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"width:100%;table-layout:auto;border-collapse:collapse;margin-top:20px;border:1px solid #e5e7eb;font-size:13px;\">" +
    "<thead><tr>" + headerCells + "</tr></thead>" +
    "<tbody>" + bodyRows + "</tbody>" +
    "<tfoot>" + footerRow + "</tfoot></table>";
}

function buildExfRequestEmailHtml_(requestId, vendor, rows, exfDate, exfReqNotes, memos, shipMethods, headerRequestDate) {
  const weightByPo = getPackingWeightByPo_();
  const requestTypeLabel = "EXF Request";
  const safeHeaderDate = formatEmailDate_(headerRequestDate);
  return renderEmailTemplate_("templates/email-exf", {
    requestTypeLabel: requestTypeLabel,
    requestId: requestId,
    headerRequestDate: safeHeaderDate,
    requestHeaderHtml: buildEmailRequestHeaderHtml_(requestTypeLabel, requestId, safeHeaderDate),
    vendor: vendor,
    exfDate: exfDate,
    poCount: rows.length,
    notesBlockHtml: buildEmailNotesBlockHtml_(exfReqNotes),
    poTableHtml: buildExfRequestEmailPoTableHtml_(rows, memos, shipMethods, weightByPo),
  });
}

function buildExfRequestEmailText_(requestId, vendor, rows, exfDate, exfReqNotes, memos, shipMethods) {
  const weightByPo = getPackingWeightByPo_();
  const lines = [
    "Hello,",
    "",
    "Please confirm EXF readiness for the POs below.",
    "",
    "EXF Request: " + requestId,
    "Vendor: " + vendor,
    "EXF Date: " + exfDate,
    "PO Count: " + rows.length,
  ];
  if (exfReqNotes) lines.push("Notes: " + exfReqNotes);
  lines.push("");
  lines.push(" | PO # | Style # | Buyer | Buyer PO # | Order Qty | Ship Method | CXL Date | EXF Memo");
  rows.forEach((row, rowIndex) => {
    const po = String(row["PO #"] ?? "");
    lines.push([
      String(rowIndex + 1),
      po,
      String(row["Style #"] ?? ""),
      String(row["Buyer"] ?? ""),
      String(row["Buyer PO #"] ?? ""),
      String(row["PO Qty"] ?? ""),
      String(shipMethods[po] ?? row["Ship Method"] ?? ""),
      formatEmailDate_(row["CXL Date"]),
      String(memos[po] ?? row[EXF_MEMO_FIELD] ?? ""),
    ].join(" | "));
  });
  lines.push("");
  lines.push(buildExfEmailTotalsLine_(rows));
  lines.push("");
  lines.push("www.elevatordisco.com");
  return lines.join("\n");
}

function sendExfRequestEmail_(requestId, vendor, vendorEmailInfo, rows, exfDate, exfReqNotes, memos, shipMethods, headerRequestDate) {
  if (!vendorEmailInfo.to) {
    throw new Error("No vendor email found for " + vendor + ". Add it to the Vendors sheet.");
  }

  const displayDate = formatEmailDate_(exfDate);
  const subject = renderEmailSubject_("templates/email-exf-subject", {
    exfDate: displayDate,
    vendor: vendor,
  });
  const htmlBody = buildExfRequestEmailHtml_(
    requestId, vendor, rows, displayDate, exfReqNotes, memos, shipMethods, headerRequestDate
  );
  const options = {
    to: vendorEmailInfo.to,
    subject: subject,
    body: buildExfRequestEmailText_(requestId, vendor, rows, displayDate, exfReqNotes, memos, shipMethods),
    htmlBody: htmlBody,
  };
  if (vendorEmailInfo.cc) options.cc = vendorEmailInfo.cc;
  MailApp.sendEmail(options);
}

function getExfRequestPoNumbersFromRecord_(request) {
  return String(request["PO Numbers"] ?? "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

function sendAndFinalizeExfRequestEmail_(exfRequestsSheet, found) {
  const request = {};
  found.headers.forEach((field, i) => { request[field] = found.values[i]; });

  const requestId = String(request[EXF_REQUEST_ID_FIELD] ?? "").trim();
  const poNumbers = getExfRequestPoNumbersFromRecord_(request);
  const exfDate = getExfDateFromRequestRecord_(request);
  const exfReqNotes = getExfReqNotesFromRequestRecord_(request);
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
      cc: getExfReqCcFromRequestRecord_(request, vendor),
    };
    poRows.forEach(row => {
      const po = String(row["PO #"] ?? "");
      memos[po] = row[EXF_MEMO_FIELD] ?? "";
      shipMethods[po] = row["Ship Method"] ?? "";
    });

    sendExfRequestEmail_(
      requestId, vendor, vendorEmailInfo, poRows, exfDate, exfReqNotes, memos, shipMethods,
      formatEmailDate_(request["Request Date"])
    );
    markExfRequestPosRequested_(poSheet, poNumbers, requestId, exfDate, memos, shipMethods);
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

function markExfRequestPosRequested_(poSheet, poNumbers, requestId, exfDate, memos, shipMethods) {
  const items = poNumbers.map(poNumber => {
    const updates = {};
    updates[EXF_REQUEST_ID_FIELD] = requestId;
    updates[EXF_REQUESTED_FIELD] = true;
    updates["Status"] = "Requested";
    updates[EXF_DATE_FIELD] = exfDate;
    if (shipMethods[poNumber] !== undefined) updates["Ship Method"] = shipMethods[poNumber];
    const memo = String(memos[poNumber] ?? "").trim();
    if (memo) updates[EXF_MEMO_FIELD] = memo;
    return { poNumber: poNumber, updates: updates };
  });
  applyPoUpdatesBatch_(poSheet, items);
}

function pickRequestData_(raw, fields) {
  const out = {};
  fields.forEach(field => {
    if (raw[field] !== undefined) out[field] = raw[field];
  });
  return out;
}

function pickDeliveryRequestData_(raw) {
  return pickRequestData_(raw, DELIVERY_REQUEST_DATA_FIELDS);
}

function pickPickupRequestData_(raw) {
  return pickRequestData_(raw, PICKUP_REQUEST_DATA_FIELDS);
}

function pickAsnRequestData_(raw) {
  return pickRequestData_(raw, ASN_REQUEST_DATA_FIELDS);
}

function handleExfRequest(payload) {
  const poNumbers = payload.poNumbers || [];
  if (!Array.isArray(poNumbers) || poNumbers.length === 0) {
    return corsResponse({ success: false, error: "Select at least one PO." });
  }
  const exfDate = String(payload.exfDate ?? payload.requestDate ?? "").trim();
  if (!exfDate) {
    return corsResponse({ success: false, error: "EXF Date is required." });
  }
  const exfReqNotes = String(payload.exfReqNotes ?? "").trim();
  const memos = payload.memos || {};
  const shipMethods = payload.shipMethods || {};
  const missingShipMethods = poNumbers.filter(function(poNumber) {
    return String(shipMethods[poNumber] ?? "").trim() === "";
  });
  if (missingShipMethods.length > 0) {
    return corsResponse({ success: false, error: "Select Shipping Method for all POs before submitting." });
  }
  const poSheet = ensurePoWorkflowHeaders_();
  let poRows = [];
  let vendor = "";
  try {
    poRows = getPoObjectsByNumbers_(poSheet, poNumbers);
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

  let emailSent = false;
  let emailError = "";
  try {
    sendExfRequestEmail_(
      requestId, vendor, vendorEmailInfo, poRows, exfDate, exfReqNotes, memos, shipMethods,
      formatEmailDate_(new Date())
    );
    markExfRequestPosRequested_(poSheet, poNumbers, requestId, exfDate, memos, shipMethods);
    emailSent = true;
  } catch (err) {
    emailError = err && err.message ? err.message : String(err);
  }

  const now = new Date();
  try {
  appendRequestRow_(exfRequestsSheet, EXF_REQUEST_ID_FIELD, requestId, EXF_REQUEST_DATA_FIELDS, {
    [EXF_DATE_FIELD]: exfDate,
    [EXF_REQ_SUBMIT_DATE_FIELD]: now,
    "Vendor": vendor,
    "Vendor Email": vendorEmailInfo.to,
    [EXF_REQ_CC_FIELD]: vendorEmailInfo.cc,
    [EXF_REQ_NOTES_FIELD]: exfReqNotes,
    "PO Numbers": poNumbers.join(", "),
    "PO Count": poNumbers.length,
    "Total Qty": getExfRequestPoTotalQty_(poRows),
    "Email Status": emailSent ? "Sent" : "Failed",
    "Email Sent At": emailSent ? now : "",
    "Email Error": emailError,
    "Last Email Attempt At": now,
    "Created At": now,
    "Updated At": now,
  });
  } catch (err) {
    return corsResponse({
      success: false,
      error: (err && err.message ? err.message : String(err)) || "Failed to save EXF request.",
      emailError: emailError,
    });
  }

  if (!emailSent) {
    applyPoUpdatesBatch_(poSheet, poNumbers.map(poNumber => ({
      poNumber: poNumber,
      updates: { [EXF_REQUEST_ID_FIELD]: requestId },
    })));
  }

  if (!emailSent) {
    return corsResponse({
      success: false,
      error: emailError || "EXF email failed to send.",
      exfRequestId: requestId,
      emailSent: false,
      emailError: emailError,
    });
  }

  return corsResponse({
    success: true,
    exfRequestId: requestId,
    emailSent: true,
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
  if (!requestData[ASN_DATE_FIELD]) {
    return corsResponse({ success: false, error: "ASN Date is required." });
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

  // Determine buyer and email
  const buyer = String(requestData["Buyer"] || (poRows.length ? poRows[0]["Buyer"] : "") || "").trim();
  requestData["Buyer"] = buyer;
  const storedEmailInfo = getContactEmailInfo_(buyer);
  const emailInfo = {
    to: normalizeEmailRecipients_(requestData["Buyer Email"] || storedEmailInfo.to),
    cc: normalizeEmailRecipients_(requestData[EXF_REQ_CC_FIELD] || storedEmailInfo.cc),
  };
  requestData["Buyer Email"] = emailInfo.to;
  requestData[EXF_REQ_CC_FIELD] = emailInfo.cc;
  requestData["PO Numbers"] = poNumbers.join(", ");
  requestData["PO Count"] = poNumbers.length;

  const existing = sheetToObjects_(sheet, ASN_REQUEST_ID_FIELD);
  const requestId = generateAsnRequestId_(existing);

  let emailSent = false;
  let emailError = "";
  try {
    emailSent = sendAsnRequestEmail_(requestId, emailInfo, poRows, requestData);
  } catch (err) {
    emailError = err && err.message ? err.message : String(err);
  }

  const now = new Date();
  requestData["Email Status"] = emailInfo.to ? (emailSent ? "Sent" : "Failed") : "Not Sent";
  requestData["Email Sent At"] = emailSent ? now : "";
  requestData["Email Error"] = emailError;
  requestData["Last Email Attempt At"] = now;
  requestData["Created At"] = now;
  requestData["Updated At"] = now;

  appendRequestRow_(sheet, ASN_REQUEST_ID_FIELD, requestId, ASN_REQUEST_DATA_FIELDS, requestData);

  // Only mark PO as ASN-complete if email succeeded (or no email address was provided)
  if (emailSent || !emailInfo.to) {
    applyPoUpdatesBatch_(poSheet, poNumbers.map(poNumber => ({
      poNumber: poNumber,
      updates: {
        [ASN_REQUEST_ID_FIELD]: requestId,
        [ASN_REQUESTED_FIELD]: true,
        [ASN_DATE_FIELD]: requestData[ASN_DATE_FIELD],
        [ASN_REQ_DATE_FIELD]: requestData["Request Date"],
      },
    })));
  } else {
    // Still store the request ID link even on failure so resend can find the PO set
    applyPoUpdatesBatch_(poSheet, poNumbers.map(poNumber => ({
      poNumber: poNumber,
      updates: { [ASN_REQUEST_ID_FIELD]: requestId },
    })));
  }

  if (!emailSent && emailInfo.to) {
    return corsResponse({
      success: false,
      error: emailError || "ASN email failed to send.",
      asnRequestId: requestId,
      emailSent: false,
      emailError: emailError,
    });
  }

  return corsResponse({
    success: true,
    asnRequestId: requestId,
    emailSent: emailSent,
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

function handleResendAsnRequestEmail(payload) {
  const requestId = String(payload.asnRequestId ?? "").trim();
  if (!requestId) return corsResponse({ success: false, error: "ASN Request ID is required." });

  const sheet = getAsnRequestsSheet_();
  const found = findRequestRowIndex_(sheet, ASN_REQUEST_ID_FIELD, requestId);
  if (!found) return corsResponse({ success: false, error: "ASN request not found: " + requestId });

  const request = {};
  found.headers.forEach((field, i) => { request[field] = found.values[i]; });

  const buyer = String(request["Buyer"] ?? "").trim();
  const emailInfo = {
    to: normalizeEmailRecipients_(String(request["Buyer Email"] ?? "").trim()),
    cc: normalizeEmailRecipients_(String(request[EXF_REQ_CC_FIELD] ?? "").trim()),
  };
  if (!emailInfo.to) return corsResponse({ success: false, error: "No Buyer Email on record for this ASN request." });

  const poNumbers = String(request["PO Numbers"] ?? "").split(",").map(s => s.trim()).filter(Boolean);
  const poSheet = ensurePoWorkflowHeaders_();
  let poRows = [];
  try { poRows = getPoObjectsByNumbers_(poSheet, poNumbers); } catch (e) { /* best effort */ }

  let emailSent = false;
  let emailError = "";
  try {
    emailSent = sendAsnRequestEmail_(requestId, emailInfo, poRows, request);
  } catch (err) {
    emailError = err && err.message ? err.message : String(err);
  }

  const now = new Date();
  updateRequestRowFields_(sheet, found.rowIndex, found.headers, {
    "Email Status": emailSent ? "Sent" : "Failed",
    "Email Sent At": emailSent ? now : request["Email Sent At"],
    "Email Error": emailError,
    "Last Email Attempt At": now,
    "Updated At": now,
  });

  if (emailSent && poNumbers.length > 0) {
    applyPoUpdatesBatch_(poSheet, poNumbers.map(poNumber => ({
      poNumber: poNumber,
      updates: {
        [ASN_REQUESTED_FIELD]: true,
        [ASN_DATE_FIELD]: request[ASN_DATE_FIELD],
        [ASN_REQ_DATE_FIELD]: request["Request Date"],
      },
    })));
  }

  return corsResponse({ success: true, asnRequestId: requestId, emailSent: emailSent, emailError: emailError });
}

function handleResendDeliveryRequestEmail(payload) {
  const requestId = String(payload.deliveryRequestId ?? "").trim();
  if (!requestId) return corsResponse({ success: false, error: "Delivery Request ID is required." });

  const sheet = getDeliveryRequestsSheet_();
  const found = findRequestRowIndex_(sheet, DELIVERY_REQUEST_ID_FIELD, requestId);
  if (!found) return corsResponse({ success: false, error: "Delivery request not found: " + requestId });

  const request = {};
  found.headers.forEach((field, i) => { request[field] = found.values[i]; });

  const emailInfo = getDeliveryPickupEmailInfo_(request);
  if (!emailInfo.to) return corsResponse({ success: false, error: "No email address on record for this delivery request." });

  const poNumbers = String(request["PO Numbers"] ?? "").split(",").map(s => s.trim()).filter(Boolean);
  const poSheet = ensurePoWorkflowHeaders_();
  let poRows = [];
  try { poRows = getPoObjectsByNumbers_(poSheet, poNumbers); } catch (e) { /* best effort */ }

  let emailSent = false;
  let emailError = "";
  try {
    emailSent = sendDeliveryPickupRequestEmail_("Delivery", requestId, emailInfo, poRows, request);
  } catch (err) {
    emailError = err && err.message ? err.message : String(err);
  }

  const now = new Date();
  updateRequestRowFields_(sheet, found.rowIndex, found.headers, {
    "Email Status": emailSent ? "Sent" : "Failed",
    "Email Sent At": emailSent ? now : request["Email Sent At"],
    "Email Error": emailError,
    "Updated At": now,
  });

  if (emailSent && poNumbers.length > 0) {
    applyPoUpdatesBatch_(poSheet, poNumbers.map(poNumber => ({
      poNumber: poNumber,
      updates: {
        [DELIVERY_REQUESTED_FIELD]: true,
        [DELIVERY_DATE_FIELD]: request[DELIVERY_DATE_FIELD],
        [DELIVERY_REQ_DATE_FIELD]: request["Request Date"],
        "Status": "Scheduled",
      },
    })));
  }

  return corsResponse({ success: true, deliveryRequestId: requestId, emailSent: emailSent, emailError: emailError });
}

function handleResendPickupRequestEmail(payload) {
  const requestId = String(payload.pickupRequestId ?? "").trim();
  if (!requestId) return corsResponse({ success: false, error: "Pickup Request ID is required." });

  const sheet = getPickupRequestsSheet_();
  const found = findRequestRowIndex_(sheet, PICKUP_REQUEST_ID_FIELD, requestId);
  if (!found) return corsResponse({ success: false, error: "Pickup request not found: " + requestId });

  const request = {};
  found.headers.forEach((field, i) => { request[field] = found.values[i]; });

  const emailInfo = getDeliveryPickupEmailInfo_(request);
  if (!emailInfo.to) return corsResponse({ success: false, error: "No email address on record for this pickup request." });

  const poNumbers = String(request["PO Numbers"] ?? "").split(",").map(s => s.trim()).filter(Boolean);
  const poSheet = ensurePoWorkflowHeaders_();
  let poRows = [];
  try { poRows = getPoObjectsByNumbers_(poSheet, poNumbers); } catch (e) { /* best effort */ }

  let emailSent = false;
  let emailError = "";
  try {
    emailSent = sendDeliveryPickupRequestEmail_("Pickup", requestId, emailInfo, poRows, request);
  } catch (err) {
    emailError = err && err.message ? err.message : String(err);
  }

  const now = new Date();
  updateRequestRowFields_(sheet, found.rowIndex, found.headers, {
    "Email Status": emailSent ? "Sent" : "Failed",
    "Email Sent At": emailSent ? now : request["Email Sent At"],
    "Email Error": emailError,
    "Updated At": now,
  });

  if (emailSent && poNumbers.length > 0) {
    applyPoUpdatesBatch_(poSheet, poNumbers.map(poNumber => {
      const found2 = findPoRowIndex_(poSheet, poNumber);
      const divCol = found2 ? found2.headers.indexOf("Division") : -1;
      const division = (found2 && divCol !== -1)
        ? String(poSheet.getRange(found2.rowIndex, divCol + 1).getValue() ?? "").trim()
        : "";
      const updates = {
        [PICKUP_REQUESTED_FIELD]: true,
        [PICKUP_DATE_FIELD]: request[PICKUP_DATE_FIELD],
        [PICKUP_REQ_DATE_FIELD]: request["Request Date"],
        "Assign Date": request[PICKUP_DATE_FIELD],
      };
      if (/^freesia$/i.test(division)) updates["Status"] = "Assigned";
      return { poNumber: poNumber, updates: updates };
    }));
  }

  return corsResponse({ success: true, pickupRequestId: requestId, emailSent: emailSent, emailError: emailError });
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
  if (!requestData[DELIVERY_DATE_FIELD]) {
    return corsResponse({ success: false, error: "Delivery Date is required." });
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
  requestData["PO Numbers"] = poNumbers.join(", ");
  requestData["PO Count"] = poNumbers.length;
  try {
    emailSent = sendDeliveryPickupRequestEmail_("Delivery", requestId, emailInfo, poRows, requestData);
  } catch (err) {
    emailError = err && err.message ? err.message : String(err);
  }
  const now = new Date();
  requestData["Email Status"] = emailInfo.to ? (emailSent ? "Sent" : "Failed") : "Not Sent";
  requestData["Email Sent At"] = emailSent ? now : "";
  requestData["Email Error"] = emailError;
  requestData["Created At"] = now;
  requestData["Updated At"] = now;

  appendRequestRow_(sheet, DELIVERY_REQUEST_ID_FIELD, requestId, DELIVERY_REQUEST_DATA_FIELDS, requestData);

  if (emailSent || !emailInfo.to) {
    applyPoUpdatesBatch_(poSheet, poNumbers.map(poNumber => ({
      poNumber: poNumber,
      updates: {
        [DELIVERY_REQUEST_ID_FIELD]: requestId,
        [DELIVERY_REQUESTED_FIELD]: true,
        [DELIVERY_DATE_FIELD]: requestData[DELIVERY_DATE_FIELD],
        [DELIVERY_REQ_DATE_FIELD]: requestData["Request Date"],
        "Status": "Scheduled",
      },
    })));
  } else {
    applyPoUpdatesBatch_(poSheet, poNumbers.map(poNumber => ({
      poNumber: poNumber,
      updates: { [DELIVERY_REQUEST_ID_FIELD]: requestId },
    })));
  }

  if (!emailSent && emailInfo.to) {
    return corsResponse({
      success: false,
      error: emailError || "Delivery email failed to send.",
      deliveryRequestId: requestId,
      emailSent: false,
      emailError: emailError,
    });
  }

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
  if (!requestData[PICKUP_DATE_FIELD]) {
    return corsResponse({ success: false, error: "Pickup Date is required." });
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
  requestData["PO Numbers"] = poNumbers.join(", ");
  requestData["PO Count"] = poNumbers.length;
  try {
    emailSent = sendDeliveryPickupRequestEmail_("Pickup", requestId, emailInfo, poRows, requestData);
  } catch (err) {
    emailError = err && err.message ? err.message : String(err);
  }
  const now = new Date();
  requestData["Email Status"] = emailInfo.to ? (emailSent ? "Sent" : "Failed") : "Not Sent";
  requestData["Email Sent At"] = emailSent ? now : "";
  requestData["Email Error"] = emailError;
  requestData["Created At"] = now;
  requestData["Updated At"] = now;

  appendRequestRow_(sheet, PICKUP_REQUEST_ID_FIELD, requestId, PICKUP_REQUEST_DATA_FIELDS, requestData);

  if (emailSent || !emailInfo.to) {
    applyPoUpdatesBatch_(poSheet, poNumbers.map(poNumber => {
      const found = findPoRowIndex_(poSheet, poNumber);
      const divCol = found ? found.headers.indexOf("Division") : -1;
      const division = (found && divCol !== -1)
        ? String(poSheet.getRange(found.rowIndex, divCol + 1).getValue() ?? "").trim()
        : "";
      const updates = {
        [PICKUP_REQUEST_ID_FIELD]: requestId,
        [PICKUP_REQUESTED_FIELD]: true,
        [PICKUP_DATE_FIELD]: requestData[PICKUP_DATE_FIELD],
        [PICKUP_REQ_DATE_FIELD]: requestData["Request Date"],
        "Assign Date": requestData[PICKUP_DATE_FIELD],
      };
      if (/^freesia$/i.test(division)) updates["Status"] = "Assigned";
      return { poNumber: poNumber, updates: updates };
    }));
  } else {
    applyPoUpdatesBatch_(poSheet, poNumbers.map(poNumber => ({
      poNumber: poNumber,
      updates: { [PICKUP_REQUEST_ID_FIELD]: requestId },
    })));
  }

  if (!emailSent && emailInfo.to) {
    return corsResponse({
      success: false,
      error: emailError || "Pickup email failed to send.",
      pickupRequestId: requestId,
      emailSent: false,
      emailError: emailError,
    });
  }

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

  const rowValues = poSheet.getRange(found.rowIndex, 1, 1, found.headers.length).getValues()[0];
  if (isPoClosedFromRowValues_(rowValues, found.headers)) {
    return corsResponse({ success: false, error: "Closed POs cannot be edited." });
  }

  writePoFields_(poSheet, found.rowIndex, found.headers, updates);
  return corsResponse({ success: true, message: "PO updated successfully." });
}

function handleVendorPortalGet_(e) {
  const token = String((e.parameter && e.parameter.token) || "").trim();
  if (!token) {
    return HtmlService.createHtmlOutput(
      "<html><body style=\"font-family:sans-serif;padding:2rem\"><h2>Invalid link.</h2><p>Please contact us for a valid link.</p></body></html>"
    ).setTitle("Invalid Link");
  }
  // Validate without writing Last Used At — that is recorded on first getPos call.
  const tokenInfo = resolveVendorPortalToken_(token, { recordUsage: false });
  if (!tokenInfo) {
    return HtmlService.createHtmlOutput(
      "<html><body style=\"font-family:sans-serif;padding:2rem\"><h2>This link is invalid or has been deactivated.</h2><p>Please contact us for a new link.</p></body></html>"
    ).setTitle("Invalid Link");
  }
  // Create a short-lived session so google.script.run calls don't need to
  // re-read the sheet; this avoids token corruption issues in the round-trip.
  const sessionId = createVendorPortalSession_(token, tokenInfo.vendor);
  const template = HtmlService.createTemplateFromFile("templates/vendor-portal");
  template.vendorName = tokenInfo.vendor;
  // Base64 avoids <?!= ?> truncating at "//" inside JSON (vendor names, tokens, etc.).
  template.vendorPortalBootstrapB64 = Utilities.base64EncodeWebSafe(
    Utilities.newBlob(
      JSON.stringify({ sessionId: sessionId, token: token, vendorName: tokenInfo.vendor }),
      "UTF-8"
    ).getBytes()
  );
  return template.evaluate()
    .setTitle("Packing List Submission")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doGet(e) {
  // Serve the vendor portal HTML form when ?page=vendor is present.
  if (e && e.parameter && e.parameter.page === "vendor") {
    return handleVendorPortalGet_(e);
  }

  try {
    const poSheet = ensurePoWorkflowHeaders_();
    const shipmentsSheet = getShipmentsSheet_();
    const exfRequestsSheet = getExfRequestsSheet_();
    const contactsSheet = getContactsSheet_();
    const locationsSheet = getLocationsSheet_();
    const asnRequestsSheet = getAsnRequestsSheet_();
    const deliveryRequestsSheet = getDeliveryRequestsSheet_();
    const pickupRequestsSheet = getPickupRequestsSheet_();
    const chargebacksSheet = getChargebacksSheet_();
    const packingListsSheet = getPackingListsSheet_();
    const packingCartonsSheet = getPackingCartonsSheet_();
    const stylePhotosSheet = getStylePhotosSheet_();
    const pendingPackingListsSheet = getPendingPackingListsSheet_();
    const data = sheetToObjects_(poSheet, "PO #");
    const shipments = sheetToObjects_(shipmentsSheet, SHIPMENT_ID_FIELD);
    const exfRequests = sheetToObjects_(exfRequestsSheet, EXF_REQUEST_ID_FIELD);
    const contacts = sheetToObjects_(contactsSheet, "Name");
    const locations = sheetToObjects_(locationsSheet, "Entity");
    const asnRequests = sheetToObjects_(asnRequestsSheet, ASN_REQUEST_ID_FIELD);
    const deliveryRequests = sheetToObjects_(deliveryRequestsSheet, DELIVERY_REQUEST_ID_FIELD);
    const pickupRequests = sheetToObjects_(pickupRequestsSheet, PICKUP_REQUEST_ID_FIELD);
    const chargebacks = sheetToObjects_(chargebacksSheet, CHARGEBACK_ID_FIELD);
    const packingLists = sheetToObjects_(packingListsSheet, PACKING_LIST_ID_FIELD);
    const packingCartons = sheetToObjects_(packingCartonsSheet, PACKING_LIST_ID_FIELD);
    const stylePhotos = stylePhotosSheetToObjects_(stylePhotosSheet);
    const pendingPackingLists = enrichPendingPackingListsWithPoFields_(
      sheetToObjects_(pendingPackingListsSheet, PENDING_PACKING_LIST_ID_FIELD),
      data
    );

    return corsResponse({
      success: true,
      data: data,
      shipments: shipments,
      exfRequests: exfRequests,
      contacts: contacts,
      locations: locations,
      // legacy key kept for any cached clients
      vendors: contacts,
      asnRequests: asnRequests,
      deliveryRequests: deliveryRequests,
      pickupRequests: pickupRequests,
      chargebacks: chargebacks,
      packingLists: packingLists,
      packingCartons: packingCartons,
      stylePhotos: stylePhotos,
      pendingPackingLists: pendingPackingLists,
      vendorSubmitMode: getVendorSubmitMode_(),
      defaultColumns: getDefaultColumns_(),
      defaultStatusFilter: getDefaultStatusFilter_(),
    });
  } catch (err) {
    return errorResponse_(err);
  }
}

// ============================================================
// Vendor portal server functions (called via google.script.run)
// ============================================================

/**
 * Returns all open POs for the vendor.
 * Accepts (sessionId, token) — tries the short-lived session first, then falls
 * back to a direct token sheet lookup for backward compatibility.
 * Called from the vendor portal HTML form.
 */
function vendorPortalGetPos(sessionId, token) {
  try {
    const auth = resolveVendorPortalAuth_(sessionId, token);
    if (!auth) return { success: false, error: "This link is no longer valid. Please reopen it from your email or contact us for a new one." };
    const vendor = auth.vendor;

    const poSheet = getSheet();
    if (!poSheet) return { success: false, error: "POs sheet not found." };
    const rows = sheetToObjects_(poSheet, "PO #");
    const vendorKey = vendor.toLowerCase();
    const vendorPos = rows.filter(row =>
      String(row["Vendor"] ?? "").trim().toLowerCase() === vendorKey &&
      String(row["Status"] ?? "").trim().toLowerCase() !== "closed"
    );

    // Build packing list maps: packingListId by PO, then cartons by packingListId
    const packingListsSheet = getPackingListsSheet_();
    const packingCartonsSheet = getPackingCartonsSheet_();
    const packingLists = sheetToObjects_(packingListsSheet, PACKING_LIST_ID_FIELD);
    const allCartons = sheetToObjects_(packingCartonsSheet, PACKING_LIST_ID_FIELD);

    const packingListByPo = {};
    packingLists.forEach(pl => {
      const po = String(pl["PO #"] ?? "").trim();
      if (po && !packingListByPo[po]) packingListByPo[po] = pl;
    });

    const cartonsByListId = {};
    allCartons.forEach(carton => {
      const id = String(carton[PACKING_LIST_ID_FIELD] ?? "").trim();
      if (!id) return;
      if (!cartonsByListId[id]) cartonsByListId[id] = [];
      cartonsByListId[id].push(carton);
    });

    const exfRequestsSheet = getExfRequestsSheet_();
    const exfRequests = sheetToObjects_(exfRequestsSheet, EXF_REQUEST_ID_FIELD);
    const exfRequestIdByPo = {};
    exfRequests.forEach(request => {
      const requestId = String(request[EXF_REQUEST_ID_FIELD] ?? "").trim();
      if (!requestId) return;
      String(request["PO Numbers"] ?? "")
        .split(",")
        .map(s => s.trim())
        .filter(Boolean)
        .forEach(poKey => {
          if (!exfRequestIdByPo[poKey]) exfRequestIdByPo[poKey] = requestId;
        });
    });

    const pendingSheet = getPendingPackingListsSheet_();
    const pendingLists = sheetToObjects_(pendingSheet, PENDING_PACKING_LIST_ID_FIELD);
    const stylePhotoLookup = buildStylePhotoLookup_(getStylePhotosSheet_());
    const pendingByPo = {};
    pendingLists.forEach(entry => {
      if (String(entry["Status"] ?? "").trim().toLowerCase() !== "pending") return;
      if (String(entry["Vendor"] ?? "").trim().toLowerCase() !== vendorKey) return;
      const poKey = String(entry["PO #"] ?? "").trim();
      if (!poKey) return;
      const submittedAt = entry["Submitted At"];
      const existing = pendingByPo[poKey];
      if (!existing || (submittedAt && new Date(submittedAt) > new Date(existing["Submitted At"] || 0))) {
        pendingByPo[poKey] = entry;
      }
    });

    const pos = vendorPos.map(row => {
      const po = String(row["PO #"] ?? "").trim();
      const sizeLabels = [];
      const poUnits = [];
      for (let i = 1; i <= 15; i++) {
        const label = String(row["Size " + i] ?? "").trim();
        if (label) {
          sizeLabels.push(label);
          poUnits.push(toPackingQty_(row["PO Unit " + i]) || 0);
        }
      }
      const pl = packingListByPo[po];
      const plId = pl ? String(pl[PACKING_LIST_ID_FIELD] ?? "").trim() : "";
      const pending = pendingByPo[po];
      const hasPendingSubmission = !!pending;
      let existingCartons = plId ? (cartonsByListId[plId] || []) : [];
      if (hasPendingSubmission && existingCartons.length === 0) {
        try {
          existingCartons = JSON.parse(String(pending["Cartons JSON"] ?? "[]"));
        } catch (_) {
          existingCartons = [];
        }
      }

      // Actual units per size from PO row (written by savePackingListCore_)
      const actUnits = sizeLabels.map((_, i) => toPackingQty_(row["Act Unit " + (i + 1)]) || 0);
      const stylePhotos = lookupStylePhotos_(stylePhotoLookup, row);

      return {
        "PO #": po,
        "Style #": String(row["Style #"] ?? "").trim(),
        "Color": String(row["Color"] ?? "").trim(),
        "Style Photo 1": stylePhotos["Style Photo 1"] || "",
        "Style Photo 2": stylePhotos["Style Photo 2"] || "",
        "Status": String(row["Status"] ?? "").trim(),
        "Buyer": String(row["Buyer"] ?? "").trim(),
        "Buyer PO #": String(row["Buyer PO #"] ?? "").trim(),
        "PO Qty": row["PO Qty"] ?? "",
        "Actual Qty": toPackingQty_(row["Actual Qty"]) || 0,
        "Ctn Qty": toPackingQty_(row["Ctn Qty"]) || 0,
        "EST EXF": row["EST EXF"] ? String(row["EST EXF"]) : "",
        "EXF Request ID": String(row[EXF_REQUEST_ID_FIELD] ?? "").trim() || exfRequestIdByPo[po] || "",
        "EXF Date": row[EXF_DATE_FIELD] ? String(row[EXF_DATE_FIELD]) : (row[EXF_REQUEST_DATE_FIELD] ? String(row[EXF_REQUEST_DATE_FIELD]) : ""),
        "EXF Memo": String(row[EXF_MEMO_FIELD] ?? "").trim(),
        "sizeLabels": sizeLabels,
        "poUnits": poUnits,
        "actUnits": actUnits,
        "hasPackingList": !!pl,
        "hasPendingSubmission": hasPendingSubmission,
        "submittedAt": hasPendingSubmission
          ? String(pending["Submitted At"] ?? "")
          : (pl ? String(pl["Created At"] ?? "") : ""),
        "cartonCount": pl
          ? (toPackingQty_(pl["Carton Count"]) || 0)
          : (hasPendingSubmission ? (toPackingQty_(pending["Carton Count"]) || 0) : 0),
        "packingNotes": pl
          ? String(pl["Notes"] ?? "").trim()
          : (hasPendingSubmission ? String(pending["Notes"] ?? "").trim() : ""),
        "existingCartons": existingCartons.map(c => {
          const out = { "Carton #": c["Carton #"] };
          PACKING_UNIT_FIELDS.forEach(f => { out[f] = toPackingQty_(c[f]) || ""; });
          out["Carton Weight"] = c["Carton Weight"] ?? "";
          return out;
        }),
      };
    });
    return { success: true, vendor, pos };
  } catch (err) {
    console.error(err.stack || err);
    return { success: false, error: "Server error." };
  }
}

/**
 * Accepts a packing list submission from a vendor.
 * Routes to direct save or pending queue based on vendorSubmitMode.
 * Accepts (sessionId, token, poNumber, ...) — tries session first, then token.
 * Called from the vendor portal HTML form.
 */
function vendorPortalSubmit(sessionId, token, poNumber, cartons, notes) {
  try {
    const auth = resolveVendorPortalAuth_(sessionId, token);
    if (!auth) return { success: false, error: "This link is no longer valid. Please reopen it from your email or contact us for a new one." };
    const vendor = auth.vendor;

    // Confirm PO belongs to this vendor
    const poSheet = getSheet();
    if (!poSheet) return { success: false, error: "POs sheet not found." };
    const rows = sheetToObjects_(poSheet, "PO #");
    const poRow = rows.find(r => poNumbersEqual_(r["PO #"], poNumber));
    if (!poRow) return { success: false, error: "PO # not found." };
    if (String(poRow["Vendor"] ?? "").trim().toLowerCase() !== vendor.toLowerCase()) {
      return { success: false, error: "You are not authorized to submit for this PO." };
    }

    const normalizedCartons = normalizePackingCartons_(cartons || []);
    if (normalizedCartons.length === 0) {
      return { success: false, error: "At least one carton is required." };
    }
    if (normalizedCartons.some(c => Number(c["Total Units"] || 0) <= 0)) {
      return { success: false, error: "Each carton must have at least one unit." };
    }

    const mode = getVendorSubmitMode_();

    if (mode === "direct") {
      const meta = { "Carton Count": normalizedCartons.length, "Notes": notes || "" };
      savePackingListCore_(poNumber, normalizedCartons, meta, {});
      return { success: true, mode: "direct", message: "Packing list submitted successfully." };
    }

    // Queue for staff review
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      const pendingSheet = getPendingPackingListsSheet_();
      const submissionId = getNextSubmissionId_(pendingSheet);
      const now = new Date();
      const headers = pendingSheet.getRange(1, 1, 1, pendingSheet.getLastColumn()).getValues()[0]
        .map(h => String(h ?? "").trim());
      const row = headers.map(h => {
        if (h === PENDING_PACKING_LIST_ID_FIELD) return submissionId;
        if (h === "PO #") return poNumber;
        if (h === "Style #") return poRow["Style #"] ?? "";
        if (h === "SO #") return poRow["SO #"] ?? "";
        if (h === "Buyer PO #") return poRow["Buyer PO #"] ?? "";
        if (h === "Buyer") return poRow["Buyer"] ?? "";
        if (h === "PO Qty") return poRow["PO Qty"] ?? "";
        if (h === "Actual Qty") return poRow["Actual Qty"] ?? "";
        if (h === "Vendor") return vendor;
        if (h === "Carton Count") return normalizedCartons.length;
        if (h === "Notes") return notes || "";
        if (h === "Cartons JSON") return JSON.stringify(normalizedCartons);
        if (h === "Status") return "Pending";
        if (h === "Submitted At") return now;
        if (h === "Reviewed At") return "";
        return "";
      });
      pendingSheet.appendRow(row);
      return { success: true, mode: "review", message: "Packing list submitted for review. We will process it shortly." };
    } finally {
      if (lock.hasLock()) lock.releaseLock();
    }
  } catch (err) {
    console.error(err.stack || err);
    return { success: false, error: "Server error. Please try again." };
  }
}

// ============================================================
// Admin doPost action handlers for the vendor portal
// ============================================================

function handleCreateVendorPortalLink(payload) {
  const vendor = String(payload.vendor ?? "").trim();
  if (!vendor) return corsResponse({ success: false, error: "Vendor is required." });
  const token = generateVendorToken_();
  const sheet = getVendorPortalTokensSheet_();
  const now = new Date();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(h => String(h ?? "").trim());
  const row = headers.map(h => {
    if (h === "Token") return token;
    if (h === "Vendor") return vendor;
    if (h === "Active") return true;
    if (h === "Created At") return now;
    if (h === "Last Used At") return "";
    return "";
  });
  sheet.appendRow(row);

  // Force the Token cell to plain-text format so Sheets never converts the
  // 64-char hex string to scientific notation or truncates it.
  const newRowIndex = sheet.getLastRow();
  const tokenCol = headers.indexOf("Token") + 1;
  if (tokenCol > 0) {
    sheet.getRange(newRowIndex, tokenCol).setNumberFormat("@");
  }

  // Build the portal URL from the staff app's configured URL when available;
  // this guarantees the link matches the deployment the staff app is using.
  let scriptUrl;
  if (payload.webAppUrl) {
    scriptUrl = String(payload.webAppUrl).split("?")[0];
  } else {
    scriptUrl = ScriptApp.getService().getUrl();
  }
  const portalUrl = scriptUrl + "?page=vendor&token=" + encodeURIComponent(token);
  return corsResponse({ success: true, token, url: portalUrl, vendor });
}

function handleSetVendorSubmitMode(payload) {
  const mode = String(payload.mode ?? "").trim();
  if (mode !== "direct" && mode !== "review") {
    return corsResponse({ success: false, error: "Mode must be 'review' or 'direct'." });
  }
  setVendorSubmitMode_(mode);
  return corsResponse({ success: true, mode });
}

function markPendingPackingListApproved_(pendingSheet, rowIndex, headers) {
  const statusCol = headers.indexOf("Status");
  const reviewedAtCol = headers.indexOf("Reviewed At");
  if (statusCol !== -1) pendingSheet.getRange(rowIndex, statusCol + 1).setValue("Approved");
  if (reviewedAtCol !== -1) pendingSheet.getRange(rowIndex, reviewedAtCol + 1).setValue(new Date());
}

function handleApprovePendingPackingList(payload) {
  const submissionId = String(payload.submissionId ?? "").trim();
  if (!submissionId) return corsResponse({ success: false, error: "Submission ID is required." });
  const skipCartonSave = payload.skipCartonSave === true;
  const pendingSheet = getPendingPackingListsSheet_();
  const rows = pendingSheet.getDataRange().getValues();
  if (rows.length < 2) return corsResponse({ success: false, error: "Submission not found." });
  const headers = rows[0].map(h => String(h ?? "").trim());
  const idCol = headers.indexOf(PENDING_PACKING_LIST_ID_FIELD);
  const statusCol = headers.indexOf("Status");
  const cartonsJsonCol = headers.indexOf("Cartons JSON");
  const poCol = headers.indexOf("PO #");
  const notesCol = headers.indexOf("Notes");
  const reviewedAtCol = headers.indexOf("Reviewed At");
  if (idCol === -1) return corsResponse({ success: false, error: "Sheet missing ID column." });
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][idCol]) !== submissionId) continue;
    if (String(rows[i][statusCol] ?? "").trim() !== "Pending") {
      return corsResponse({ success: false, error: "Submission is not in Pending status." });
    }
    if (skipCartonSave) {
      markPendingPackingListApproved_(pendingSheet, i + 1, headers);
      return corsResponse({ success: true, submissionId });
    }
    const poNumber = String(rows[i][poCol] ?? "").trim();
    const notes = String(rows[i][notesCol] ?? "").trim();
    let cartons = [];
    try { cartons = JSON.parse(rows[i][cartonsJsonCol] || "[]"); } catch (_e) {
      return corsResponse({ success: false, error: "Could not parse carton data." });
    }
    const normalizedCartons = normalizePackingCartons_(cartons);
    const meta = { "Carton Count": normalizedCartons.length, "Notes": notes };
    const result = savePackingListCore_(poNumber, normalizedCartons, meta, {});
    markPendingPackingListApproved_(pendingSheet, i + 1, headers);
    return corsResponse({ success: true, submissionId, ...result });
  }
  return corsResponse({ success: false, error: "Submission not found: " + submissionId });
}

function handleRejectPendingPackingList(payload) {
  const submissionId = String(payload.submissionId ?? "").trim();
  if (!submissionId) return corsResponse({ success: false, error: "Submission ID is required." });
  const pendingSheet = getPendingPackingListsSheet_();
  const rows = pendingSheet.getDataRange().getValues();
  if (rows.length < 2) return corsResponse({ success: false, error: "Submission not found." });
  const headers = rows[0].map(h => String(h ?? "").trim());
  const idCol = headers.indexOf(PENDING_PACKING_LIST_ID_FIELD);
  const statusCol = headers.indexOf("Status");
  const reviewedAtCol = headers.indexOf("Reviewed At");
  if (idCol === -1) return corsResponse({ success: false, error: "Sheet missing ID column." });
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][idCol]) !== submissionId) continue;
    if (statusCol !== -1) pendingSheet.getRange(i + 1, statusCol + 1).setValue("Rejected");
    if (reviewedAtCol !== -1) pendingSheet.getRange(i + 1, reviewedAtCol + 1).setValue(new Date());
    return corsResponse({ success: true, submissionId });
  }
  return corsResponse({ success: false, error: "Submission not found: " + submissionId });
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
    if (action === "resendAsnRequestEmail") return handleResendAsnRequestEmail(payload);
    if (action === "resendDeliveryRequestEmail") return handleResendDeliveryRequestEmail(payload);
    if (action === "resendPickupRequestEmail") return handleResendPickupRequestEmail(payload);
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
    if (action === "createVendorPortalLink") return handleCreateVendorPortalLink(payload);
    if (action === "setVendorSubmitMode") return handleSetVendorSubmitMode(payload);
    if (action === "approvePendingPackingList") return handleApprovePendingPackingList(payload);
    if (action === "rejectPendingPackingList") return handleRejectPendingPackingList(payload);

    return corsResponse({ success: false, error: "Unknown action: " + action });
  } catch (err) {
    return errorResponse_(err);
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}
