/** Sales Order Details CSV import (N41 export). */

// Maps CSV field names → Sales Order document field names (header-level).
const SO_CSV_HEADER_MAP = {
  orderNo:    "SO #",
  custName:   "Customer",
  po:         "Customer PO #",
  orderDate:  "Order Date",
  shipDate:   "Ship Date",
  cancelDate: "CXL Date",
  store:      "Store",
  status:     "N41 Status",
  orderType:  "Order Type",
  custType:   "Customer Type",
};

// Maps CSV field names → Line object field names (per-style row).
const SO_CSV_LINE_MAP = {
  style:       "Style #",
  color:       "Color",
  sodStatus:   "Style Order Status",
  sizeQty:     "Size Qty",
  totalUnit:   "Total Units",
  stylePrice:  "Price",
  extPrice:    "Ext Price",
  styleDescript: "Style Description",
};

const SO_IMPORT_BATCH_SIZE = 10;

function parseSoCsvRowToLine(csvRow) {
  const line = {};
  Object.entries(SO_CSV_LINE_MAP).forEach(([csvField, lineField]) => {
    if (!(csvField in csvRow)) return;
    const raw = String(csvRow[csvField] ?? "").trim();
    if (!raw) return;
    // Numeric fields
    if (["Size Qty", "Total Units", "Price", "Ext Price"].includes(lineField)) {
      const n = Number(raw);
      line[lineField] = Number.isFinite(n) ? n : raw;
    } else {
      line[lineField] = raw;
    }
  });

  // Unit 1–15 (csv fields unit1…unit15)
  for (let i = 1; i <= 15; i++) {
    const csvKey = `unit${i}`;
    if (csvKey in csvRow) {
      const n = Number(String(csvRow[csvKey] ?? "").trim());
      line[`Unit ${i}`] = Number.isFinite(n) ? n : 0;
    }
  }

  return line;
}

/**
 * Groups flat CSV rows (one per style line) into Sales Order documents
 * (one per unique orderNo), collecting Lines as an array.
 * Returns an array of document objects ready for bulk-upsert.
 */
function groupSoCsvRowsIntoDocuments(csvObjects) {
  const byOrderNo = new Map();

  csvObjects.forEach(csvRow => {
    const orderNo = String(csvRow.orderNo ?? "").trim();
    if (!orderNo) return;

    if (!byOrderNo.has(orderNo)) {
      // Build header-level document from the first row for this orderNo
      const doc = { "SO #": orderNo, Lines: [] };
      Object.entries(SO_CSV_HEADER_MAP).forEach(([csvField, docField]) => {
        if (csvField === "orderNo") return;
        const raw = String(csvRow[csvField] ?? "").trim();
        if (raw) doc[docField] = raw;
      });
      byOrderNo.set(orderNo, doc);
    }

    const line = parseSoCsvRowToLine(csvRow);
    const styleNum = line["Style #"];
    const color = line.Color;
    if (styleNum || color) {
      byOrderNo.get(orderNo).Lines.push(line);
    }
  });

  return Array.from(byOrderNo.values());
}

async function importSalesOrderDocuments(documents) {
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const errors = [];
  const insertedOrders = [];
  const updatedOrders = [];
  const batchCount = Math.ceil(documents.length / SO_IMPORT_BATCH_SIZE);

  for (let i = 0; i < documents.length; i += SO_IMPORT_BATCH_SIZE) {
    const batchIndex = Math.floor(i / SO_IMPORT_BATCH_SIZE) + 1;
    setAppSaving(true, `Importing sales orders… batch ${batchIndex}/${batchCount}`);

    const batch = documents.slice(i, i + SO_IMPORT_BATCH_SIZE);
    const json = await postApi("/api/sales-orders/bulk-upsert", { rows: batch });
    if (!json.success) throw new Error(json.error || "Import batch failed");
    inserted += json.inserted || 0;
    updated += json.updated || 0;
    skipped += json.skipped || 0;
    if (Array.isArray(json.insertedOrders)) insertedOrders.push(...json.insertedOrders);
    if (Array.isArray(json.updatedOrders)) updatedOrders.push(...json.updatedOrders);
    if (Array.isArray(json.errors)) errors.push(...json.errors);
  }

  return { inserted, updated, skipped, errors, insertedOrders, updatedOrders };
}

