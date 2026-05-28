const APPS_SCRIPT_URL = "https://script.google.com/a/macros/elevatordisco.com/s/AKfycbyAipm-x3kYHv0LuMc0Ffkfmvj-U24U8UjnDNih92jz_mE3izKVU7NBJJMO_xB5CnJM6w/exec";

const EMPTY_DISPLAY = "\u2014";
const EN_DASH = "\u2013";
const ELLIPSIS = "\u2026";
const CHECK_MARK = "\u2713";

function setDisplayText(el, text) {
  el.textContent = text;
  el.classList.toggle("empty-display", text === EMPTY_DISPLAY);
}

function isEmptyValue(v) {
  if (v === null || v === undefined) return true;
  const s = String(v).trim();
  if (s === "") return true;
  return /^[\u2014\u2013\u2212-]+$/.test(s);
}

const COLUMNS = [
  "Division","Status","Vendor","Buyer","Buyer PO #","SO #","PO Date","PO #",
  "Old PO #","Style #","Color","PO Qty","Actual Qty","Ctn Qty","Ship Method","Vessel",
  "House #","Shipped","ETD","ETA","IHD","EST EXF","EST IHD","CXL Date","Assign Date","Notes"
];

const COLUMN_WIDTHS = [
  120, 130, 130, 120, 100, 80, 80, 80, 80, 100, 100, 60, 60, 60, 100, 100,
  80, 80, 80, 80, 80, 80, 80, 80, 80, 200
];

const COLUMN_VISIBILITY_KEY = "poTable.visibleColumns";

/** @type {Set<string>} */
let visibleColumns = new Set(COLUMNS);
/** @type {Set<string>} */
let columnVisibilityDraft = new Set(COLUMNS);

function visibleColumnCount() {
  return visibleColumns.size;
}

