const SHEET_NAME = "POs";
const COLUMN_DEFAULT_KEY = "defaultVisibleColumns";

/*
  Row 1 must use these exact header names (see po-table.js COLUMNS for table display order).
  Physical column order in the sheet does NOT need to match the table — the app maps by name.

  Selected, Flag, Status, Division, Vendor, Buyer, Buyer PO #, SO #, PO Date, PO #,
  Old PO #, Style #, Color, PO Qty, Actual Qty, Ctn Qty, Ship Method, Vessel,
  House #, Shipped, ETD, EST EXF, EST IHD, EXF, ETA, IHD, CXL Date, Assign Date, Notes

  If your sheet predates the app updates, add headers for: Selected, EXF
*/

const EDITABLE_FIELDS = [
  "Selected", "Flag",
  "PO Qty", "Status", "Ship Method", "Ctn Qty",
  "Vessel", "House #", "Shipped", "ETD", "ETA", "IHD",
  "EST EXF", "EST IHD", "EXF", "CXL Date", "Assign Date", "Notes"
];

function getSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
}

function corsResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
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

function handleSaveColumnDefault(payload) {
  saveDefaultColumns_(payload.columns);
  return corsResponse({ success: true });
}

function doGet(e) {
  try {
    const sheet = getSheet();
    const rows = sheet.getDataRange().getValues();

    const headers = rows[0];
    const data = rows.slice(1).map((row, i) => {
      const obj = { _rowIndex: i + 2 };
      headers.forEach((h, j) => { obj[h] = row[j]; });
      return obj;
    });

    return corsResponse({
      success: true,
      data: data,
      defaultColumns: getDefaultColumns_(),
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

    return corsResponse({ success: false, error: "Unknown action: " + action });
  } catch (err) {
    return corsResponse({ success: false, error: err.message });
  }
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

  const sheet = getSheet();
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const poColIndex = headers.indexOf("PO #");

  if (poColIndex === -1) {
    return corsResponse({ success: false, error: "PO # column not found in sheet." });
  }

  let targetRow = -1;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][poColIndex]) === String(poNumber)) {
      targetRow = i + 1;
      break;
    }
  }

  if (targetRow === -1) {
    return corsResponse({ success: false, error: "PO # not found: " + poNumber });
  }

  Object.entries(updates).forEach(([field, value]) => {
    const colIndex = headers.indexOf(field);
    if (colIndex !== -1) {
      sheet.getRange(targetRow, colIndex + 1).setValue(value);
    }
  });

  return corsResponse({ success: true, message: "PO updated successfully." });
}
