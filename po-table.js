const APPS_SCRIPT_URL = "https://script.google.com/a/macros/elevatordisco.com/s/AKfycbyAipm-x3kYHv0LuMc0Ffkfmvj-U24U8UjnDNih92jz_mE3izKVU7NBJJMO_xB5CnJM6w/exec";

const COLUMNS = [
  "Division","Status","Vendor","Buyer","Buyer PO #","SO #","PO Date","PO #",
  "Old PO #","Style #","Color","PO Qty","Actual Qty","Ctn Qty","Ship Method","Vessel",
  "House #","Shipped","ETD","ETA","IHD","EST EXF","EST IHD","CXL Date","Assign Date","Notes"
];

const EDITABLE = new Set([
  "PO Qty","Status","Ship Method","Ctn Qty","Vessel","House #",
  "Shipped","ETD","ETA","IHD","EST EXF","EST IHD","CXL Date","Assign Date","Notes"
]);

// Single source of truth for status filter, cell editor, and default table sort.
// Reorder entries to change sort priority (top = first). Add/remove statuses here only.
const STATUS_SORT_ORDER = [
  "OTW", "Received", "Arrived at Port", "Arrived at WH", 
  "Assigned", "WIP", "Requested", "Hold",  
  "Shipped", "CXL", "Closed", 
];

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

const DEMO_DATA = [
  { "Division":"Elevator Disco","Status":"Received","Vendor":"Acme Textiles","Buyer":"Kim","Buyer PO #":"BP-1001","SO #":"SO-2201","PO Date":"2024-01-15","PO #":"PO-10001","Old PO #":"","Style #":"ST-100","Color":"Navy","PO Qty":500,"Actual Qty":498,"Ctn Qty":50,"Ship Method":"Sea&Air","Vessel":"Ever Given","House #":"H-001","Shipped":"2024-02-01","ETD":"2024-02-05","ETA":"2024-02-20","IHD":"2024-02-25","EST EXF":"2024-02-18","EST IHD":"2024-02-24","CXL Date":"2024-03-01","Assign Date":"2024-01-20","Notes":"Priority shipment" },
  { "Division":"Freesia","Status":"WIP","Vendor":"Blue Fabrics","Buyer":"Sam","Buyer PO #":"BP-1002","SO #":"SO-2202","PO Date":"2024-01-18","PO #":"PO-10002","Old PO #":"PO-9002","Style #":"ST-200","Color":"Blush","PO Qty":300,"Actual Qty":0,"Ctn Qty":30,"Ship Method":"Air","Vessel":"","House #":"","Shipped":"","ETD":"2024-03-01","ETA":"2024-03-10","IHD":"2024-03-15","EST EXF":"2024-03-08","EST IHD":"2024-03-14","CXL Date":"2024-04-01","Assign Date":"2024-01-22","Notes":"" },
  { "Division":"Elevator Disco","Status":"Shipped","Vendor":"Orient Mfg","Buyer":"Lee","Buyer PO #":"BP-1003","SO #":"SO-2203","PO Date":"2024-01-20","PO #":"PO-10003","Old PO #":"","Style #":"ST-301","Color":"Ivory","PO Qty":1000,"Actual Qty":1000,"Ctn Qty":100,"Ship Method":"Matson","Vessel":"Matson Kona","House #":"H-202","Shipped":"2024-02-10","ETD":"2024-02-12","ETA":"2024-02-22","IHD":"2024-02-28","EST EXF":"2024-02-20","EST IHD":"2024-02-27","CXL Date":"2024-03-10","Assign Date":"2024-01-25","Notes":"Fragile — handle with care" },
  { "Division":"Freesia","Status":"Hold","Vendor":"Summit Goods","Buyer":"Kim","Buyer PO #":"BP-1004","SO #":"SO-2204","PO Date":"2024-02-01","PO #":"PO-10004","Old PO #":"","Style #":"ST-410","Color":"Sage","PO Qty":200,"Actual Qty":0,"Ctn Qty":20,"Ship Method":"Air","Vessel":"","House #":"","Shipped":"","ETD":"","ETA":"","IHD":"2024-04-01","EST EXF":"","EST IHD":"","CXL Date":"2024-04-15","Assign Date":"","Notes":"Awaiting quality approval" },
  { "Division":"Elevator Disco","Status":"Closed","Vendor":"Pacific Imports","Buyer":"Sam","Buyer PO #":"BP-1005","SO #":"SO-2205","PO Date":"2023-12-01","PO #":"PO-10005","Old PO #":"PO-8005","Style #":"ST-501","Color":"Black","PO Qty":750,"Actual Qty":750,"Ctn Qty":75,"Ship Method":"Sea&Air","Vessel":"MSC Maya","House #":"H-099","Shipped":"2024-01-05","ETD":"2024-01-08","ETA":"2024-01-20","IHD":"2024-01-25","EST EXF":"2024-01-18","EST IHD":"2024-01-24","CXL Date":"2024-02-01","Assign Date":"2023-12-10","Notes":"Completed" },
];

