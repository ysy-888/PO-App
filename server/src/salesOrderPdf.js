/**
 * Sales Order details PDF — the attachment for customer outreach emails.
 * Renders the same information as the app's Sales Order modal (header
 * fields, style lines with per-size units, totals) as a printable page,
 * then converts it with the shared packing-list PDF pipeline.
 */

import { htmlToPdfAttachment } from "./packingListPrint/pdf.js";

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toNum(value) {
  const n = Number(String(value ?? "").replace(/[$,]/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function fmtQty(n) {
  return Number(n || 0).toLocaleString("en-US");
}

function fmtMoney(n) {
  return Number(n || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function fmtDate(value) {
  const s = String(value ?? "").trim();
  if (!s) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${Number(m[2])}/${Number(m[3])}/${m[1]}`;
  return s;
}

function normalizeKeyPart(value) {
  return String(value ?? "").trim().toUpperCase();
}

/** Load size labels for the styles referenced by the order's lines. */
async function loadSizeLabelIndex(supabase, tenantId, lines) {
  const styleNums = [...new Set(
    (lines || []).map(l => String(l["Style #"] ?? "").trim()).filter(Boolean)
  )];
  if (styleNums.length === 0) return new Map();

  const { data, error } = await supabase
    .from("styles")
    .select("data")
    .eq("tenant_id", tenantId)
    .in("data->>Style #", styleNums);
  if (error) {
    console.warn("salesOrderPdf: styles lookup failed:", error.message);
    return new Map();
  }

  const index = new Map();
  (data || []).forEach(row => {
    const d = row.data || {};
    const key = `${normalizeKeyPart(d["Style #"])}|${normalizeKeyPart(d["Color"])}`;
    const labels = [];
    for (let i = 1; i <= 15; i++) {
      const lbl = String(d[`Size ${i}`] ?? "").trim();
      if (lbl) labels.push(lbl);
    }
    if (labels.length > 0) index.set(key, labels);
  });
  return index;
}

function getSizeLabels(line, labelIndex, maxSizeQty) {
  const key = `${normalizeKeyPart(line["Style #"])}|${normalizeKeyPart(line["Color"])}`;
  const labels = labelIndex.get(key);
  if (labels && labels.length >= maxSizeQty) return labels.slice(0, maxSizeQty);
  return null;
}

const TH = "padding:6px 8px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#374151;background:#f3f4f6;border:1px solid #d1d5db;text-align:left;";
const TD = "padding:6px 8px;font-size:10.5px;color:#1a1a18;border:1px solid #e5e7eb;vertical-align:middle;";
const TD_C = TD + "text-align:center;";
const TD_R = TD + "text-align:right;white-space:nowrap;";

function buildLinesTableHtml(lines, labelIndex) {
  if (!lines || lines.length === 0) {
    return `<p style="font-size:11px;color:#6b7280;">No style lines.</p>`;
  }

  let maxSizeQty = 0;
  lines.forEach(l => { maxSizeQty = Math.max(maxSizeQty, Number(l["Size Qty"] ?? 0)); });
  maxSizeQty = Math.min(Math.max(maxSizeQty, 1), 15);

  let sizeHeaders = null;
  for (const line of lines) {
    sizeHeaders = getSizeLabels(line, labelIndex, maxSizeQty);
    if (sizeHeaders) break;
  }
  if (!sizeHeaders) sizeHeaders = Array.from({ length: maxSizeQty }, (_, i) => String(i + 1));

  const head = `<tr>
<th style="${TH}">Style #</th>
<th style="${TH}">Description</th>
<th style="${TH}">Color</th>
${sizeHeaders.map(h => `<th style="${TH}text-align:center;padding:6px 4px;">${esc(h)}</th>`).join("")}
<th style="${TH}text-align:center;">Total</th>
<th style="${TH}text-align:right;">Price</th>
<th style="${TH}text-align:right;">Ext Price</th>
</tr>`;

  let sumUnits = 0;
  let sumExt = 0;
  const body = lines.map(line => {
    const sizeQty = Math.min(Number(line["Size Qty"] ?? maxSizeQty), 15);
    let lineTotal = 0;
    const unitCells = [];
    for (let i = 1; i <= maxSizeQty; i++) {
      if (i <= sizeQty) {
        const qty = toNum(line[`Unit ${i}`]);
        lineTotal += qty;
        unitCells.push(`<td style="${TD_C}padding:6px 4px;">${qty > 0 ? fmtQty(qty) : "—"}</td>`);
      } else {
        unitCells.push(`<td style="${TD_C}padding:6px 4px;color:#d1d5db;">—</td>`);
      }
    }
    const totalUnits = toNum(line["Total Units"]) || lineTotal;
    const price = toNum(line["Price"]);
    const extPrice = toNum(line["Ext Price"]);
    sumUnits += totalUnits;
    sumExt += extPrice;
    return `<tr>
<td style="${TD}font-family:monospace;">${esc(line["Style #"] ?? "—")}</td>
<td style="${TD}">${esc(line["Style Description"] ?? "")}</td>
<td style="${TD}">${esc(line["Color"] ?? "—")}</td>
${unitCells.join("")}
<td style="${TD_C}font-weight:700;">${fmtQty(totalUnits)}</td>
<td style="${TD_R}">${price > 0 ? fmtMoney(price) : "—"}</td>
<td style="${TD_R}">${extPrice > 0 ? fmtMoney(extPrice) : "—"}</td>
</tr>`;
  }).join("");

  const foot = `<tr>
<td style="${TD}background:#f3f4f6;font-weight:700;">${lines.length} Style${lines.length === 1 ? "" : "s"}</td>
<td style="${TD}background:#f3f4f6;"></td>
<td style="${TD}background:#f3f4f6;"></td>
${sizeHeaders.map(() => `<td style="${TD}background:#f3f4f6;"></td>`).join("")}
<td style="${TD_C}background:#f3f4f6;font-weight:700;">${fmtQty(sumUnits)}</td>
<td style="${TD}background:#f3f4f6;"></td>
<td style="${TD_R}background:#f3f4f6;font-weight:700;">${fmtMoney(sumExt)}</td>
</tr>`;

  return `<table style="width:100%;border-collapse:collapse;margin-top:14px;">
<thead>${head}</thead>
<tbody>${body}</tbody>
<tfoot>${foot}</tfoot>
</table>`;
}

function buildMetaFieldHtml(label, value) {
  return `<td style="padding:4px 18px 4px 0;">
<div style="font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;">${esc(label)}</div>
<div style="font-size:11px;color:#1a1a18;margin-top:1px;">${esc(value || "—")}</div>
</td>`;
}

export async function buildSalesOrderPdfAttachment(supabase, tenantId, soData) {
  const soNum = String(soData["SO #"] ?? "").trim();
  const lines = Array.isArray(soData.Lines) ? soData.Lines : [];
  const labelIndex = await loadSizeLabelIndex(supabase, tenantId, lines);

  const metaRow1 = [
    buildMetaFieldHtml("Customer PO #", soData["Customer PO #"]),
    buildMetaFieldHtml("Order Date", fmtDate(soData["Order Date"])),
    buildMetaFieldHtml("Ship Date", fmtDate(soData["Ship Date"])),
    buildMetaFieldHtml("CXL Date", fmtDate(soData["CXL Date"])),
    buildMetaFieldHtml("Store", soData["Store"]),
    buildMetaFieldHtml("Order Type", soData["Order Type"]),
  ].join("");

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;padding:36px 40px;color:#1a1a18;">
<table style="width:100%;border-collapse:collapse;border-bottom:2px solid #1a1a18;padding-bottom:10px;">
<tr>
<td style="padding-bottom:10px;">
  <div style="font-size:17px;font-weight:800;letter-spacing:0.02em;">ELEVATOR DISCO</div>
  <div style="font-size:9.5px;color:#6b7280;margin-top:2px;">www.elevatordisco.com</div>
</td>
<td style="padding-bottom:10px;text-align:right;">
  <div style="font-size:15px;font-weight:800;">SALES ORDER #${esc(soNum)}</div>
  <div style="font-size:11px;color:#374151;margin-top:2px;">${esc(soData["Customer"] ?? "")}</div>
</td>
</tr>
</table>
<table style="width:100%;border-collapse:collapse;margin-top:12px;"><tr>${metaRow1}</tr></table>
${buildLinesTableHtml(lines, labelIndex)}
<div style="margin-top:18px;font-size:9px;color:#9ca3af;">Generated ${fmtDate(new Date().toISOString().slice(0, 10))} · Elevator Disco</div>
</div>`;

  const safeSo = soNum.replace(/[^\w.-]+/g, "_") || "SalesOrder";
  return htmlToPdfAttachment(html, `SO_${safeSo}_Details.pdf`);
}
