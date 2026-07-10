/**
 * Bill of Lading PDF for ASN carrier pickup emails.
 * Ship-from comes from the ASN request's Pickup Address (defaulted from
 * Settings → ASN); ship-to is the buyer's address from the Customers DB.
 */

import { htmlToPdfAttachment } from "./packingListPrint/pdf.js";

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escMultiline(value) {
  return esc(value).replace(/\r?\n/g, "<br>");
}

function toNum(value) {
  const n = Number(String(value ?? "").replace(/[$,]/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function fmtQty(n) {
  return Number(n || 0).toLocaleString("en-US");
}

function fmtDate(value) {
  const s = String(value ?? "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${Number(m[2])}/${Number(m[3])}/${m[1]}`;
  return s || "—";
}

const BOX = "border:1.5px solid #1a1a18;padding:8px 10px;vertical-align:top;";
const BOX_LABEL = "font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#374151;margin-bottom:4px;";
const TH = "padding:6px 8px;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.05em;color:#1a1a18;background:#e5e7eb;border:1px solid #1a1a18;text-align:left;";
const TD = "padding:6px 8px;font-size:10.5px;color:#1a1a18;border:1px solid #6b7280;vertical-align:middle;";

export function buildAsnBolPdfAttachment({ requestId, asnData, poRows, pickupAddress, deliveryAddress }) {
  const asnDate = fmtDate(asnData?.["ASN Date"]);
  const buyer = String(asnData?.["Buyer"] ?? "").trim();
  const carrier = String(asnData?.["Carrier"] ?? "").trim();

  let totalCtn = 0;
  let totalUnits = 0;
  let totalWeight = 0;
  const rowsHtml = (poRows || []).map(row => {
    const ctn = toNum(row["Ctn Qty"]);
    const units = toNum(row["Actual Qty"]) || toNum(row["PO Qty"]);
    const weight = toNum(row["Weight"]);
    totalCtn += ctn;
    totalUnits += units;
    totalWeight += weight;
    return `<tr>
<td style="${TD}">${esc(row["PO #"] ?? "")}</td>
<td style="${TD}">${esc(row["Buyer PO #"] ?? "")}</td>
<td style="${TD}">${esc(row["Style #"] ?? "")}</td>
<td style="${TD}">${esc(row["Color"] ?? "")}</td>
<td style="${TD}text-align:center;">${ctn > 0 ? fmtQty(ctn) : "—"}</td>
<td style="${TD}text-align:center;">${units > 0 ? fmtQty(units) : "—"}</td>
<td style="${TD}text-align:right;">${weight > 0 ? `${fmtQty(weight)} lbs` : "—"}</td>
</tr>`;
  }).join("");

  const signatureCell = (label) => `<td style="width:33.33%;${BOX}height:64px;">
<div style="${BOX_LABEL}">${label}</div>
<div style="border-bottom:1px solid #1a1a18;height:28px;"></div>
<div style="font-size:8.5px;color:#6b7280;margin-top:3px;">Signature / Date</div>
</td>`;

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;padding:34px 38px;color:#1a1a18;">
<table style="width:100%;border-collapse:collapse;">
<tr>
<td style="padding-bottom:8px;">
  <div style="font-size:16px;font-weight:800;">ELEVATOR DISCO</div>
  <div style="font-size:9px;color:#6b7280;">www.elevatordisco.com</div>
</td>
<td style="padding-bottom:8px;text-align:right;">
  <div style="font-size:18px;font-weight:800;letter-spacing:0.04em;">BILL OF LADING</div>
  <div style="font-size:11px;color:#374151;margin-top:2px;">BOL # ${esc(requestId)} · Pickup Date ${esc(asnDate)}</div>
</td>
</tr>
</table>

<table style="width:100%;border-collapse:collapse;margin-top:10px;">
<tr>
<td style="width:50%;${BOX}">
  <div style="${BOX_LABEL}">Ship From (Pickup)</div>
  <div style="font-size:11px;line-height:1.5;">${escMultiline(pickupAddress || "—")}</div>
</td>
<td style="width:50%;${BOX}border-left:none;">
  <div style="${BOX_LABEL}">Ship To (Delivery)</div>
  <div style="font-size:11px;font-weight:700;">${esc(buyer || "—")}</div>
  <div style="font-size:11px;line-height:1.5;">${escMultiline(deliveryAddress || "—")}</div>
</td>
</tr>
<tr>
<td style="${BOX}border-top:none;">
  <div style="${BOX_LABEL}">Carrier</div>
  <div style="font-size:11px;">${esc(carrier || "—")}</div>
</td>
<td style="${BOX}border-top:none;border-left:none;">
  <div style="${BOX_LABEL}">Reference</div>
  <div style="font-size:11px;">ASN Request ${esc(requestId)} · ${esc(String((poRows || []).length))} PO${(poRows || []).length === 1 ? "" : "s"}</div>
</td>
</tr>
</table>

<table style="width:100%;border-collapse:collapse;margin-top:14px;">
<thead><tr>
<th style="${TH}">PO #</th>
<th style="${TH}">Buyer PO #</th>
<th style="${TH}">Style #</th>
<th style="${TH}">Color</th>
<th style="${TH}text-align:center;">Cartons</th>
<th style="${TH}text-align:center;">Units</th>
<th style="${TH}text-align:right;">Weight</th>
</tr></thead>
<tbody>${rowsHtml}</tbody>
<tfoot><tr>
<td style="${TD}background:#e5e7eb;font-weight:800;" colspan="4">TOTAL</td>
<td style="${TD}background:#e5e7eb;font-weight:800;text-align:center;">${fmtQty(totalCtn)}</td>
<td style="${TD}background:#e5e7eb;font-weight:800;text-align:center;">${fmtQty(totalUnits)}</td>
<td style="${TD}background:#e5e7eb;font-weight:800;text-align:right;">${totalWeight > 0 ? `${fmtQty(totalWeight)} lbs` : "—"}</td>
</tr></tfoot>
</table>

<table style="width:100%;border-collapse:collapse;margin-top:18px;">
<tr>
${signatureCell("Shipper")}
${signatureCell("Carrier / Driver")}
${signatureCell("Consignee")}
</tr>
</table>

<div style="margin-top:14px;font-size:8.5px;color:#9ca3af;">Generated ${fmtDate(new Date().toISOString().slice(0, 10))} · Elevator Disco · ASN ${esc(requestId)}</div>
</div>`;

  const safeId = String(requestId ?? "BOL").replace(/[^\w.-]+/g, "_");
  return htmlToPdfAttachment(html, `${safeId}_BOL.pdf`);
}
