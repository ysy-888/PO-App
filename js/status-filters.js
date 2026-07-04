/** @type {Record<string, unknown> | null} */
let modalRow = null;
/** @type {Record<string, unknown> | null} */
let modalSnapshot = null;

const EST_IHD_DAYS_BY_SHIP_METHOD = {
  "AIR": 7,
  "SEA&AIR": 14,
  "MATSON": 21,
};

const SHIP_METHOD_ALIASES = {
  air: "AIR",
  "sea&air": "SEA&AIR",
  matson: "MATSON",
};

function normalizeShipMethod(value) {
  const s = String(value ?? "").trim();
  if (!s) return "";
  return SHIP_METHOD_ALIASES[s.toLowerCase()] ?? s;
}

// Single source of truth for status filter, cell editor, and filter popover order.
// Table default sort uses STATUS_TABLE_SORT_ORDER below.
const STATUS_SORT_ORDER = [
  "Pending", "WIP", "Requested", "OTW",
  "In Warehouse", "Closed", "Hold", "CXL",
];

/** Default Status column sort priority (top = first). */
const STATUS_TABLE_SORT_ORDER = [
  "In Warehouse", "OTW", "Requested",
  "Hold", "WIP", "Pending", "CXL", "Closed",
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

/** Current toolbar/header status selection for Save as default. */
function resolveStatusFilterForProgramDefault() {
  syncStatusFilterFromHeaderSelection();
  if (statusFilterSelection === null) return "";
  if (statusFilterSelection.size === 1) return [...statusFilterSelection][0];
  return defaultStatusFilter;
}

function applyDefaultStatusFilter(status) {
  if (!setProgramDefaultStatusFilter(status)) return false;
  setStatusFilter(status);
  return true;
}

function applyDefaultStatusFilterFromServer(statusFilter) {
  if (statusFilter === null || statusFilter === undefined) {
    return applyDefaultStatusFilter(STATUS_FILTER_OPEN);
  }
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
  if (statusFilterSelection === null) return true;
  if (statusFilterSelection.size === 0) return false;
  for (const filter of statusFilterSelection) {
    if (rowMatchesSingleStatusFilter(row, filter)) return true;
  }
  return false;
}

function statusSortIndex(status) {
  const i = STATUS_TABLE_SORT_ORDER.indexOf(String(status ?? "").trim());
  return i === -1 ? STATUS_TABLE_SORT_ORDER.length : i;
}

/** Default multi-column sort when no header sort is active (first = highest priority). */
const DEFAULT_SORT_COLUMNS = ["SO CXL Date", "Status", "Buyer", "Buyer PO #"];

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
    "LULU'S FASHION LOUNGE",
    "12TH TRIBE",
    "SHORT STORY",
  ],
};

let activeDivision = "";
let activeStatus = STATUS_FILTER_OPEN;

/** null = all statuses; empty Set = none; otherwise match any selected filter. */
let statusFilterSelection = new Set([STATUS_FILTER_OPEN]);

const STATUS_FILTER_PRIMARY_GROUPS = [
  { label: "All", value: "" },
  { label: "Closed", value: "Closed" },
];

const STATUS_FILTER_SECONDARY_GROUPS = [
  { label: "Open", value: STATUS_FILTER_OPEN },
  { label: "WIP", value: "WIP" },
  { label: "EXF REQ", value: STATUS_FILTER_EXF_REQ },
  { label: "OTW", value: "OTW" },
  { label: "In WH", value: "In Warehouse" },
];

const STATUS_FILTER_COUNTED = [
  { label: "Open", value: STATUS_FILTER_OPEN },
  { label: "WIP", value: "WIP" },
  { label: "EXF REQ", value: STATUS_FILTER_EXF_REQ },
  { label: "OTW", value: "OTW" },
  { label: "In WH", value: "In Warehouse" },
];

const STATUS_FILTER_BUTTONS = [
  ...STATUS_FILTER_PRIMARY_GROUPS,
  { divider: true },
  ...STATUS_FILTER_SECONDARY_GROUPS,
];

const STATUS_FILTER_HEADER_GROUPS = [
  ...STATUS_FILTER_PRIMARY_GROUPS,
  ...STATUS_FILTER_SECONDARY_GROUPS,
];

function getStatusFilterHeaderValues() {
  const groupValues = new Set(STATUS_FILTER_HEADER_GROUPS.map(item => item.value));
  return [
    ...STATUS_FILTER_HEADER_GROUPS.map(item => item.value),
    ...STATUS_SORT_ORDER.filter(status => !groupValues.has(status)),
  ];
}

function getStatusFilterHeaderLabel(value) {
  const group = STATUS_FILTER_HEADER_GROUPS.find(item => item.value === value);
  if (group) return group.label;
  return value;
}

function rowMatchesSingleStatusFilter(row, filter) {
  if (!filter) return true;
  const status = getRowWorkflowStatus(row);
  if (filter === STATUS_FILTER_OPEN) {
    if (status) return OPEN_STATUSES.has(status);
    return isN41OpenRow(row);
  }
  if (filter === STATUS_FILTER_SHIPPED) {
    return rowMatchesShippedGroup(status);
  }
  if (filter === STATUS_FILTER_EXF_REQ) {
    return getRowWorkflowStatus(row) === "Requested";
  }
  if (!status) {
    const n41 = String(row["N41 Status"] ?? "").trim();
    return filter === n41;
  }
  return status === filter;
}

