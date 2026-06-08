/** Packing list print functionality – individual (single PO) and group (multi-PO) layouts. */

const PL_PRINT_FONT = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";

// ── Helpers ─────────────────────────────────────────────────────────────────

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

/** Three label/value pairs per row for a compact summary grid. */
function plPrintSummaryGrid(pairs) {
  const colsPerRow = 3;
  const rows = [];
  for (let i = 0; i < pairs.length; i += colsPerRow) {
    let row = "<tr>";
    for (let j = 0; j < colsPerRow; j++) {
      const pair = pairs[i + j];
      if (pair) {
        row += `<td class="pl-summary-label">${plPrintEsc(pair[0])}</td><td class="pl-summary-value">${pair[1]}</td>`;
      } else {
        row += `<td class="pl-summary-label">&nbsp;</td><td class="pl-summary-value">&nbsp;</td>`;
      }
    }
    row += "</tr>";
    rows.push(row);
  }
  return `<table class="pl-summary" cellpadding="0" cellspacing="0">${rows.join("")}</table>`;
}

function plPrintNotesPanel(notes) {
  return `<div class="pl-notes">
    <div class="pl-notes-title">Notes</div>
    <div>${plPrintEsc(notes)}</div>
  </div>`;
}

function plPrintColgroup(sizeColCount) {
  const contentWidth = 788;
  const fixed = 30 + 34 + 36;
  const sizeWidth = sizeColCount > 0 ? Math.max(22, Math.floor((contentWidth - fixed) / sizeColCount)) : 0;
  let cols = `<colgroup><col width="30">`;
  for (let i = 0; i < sizeColCount; i++) cols += `<col width="${sizeWidth}">`;
  cols += `<col width="34"><col width="36"></colgroup>`;
  return cols;
}

function plPrintPageStyles() {
  return `<style>
    .pl-print-page{width:100%;min-height:100vh;margin:0;padding:0;page-break-after:always;${PL_PRINT_FONT}font-size:9px;line-height:1.3;color:#1a1a18;}
    .pl-print-page:last-child{page-break-after:auto;}
    .pl-header{width:100%;border-collapse:collapse;background:#2d2d29;color:#fff;}
    .pl-header td{padding:10px 14px;vertical-align:middle;background:#2d2d29;}
    .pl-header-brand{margin:0 0 3px;font-size:13px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;}
    .pl-header-title{margin:0;font-size:10px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#d4d9df;}
    .pl-header-po{font-size:10px;font-weight:500;text-align:right;}
    .pl-header-sub{margin-top:2px;font-size:9px;color:#d4d9df;text-align:right;}
    .pl-body{padding:0 14px 14px;}
    .pl-section-title{margin:8px 0 3px;font-size:8px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#374151;}
    .pl-summary{width:auto;max-width:100%;border-collapse:collapse;border:1px solid #e5e7eb;table-layout:fixed;font-size:9px;}
    .pl-summary td{padding:2px 5px;border-bottom:1px solid #e5e7eb;vertical-align:middle;}
    .pl-summary tr:last-child td{border-bottom:none;}
    .pl-summary-label{width:58px;max-width:58px;font-size:8px;font-weight:600;color:#374151;background:#f7f7f8;white-space:nowrap;}
    .pl-summary-value{width:68px;max-width:68px;font-size:9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .pl-carton-table{width:100%;border-collapse:collapse;border:1px solid #e5e7eb;table-layout:fixed;font-size:9px;margin-top:2px;}
    .pl-carton-table th{padding:3px 4px;font-size:8px;font-weight:600;text-transform:uppercase;color:#374151;background:#f7f7f8;border-bottom:1px solid #e5e7eb;}
    .pl-carton-table td{padding:3px 4px;border-bottom:1px solid #e5e7eb;font-size:9px;vertical-align:middle;}
    .pl-carton-table tbody tr:last-child td{border-bottom:none;}
    .pl-carton-table tfoot td{padding:3px 4px;font-size:9px;font-weight:600;background:#eef0f3;border-top:1px solid #e5e7eb;border-bottom:none;}
    .pl-num{text-align:right;font-variant-numeric:tabular-nums;}
    .pl-center{text-align:center;font-variant-numeric:tabular-nums;color:#6b7280;}
    .pl-notes{margin-top:6px;padding:6px 8px;border:1px solid #e5e7eb;border-radius:3px;font-size:9px;}
    .pl-notes-title{font-size:8px;font-weight:600;text-transform:uppercase;color:#374151;margin-bottom:3px;}
    .pl-empty{font-size:9px;color:#6b7280;font-style:italic;margin:0;}
  </style>`;
}

// ── PO Details section ───────────────────────────────────────────────────────

function buildPlPrintPoDetailsHtml(row, activeCartonCount) {
  const metaRows = [
    ["PO #", plPrintVal(row["PO #"])],
    ["Buyer PO #", plPrintVal(row["Buyer PO #"])],
    ["Style #", plPrintVal(row["Style #"])],
    ["Color", plPrintVal(row["Color"])],
    ["Vendor", plPrintVal(row["Vendor"])],
    ["Buyer", plPrintVal(row["Buyer"])],
    ["Ship Method", plPrintVal(row["Ship Method"])],
    ["Shipment ID", plPrintVal(row["Shipment ID"])],
    ["PO Date", plPrintDate(row["PO Date"])],
    ["EXF Date", plPrintDate(row["EXF Date"] || row["EXF Request Date"] || row["EXF"])],
    ["IHD", plPrintDate(row["IHD"])],
    ["Ctn Qty", plPrintNum(activeCartonCount || row["Ctn Qty"])],
  ];

  return `<p class="pl-section-title">PO Details</p>${plPrintSummaryGrid(metaRows)}`;
}