function loadColumnVisibility() {
  try {
    const raw = localStorage.getItem(COLUMN_VISIBILITY_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    const next = new Set(parsed.filter(col => COLUMNS.includes(col)));
    if (next.size > 0) visibleColumns = next;
  } catch {}
}

function saveColumnVisibility() {
  localStorage.setItem(COLUMN_VISIBILITY_KEY, JSON.stringify([...visibleColumns]));
}

function applyColumnVisibility() {
  const table = document.getElementById("poTable");
  if (!table) return;

  let minWidth = 0;
  let leadingSet = false;
  COLUMNS.forEach((col, i) => {
    const hidden = !visibleColumns.has(col);
    if (!hidden) minWidth += COLUMN_WIDTHS[i];
    const isLeading = !hidden && !leadingSet;
    if (isLeading) leadingSet = true;

    table.querySelector(`colgroup col:nth-child(${i + 1})`)?.classList.toggle("col-hidden", hidden);
    const thEl = table.querySelector(`thead th:nth-child(${i + 1})`);
    thEl?.classList.toggle("col-hidden", hidden);
    thEl?.classList.toggle("col-leading", isLeading);
    table.querySelectorAll(`tbody tr:not(.state-row) td:nth-child(${i + 1})`).forEach(td => {
      td.classList.toggle("col-hidden", hidden);
      td.classList.toggle("col-leading", isLeading);
    });
  });

  table.style.minWidth = `${Math.max(minWidth, 400)}px`;
}

function renderEditTableList() {
  const list = document.getElementById("editTableColumnList");
  if (!list) return;

  list.innerHTML = "";
  COLUMNS.forEach(col => {
    const label = document.createElement("label");
    label.className = "column-filter-option";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = col;
    cb.checked = columnVisibilityDraft.has(col);
    cb.addEventListener("change", () => {
      if (cb.checked) columnVisibilityDraft.add(col);
      else columnVisibilityDraft.delete(col);
    });

    const span = document.createElement("span");
    span.textContent = col;

    label.appendChild(cb);
    label.appendChild(span);
    list.appendChild(label);
  });
}

function positionEditTablePopover(anchorBtn) {
  const pop = document.getElementById("editTablePopover");
  if (!pop || !anchorBtn) return;

  const rect = anchorBtn.getBoundingClientRect();
  const maxLeft = window.innerWidth - pop.offsetWidth - 8;
  const left = Math.min(Math.max(8, rect.right - pop.offsetWidth), maxLeft);

  pop.style.top = `${rect.bottom + 4}px`;
  pop.style.left = `${left}px`;
}

function openEditTablePopover(anchorBtn) {
  columnVisibilityDraft = new Set(visibleColumns);
  const pop = document.getElementById("editTablePopover");
  if (!pop) return;

  pop.hidden = false;
  renderEditTableList();
  requestAnimationFrame(() => positionEditTablePopover(anchorBtn));
}

function closeEditTablePopover() {
  const pop = document.getElementById("editTablePopover");
  if (pop) pop.hidden = true;
}

function setEditTableDraftSelectAll(selectAll) {
  columnVisibilityDraft = selectAll ? new Set(COLUMNS) : new Set();
  renderEditTableList();
}

function applyEditTableFromPopover() {
  if (columnVisibilityDraft.size === 0) {
    showIndicator("Show at least one column", "error");
    return;
  }

  visibleColumns = new Set(columnVisibilityDraft);
  saveColumnVisibility();
  applyColumnVisibility();
  closeEditTablePopover();
}

function initEditTable() {
  document.getElementById("editTableBtn")?.addEventListener("click", e => {
    e.stopPropagation();
    const pop = document.getElementById("editTablePopover");
    if (!pop) return;
    if (pop.hidden) openEditTablePopover(e.currentTarget);
    else closeEditTablePopover();
  });

  document.getElementById("editTableSelectAll")?.addEventListener("click", () => setEditTableDraftSelectAll(true));
  document.getElementById("editTableClearAll")?.addEventListener("click", () => setEditTableDraftSelectAll(false));
  document.getElementById("editTableOk")?.addEventListener("click", applyEditTableFromPopover);
  document.getElementById("editTableCancel")?.addEventListener("click", closeEditTablePopover);

  document.addEventListener("click", e => {
    const pop = document.getElementById("editTablePopover");
    if (!pop || pop.hidden) return;
    if (pop.contains(e.target) || e.target.closest("#editTableBtn")) return;
    closeEditTablePopover();
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeEditTablePopover();
  });

  window.addEventListener("resize", () => {
    const pop = document.getElementById("editTablePopover");
    if (pop && !pop.hidden) {
      positionEditTablePopover(document.getElementById("editTableBtn"));
    }
  });
}

const EDITABLE = new Set([
  "PO Qty","Status","Ship Method","Ctn Qty","Vessel","House #",
  "Shipped","ETD","ETA","IHD","EST EXF","CXL Date","Assign Date","Notes"
]);

const READONLY_NO_SELECT_COLS = new Set(["Division", "PO Date", "Vendor"]);

const COPY_ON_CLICK_COLS = new Set([
  "Buyer", "Buyer PO #", "SO #", "PO #", "Old PO #", "Style #", "Color",
]);

const MODAL_SECTIONS = [
  {
    title: "PO Information",
    fields: ["Division", "PO Date", "Buyer PO #", "SO #", "Old PO #", "Status"],
  },
  {
    title: "Vendor & Buyer",
    fields: ["Vendor", "Buyer"],
  },
  {
    title: "Product",
    fields: ["Style #", "Color", "PO Qty", "Actual Qty", "Ctn Qty"],
  },
  {
    title: "Shipping",
    fields: ["Ship Method", "Vessel", "House #", "Shipped", "ETD", "ETA", "IHD"],
  },
  {
    title: "Dates",
    fields: ["EST EXF", "EST IHD", "CXL Date", "Assign Date"],
  },
  {
    title: "Notes",
    fields: ["Notes"],
    fullWidth: true,
  },
];

/** @type {Record<string, unknown> | null} */
let modalRow = null;

const EST_IHD_DAYS_BY_SHIP_METHOD = {
  "Air": 7,
  "Sea&Air": 14,
  "Matson": 21,
};

// Single source of truth for status filter, cell editor, and default table sort.
// Reorder entries to change sort priority (top = first). Add/remove statuses here only.
const STATUS_SORT_ORDER = [
  "OTW", "Received", "Arrived at Port", "Arrived at WH", 
  "Assigned", "WIP", "Requested", "Hold",  
  "Shipped", "CXL", "Closed", 
];

const STATUS_FILTER_OPEN = "__open__";
const OPEN_STATUSES = new Set(
  STATUS_SORT_ORDER.filter(status => status !== "CXL" && status !== "Closed")
);

function rowMatchesStatusFilter(row) {
  if (!activeStatus) return true;
  if (activeStatus === STATUS_FILTER_OPEN) {
    return OPEN_STATUSES.has(row["Status"]);
  }
  return row["Status"] === activeStatus;
}

function statusSortIndex(status) {
  const i = STATUS_SORT_ORDER.indexOf(String(status ?? "").trim());
  return i === -1 ? STATUS_SORT_ORDER.length : i;
}

const DIVISIONS = ["Elevator Disco", "Freesia"];

let activeDivision = "";
let activeStatus = "";

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
  group.appendChild(makeBtn("All", ""));
  group.appendChild(makeBtn("Open", STATUS_FILTER_OPEN));
  STATUS_SORT_ORDER.forEach(s => group.appendChild(makeBtn(s, s)));
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
  applyFilters();
}

const SHIP_OPTIONS = ["Air","Sea&Air","Matson"];

const SELECT_EDIT_COLS = new Set(["Status", "Ship Method"]);

const COLUMN_FILTER_COLS = ["Vendor", "Buyer", "Ship Method"];
const BLANK_FILTER_LABEL = "(Blanks)";

/** @type {Record<string, Set<string> | null>} null = show all values */
const columnFilters = {
  Vendor: null,
  Buyer: null,
  "Ship Method": null,
};

let openFilterCol = null;
/** @type {Set<string>} */
let filterDraft = new Set();

function normalizeFilterValue(val) {
  const s = String(val ?? "").trim();
  return s === "" ? BLANK_FILTER_LABEL : s;
}

