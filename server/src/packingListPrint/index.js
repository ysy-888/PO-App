import { PackingPrintContext } from "./data.js";
import { createPackingHtmlBuilder } from "./html.js";
import { htmlToPdfAttachment } from "./pdf.js";
import { getPackingListPdfOptions } from "./helpers.js";

function splitPoNumbers(value) {
  if (Array.isArray(value)) return value.map(String).map(s => s.trim()).filter(Boolean);
  return String(value ?? "").split(",").map(s => s.trim()).filter(Boolean);
}

function resolveAttachmentPoNumbers(poRows, requestData) {
  const fromRows = (poRows || []).map(row => row["PO #"]).filter(Boolean);
  if (fromRows.length > 0) return fromRows;
  return splitPoNumbers(requestData?.["PO Numbers"] || requestData?.["PO #"]);
}

export async function buildGroupPackingListPdfAttachment(supabase, tenantId, poNumbers, pdfOptions) {
  const ctx = await PackingPrintContext.load(supabase, tenantId, poNumbers);
  const builder = createPackingHtmlBuilder(ctx);
  const html = builder.buildGroupPackingListHtml(poNumbers, pdfOptions);
  return htmlToPdfAttachment(html, pdfOptions.filename);
}

export async function buildCartonLabelsPdfAttachment(supabase, tenantId, poNumbers, labelInputs, filename) {
  const ctx = await PackingPrintContext.load(supabase, tenantId, poNumbers);
  const builder = createPackingHtmlBuilder(ctx);
  const html = builder.buildCartonLabelsPrintHtml(poNumbers, labelInputs);
  return htmlToPdfAttachment(html, filename);
}

export async function buildRequestEmailAttachments(supabase, tenantId, {
  type,
  entityId,
  requestData,
  poRows,
}) {
  const poNumbers = resolveAttachmentPoNumbers(poRows, requestData);
  if (poNumbers.length === 0) return [];

  const pdfOptions = getPackingListPdfOptions(type, entityId, requestData);
  if (!pdfOptions) return [];
  pdfOptions.showInternalPoFields = false;

  const attachment = await buildGroupPackingListPdfAttachment(
    supabase,
    tenantId,
    poNumbers,
    pdfOptions
  );
  return [attachment];
}

export async function buildAsnPickupEmailAttachments(supabase, tenantId, {
  asnRequestId,
  asnData,
  poRows,
}) {
  const poNumbers = resolveAttachmentPoNumbers(poRows, asnData);
  if (poNumbers.length === 0) return [];

  const today = new Date().toISOString().slice(0, 10);
  const pickupRequestId = `ASN Pickup ${asnRequestId}`;

  const packingAttachment = await buildGroupPackingListPdfAttachment(
    supabase,
    tenantId,
    poNumbers,
    {
      filename: `${asnRequestId}_PackingList.pdf`,
      includeTitlePage: true,
      titleLabel: pickupRequestId,
      titlePageType: "Pickup",
      typeDate: asnData?.["ASN Date"] ?? "",
      requestDate: today,
      requestId: pickupRequestId,
      showInternalPoFields: false,
    }
  );

  return [packingAttachment];
}

export { PackingPrintContext } from "./data.js";
export { createPackingHtmlBuilder, wrapPrintHtml } from "./html.js";