function showSalesOrderImportSummary(result, skippedInFile = 0) {
  const overlay = document.getElementById("csvImportSummaryOverlay");
  const statsEl = document.getElementById("csvImportSummaryStats");
  const addedHeading = document.getElementById("csvImportSummaryAddedHeading");
  const updatedHeading = document.getElementById("csvImportSummaryUpdatedHeading");
  const addedList = document.getElementById("csvImportSummaryAddedList");
  const updatedList = document.getElementById("csvImportSummaryUpdatedList");
  if (!overlay || !statsEl) return;

  const skippedTotal = (result.skipped || 0) + skippedInFile;
  const statParts = [`${result.inserted} added`, `${result.updated} updated`];
  if (skippedTotal > 0) statParts.push(`${skippedTotal} skipped`);
  if (result.errors.length > 0) statParts.push(`${result.errors.length} errors`);

  statsEl.textContent = statParts.join(", ");
  if (addedHeading) addedHeading.textContent = `Added sales orders (${result.insertedOrders.length})`;
  if (updatedHeading) updatedHeading.textContent = `Updated sales orders (${result.updatedOrders.length})`;

  function renderList(listEl, items) {
    if (!listEl) return;
    listEl.replaceChildren();
    if (!items.length) {
      const li = document.createElement("li");
      li.className = "csv-import-summary-empty";
      li.textContent = "None";
      listEl.appendChild(li);
      return;
    }
    [...items].sort((a, b) => Number(a) - Number(b) || String(a).localeCompare(String(b), undefined, { numeric: true })).forEach(key => {
      const li = document.createElement("li");
      li.textContent = `SO #${key}`;
      listEl.appendChild(li);
    });
  }

  renderList(addedList, result.insertedOrders);
  renderList(updatedList, result.updatedOrders);
  overlay.classList.add("open");
}

async function handleSalesOrderCsvImportFile(file) {
  if (!file) return;
  if (isAppSaving()) return;

  closeHeaderMenu();
  setAppSaving(true, "Importing sales orders…");

  try {
    const text = await file.text();
    const csvRows = parseCsvText(text);
    const csvObjects = csvRowsToObjects(csvRows);

    if (csvObjects.length === 0) {
      showIndicator("No rows found in CSV", "error");
      return;
    }

    const documents = groupSoCsvRowsIntoDocuments(csvObjects);
    const skippedInFile = csvObjects.length - documents.reduce((s, d) => s + (d.Lines?.length ?? 0), 0);

    if (documents.length === 0) {
      showIndicator("No valid sales order rows found in CSV", "error");
      return;
    }

    const result = await importSalesOrderDocuments(documents);

    if (result.inserted > 0 || result.updated > 0) {
      await loadData();
    } else if (typeof onSalesOrdersDataLoaded === "function") {
      onSalesOrdersDataLoaded(allSalesOrders);
    }

    const parts = [`${result.inserted} added`, `${result.updated} updated`];
    const skippedTotal = result.skipped + Math.max(0, skippedInFile);
    if (skippedTotal > 0) parts.push(`${skippedTotal} skipped`);
    if (result.errors.length > 0) parts.push(`${result.errors.length} errors`);

    if (result.inserted === 0 && result.updated === 0 && result.errors.length === 0) {
      showIndicator("Import complete: no changes", "success");
      return;
    }

    showIndicator(`Import complete: ${parts.join(", ")}`, result.errors.length ? "error" : "success");
    showSalesOrderImportSummary(result, 0);
  } catch (err) {
    showIndicator("Import failed: " + err.message, "error");
  } finally {
    setAppSaving(false);
  }
}
