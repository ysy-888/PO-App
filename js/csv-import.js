function trimCsvCell(value) {
  return String(value ?? "").trim();
}

function parseCsvDateToYmd(value) {
  const s = trimCsvCell(value);
  if (!s || s === "1/1/1900" || s === "1900-01-01") return "";
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (slash) {
    const [, month, day, year] = slash;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return normalizeToYmd(s) || s;
}

function parseCsvText(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (c === '"' && next === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\r" && next === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
    } else if (c === "\n" || c === "\r") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function csvRowsToObjects(csvRows) {
  if (!csvRows.length) return [];
  const headers = csvRows[0].map(h => trimCsvCell(h));
  return csvRows.slice(1)
    .filter(cells => cells.some(cell => trimCsvCell(cell) !== ""))
    .map(cells => {
      const obj = {};
      headers.forEach((header, index) => {
        if (header) obj[header] = cells[index] ?? "";
      });
      return obj;
    });
}

function normalizeCsvImportValue(sheetField, value) {
  if (CSV_IMPORT_DATE_FIELDS.has(sheetField)) {
    return parseCsvDateToYmd(value);
  }
  if (sheetField.startsWith("PO Unit ") || sheetField === "PO Qty" || sheetField === "Received Qty") {
    const n = Number(trimCsvCell(value));
    return Number.isFinite(n) ? n : "";
  }
  if (sheetField === "FOB Cost" || sheetField === "PO Total Cost") {
    const n = Number(trimCsvCell(value));
    return Number.isFinite(n) ? n : "";
  }
  if (sheetField.startsWith("Size ")) {
    return trimCsvCell(value);
  }
  return trimCsvCell(value);
}

function mapCsvRowToSheetRow(csvRow) {
  const out = {};
  Object.entries(CSV_TO_SHEET_MAP).forEach(([csvField, sheetField]) => {
    if (!(csvField in csvRow)) return;
    const normalized = normalizeCsvImportValue(sheetField, csvRow[csvField]);
    if (normalized === "" && !sheetField.startsWith("Size ")) return;
    if (sheetField.startsWith("Size ") && normalized === "") return;
    out[sheetField] = normalized;
  });

  const poNumber = trimCsvCell(out["PO #"]);
  if (!poNumber) return null;
  out["PO #"] = poNumber;

  if (hasUnitFieldValues(out, PO_UNIT_FIELDS)) {
    out["PO Qty"] = computePoQtyFromUnits(out);
  }

  return out;
}

function dedupeImportRows(rows) {
  const byPo = new Map();
  rows.forEach(row => {
    if (row?.["PO #"]) byPo.set(String(row["PO #"]), row);
  });
  return Array.from(byPo.values());
}

function partitionImportRows(rows, existingRowsByPo) {
  const newRows = [];
  const changedRows = [];
  rows.forEach(row => {
    const poNumber = String(row["PO #"] ?? "").trim();
    if (!poNumber) return;
    const existingRow = existingRowsByPo.get(poNumber);
    if (!existingRow) newRows.push(row);
    else if (csvImportRowDiffersFromExisting(row, existingRow)) changedRows.push(row);
  });
  return { newRows, changedRows };
}

async function importCsvRowsToSheet(rows) {
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const errors = [];
  const insertedPoNumbers = [];
  const updatedPoNumbers = [];
  const batchCount = Math.ceil(rows.length / CSV_IMPORT_BATCH_SIZE);

  for (let i = 0; i < rows.length; i += CSV_IMPORT_BATCH_SIZE) {
    const batchIndex = Math.floor(i / CSV_IMPORT_BATCH_SIZE) + 1;
    setAppSaving(true, `Importing CSV… batch ${batchIndex}/${batchCount}`);

    const batch = rows.slice(i, i + CSV_IMPORT_BATCH_SIZE);
    const json = await postAppsScript({ action: "bulkUpsertPos", rows: batch });
    if (!json.success) throw new Error(json.error || "Import batch failed");
    inserted += json.inserted || 0;
    updated += json.updated || 0;
    skipped += json.skipped || 0;
    if (Array.isArray(json.insertedPoNumbers)) insertedPoNumbers.push(...json.insertedPoNumbers);
    if (Array.isArray(json.updatedPoNumbers)) updatedPoNumbers.push(...json.updatedPoNumbers);
    if (Array.isArray(json.errors)) errors.push(...json.errors);
  }

  return {
    inserted,
    updated,
    skipped,
    errors,
    insertedPoNumbers: dedupePoNumbers(insertedPoNumbers),
    updatedPoNumbers: dedupePoNumbers(updatedPoNumbers),
  };
}

function dedupePoNumbers(poNumbers) {
  return [...new Set(poNumbers.map(po => String(po).trim()).filter(Boolean))];
}

function csvImportNumericValuesEqual(existing, incoming) {
  const toCompareNumber = value => {
    if (value == null || value === "") return 0;
    const n = Number(value);
    return Number.isFinite(n) ? n : NaN;
  };
  const a = toCompareNumber(existing);
  const b = toCompareNumber(incoming);
  if (Number.isFinite(a) && Number.isFinite(b)) return a === b;
  return compareTextFieldValues(existing, incoming) === 0;
}

function normalizeImportCompareDate(value) {
  if (isEmptyValue(value)) return "";
  return parseCsvDateToYmd(value) || normalizeToYmd(value) || trimCsvCell(value);
}

function csvImportFieldValuesEqual(field, existing, incoming) {
  if (CSV_IMPORT_DATE_FIELDS.has(field)) {
    return normalizeImportCompareDate(existing) === normalizeImportCompareDate(incoming);
  }
  if (
    field.startsWith("PO Unit ") ||
    field === "PO Qty" ||
    field === "Received Qty" ||
    field === "FOB Cost" ||
    field === "PO Total Cost"
  ) {
    return csvImportNumericValuesEqual(existing, incoming);
  }
  if (field === "Division") {
    return normalizeDivision(existing) === normalizeDivision(incoming);
  }
  return compareTextFieldValues(existing, incoming) === 0;
}

function csvImportRowDiffersFromExisting(importRow, existingRow) {
  return Object.entries(importRow).some(([field, value]) => {
    if (field === "PO #") return false;
    return !csvImportFieldValuesEqual(field, existingRow?.[field], value);
  });
}

function sortPoNumbersForDisplay(poNumbers) {
  return [...poNumbers].sort((a, b) =>
    compareTextFieldValues(a, b)
  );
}

function renderCsvImportPoList(listEl, poNumbers) {
  if (!listEl) return;
  listEl.replaceChildren();
  if (!poNumbers.length) {
    const item = document.createElement("li");
    item.className = "csv-import-summary-empty";
    item.textContent = "None";
    listEl.appendChild(item);
    return;
  }
  sortPoNumbersForDisplay(poNumbers).forEach(poNumber => {
    const item = document.createElement("li");
    item.textContent = poNumber;
    listEl.appendChild(item);
  });
}

function showCsvImportSummary(result, skippedInFile = 0) {
  const overlay = document.getElementById("csvImportSummaryOverlay");
  const statsEl = document.getElementById("csvImportSummaryStats");
  const addedHeading = document.getElementById("csvImportSummaryAddedHeading");
  const updatedHeading = document.getElementById("csvImportSummaryUpdatedHeading");
  const addedList = document.getElementById("csvImportSummaryAddedList");
  const updatedList = document.getElementById("csvImportSummaryUpdatedList");
  if (!overlay || !statsEl) return;

  const skippedTotal = (result.skipped || 0) + skippedInFile;
  const statParts = [
    `${result.inserted} added`,
    `${result.updated} updated`,
  ];
  if (skippedTotal > 0) statParts.push(`${skippedTotal} skipped`);
  if (result.errors.length > 0) statParts.push(`${result.errors.length} errors`);

  statsEl.textContent = statParts.join(", ");
  if (addedHeading) {
    addedHeading.textContent = `Added POs (${result.insertedPoNumbers.length})`;
  }
  if (updatedHeading) {
    updatedHeading.textContent = `Updated POs (${result.updatedPoNumbers.length})`;
  }
  renderCsvImportPoList(addedList, result.insertedPoNumbers);
  renderCsvImportPoList(updatedList, result.updatedPoNumbers);
  overlay.classList.add("open");
}

function closeCsvImportSummary(event) {
  if (isDirectBackdropClick(event, document.getElementById("csvImportSummaryOverlay"))) {
    document.getElementById("csvImportSummaryOverlay")?.classList.remove("open");
  }
}

function initCsvImportSummary() {
  const overlay = document.getElementById("csvImportSummaryOverlay");
  const closeBtn = document.getElementById("csvImportSummaryCloseBtn");
  const okBtn = document.getElementById("csvImportSummaryOkBtn");
  if (!overlay) return;

  const dismiss = () => overlay.classList.remove("open");
  closeBtn?.addEventListener("click", dismiss);
  okBtn?.addEventListener("click", async () => {
    dismiss();
    await loadData();
  });
  bindDirectBackdropDismiss(overlay, dismiss);
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && overlay.classList.contains("open")) dismiss();
  });
}