async function loadData() {
  showIndicator("Refreshing…", "");
  try {
    if (APPS_SCRIPT_URL === "YOUR_APPS_SCRIPT_WEB_APP_URL_HERE") {
      allRows = DEMO_DATA;
    } else {
      const res = await fetch(APPS_SCRIPT_URL);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      allRows = json.data;
    }
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
  const status = activeStatus;
  filteredRows = allRows.filter(row => {
    if (div && row["Division"] !== div) return false;
    if (status && row["Status"] !== status) return false;
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

  renderTable();
  updateClearAllFiltersButton();
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
  if (!v) return "—";

  const s = String(v).trim();

  // Accept either YYYY-MM-DD or full ISO timestamps like 2026-04-22T07:00:00.000Z
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/.exec(s);
  if (!m) return s; // fallback: don't change unknown formats

  const [, yyyy, mm, dd] = m;
  return `${mm}/${dd}/${yyyy.slice(2)}`; // MM/DD/YY
}

function normalizeToYmd(v) {
  if (!v) return "";
  const s = String(v).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return s;
}

function renderTable() {
  const tbody = document.getElementById("tableBody");
  document.getElementById("rowCounter").textContent = filteredRows.length + " rows";

  if (filteredRows.length === 0) {
    tbody.innerHTML = `<tr class="state-row"><td colspan="${COLUMNS.length}">No POs match your filters.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";
  filteredRows.forEach(row => {
    const tr = document.createElement("tr");
    tr.dataset.po = row["PO #"];

    tr.className = "clickable-row";
    tr.ondblclick = () => openPODetail(row);

    COLUMNS.forEach(col => {
      const td = document.createElement("td");
      const editable = EDITABLE.has(col);
      const val = row[col] ?? "";

      if (editable) {
        td.className = "editable";
        td.title = "Click to edit";
        td.onclick = () => startEdit(td, col, row);
      } else {
        td.className = "readonly";
      }

      if (col === "Status") {
        td.innerHTML = renderStatus(val);
      } else {
        if (DATE_FIELDS.has(col)) {
          td.textContent = formatDateForDisplay(val);
        } else {
          td.textContent = val !== "" && val !== null ? val : (editable ? "" : "—");
        }
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}

function renderStatus(val) {
  if (!val) return '<span style="color:var(--text-muted)">—</span>';
  const cls = STATUS_BADGE[val] || "badge-cancelled";
  return `<span class="badge ${cls}">${val}</span>`;
}

function startEdit(td, col, row) {
  if (td.querySelector("input,select")) return;
  const val = row[col] ?? "";
  let input;

  if (col === "Status") {
    input = document.createElement("select");
    input.className = "cell-select";
    STATUS_SORT_ORDER.forEach(s => {
      const o = document.createElement("option");
      o.value = s; o.textContent = s;
      if (s === val) o.selected = true;
      input.appendChild(o);
    });
  } else if (col === "Ship Method") {
    input = document.createElement("select");
    input.className = "cell-select";
    ["", ...SHIP_OPTIONS].forEach(s => {
      const o = document.createElement("option");
      o.value = s; o.textContent = s || "—";
      if (s === val) o.selected = true;
      input.appendChild(o);
    });
  } else if (DATE_FIELDS.has(col)) {
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

  td.innerHTML = "";
  td.appendChild(input);
  input.focus();

  function commit() {
    const newVal = input.value;
    row[col] = newVal;
    saveUpdate(row["PO #"], col, newVal);
    renderTable();
  }

  input.onblur = commit;
  input.onkeydown = e => {
    if (e.key === "Enter") { input.blur(); }
    if (e.key === "Escape") { renderTable(); }
  };
}

async function saveUpdate(poNumber, field, value) {
  if (APPS_SCRIPT_URL === "YOUR_APPS_SCRIPT_WEB_APP_URL_HERE") {
    showIndicator("Demo mode — not saved to sheet", "");
    return;
  }
  try {
    showIndicator("Saving…", "");
    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({ action: "update", poNumber, updates: { [field]: value } })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    showIndicator("Saved ✓", "success");
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

initDivisionFilters();
initStatusFilters();
initColumnFilterHeaders();
updateSortHeaders();
updateColumnFilterHeaderStates();
loadData();

function openPODetail(row) {
  // 1. Populate values into DOM slots
  document.getElementById("viewPoNum").textContent = row["PO #"] ?? "—";
  document.getElementById("viewDivision").textContent = row["Division"] ?? "—";
  document.getElementById("viewVendor").textContent = row["Vendor"] ?? "—";
  document.getElementById("viewBuyer").textContent = row["Buyer"] ?? "—";
  document.getElementById("viewStyle").textContent = row["Style #"] ?? "—";
  document.getElementById("viewColor").textContent = row["Color"] ?? "—";
  document.getElementById("viewActualQty").textContent = row["Actual Qty"] ?? "—";

  // 2. Open backdrop overlay
  document.getElementById("modalOverlay").classList.add("open");
}

// Closes modal if user clicks directly on the dim backdrop mesh environment
function closeModal(event) {
  if (event.target.id === "modalOverlay") {
    closeModalForce();
  }
}

// Regular toggle function triggered by the "X" button
function closeModalForce() {
  document.getElementById("modalOverlay").classList.remove("open");
}