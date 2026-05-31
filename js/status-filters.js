/** @type {Record<string, unknown> | null} */
let modalRow = null;
/** @type {Record<string, unknown> | null} */
let modalSnapshot = null;

const EST_IHD_DAYS_BY_SHIP_METHOD = {
  "Air": 7,
  "Sea&Air": 14,
  "Matson": 21,
};

// Single source of truth for status filter, cell editor, and default table sort.
// Reorder entries to change sort priority (top = first). Add/remove statuses here only.
const STATUS_SORT_ORDER = [
  "Pending", "WIP", "Requested", "OTW", "Arrived at Port", "Scheduled",
  "In Warehouse", "Assigned", "Closed", "Hold", "CXL",
];

const STATUS_FILTER_OPEN = "__open__";
const STATUS_FILTER_SHIPPED = "__shipped__";
const STATUS_FILTER_EXF_REQ = "__exf_req__";
const OPEN_STATUSES = new Set(
  STATUS_SORT_ORDER.filter(status => status !== "CXL" && status !== "Closed")
);

/** Shared default status filter — Open POs until saved otherwise. */
let defaultStatusFilter = STATUS_FILTER_OPEN;

function isValidStatusFilter(value) {
  return value === "" ||
    value === STATUS_FILTER_OPEN ||
    value === STATUS_FILTER_SHIPPED ||
    value === STATUS_FILTER_EXF_REQ ||
    STATUS_SORT_ORDER.includes(value);
}

function setProgramDefaultStatusFilter(status) {
  if (!isValidStatusFilter(status)) return false;
  defaultStatusFilter = status;
  return true;
}

function applyDefaultStatusFilter(status) {
  if (!setProgramDefaultStatusFilter(status)) return false;
  setStatusFilter(status);
  return true;
}

function applyDefaultStatusFilterFromServer(statusFilter) {
  if (statusFilter === null || statusFilter === undefined) return false;
  return applyDefaultStatusFilter(statusFilter);
}

/** Workflow Status when set; otherwise infer Closed/CXL from N41 Status for filtering. */
function getRowWorkflowStatus(row) {
  const status = String(row["Status"] ?? "").trim();
  if (status) return status;
  const n41 = String(row["N41 Status"] ?? "").trim();
  if (n41 === "Closed") return "Closed";
  if (n41 === "CXL") return "CXL";
  return "";
}

function isN41OpenRow(row) {
  const n41 = String(row["N41 Status"] ?? "").trim();
  return n41 !== "Closed" && n41 !== "CXL";
}

function rowMatchesStatusFilter(row) {
  if (!activeStatus) return true;
  const status = getRowWorkflowStatus(row);
  if (activeStatus === STATUS_FILTER_OPEN) {
    if (status) return OPEN_STATUSES.has(status);
    return isN41OpenRow(row);
  }
  if (activeStatus === STATUS_FILTER_SHIPPED) {
    return rowMatchesShippedGroup(status);
  }
  if (activeStatus === STATUS_FILTER_EXF_REQ) {
    return isExfRequested(row);
  }
  if (!status) {
    const n41 = String(row["N41 Status"] ?? "").trim();
    return activeStatus === n41;
  }
  return status === activeStatus;
}

function statusSortIndex(status) {
  const i = STATUS_SORT_ORDER.indexOf(String(status ?? "").trim());
  return i === -1 ? STATUS_SORT_ORDER.length : i;
}

/** Default multi-column sort when no header sort is active (first = highest priority). */
const DEFAULT_SORT_COLUMNS = ["Status", "CXL Date", "Buyer", "Buyer PO #"];

const DIVISIONS = ["Elevator Disco", "Freesia"];

const DIVISION_BUYERS = {
  "Elevator Disco": [
    "ANTHROPOLOGIE",
    "BLOOMINGDALE'S",
    "URBAN OUTFITTERS",
    "NUULY",
    "Specialty",
  ],
  "Freesia": [
    "LULU'S",
    "12TH TRIBE",
    "SHORT STORY",
  ],
};

let activeDivision = "";
let activeStatus = STATUS_FILTER_OPEN;

const STATUS_FILTER_BUTTONS = [
  { label: "All", value: "" },
  { label: "Open", value: STATUS_FILTER_OPEN },
  { label: "Shipped", value: STATUS_FILTER_SHIPPED },
  { label: "Closed", value: "Closed" },
  { label: "WIP", value: "WIP" },
  { label: "EXF REQ", value: STATUS_FILTER_EXF_REQ },
  { label: "OTW", value: "OTW" },
  { label: "Assigned", value: "Assigned" },
];

function initStatusFilters() {
  const group = document.getElementById("statusFilters");
  if (!group) return;

  const makeBtn = (label, value) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "filter-btn";
    btn.dataset.status = value;
    btn.textContent = label;
    btn.onclick = () => setStatusFilter(value);
    return btn;
  };

  group.innerHTML = "";
  STATUS_FILTER_BUTTONS.forEach(({ label, value }) => group.appendChild(makeBtn(label, value)));
  document.querySelectorAll("#statusFilters .filter-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.status === activeStatus);
  });
}

function setStatusFilter(status) {
  activeStatus = status;
  document.querySelectorAll("#statusFilters .filter-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.status === status);
  });
  applyFilters();
}

function initDivisionFilters() {
  const group = document.getElementById("divisionFilters");
  if (!group) return;

  const makeBtn = (label, value) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "filter-btn";
    btn.dataset.division = value;
    btn.textContent = label;
    btn.onclick = () => setDivisionFilter(value);
    return btn;
  };

  group.innerHTML = "";
  group.appendChild(makeBtn("All", ""));
  DIVISIONS.forEach(d => group.appendChild(makeBtn(d, d)));
  document.querySelectorAll("#divisionFilters .filter-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.division === activeDivision);
  });
}

function setDivisionFilter(division) {
  activeDivision = division;
  document.querySelectorAll("#divisionFilters .filter-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.division === division);
  });
  pruneBuyerColumnFilter();
  if (openFilterCol === "Buyer") {
    filterDraft = getEffectiveFilterSelection("Buyer");
    renderColumnFilterList();
    const buyerHeader = document.querySelector('th.th-filterable[data-col="Buyer"]');
    if (buyerHeader) {
      requestAnimationFrame(() => positionColumnFilterPopover(buyerHeader));
    }
  }
  applyFilters();
}

const SHIP_OPTIONS = ["Air","Sea&Air","Matson"];

const SELECT_EDIT_COLS = new Set(["Status", "Ship Method"]);

const COLUMN_FILTER_COLS = [
  "Vendor", "Buyer", "Ship Method", "Shipment ID",
  "EST EXF", "EST IHD", "EXF", "ETA", "IHD", "CXL Date", "Assign Date",
];

const DATE_FILTER_COLS = new Set([
  "EST EXF", "EST IHD", "EXF", "ETA", "IHD", "CXL Date", "Assign Date",
]);

const BLANK_FILTER_LABEL = "(Blanks)";

/** @type {Record<string, Set<string> | null>} null = show all values */
const columnFilters = Object.fromEntries(COLUMN_FILTER_COLS.map(col => [col, null]));

let openFilterCol = null;
/** @type {Set<string>} */
let filterDraft = new Set();
