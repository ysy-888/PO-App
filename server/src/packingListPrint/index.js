import { PackingPrintContext } from "./data.js";
import { createPackingHtmlBuilder } from "./html.js";
import { htmlToPdfAttachment } from "./pdf.js";
import { getPackingListPdfOptions, is12thTribeBuyer } from "./helpers.js";

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
  const poNumbers = (poRows || []).map(row => row["PO #"]).filter(Boolean);
  if (poNumbers.length === 0) return [];

  const pdfOptions = getPackingListPdfOptions(type, entityId, requestData);
  if (!pdfOptions) return [];

  try {
    const attachment = await buildGroupPackingListPdfAttachment(
      supabase,
      tenantId,
      poNumbers,
      pdfOptions
    );
    return [attachment];
  } catch (err) {
    console.error(`Failed to build packing list PDF for ${type} ${entityId}:`, err);
    return [];
  }
}

export async function buildAsnPickupEmailAttachments(supabase, tenantId, {
  asnRequestId,
  asnData,
  poRows,
  labelInputs,
}) {
  const poNumbers = (poRows || []).map(row => row["PO #"]).filter(Boolean);
  if (poNumbers.length === 0) return [];

  const today = new Date().toISOString().slice(0, 10);
  const pickupRequestId = `ASN Pickup ${asnRequestId}`;
  const attachments = [];

  try {
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
      }
    );
    attachments.push(packingAttachment);
  } catch (err) {
    console.error(`Failed to build ASN pickup packing list PDF for ${asnRequestId}:`, err);
  }

  if (is12thTribeBuyer(asnData?.["Buyer"])) {
    try {
      const labelAttachment = await buildCartonLabelsPdfAttachment(
        supabase,
        tenantId,
        poNumbers,
        labelInputs,
        `${asnRequestId}_CartonLabels.pdf`
      );
      attachments.push(labelAttachment);
    } catch (err) {
      console.error(`Failed to build carton label PDF for ${asnRequestId}:`, err);
    }
  }

  return attachments;
}

export { PackingPrintContext } from "./data.js";
export { createPackingHtmlBuilder, wrapPrintHtml } from "./html.js";
