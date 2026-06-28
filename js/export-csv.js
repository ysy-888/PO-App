/** Client-side CSV export for all four app views. */

// ---------------------------------------------------------------------------
// Core CSV helpers
// ---------------------------------------------------------------------------

function csvEscapeValue(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  // Collapse the em-dash empty-display placeholder to a plain empty cell
  if (s === EMPTY_DISPLAY) return "";
  // Wrap in quotes if the value contains special CSV characters
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function buildCsvContent(headers, rows) {
  const lines = [headers.map(csvEscapeValue).join(",")];
  rows.forEach(rowValues => {
    lines.push(rowValues.map(csvEscapeValue).join(","));
  });
  // UTF-8 BOM so Excel opens the file correctly
  return "\uFEFF" + lines.join("\r\n");
}

function downloadCsv(filename, content) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function getTodayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ---------------------------------------------------------------------------
// Per-view row collectors
// ---------------------------------------------------------------------------

/** Purchase Orders: visible columns in current order, all filtered rows. */
function getPoExportData() {
  const exportCols = getColumnOrder().filter(
    col => visibleColumns.has(col) && !UI_ONLY_COLS.has(col)
  );
  const headers = exportCols.map(getColumnLabel);
  const rows = filteredRows.map(row => {
    return exportCols.map(col => {
      if (col === "Status") return getRowWorkflowStatus(row) || "";
      if (col === "EXF Requested") return isTruthy(row[col]) ? "Yes" : "";
      const raw = getColumnFilterRawValue(col, row);
      if (DATE_FIELDS.has(col)) {
        const display = formatDateForDisplay(raw);
        return display === EMPTY_DISPLAY ? "" : display;
      }
      if (raw === null || raw === undefined) return "";
      const s = String(raw);
      return s === EMPTY_DISPLAY ? "" : s;
    });
  });
  return { headers, rows };
}

/** Shipments: all SHIPMENT_TABLE_COLUMNS, full Notes (no truncation). */
function getShipmentsExportData() {
  const headers = SHIPMENT_TABLE_COLUMNS.slice();
  const rows = filteredShipments.map(shipment => {
    return SHIPMENT_TABLE_COLUMNS.map(col => {
      if (col === "PO Count") return String(countPosForShipment(shipment[SHIPMENT_ID_FIELD]));
      const val = shipment[col] ?? "";
      if (SHIPMENT_DATE_FIELDS.has(col)) {
        const display = formatDateForDisplay(val);
        return display === EMPTY_DISPLAY ? "" : display;
      }
      if (isEmptyValue(val)) return "";
      return String(val);
    });
  });
  return { headers, rows };
}

/** Requests: active sub-tab only, drops Action column, full Notes. */
function getRequestsExportData() {
  let cols, filtered, formatFn, labelMap = {};

  if (currentRequestType === "approval") {
    cols = APPROVAL_REQUEST_TABLE_COLUMNS.filter(c => c !== "Action");
    filtered = filteredApprovals;
    formatFn = formatApprovalRequestTableCell;
  } else if (currentRequestType === "exf") {
    cols = EXF_REQUEST_TABLE_COLUMNS.filter(c => c !== "Action");
    filtered = filteredExfRequests;
    formatFn = formatExfRequestTableCell;
    labelMap = EXF_REQUEST_TABLE_COLUMN_LABELS;
  } else if (currentRequestType === "asn") {
    cols = ASN_REQUEST_TABLE_COLUMNS.filter(c => c !== "Action");
    filtered = filteredAsnRequests;
    formatFn = formatAsnRequestTableCell;
    labelMap = ASN_REQUEST_TABLE_COLUMN_LABELS;
  } else if (currentRequestType === "delivery") {
    cols = DELIVERY_REQUEST_TABLE_COLUMNS.filter(c => c !== "Action");
    filtered = filteredDeliveryRequests;
    formatFn = formatDeliveryRequestTableCell;
  } else if (currentRequestType === "pickup") {
    cols = PICKUP_REQUEST_TABLE_COLUMNS.filter(c => c !== "Action");
    filtered = filteredPickupRequests;
    formatFn = formatPickupRequestTableCell;
  } else {
    return { headers: [], rows: [] };
  }

  const headers = cols.map(col => labelMap[col] ?? col);
  const rows = filtered.map(request => {
    return cols.map(col => {
      const display = formatFn(col, request);
      return display === EMPTY_DISPLAY ? "" : display;
    });
  });
  return { headers, rows };
}

/** Customers: display columns only (no action column). */
function getCustomersExportData() {
  const headers = typeof CUSTOMER_DISPLAY_COLUMNS !== "undefined"
    ? CUSTOMER_DISPLAY_COLUMNS.slice()
    : [];
  const rows = (typeof filteredCustomers !== "undefined" ? filteredCustomers : []).map(row => {
    return headers.map(col => {
      const val = row[col] ?? "";
      if (isEmptyValue(val)) return "";
      return String(val);
    });
  });
  return { headers, rows };
}

/** Chargebacks: CHARGEBACK_TABLE_COLUMNS, full Notes. */
function getChargebacksExportData() {
  const headers = CHARGEBACK_TABLE_COLUMNS.slice();
  const rows = filteredChargebacks.map(chargeback => {
    return CHARGEBACK_TABLE_COLUMNS.map(col => {
      const val = getChargebackTableValue(chargeback, col);
      if (CHARGEBACK_AMOUNT_FIELDS.has(col)) {
        const formatted = formatChargebackAmount(val);
        return formatted === EMPTY_DISPLAY ? "" : formatted;
      }
      if (CHARGEBACK_DATE_FIELDS.has(col)) {
        const display = formatDateForDisplay(val);
        return display === EMPTY_DISPLAY ? "" : display;
      }
      if (isEmptyValue(val)) return "";
      return String(val);
    });
  });
  return { headers, rows };
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

function exportCurrentViewCsv() {
  const today = getTodayYmd();
  let data, filename;

  switch (currentAppView) {
    case "po":
      data = getPoExportData();
      filename = `purchase-orders_${today}.csv`;
      break;
    case "shipments":
      data = getShipmentsExportData();
      filename = `shipments_${today}.csv`;
      break;
    case "requests":
      data = getRequestsExportData();
      filename = `${currentRequestType}-requests_${today}.csv`;
      break;
    case "chargebacks":
      data = getChargebacksExportData();
      filename = `chargebacks_${today}.csv`;
      break;
    case "customers":
      data = getCustomersExportData();
      filename = `customers_${today}.csv`;
      break;
    default:
      return;
  }

  if (!data || data.rows.length === 0) {
    showIndicator("Nothing to export", "error");
    return;
  }

  const content = buildCsvContent(data.headers, data.rows);
  downloadCsv(filename, content);
  showIndicator(`Exported ${data.rows.length} row${data.rows.length === 1 ? "" : "s"}`, "success");
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

function initCsvExport() {
  document.getElementById("headerMenuExportCsv")?.addEventListener("click", e => {
    e.stopPropagation();
    closeHeaderMenu();
    exportCurrentViewCsv();
  });
}

initCsvExport();
