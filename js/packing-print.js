/** Packing list print functionality – individual (single PO) and group (multi-PO) layouts. */

// ── Shared style constants ──────────────────────────────────────────────────

const PL_PRINT_FONT = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";
const PL_PRINT_TH_STYLE = "padding:6px 8px;text-align:left;font-size:10px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#374151;background-color:#f0f1f3;border:1px solid #d1d5db;white-space:nowrap;";
const PL_PRINT_TH_NUM_STYLE = PL_PRINT_TH_STYLE + "text-align:right;";
const PL_PRINT_TD_STYLE = "padding:5px 8px;border:1px solid #d1d5db;font-size:11px;color:#1a1a18;vertical-align:middle;";
const PL_PRINT_TD_NUM_STYLE = PL_PRINT_TD_STYLE + "text-align:right;font-variant-numeric:tabular-nums;";
const PL_PRINT_TD_CENTER_STYLE = PL_PRINT_TD_STYLE + "text-align:center;color:#6b7280;font-variant-numeric:tabular-nums;";
const PL_PRINT_TD_TOTAL_STYLE = "padding:5px 8px;border:1px solid #d1d5db;font-size:11px;color:#1a1a18;font-weight:600;background-color:#eef0f3;vertical-align:middle;text-align:right;font-variant-numeric:tabular-nums;";
const PL_PRINT_SECTION_TITLE_STYLE = "margin:0 0 6px 0;font-size:10px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#374151;";
const PL_PRINT_META_LABEL_STYLE = "padding:5px 8px;font-size:10px;font-weight:600;color:#374151;background-color:#f0f1f3;border:1px solid #d1d5db;white-space:nowrap;";
const PL_PRINT_META_VALUE_STYLE = "padding:5px 8px;font-size:11px;color:#1a1a18;border:1px solid #d1d5db;";

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

