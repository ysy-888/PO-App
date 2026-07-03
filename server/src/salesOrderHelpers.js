/**
 * Sales Order helpers — entity keys and data builders.
 */

export function salesOrderEntityId(orderNo) {
  const id = String(orderNo ?? "").trim();
  return id;
}

function normalizeDivision(value) {
  const s = String(value ?? "").trim();
  if (/^elevator\s*disco$/i.test(s)) return "Elevator Disco";
  if (/^freesia$/i.test(s)) return "Freesia";
  return s;
}

/**
 * Build the JSONB data object for a Sales Order document.
 * raw.Lines is an array of style line objects; all other fields are header-level.
 */
export function buildSalesOrderData(raw) {
  const {
    "SO #": soNum,
    Customer,
    "Customer PO #": customerPo,
    Division,
    "Order Date": orderDate,
    "Ship Date": shipDate,
    "CXL Date": cxlDate,
    Store,
    "N41 Status": n41Status,
    "Order Type": orderType,
    "Customer Type": customerType,
    Lines,
  } = raw || {};

  return {
    "SO #": String(soNum ?? "").trim(),
    Customer: String(Customer ?? "").trim(),
    "Customer PO #": String(customerPo ?? "").trim(),
    Division: normalizeDivision(Division),
    "Order Date": String(orderDate ?? "").trim(),
    "Ship Date": String(shipDate ?? "").trim(),
    "CXL Date": String(cxlDate ?? "").trim(),
    Store: String(Store ?? "").trim(),
    "N41 Status": String(n41Status ?? "").trim(),
    "Order Type": String(orderType ?? "").trim(),
    "Customer Type": String(customerType ?? "").trim(),
    Lines: Array.isArray(Lines) ? Lines : [],
  };
}

const HEADER_FIELDS = [
  "SO #", "Customer", "Customer PO #", "Division", "Order Date", "Ship Date",
  "CXL Date", "Store", "N41 Status", "Order Type", "Customer Type",
];

/**
 * Returns true when the two stored documents are identical.
 * Compares header fields individually and Lines array via JSON.
 */
export function salesOrderValuesEqual(existing, incoming) {
  for (const field of HEADER_FIELDS) {
    if (String(existing?.[field] ?? "").trim() !== String(incoming?.[field] ?? "").trim()) {
      return false;
    }
  }
  // Deep-compare Lines via JSON (order-insensitive is not needed; N41 order is stable).
  return JSON.stringify(existing?.Lines ?? []) === JSON.stringify(incoming?.Lines ?? []);
}