function rowPassesNonStatusFilters(row) {
  const div = activeDivision;
  if (div && row["Division"] !== div) return false;
  if (typeof flagFilterActive !== "undefined" && flagFilterActive && !isTruthy(row["Flag"])) return false;
  if (typeof rowPassesColumnFilters === "function" && !rowPassesColumnFilters(row)) return false;
  const q = typeof activeSearchQuery !== "undefined" ? activeSearchQuery : "";
  if (q) {
    const haystack = COLUMNS.map(c => String(getColumnFilterRawValue(c, row) ?? "")).join(" ").toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}

function setStatusFilterButtonLabel(btn, label, count) {
  btn.dataset.label = label;
  if (count === undefined) {
    btn.textContent = label;
    return;
  }
  btn.textContent = "";
  btn.append(
    document.createTextNode(label + " "),
    Object.assign(document.createElement("span"), {
      className: "filter-btn-count",
      textContent: String(count),
    })
  );
}

function updateStatusFilterCounts() {
  const group = document.getElementById("statusFilters");
  if (!group || typeof allRows === "undefined") return;

  const counts = Object.fromEntries(
    STATUS_FILTER_COUNTED.map(item => [item.value, 0])
  );

  for (const row of allRows) {
    if (!rowPassesNonStatusFilters(row)) continue;
    for (const item of STATUS_FILTER_COUNTED) {
      if (rowMatchesSingleStatusFilter(row, item.value)) counts[item.value]++;
    }
  }

  group.querySelectorAll(".filter-btn[data-show-count]").forEach(btn => {
    const value = btn.dataset.status;
    const label = btn.dataset.label ?? "";
    setStatusFilterButtonLabel(btn, label, counts[value] ?? 0);
  });
}

function initStatusFilters() {
  const group = document.getElementById("statusFilters");
  if (!group) return;

  const makeBtn = (label, value, showCount = false) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "filter-btn";
    btn.dataset.status = value;
    if (showCount) btn.dataset.showCount = "true";
    setStatusFilterButtonLabel(btn, label);
    btn.onclick = () => setStatusFilter(value);
    return btn;
  };

  group.innerHTML = "";
  STATUS_FILTER_BUTTONS.forEach(item => {
    if (item.divider) {
      const divider = document.createElement("div");
      divider.className = "filter-btn-group-divider";
      divider.setAttribute("aria-hidden", "true");
      group.appendChild(divider);
      return;
    }
    const showCount = STATUS_FILTER_COUNTED.some(entry => entry.value === item.value);
    group.appendChild(makeBtn(item.label, item.value, showCount));
  });
  syncStatusFilterToolbar();
  updateStatusFilterCounts();
}

function syncStatusFilterToolbar() {
  document.querySelectorAll("#statusFilters .filter-btn").forEach(btn => {
    const value = btn.dataset.status;
    const active = statusFilterSelection === null
      ? value === ""
      : statusFilterSelection.size === 1 && statusFilterSelection.has(value);
    btn.classList.toggle("active", active);
  });
  if (typeof updateColumnFilterHeaderStates === "function") updateColumnFilterHeaderStates();
}

function syncStatusFilterFromHeaderSelection() {
  if (statusFilterSelection === null) {
    activeStatus = "";
  } else if (statusFilterSelection.size === 1) {
    activeStatus = [...statusFilterSelection][0];
  } else {
    activeStatus = "";
  }
  syncStatusFilterToolbar();
}

function setStatusFilter(status) {
  activeStatus = status;
  statusFilterSelection = status === "" ? null : new Set([status]);
  syncStatusFilterToolbar();
  applyFilters();
}

function applyStatusFilterFromPopover(filterDraft) {
  const allValues = getStatusFilterHeaderValues();
  if (filterDraft.size === 0) {
    statusFilterSelection = new Set();
  } else if (filterDraft.size === allValues.length) {
    statusFilterSelection = null;
  } else {
    statusFilterSelection = new Set(filterDraft);
  }
  syncStatusFilterFromHeaderSelection();
  applyFilters();
}

function getEffectiveStatusFilterSelection() {
  if (statusFilterSelection === null) return new Set(getStatusFilterHeaderValues());
  return new Set(statusFilterSelection);
}

function isStatusHeaderFilterActive() {
  return statusFilterSelection !== null;
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

const SHIP_OPTIONS = ["AIR", "SEA&AIR", "MATSON"];

const SELECT_EDIT_COLS = new Set(["Status", "Ship Method"]);

const COLUMN_FILTER_COLS = [
  "Vendor", "Buyer", "Ship Method", "Shipment ID",
  "EST EXF", "EST IHD", "ETA", "IHD", "CXL Date", "SO CXL Date", "Assign Date",
];

const DATE_FILTER_COLS = new Set([
  "EST EXF", "EST IHD", "ETA", "IHD", "CXL Date", "SO CXL Date", "Assign Date",
]);

const BLANK_FILTER_LABEL = "(Blanks)";

/** @type {Record<string, Set<string> | null>} null = show all values */
const columnFilters = Object.fromEntries(COLUMN_FILTER_COLS.map(col => [col, null]));

/** @type {Record<string, { from: string|null, to: string|null } | null>} */
const dateColumnRangeFilters = Object.fromEntries(
  [...DATE_FILTER_COLS].map(col => [col, null])
);

let openFilterCol = null;
/** @type {Set<string>} */
let filterDraft = new Set();
/** @type {{ from: string|null, to: string|null }} */
let dateRangeDraft = { from: null, to: null };