function getUniqueColumnValues(col) {
  const values = new Set();
  allRows.forEach(row => values.add(normalizeFilterValue(row[col])));
  return [...values].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function isColumnFilterActive(col) {
  return columnFilters[col] != null;
}

function hasActiveColumnFilters() {
  return COLUMN_FILTER_COLS.some(col => columnFilters[col] != null);
}

function updateClearAllFiltersButton() {
  const btn = document.getElementById("clearAllColumnFiltersBtn");
  if (btn) btn.hidden = !hasActiveColumnFilters();
}

function clearAllColumnFilters() {
  COLUMN_FILTER_COLS.forEach(col => { columnFilters[col] = null; });
  closeColumnFilterPopover();
  updateColumnFilterHeaderStates();
  applyFilters();
}

function rowPassesColumnFilters(row) {
  for (const col of COLUMN_FILTER_COLS) {
    const selected = columnFilters[col];
    if (selected == null) continue;
    if (selected.size === 0) return false;
    if (!selected.has(normalizeFilterValue(row[col]))) return false;
  }
  return true;
}

function getEffectiveFilterSelection(col) {
  const selected = columnFilters[col];
  if (selected == null) return new Set(getUniqueColumnValues(col));
  return new Set(selected);
}

function updateColumnFilterHeaderStates() {
  document.querySelectorAll("th.th-filterable").forEach(th => {
    th.classList.toggle("filter-active", isColumnFilterActive(th.dataset.col));
  });
}

function renderColumnFilterList() {
  const list = document.getElementById("columnFilterList");
  if (!list || !openFilterCol) return;

  list.innerHTML = "";
  getUniqueColumnValues(openFilterCol).forEach(value => {
    const label = document.createElement("label");
    label.className = "column-filter-option";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = value;
    cb.checked = filterDraft.has(value);
    cb.addEventListener("change", () => {
      if (cb.checked) filterDraft.add(value);
      else filterDraft.delete(value);
    });

    const span = document.createElement("span");
    span.textContent = value;

    label.appendChild(cb);
    label.appendChild(span);
    list.appendChild(label);
  });
}

function positionColumnFilterPopover(anchorTh) {
  const pop = document.getElementById("columnFilterPopover");
  if (!pop || !anchorTh) return;

  const rect = anchorTh.getBoundingClientRect();
  const maxLeft = window.innerWidth - pop.offsetWidth - 8;
  const left = Math.min(Math.max(8, rect.left), maxLeft);

  pop.style.top = `${rect.bottom + 4}px`;
  pop.style.left = `${left}px`;
}

function openColumnFilterPopover(col, anchorTh) {
  const pop = document.getElementById("columnFilterPopover");
  if (!pop) return;

  openFilterCol = col;
  filterDraft = getEffectiveFilterSelection(col);

  pop.hidden = false;
  renderColumnFilterList();
  requestAnimationFrame(() => positionColumnFilterPopover(anchorTh));
}

function closeColumnFilterPopover() {
  const pop = document.getElementById("columnFilterPopover");
  if (pop) pop.hidden = true;
  openFilterCol = null;
}

function setFilterDraftSelectAll(selectAll) {
  if (!openFilterCol) return;
  const values = getUniqueColumnValues(openFilterCol);
  filterDraft = selectAll ? new Set(values) : new Set();
  renderColumnFilterList();
}

function applyColumnFilterFromPopover() {
  if (!openFilterCol) return;

  const col = openFilterCol;
  const allValues = getUniqueColumnValues(col);

  if (filterDraft.size === 0) {
    columnFilters[col] = new Set();
  } else if (filterDraft.size === allValues.length) {
    columnFilters[col] = null;
  } else {
    columnFilters[col] = new Set(filterDraft);
  }

  closeColumnFilterPopover();
  updateColumnFilterHeaderStates();
  applyFilters();
}

function initColumnFilterHeaders() {
  document.querySelectorAll("th.th-filterable").forEach(th => {
    const col = th.dataset.col;
    const label = th.querySelector(".th-label");
    if (label) {
      label.addEventListener("click", e => {
        e.stopPropagation();
        sortBy(col);
      });
    }
    th.addEventListener("click", () => openColumnFilterPopover(col, th));
  });

  document.getElementById("columnFilterSelectAll")?.addEventListener("click", () => setFilterDraftSelectAll(true));
  document.getElementById("columnFilterClearAll")?.addEventListener("click", () => setFilterDraftSelectAll(false));
  document.getElementById("columnFilterOk")?.addEventListener("click", applyColumnFilterFromPopover);
  document.getElementById("columnFilterCancel")?.addEventListener("click", closeColumnFilterPopover);
  document.getElementById("clearAllColumnFiltersBtn")?.addEventListener("click", clearAllColumnFilters);

  document.addEventListener("click", e => {
    const pop = document.getElementById("columnFilterPopover");
    if (!pop || pop.hidden) return;
    if (pop.contains(e.target) || e.target.closest("th.th-filterable")) return;
    closeColumnFilterPopover();
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeColumnFilterPopover();
  });

  window.addEventListener("resize", () => {
    if (openFilterCol) {
      const th = document.querySelector(`th.th-filterable[data-col="${CSS.escape(openFilterCol)}"]`);
      if (th) positionColumnFilterPopover(th);
    }
  });
}

const STATUS_BADGE = {
  "Received":"badge-received","Arrived at Port":"badge-port","Arrived at WH":"badge-wh",
  "Assigned":"badge-assigned","OTW":"badge-otw","Requested":"badge-requested",
  "Hold":"badge-hold","Cancelled":"badge-cancelled","WIP":"badge-wip",
  "Shipped":"badge-shipped","Closed":"badge-closed"
};

const DATE_FIELDS = new Set(["PO Date","Shipped","ETD","ETA","IHD","EST EXF","EST IHD","CXL Date","Assign Date"]);



let allRows = [];
let filteredRows = [];
let sortCol = "Status";
let sortDir = 1;
let pageSize = Infinity;
let currentPage = 1;

const DEMO_DATA = [
  { "Division":"Elevator Disco","Status":"Received","Vendor":"Acme Textiles","Buyer":"Kim","Buyer PO #":"BP-1001","SO #":"SO-2201","PO Date":"2024-01-15","PO #":"PO-10001","Old PO #":"","Style #":"ST-100","Color":"Navy","PO Qty":500,"Actual Qty":498,"Ctn Qty":50,"Ship Method":"Sea&Air","Vessel":"Ever Given","House #":"H-001","Shipped":"2024-02-01","ETD":"2024-02-05","ETA":"2024-02-20","IHD":"2024-02-25","EST EXF":"2024-02-18","EST IHD":"2024-02-24","CXL Date":"2024-03-01","Assign Date":"2024-01-20","Notes":"Priority shipment" },
  { "Division":"Freesia","Status":"WIP","Vendor":"Blue Fabrics","Buyer":"Sam","Buyer PO #":"BP-1002","SO #":"SO-2202","PO Date":"2024-01-18","PO #":"PO-10002","Old PO #":"PO-9002","Style #":"ST-200","Color":"Blush","PO Qty":300,"Actual Qty":0,"Ctn Qty":30,"Ship Method":"Air","Vessel":"","House #":"","Shipped":"","ETD":"2024-03-01","ETA":"2024-03-10","IHD":"2024-03-15","EST EXF":"2024-03-08","EST IHD":"2024-03-14","CXL Date":"2024-04-01","Assign Date":"2024-01-22","Notes":"" },
  { "Division":"Elevator Disco","Status":"Shipped","Vendor":"Orient Mfg","Buyer":"Lee","Buyer PO #":"BP-1003","SO #":"SO-2203","PO Date":"2024-01-20","PO #":"PO-10003","Old PO #":"","Style #":"ST-301","Color":"Ivory","PO Qty":1000,"Actual Qty":1000,"Ctn Qty":100,"Ship Method":"Matson","Vessel":"Matson Kona","House #":"H-202","Shipped":"2024-02-10","ETD":"2024-02-12","ETA":"2024-02-22","IHD":"2024-02-28","EST EXF":"2024-02-20","EST IHD":"2024-02-27","CXL Date":"2024-03-10","Assign Date":"2024-01-25","Notes":"Fragile - handle with care" },
  { "Division":"Freesia","Status":"Hold","Vendor":"Summit Goods","Buyer":"Kim","Buyer PO #":"BP-1004","SO #":"SO-2204","PO Date":"2024-02-01","PO #":"PO-10004","Old PO #":"","Style #":"ST-410","Color":"Sage","PO Qty":200,"Actual Qty":0,"Ctn Qty":20,"Ship Method":"Air","Vessel":"","House #":"","Shipped":"","ETD":"","ETA":"","IHD":"2024-04-01","EST EXF":"","EST IHD":"","CXL Date":"2024-04-15","Assign Date":"","Notes":"Awaiting quality approval" },
  { "Division":"Elevator Disco","Status":"Closed","Vendor":"Pacific Imports","Buyer":"Sam","Buyer PO #":"BP-1005","SO #":"SO-2205","PO Date":"2023-12-01","PO #":"PO-10005","Old PO #":"PO-8005","Style #":"ST-501","Color":"Black","PO Qty":750,"Actual Qty":750,"Ctn Qty":75,"Ship Method":"Sea&Air","Vessel":"MSC Maya","House #":"H-099","Shipped":"2024-01-05","ETD":"2024-01-08","ETA":"2024-01-20","IHD":"2024-01-25","EST EXF":"2024-01-18","EST IHD":"2024-01-24","CXL Date":"2024-02-01","Assign Date":"2023-12-10","Notes":"Completed" },
];

async function loadData() {
  showIndicator(`Refreshing${ELLIPSIS}`, "");
  try {
    if (APPS_SCRIPT_URL === "YOUR_APPS_SCRIPT_WEB_APP_URL_HERE") {
      allRows = DEMO_DATA;
    } else {
      const res = await fetch(APPS_SCRIPT_URL);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      allRows = json.data;
    }
    syncAllEstIhd(allRows);
    updateColumnFilterHeaderStates();
    applyFilters();
    showIndicator("Loaded", "success");
  } catch (err) {
    showIndicator("Load failed: " + err.message, "error");
  }
}

function applyFilters() {
  const q = document.getElementById("searchInput").value.toLowerCase();
  const div = activeDivision;
  filteredRows = allRows.filter(row => {
    if (div && row["Division"] !== div) return false;
    if (!rowMatchesStatusFilter(row)) return false;
    if (!rowPassesColumnFilters(row)) return false;
    if (q) {
      const haystack = COLUMNS.map(c => String(row[c] ?? "")).join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  if (sortCol) {
    filteredRows.sort((a, b) => {
      if (sortCol === "Status") {
        return (statusSortIndex(a.Status) - statusSortIndex(b.Status)) * sortDir;
      }
      const av = a[sortCol] ?? "";
      const bv = b[sortCol] ?? "";
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * sortDir;
    });
  }

  currentPage = 1;
  renderTable();
  updateClearAllFiltersButton();
}

function isPageSizeAll() {
  return !Number.isFinite(pageSize);
}

function getTotalPages() {
  if (isPageSizeAll() || filteredRows.length === 0) return 1;
  return Math.ceil(filteredRows.length / pageSize);
}

function getPagedRows() {
  if (isPageSizeAll()) return filteredRows;
  const totalPages = getTotalPages();
  currentPage = Math.min(Math.max(1, currentPage), totalPages);
  const start = (currentPage - 1) * pageSize;
  return filteredRows.slice(start, start + pageSize);
}

function updateRowCounter() {
  const el = document.getElementById("rowCounter");
  if (!el) return;

  const total = filteredRows.length;
  if (total === 0) {
    el.textContent = "0 rows";
    return;
  }

  if (isPageSizeAll()) {
    el.textContent = `${total} row${total === 1 ? "" : "s"}`;
    return;
  }

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, total);
  el.textContent = `${start}${EN_DASH}${end} of ${total}`;
}

function updatePaginationUI() {
  const nav = document.getElementById("paginationNav");
  if (!nav) return;

  const totalPages = getTotalPages();
  const showPagination = !isPageSizeAll() && filteredRows.length > pageSize;
  nav.hidden = !showPagination;

  if (!showPagination) return;

  const indicator = document.getElementById("pageIndicator");
  if (indicator) indicator.textContent = `${currentPage} / ${totalPages}`;

  const first = document.getElementById("pageFirst");
  const prev = document.getElementById("pagePrev");
  const next = document.getElementById("pageNext");
  const last = document.getElementById("pageLast");
  const onFirst = currentPage <= 1;
  const onLast = currentPage >= totalPages;

  if (first) first.disabled = onFirst;
  if (prev) prev.disabled = onFirst;
  if (next) next.disabled = onLast;
  if (last) last.disabled = onLast;
}

function scrollTableToTop() {
  document.querySelector(".table-scroll-y")?.scrollTo({ top: 0 });
}

function goToPage(page) {
  const totalPages = getTotalPages();
  const nextPage = Math.min(Math.max(1, page), totalPages);
  if (nextPage === currentPage) return;
  currentPage = nextPage;
  closeCellSelectDropdown(false);
  renderTable();
  scrollTableToTop();
}

function setPageSize(value) {
  pageSize = value === "all" ? Infinity : Number(value);
  currentPage = 1;
  closeCellSelectDropdown(false);
  renderTable();
}

function initPagination() {
  const select = document.getElementById("pageSizeSelect");
  select?.addEventListener("change", () => setPageSize(select.value));

  document.getElementById("pageFirst")?.addEventListener("click", () => goToPage(1));
  document.getElementById("pagePrev")?.addEventListener("click", () => goToPage(currentPage - 1));
  document.getElementById("pageNext")?.addEventListener("click", () => goToPage(currentPage + 1));
  document.getElementById("pageLast")?.addEventListener("click", () => goToPage(getTotalPages()));
}

function updateSortHeaders() {
  document.querySelectorAll("thead th[data-col]").forEach(th => {
    th.classList.remove("sorted-asc", "sorted-desc");
    if (sortCol && th.dataset.col === sortCol) {
      th.classList.add(sortDir === 1 ? "sorted-asc" : "sorted-desc");
    }
  });
}

function sortBy(col) {
  if (sortCol === col) sortDir *= -1;
  else { sortCol = col; sortDir = 1; }
  updateSortHeaders();
  applyFilters();
}

function formatDateForDisplay(v) {
  if (isEmptyValue(v)) return EMPTY_DISPLAY;

  const s = String(v).trim();

  // Accept either YYYY-MM-DD or full ISO timestamps like 2026-04-22T07:00:00.000Z
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/.exec(s);
  if (!m) return s; // fallback: don't change unknown formats

  const [, yyyy, mm, dd] = m;
  return `${Number(mm)}/${Number(dd)}/${yyyy.slice(2)}`;
}

function normalizeToYmd(v) {
  if (isEmptyValue(v)) return "";
  const s = String(v).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return s;
}

function parseYmdToLocalDate(ymd) {
  const normalized = normalizeToYmd(ymd);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function formatDateToYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function calculateEstIhd(shipMethod, estExf) {
  if (isEmptyValue(shipMethod) || isEmptyValue(estExf)) return "";

  const method = String(shipMethod).trim();
  const exfYmd = normalizeToYmd(estExf);
  if (!exfYmd) return "";

  const days = EST_IHD_DAYS_BY_SHIP_METHOD[method];
  if (days == null) return "";

  const base = parseYmdToLocalDate(exfYmd);
  if (!base) return "";

  base.setDate(base.getDate() + days);
  return formatDateToYmd(base);
}

function syncEstIhdForRow(row) {
  row["EST IHD"] = calculateEstIhd(row["Ship Method"], row["EST EXF"]);
  return row["EST IHD"];
}

function syncAllEstIhd(rows) {
  rows.forEach(syncEstIhdForRow);
}

function renderTable() {
  closeCellSelectDropdown(false);
  const tbody = document.getElementById("tableBody");
  const rowsToRender = getPagedRows();
  updateRowCounter();
  updatePaginationUI();

  if (filteredRows.length === 0) {
    tbody.innerHTML = `<tr class="state-row"><td colspan="${visibleColumnCount()}">No POs match your filters.</td></tr>`;
    applyColumnVisibility();
    return;
  }

  tbody.innerHTML = "";
  rowsToRender.forEach(row => {
    const tr = document.createElement("tr");
    tr.dataset.po = row["PO #"];

    tr.className = "clickable-row";
    tr.ondblclick = () => openPODetail(row);

    COLUMNS.forEach(col => {
      const td = document.createElement("td");
      td.dataset.col = col;
      const editable = EDITABLE.has(col);
      const val = col === "EST IHD"
        ? calculateEstIhd(row["Ship Method"], row["EST EXF"])
        : (row[col] ?? "");

      if (editable) {
        td.className = "editable";
        td.title = SELECT_EDIT_COLS.has(col) ? "Click to choose" : "Click to edit";
        bindEditableCell(td, col, row);
      } else if (READONLY_NO_SELECT_COLS.has(col)) {
        td.className = "readonly readonly-no-select";
      } else if (COPY_ON_CLICK_COLS.has(col)) {
        td.className = "readonly readonly-copy";
        td.title = "Click to copy";
        td.addEventListener("click", e => {
          e.stopPropagation();
          copyCellValue(col, row[col]);
        });
      } else {
        td.className = "readonly";
      }

      if (col === "Status") {
        td.innerHTML = renderStatus(val);
      } else if (DATE_FIELDS.has(col)) {
        setDisplayText(td, formatDateForDisplay(val));
      } else if (isEmptyValue(val)) {
        setDisplayText(td, EMPTY_DISPLAY);
      } else {
        td.textContent = val;
        td.classList.remove("empty-display");
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  applyColumnVisibility();
}

function renderStatus(val) {
  if (isEmptyValue(val)) return `<span class="empty-display">${EMPTY_DISPLAY}</span>`;
  const cls = STATUS_BADGE[val] || "badge-cancelled";
  return `<span class="badge ${cls}">${val}</span>`;
}

function getCopyText(col, rawVal) {
  if (isEmptyValue(rawVal)) return "";
  if (DATE_FIELDS.has(col)) return formatDateForDisplay(rawVal);
  return String(rawVal).trim();
}

async function copyCellValue(col, rawVal) {
  const text = getCopyText(col, rawVal);
  if (!text || text === EMPTY_DISPLAY) {
    showIndicator("Nothing to copy", "error");
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    showIndicator(`Copied ${text}`, "success");
  } catch {
    showIndicator("Copy failed", "error");
  }
}

/** @type {{ anchor: HTMLElement, col: string, row: Record<string, unknown> } | null} */
let openCellSelect = null;

function getCellSelectOptions(col) {
  if (col === "Status") {
    return STATUS_SORT_ORDER.map(value => ({ value, label: value }));
  }
  if (col === "Ship Method") {
    return ["", ...SHIP_OPTIONS].map(value => ({
      value,
      label: value || EMPTY_DISPLAY,
    }));
  }
  return [];
}

function positionCellSelectDropdown(anchorEl) {
  const pop = document.getElementById("cellSelectDropdown");
  if (!pop || !anchorEl) return;

  const rect = anchorEl.getBoundingClientRect();
  pop.style.top = `${rect.bottom + 2}px`;
  pop.style.left = `${rect.left}px`;
  pop.style.width = `${rect.width}px`;
}

function renderCellSelectDropdown(col, row) {
  const pop = document.getElementById("cellSelectDropdown");
  if (!pop) return;

  const currentVal = row[col] ?? "";
  pop.dataset.col = col;
  pop.innerHTML = "";

  getCellSelectOptions(col).forEach(({ value, label }) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cell-select-option";
    if (value === currentVal) btn.classList.add("selected");

    if (col === "Status" && value) {
      btn.innerHTML = renderStatus(value);
    } else {
      btn.textContent = label;
    }

    btn.addEventListener("click", e => {
      e.stopPropagation();
      selectCellSelectOption(value);
    });

    pop.appendChild(btn);
  });
}

function closeCellSelectDropdown(clearAnchorState = true) {
  const pop = document.getElementById("cellSelectDropdown");
  if (pop) pop.hidden = true;

  if (clearAnchorState && openCellSelect?.anchor) {
    delete openCellSelect.anchor.dataset.editing;
    openCellSelect.anchor.classList.remove("select-cell-open", "select-cell-hover");
  }

  openCellSelect = null;
}

function selectCellSelectOption(value) {
  if (!openCellSelect) return;

  const { col, row } = openCellSelect;
  const currentVal = row[col] ?? "";

  if (value === currentVal) {
    closeCellSelectDropdown();
    return;
  }

  closeCellSelectDropdown(false);

  row[col] = value;
  const updates = { [col]: value };
  if (col === "Ship Method") {
    updates["EST IHD"] = syncEstIhdForRow(row);
  }

  saveUpdate(row["PO #"], updates);
  renderTable();
  updateModalIfOpen();
}

function openCellSelectDropdown(anchorEl, col, row) {
  if (openCellSelect?.anchor === anchorEl) {
    closeCellSelectDropdown();
    return;
  }

  closeCellSelectDropdown();
  openCellSelect = { anchor: anchorEl, col, row };

  anchorEl.dataset.editing = "active";
  anchorEl.classList.add("select-cell-open");
  anchorEl.classList.remove("select-cell-hover");

  renderCellSelectDropdown(col, row);
  const pop = document.getElementById("cellSelectDropdown");
  if (!pop) return;

  pop.hidden = false;
  requestAnimationFrame(() => positionCellSelectDropdown(anchorEl));
}

function initCellSelectDropdown() {
  document.addEventListener("click", e => {
    const pop = document.getElementById("cellSelectDropdown");
    if (!pop || pop.hidden) return;
    if (pop.contains(e.target) || e.target.closest(".select-cell")) return;
    closeCellSelectDropdown();
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && openCellSelect) {
      closeCellSelectDropdown();
    }
  });

  window.addEventListener("resize", () => {
    if (openCellSelect) positionCellSelectDropdown(openCellSelect.anchor);
  });

  document.querySelector(".table-scroll-y")?.addEventListener("scroll", () => {
    if (openCellSelect) positionCellSelectDropdown(openCellSelect.anchor);
  }, { passive: true });

  document.getElementById("modalBody")?.addEventListener("scroll", () => {
    if (openCellSelect) positionCellSelectDropdown(openCellSelect.anchor);
  }, { passive: true });
}

function createCellInput(col, val) {
  let input;

  if (DATE_FIELDS.has(col)) {
    input = document.createElement("input");
    input.type = "date";
    input.className = "cell-input";
    input.value = normalizeToYmd(val);
  } else {
    input = document.createElement("input");
    input.type = "text";
    input.className = "cell-input";
    input.value = val;
  }

  return input;
}

function updateModalIfOpen() {
  if (!modalRow || !document.getElementById("modalOverlay")?.classList.contains("open")) return;
  renderModalContent(modalRow);
}

function attachCellEditorHandlers(fieldEl, col, row, input) {
  function commit() {
    const newVal = input.value;
    row[col] = newVal;

    const updates = { [col]: newVal };
    if (col === "Ship Method" || col === "EST EXF") {
      updates["EST IHD"] = syncEstIhdForRow(row);
    }

    saveUpdate(row["PO #"], updates);
    renderTable();
    updateModalIfOpen();
  }

  function cancelEdit() {
    renderTable();
    updateModalIfOpen();
  }

  input.onblur = commit;
  input.onkeydown = e => {
    if (e.key === "Enter") input.blur();
    if (e.key === "Escape") cancelEdit();
  };
}

function mountFieldEditor(fieldEl, col, row) {
  if (fieldEl.dataset.editing === "active") return;

  const val = row[col] ?? "";
  const input = createCellInput(col, val);

  fieldEl.innerHTML = "";
  fieldEl.appendChild(input);
  fieldEl.classList.add("editing");
  fieldEl.dataset.editing = "active";
  attachCellEditorHandlers(fieldEl, col, row, input);
  input.focus();
}

function mountCellEditor(td, col, row) {
  mountFieldEditor(td, col, row);
}

function bindSelectCellInteractions(anchorEl, col, row) {
  anchorEl.classList.add("select-cell");

  anchorEl.addEventListener("mouseenter", () => {
    if (anchorEl.dataset.editing) return;
    anchorEl.classList.add("select-cell-hover");
  });

  anchorEl.addEventListener("mouseleave", () => {
    if (anchorEl.dataset.editing === "active") return;
    anchorEl.classList.remove("select-cell-hover");
  });

  anchorEl.addEventListener("mousedown", e => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    openCellSelectDropdown(anchorEl, col, row);
  });
}

function bindEditableCell(td, col, row) {
  if (SELECT_EDIT_COLS.has(col)) {
    bindSelectCellInteractions(td, col, row);
    return;
  }

  td.onclick = () => startEdit(td, col, row);
}

function startEdit(td, col, row) {
  if (td.dataset.editing === "active") return;
  mountFieldEditor(td, col, row);
}

function bindFieldInteractions(fieldEl, col, row) {
  fieldEl.dataset.col = col;

  if (EDITABLE.has(col)) {
    if (SELECT_EDIT_COLS.has(col)) {
      fieldEl.classList.add("editable", "select-cell");
      fieldEl.title = "Click to choose";
      bindSelectCellInteractions(fieldEl, col, row);
    } else {
      fieldEl.classList.add("editable");
      fieldEl.title = "Click to edit";
      fieldEl.onclick = e => {
        e.stopPropagation();
        mountFieldEditor(fieldEl, col, row);
      };
    }
    return;
  }

  if (READONLY_NO_SELECT_COLS.has(col)) {
    fieldEl.classList.add("readonly", "readonly-no-select");
    return;
  }

  if (COPY_ON_CLICK_COLS.has(col)) {
    fieldEl.classList.add("readonly", "readonly-copy");
    fieldEl.title = "Click to copy";
    fieldEl.onclick = e => {
      e.stopPropagation();
      copyCellValue(col, row[col]);
    };
    return;
  }

  fieldEl.classList.add("readonly");
}

function setFieldDisplayContent(fieldEl, col, row) {
  const val = col === "EST IHD"
    ? calculateEstIhd(row["Ship Method"], row["EST EXF"])
    : (row[col] ?? "");

  if (col === "Status") {
    fieldEl.innerHTML = renderStatus(val);
  } else if (DATE_FIELDS.has(col)) {
    setDisplayText(fieldEl, formatDateForDisplay(val));
  } else if (isEmptyValue(val)) {
    setDisplayText(fieldEl, EMPTY_DISPLAY);
  } else {
    fieldEl.textContent = val;
    fieldEl.classList.remove("empty-display");
  }
}

function renderModalContent(row) {
  const poNumEl = document.getElementById("modalPoNum");
  const badgeEl = document.getElementById("modalStatusBadge");
  const bodyEl = document.getElementById("modalBody");
  if (!poNumEl || !badgeEl || !bodyEl) return;

  const poNum = isEmptyValue(row["PO #"]) ? EMPTY_DISPLAY : row["PO #"];
  setDisplayText(poNumEl, poNum);
  poNumEl.className = "modal-po-num";
  poNumEl.onclick = null;
  if (COPY_ON_CLICK_COLS.has("PO #") && poNum !== EMPTY_DISPLAY) {
    poNumEl.classList.add("readonly-copy");
    poNumEl.title = "Click to copy";
    poNumEl.onclick = e => {
      e.stopPropagation();
      copyCellValue("PO #", row["PO #"]);
    };
  }

  badgeEl.innerHTML = renderStatus(row["Status"]);

  bodyEl.innerHTML = "";
  MODAL_SECTIONS.forEach(section => {
    const sectionEl = document.createElement("section");
    sectionEl.className = "modal-section";

    const titleEl = document.createElement("h4");
    titleEl.className = "modal-section-title";
    titleEl.textContent = section.title;
    sectionEl.appendChild(titleEl);

    const gridEl = document.createElement("div");
    gridEl.className = "modal-fields-grid";

    section.fields.forEach(col => {
      const fieldWrap = document.createElement("div");
      fieldWrap.className = "modal-field";
      if (section.fullWidth) fieldWrap.classList.add("modal-field--full");

      const labelEl = document.createElement("label");
      labelEl.className = "modal-field-label";
      labelEl.textContent = col;

      const valueEl = document.createElement("div");
      valueEl.className = "modal-field-value";
      setFieldDisplayContent(valueEl, col, row);
      bindFieldInteractions(valueEl, col, row);

      fieldWrap.appendChild(labelEl);
      fieldWrap.appendChild(valueEl);
      gridEl.appendChild(fieldWrap);
    });

    sectionEl.appendChild(gridEl);
    bodyEl.appendChild(sectionEl);
  });
}

function openPODetail(row) {
  closeCellSelectDropdown(false);
  modalRow = row;
  renderModalContent(row);
  document.getElementById("modalOverlay").classList.add("open");
}

function closeModal(event) {
  if (event.target.id === "modalOverlay") {
    closeModalForce();
  }
}

function closeModalForce() {
  closeCellSelectDropdown(false);
  modalRow = null;
  document.getElementById("modalOverlay").classList.remove("open");
}

async function saveUpdate(poNumber, updates) {
  if (APPS_SCRIPT_URL === "YOUR_APPS_SCRIPT_WEB_APP_URL_HERE") {
    showIndicator(`Demo mode ${EMPTY_DISPLAY} not saved to sheet`, "");
    return;
  }
  try {
    showIndicator(`Saving${ELLIPSIS}`, "");
    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({ action: "update", poNumber, updates })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    showIndicator(`Saved ${CHECK_MARK}`, "success");
  } catch (err) {
    showIndicator("Save failed: " + err.message, "error");
  }
}

let indicatorTimer;
function showIndicator(msg, type) {
  const el = document.getElementById("saveIndicator");
  el.textContent = msg;
  el.className = "save-indicator visible " + (type || "");
  clearTimeout(indicatorTimer);
  indicatorTimer = setTimeout(() => el.classList.remove("visible"), 2500);
}

loadColumnVisibility();
initDivisionFilters();
initStatusFilters();
initColumnFilterHeaders();
initCellSelectDropdown();
initPagination();
initEditTable();
updateSortHeaders();
updateColumnFilterHeaderStates();
applyColumnVisibility();
loadData();