async function handleCsvImportFile(file) {
  if (!file) return;
  if (isAppSaving()) return;

  if (typeof currentAppView !== "undefined" && currentAppView === "customers") {
    if (typeof handleCustomerCsvImportFile === "function") {
      await handleCustomerCsvImportFile(file);
    }
    return;
  }

  if (isDemoMode()) {
    showIndicator("CSV import is not available in demo mode", "error");
    return;
  }

  closeHeaderMenu();
  setAppSaving(true, "Importing CSV…");

  try {
    const text = await file.text();
    const csvRows = parseCsvText(text);
    const csvObjects = csvRowsToObjects(csvRows);
    const mapped = csvObjects.map(mapCsvRowToSheetRow).filter(Boolean);
    const rows = dedupeImportRows(mapped);
    const skippedInFile = csvObjects.length - rows.length;

    if (rows.length === 0) {
      showIndicator("No valid PO rows found in CSV", "error");
      return;
    }

    const existingRowsByPo = new Map(
      allRows.map(row => [String(row["PO #"] ?? "").trim(), row]).filter(([po]) => po)
    );

    const { newRows, changedRows } = partitionImportRows(rows, existingRowsByPo);
    const rowsToSend = [...newRows, ...changedRows];

    let result;
    if (rowsToSend.length === 0) {
      result = {
        inserted: 0,
        updated: 0,
        skipped: 0,
        errors: [],
        insertedPoNumbers: [],
        updatedPoNumbers: [],
      };
    } else {
      result = await importCsvRowsToSheet(rowsToSend);
      result.inserted = newRows.length;
      result.updated = changedRows.length;
      result.insertedPoNumbers = dedupePoNumbers(newRows.map(row => row["PO #"]));
      result.updatedPoNumbers = dedupePoNumbers(changedRows.map(row => row["PO #"]));
    }
    setAppSaving(false);

    const parts = [
      `${result.inserted} added`,
      `${result.updated} updated`,
    ];
    const skippedTotal = result.skipped + skippedInFile;
    if (skippedTotal > 0) parts.push(`${skippedTotal} skipped`);
    if (result.errors.length > 0) parts.push(`${result.errors.length} errors`);

    if (result.inserted === 0 && result.updated === 0 && result.errors.length === 0) {
      showIndicator("Import complete: no changes", "success");
      return;
    }

    showIndicator(`Import complete: ${parts.join(", ")}`, result.errors.length ? "error" : "success");
    showCsvImportSummary(result, skippedInFile);
  } catch (err) {
    showIndicator("Import failed: " + err.message, "error");
  } finally {
    setAppSaving(false);
  }
}

function initCsvImport() {
  const menuBtn = document.getElementById("headerMenuImportCsv");
  const fileInput = document.getElementById("csvImportInput");
  if (!menuBtn || !fileInput) return;

  menuBtn.addEventListener("click", e => {
    e.stopPropagation();
    closeHeaderMenu();
    fileInput.value = "";
    fileInput.click();
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (file) handleCsvImportFile(file);
    fileInput.value = "";
  });
}
