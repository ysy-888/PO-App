let allRows = [];
let filteredRows = [];
let allChargebacks = [];
let allPackingLists = [];
let allPackingCartons = [];
let allVendorEmailRows = [];
let allContactRows = [];
let allLocationRows = [];
let allAsnRequests = [];
let allCustomers = [];
let packingListPanelOpen = false;
let flagFilterActive = false;
let sortCol = "CXL Date";
let sortDir = 1;
let pageSize = 60;
let currentPage = 1;

const DEMO_CONTACTS = [
  { Name: "Blue Fabrics", Type: "Vendor", Email: "demo@example.com", CC: "" },
  { Name: "Summit Goods", Type: "Vendor", Email: "demo@example.com", CC: "" },
  { Name: "Orient Mfg", Type: "Vendor", Email: "demo@example.com", CC: "" },
  { Name: "LULU'S FASHION LOUNGE", Type: "Buyer", Email: "demo-buyer@example.com", CC: "" },
  { Name: "12TH TRIBE", Type: "Buyer", Email: "demo-buyer@example.com", CC: "" },
  { Name: "FORERUNNER LOGISTICS", Type: "Logistics", Email: "demo-logistics@example.com", CC: "" },
];

const DEMO_CUSTOMERS = [
  {
    Customer: "12TH TRIBE",
    Address: "11872 LA GRANGE AVE",
    "Line 2": "",
    City: "LOS ANGELES",
    State: "CA",
    Zip: "90025",
    Country: "USA",
    Contact: "KAREN",
    "Phone #": "",
    Email: "finance@12thtribe.com",
    "Email Sent At": "2026-05-28",
  },
  {
    Customer: "LULUS",
    Address: "195 HUMBOLDT AVE",
    "Line 2": "",
    City: "CHICO",
    State: "CA",
    Zip: "95928",
    Country: "USA",
    Contact: "LULUS",
    "Phone #": "530-343-3545",
    Email: "ORDERS@LULUS.COM",
  },
];

const DEMO_LOCATIONS = [
  { Entity: "FORERUNNER LOGISTICS", Address: "4577 MAYWOOD AVE.\nVERNON, CA, 90058" },
  { Entity: "ELEVATOR DISCO", Address: "810 E PICO BLVD #B21\nLOS ANGELES, CA 90021" },
  { Entity: "LULU'S FASHION LOUNGE", Address: "" },
  { Entity: "12TH TRIBE", Address: "" },
];

