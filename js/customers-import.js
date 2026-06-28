/** Customer Master CSV import. */

const CUSTOMER_CSV_TO_SHEET_MAP = {
  code: "Customer",
  addr1: "Address",
  addr2: "Line 2",
  city: "City",
  state: "State",
  zip: "Zip",
  country: "Country",
  contact1: "Contact",
  phone1: "Phone #",
  email1: "Email",
};

function mapCustomerCsvRowToSheetRow(csvRow) {
  const out = {};
  Object.entries(CUSTOMER_CSV_TO_SHEET_MAP).forEach(([csvField, sheetField]) => {
    if (!(csvField in csvRow)) return;
    const normalized = trimCsvCell(csvRow[csvField]);
    if (normalized === "") return;
    out[sheetField] = normalized;
  });

  const customerKey = trimCsvCell(out.Customer);
  if (!customerKey) return null;
  out.Customer = customerKey;
  return out;
}

function dedupeCustomerImportRows(rows) {
  const byCustomer = new Map();
  rows.forEach(row => {
    if (row?.Customer) byCustomer.set(String(row.Customer), row);
  });
  return Array.from(byCustomer.values());
}

function customerImportFieldValuesEqual(field, existing, incoming) {
  return compareTextFieldValues(existing, incoming) === 0;
}

function customerImportRowDiffersFromExisting(importRow, existingRow) {
  return Object.entries(importRow).some(([field, value]) => {
    if (field === "Customer") return false;
    return !customerImportFieldValuesEqual(field, existingRow?.[field], value);
  });
}

function partitionCustomerImportRows(rows, existingRowsByCustomer) {
  const newRows = [];
  const changedRows = [];
  rows.forEach(row => {
    const customerKey = String(row.Customer ?? "").trim();
    if (!customerKey) return;
    const existingRow = existingRowsByCustomer.get(customerKey);
    if (!existingRow) newRows.push(row);
    else if (customerImportRowDiffersFromExisting(row, existingRow)) changedRows.push(row);
  });
  return { newRows, changedRows };
}

async function importCustomerCsvRowsToSheet(rows) {
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const errors = [];
  const insertedCustomers = [];
  const updatedCustomers = [];
  const batchCount = Math.ceil(rows.length / CSV_IMPORT_BATCH_SIZE);

  for (let i = 0; i < rows.length; i += CSV_IMPORT_BATCH_SIZE) {
    const batchIndex = Math.floor(i / CSV_IMPORT_BATCH_SIZE) + 1;
    setAppSaving(true, `Importing customers… batch ${batchIndex}/${batchCount}`);

    const batch = rows.slice(i, i + CSV_IMPORT_BATCH_SIZE);
    const json = (typeof isApiMode === "function" && isApiMode())
      ? await postApi("/api/customers/bulk-upsert", { rows: batch })
      : await postAppsScript({ action: "bulkUpsertCustomers", rows: batch });
    if (!json.success) throw new Error(json.error || "Import batch failed");
    inserted += json.inserted || 0;
    updated += json.updated || 0;
    skipped += json.skipped || 0;
    if (Array.isArray(json.insertedCustomers)) insertedCustomers.push(...json.insertedCustomers);
    if (Array.isArray(json.updatedCustomers)) updatedCustomers.push(...json.updatedCustomers);
    if (Array.isArray(json.errors)) errors.push(...json.errors);
  }

  return {
    inserted,
    updated,
    skipped,
    errors,
    insertedCustomers: dedupeCustomerKeys(insertedCustomers),
    updatedCustomers: dedupeCustomerKeys(updatedCustomers),
  };
}

function dedupeCustomerKeys(keys) {
  return [...new Set(keys.map(key => String(key).trim()).filter(Boolean))];
}

function sortCustomerKeysForDisplay(keys) {
  return [...keys].sort((a, b) => compareTextFieldValues(a, b));
}

function renderCustomerImportList(listEl, keys) {
  if (!listEl) return;
  listEl.replaceChildren();
  if (!keys.length) {
    const item = document.createElement("li");
    item.className = "csv-import-summary-empty";
    item.textContent = "None";
    listEl.appendChild(item);
    return;
  }
  sortCustomerKeysForDisplay(keys).forEach(key => {
    const item = document.createElement("li");
    item.textContent = key;
    listEl.appendChild(item);
  });
}

function showCustomerImportSummary(result, skippedInFile = 0) {
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
    addedHeading.textContent = `Added customers (${result.insertedCustomers.length})`;
  }
  if (updatedHeading) {
    updatedHeading.textContent = `Updated customers (${result.updatedCustomers.length})`;
  }
  renderCustomerImportList(addedList, result.insertedCustomers);
  renderCustomerImportList(updatedList, result.updatedCustomers);
  overlay.classList.add("open");
}

async function handleCustomerCsvImportFile(file) {
  if (!file) return;
  if (isAppSaving()) return;

  if (isDemoMode()) {
    showIndicator("CSV import is not available in demo mode", "error");
    return;
  }

  closeHeaderMenu();
  setAppSaving(true, "Importing customers…");

  try {
    const text = await file.text();
    const csvRows = parseCsvText(text);
    const csvObjects = csvRowsToObjects(csvRows);
    const mapped = csvObjects.map(mapCustomerCsvRowToSheetRow).filter(Boolean);
    const rows = dedupeCustomerImportRows(mapped);
    const skippedInFile = csvObjects.length - rows.length;

    if (rows.length === 0) {
      showIndicator("No valid customer rows found in CSV", "error");
      return;
    }

    const existingRowsByCustomer = new Map(
      allCustomers.map(row => [String(row.Customer ?? "").trim(), row]).filter(([key]) => key)
    );

    const { newRows, changedRows } = partitionCustomerImportRows(rows, existingRowsByCustomer);
    const rowsToSend = [...newRows, ...changedRows];

    let result;
    if (rowsToSend.length === 0) {
      result = {
        inserted: 0,
        updated: 0,
        skipped: 0,
        errors: [],
        insertedCustomers: [],
        updatedCustomers: [],
      };
    } else {
      result = await importCustomerCsvRowsToSheet(rowsToSend);
      result.inserted = newRows.length;
      result.updated = changedRows.length;
      result.insertedCustomers = dedupeCustomerKeys(newRows.map(row => row.Customer));
      result.updatedCustomers = dedupeCustomerKeys(changedRows.map(row => row.Customer));
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
    showCustomerImportSummary(result, skippedInFile);
  } catch (err) {
    showIndicator("Import failed: " + err.message, "error");
  } finally {
    setAppSaving(false);
  }
}
