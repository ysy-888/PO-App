/** Packing list print – uses the same server HTML as email PDF attachments. */

function printPackingListHtmlDocument(html) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute("title", "Packing List");
  iframe.style.cssText = "position:fixed;left:-9999px;top:0;width:816px;height:1056px;border:0;";
  document.body.appendChild(iframe);

  const cleanup = () => {
    window.clearTimeout(cleanupTimer);
    iframe.remove();
  };

  const cleanupTimer = window.setTimeout(cleanup, 60000);
  const win = iframe.contentWindow;
  win.addEventListener("afterprint", cleanup, { once: true });

  const doc = iframe.contentDocument || win.document;
  doc.open();
  doc.write(html);
  doc.close();

  win.focus();
  win.print();
}

/** Demo/offline fallback using in-memory sheet data. */
function printPackingListLocal({
  poNumbers,
  mode = "individual",
  includeTitlePage = false,
  titleLabel = "",
  titlePageType = "",
  typeDate = "",
  requestDate = "",
} = {}) {
  const root = document.getElementById("packingPrintRoot");
  if (!root) return;

  const html = mode === "group"
    ? buildGroupPackingListPrintHtml(poNumbers, {
      includeTitlePage,
      titleLabel,
      titlePageType,
      typeDate,
      requestDate,
    })
    : buildIndividualPackingListPrintHtml(poNumbers[0]);

  root.innerHTML = html;
  document.body.classList.add("printing-packing-list");

  const cleanup = () => {
    document.body.classList.remove("printing-packing-list");
    root.innerHTML = "";
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
}

function wirePackingListPrintButton(btnOrId, {
  poNumbers,
  titleLabel,
  includeTitlePage = true,
  titlePageType = "",
  typeDate = "",
  requestDate = "",
} = {}) {
  const btn = typeof btnOrId === "string" ? document.getElementById(btnOrId) : btnOrId;
  if (!btn) return;
  const numbers = (Array.isArray(poNumbers) ? poNumbers : [])
    .map(po => String(po ?? "").trim())
    .filter(Boolean);
  btn.hidden = numbers.length === 0;
  btn.onclick = () => printPackingList({
    poNumbers: numbers,
    mode: "group",
    includeTitlePage,
    titleLabel: titleLabel || "",
    titlePageType,
    typeDate,
    requestDate,
  });
}

async function printPackingListAsync({
  poNumbers,
  mode = "individual",
  includeTitlePage = false,
  titleLabel = "",
  titlePageType = "",
  typeDate = "",
  requestDate = "",
} = {}) {
  const numbers = (Array.isArray(poNumbers) ? poNumbers : [])
    .map(po => String(po ?? "").trim())
    .filter(Boolean);
  if (numbers.length === 0) return;

  if (isDemoMode()) {
    printPackingListLocal({
      poNumbers: numbers,
      mode,
      includeTitlePage,
      titleLabel,
      titlePageType,
      typeDate,
      requestDate,
    });
    return;
  }

  if (typeof showIndicator === "function") {
    showIndicator("Preparing packing list…", "");
  }

  try {
    const json = await postAppsScript({
      action: "getPackingListPrintHtml",
      poNumbers: numbers,
      includeTitlePage: Boolean(includeTitlePage),
      titleLabel: String(titleLabel ?? "").trim(),
      titlePageType: String(titlePageType ?? "").trim(),
      typeDate: typeDate ?? "",
      requestDate: requestDate ?? "",
    });
    if (!json.success || !json.html) {
      throw new Error(json.error || "Failed to load packing list");
    }
    printPackingListHtmlDocument(json.html);
    if (typeof showIndicator === "function") {
      showIndicator("Packing list ready", "success");
    }
  } catch (err) {
    if (typeof showIndicator === "function") {
      showIndicator("Print failed: " + err.message, "error");
    }
  }
}

function printPackingList({
  poNumbers,
  mode = "individual",
  includeTitlePage = false,
  titleLabel = "",
  titlePageType = "",
  typeDate = "",
  requestDate = "",
} = {}) {
  void printPackingListAsync({
    poNumbers,
    mode,
    includeTitlePage,
    titleLabel,
    titlePageType,
    typeDate,
    requestDate,
  });
}

// ── Demo-mode HTML builders (kept for offline preview) ───────────────────────

const PL_PRINT_FONT = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";

function plPrintEsc(val) {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function plPrintDate(val) {
  if (!val || String(val).trim() === "" || String(val).trim() === EMPTY_DISPLAY) return "—";
  return formatDateForDisplay(val) === EMPTY_DISPLAY ? "—" : formatDateForDisplay(val);
}

function plPrintVal(val) {
  if (val === null || val === undefined || String(val).trim() === "" || String(val).trim() === EMPTY_DISPLAY) return "—";
  return plPrintEsc(String(val));
}

function plPrintNum(val) {
  const n = toQtyNumber(val);
  return n > 0 ? plPrintEsc(String(n)) : "0";
}

function plActiveCartons(cartons) {
  return (Array.isArray(cartons) ? cartons : []).filter(carton => {
    for (let i = 1; i <= 15; i++) {
      if (toQtyNumber(carton[`Unit ${i}`]) > 0) return true;
    }
    return toQtyNumber(carton["Carton Weight"]) > 0;
  });
}

function plActiveSizeColumns(row, cartons) {
  const cols = [];
  for (let i = 0; i < 15; i++) {
    const hasQty = cartons.some(c => toQtyNumber(c[`Unit ${i + 1}`]) > 0);
    if (!hasQty) continue;
    const label = String(row[`Size ${i + 1}`] ?? "").trim() || (`Sz ${i + 1}`);
    cols.push({ index: i, label });
  }
  return cols;
}

function plPrintSummaryColumn(pairs) {
  const rows = (Array.isArray(pairs) ? pairs : []).map(pair =>
    `<tr><td class="pl-summary-label">${plPrintEsc(pair[0])}</td><td class="pl-summary-value">${pair[1]}</td></tr>`
  ).join("");
  return `<table class="pl-summary-col" cellpadding="0" cellspacing="0">${rows}</table>`;
}

function plPrintSummaryGridFromColumns(columns, { twoCol = false } = {}) {
  const cols = Array.isArray(columns) ? columns : [];
  const gridClass = twoCol ? "pl-summary-grid pl-summary-grid--2col" : "pl-summary-grid";
  const columnCells = cols.map(col =>
    `<td class="pl-summary-grid-cell" valign="top">${plPrintSummaryColumn(col)}</td>`
  ).join("");
  return `<table class="${gridClass}" cellpadding="0" cellspacing="12" width="100%"><tr>${columnCells}</tr></table>`;
}

function plPrintNotesPanel(notes) {
  return `<div class="pl-notes">
    <div class="pl-notes-title">Notes</div>
    <div>${plPrintEsc(notes)}</div>
  </div>`;
}

function plPrintColgroup(sizeColCount) {
  const contentWidth = 720;
  const ctnWidth = 44;
  const totalWidth = 40;
  const wtWidth = 48;
  const fixed = ctnWidth + totalWidth + wtWidth;
  const remaining = Math.max(0, contentWidth - fixed);
  const sizeWidth = sizeColCount > 0 ? Math.max(28, Math.floor(remaining / sizeColCount)) : 0;
  let cols = `<colgroup><col width="${ctnWidth}">`;
  for (let i = 0; i < sizeColCount; i++) cols += `<col width="${sizeWidth}">`;
  cols += `<col width="${totalWidth}"><col width="${wtWidth}"></colgroup>`;
  return cols;
}

function plPrintPageStyles() {
  return `<style>
    .pl-print-page{width:100%;min-height:100vh;margin:0;padding:48px;page-break-after:always;${PL_PRINT_FONT}font-size:9px;line-height:1.3;color:#1a1a18;box-sizing:border-box;}
    .pl-print-page:last-child{page-break-after:auto;}
    .pl-header{width:100%;border-collapse:collapse;background:#fff;color:#1a1a18;border-bottom:1px solid #e5e7eb;}
    .pl-header td{padding:10px 0;vertical-align:middle;background:#fff;}
    .pl-header-brand{margin:0 0 3px;font-size:13px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#1a1a18;}
    .pl-header-title{margin:0;font-size:10px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#374151;}
    .pl-header-po{font-size:10px;font-weight:500;text-align:right;color:#1a1a18;}
    .pl-header-sub{margin-top:2px;font-size:9px;color:#6b7280;text-align:right;}
    .pl-body{padding:18px 0 0;}
    .pl-section-title{margin:0 0 10px;font-size:8px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#374151;}
    .pl-details-block{margin-bottom:20px;}
    .pl-packing-block{margin-top:4px;}
    .pl-summary-grid{width:100%;border-collapse:separate;border-spacing:12px 0;table-layout:fixed;}
    .pl-summary-grid-cell{width:33.33%;vertical-align:top;}
    .pl-summary-grid--2col .pl-summary-grid-cell{width:50%;}
    .pl-title-table th,.pl-title-table td{text-align:center;}
    .pl-summary-col{width:100%;border-collapse:collapse;border:1px solid #e5e7eb;table-layout:fixed;font-size:9px;}
    .pl-summary-col td{padding:4px 8px;border-bottom:1px solid #e5e7eb;vertical-align:middle;}
    .pl-summary-col tr:last-child td{border-bottom:none;}
    .pl-summary-label{width:58px;max-width:58px;font-size:8px;font-weight:600;color:#374151;background:#f7f7f8;white-space:nowrap;}
    .pl-summary-value{font-size:9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .pl-carton-table{width:100%;border-collapse:collapse;border:1px solid #e5e7eb;table-layout:fixed;font-size:9px;}
    .pl-carton-table th{padding:6px 8px;font-size:8px;font-weight:600;text-transform:uppercase;color:#374151;background:#f7f7f8;border-bottom:1px solid #e5e7eb;}
    .pl-carton-table td{padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:9px;vertical-align:middle;}
    .pl-carton-table th.pl-size-col,.pl-carton-table td.pl-size-col{padding:6px 8px;text-align:center;}
    .pl-carton-table th.pl-wt-col,.pl-carton-table td.pl-wt-col{padding:6px 12px;text-align:center;}
    .pl-carton-table tbody tr:last-child td{border-bottom:none;}
    .pl-carton-table tfoot td{padding:3px 4px;font-size:9px;font-weight:600;background:#eef0f3;border-top:1px solid #e5e7eb;border-bottom:none;}
    .pl-num{text-align:right;font-variant-numeric:tabular-nums;}
    .pl-center{text-align:center;font-variant-numeric:tabular-nums;color:#6b7280;}
    .pl-notes{margin-top:16px;padding:8px 10px;border:1px solid #e5e7eb;border-radius:3px;font-size:9px;}
    .pl-notes-title{font-size:8px;font-weight:600;text-transform:uppercase;color:#374151;margin-bottom:3px;}
    .pl-empty{font-size:9px;color:#6b7280;font-style:italic;margin:0;}
  </style>`;
}

function plPrintActQtyTotal(row, activeCartons) {
  if (activeCartons.length > 0) {
    return activeCartons.reduce((sum, carton) => {
      for (let i = 1; i <= 15; i++) sum += toQtyNumber(carton[`Unit ${i}`]);
      return sum;
    }, 0);
  }
  return toQtyNumber(row["Actual Qty"]);
}

function buildPlPrintPoDetailsHtml(row, activeCartons) {
  const actQty = plPrintActQtyTotal(row, activeCartons);
  const ctnQty = activeCartons.length || toQtyNumber(row["Ctn Qty"]);
  return `<div class="pl-details-block"><p class="pl-section-title">PO Details</p>${plPrintSummaryGridFromColumns([
    [
      ["PO #", plPrintVal(row["PO #"])],
      ["Buyer PO #", plPrintVal(row["Buyer PO #"])],
      ["Buyer", plPrintVal(row["Buyer"])],
      ["Vendor", plPrintVal(row["Vendor"])],
    ],
    [
      ["Style #", plPrintVal(row["Style #"])],
      ["Color", plPrintVal(row["Color"])],
      ["Act Qty", plPrintEsc(String(actQty))],
      ["Ctn Qty", plPrintEsc(String(ctnQty))],
    ],
    [
      ["PO Date", plPrintDate(row["PO Date"])],
      ["EXF Date", plPrintDate(row["EXF Date"] || row["EXF Request Date"] || row["EXF"])],
      ["Ship Method", plPrintVal(row["Ship Method"])],
      ["Shipment ID", plPrintVal(row["Shipment ID"])],
    ],
  ])}</div>`;
}

function buildPlPrintPackingListHtml(row) {
  const poNumber = String(row["PO #"] ?? "");
  const packingList = getPackingListForPo(poNumber);
  const cartons = plActiveCartons(getPackingCartonsForPo(poNumber));

  if (!packingList || cartons.length === 0) {
    return `<div class="pl-packing-block"><p class="pl-section-title">Cartons</p><p class="pl-empty">No packing list on file.</p></div>`;
  }

  const sizeCols = plActiveSizeColumns(row, cartons);
  const unitTotals = sizeCols.map(col =>
    cartons.reduce((sum, carton) => sum + toQtyNumber(carton[`Unit ${col.index + 1}`]), 0)
  );
  const grandTotal = unitTotals.reduce((s, n) => s + n, 0);
  const totalWeight = cartons.reduce((s, c) => s + toQtyNumber(c["Carton Weight"]), 0);

  const sizeHeaderCols = sizeCols.map(col =>
    `<th class="pl-center pl-size-col">${plPrintEsc(col.label)}</th>`
  ).join("");

  const cartonRows = cartons.map(carton => {
    const rowTotal = sizeCols.reduce((s, col) => s + toQtyNumber(carton[`Unit ${col.index + 1}`]), 0);
    const unitCols = sizeCols.map(col => {
      const n = toQtyNumber(carton[`Unit ${col.index + 1}`]);
      return `<td class="pl-center pl-size-col">${n > 0 ? n : ""}</td>`;
    }).join("");
    const weight = toQtyNumber(carton["Carton Weight"]);
    return `<tr>
      <td class="pl-center">${plPrintEsc(String(carton["Carton #"] ?? ""))}</td>
      ${unitCols}
      <td class="pl-num">${rowTotal}</td>
      <td class="pl-center pl-wt-col">${weight > 0 ? weight : ""}</td>
    </tr>`;
  }).join("");

  const unitTotalCols = unitTotals.map(n => `<td class="pl-center pl-size-col">${n}</td>`).join("");
  const notes = packingList ? String(packingList["Notes"] ?? "").trim() : "";
  const notesHtml = notes ? plPrintNotesPanel(notes) : "";

  return `
<div class="pl-packing-block">
<p class="pl-section-title">Cartons (${cartons.length})</p>
<table class="pl-carton-table" cellpadding="0" cellspacing="0">
  ${plPrintColgroup(sizeCols.length)}
  <thead>
    <tr>
      <th class="pl-center">Ctn #</th>
      ${sizeHeaderCols}
      <th class="pl-num">Total</th>
      <th class="pl-center pl-wt-col">Wt</th>
    </tr>
  </thead>
  <tbody>${cartonRows}</tbody>
  <tfoot>
    <tr>
      <td class="pl-center">Total</td>
      ${unitTotalCols}
      <td class="pl-num">${grandTotal}</td>
      <td class="pl-center pl-wt-col">${totalWeight > 0 ? totalWeight : "—"}</td>
    </tr>
  </tfoot>
</table>
${notesHtml}
</div>`;
}

function buildPlPrintPoSectionHtml(row) {
  const poNum = plPrintVal(row["PO #"]);
  const style = plPrintVal(row["Style #"]);
  const color = plPrintVal(row["Color"]);
  const activeCartons = plActiveCartons(getPackingCartonsForPo(String(row["PO #"] ?? "")));
  const styleSubtitle = style !== "—"
    ? `<div class="pl-header-sub">${style} / ${color}</div>`
    : "";

  return `
<div class="pl-print-page">
  <table class="pl-header" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td>
        <div class="pl-header-brand">ELEVATOR DISCO</div>
        <div class="pl-header-title">Packing List</div>
      </td>
      <td align="right">
        <div class="pl-header-po">PO ${poNum}</div>
        ${styleSubtitle}
      </td>
    </tr>
  </table>
  <div class="pl-body">
    ${buildPlPrintPoDetailsHtml(row, activeCartons)}
    ${buildPlPrintPackingListHtml(row)}
  </div>
</div>`;
}

function buildIndividualPackingListPrintHtml(poNumber) {
  const row = allRows.find(r => String(r["PO #"]) === String(poNumber));
  if (!row) return "<p>PO not found.</p>";
  return plPrintPageStyles() + buildPlPrintPoSectionHtml(row);
}

function plPrintTitleTypeDateLabel(type) {
  if (type === "ASN") return "ASN Date";
  if (type === "Delivery") return "Delivery Date";
  if (type === "Pickup") return "Pickup Date";
  if (type === "Shipment") return "EXF Date";
  return "Date";
}

function plPrintCtnQtyForPo(row) {
  const cartons = plActiveCartons(getPackingCartonsForPo(String(row["PO #"] ?? "")));
  return cartons.length || toQtyNumber(row["Ctn Qty"]);
}

function plPrintWeightForPo(row) {
  const cartons = getPackingCartonsForPo(String(row["PO #"] ?? ""));
  const weight = cartons.reduce((sum, c) => sum + toQtyNumber(c["Carton Weight"]), 0);
  return weight;
}

function buildPlPrintTitlePageHtml(rows, {
  titleLabel = "",
  titlePageType = "",
  typeDate = "",
  requestDate = "",
} = {}) {
  const label = String(titleLabel ?? "").trim() || "Packing List";
  const typeDateLabel = plPrintTitleTypeDateLabel(titlePageType);
  const typeDateDisplay = plPrintDate(typeDate);
  const requestDateDisplay = plPrintDate(requestDate);
  const headerSubtitle = typeDateDisplay !== "—"
    ? `${plPrintEsc(typeDateLabel)}: ${typeDateDisplay}`
    : plPrintEsc(typeDateLabel);
  const totalPoQty = rows.reduce((sum, row) => sum + toQtyNumber(row["PO Qty"]), 0);
  const totalActQty = rows.reduce((sum, row) => sum + toQtyNumber(row["Actual Qty"]), 0);
  const totalCtnQty = rows.reduce((sum, row) => sum + plPrintCtnQtyForPo(row), 0);
  const totalWeight = rows.reduce((sum, row) => sum + plPrintWeightForPo(row), 0);

  const isAsnTitlePage = titlePageType === "ASN";
  const labelColspan = isAsnTitlePage ? 6 : 5;

  const tableRows = rows.map((row, i) => {
    const ctnQty = plPrintCtnQtyForPo(row);
    const weight = plPrintWeightForPo(row);
    const buyerPoCell = isAsnTitlePage
      ? `<td class="pl-center">${plPrintVal(row["Buyer PO #"])}</td>`
      : "";
    return `<tr>
      <td class="pl-center">${i + 1}</td>
      <td class="pl-center">${plPrintVal(row["PO #"])}</td>
      ${buyerPoCell}
      <td class="pl-center">${plPrintVal(row["Style #"])}</td>
      <td class="pl-center">${plPrintVal(row["Color"])}</td>
      <td class="pl-center">${plPrintVal(row["Buyer"])}</td>
      <td class="pl-center">${plPrintNum(row["Actual Qty"])}</td>
      <td class="pl-center">${plPrintEsc(String(ctnQty))}</td>
      <td class="pl-center">${weight > 0 ? plPrintEsc(String(weight)) : "—"}</td>
    </tr>`;
  }).join("");

  return `
<div class="pl-print-page">
  <table class="pl-header" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td>
        <div class="pl-header-brand">ELEVATOR DISCO</div>
        <div class="pl-header-title">Packing List</div>
      </td>
      <td align="right">
        <div class="pl-header-po">${plPrintEsc(label)}</div>
        <div class="pl-header-sub">${headerSubtitle}</div>
      </td>
    </tr>
  </table>
  <div class="pl-body">
    <div class="pl-details-block">
      <p class="pl-section-title">Request Details</p>
      ${plPrintSummaryGridFromColumns([
        [
          [typeDateLabel, typeDateDisplay],
          ["Request Date", requestDateDisplay],
        ],
        [
          ["PO Qty", plPrintEsc(String(totalPoQty))],
          ["Act Qty", plPrintEsc(String(totalActQty))],
          ["Ctn Qty", plPrintEsc(String(totalCtnQty))],
        ],
      ], { twoCol: true })}
    </div>
    <p class="pl-section-title">Included POs</p>
    <table class="pl-carton-table pl-title-table" cellpadding="0" cellspacing="0">
      <thead>
        <tr>
          <th class="pl-center">#</th>
          <th class="pl-center">PO #</th>
          ${isAsnTitlePage ? '<th class="pl-center">Buyer PO #</th>' : ""}
          <th class="pl-center">Style #</th>
          <th class="pl-center">Color</th>
          <th class="pl-center">Buyer</th>
          <th class="pl-center">Actual Qty</th>
          <th class="pl-center">Ctn Qty</th>
          <th class="pl-center">Weight</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
      <tfoot>
        <tr>
          <td colspan="${labelColspan}" class="pl-center">Total (${rows.length} PO${rows.length === 1 ? "" : "s"})</td>
          <td class="pl-center">${totalActQty}</td>
          <td class="pl-center">${totalCtnQty}</td>
          <td class="pl-center">${totalWeight > 0 ? totalWeight : "—"}</td>
        </tr>
      </tfoot>
    </table>
  </div>
</div>`;
}

function buildGroupPackingListPrintHtml(poNumbers, {
  includeTitlePage = false,
  titleLabel = "",
  titlePageType = "",
  typeDate = "",
  requestDate = "",
} = {}) {
  const rows = poNumbers
    .map(po => allRows.find(r => String(r["PO #"]) === String(po)))
    .filter(Boolean);
  if (rows.length === 0) return "<p>No POs found.</p>";
  const titlePage = includeTitlePage
    ? buildPlPrintTitlePageHtml(rows, { titleLabel, titlePageType, typeDate, requestDate })
    : "";
  return plPrintPageStyles() + titlePage + rows.map(row => buildPlPrintPoSectionHtml(row)).join("\n");
}