// ── Packing List section ─────────────────────────────────────────────────────

function buildPlPrintPackingListHtml(row) {
  const poNumber = String(row["PO #"] ?? "");
  const packingList = getPackingListForPo(poNumber);
  const cartons = plActiveCartons(getPackingCartonsForPo(poNumber));

  if (!packingList && cartons.length === 0) {
    return `<p class="pl-section-title">Cartons</p><p class="pl-empty">No packing list on file.</p>`;
  }

  const sizeCols = plActiveSizeColumns(row, cartons);
  const unitTotals = sizeCols.map(col =>
    cartons.reduce((sum, carton) => sum + toQtyNumber(carton[`Unit ${col.index + 1}`]), 0)
  );
  const grandTotal = unitTotals.reduce((s, n) => s + n, 0);
  const totalWeight = cartons.reduce((s, c) => s + toQtyNumber(c["Carton Weight"]), 0);

  const sizeHeaderCols = sizeCols.map(col =>
    `<th class="pl-num">${plPrintEsc(col.label)}</th>`
  ).join("");

  const cartonRows = cartons.map(carton => {
    const rowTotal = sizeCols.reduce((s, col) => s + toQtyNumber(carton[`Unit ${col.index + 1}`]), 0);
    const unitCols = sizeCols.map(col => {
      const n = toQtyNumber(carton[`Unit ${col.index + 1}`]);
      return `<td class="pl-num">${n > 0 ? n : ""}</td>`;
    }).join("");
    const weight = toQtyNumber(carton["Carton Weight"]);
    return `<tr>
      <td class="pl-center">${plPrintEsc(String(carton["Carton #"] ?? ""))}</td>
      ${unitCols}
      <td class="pl-num">${rowTotal}</td>
      <td class="pl-num">${weight > 0 ? weight : ""}</td>
    </tr>`;
  }).join("");

  const unitTotalCols = unitTotals.map(n => `<td class="pl-num">${n}</td>`).join("");
  const notes = packingList ? String(packingList["Notes"] ?? "").trim() : "";
  const notesHtml = notes ? plPrintNotesPanel(notes) : "";

  return `
<p class="pl-section-title">Cartons (${cartons.length})</p>
<table class="pl-carton-table" cellpadding="0" cellspacing="0">
  ${plPrintColgroup(sizeCols.length)}
  <thead>
    <tr>
      <th class="pl-center">Ctn #</th>
      ${sizeHeaderCols}
      <th class="pl-num">Total</th>
      <th class="pl-num">Wt</th>
    </tr>
  </thead>
  <tbody>${cartonRows}</tbody>
  <tfoot>
    <tr>
      <td class="pl-center">Total</td>
      ${unitTotalCols}
      <td class="pl-num">${grandTotal}</td>
      <td class="pl-num">${totalWeight > 0 ? totalWeight : "—"}</td>
    </tr>
  </tfoot>
</table>
${notesHtml}`;
}

// ── Full PO section ──────────────────────────────────────────────────────────

function buildPlPrintPoSectionHtml(row, { pageBreakAfter = false } = {}) {
  const poNum = plPrintVal(row["PO #"]);
  const style = plPrintVal(row["Style #"]);
  const color = plPrintVal(row["Color"]);
  const activeCartons = plActiveCartons(getPackingCartonsForPo(String(row["PO #"] ?? "")));
  const styleSubtitle = style !== "—"
    ? `<div class="pl-header-sub">${style} / ${color}</div>`
    : "";
  const pageClass = pageBreakAfter ? "pl-print-page" : "pl-print-page";

  return `
<div class="${pageClass}">
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
    ${buildPlPrintPoDetailsHtml(row, activeCartons.length)}
    ${buildPlPrintPackingListHtml(row)}
  </div>
</div>`;
}

// ── Public API ───────────────────────────────────────────────────────────────

function buildIndividualPackingListPrintHtml(poNumber) {
  const row = allRows.find(r => String(r["PO #"]) === String(poNumber));
  if (!row) return "<p>PO not found.</p>";
  return plPrintPageStyles() + buildPlPrintPoSectionHtml(row, { pageBreakAfter: false });
}

function buildGroupPackingListPrintHtml(poNumbers) {
  const rows = poNumbers
    .map(po => allRows.find(r => String(r["PO #"]) === String(po)))
    .filter(Boolean);
  if (rows.length === 0) return "<p>No POs found.</p>";
  return plPrintPageStyles() + rows.map((row, i) =>
    buildPlPrintPoSectionHtml(row, { pageBreakAfter: i < rows.length - 1 })
  ).join("\n");
}

function printPackingList({ poNumbers, mode = "individual" }) {
  const root = document.getElementById("packingPrintRoot");
  if (!root) return;

  const html = mode === "group"
    ? buildGroupPackingListPrintHtml(poNumbers)
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
