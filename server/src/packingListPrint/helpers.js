const KG_TO_LBS = 2.2046226218;
const CARTON_WEIGHT_LBS_FIELD = "Carton Weight (lbs)";

export function toQtyNumber(val) {
  const n = Number(String(val ?? "").trim());
  return Number.isFinite(n) ? n : 0;
}

export function getCartonWeightLbs(carton) {
  const lbs = toQtyNumber(carton[CARTON_WEIGHT_LBS_FIELD]);
  if (lbs > 0) return lbs;
  const kg = toQtyNumber(carton["Carton Weight"]);
  return kg > 0 ? Math.round(kg * KG_TO_LBS * 100) / 100 : 0;
}

export function formatDisplayDate(value) {
  const s = String(value ?? "").trim();
  if (!s) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return s;
  return `${m[2]}/${m[3]}/${m[1].slice(2)}`;
}

export function is12thTribeBuyer(buyer) {
  return String(buyer ?? "").trim().toUpperCase() === "12TH TRIBE";
}

export function normalizeLabelInputsByPo(labelInputs) {
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

export function getPackingListPdfOptions(type, entityId, requestData) {
  const configs = {
    asn: { label: "ASN", dateField: "ASN Date", filename: `ASN_${entityId}_PackingList.pdf` },
    delivery: { label: "Delivery", dateField: "Delivery Date", filename: `Delivery_${entityId}_PackingList.pdf` },
    pickup: { label: "Pickup", dateField: "Pickup Date", filename: `Pickup_${entityId}_PackingList.pdf` },
  };
  const config = configs[type];
  if (!config) return null;
  return {
    filename: config.filename,
    includeTitlePage: true,
    titleLabel: `${config.label} ${entityId}`,
    titlePageType: config.label,
    typeDate: requestData?.[config.dateField] ?? "",
    requestDate: requestData?.["Request Date"] ?? "",
    requestId: entityId,
    // ASN packing lists are buyer-facing — EXF Date is internal ops only.
    showExfDate: type !== "asn",
  };
}
