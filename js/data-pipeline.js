
async function loadData() {
  showIndicator(`Refreshing${ELLIPSIS}`, "");
  try {
    if (isDemoMode()) {
      allRows = DEMO_DATA.map(row => ({ ...row }));
      allChargebacks = DEMO_CHARGEBACKS.map(normalizeChargeback);
      allAsnRequests = [];
      allPackingLists = DEMO_PACKING_LISTS.map(normalizePackingList);
      allPackingCartons = DEMO_PACKING_CARTONS.map(normalizePackingCarton);
      allContactRows = typeof DEMO_CONTACTS !== "undefined" ? DEMO_CONTACTS.map(r => ({ ...r })) : [];
      allVendorEmailRows = allContactRows;
      allLocationRows = typeof DEMO_LOCATIONS !== "undefined" ? DEMO_LOCATIONS.map(r => ({ ...r })) : [];
      window.__pendingShipments = DEMO_SHIPMENTS;
      window.__pendingExfRequests = [];
      window.__pendingAsnRequests = [];
      if (typeof onShipmentsDataLoaded === "function") {
        onShipmentsDataLoaded(DEMO_SHIPMENTS);
        window.__pendingShipments = null;
      }
      if (typeof onExfRequestsDataLoaded === "function") {
        onExfRequestsDataLoaded([]);
        window.__pendingExfRequests = null;
      }
      if (typeof onDeliveryPickupDataLoaded === "function") {
        onDeliveryPickupDataLoaded([], []);
      }
      if (typeof onAsnRequestsDataLoaded === "function") {
        onAsnRequestsDataLoaded([]);
        window.__pendingAsnRequests = null;
      }
      if (typeof onPendingPackingListsDataLoaded === "function") {
        onPendingPackingListsDataLoaded([], "review");
      }
      if (typeof onCustomersDataLoaded === "function") {
        onCustomersDataLoaded(
          typeof DEMO_CUSTOMERS !== "undefined" ? DEMO_CUSTOMERS.map(r => ({ ...r })) : []
        );
      }
      if (typeof onStylesDataLoaded === "function") {
        onStylesDataLoaded([]);
      }
      buildStylePhotoIndex(DEMO_STYLE_PHOTOS);
      applyDefaultStatusFilter(STATUS_FILTER_OPEN);
    } else if (typeof isApiMode === "function" && isApiMode()) {
      // ── SaaS API path (Supabase backend) ──────────────────
      const token = typeof getAccessToken === "function" ? getAccessToken() : null;
      if (!token) {
        // initAuth() will call loadData() again once the user signs in.
        showIndicator("Waiting for sign-in…", "");
        return;
      }
      const res = await fetch(`${getApiBaseUrl()}/api/app-state`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      allChargebacks = (json.chargebacks ?? []).map(normalizeChargeback);
      allAsnRequests = (json.asnRequests ?? []).map(row => ({ ...row }));
      allPackingLists = (json.packingLists ?? []).map(normalizePackingList);
      allPackingCartons = (json.packingCartons ?? []).map(normalizePackingCarton);
      allContactRows = json.contacts ?? json.vendors ?? [];
      allVendorEmailRows = allContactRows;
      allLocationRows = json.locations ?? [];
      buildStylePhotoIndex(json.stylePhotos ?? []);
      buildStyleMasterIndex(json.styles ?? []);
      if (typeof onPendingPackingListsDataLoaded === "function") {
        onPendingPackingListsDataLoaded(json.pendingPackingLists ?? [], json.vendorSubmitMode);
      }
      if (typeof onCustomersDataLoaded === "function") {
        onCustomersDataLoaded(json.customers ?? []);
      }
      if (typeof onStylesDataLoaded === "function") {
        onStylesDataLoaded(json.styles ?? []);
      }
      allRows = json.data.map(row => applyStyleSizesToRow(normalizeRow(row)));
      window.__pendingShipments = json.shipments ?? [];
      window.__pendingExfRequests = json.exfRequests ?? [];
      window.__pendingAsnRequests = json.asnRequests ?? [];
      window.__pendingDeliveryRequests = json.deliveryRequests ?? [];
      window.__pendingPickupRequests = json.pickupRequests ?? [];
      window.__pendingApprovals = json.approvals ?? [];
      if (typeof onShipmentsDataLoaded === "function") {
        onShipmentsDataLoaded(window.__pendingShipments);
        window.__pendingShipments = null;
      }
      if (typeof onExfRequestsDataLoaded === "function") {
        onExfRequestsDataLoaded(window.__pendingExfRequests);
        window.__pendingExfRequests = null;
      }
      if (json.defaultColumns) applyDefaultColumnsFromServer(json.defaultColumns);
      applyDefaultStatusFilterFromServer(json.defaultStatusFilter);
      saveProgramColumnDefaultToStorage();
    } else {
      // ── Apps Script path (original) ───────────────────────
      const url = new URL(getAppsScriptUrl());
      url.searchParams.set("_", String(Date.now()));
      const res = await fetch(url.toString(), { cache: "no-store" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      allRows = json.data.map(normalizeRow);
      allChargebacks = (json.chargebacks ?? []).map(normalizeChargeback);
      allAsnRequests = (json.asnRequests ?? []).map(row => ({ ...row }));
      allPackingLists = (json.packingLists ?? []).map(normalizePackingList);
      allPackingCartons = (json.packingCartons ?? []).map(normalizePackingCarton);
      allContactRows = json.contacts ?? json.vendors ?? [];
      allVendorEmailRows = allContactRows;
      allLocationRows = json.locations ?? [];
      buildStylePhotoIndex(json.stylePhotos ?? []);
      if (typeof onPendingPackingListsDataLoaded === "function") {
        onPendingPackingListsDataLoaded(json.pendingPackingLists ?? [], json.vendorSubmitMode);
      }
      if (typeof onCustomersDataLoaded === "function") {
        onCustomersDataLoaded(json.customers ?? []);
      }
      window.__pendingShipments = json.shipments ?? [];
      window.__pendingExfRequests = json.exfRequests ?? [];
      window.__pendingAsnRequests = json.asnRequests ?? [];
      window.__pendingDeliveryRequests = json.deliveryRequests ?? [];
      window.__pendingPickupRequests = json.pickupRequests ?? [];
      window.__pendingApprovals = json.approvals ?? [];
      if (typeof onShipmentsDataLoaded === "function") {
        onShipmentsDataLoaded(window.__pendingShipments);
        window.__pendingShipments = null;
      }
      if (typeof onExfRequestsDataLoaded === "function") {
        onExfRequestsDataLoaded(window.__pendingExfRequests);
        window.__pendingExfRequests = null;
      }
      if (json.defaultColumns) applyDefaultColumnsFromServer(json.defaultColumns);
      applyDefaultStatusFilterFromServer(json.defaultStatusFilter);
      saveProgramColumnDefaultToStorage();
    }
    invalidatePackingIndex();
    migrateAllRows(allRows);
    resetLocalSelectedState(allRows);
    clearMiniSelection();
    syncAllEstIhd(allRows);
    syncAllQtyTotals(allRows);
    if (typeof syncAllAssignDatesFromPickupRequests === "function") {
      syncAllAssignDatesFromPickupRequests(allRows);
    }
    if (typeof onDeliveryPickupDataLoaded === "function") {
      onDeliveryPickupDataLoaded(
        isDemoMode() ? [] : (window.__pendingDeliveryRequests ?? []),
        isDemoMode() ? [] : (window.__pendingPickupRequests ?? [])
      );
      window.__pendingDeliveryRequests = null;
      window.__pendingPickupRequests = null;
    }
    if (typeof onAsnRequestsDataLoaded === "function") {
      onAsnRequestsDataLoaded(isDemoMode() ? [] : (window.__pendingAsnRequests ?? []));
      window.__pendingAsnRequests = null;
    }
    if (typeof onApprovalsDataLoaded === "function") {
      onApprovalsDataLoaded(isDemoMode() ? [] : (window.__pendingApprovals ?? []));
      window.__pendingApprovals = null;
    }
    if (typeof onExfRequestsDataLoaded === "function" && window.__pendingExfRequests) {
      onExfRequestsDataLoaded(window.__pendingExfRequests);
      window.__pendingExfRequests = null;
    }
    await applyAutomaticStatusUpdates(allRows, allShipments ?? []);
    updateColumnFilterHeaderStates();
    applyFilters();
    if (typeof onPoSelectionChanged === "function") onPoSelectionChanged();
    showIndicator("Loaded", "success");
  } catch (err) {
    showIndicator("Load failed: " + err.message, "error");
  }
}

function compareDateFieldValues(aVal, bVal) {
  const aYmd = normalizeToYmd(aVal);
  const bYmd = normalizeToYmd(bVal);
  if (!aYmd && !bYmd) return 0;
  if (!aYmd) return 1;
  if (!bYmd) return -1;
  return aYmd.localeCompare(bYmd);
}

function compareTextFieldValues(aVal, bVal) {
  const a = String(aVal ?? "").trim();
  const b = String(bVal ?? "").trim();
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b, undefined, { numeric: true });
}

function compareRowsByColumn(col, a, b) {
  if (col === "Status") return statusSortIndex(getRowWorkflowStatus(a)) - statusSortIndex(getRowWorkflowStatus(b));
  if (DATE_FIELDS.has(col)) return compareDateFieldValues(a[col], b[col]);
  if (col === "Actual Qty") {
    const aQty = getPackingActualQtyForRow(a);
    const bQty = getPackingActualQtyForRow(b);
    return compareTextFieldValues(aQty > 0 ? aQty : "", bQty > 0 ? bQty : "");
  }
  if (col === "Ctn Qty") {
    const aQty = getPackingCtnQtyForRow(a);
    const bQty = getPackingCtnQtyForRow(b);
    return compareTextFieldValues(aQty > 0 ? aQty : "", bQty > 0 ? bQty : "");
  }
  return compareTextFieldValues(a[col], b[col]);
}

function compareRowsForSort(a, b) {
  if (sortCol) {
    const primary = compareRowsByColumn(sortCol, a, b) * sortDir;
    if (primary !== 0) return primary;
    for (const col of DEFAULT_SORT_COLUMNS) {
      if (col === sortCol) continue;
      const cmp = compareRowsByColumn(col, a, b);
      if (cmp !== 0) return cmp;
    }
    return 0;
  }
  for (const col of DEFAULT_SORT_COLUMNS) {
    const cmp = compareRowsByColumn(col, a, b);
    if (cmp !== 0) return cmp;
  }
  return 0;
}

let activeSearchQuery = "";

function commitPoSearch() {
  const input = document.getElementById("searchInput");
  activeSearchQuery = (input?.value ?? "").trim().toLowerCase();
  applyFilters();
  if (typeof updateSearchInputVisualState === "function") updateSearchInputVisualState();
}

function applyFilters() {
  const q = activeSearchQuery;
  const div = activeDivision;
  filteredRows = allRows.filter(row => {
    if (div && row["Division"] !== div) return false;
    if (!rowMatchesStatusFilter(row)) return false;
    if (flagFilterActive && !isTruthy(row["Flag"])) return false;
    if (!rowPassesColumnFilters(row)) return false;
    if (q) {
      const haystack = COLUMNS.map(c => String(getColumnFilterRawValue(c, row) ?? "")).join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  filteredRows.sort(compareRowsForSort);

  currentPage = 1;
  renderTable();
  updateClearAllFiltersButton();
  if (typeof updateStatusFilterCounts === "function") updateStatusFilterCounts();
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

function getFilteredSelectedCount() {
  return filteredRows.filter(row => isTruthy(row["Selected"])).length;
}

function getRowCounterText() {
  const total = filteredRows.length;
  if (total === 0) return "0 rows";

  if (isPageSizeAll()) {
    return `${total} row${total === 1 ? "" : "s"}`;
  }

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, total);
  return `${start}${EN_DASH}${end} of ${total}`;
}

function updateRowCounter() {
  const el = document.getElementById("rowCounter");
  if (!el) return;

  const rowText = getRowCounterText();
  const selectedCount = getFilteredSelectedCount();
  el.textContent = selectedCount >= 1
    ? `${selectedCount} selected out of ${rowText}`
    : rowText;
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
  clearMiniSelection();
  closeCellSelectDropdown(false);
  renderTable();
  scrollTableToTop();
}

function normalizePageSizeValue(value) {
  const raw = String(value ?? "").trim();
  if (raw === "all") return "all";
  const n = Number(raw);
  if (n === 30 || n === 60 || n === 120) return String(n);
  return DEFAULT_PAGE_SIZE;
}

function loadPageSizePreference() {
  try {
    const stored = localStorage.getItem(scopedStorageKey(PAGE_SIZE_STORAGE_BASE));
    if (stored == null) return DEFAULT_PAGE_SIZE;
    return normalizePageSizeValue(stored);
  } catch {
    return DEFAULT_PAGE_SIZE;
  }
}

function savePageSizePreference(value) {
  try {
    localStorage.setItem(scopedStorageKey(PAGE_SIZE_STORAGE_BASE), normalizePageSizeValue(value));
  } catch {
    /* ignore storage failures */
  }
}

function applyPageSize(value) {
  const normalized = normalizePageSizeValue(value);
  pageSize = normalized === "all" ? Infinity : Number(normalized);
  currentPage = 1;
  const select = document.getElementById("pageSizeSelect");
  if (select) select.value = normalized;
}

function setPageSize(value) {
  const normalized = normalizePageSizeValue(value);
  savePageSizePreference(normalized);
  pageSize = normalized === "all" ? Infinity : Number(normalized);
  currentPage = 1;
  closeCellSelectDropdown(false);
  renderTable();
}

function initPagination() {
  applyPageSize(loadPageSizePreference());
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
  if (sortCol === col) {
    if (sortDir === 1) sortDir = -1;
    else {
      sortCol = null;
      sortDir = 1;
    }
  } else {
    sortCol = col;
    sortDir = 1;
  }
  updateSortHeaders();
  applyFilters();
}

const DATE_FORMAT_STORAGE_BASE = "dateFormat";
const DEFAULT_DATE_FORMAT_ID = "mm/dd/yy";

const DATE_FORMAT_OPTIONS = [
  { id: "mm/dd/yy", label: "mm/dd/yy" },
  { id: "mm.dd.yy", label: "mm.dd.yy" },
  { id: "mm/dd/yyyy", label: "mm/dd/yyyy" },
  { id: "mm.dd.yyyy", label: "mm.dd.yyyy" },
  { id: "mm/dd", label: "mm/dd" },
  { id: "mm.dd", label: "mm.dd" },
  { id: "m/d/yy", label: "m/d/yy" },
  { id: "m.d.yy", label: "m.d.yy" },
  { id: "m/d", label: "m/d" },
  { id: "m.d", label: "m.d" },
];

let dateFormatId = DEFAULT_DATE_FORMAT_ID;

function normalizeDateFormatId(value) {
  const raw = String(value ?? "").trim();
  return DATE_FORMAT_OPTIONS.some(opt => opt.id === raw) ? raw : DEFAULT_DATE_FORMAT_ID;
}

function getDateFormatId() {
  return dateFormatId;
}

function getDateFormatOption(id = dateFormatId) {
  return DATE_FORMAT_OPTIONS.find(opt => opt.id === id) ?? DATE_FORMAT_OPTIONS[0];
}

function loadDateFormatPreference() {
  try {
    const stored = localStorage.getItem(scopedStorageKey(DATE_FORMAT_STORAGE_BASE));
    dateFormatId = normalizeDateFormatId(stored ?? DEFAULT_DATE_FORMAT_ID);
  } catch {
    dateFormatId = DEFAULT_DATE_FORMAT_ID;
  }
}

function saveDateFormatPreference(value) {
  try {
    localStorage.setItem(scopedStorageKey(DATE_FORMAT_STORAGE_BASE), normalizeDateFormatId(value));
  } catch {
    /* ignore storage failures */
  }
}

function getDateFormatDisplayMaxLength(formatId = dateFormatId) {
  switch (normalizeDateFormatId(formatId)) {
    case "mm/dd/yyyy":
    case "mm.dd.yyyy":
      return 10;
    case "mm/dd/yy":
    case "mm.dd.yy":
      return 8;
    case "mm/dd":
    case "mm.dd":
      return 5;
    case "m/d/yy":
    case "m.d.yy":
      return 8;
    case "m/d":
    case "m.d":
      return 6;
    default:
      return 10;
  }
}

function formatYmdWithDateFormat(yyyy, mm, dd, formatId = dateFormatId) {
  const id = normalizeDateFormatId(formatId);
  const mNum = Number(mm);
  const dNum = Number(dd);
  const yy = yyyy.slice(2);
  const sep = id.includes(".") ? "." : "/";
  const usePadded = id.startsWith("mm");
  const month = usePadded ? mm : String(mNum);
  const day = usePadded ? dd : String(dNum);
  const hasYear = /yy/.test(id);

  if (hasYear) {
    const yearPart = id.includes("yyyy") ? yyyy : yy;
    return `${month}${sep}${day}${sep}${yearPart}`;
  }
  return `${month}${sep}${day}`;
}

function formatDateForDisplay(v) {
  if (isEmptyValue(v)) return EMPTY_DISPLAY;

  const s = String(v).trim();

  // Accept either YYYY-MM-DD or full ISO timestamps like 2026-04-22T07:00:00.000Z
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/.exec(s);
  if (!m) return s; // fallback: don't change unknown formats

  const [, yyyy, mm, dd] = m;
  return formatYmdWithDateFormat(yyyy, mm, dd);
}

function setDateFormat(value) {
  const next = normalizeDateFormatId(value);
  if (next === dateFormatId) return;
  dateFormatId = next;
  saveDateFormatPreference(next);
  if (typeof updateSettingsDateFormatUi === "function") updateSettingsDateFormatUi();
  refreshDateDisplays();
}

function refreshDateDisplays() {
  renderTable();
  updateModalIfOpen();
  if (typeof poPackingPaneRow !== "undefined" && poPackingPaneRow && typeof poPaneBuildSummaryCard === "function") {
    poPaneBuildSummaryCard(poPackingPaneRow);
  }
  if (typeof updatePackingPaneIfOpen === "function") updatePackingPaneIfOpen();
  if (typeof currentAppView !== "undefined" && typeof switchAppView === "function") {
    switchAppView(currentAppView);
  }
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

/** Parse MMDDYY (6 digits) to YYYY-MM-DD, or null if invalid. */
function parseCompactDateDigits(digits) {
  if (!/^\d{6}$/.test(digits)) return null;
  const mm = Number(digits.slice(0, 2));
  const dd = Number(digits.slice(2, 4));
  const yy = Number(digits.slice(4, 6));
  if (mm < 1 || mm > 12 || dd < 1) return null;

  const yyyy = 2000 + yy;
  const date = new Date(yyyy, mm - 1, dd);
  if (
    date.getFullYear() !== yyyy ||
    date.getMonth() !== mm - 1 ||
    date.getDate() !== dd
  ) {
    return null;
  }

  return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

/** Parse mm/dd/yy (or m/d/yy) and ISO-style dates to YYYY-MM-DD. */
function parseDisplayDateToYmd(v) {
  if (isEmptyValue(v)) return null;
  const s = String(v).trim();
  if (s === "—") return null;

  const iso = normalizeToYmd(s);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso) && parseYmdToLocalDate(iso)) return iso;

  const compact = s.replace(/\D/g, "");
  if (/^\d{6}$/.test(compact)) {
    const ymd = parseCompactDateDigits(compact);
    if (ymd) return ymd;
  }

  const m = /^(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?$/.exec(s);
  if (!m) return null;

  const mm = String(Number(m[1])).padStart(2, "0");
  const dd = String(Number(m[2])).padStart(2, "0");
  let yyyy = m[3];
  if (!yyyy) yyyy = String(new Date().getFullYear());
  else if (yyyy.length === 2) yyyy = `20${yyyy.padStart(2, "0")}`;
  else yyyy = String(Number(yyyy));

  const ymd = `${yyyy}-${mm}-${dd}`;
  return parseYmdToLocalDate(ymd) ? ymd : null;
}

function calculateEstIhd(shipMethod, estExf) {
  if (isEmptyValue(shipMethod) || isEmptyValue(estExf)) return "";

  const method = typeof normalizeShipMethod === "function"
    ? normalizeShipMethod(shipMethod)
    : String(shipMethod).trim();
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
  const calculated = calculateEstIhd(row["Ship Method"], row["EST EXF"]);
  if (calculated) row["EST IHD"] = calculated;
  return row["EST IHD"];
}

function syncAllEstIhd(rows) {
  rows.forEach(syncEstIhdForRow);
}
