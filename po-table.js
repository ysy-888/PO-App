const APPS_SCRIPT_URL = "https://script.google.com/a/macros/elevatordisco.com/s/AKfycbyAipm-x3kYHv0LuMc0Ffkfmvj-U24U8UjnDNih92jz_mE3izKVU7NBJJMO_xB5CnJM6w/exec";

const EDITABLE = new Set([
  "PO Qty","Flag","Status","Ship Method","Ctn Qty","Vessel","House #",
  "Shipped","ETD","ETA","IHD","EST EXF","EST IHD","CXL Date","Assign Date","Notes"
]);

const STATUS_OPTIONS = [
  "Received","Arrived at Port","Arrived at WH","Assigned","OTW",
  "Requested","Hold","Cancelled","WIP","Shipped","Closed"
];

const SHIP_OPTIONS = ["Air","Sea&Air","Matson"];

const STATUS_BADGE = {
  "Received":"badge-received","Arrived at Port":"badge-port","Arrived at WH":"badge-wh",
  "Assigned":"badge-assigned","OTW":"badge-otw","Requested":"badge-requested",
  "Hold":"badge-hold","Cancelled":"badge-cancelled","WIP":"badge-wip",
  "Shipped":"badge-shipped","Closed":"badge-closed"
};

const DATE_FIELDS = new Set(["PO Date","Shipped","ETD","ETA","IHD","EST EXF","EST IHD","CXL Date","Assign Date"]);

const COLUMNS = [
  "Division","Status","Vendor","Flag","Buyer","Buyer PO #","SO #","PO Date","PO #",
  "Old PO #","Style #","Color","PO Qty","Actual Qty","Ctn Qty","Ship Method","Vessel",
  "House #","Shipped","ETD","ETA","IHD","EST EXF","EST IHD","CXL Date","Assign Date","Notes"
];

let allRows = [];
let filteredRows = [];
let sortCol = null;
let sortDir = 1;

const DEMO_DATA = [
  { "Division":"Elevator Disco","Status":"Received","Vendor":"Acme Textiles","Flag":"🔴","Buyer":"Kim","Buyer PO #":"BP-1001","SO #":"SO-2201","PO Date":"2024-01-15","PO #":"PO-10001","Old PO #":"","Style #":"ST-100","Color":"Navy","PO Qty":500,"Actual Qty":498,"Ctn Qty":50,"Ship Method":"Sea&Air","Vessel":"Ever Given","House #":"H-001","Shipped":"2024-02-01","ETD":"2024-02-05","ETA":"2024-02-20","IHD":"2024-02-25","EST EXF":"2024-02-18","EST IHD":"2024-02-24","CXL Date":"2024-03-01","Assign Date":"2024-01-20","Notes":"Priority shipment" },
  { "Division":"Freesia","Status":"WIP","Vendor":"Blue Fabrics","Flag":"","Buyer":"Sam","Buyer PO #":"BP-1002","SO #":"SO-2202","PO Date":"2024-01-18","PO #":"PO-10002","Old PO #":"PO-9002","Style #":"ST-200","Color":"Blush","PO Qty":300,"Actual Qty":0,"Ctn Qty":30,"Ship Method":"Air","Vessel":"","House #":"","Shipped":"","ETD":"2024-03-01","ETA":"2024-03-10","IHD":"2024-03-15","EST EXF":"2024-03-08","EST IHD":"2024-03-14","CXL Date":"2024-04-01","Assign Date":"2024-01-22","Notes":"" },
  { "Division":"Elevator Disco","Status":"Shipped","Vendor":"Orient Mfg","Flag":"🟡","Buyer":"Lee","Buyer PO #":"BP-1003","SO #":"SO-2203","PO Date":"2024-01-20","PO #":"PO-10003","Old PO #":"","Style #":"ST-301","Color":"Ivory","PO Qty":1000,"Actual Qty":1000,"Ctn Qty":100,"Ship Method":"Matson","Vessel":"Matson Kona","House #":"H-202","Shipped":"2024-02-10","ETD":"2024-02-12","ETA":"2024-02-22","IHD":"2024-02-28","EST EXF":"2024-02-20","EST IHD":"2024-02-27","CXL Date":"2024-03-10","Assign Date":"2024-01-25","Notes":"Fragile — handle with care" },
  { "Division":"Freesia","Status":"Hold","Vendor":"Summit Goods","Flag":"🔴","Buyer":"Kim","Buyer PO #":"BP-1004","SO #":"SO-2204","PO Date":"2024-02-01","PO #":"PO-10004","Old PO #":"","Style #":"ST-410","Color":"Sage","PO Qty":200,"Actual Qty":0,"Ctn Qty":20,"Ship Method":"Air","Vessel":"","House #":"","Shipped":"","ETD":"","ETA":"","IHD":"2024-04-01","EST EXF":"","EST IHD":"","CXL Date":"2024-04-15","Assign Date":"","Notes":"Awaiting quality approval" },
  { "Division":"Elevator Disco","Status":"Closed","Vendor":"Pacific Imports","Flag":"","Buyer":"Sam","Buyer PO #":"BP-1005","SO #":"SO-2205","PO Date":"2023-12-01","PO #":"PO-10005","Old PO #":"PO-8005","Style #":"ST-501","Color":"Black","PO Qty":750,"Actual Qty":750,"Ctn Qty":75,"Ship Method":"Sea&Air","Vessel":"MSC Maya","House #":"H-099","Shipped":"2024-01-05","ETD":"2024-01-08","ETA":"2024-01-20","IHD":"2024-01-25","EST EXF":"2024-01-18","EST IHD":"2024-01-24","CXL Date":"2024-02-01","Assign Date":"2023-12-10","Notes":"Completed" },
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
    applyFilters();
    showIndicator("Loaded", "success");
  } catch (err) {
    showIndicator("Load failed: " + err.message, "error");
  }
}

function applyFilters() {
  const q = document.getElementById("searchInput").value.toLowerCase();
  const div = document.getElementById("divisionFilter").value;
  const status = document.getElementById("statusFilter").value;
  const ship = document.getElementById("shipFilter").value;

  filteredRows = allRows.filter(row => {
    if (div && row["Division"] !== div) return false;
    if (status && row["Status"] !== status) return false;
    if (ship && row["Ship Method"] !== ship) return false;
    if (q) {
      const haystack = COLUMNS.map(c => String(row[c] ?? "")).join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  if (sortCol) {
    filteredRows.sort((a, b) => {
      const av = a[sortCol] ?? ""; const bv = b[sortCol] ?? "";
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * sortDir;
    });
  }

  renderTable();
}

function sortBy(col) {
  if (sortCol === col) sortDir *= -1;
  else { sortCol = col; sortDir = 1; }
  document.querySelectorAll("th").forEach(th => {
    th.classList.remove("sorted-asc","sorted-desc");
    if (th.getAttribute("onclick") === `sortBy('${col}')`) {
      th.classList.add(sortDir === 1 ? "sorted-asc" : "sorted-desc");
    }
  });
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
    tbody.innerHTML = '<tr class="state-row"><td colspan="27">No POs match your filters.</td></tr>';
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
      } else if (col === "Flag") {
        td.className += " flag-cell";
        td.textContent = val || "—";
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
    STATUS_OPTIONS.forEach(s => {
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