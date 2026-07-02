/**
 * CSV import helpers for PO bulk upsert allowlist / compare logic.
 */

const IMPORT_ALLOWED_PO_FIELDS = new Set([
  "PO Date", "EST IHD", "Vendor", "N41 Status", "Division", "Ship Method",
  "SO #", "Old PO #", "Buyer", "Buyer PO #", "Style #", "Color", "Style Category",
  "PO Qty", "Received Qty", "CXL Date", "FOB Cost", "PO Total Cost",
  ...Array.from({ length: 15 }, (_, i) => `Size ${i + 1}`),
  ...Array.from({ length: 15 }, (_, i) => `PO Unit ${i + 1}`),
]);

const IMPORT_PROTECTED_PO_FIELDS = new Set([
  "Actual Qty", "Selected", "Packing List", "Status",
]);

const IMPORT_DATE_FIELDS = new Set(["PO Date", "EST IHD", "CXL Date"]);

const IMPORT_NUMERIC_FIELDS = new Set([
  "PO Qty", "Received Qty", "FOB Cost", "PO Total Cost",
  ...Array.from({ length: 15 }, (_, i) => `PO Unit ${i + 1}`),
]);

export function sanitizeCellValue(value) {
  if (typeof value !== "string") return value;
  if (/^[=+\-@\t\r]/.test(value)) return "'" + value;
  return value;
}

export function sanitizeUpdates(updates) {
  const out = {};
  for (const [field, value] of Object.entries(updates || {})) {
    out[field] = sanitizeCellValue(value);
  }
  return out;
}

function normalizeImportDivision(value) {
  const s = String(value ?? "").trim();
  if (/^elevator\s*disco$/i.test(s)) return "Elevator Disco";
  if (/^freesia$/i.test(s)) return "Freesia";
  return s;
}

function normalizeImportDateToYmd(value) {
  if (value == null || value === "") return "";
  const s = String(value).trim();
  if (!s || s === "1/1/1900" || s === "1900-01-01") return "";
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (slash) {
    const [, month, day, year] = slash;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return s;
}

function importNumericValuesEqual(existing, incoming) {
  const toNum = (v) => {
    const n = Number(String(v ?? "").replace(/[$,]/g, "").trim());
    return Number.isFinite(n) ? n : null;
  };
  return toNum(existing) === toNum(incoming);
}

function importFieldValuesEqual(field, existing, incoming) {
  if (IMPORT_DATE_FIELDS.has(field)) {
    return normalizeImportDateToYmd(existing) === normalizeImportDateToYmd(incoming);
  }
  if (IMPORT_NUMERIC_FIELDS.has(field)) {
    return importNumericValuesEqual(existing, incoming);
  }
  if (field === "Division") {
    return normalizeImportDivision(existing) === normalizeImportDivision(incoming);
  }
  return String(existing ?? "").trim() === String(incoming ?? "").trim();
}

export function pickImportUpdates(rowData) {
  const updates = {};
  for (const [field, value] of Object.entries(rowData || {})) {
    if (field === "PO #") continue;
    if (IMPORT_PROTECTED_PO_FIELDS.has(field)) continue;
    if (!IMPORT_ALLOWED_PO_FIELDS.has(field)) continue;
    updates[field] = value;
  }
  return updates;
}

export function pickChangedImportUpdates(existingData, updates) {
  const changed = {};
  for (const [field, value] of Object.entries(updates || {})) {
    const existing = existingData?.[field] ?? "";
    if (!importFieldValuesEqual(field, existing, value)) {
      changed[field] = value;
    }
  }
  return changed;
}

/** True when workflow Status is Closed (explicit Status or inferred from N41). */
export function isPoClosed(data) {
  const status = String(data?.Status ?? "").trim();
  if (status) return status === "Closed";
  return String(data?.["N41 Status"] ?? "").trim() === "Closed";
}
