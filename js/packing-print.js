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
  requestId = "",
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
      requestId,
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
  requestId = "",
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
    requestId,
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
  requestId = "",
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
      requestId,
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
      requestId: requestId ?? "",
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
  requestId = "",
} = {}) {
  void printPackingListAsync({
    poNumbers,
    mode,
    includeTitlePage,
    titleLabel,
    titlePageType,
    typeDate,
    requestDate,
    requestId,
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

function plPrintFmtWeight(val) {
  const n = toQtyNumber(val);
  if (n <= 0) return "";
  const num = Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
  return num + "\u00a0lbs";
}

function plActiveCartons(cartons) {
  return (Array.isArray(cartons) ? cartons : []).filter(carton => {
    for (let i = 1; i <= 15; i++) {
      if (toQtyNumber(carton[`Unit ${i}`]) > 0) return true;
    }
    return getCartonWeightLbs(carton) > 0;
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

function plPrintColgroup(sizeColCount, compact = false) {
  const contentWidth = 720;
  const ctnWidth = compact ? 34 : 44;
  const totalWidth = compact ? 34 : 40;
  const wtWidth = compact ? 56 : 64;
  const sizeWidth = compact ? 30 : null;
  const fixed = ctnWidth + totalWidth + wtWidth;
  const remaining = Math.max(0, contentWidth - fixed);
  const resolvedSizeWidth = sizeWidth ?? (sizeColCount > 0 ? Math.max(28, Math.floor(remaining / sizeColCount)) : 0);
  let cols = `<colgroup><col width="${ctnWidth}">`;
  for (let i = 0; i < sizeColCount; i++) cols += `<col width="${resolvedSizeWidth}">`;
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
    .pl-section-title{margin:0 0 6px;font-size:8px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#374151;}
    .pl-section-title+.pl-summary-grid,.pl-section-title+.pl-carton-table,.pl-section-title+.pl-carton-table-wrap{margin-top:10px;}
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
    .pl-carton-table th.pl-ctn-col,.pl-carton-table td.pl-ctn-col{padding-right:14px;text-align:center;}
    .pl-carton-table tbody td.pl-ctn-col{font-weight:700;}
    .pl-carton-table th.pl-size-col,.pl-carton-table td.pl-size-col{padding:6px 8px;text-align:center;}
    .pl-carton-table th.pl-size-first,.pl-carton-table td.pl-size-first{padding-left:12px;}
    .pl-carton-table th.pl-total-col,.pl-carton-table td.pl-total-col{text-align:center;border-left:1px solid #e5e7eb;padding-left:10px;padding-right:10px;}
    .pl-carton-table th.pl-wt-col,.pl-carton-table td.pl-wt-col{padding:6px 12px;text-align:center;border-left:1px solid #e5e7eb;white-space:nowrap;}
    .pl-carton-table-wrap{text-align:center;}
    .pl-carton-table--compact{width:auto;display:inline-table;margin:0 auto;}
    .pl-carton-table--compact th,.pl-carton-table--compact td{padding:6px 5px;}
    .pl-carton-table--compact th.pl-ctn-col,.pl-carton-table--compact td.pl-ctn-col{padding-right:12px;}
    .pl-carton-table--compact th.pl-size-first,.pl-carton-table--compact td.pl-size-first{padding-left:10px;}
    .pl-carton-table--compact th.pl-total-col,.pl-carton-table--compact td.pl-total-col{padding-left:8px;padding-right:8px;}
    .pl-carton-table--compact th.pl-wt-col,.pl-carton-table--compact td.pl-wt-col{padding:6px 10px;}
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
  const totalWeight = cartons.reduce((s, c) => s + getCartonWeightLbs(c), 0);

  const sizeHeaderCols = sizeCols.map((col, i) =>
    `<th class="pl-center pl-size-col${i === 0 ? " pl-size-first" : ""}">${plPrintEsc(col.label)}</th>`
  ).join("");

  const cartonRows = cartons.map(carton => {
    const rowTotal = sizeCols.reduce((s, col) => s + toQtyNumber(carton[`Unit ${col.index + 1}`]), 0);
    const unitCols = sizeCols.map((col, i) => {
      const n = toQtyNumber(carton[`Unit ${col.index + 1}`]);
      return `<td class="pl-center pl-size-col${i === 0 ? " pl-size-first" : ""}">${n > 0 ? n : ""}</td>`;
    }).join("");
    const weight = getCartonWeightLbs(carton);
    return `<tr>
      <td class="pl-center pl-ctn-col">${plPrintEsc(String(carton["Carton #"] ?? ""))}</td>
      ${unitCols}
      <td class="pl-center pl-total-col">${rowTotal}</td>
      <td class="pl-center pl-wt-col">${weight > 0 ? plPrintEsc(plPrintFmtWeight(weight)) : ""}</td>
    </tr>`;
  }).join("");

  const unitTotalCols = unitTotals.map((n, i) =>
    `<td class="pl-center pl-size-col${i === 0 ? " pl-size-first" : ""}">${n}</td>`
  ).join("");
  const notes = packingList ? String(packingList["Notes"] ?? "").trim() : "";
  const notesHtml = notes ? plPrintNotesPanel(notes) : "";

  return `
<div class="pl-packing-block">
<p class="pl-section-title">Cartons (${cartons.length})</p>
<div class="pl-carton-table-wrap">
<table class="pl-carton-table pl-carton-table--compact" cellpadding="0" cellspacing="0">
  ${plPrintColgroup(sizeCols.length, true)}
  <thead>
    <tr>
      <th class="pl-center pl-ctn-col">Ctn #</th>
      ${sizeHeaderCols}
      <th class="pl-center pl-total-col">Total</th>
      <th class="pl-center pl-wt-col">Wt (lbs)</th>
    </tr>
  </thead>
  <tbody>${cartonRows}</tbody>
  <tfoot>
    <tr>
      <td class="pl-center pl-ctn-col">Total</td>
      ${unitTotalCols}
      <td class="pl-center pl-total-col">${grandTotal}</td>
      <td class="pl-center pl-wt-col">${totalWeight > 0 ? plPrintEsc(plPrintFmtWeight(totalWeight)) : "—"}</td>
    </tr>
  </tfoot>
</table>
</div>
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
        <div class="pl-header-po">PO #${poNum}</div>
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
  return cartons.reduce((sum, c) => sum + getCartonWeightLbs(c), 0);
}

function buildPlPrintTitlePageHtml(rows, {
  titleLabel = "",
  titlePageType = "",
  typeDate = "",
  requestDate = "",
  requestId = "",
} = {}) {
  const label = String(titleLabel ?? "").trim() || "Packing List";
  const typeDateLabel = plPrintTitleTypeDateLabel(titlePageType);
  const typeDateDisplay = plPrintDate(typeDate);
  const requestDateDisplay = plPrintDate(requestDate);
  const requestIdDisplay = plPrintVal(requestId);
  const headerSubtitle = typeDateDisplay !== "—"
    ? `${plPrintEsc(typeDateLabel)}: ${typeDateDisplay}`
    : plPrintEsc(typeDateLabel);
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
      <td class="pl-center">${weight > 0 ? plPrintEsc(plPrintFmtWeight(weight)) : "—"}</td>
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
          ["Request ID", requestIdDisplay],
        ],
        [
          ["PO Count", plPrintEsc(String(rows.length))],
          ["Total Qty", plPrintEsc(String(totalActQty))],
          ["Ctn Qty", plPrintEsc(String(totalCtnQty))],
          ["Total Weight", totalWeight > 0 ? plPrintEsc(plPrintFmtWeight(totalWeight)) : "—"],
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
          <td class="pl-center">${totalWeight > 0 ? plPrintEsc(plPrintFmtWeight(totalWeight)) : "—"}</td>
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
  requestId = "",
} = {}) {
  const rows = poNumbers
    .map(po => allRows.find(r => String(r["PO #"]) === String(po)))
    .filter(Boolean);
  if (rows.length === 0) return "<p>No POs found.</p>";
  const titlePage = includeTitlePage
    ? buildPlPrintTitlePageHtml(rows, { titleLabel, titlePageType, typeDate, requestDate, requestId })
    : "";
  return plPrintPageStyles() + titlePage + rows.map(row => buildPlPrintPoSectionHtml(row)).join("\n");
}

const CARTON_LABEL_PAGE_STYLES = `
<style type="text/css">
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { size: letter portrait; margin: 0; }
  html, body { margin: 0; padding: 0; width: 816px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.4; color: #1a1a18; background: #fff; }
  .pdf-page { width: 816px; min-height: 1056px; margin: 0; padding: 48px; page-break-after: always; background: #fff; display: flex; align-items: center; justify-content: center; }
  .pdf-page:last-child, .pdf-page-last { page-break-after: auto; }
  .carton-label { width: 100%; max-width: 520px; border: 2px solid #1a1a18; padding: 32px 36px; }
  .carton-label-field { margin-bottom: 20px; }
  .carton-label-field:last-child { margin-bottom: 0; }
  .carton-label-label { font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #6b7280; margin-bottom: 4px; }
  .carton-label-value { font-size: 18px; font-weight: 700; color: #1a1a18; word-break: break-word; }
  .carton-label-value--box { font-size: 24px; }
  .carton-label-skus { margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; }
  .carton-label-skus-title { font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #6b7280; margin-bottom: 10px; }
  .carton-label-sku-line { display: flex; justify-content: space-between; gap: 16px; padding: 6px 0; font-size: 14px; border-bottom: 1px solid #f3f4f6; }
  .carton-label-sku-line:last-child { border-bottom: none; }
  .carton-label-sku { font-weight: 600; flex: 1; word-break: break-word; }
  .carton-label-qty { font-weight: 700; white-space: nowrap; }
</style>`;

function buildCartonLabelSkuLinesHtml(row, carton, allCartons, colorCode) {
  const styleNum = String(row["Style #"] ?? "").trim();
  const sizeCols = plActiveSizeColumns(row, plActiveCartons(allCartons));
  const lines = sizeCols.map(col => {
    const qty = toQtyNumber(carton[`Unit ${col.index + 1}`]);
    if (qty <= 0) return "";
    const sku = `SKU: ${styleNum}-${colorCode}-${col.label}`;
    return `<div class="carton-label-sku-line"><span class="carton-label-sku">${plPrintEsc(sku)}</span><span class="carton-label-qty">${plPrintEsc(String(qty))}</span></div>`;
  }).filter(Boolean);
  if (lines.length === 0) {
    return `<div class="carton-label-sku-line"><span class="carton-label-sku">No units</span></div>`;
  }
  return lines.join("");
}

function buildCartonLabelPageHtml(row, carton, cartonIndex, totalCartons, shipNotice, colorCode, allCartons, isLast) {
  const buyerPo = String(row["Buyer PO #"] ?? "").trim();
  const asnNumber = "ASN-ELEVATOR" + buyerPo;
  const boxLabel = `BOX ${cartonIndex} / ${totalCartons}`;
  const pageClass = "pdf-page" + (isLast ? " pdf-page-last" : "");
  return `<div class="${pageClass}">
  <div class="carton-label">
    <div class="carton-label-field"><div class="carton-label-label">ASN #</div><div class="carton-label-value">${plPrintEsc(asnNumber)}</div></div>
    <div class="carton-label-field"><div class="carton-label-label">Ship Notice #</div><div class="carton-label-value">${plPrintEsc(shipNotice)}</div></div>
    <div class="carton-label-field"><div class="carton-label-label">Carton</div><div class="carton-label-value carton-label-value--box">${plPrintEsc(boxLabel)}</div></div>
    <div class="carton-label-skus"><div class="carton-label-skus-title">Contents</div>${buildCartonLabelSkuLinesHtml(row, carton, allCartons, colorCode)}</div>
  </div>
</div>`;
}

function normalizeLabelInputsByPo(labelInputs) {
  const map = {};
  (Array.isArray(labelInputs) ? labelInputs : []).forEach(entry => {
    const po = String(entry.poNumber ?? entry["PO #"] ?? "").trim();
    if (!po) return;
    map[po] = {
      shipNotice: String(entry.shipNotice ?? "").trim(),
      colorCode: String(entry.colorCode ?? "").trim(),
    };
  });
  return map;
}

function buildCartonLabelsPrintHtml(poNumbers, labelInputs) {
  const labelInputsByPo = normalizeLabelInputsByPo(labelInputs);
  const rows = poNumbers
    .map(po => allRows.find(r => String(r["PO #"]) === String(po)))
    .filter(Boolean);
  const pages = [];
  rows.forEach(row => {
    const po = String(row["PO #"] ?? "").trim();
    const info = labelInputsByPo[po] || {};
    const cartons = plActiveCartons(getPackingCartonsForPo(po)).slice().sort((a, b) =>
      toQtyNumber(a["Carton #"]) - toQtyNumber(b["Carton #"])
    );
    const totalCartons = cartons.length;
    cartons.forEach((carton, idx) => {
      const cartonNum = toQtyNumber(carton["Carton #"]) || (idx + 1);
      pages.push(buildCartonLabelPageHtml(
        row, carton, cartonNum, totalCartons,
        info.shipNotice ?? "", info.colorCode ?? "", cartons, false
      ));
    });
  });
  if (pages.length === 0) {
    pages.push(`<div class="pdf-page pdf-page-last"><div class="carton-label"><div class="carton-label-value">No cartons on file.</div></div></div>`);
  } else {
    pages[pages.length - 1] = pages[pages.length - 1].replace('class="pdf-page"', 'class="pdf-page pdf-page-last"');
  }
  return CARTON_LABEL_PAGE_STYLES + pages.join("\n");
}
