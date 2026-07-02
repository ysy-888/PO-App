const SITE_URL = "https://www.elevatordisco.com/";

const EMAIL_STYLES = `<style type="text/css">
  body.email-body {
    margin: 0;
    padding: 0;
    background-color: #f7f7f8;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    color: #1a1a18;
    -webkit-text-size-adjust: 100%;
  }
  .email-outer { width: 100%; background-color: #f7f7f8; }
  .email-container { background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
  .email-header { background-color: #2d2d29; color: #ffffff; padding: 20px 24px; }
  .email-logo { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; line-height: 1.2; }
  .email-content { padding: 24px; }
  .email-intro { margin: 0 0 20px 0; color: #4b5563; font-size: 14px; }
  .email-info-row { width: 100%; margin: 0 0 20px 0; }
  .email-info-meta { vertical-align: top; padding-right: 16px; }
  .email-info-notes { vertical-align: top; }
  .email-meta { width: 100%; border-collapse: collapse; margin: 0; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; }
  .email-meta td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  .email-meta tr:last-child td { border-bottom: none; }
  .email-meta-label { width: 110px; max-width: 110px; font-size: 12px; font-weight: 600; color: #374151; background-color: #f7f7f8; white-space: nowrap; }
  .email-meta-value { font-size: 14px; color: #1a1a18; background-color: #ffffff; }
  .email-meta-sub { display: block; margin-top: 4px; font-size: 13px; color: #6b7280; font-style: normal; }
  .email-notes-panel { margin: 0; padding: 14px 16px; background: transparent; border: 1px solid #e5e7eb; border-radius: 6px; min-height: 100px; }
  .email-section-title { font-size: 11px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: #374151; margin: 0 0 8px 0; }
  .email-notes-body { font-size: 14px; color: #1a1a18; white-space: pre-wrap; word-break: break-word; }
  .email-po-table { width: 100%; border-collapse: collapse; margin-top: 20px; border: 1px solid #e5e7eb; font-size: 13px; table-layout: auto; }
  .email-po-table th { padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: #374151; background-color: #f7f7f8; border-bottom: 1px solid #e5e7eb; white-space: nowrap; }
  .email-po-table tbody > tr > td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #1a1a18; vertical-align: top; }
  .email-po-table tbody > tr:last-child > td { border-bottom: none; }
  .email-po-table .email-num { text-align: right; font-variant-numeric: tabular-nums; }
  .email-po-table .email-row-num { text-align: center; color: #6b7280; font-variant-numeric: tabular-nums; }
  .email-po-table tfoot > tr > td { font-weight: 600; background-color: #eef0f3; color: #1a1a18; border-bottom: none; font-size: 13px; }
  .email-site-footer { margin: 24px 0 0 0; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center; }
  .email-site-footer a { font-size: 13px; color: #1a1a18; text-decoration: underline; }
  .email-header-request .email-heading { margin: 0 0 6px 0; font-size: 20px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: #ffffff; }
  .email-header-request .email-subheading { margin: 0; font-size: 16px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #d4d9df; }
  .email-header-request .email-request-id { font-size: 14px; font-weight: 500; color: #ffffff; }
  .email-header-request .email-request-date { margin-top: 4px; font-size: 12px; font-weight: 500; color: #d4d9df; }
  .email-po-table.email-exf-table { table-layout: auto; }
  .email-po-table.email-exf-table .email-memo-cell { min-width: 160px; width: 32%; word-break: break-word; white-space: normal; }
  @media only screen and (max-width: 600px) {
    .email-content { padding: 16px !important; }
    .email-header { padding: 16px !important; }
    .email-po-table th, .email-po-table td { padding: 8px !important; font-size: 12px !important; }
  }
</style>`;

const EMAIL_META_LABEL_STYLE = "width:110px;max-width:110px;padding:8px 12px;font-size:12px;font-weight:600;color:#374151;background-color:#f7f7f8;border-bottom:1px solid #e5e7eb;white-space:nowrap;";
const EMAIL_META_VALUE_STYLE = "padding:8px 12px;font-size:14px;color:#1a1a18;border-bottom:1px solid #e5e7eb;";
const EMAIL_PO_TH_STYLE = "padding:10px 12px;text-align:left;font-size:11px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#374151;background-color:#f7f7f8;border-bottom:1px solid #e5e7eb;white-space:nowrap;";
const EMAIL_PO_TD_STYLE = "padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#1a1a18;vertical-align:top;font-size:13px;";
const EMAIL_PO_TD_NUM_STYLE = EMAIL_PO_TD_STYLE + "text-align:right;";
const EMAIL_PO_TD_ROW_NUM_STYLE = EMAIL_PO_TD_STYLE + "text-align:center;color:#6b7280;";
const EMAIL_PO_FOOTER_TD_STYLE = "padding:10px 12px;font-weight:600;background-color:#eef0f3;color:#1a1a18;border-bottom:none;font-size:13px;";