function plPrintMoney(val) {
  if (!val || String(val).trim() === "") return "—";
  const n = Number(String(val).replace(/[$,]/g, ""));
  if (!Number.isFinite(n)) return plPrintEsc(String(val));
  return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── PO Details section ───────────────────────────────────────────────────────

function buildPlPrintPoDetailsHtml(row) {
  const metaRows = [
    ["PO #", plPrintVal(row["PO #"])],
    ["Buyer PO #", plPrintVal(row["Buyer PO #"])],
    ["SO #", plPrintVal(row["SO #"])],
    ["Vendor", plPrintVal(row["Vendor"])],
    ["Buyer", plPrintVal(row["Buyer"])],
    ["Division", plPrintVal(row["Division"])],
    ["Ship Method", plPrintVal(row["Ship Method"])],
    ["Status", plPrintVal(row["Status"])],
    ["PO Date", plPrintDate(row["PO Date"])],
    ["EXF Date", plPrintDate(row["EXF Date"] || row["EXF Request Date"] || row["EXF"])],
    ["IHD", plPrintDate(row["IHD"])],
    ["CXL Date", plPrintDate(row["CXL Date"])],
  ];

  const half = Math.ceil(metaRows.length / 2);
  const left = metaRows.slice(0, half);
  const right = metaRows.slice(half);

  function metaTable(pairs) {
    const rows = pairs.map(([label, val]) =>
      `<tr>
        <td style="${PL_PRINT_META_LABEL_STYLE}">${plPrintEsc(label)}</td>
        <td style="${PL_PRINT_META_VALUE_STYLE}">${val}</td>
      </tr>`
    ).join("");
    return `<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;">${rows}</table>`;
  }

  return `
<div style="margin-bottom:14px;">
  <p style="${PL_PRINT_SECTION_TITLE_STYLE}">PO Details</p>
  <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
    <tr>
      <td style="width:50%;vertical-align:top;padding-right:6px;">${metaTable(left)}</td>
      <td style="width:50%;vertical-align:top;">${metaTable(right)}</td>
    </tr>
  </table>
</div>`;
}

// ── Style Details section ────────────────────────────────────────────────────

function buildPlPrintStyleDetailsHtml(row) {
  const labels = getSizeLabelsFromRow(row);
  const poUnits = PO_UNIT_FIELDS.slice(0, labels.length).map((f, i) => toQtyNumber(row[f]));
  const actUnits = labels.map((_, i) => toQtyNumber(row[`Act Unit ${i + 1}`]));
  const poTotal = poUnits.reduce((s, n) => s + n, 0);
  const actTotal = actUnits.reduce((s, n) => s + n, 0);

  const hasActual = actUnits.some(n => n > 0);

  let sizeBreakdownHtml = "";
  if (labels.length > 0) {
    const colWidthPct = Math.floor(60 / labels.length);
    const sizeHeaderCols = labels.map(l =>
      `<th style="${PL_PRINT_TH_NUM_STYLE}width:${colWidthPct}%;">${plPrintEsc(l)}</th>`
    ).join("");
    const poUnitCols = poUnits.map(n =>
      `<td style="${PL_PRINT_TD_NUM_STYLE}">${n > 0 ? n : "0"}</td>`
    ).join("");
    const actUnitCols = actUnits.map(n =>
      `<td style="${PL_PRINT_TD_NUM_STYLE}">${n > 0 ? n : "0"}</td>`
    ).join("");

    sizeBreakdownHtml = `
<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-top:8px;">
  <thead>
    <tr>
      <th style="${PL_PRINT_TH_STYLE}width:20%;">Row</th>
      ${sizeHeaderCols}
      <th style="${PL_PRINT_TH_NUM_STYLE}width:80px;">Total</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="${PL_PRINT_TD_STYLE}font-weight:600;">PO Qty</td>
      ${poUnitCols}
      <td style="${PL_PRINT_TD_NUM_STYLE}font-weight:600;">${poTotal}</td>
    </tr>
    ${hasActual ? `<tr>
      <td style="${PL_PRINT_TD_STYLE}font-weight:600;">Packed Qty</td>
      ${actUnitCols}
      <td style="${PL_PRINT_TD_NUM_STYLE}font-weight:600;">${actTotal}</td>
    </tr>` : ""}
  </tbody>
</table>`;
  }

  const infoRows = [
    ["Style #", plPrintVal(row["Style #"])],
    ["Color", plPrintVal(row["Color"])],
    ["FOB Cost", plPrintMoney(row["FOB Cost"])],
    ["PO Total Cost", plPrintMoney(row["PO Total Cost"])],
    ["PO Qty", plPrintNum(row["PO Qty"])],
    ["Carton Qty", plPrintNum(row["Ctn Qty"])],
  ];
  const infoHtml = infoRows.map(([label, val]) =>
    `<tr>
      <td style="${PL_PRINT_META_LABEL_STYLE}">${plPrintEsc(label)}</td>
      <td style="${PL_PRINT_META_VALUE_STYLE}">${val}</td>
    </tr>`
  ).join("");

  return `
<div style="margin-bottom:14px;">
  <p style="${PL_PRINT_SECTION_TITLE_STYLE}">Style Details</p>
  <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:8px;">
    ${infoHtml}
  </table>
  ${sizeBreakdownHtml}
</div>`;
}

// ── Packing List section ─────────────────────────────────────────────────────

function buildPlPrintPackingListHtml(row) {
  const poNumber = String(row["PO #"] ?? "");
  const packingList = getPackingListForPo(poNumber);
  const cartons = getPackingCartonsForPo(poNumber);
  const labels = getSizeLabelsFromRow(row);

  if (!packingList && cartons.length === 0) {
    return `
<div style="margin-bottom:14px;">
  <p style="${PL_PRINT_SECTION_TITLE_STYLE}">Packing List</p>
  <p style="font-size:11px;color:#6b7280;font-style:italic;margin:4px 0;">No packing list on file.</p>
</div>`;
  }

  const colCount = labels.length;
  const colWidthPct = colCount > 0 ? Math.floor(50 / colCount) : 0;

  // Per-unit column totals
  const unitTotals = Array.from({ length: colCount }, (_, i) =>
    cartons.reduce((sum, carton) => sum + toQtyNumber(carton[`Unit ${i + 1}`]), 0)
  );
  const grandTotal = unitTotals.reduce((s, n) => s + n, 0);
  const totalWeight = cartons.reduce((s, c) => s + toQtyNumber(c["Carton Weight"]), 0);

  const sizeHeaderCols = labels.map(l =>
    `<th style="${PL_PRINT_TH_NUM_STYLE}width:${colWidthPct}%;">${plPrintEsc(l)}</th>`
  ).join("");

  const cartonRows = cartons.map(carton => {
    const rowTotal = labels.reduce((s, _, i) => s + toQtyNumber(carton[`Unit ${i + 1}`]), 0);
    const unitCols = labels.map((_, i) => {
      const n = toQtyNumber(carton[`Unit ${i + 1}`]);
      return `<td style="${PL_PRINT_TD_NUM_STYLE}">${n > 0 ? n : ""}</td>`;
    }).join("");
    const weight = toQtyNumber(carton["Carton Weight"]);
    return `<tr>
      <td style="${PL_PRINT_TD_CENTER_STYLE}">${plPrintEsc(String(carton["Carton #"] ?? ""))}</td>
      ${unitCols}
      <td style="${PL_PRINT_TD_NUM_STYLE}font-weight:600;">${rowTotal}</td>
      <td style="${PL_PRINT_TD_NUM_STYLE}">${weight > 0 ? weight : ""}</td>
    </tr>`;
  }).join("");

  const unitTotalCols = unitTotals.map(n =>
    `<td style="${PL_PRINT_TD_TOTAL_STYLE}">${n}</td>`
  ).join("");

  const notes = packingList ? String(packingList["Notes"] ?? "").trim() : "";
  const notesHtml = notes
    ? `<p style="font-size:11px;color:#4b5563;margin:6px 0 0 0;"><strong>Notes:</strong> ${plPrintEsc(notes)}</p>`
    : "";

  return `
<div style="margin-bottom:14px;">
  <p style="${PL_PRINT_SECTION_TITLE_STYLE}">Packing List <span style="font-weight:400;text-transform:none;letter-spacing:0;">(${cartons.length} carton${cartons.length !== 1 ? "s" : ""})</span></p>
  <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
    <thead>
      <tr>
        <th style="${PL_PRINT_TH_STYLE}width:40px;text-align:center;">Ctn #</th>
        ${sizeHeaderCols}
        <th style="${PL_PRINT_TH_NUM_STYLE}width:50px;">Total</th>
        <th style="${PL_PRINT_TH_NUM_STYLE}width:60px;">Weight</th>
      </tr>
    </thead>
    <tbody>
      ${cartonRows}
    </tbody>
    <tfoot>
      <tr>
        <td style="${PL_PRINT_TD_TOTAL_STYLE}text-align:center;">Totals</td>
        ${unitTotalCols}
        <td style="${PL_PRINT_TD_TOTAL_STYLE}">${grandTotal}</td>
        <td style="${PL_PRINT_TD_TOTAL_STYLE}">${totalWeight > 0 ? totalWeight : "—"}</td>
      </tr>
    </tfoot>
  </table>
  ${notesHtml}
</div>`;
}

// ── Full PO section ──────────────────────────────────────────────────────────

function buildPlPrintPoSectionHtml(row, { pageBreakAfter = false } = {}) {
  const poNum = plPrintVal(row["PO #"]);
  const style = plPrintVal(row["Style #"]);
  const color = plPrintVal(row["Color"]);
  const breakStyle = pageBreakAfter ? "page-break-after:always;" : "";

  return `
<div class="pl-print-po-section" style="${PL_PRINT_FONT}${breakStyle}margin:0;padding:24px 0;">
  <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:14px;background-color:#2d2d29;">
    <tr>
      <td style="padding:10px 14px;">
        <span style="font-size:13px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#ffffff;">ELEVATOR DISCO</span>
        <span style="font-size:11px;color:#d4d9df;margin-left:16px;letter-spacing:0.06em;text-transform:uppercase;">Packing List</span>
      </td>
      <td style="padding:10px 14px;text-align:right;white-space:nowrap;">
        <span style="font-size:12px;font-weight:600;color:#ffffff;">PO ${poNum}</span>
        ${style !== "—" ? `<span style="font-size:11px;color:#d4d9df;margin-left:10px;">${style} / ${color}</span>` : ""}
      </td>
    </tr>
  </table>
  ${buildPlPrintPoDetailsHtml(row)}
  ${buildPlPrintStyleDetailsHtml(row)}
  ${buildPlPrintPackingListHtml(row)}
</div>`;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Build full print HTML document for one PO (individual design).
 */
function buildIndividualPackingListPrintHtml(poNumber) {
  const row = allRows.find(r => String(r["PO #"]) === String(poNumber));
  if (!row) return "<p>PO not found.</p>";
  return buildPlPrintPoSectionHtml(row, { pageBreakAfter: false });
}

/**
 * Build full print HTML document for a list of PO numbers (group design).
 * Each PO gets a section; all but the last have page-break-after.
 */
function buildGroupPackingListPrintHtml(poNumbers) {
  const rows = poNumbers
    .map(po => allRows.find(r => String(r["PO #"]) === String(po)))
    .filter(Boolean);
  if (rows.length === 0) return "<p>No POs found.</p>";
  return rows.map((row, i) =>
    buildPlPrintPoSectionHtml(row, { pageBreakAfter: i < rows.length - 1 })
  ).join("\n");
}

/**
 * Render packing list HTML into #packingPrintRoot and trigger browser print.
 * @param {Object} opts
 * @param {string[]} opts.poNumbers
 * @param {"individual"|"group"} opts.mode
 */
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
