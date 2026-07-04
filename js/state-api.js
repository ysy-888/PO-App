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
let allStyles = [];
let allSalesOrders = [];
let allInvoices = [];
let packingListPanelOpen = false;
let flagFilterActive = false;
let sortCol = "SO CXL Date";
let sortDir = 1;
let pageSize = 60;
let currentPage = 1;
let soSortCol = "CXL Date";
let soSortDir = 1;
let soPageSize = 60;
let soCurrentPage = 1;
let invSortCol = "Invoice #";
let invSortDir = 1;
let invPageSize = 60;
let invCurrentPage = 1;

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
let styleMasterByKey = new Map();

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

function buildStyleMasterIndex(styles) {
  styleMasterByKey = new Map();
  (styles || []).forEach(entry => {
    const key = normalizeStyleColorKey(entry["Style #"], entry["Color"]);
    if (!key) return;
    styleMasterByKey.set(key, { ...entry });
  });
}

function getStyleMasterForRow(row) {
  return styleMasterByKey.get(normalizeStyleColorKey(row?.["Style #"], row?.["Color"])) || null;
}

function applyStyleSizesToRow(row) {
  if (!row) return row;
  const fromRow = SIZE_FIELDS.map(f => String(row[f] ?? "").trim()).filter(s => s !== "");
  if (fromRow.length > 0) return row;
  const master = getStyleMasterForRow(row);
  if (!master) return row;
  SIZE_FIELDS.forEach(field => {
    const val = String(master[field] ?? "").trim();
    if (val) row[field] = val;
  });
  if (!String(row["Style Category"] ?? "").trim() && String(master["Style Category"] ?? "").trim()) {
    row["Style Category"] = master["Style Category"];
  }
  return row;
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

function generateProvisionalPackingListId() {
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

const CARTON_WEIGHT_LBS_FIELD = "Carton Weight (lbs)";
const KG_TO_LBS = 2.2046226218;

function getCartonWeightLbs(carton) {
  const lbs = toQtyNumber(carton[CARTON_WEIGHT_LBS_FIELD]);
  if (lbs > 0) return lbs;
  const kg = toQtyNumber(carton["Carton Weight"]);
  return kg > 0 ? Math.round(kg * KG_TO_LBS * 100) / 100 : 0;
}

function getPackingWeightForPo(poNumber) {
  return getPackingCartonsForPo(poNumber).reduce(
    (sum, carton) => sum + getCartonWeightLbs(carton),
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

const API_FETCH_TIMEOUT_MS = 5 * 60 * 1000;
let userPreferenceSaveQueue = Promise.resolve();

/** POST to the Express API (SaaS backend). Requires a valid auth session. */
async function postApi(path, body, options = {}) {
  const token = typeof getAccessTokenAsync === "function"
    ? await getAccessTokenAsync()
    : (typeof getAccessToken === "function" ? getAccessToken() : null);
  if (!token) {
    throw new Error("Not signed in");
  }

  const timeoutMs = options.timeoutMs ?? API_FETCH_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${getApiBaseUrl()}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
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

function shouldUseDatabaseUserSettings() {
  return (
    typeof getAccessToken === "function" &&
    Boolean(getAccessToken())
  );
}

async function saveUserPreferencePatch(patch) {
  const json = await postApi("/api/settings/user-preferences", patch, { timeoutMs: 15000 });
  if (!json.success) throw new Error(json.error || "Failed to save settings.");
  return json;
}

function persistUserPreferencePatch(patch) {
  if (!shouldUseDatabaseUserSettings()) return false;

  userPreferenceSaveQueue = userPreferenceSaveQueue
    .then(() => saveUserPreferencePatch(patch))
    .catch(err => {
      if (typeof showIndicator === "function") {
        showIndicator("Settings save failed: " + err.message, "error");
      }
    });

  return true;
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
