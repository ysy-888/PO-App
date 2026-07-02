/** Style Master CSV import (N41 export). */

const STYLE_CSV_TO_SHEET_MAP = {
  style: "Style #",
  color: "Color",
  sizeCat: "Size Cat",
  category: "Style Category",
  descript: "Description",
  cost: "FOB Cost",
  division: "Division",
};

function buildStyleRowFromMappedFields(out) {
  const styleNum = trimCsvCell(out["Style #"]);
  const color = trimCsvCell(out.Color);
  if (!styleNum || !color) return null;
  out["Style #"] = styleNum;
  out.Color = color;

  const sizeCat = trimCsvCell(out["Size Cat"]);
  if (sizeCat) {
    out["Size Cat"] = sizeCat;
    const labels = expandSizeCatToLabels(sizeCat);
    applySizeLabelsToDataRow(out, labels);
  }
  return out;
}

function mapStyleCsvRowToSheetRow(csvRow) {
  const out = {};
  Object.entries(STYLE_CSV_TO_SHEET_MAP).forEach(([csvField, sheetField]) => {
    if (!(csvField in csvRow)) return;
    const normalized = trimCsvCell(csvRow[csvField]);
    if (normalized === "") return;
    out[sheetField] = normalized;
  });
  return buildStyleRowFromMappedFields(out);
}

function getStyleImportKey(row) {
  const style = String(row?.["Style #"] ?? "").trim();
  const color = String(row?.Color ?? "").trim();
  if (!style || !color) return "";
  return `${style}|${color}`;
}

function dedupeStyleImportRows(rows) {
  const byKey = new Map();
  rows.forEach(row => {
    const key = getStyleImportKey(row);
    if (key) byKey.set(key, row);
  });
  return Array.from(byKey.values());
}

function styleImportFieldValuesEqual(field, existing, incoming) {
  return compareTextFieldValues(existing, incoming) === 0;
}

function styleImportRowDiffersFromExisting(importRow, existingRow) {
  return Object.entries(importRow).some(([field, value]) => {
    if (field === "Style #" || field === "Color") return false;
    return !styleImportFieldValuesEqual(field, existingRow?.[field], value);
  });
}

function partitionStyleImportRows(rows, existingRowsByKey) {
  const newRows = [];
  const changedRows = [];
  rows.forEach(row => {
    const key = getStyleImportKey(row);
    if (!key) return;
    const existingRow = existingRowsByKey.get(key);
    if (!existingRow) newRows.push(row);
    else if (styleImportRowDiffersFromExisting(row, existingRow)) changedRows.push(row);
  });
  return { newRows, changedRows };
}

async function importStyleCsvRowsToSheet(rows) {
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const errors = [];
  const insertedStyles = [];
  const updatedStyles = [];
  const batchCount = Math.ceil(rows.length / CSV_IMPORT_BATCH_SIZE);

  for (let i = 0; i < rows.length; i += CSV_IMPORT_BATCH_SIZE) {
    const batchIndex = Math.floor(i / CSV_IMPORT_BATCH_SIZE) + 1;
    setAppSaving(true, `Importing styles… batch ${batchIndex}/${batchCount}`);

    const batch = rows.slice(i, i + CSV_IMPORT_BATCH_SIZE);
    const json = await postApi("/api/styles/bulk-upsert", { rows: batch });
    if (!json.success) throw new Error(json.error || "Import batch failed");
    inserted += json.inserted || 0;
    updated += json.updated || 0;
    skipped += json.skipped || 0;
    if (Array.isArray(json.insertedStyles)) insertedStyles.push(...json.insertedStyles);
    if (Array.isArray(json.updatedStyles)) updatedStyles.push(...json.updatedStyles);
    if (Array.isArray(json.errors)) errors.push(...json.errors);
  }

  return {
    inserted,
    updated,
    skipped,
    errors,
    insertedStyles: dedupeStyleKeys(insertedStyles),
    updatedStyles: dedupeStyleKeys(updatedStyles),
  };
}

function dedupeStyleKeys(keys) {
  return [...new Set(keys.map(key => String(key).trim()).filter(Boolean))];
}

function sortStyleKeysForDisplay(keys) {
  return [...keys].sort((a, b) => compareTextFieldValues(a, b));
}

function renderStyleImportList(listEl, keys) {
  if (!listEl) return;
  listEl.replaceChildren();
  if (!keys.length) {
    const item = document.createElement("li");
    item.className = "csv-import-summary-empty";
    item.textContent = "None";
    listEl.appendChild(item);
    return;
  }
  sortStyleKeysForDisplay(keys).forEach(key => {
    const item = document.createElement("li");
    item.textContent = key.replace("|", " / ");
    listEl.appendChild(item);
  });
}

function showStyleImportSummary(result, skippedInFile = 0) {
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
    addedHeading.textContent = `Added styles (${result.insertedStyles.length})`;
  }
  if (updatedHeading) {
    updatedHeading.textContent = `Updated styles (${result.updatedStyles.length})`;
  }
  renderStyleImportList(addedList, result.insertedStyles);
  renderStyleImportList(updatedList, result.updatedStyles);
  overlay.classList.add("open");
}

async function handleStyleCsvImportFile(file) {
  if (!file) return;
  if (isAppSaving()) return;

  closeHeaderMenu();
  setAppSaving(true, "Importing styles…");

  try {
    const text = await file.text();
    const csvRows = parseCsvText(text);
    const csvObjects = csvRowsToObjects(csvRows);
    const mapped = csvObjects.map(mapStyleCsvRowToSheetRow).filter(Boolean);
    const rows = dedupeStyleImportRows(mapped);
    const skippedInFile = csvObjects.length - rows.length;

    if (rows.length === 0) {
      showIndicator("No valid style rows found in CSV", "error");
      return;
    }

    const existingRowsByKey = new Map(
      allStyles.map(row => [getStyleImportKey(row), row]).filter(([key]) => key)
    );

    const { newRows, changedRows } = partitionStyleImportRows(rows, existingRowsByKey);
    const rowsToSend = [...newRows, ...changedRows];

    let result;
    if (rowsToSend.length === 0) {
      result = {
        inserted: 0,
        updated: 0,
        skipped: 0,
        errors: [],
        insertedStyles: [],
        updatedStyles: [],
      };
    } else {
      result = await importStyleCsvRowsToSheet(rowsToSend);
      result.inserted = newRows.length;
      result.updated = changedRows.length;
      result.insertedStyles = dedupeStyleKeys(newRows.map(getStyleImportKey));
      result.updatedStyles = dedupeStyleKeys(changedRows.map(getStyleImportKey));
    }

    if (result.inserted > 0 || result.updated > 0) {
      await loadData();
    } else if (typeof onStylesDataLoaded === "function") {
      onStylesDataLoaded(allStyles);
    }

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
    showStyleImportSummary(result, skippedInFile);
  } catch (err) {
    showIndicator("Import failed: " + err.message, "error");
  } finally {
    setAppSaving(false);
  }
}