const DEMO_DATA = [
  { "Division":"Elevator Disco","Status":"OTW","EXF Requested":true,"EXF Date":"2024-02-20","Vendor":"Acme Textiles","Buyer":"ANTHROPOLOGIE","Buyer PO #":"BP-1001","SO #":"SO-2201","PO Date":"2024-01-15","PO #":"PO-10001","Old PO #":"","Style #":"ST-100","Color":"Navy","PO Qty":500,"Actual Qty":498,"Ctn Qty":50,"Size":"XS-XL","PO Unit 1":100,"PO Unit 2":100,"PO Unit 3":120,"PO Unit 4":100,"PO Unit 5":80,"Act Unit 1":99,"Act Unit 2":100,"Act Unit 3":120,"Act Unit 4":99,"Act Unit 5":80,"Ship Method":"SEA&AIR","Vessel":"Ever Given","House #":"H-001","Shipped":"2024-02-01","ETD":"2024-02-05","ETA":"2024-02-20","IHD":"2024-02-25","EST EXF":"2024-02-18","EST IHD":"2024-02-24","EXF":"2024-02-20","CXL Date":"2024-03-01","Assign Date":"2024-01-20","Shipment ID":"SHP-0001","Notes":"Priority shipment" },
  { "Division":"Freesia","Status":"WIP","EXF Requested":false,"Vendor":"Blue Fabrics","Buyer":"LULU'S FASHION LOUNGE","Buyer PO #":"BP-1002","SO #":"SO-2202","PO Date":"2024-01-18","PO #":"PO-10002","Old PO #":"PO-9002","Style #":"ST-200","Color":"Blush","PO Qty":300,"Actual Qty":0,"Ctn Qty":30,"Size":"XXS-XXL","PO Unit 1":30,"PO Unit 2":40,"PO Unit 3":60,"PO Unit 4":60,"PO Unit 5":50,"PO Unit 6":40,"PO Unit 7":20,"Ship Method":"AIR","Vessel":"","House #":"","Shipped":"","ETD":"","ETA":"","IHD":"2024-03-15","EST EXF":"2024-03-08","EST IHD":"2024-03-14","EXF":"","CXL Date":"2024-04-01","Assign Date":"2024-01-22","Notes":"" },
  { "Division":"Elevator Disco","Status":"Requested","EXF Requested":true,"EXF Date":"2024-02-20","Vendor":"Orient Mfg","Buyer":"URBAN OUTFITTERS","Buyer PO #":"BP-1003","SO #":"SO-2203","PO Date":"2024-01-20","PO #":"PO-10003","Old PO #":"","Style #":"ST-301","Color":"Ivory","PO Qty":1000,"Actual Qty":1000,"Ctn Qty":100,"Size":"PL","PO Unit 1":300,"PO Unit 2":400,"PO Unit 3":300,"Act Unit 1":300,"Act Unit 2":400,"Act Unit 3":300,"Ship Method":"MATSON","Vessel":"","House #":"","Shipped":"","ETD":"","ETA":"","IHD":"","EST EXF":"2024-02-20","EST IHD":"2024-02-27","EXF":"","CXL Date":"2024-03-10","Assign Date":"2024-01-25","Notes":"Ready for shipment" },
  { "Division":"Freesia","Status":"Hold","EXF Requested":false,"Vendor":"Summit Goods","Buyer":"12TH TRIBE","Buyer PO #":"BP-1004","SO #":"SO-2204","PO Date":"2024-02-01","PO #":"PO-10004","Old PO #":"","Style #":"ST-410","Color":"Sage","PO Qty":200,"Actual Qty":0,"Ctn Qty":20,"Size":"XS-XL","PO Unit 1":40,"PO Unit 2":40,"PO Unit 3":40,"PO Unit 4":40,"PO Unit 5":40,"Ship Method":"AIR","Vessel":"","House #":"","Shipped":"","ETD":"","ETA":"","IHD":"2024-04-01","EST EXF":"","EST IHD":"","EXF":"","CXL Date":"2024-04-15","Assign Date":"","Notes":"Awaiting quality approval" },
  { "Division":"Elevator Disco","Status":"Closed","EXF Requested":true,"Vendor":"Pacific Imports","Buyer":"NUULY","Buyer PO #":"BP-1005","SO #":"SO-2205","PO Date":"2023-12-01","PO #":"PO-10005","Old PO #":"PO-8005","Style #":"ST-501","Color":"Black","PO Qty":750,"Actual Qty":750,"Ctn Qty":75,"Size":"XXS-XXL","PO Unit 1":100,"PO Unit 2":100,"PO Unit 3":150,"PO Unit 4":150,"PO Unit 5":100,"PO Unit 6":100,"PO Unit 7":50,"Act Unit 1":100,"Act Unit 2":100,"Act Unit 3":150,"Act Unit 4":150,"Act Unit 5":100,"Act Unit 6":100,"Act Unit 7":50,"Ship Method":"SEA&AIR","Vessel":"MSC Maya","House #":"H-099","Shipped":"2024-01-05","ETD":"2024-01-08","ETA":"2024-01-20","IHD":"2024-01-25","EST EXF":"2024-01-18","EST IHD":"2024-01-24","EXF":"2024-01-20","CXL Date":"2024-02-01","Assign Date":"2023-12-10","Shipment ID":"SHP-0002","Notes":"Completed" },
];

const DEMO_CHARGEBACKS = [
  { "Chargeback ID": "CB-0001", "PO #": "PO-10001", "Amount": 125, "Reason": "Short shipment", "Status": "Open", "Date": "2024-02-26", "Notes": "Review actual units" },
  { "Chargeback ID": "CB-0002", "PO #": "PO-10003", "Amount": 80, "Reason": "Late docs", "Status": "Approved", "Date": "2024-02-24", "Notes": "" },
];

const DEMO_SHIPMENTS = [
  {
    "Shipment ID": "SHP-0001",
    "Ship Method": "SEA&AIR",
    "Vessel": "Ever Given",
    "House #": "H-001",
    "EXF": "2024-02-20",
    "Shipped": "2024-02-01",
    "ETD": "2024-02-05",
    "ETA": "2024-02-20",
    "IHD": "2024-02-25",
    "Notes": "",
  },
  {
    "Shipment ID": "SHP-0002",
    "Ship Method": "SEA&AIR",
    "Vessel": "MSC Maya",
    "House #": "H-099",
    "EXF": "2024-01-20",
    "Shipped": "2024-01-05",
    "ETD": "2024-01-08",
    "ETA": "2024-01-20",
    "IHD": "2024-01-25",
    "Notes": "",
  },
];