const REQUEST_EMAIL_TABLE_COLUMNS = [
  "_num", "PO #", "Style #", "Buyer", "Buyer PO #", "Color", "Actual Qty", "Ctn Qty", "Weight",
];

const REQUEST_EMAIL_TABLE_LABELS = {
  "Actual Qty": "Unit Qty",
  "Buyer PO #": "Buyer PO",
};

const EXF_EMAIL_TABLE_COLUMNS = [
  "_num", "PO #", "Style #", "Buyer", "Buyer PO #", "PO Qty", "Ship Method", "CXL Date", "EXF Memo",
];

const EXF_EMAIL_TABLE_LABELS = {
  "PO Qty": "Order Qty",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function lineBreaks(value) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

function formatDate(value) {
  const s = String(value ?? "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return s;
  return `${m[2]}/${m[3]}/${m[1]}`;
}

function toQtyNumber(value) {
  const n = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function formatQty(value) {
  const n = toQtyNumber(value);
  if (Number.isInteger(n)) return n.toLocaleString();
  return (Math.round(n * 100) / 100).toLocaleString();
}

function formatQtyCell(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  return formatQty(value);
}

function formatWeight(value) {
  const n = toQtyNumber(value);
  if (n <= 0) return "";
  const rounded = Math.round(n * 100) / 100;
  const formatted = Number.isInteger(rounded)
    ? rounded.toLocaleString()
    : rounded.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return `${formatted} lbs`;
}

function getNote(data, fields) {
  for (const field of fields) {
    const value = String(data?.[field] ?? "").trim();
    if (value) return value;
  }
  return "";
}

function requestNotes(data, ...fields) {
  const notes = getNote(data, fields);
  return notes ? `\nNotes: ${notes}` : "";
}

function emailMetaRowStyles(isLastRow) {
  if (!isLastRow) return { label: EMAIL_META_LABEL_STYLE, value: EMAIL_META_VALUE_STYLE };
  return {
    label: EMAIL_META_LABEL_STYLE.replace("border-bottom:1px solid #e5e7eb;", ""),
    value: EMAIL_META_VALUE_STYLE.replace("border-bottom:1px solid #e5e7eb;", ""),
  };
}

function buildRequestHeaderHtml(requestTypeLabel, requestId, headerRequestDate) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
<tr><td class="email-header-titles" valign="middle" style="vertical-align:middle;">
<h1 class="email-heading" style="margin:0 0 6px 0;font-size:20px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#ffffff;line-height:1.2;">ELEVATOR DISCO</h1>
<p class="email-subheading" style="margin:0;font-size:16px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#d4d9df;line-height:1.3;">${escapeHtml(requestTypeLabel)}</p></td>
<td class="email-header-id" valign="middle" align="right" style="vertical-align:middle;text-align:right;white-space:nowrap;padding-left:16px;">
<div class="email-request-id" style="font-size:14px;font-weight:500;color:#ffffff;letter-spacing:0.02em;line-height:1.4;">${escapeHtml(requestId)}</div>
<div class="email-request-date" style="margin-top:4px;font-size:12px;font-weight:500;color:#d4d9df;line-height:1.3;">${escapeHtml(headerRequestDate)}</div></td></tr></table>`;
}

function buildCustomerHeaderHtml() {
  return `<p class="email-logo" style="margin:0;font-size:20px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;line-height:1.2;"><a href="${SITE_URL}" style="color:#ffffff;text-decoration:none;">Elevator Disco</a></p>`;
}

function buildSiteFooterHtml() {
  return `<p class="email-site-footer" style="margin:24px 0 0 0;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;">
<a href="${SITE_URL}" style="font-size:13px;color:#1a1a18;text-decoration:underline;">www.elevatordisco.com</a>
</p>`;
}

function wrapEmail({ headerHtml, contentHtml, footerPadding = "" }) {
  const footerRow = footerPadding
    ? `<tr><td style="${footerPadding}">${buildSiteFooterHtml()}</td></tr>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
${EMAIL_STYLES}
</head>
<body class="email-body">
<table class="email-outer" role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f7f7f8">
<tr>
<td align="center" style="padding:24px 12px;">
<table class="email-container" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:720px;width:100%;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:8px;">
<tr>
<td class="email-header email-header-request" style="background-color:#2d2d29;color:#ffffff;padding:20px 24px;">
${headerHtml}
</td>
</tr>
${contentHtml}
${footerRow}
</table>
</td>
</tr>
</table>
</body>
</html>`;
}

function buildNotesBlockHtml(notes) {
  const trimmed = String(notes ?? "").trim();
  const body = trimmed
    ? lineBreaks(trimmed)
    : `<span style="color:#8b929c;">-</span>`;
  return `<div class="email-notes-panel" style="margin:0;padding:14px 16px;min-height:100px;height:100%;background:transparent;border:1px solid #e5e7eb;border-radius:6px;">
<div class="email-section-title" style="font-size:11px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:#374151;margin:0 0 8px 0;">Notes</div>
<div class="email-notes-body" style="font-size:14px;color:#1a1a18;">${body}</div></div>`;
}

function buildMetaRow({ label, value, subValue }, isLastRow) {
  const styles = emailMetaRowStyles(isLastRow);
  const sub = String(subValue ?? "").trim()
    ? `<span class="email-meta-sub" style="display:block;margin-top:4px;font-size:13px;color:#6b7280;">${lineBreaks(subValue)}</span>`
    : "";
  return `<tr><td class="email-meta-label" style="${styles.label}">${escapeHtml(label)}</td><td class="email-meta-value" style="${styles.value}">${escapeHtml(value)}${sub}</td></tr>`;
}

function buildInfoRowHtml(metaRows, notes) {
  const rowsHtml = metaRows.map((row, index) => buildMetaRow(row, index === metaRows.length - 1)).join("");
  return `<table class="email-info-row" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 20px 0;">
<tr>
<td class="email-info-meta" valign="top" style="width:52%;padding-right:16px;">
<table class="email-meta" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;">
${rowsHtml}
</table>
</td>
<td class="email-info-notes" valign="top" style="width:48%;">
${buildNotesBlockHtml(notes)}
</td>
</tr>
</table>`;
}

function buildRequestEmailHtml({ requestTypeLabel, requestId, headerRequestDate, intro, metaRows, notes, bodyHtml }) {
  return wrapEmail({
    headerHtml: buildRequestHeaderHtml(requestTypeLabel, requestId, headerRequestDate),
    contentHtml: `<tr>
<td class="email-content" style="padding:24px;">
<p class="email-intro" style="margin:0 0 20px 0;color:#4b5563;">Hello,</p>
<p class="email-intro" style="margin:0 0 20px 0;color:#4b5563;">${escapeHtml(intro)}</p>
${buildInfoRowHtml(metaRows, notes)}
${bodyHtml}
${buildSiteFooterHtml()}
</td>
</tr>`,
  });
}

function buildCustomerEmailShell(bodyHtml) {
  return wrapEmail({
    headerHtml: buildCustomerHeaderHtml(),
    contentHtml: `<tr>
<td class="email-content" style="padding:24px;">
<div style="font-size:14px;line-height:1.6;color:#1a1a18;">${bodyHtml}</div>
</td>
</tr>`,
    footerPadding: "padding:0 24px 24px 24px;",
  });
}

function emailPoHeaderLabel(col, labels) {
  if (col === "_num") return "";
  return labels[col] || col;
}

function emailPoThExtraStyle(col, isExf = false) {
  if (isExf && col === "EXF Memo") return "min-width:160px;width:32%;white-space:normal;";
  if (col === "_num") return "width:36px;min-width:36px;max-width:36px;text-align:center;";
  if (col === "PO #") return "width:68px;min-width:68px;max-width:76px;";
  if (col === "House #") return "width:84px;min-width:84px;";
  if (col === "Weight") return "width:76px;min-width:76px;max-width:88px;";
  if (!isExf) return "";
  if (col === "Style #") return "width:72px;min-width:72px;max-width:88px;";
  if (col === "Buyer") return "width:80px;min-width:80px;max-width:96px;";
  if (col === "Buyer PO #") return "width:88px;min-width:88px;max-width:100px;";
  if (col === "PO Qty") return "width:72px;min-width:72px;max-width:80px;";
  if (col === "Ship Method") return "width:88px;min-width:88px;max-width:100px;";
  if (col === "CXL Date") return "width:80px;min-width:80px;max-width:88px;";
  return "";
}

function emailPoCellClass(col, isExf = false) {
  if (isExf && col === "EXF Memo") return " class=\"email-memo-cell\"";
  if (col === "_num") return " class=\"email-row-num\"";
  if (["Actual Qty", "Ctn Qty", "PO Qty", "Weight"].includes(col)) return " class=\"email-num\"";
  return "";
}

function emailPoCellStyle(col, isExf = false) {
  if (isExf && col === "EXF Memo") return EMAIL_PO_TD_STYLE + "min-width:160px;word-break:break-word;white-space:normal;";
  if (col === "_num") return EMAIL_PO_TD_ROW_NUM_STYLE;
  if (["Actual Qty", "Ctn Qty", "PO Qty", "Weight"].includes(col)) return EMAIL_PO_TD_NUM_STYLE;
  return EMAIL_PO_TD_STYLE;
}

function getPoCellValue(row, col, rowIndex) {
  if (col === "_num") return String(rowIndex + 1);
  if (col.includes("Date")) return formatDate(row[col]);
  if (["Actual Qty", "Ctn Qty", "PO Qty"].includes(col)) return formatQtyCell(row[col]);
  if (col === "Weight") return formatWeight(row[col]);
  return String(row[col] ?? "");
}

function computeTotals(rows) {
  return rows.reduce((totals, row) => {
    totals.unitQty += toQtyNumber(row["Actual Qty"]);
    totals.orderQty += toQtyNumber(row["PO Qty"]);
    totals.ctnQty += toQtyNumber(row["Ctn Qty"]);
    totals.weight += toQtyNumber(row.Weight);
    return totals;
  }, { unitQty: 0, orderQty: 0, ctnQty: 0, weight: 0 });
}

function getFooterLabelCol(columns, qtyFooterCol) {
  const qtyIdx = columns.indexOf(qtyFooterCol);
  if (qtyIdx <= 0) return null;
  for (let i = qtyIdx - 1; i >= 0; i--) {
    if (columns[i] !== "_num") return columns[i];
  }
  return null;
}

function buildPoTableFooterRowHtml(columns, totals, { hasCtnQty = true, qtyFooterCol = "Actual Qty" } = {}) {
  const labelCol = getFooterLabelCol(columns, qtyFooterCol);
  return `<tr>${columns.map(col => {
    const base = EMAIL_PO_FOOTER_TD_STYLE;
    if (col === "_num") return `<td style="${base}"></td>`;
    if (col === labelCol) return `<td style="${base}text-align:right;">Total</td>`;
    if (col === qtyFooterCol) {
      const qty = qtyFooterCol === "PO Qty" ? totals.orderQty : totals.unitQty;
      return `<td class="email-num" style="${base}text-align:right;">${escapeHtml(formatQty(qty))}</td>`;
    }
    if (col === "Ctn Qty" && hasCtnQty) {
      return `<td class="email-num" style="${base}text-align:right;">${escapeHtml(formatQty(totals.ctnQty))}</td>`;
    }
    if (col === "Weight") {
      return `<td class="email-num" style="${base}text-align:right;">${escapeHtml(formatWeight(totals.weight) || "0 lbs")}</td>`;
    }
    return `<td style="${base}"></td>`;
  }).join("")}</tr>`;
}

function buildPoTableHtml(rows, columns, labels, { isExf = false, hasCtnQty = true, qtyFooterCol = "Actual Qty" } = {}) {
  if (!rows.length) {
    return `<p style="margin:20px 0 0 0;color:#6b7280;">No linked POs.</p>`;
  }
  const headerCells = columns.map(col => `<th style="${EMAIL_PO_TH_STYLE}${emailPoThExtraStyle(col, isExf)}">${escapeHtml(emailPoHeaderLabel(col, labels))}</th>`).join("");
  const lastRowIndex = rows.length - 1;
  const bodyRows = rows.map((row, rowIndex) => {
    const isLastRow = rowIndex === lastRowIndex;
    return `<tr>${columns.map(col => {
      const value = getPoCellValue(row, col, rowIndex);
      let cellStyle = emailPoCellStyle(col, isExf);
      if (isLastRow) cellStyle = cellStyle.replace("border-bottom:1px solid #e5e7eb;", "border-bottom:none;");
      return `<td${emailPoCellClass(col, isExf)} style="${cellStyle}">${escapeHtml(value)}</td>`;
    }).join("")}</tr>`;
  }).join("");
  const totals = computeTotals(rows);
  const footerRow = buildPoTableFooterRowHtml(columns, totals, { hasCtnQty, qtyFooterCol });
  const exfClass = isExf ? " email-exf-table" : "";
  return `<table class="email-po-table${exfClass}" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;table-layout:auto;border-collapse:collapse;margin-top:20px;border:1px solid #e5e7eb;font-size:13px;">
<thead><tr>${headerCells}</tr></thead>
<tbody>${bodyRows}</tbody>
<tfoot>${footerRow}</tfoot>
</table>`;
}

function buildPoText(rows, columns, labels, { qtyFooterCol = "Actual Qty", hasCtnQty = true } = {}) {
  if (!rows.length) return "No linked POs.";
  const textColumns = columns.filter(col => col !== "_num");
  const lines = [["", ...textColumns.map(col => labels[col] || col)].join(" | ")];
  rows.forEach((row, rowIndex) => {
    lines.push([String(rowIndex + 1), ...textColumns.map(col => getPoCellValue(row, col, rowIndex))].join(" | "));
  });
  const totals = computeTotals(rows);
  const parts = [`${qtyFooterCol === "PO Qty" ? "Order Qty" : "Unit Qty"}: ${formatQty(qtyFooterCol === "PO Qty" ? totals.orderQty : totals.unitQty)}`];
  if (hasCtnQty) parts.push(`Ctn Qty: ${formatQty(totals.ctnQty)}`);
  if (textColumns.includes("Weight")) parts.push(`Weight: ${formatWeight(totals.weight) || "0 lbs"}`);
  lines.push("");
  lines.push(`Total | ${parts.join(" | ")}`);
  return lines.join("\n");
}

function buildApprovalUnitTableHtml(poRow, approvalData) {
  const labelStyle = "padding:6px 10px;font-size:11px;font-weight:600;color:#374151;background-color:#f7f7f8;border-bottom:1px solid #e5e7eb;white-space:nowrap;text-align:left;letter-spacing:0.03em;text-transform:uppercase;";
  const cellStyle = "padding:6px 10px;font-size:13px;color:#1a1a18;border-bottom:1px solid #e5e7eb;text-align:center;";
  const sizeLabels = [];
  const approvalUnits = [];

  for (let i = 1; i <= 15; i++) {
    const label = String(poRow?.[`Size ${i}`] ?? "").trim();
    const qtyValue = String(approvalData?.[`Approval Unit ${i}`] ?? "").trim();
    if (label || qtyValue) {
      sizeLabels.push(label || `Unit ${i}`);
      approvalUnits.push(qtyValue || "0");
    }
  }

  if (sizeLabels.length === 0) return "";

  const totalQty = approvalUnits.reduce((sum, value) => sum + toQtyNumber(value), 0);
  const headerRow = `<tr><td style="${labelStyle}">Size</td>${sizeLabels.map(label => `<td style="${labelStyle}text-align:center;">${escapeHtml(label)}</td>`).join("")}</tr>`;
  const dataRow = `<tr><td style="${cellStyle}text-align:left;font-weight:600;">Approval Qty</td>${approvalUnits.map(value => `<td style="${cellStyle}">${escapeHtml(value)}</td>`).join("")}</tr>`;
  const totalRow = `<tr><td style="padding:6px 10px;font-size:12px;font-weight:700;color:#374151;background-color:#f7f7f8;border-top:2px solid #e5e7eb;">Total</td>${sizeLabels.map((_, index) => `<td style="padding:6px 10px;font-size:12px;font-weight:${index === 0 ? "700" : "400"};color:#1a1a18;background-color:#f7f7f8;border-top:2px solid #e5e7eb;text-align:center;">${index === 0 ? escapeHtml(formatQty(totalQty)) : ""}</td>`).join("")}</tr>`;

  return `<div style="margin:0 0 20px 0;overflow-x:auto;"><p style="margin:0 0 8px 0;font-size:11px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:#374151;">Approval Quantities</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;">
${headerRow}${dataRow}${totalRow}
</table></div>`;
}

export function buildCustomerEmailHtml(body) {
  return buildCustomerEmailShell(lineBreaks(body));
}

export function buildExfEmail(requestId, data, poRows) {
  const displayDate = formatDate(data["EXF Date"]);
  const requestDate = formatDate(data["EXF Req Submit Date"] || data["Request Date"] || data["Created At"]);
  const vendor = String(data.Vendor ?? "").trim();
  const subject = `[ELEVATOR DISCO] EXF Request - ${displayDate}${vendor ? ` - ${vendor}` : ""}`.trim();
  const notes = getNote(data, ["EXF Req Notes"]);
  const text = [
    "Hello,",
    "",
    "Please confirm EXF readiness for the POs below.",
    "",
    `EXF Request: ${requestId}`,
    `Vendor: ${vendor}`,
    `EXF Date: ${displayDate}`,
    `PO Count: ${poRows.length}${requestNotes(data, "EXF Req Notes")}`,
    "",
    buildPoText(poRows, EXF_EMAIL_TABLE_COLUMNS, EXF_EMAIL_TABLE_LABELS, { qtyFooterCol: "PO Qty", hasCtnQty: false }),
    "",
    "www.elevatordisco.com",
  ].join("\n");
  const html = buildRequestEmailHtml({
    requestTypeLabel: "EXF Request",
    requestId,
    headerRequestDate: requestDate,
    intro: "Please confirm EXF readiness for the POs below.",
    metaRows: [
      { label: "Vendor", value: vendor },
      { label: "EXF Date", value: displayDate },
      { label: "PO Count", value: poRows.length },
    ],
    notes,
    bodyHtml: buildPoTableHtml(poRows, EXF_EMAIL_TABLE_COLUMNS, EXF_EMAIL_TABLE_LABELS, {
      isExf: true,
      hasCtnQty: false,
      qtyFooterCol: "PO Qty",
    }),
  });
  return { to: data["Vendor Email"], cc: data["EXF Req CC"], subject, text, html };
}

export function buildAsnEmail(requestId, data, poRows) {
  const displayDate = formatDate(data["ASN Date"]);
  const requestDate = formatDate(data["Request Date"] || data["ASN Req Submit Date"] || data["Created At"]);
  const buyer = String(data.Buyer ?? "").trim();
  const subject = `[ELEVATOR DISCO] ASN Request - ${displayDate}${buyer ? ` - ${buyer}` : ""}`.trim();
  const notes = getNote(data, ["ASN Req Notes"]);
  const text = [
    "Hello,",
    "",
    "Please see the ASN request below.",
    "",
    `ASN Request: ${requestId}`,
    `Request Date: ${requestDate}`,
    `ASN Date: ${displayDate}`,
    `Buyer: ${buyer}`,
    `PO Count: ${poRows.length}${requestNotes(data, "ASN Req Notes")}`,
    "",
    buildPoText(poRows, REQUEST_EMAIL_TABLE_COLUMNS, REQUEST_EMAIL_TABLE_LABELS),
    "",
    "www.elevatordisco.com",
  ].join("\n");
  const html = buildRequestEmailHtml({
    requestTypeLabel: "ASN Request",
    requestId,
    headerRequestDate: requestDate,
    intro: "Please see the ASN request below.",
    metaRows: [
      { label: "Request Date", value: requestDate },
      { label: "ASN Date", value: displayDate },
      { label: "Buyer", value: buyer },
      { label: "PO Count", value: poRows.length },
    ],
    notes,
    bodyHtml: buildPoTableHtml(poRows, REQUEST_EMAIL_TABLE_COLUMNS, REQUEST_EMAIL_TABLE_LABELS),
  });
  return { to: data["Buyer Email"], cc: data.CC, subject, text, html };
}

export function buildDeliveryPickupEmail(requestType, requestId, data, poRows) {
  const dateField = requestType === "Delivery" ? "Delivery Date" : "Pickup Date";
  const notesField = requestType === "Delivery" ? "Delivery Req Notes" : "Pickup Req Notes";
  const displayDate = formatDate(data[dateField]);
  const requestDate = formatDate(data["Request Date"] || data["Created At"]);
  const to = String(data.To ?? "").trim();
  const subject = `[ELEVATOR DISCO] ${requestType} Request - ${displayDate}${to ? ` - ${to}` : ""}`.trim();
  const notes = getNote(data, [notesField]);
  const text = [
    "Hello,",
    "",
    `Please see the ${requestType.toLowerCase()} request below.`,
    "",
    `${requestType} Request: ${requestId}`,
    `Request Date: ${requestDate}`,
    `${requestType} Date: ${displayDate}`,
    `PO Count: ${poRows.length}`,
    data.From ? `From: ${data.From}` : "",
    data["Pickup Address"] ? `Pickup Address: ${data["Pickup Address"]}` : "",
    data.To ? `To: ${data.To}` : "",
    data["Delivery Address"] ? `Delivery Address: ${data["Delivery Address"]}` : "",
    requestNotes(data, notesField).trim(),
    "",
    buildPoText(poRows, REQUEST_EMAIL_TABLE_COLUMNS, REQUEST_EMAIL_TABLE_LABELS),
    "",
    "www.elevatordisco.com",
  ].filter(line => line !== "").join("\n");
  const metaRows = [
    { label: "Request Date", value: requestDate },
    { label: `${requestType} Date`, value: displayDate },
    { label: "PO Count", value: poRows.length },
  ];
  if (String(data.From ?? "").trim()) metaRows.push({ label: "From", value: data.From, subValue: data["Pickup Address"] });
  if (to) metaRows.push({ label: "To", value: to, subValue: data["Delivery Address"] });
  const html = buildRequestEmailHtml({
    requestTypeLabel: `${requestType} Request`,
    requestId,
    headerRequestDate: requestDate,
    intro: `Please see the ${requestType.toLowerCase()} request below.`,
    metaRows,
    notes,
    bodyHtml: buildPoTableHtml(poRows, REQUEST_EMAIL_TABLE_COLUMNS, REQUEST_EMAIL_TABLE_LABELS),
  });
  return { to: data["Email To"], cc: data["Email CC"], subject, text, html };
}

export function buildApprovalEmail(approvalId, data, poRow = {}) {
  const type = String(data["Approval Type"] ?? "").trim();
  const poNumber = String(data["PO #"] ?? "").trim();
  const requestDate = formatDate(data["Request Date"] || data["Created At"]);
  const subject = `[ELEVATOR DISCO] Approval Request - ${type} - ${poNumber}`.trim();
  const notes = getNote(data, ["Approval Notes", "Approval Req Notes"]);
  const unitLines = Array.from({ length: 15 }, (_, index) => index + 1)
    .map(i => {
      const label = String(poRow[`Size ${i}`] ?? `Unit ${i}`).trim();
      const value = String(data[`Approval Unit ${i}`] ?? "").trim();
      return value ? `${label}: ${value}` : "";
    })
    .filter(Boolean);
  const text = [
    "Hello,",
    "",
    "Please see the approval request below.",
    "",
    `Approval Request: ${approvalId}`,
    `Request Date: ${requestDate}`,
    `PO #: ${poNumber}`,
    poRow["Style #"] ? `Style #: ${poRow["Style #"]}` : "",
    poRow.Buyer ? `Buyer: ${poRow.Buyer}` : "",
    `Approval Type: ${type}`,
    data["Ext CXL Date"] ? `Ext CXL Date: ${formatDate(data["Ext CXL Date"])}` : "",
    unitLines.length ? `Approval Quantities:\n${unitLines.join("\n")}` : "",
    requestNotes(data, "Approval Notes", "Approval Req Notes").trim(),
    "",
    "www.elevatordisco.com",
  ].filter(line => line !== "").join("\n");

  const metaRows = [
    { label: "Request Date", value: requestDate },
    { label: "PO #", value: poNumber },
  ];
  if (poRow["Style #"]) metaRows.push({ label: "Style #", value: poRow["Style #"] });
  if (poRow.Buyer) metaRows.push({ label: "Buyer", value: poRow.Buyer });
  metaRows.push({ label: "Approval Type", value: type });
  if (type === "Extension") metaRows.push({ label: "Ext CXL Date", value: formatDate(data["Ext CXL Date"]) });

  const typeBlockHtml = ["Shortage", "Overage"].includes(type)
    ? buildApprovalUnitTableHtml(poRow, data)
    : "";
  const html = buildRequestEmailHtml({
    requestTypeLabel: "Approval Request",
    requestId: approvalId,
    headerRequestDate: requestDate,
    intro: "Please see the approval request below.",
    metaRows,
    notes,
    bodyHtml: typeBlockHtml,
  });
  return { to: data["Email To"], cc: data["Email CC"], subject, text, html };
}
