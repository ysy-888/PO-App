/**
 * Invoice helpers — entity keys and data builders.
 */

export function invoiceEntityId(invoiceNo) {
  return String(invoiceNo ?? "").trim();
}

const INVOICE_FIELDS = [
  "Invoice #",
  "Status",
  "INV DATE",
  "Customer",
  "Subtotal",
  "Discount",
  "Freight",
  "Total",
  "Received",
  "Balance",
  "Pick #",
  "Tracking #",
  "SO #",
  "Unit Qty",
  "Memo",
  "House Memo",
  "Sales Commission",
];

/**
 * Build the JSONB data object for an Invoice document (flat, no Lines).
 */
export function buildInvoiceData(raw) {
  const result = {};
  INVOICE_FIELDS.forEach(field => {
    result[field] = String(raw?.[field] ?? "").trim();
  });
  return result;
}

/**
 * Returns true when the two stored documents are identical.
 */
export function invoiceValuesEqual(existing, incoming) {
  for (const field of INVOICE_FIELDS) {
    if (String(existing?.[field] ?? "").trim() !== String(incoming?.[field] ?? "").trim()) {
      return false;
    }
  }
  return true;
}
