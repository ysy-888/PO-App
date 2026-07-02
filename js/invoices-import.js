/** Invoice CSV import. */

const INV_CSV_HEADER_MAP = {
  invoiceNo:    "Invoice #",
  status:       "Status",
  invoiceDate:  "INV DATE",
  customer:     "Customer",
  subtotal:     "Subtotal",
  discount:     "Discount",
  freight:      "Freight",
  total:        "Total",
  paidAmt:      "Received",
  balance:      "Balance",
  pickNo:       "Pick #",
  trackingNo:   "Tracking #",
  orderNo:      "SO #",
  totalUnit:    "Unit Qty",
  memo:         "Memo",
  houseMemo:    "House Memo",
  comRate1:     "Sales Commission",
};

const INV_IMPORT_BATCH_SIZE = 10;

const INV_NUMERIC_IMPORT_FIELDS = new Set([
  "Subtotal", "Discount", "Freight", "Total", "Received", "Balance", "Unit Qty", "Sales Commission",
]);

function parseInvCsvRowToDoc(csvRow) {
  const doc = {};
  Object.entries(INV_CSV_HEADER_MAP).forEach(([csvField, docField]) => {
    if (!(csvField in csvRow)) return;
    const raw = String(csvRow[csvField] ?? "").trim();
    if (!raw) return;
    if (INV_NUMERIC_IMPORT_FIELDS.has(docField)) {
      const n = Number(raw);
      doc[docField] = Number.isFinite(n) ? String(n) : raw;
    } else {
      doc[docField] = raw;
    }
  });
  return doc;
}

async function importInvoiceDocuments(documents) {
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const errors = [];
  const insertedInvoices = [];
  const updatedInvoices = [];
  const batchCount = Math.ceil(documents.length / INV_IMPORT_BATCH_SIZE);

  for (let i = 0; i < documents.length; i += INV_IMPORT_BATCH_SIZE) {
    const batchIndex = Math.floor(i / INV_IMPORT_BATCH_SIZE) + 1;
    setAppSaving(true, `Importing invoices… batch ${batchIndex}/${batchCount}`);

    const batch = documents.slice(i, i + INV_IMPORT_BATCH_SIZE);
    const json = await postApi("/api/invoices/bulk-upsert", { rows: batch });
    if (!json.success) throw new Error(json.error || "Import batch failed");
    inserted += json.inserted || 0;
    updated += json.updated || 0;
    skipped += json.skipped || 0;
    if (Array.isArray(json.insertedInvoices)) insertedInvoices.push(...json.insertedInvoices);
    if (Array.isArray(json.updatedInvoices)) updatedInvoices.push(...json.updatedInvoices);
    if (Array.isArray(json.errors)) errors.push(...json.errors);
  }

  return { inserted, updated, skipped, errors, insertedInvoices, updatedInvoices };
}

function showInvoiceImportSummary(result) {
  const overlay = document.getElementById("csvImportSummaryOverlay");
  const statsEl = document.getElementById("csvImportSummaryStats");
  const addedHeading = document.getElementById("csvImportSummaryAddedHeading");
  const updatedHeading = document.getElementById("csvImportSummaryUpdatedHeading");
  const addedList = document.getElementById("csvImportSummaryAddedList");
  const updatedList = document.getElementById("csvImportSummaryUpdatedList");
  if (!overlay || !statsEl) return;

  const statParts = [`${result.inserted} added`, `${result.updated} updated`];
  if (result.skipped > 0) statParts.push(`${result.skipped} skipped`);
  if (result.errors.length > 0) statParts.push(`${result.errors.length} errors`);

  statsEl.textContent = statParts.join(", ");
  if (addedHeading) addedHeading.textContent = `Added invoices (${result.insertedInvoices.length})`;
  if (updatedHeading) updatedHeading.textContent = `Updated invoices (${result.updatedInvoices.length})`;

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
      li.textContent = `Invoice #${key}`;
      listEl.appendChild(li);
    });
  }

  renderList(addedList, result.insertedInvoices);
  renderList(updatedList, result.updatedInvoices);
  overlay.classList.add("open");
}

async function handleInvoiceCsvImportFile(file) {
  if (!file) return;
  if (isAppSaving()) return;

  closeHeaderMenu();
  setAppSaving(true, "Importing invoices…");

  try {
    const text = await file.text();
    const csvRows = parseCsvText(text);
    const csvObjects = csvRowsToObjects(csvRows);

    if (csvObjects.length === 0) {
      showIndicator("No rows found in CSV", "error");
      return;
    }

    const seen = new Set();
    const documents = [];
    csvObjects.forEach(csvRow => {
      const doc = parseInvCsvRowToDoc(csvRow);
      const invoiceNo = doc["Invoice #"];
      if (!invoiceNo || seen.has(invoiceNo)) return;
      seen.add(invoiceNo);
      documents.push(doc);
    });

    if (documents.length === 0) {
      showIndicator("No valid invoice rows found in CSV", "error");
      return;
    }

    const result = await importInvoiceDocuments(documents);

    if (result.inserted > 0 || result.updated > 0) {
      await loadData();
    } else if (typeof onInvoicesDataLoaded === "function") {
      onInvoicesDataLoaded(allInvoices);
    }

    const parts = [`${result.inserted} added`, `${result.updated} updated`];
    if (result.skipped > 0) parts.push(`${result.skipped} skipped`);
    if (result.errors.length > 0) parts.push(`${result.errors.length} errors`);

    if (result.inserted === 0 && result.updated === 0 && result.errors.length === 0) {
      showIndicator("Import complete: no changes", "success");
      return;
    }

    showIndicator(`Import complete: ${parts.join(", ")}`, result.errors.length ? "error" : "success");
    showInvoiceImportSummary(result);
  } catch (err) {
    showIndicator("Import failed: " + err.message, "error");
  } finally {
    setAppSaving(false);
  }
}