const DEMO_PACKING_LISTS = [];
const DEMO_PACKING_CARTONS = [];

const DEMO_STYLE_PHOTOS = [
  {
    "Style #": "ST-100",
    "Color": "Navy",
    "Style Photo 1": "https://picsum.photos/seed/po10001a/300/400",
    "Style Photo 2": "https://picsum.photos/seed/po10001b/300/400",
  },
];

function resetLocalSelectedState(rows) {
  rows.forEach(row => { row["Selected"] = false; });
}

function normalizeChargeback(row) {
  return { ...row, Selected: false };
}

function normalizePackingList(row) {
  return { ...row };
}

function normalizePackingCarton(row) {
  return { ...row };
}

function getChargebackId(chargeback) {
  return String(chargeback?.[CHARGEBACK_ID_FIELD] ?? "").trim();
}

function getChargebackPoNumber(chargeback) {
  return String(chargeback?.["PO #"] ?? "").trim();
}

function getPackingListId(packingList) {
  return String(packingList?.[PACKING_LIST_ID_FIELD] ?? "").trim();
}

function getPackingListPoNumber(packingList) {
  return normalizePoNumber(packingList?.["PO #"]);
}

function normalizePoNumber(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const n = Number(raw);
  if (Number.isFinite(n)) return String(n);
  return raw;
}

// Indexed lookups for packing lists/cartons. Rebuilt lazily after any change
// to allPackingLists / allPackingCartons (signalled via invalidatePackingIndex).
let packingIndexVersion = 0;
let packingIndexBuilt = -1;
let packingListByPo = new Map();
let packingCartonsByList = new Map();

let stylePhotoByKey = new Map();

function normalizeStyleColorKey(styleNum, color) {
  const style = String(styleNum ?? "").trim().toLowerCase();
  const shade = String(color ?? "").trim().toLowerCase();
  if (!style || !shade) return "";
  return `${style}|${shade}`;
}

function buildStylePhotoIndex(stylePhotos) {
  stylePhotoByKey = new Map();
  (stylePhotos || []).forEach(entry => {
    const key = normalizeStyleColorKey(entry["Style #"], entry["Color"]);
    if (!key) return;
    stylePhotoByKey.set(key, {
      "Style Photo 1": normalizeStylePhotoUrl(entry["Style Photo 1"]),
      "Style Photo 2": normalizeStylePhotoUrl(entry["Style Photo 2"]),
    });
  });
}

function getStylePhotosForRow(row) {
  return stylePhotoByKey.get(normalizeStyleColorKey(row?.["Style #"], row?.["Color"])) || null;
}

function invalidatePackingIndex() {
  packingIndexVersion++;
}

function ensurePackingIndex_() {
  if (packingIndexBuilt === packingIndexVersion) return;
  packingListByPo = new Map();
  allPackingLists.forEach(packingList => {
    const po = getPackingListPoNumber(packingList);
    if (po && !packingListByPo.has(po)) packingListByPo.set(po, packingList);
  });
  packingCartonsByList = new Map();
  allPackingCartons.forEach(carton => {
    const id = String(carton?.[PACKING_LIST_ID_FIELD] ?? "").trim();
    if (!id) return;
    if (!packingCartonsByList.has(id)) packingCartonsByList.set(id, []);
    packingCartonsByList.get(id).push(carton);
  });
  packingCartonsByList.forEach(list =>
    list.sort((a, b) => Number(a["Carton #"] || 0) - Number(b["Carton #"] || 0))
  );
  packingIndexBuilt = packingIndexVersion;
}

function getPackingListForPo(poNumber) {
  const key = normalizePoNumber(poNumber);
  if (!key) return null;
  ensurePackingIndex_();
  return packingListByPo.get(key) ?? null;
}

function hasPackingList(poNumber) {
  return getPackingListForPo(poNumber) != null;
}

function getPackingCartonsForList(packingListId) {
  const key = String(packingListId ?? "").trim();
  if (!key) return [];
  ensurePackingIndex_();
  const cartons = packingCartonsByList.get(key);
  return cartons ? cartons.slice() : [];
}

function getPackingCartonsForPo(poNumber) {
  const packingList = getPackingListForPo(poNumber);
  return packingList ? getPackingCartonsForList(getPackingListId(packingList)) : [];
}

