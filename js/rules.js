const STYLE_PHOTO_FIELDS = ["Style Photo 1", "Style Photo 2"];

/** Convert share links (Google Drive, Dropbox) into URLs browsers can load in img tags. */
function normalizeStylePhotoUrl(url) {
  let s = String(url ?? "").trim();
  if (!s) return "";
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }

  const driveFileMatch = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i.exec(s);
  if (driveFileMatch) {
    return `https://drive.google.com/thumbnail?id=${driveFileMatch[1]}&sz=w1000`;
  }
  const driveOpenMatch = /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/i.exec(s);
  if (driveOpenMatch) {
    return `https://drive.google.com/thumbnail?id=${driveOpenMatch[1]}&sz=w1000`;
  }
  const driveUcMatch = /drive\.google\.com\/uc(?:\?[^#]*)?[&?]id=([a-zA-Z0-9_-]+)/i.exec(s);
  if (driveUcMatch) {
    return `https://drive.google.com/thumbnail?id=${driveUcMatch[1]}&sz=w1000`;
  }
  if (/dropbox\.com/i.test(s) && !/[?&](?:raw=1|dl=1)(?:&|$)/i.test(s)) {
    const base = s.replace(/[?&]dl=0(?:&|$)/, "").replace(/[?&]$/, "");
    return `${base}${base.includes("?") ? "&" : "?"}raw=1`;
  }
  return s;
}

const EDITABLE = new Set([
  "Flag",
  "Status","N41 Status","Ship Method",
  "IHD","EST EXF","CXL Date","Assign Date","Notes",
  "FOB Cost","Price","PO Total Cost","OG","PROTO","FIT/PP","BULK","TOP","TRIM",
  "Received Qty",
]);

/** Set on PO sheet; values come from the linked shipment. */
const SHIPMENT_MANAGED_PO_FIELDS = new Set([
  "Vessel", "House #", "EXF", "Shipped", "ETD", "ETA", "IHD",
]);

function isPoFieldEditable(col, row) {
  if (!EDITABLE.has(col)) return false;
  if (SHIPMENT_MANAGED_PO_FIELDS.has(col)) return false;
  if (col === "Ship Method" && typeof poHasShipment === "function" && poHasShipment(row)) {
    return false;
  }
  if (col === "Status" && typeof isStatusManuallyEditable === "function" && !isStatusManuallyEditable(row)) {
    return false;
  }
  if (col === "Assign Date") {
    const pickupId = String(row[PICKUP_REQUEST_ID_FIELD] ?? "").trim();
    if (pickupId) return false;
  }
  return true;
}

const READONLY_NO_SELECT_COLS = new Set(["Division", "PO Date", "Vendor"]);

const COPY_ON_CLICK_COLS = new Set([
  "Buyer", "Buyer PO #", "SO #", "PO #", "Old PO #", "Style #", "Color",
]);

const MODAL_FIELD_SIZE = {
  short: new Set([
    "PO #", "Old PO #", "SO #",
    "PO Qty", "Actual Qty", "Ctn Qty", "Received Qty",
    "FOB Cost", "Price", "PO Total Cost",
    "PO Date", "Shipped", "ETD", "ETA", "IHD",
    "EST EXF", "EST IHD", "EXF", "CXL Date", "Assign Date",
  ]),
  medium: new Set([
    "Division", "Buyer PO #", "Status", "N41 Status", "Vendor", "Buyer", "Flag",
    "Vessel", "House #", "Ship Method",
    "Style #", "Color", "Style Category",
    "OG", "PROTO", "FIT/PP", "BULK", "TOP", "TRIM",
  ]),
  long: new Set(["Notes", "EXF Memo"]),
};

function getModalFieldSize(col) {
  if (MODAL_FIELD_SIZE.long.has(col)) return "long";
  if (MODAL_FIELD_SIZE.short.has(col)) return "short";
  if (MODAL_FIELD_SIZE.medium.has(col)) return "medium";
  return "medium";
}

const MODAL_ORDER_INFO_ROWS = [
  ["Status", "N41 Status", "Division"],
  ["Buyer", "Vendor"],
  ["Buyer PO #", "SO #", "Old PO #"],
];

const MODAL_PRODUCTION_ROWS = [
  ["OG", "PROTO", "FIT/PP", "BULK", "TOP", "TRIM"],
];

/** Number of size-breakdown unit slots stored per PO and packing list (max 15). */
const QTY_UNIT_COUNT = 15;

/** Per-row size label fields imported from CSV (size1..size15). */
const SIZE_FIELDS = Array.from({ length: QTY_UNIT_COUNT }, (_, i) => `Size ${i + 1}`);

const PO_UNIT_FIELDS = Array.from({ length: QTY_UNIT_COUNT }, (_, i) => `PO Unit ${i + 1}`);

/** Returns the non-empty size labels for a given row, derived from Size 1..15 fields. */
function getSizeLabelsFromRow(row) {
  return SIZE_FIELDS.map(f => String(row[f] ?? "").trim()).filter(s => s !== "");
}

function toQtyNumber(val) {
  const n = Number(String(val ?? "").trim());
  return Number.isFinite(n) ? n : 0;
}

/** Block scientific-notation keys on type=number inputs (browsers allow e/E by default). */
function bindNumberInput(input) {
  input.addEventListener("keydown", e => {
    if (e.key === "e" || e.key === "E") e.preventDefault();
  });
  input.addEventListener("beforeinput", e => {
    if (e.data && /[eE]/.test(e.data)) e.preventDefault();
  });
}

function sumUnitFields(row, fields) {
  return fields.reduce((sum, field) => sum + toQtyNumber(row[field]), 0);
}

function hasUnitFieldValues(row, fields) {
  return fields.some(field => !isEmptyValue(row[field]));
}

function computePoQtyFromUnits(row) {
  return sumUnitFields(row, PO_UNIT_FIELDS);
}

function computeQtyVariancePercent(poQty, actualQty) {
  const po = toQtyNumber(poQty);
  const actual = toQtyNumber(actualQty);
  if (po <= 0) return null;
  return Math.abs(actual - po) / po * 100;
}

function formatQtyVariancePercent(value) {
  if (!Number.isFinite(value)) return EMPTY_DISPLAY;
  return `${Math.round(value)}%`;
}

/** Mirror apps-script.gs EDITABLE_FIELDS for PO update payloads. */
const APPS_SCRIPT_EDITABLE_PO_FIELDS = new Set([
  "Flag",
  "PO Qty", "Status", "N41 Status", "Ship Method",
  "Vessel", "House #", "Shipped", "ETD", "ETA", "IHD",
  "EST EXF", "EST IHD", "EXF", "CXL Date", "Assign Date", "Notes",
  "EXF Requested", "EXF Date", "EXF Req Date", "EXF Request Date", "EXF Memo",
  "ASN Requested", "ASN Date", "ASN Req Date", "ASN Request ID",
  "Delivery Requested", "Delivery Date", "Delivery Req Date", "Delivery Request ID",
  "Pickup Requested", "Pickup Date", "Pickup Req Date", "Pickup Request ID",
  "FOB Cost", "Price", "PO Total Cost",
  "Received Qty", "Style Category",
  "OG", "PROTO", "FIT/PP", "BULK", "TOP", "TRIM",
  ...PO_UNIT_FIELDS,
]);

function filterAppsScriptPoUpdates(updates) {
  return Object.fromEntries(
    Object.entries(updates || {}).filter(([field]) => APPS_SCRIPT_EDITABLE_PO_FIELDS.has(field))
  );
}

function buildPackingPoUpdatesFromCartons(cartons, cartonCount) {
  const totals = computePackingTotalsByUnit(cartons);
  const out = {
    "Has Packing List": true,
    "Ctn Qty": cartonCount,
    "Actual Qty": totals.reduce((sum, qty) => sum + qty, 0),
  };
  totals.forEach((qty, index) => {
    out[`Act Unit ${index + 1}`] = qty || "";
  });
  return out;
}

/** Keep the PO Qty total in sync with its per-size unit fields. */
function syncQtyTotalsForRow(row) {
  if (!row) return row;
  if (hasUnitFieldValues(row, PO_UNIT_FIELDS)) {
    row["PO Qty"] = computePoQtyFromUnits(row);
  }
  return row;
}

function syncAllQtyTotals(rows) {
  rows.forEach(syncQtyTotalsForRow);
}