function generateDemoPackingListId() {
  const max = allPackingLists.reduce((highest, packingList) => {
    const m = /^PL-(\d+)$/.exec(getPackingListId(packingList));
    return Math.max(highest, m ? Number(m[1]) : 0);
  }, 0);
  return `PL-${String(max + 1).padStart(4, "0")}`;
}

function computeCartonTotal(carton) {
  return PO_UNIT_FIELDS.reduce((sum, _, index) => sum + toQtyNumber(carton[`Unit ${index + 1}`]), 0);
}

function computePackingTotalsByUnit(cartons) {
  return Array.from({ length: QTY_UNIT_COUNT }, (_, index) =>
    cartons.reduce((sum, carton) => sum + toQtyNumber(carton[`Unit ${index + 1}`]), 0)
  );
}

function getPackingUnitTotalsForPo(poNumber) {
  return computePackingTotalsByUnit(getPackingCartonsForPo(poNumber));
}

function getPackingActualQtyForPo(poNumber) {
  return getPackingUnitTotalsForPo(poNumber).reduce((sum, qty) => sum + qty, 0);
}

function getPackingActualQtyForRow(row) {
  return getPackingActualQtyForPo(row?.["PO #"]);
}

function getPackingCtnQtyForPo(poNumber) {
  const packingList = getPackingListForPo(poNumber);
  if (!packingList) return 0;
  const cartonCount = Number(packingList["Carton Count"]);
  if (Number.isFinite(cartonCount) && cartonCount > 0) return cartonCount;
  return getPackingCartonsForPo(poNumber).length;
}

function getPackingCtnQtyForRow(row) {
  return getPackingCtnQtyForPo(row?.["PO #"]);
}

function getPackingWeightForPo(poNumber) {
  return getPackingCartonsForPo(poNumber).reduce(
    (sum, carton) => sum + toQtyNumber(carton["Carton Weight"]),
    0
  );
}

function getChargebacksForPo(poNumber) {
  const key = String(poNumber ?? "").trim();
  if (!key) return [];
  return allChargebacks.filter(chargeback => getChargebackPoNumber(chargeback) === key);
}

function getChargebackTotalForPo(poNumber) {
  return getChargebacksForPo(poNumber).reduce((sum, chargeback) => {
    const n = Number(String(chargeback["Amount"] ?? "").replace(/[$,]/g, ""));
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}

function formatChargebackAmount(value) {
  const n = Number(String(value ?? "").replace(/[$,]/g, ""));
  if (!Number.isFinite(n)) return "$0.00";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function generateDemoChargebackId() {
  const max = allChargebacks.reduce((highest, chargeback) => {
    const m = /^CB-(\d+)$/.exec(getChargebackId(chargeback));
    return Math.max(highest, m ? Number(m[1]) : 0);
  }, 0);
  return `CB-${String(max + 1).padStart(4, "0")}`;
}

const APPS_SCRIPT_FETCH_TIMEOUT_MS = 5 * 60 * 1000;

async function postAppsScript(payload, options = {}) {
  if (isDemoMode()) {
    throw new Error("Not available in demo mode");
  }

  const timeoutMs = options.timeoutMs ?? APPS_SCRIPT_FETCH_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(getAppsScriptUrl(), {
      method: "POST",
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : {};
    } catch (_parseErr) {
      throw new Error(text.trim() || `HTTP ${res.status}`);
    }
    return json;
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("Request timed out");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

const CSV_IMPORT_BATCH_SIZE = 50;

const CSV_TO_SHEET_MAP = {
  poNo: "PO #",
  poDate: "PO Date",
  etaDate: "EST IHD",
  vendor: "Vendor",
  status: "N41 Status",
  division: "Division",
  shipVia: "Ship Method",
  orderNo: "SO #",
  user1: "Old PO #",
  custName: "Buyer",
  customerPo: "Buyer PO #",
  style: "Style #",
  color: "Color",
  category: "Style Category",
  totalUnit: "PO Qty",
  recQty: "Received Qty",
  cancelDate: "CXL Date",
  cost: "FOB Cost",
  extCost: "PO Total Cost",
};

for (let i = 1; i <= 15; i++) {
  CSV_TO_SHEET_MAP[`size${i}`] = `Size ${i}`;
  CSV_TO_SHEET_MAP[`value${i}`] = `PO Unit ${i}`;
}

const CSV_IMPORT_DATE_FIELDS = new Set(["PO Date", "EST IHD", "CXL Date"]);
