/**
 * Dashboard view (opened via the Elevator Disco logo).
 *
 * Renders from the app's own data — the same records the Google Calendar
 * sync mirrors — so everything is clickable and live:
 *   Calendar   — SOs on CXL Date, shipments on IHD, ASNs on ASN Date
 *   Weeks list — open SOs grouped by CXL week
 *   Shipments  — open (not yet received) shipments by IHD
 *   ASNs       — open (not yet picked up) ASN requests by ASN Date
 */

let dashCalCursor = null; // { year, month } — month the arrows/title target
let dashSelectedYmd = ""; // day selected on the calendar; drives the day pane
let dashCalScrollEl = null; // the continuous-scroll viewport
let dashCalMonthAnchors = {}; // "year-month" → first cell of that month
let dashCalScrollRaf = 0; // rAF handle for throttling scroll → title updates

/** Months rendered before / after the cursor month in the continuous view. */
const DASH_CAL_MONTHS_BEFORE = 3;
const DASH_CAL_MONTHS_AFTER = 12;

/** Max event chips shown per calendar day; the rest roll up into "+N more". */
const DASH_CAL_MAX_EVENTS = 3;

/** Display order of the SO dot+count summary groups on calendar days. */
const DASH_SO_SUMMARY_ORDER = [
  "dash-event--so-major",
  "dash-event--so-private",
  "dash-event--so-specialty",
];

const DASH_SO_TYPE_LABELS = {
  "dash-event--so-major": "Major",
  "dash-event--so-private": "Private Label",
  "dash-event--so-specialty": "Specialty",
};

/** Event kinds — also the sort order: shipments and ASNs come before SOs. */
const DASH_EVENT_KIND_SHIPMENT = 0;
const DASH_EVENT_KIND_ASN = 1;
const DASH_EVENT_KIND_SO = 2;

/** Small inline icons shown on shipment/ASN calendar chips. */
const DASH_EVENT_ICON_SVGS = {
  "dash-event--shipment": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
  "dash-event--asn": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
};

function createDashEventIcon(cls) {
  const svg = DASH_EVENT_ICON_SVGS[cls];
  if (!svg) return null;
  const icon = document.createElement("i");
  icon.className = "dash-event-icon";
  icon.innerHTML = svg;
  return icon;
}

/** Event-type filter opened from the Filter button in the calendar header. */
const DASH_CAL_FILTER_OPTIONS = [
  { cls: "dash-event--shipment", label: "Shipments" },
  { cls: "dash-event--asn", label: "ASNs" },
  { cls: "dash-event--so-major", label: "Major" },
  { cls: "dash-event--so-private", label: "Private Label" },
  { cls: "dash-event--so-specialty", label: "Specialty" },
];
let dashCalFilterSelection = new Set(DASH_CAL_FILTER_OPTIONS.map(o => o.cls));

function dashTodayYmd() {
  return formatDateToYmd(new Date());
}

function dashWeekStartYmd(date) {
  return formatDateToYmd(new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay()));
}

// ── Data selectors ───────────────────────────────────────────

function isDashClosedSalesOrder(order) {
  const n41 = String(order?.["N41 Status"] ?? "").trim();
  return n41 === "Closed" || n41 === "CXL";
}

function isDashShopifyOrder(order) {
  return String(order?.["Order Type"] ?? "").trim().toUpperCase() === "SHOPIFY";
}

function getDashOpenSalesOrders() {
  return (typeof allSalesOrders !== "undefined" ? allSalesOrders : [])
    .filter(order => !isDashClosedSalesOrder(order) && !isDashShopifyOrder(order));
}

function getDashOpenShipments() {
  return (typeof allShipments !== "undefined" ? allShipments : [])
    .filter(shipment => !isShipmentReceived(shipment));
}

function getDashOpenAsnRequests() {
  return (typeof allAsnRequests !== "undefined" ? allAsnRequests : [])
    .filter(request => !isAsnRequestPickedUp(request));
}

function dashAsnPoCount(request) {
  const raw = String(request?.["PO Numbers"] ?? "").trim();
  if (raw) return raw.split(",").map(s => s.trim()).filter(Boolean).length;
  const n = Number(request?.["PO Count"]);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function dashSoUnits(order) {
  return typeof soTotalUnits === "function" ? soTotalUnits(order) : 0;
}

// ── Calendar events ──────────────────────────────────────────

/** SO chips use the same color families as the Google Calendar sync. */
function dashSoEventClass(order) {
  const type = String(order?.["Order Type"] ?? "").trim().toUpperCase();
  if (type === "MAJOR") return "dash-event--so-major";
  if (type === "PRIVATE LABEL") return "dash-event--so-private";
  if (type === "SPECIALTY") return "dash-event--so-specialty";
  return "dash-event--so-major";
}

/** Map(dateYmd → events), each event { title, meta, cls, done, open() }. */
function buildDashEventsByDate() {
  const events = [];

  (typeof allSalesOrders !== "undefined" ? allSalesOrders : []).forEach(order => {
    if (isDashShopifyOrder(order)) return;
    const soNum = String(order?.["SO #"] ?? "").trim();
    const date = normalizeToYmd(order?.["CXL Date"]);
    if (!soNum || !date) return;
    // Major / Private Label orders show the buyer's PO alongside the SO #.
    const type = String(order?.["Order Type"] ?? "").trim().toUpperCase();
    const customerPo = (type === "MAJOR" || type === "PRIVATE LABEL")
      ? String(order?.["Customer PO #"] ?? "").trim()
      : "";
    events.push({
      kind: DASH_EVENT_KIND_SO,
      dateYmd: date,
      title: customerPo ? `SO ${soNum} (${customerPo})` : `SO ${soNum}`,
      meta: String(order?.["Customer"] ?? "").trim(),
      cls: dashSoEventClass(order),
      done: isDashClosedSalesOrder(order),
      open: () => { if (typeof openSalesOrderModal === "function") openSalesOrderModal(order); },
    });
  });

  (typeof allShipments !== "undefined" ? allShipments : []).forEach(shipment => {
    const id = String(shipment?.[SHIPMENT_ID_FIELD] ?? "").trim();
    const date = normalizeToYmd(shipment?.["IHD"]);
    if (!id || !date) return;
    events.push({
      kind: DASH_EVENT_KIND_SHIPMENT,
      dateYmd: date,
      title: id,
      meta: String(shipment?.["Ship Method"] ?? "").trim(),
      cls: "dash-event--shipment",
      done: isShipmentReceived(shipment),
      open: () => { if (typeof openShipmentDetail === "function") openShipmentDetail(shipment); },
    });
  });

  (typeof allAsnRequests !== "undefined" ? allAsnRequests : []).forEach(request => {
    const id = getAsnRequestRecordId(request);
    const date = normalizeToYmd(request?.[ASN_DATE_FIELD]);
    if (!id || !date) return;
    events.push({
      kind: DASH_EVENT_KIND_ASN,
      dateYmd: date,
      title: id,
      meta: String(request?.["Buyer"] ?? "").trim(),
      cls: "dash-event--asn",
      done: isAsnRequestPickedUp(request),
      open: () => { if (typeof openAsnRequestDetail === "function") openAsnRequestDetail(id); },
    });
  });

  events.sort((a, b) =>
    a.kind - b.kind || a.title.localeCompare(b.title, undefined, { numeric: true })
  );

  const byDate = new Map();
  events.forEach(ev => {
    if (!dashCalFilterSelection.has(ev.cls)) return;
    if (!byDate.has(ev.dateYmd)) byDate.set(ev.dateYmd, []);
    byDate.get(ev.dateYmd).push(ev);
  });
  return byDate;
}

// ── Calendar event-type filter ───────────────────────────────

function isDashCalFilterActive() {
  return dashCalFilterSelection.size < DASH_CAL_FILTER_OPTIONS.length;
}

function updateDashCalFilterButton() {
  document.getElementById("dashCalFilterBtn")
    ?.classList.toggle("is-filtered", isDashCalFilterActive());
}

function renderDashCalFilterList() {
  const list = document.getElementById("dashCalFilterList");
  if (!list) return;
  list.innerHTML = "";
  DASH_CAL_FILTER_OPTIONS.forEach(({ cls, label }) => {
    const option = document.createElement("label");
    option.className = "column-filter-option";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = dashCalFilterSelection.has(cls);
    cb.addEventListener("change", () => {
      if (cb.checked) dashCalFilterSelection.add(cls);
      else dashCalFilterSelection.delete(cls);
      onDashCalFilterChange();
    });

    const dot = document.createElement("i");
    dot.className = `dash-dot ${cls.replace("dash-event--", "dash-dot--")}`;
    const span = document.createElement("span");
    span.textContent = label;

    option.appendChild(cb);
    option.appendChild(dot);
    option.appendChild(span);
    list.appendChild(option);
  });
}

function onDashCalFilterChange() {
  updateDashCalFilterButton();
  renderDashCalendar();
  renderDashDayPane();
}

function setDashCalFilterAll(selectAll) {
  dashCalFilterSelection = new Set(
    selectAll ? DASH_CAL_FILTER_OPTIONS.map(o => o.cls) : []
  );
  renderDashCalFilterList();
  onDashCalFilterChange();
}

function toggleDashCalFilterPopover() {
  const pop = document.getElementById("dashCalFilterPopover");
  const btn = document.getElementById("dashCalFilterBtn");
  if (!pop || !btn) return;
  if (!pop.hidden) {
    closeDashCalFilterPopover();
    return;
  }
  renderDashCalFilterList();
  pop.hidden = false;
  btn.setAttribute("aria-expanded", "true");
  requestAnimationFrame(() => {
    const rect = btn.getBoundingClientRect();
    const maxLeft = window.innerWidth - pop.offsetWidth - 8;
    pop.style.top = `${rect.bottom + 4}px`;
    pop.style.left = `${Math.min(Math.max(8, rect.left), maxLeft)}px`;
  });
}

function closeDashCalFilterPopover() {
  const pop = document.getElementById("dashCalFilterPopover");
  if (pop) pop.hidden = true;
  document.getElementById("dashCalFilterBtn")?.setAttribute("aria-expanded", "false");
}

// ── Calendar grid ────────────────────────────────────────────

function getDashCalCursor() {
  if (!dashCalCursor) {
    const now = new Date();
    dashCalCursor = { year: now.getFullYear(), month: now.getMonth() };
  }
  return dashCalCursor;
}

function setDashCalTitle(year, month) {
  const title = document.getElementById("dashCalTitle");
  if (title) {
    title.textContent = new Date(year, month, 1)
      .toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }
}

/** Arrows: retarget a month and glide to it; rebuild if it's outside the range. */
function stepDashMonth(delta) {
  const { year, month } = getDashCalCursor();
  const next = new Date(year, month + delta, 1);
  dashCalCursor = { year: next.getFullYear(), month: next.getMonth() };
  setDashCalTitle(dashCalCursor.year, dashCalCursor.month);
  if (!scrollDashCalToMonth(dashCalCursor.year, dashCalCursor.month)) {
    renderDashCalendar();
  }
}

function scrollDashCalToMonth(year, month, { instant = false } = {}) {
  const scrollEl = dashCalScrollEl;
  const anchor = dashCalMonthAnchors[`${year}-${month}`];
  if (!scrollEl || !anchor) return false;
  const headH = scrollEl.querySelector(".dash-cal-head")?.offsetHeight || 0;
  scrollEl.scrollTo({
    top: Math.max(0, anchor.offsetTop - headH),
    behavior: instant ? "auto" : "smooth",
  });
  return true;
}

/** As the user scrolls, sync the title/cursor to the month at the top edge. */
function onDashCalScroll() {
  if (dashCalScrollRaf) return;
  dashCalScrollRaf = requestAnimationFrame(() => {
    dashCalScrollRaf = 0;
    const scrollEl = dashCalScrollEl;
    if (!scrollEl) return;
    const headH = scrollEl.querySelector(".dash-cal-head")?.offsetHeight || 0;
    const edge = scrollEl.scrollTop + headH + 4;
    let current = null;
    for (const [key, el] of Object.entries(dashCalMonthAnchors)) {
      if (el.offsetTop <= edge) current = key;
      else break;
    }
    if (!current) return;
    const [year, month] = current.split("-").map(Number);
    dashCalCursor = { year, month };
    setDashCalTitle(year, month);
  });
}

/** Build one day cell (events, chips, selection, click) for the grid. */
function buildDashCalCell(date, byDate, todayYmd) {
  const ymd = formatDateToYmd(date);
  const cell = document.createElement("div");
  cell.className = "dash-cal-cell";
  cell.dataset.ymd = ymd;
  const weekday = date.getDay();
  if (weekday === 0 || weekday === 6) cell.classList.add("is-weekend");
  if (ymd === todayYmd) cell.classList.add("is-today");
  if (ymd === dashSelectedYmd) cell.classList.add("is-selected");

  const num = document.createElement("span");
  num.className = "dash-cal-date";
  // Every day shows m/d so months stay legible in the continuous scroll.
  num.textContent = `${date.getMonth() + 1}/${date.getDate()}`;
  if (date.getDate() === 1) {
    cell.classList.add("is-month-start");
    dashCalMonthAnchors[`${date.getFullYear()}-${date.getMonth()}`] = cell;
  }
  cell.appendChild(num);

  const dayEvents = byDate.get(ymd) || [];
  // SOs collapse into per-type summary lines (details live in the day pane);
  // shipments/ASNs keep full clickable chips and render above the SOs.
  const soEvents = dayEvents.filter(ev => ev.kind === DASH_EVENT_KIND_SO);
  const chipEvents = dayEvents.filter(ev => ev.kind !== DASH_EVENT_KIND_SO);

  const collapsed = chipEvents.length > DASH_CAL_MAX_EVENTS + 1;
  chipEvents.forEach((ev, index) => {
    if (collapsed && index >= DASH_CAL_MAX_EVENTS) return;
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `dash-event ${ev.cls}${ev.done ? " is-done" : ""}`;
    chip.title = ev.meta ? `${ev.title} · ${ev.meta}` : ev.title;

    const icon = createDashEventIcon(ev.cls);
    if (icon) chip.appendChild(icon);

    const label = document.createElement("span");
    label.className = "dash-event-title";
    label.textContent = ev.title;
    chip.appendChild(label);

    if (ev.meta) {
      const meta = document.createElement("span");
      meta.className = "dash-event-meta";
      meta.textContent = ev.meta;
      chip.appendChild(meta);
    }

    chip.addEventListener("click", e => {
      e.stopPropagation();
      ev.open();
    });
    cell.appendChild(chip);
  });

  if (collapsed) {
    const more = document.createElement("span");
    more.className = "dash-cal-more";
    more.textContent = `+${chipEvents.length - DASH_CAL_MAX_EVENTS} more`;
    cell.appendChild(more);
  }

  if (soEvents.length === 1) {
    // A lone SO shows its full info, as a display-only chip.
    const ev = soEvents[0];
    const chip = document.createElement("span");
    chip.className = `dash-event ${ev.cls}${ev.done ? " is-done" : ""}`;
    chip.title = ev.meta ? `${ev.title} · ${ev.meta}` : ev.title;
    const label = document.createElement("span");
    label.className = "dash-event-title";
    label.textContent = ev.title;
    chip.appendChild(label);
    if (ev.meta) {
      const meta = document.createElement("span");
      meta.className = "dash-event-meta";
      meta.textContent = ev.meta;
      chip.appendChild(meta);
    }
    cell.appendChild(chip);
  } else if (soEvents.length > 1) {
    // One bar per order type: "4 Major Orders", "2 Specialty Orders"…
    DASH_SO_SUMMARY_ORDER.forEach(cls => {
      const count = soEvents.filter(ev => ev.cls === cls).length;
      if (count === 0) return;
      const bar = document.createElement("span");
      bar.className = "dash-so-summary";
      bar.title = "Click day for details";
      const dot = document.createElement("i");
      dot.className = `dash-dot ${cls.replace("dash-event--", "dash-dot--")}`;
      bar.appendChild(dot);
      bar.append(`${count} ${DASH_SO_TYPE_LABELS[cls]} Order${count === 1 ? "" : "s"}`);
      cell.appendChild(bar);
    });
  }

  // Only days with events are interactive (hover/select/open the day pane).
  if (dayEvents.length > 0) {
    cell.classList.add("has-events");
    cell.addEventListener("click", () => selectDashDay(ymd));
  }

  return cell;
}

/** Size week rows so roughly one month (≈5 rows) fills the viewport. */
function sizeDashCalRows() {
  const scrollEl = dashCalScrollEl;
  if (!scrollEl) return;
  const headH = scrollEl.querySelector(".dash-cal-head")?.offsetHeight || 0;
  const avail = scrollEl.clientHeight - headH;
  const rowH = Math.max(84, Math.floor(avail / 5));
  scrollEl.style.setProperty("--dash-cal-row-h", `${rowH}px`);
}

/**
 * Continuous month grid: renders a range of weeks around the cursor month and
 * scrolls seamlessly. Month boundaries are traced with heavier borders; the
 * arrows/Today jump month to month and the centered title tracks the view.
 */
function renderDashCalendar() {
  const grid = document.getElementById("dashCalGrid");
  if (!grid) return;

  const { year, month } = getDashCalCursor();
  setDashCalTitle(year, month);

  const byDate = buildDashEventsByDate();
  const todayYmd = dashTodayYmd();
  dashCalMonthAnchors = {};

  grid.innerHTML = "";

  const scroll = document.createElement("div");
  scroll.className = "dash-cal-scroll dash-scroll";

  const head = document.createElement("div");
  head.className = "dash-cal-head";
  ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((day, i) => {
    const cell = document.createElement("div");
    cell.className = "dash-cal-head-cell";
    if (i === 0 || i === 6) cell.classList.add("is-weekend");
    cell.textContent = day;
    head.appendChild(cell);
  });
  scroll.appendChild(head);

  const body = document.createElement("div");
  body.className = "dash-cal-body";

  // Range spans a few months back to a year forward; start/end snap to whole weeks.
  const start = new Date(year, month - DASH_CAL_MONTHS_BEFORE, 1);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(year, month + DASH_CAL_MONTHS_AFTER + 1, 0);
  end.setDate(end.getDate() + (6 - end.getDay()));

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    body.appendChild(buildDashCalCell(new Date(d), byDate, todayYmd));
  }

  scroll.appendChild(body);
  grid.appendChild(scroll);

  dashCalScrollEl = scroll;
  scroll.addEventListener("scroll", onDashCalScroll, { passive: true });
  sizeDashCalRows();
  scrollDashCalToMonth(year, month, { instant: true });
}

// ── Day pane (opens beside the calendar when a day is selected) ──

/** Toggle in place so the scroll position is preserved (no full re-render). */
function applyDashDaySelection() {
  document.querySelectorAll("#dashCalGrid .dash-cal-cell.is-selected")
    .forEach(cell => cell.classList.remove("is-selected"));
  if (dashSelectedYmd) {
    document.querySelector(`#dashCalGrid .dash-cal-cell[data-ymd="${dashSelectedYmd}"]`)
      ?.classList.add("is-selected");
  }
}

function selectDashDay(ymd) {
  dashSelectedYmd = ymd === dashSelectedYmd ? "" : ymd;
  applyDashDaySelection();
  renderDashDayPane();
}

function closeDashDayPane() {
  dashSelectedYmd = "";
  applyDashDaySelection();
  renderDashDayPane();
}

function renderDashDayPane() {
  const pane = document.getElementById("dashDayPane");
  if (!pane) return;
  if (!dashSelectedYmd) {
    pane.hidden = true;
    return;
  }
  pane.hidden = false;

  const title = document.getElementById("dashDayPaneTitle");
  const selectedDate = parseYmdToLocalDate(dashSelectedYmd);
  if (title) {
    title.textContent = selectedDate
      ? selectedDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
      : dashSelectedYmd;
  }

  const events = buildDashEventsByDate().get(dashSelectedYmd) || [];
  const countEl = document.getElementById("dashDayPaneCount");
  if (countEl) countEl.textContent = events.length ? String(events.length) : "";

  const list = document.getElementById("dashDayPaneList");
  if (!list) return;
  list.innerHTML = "";
  if (events.length === 0) {
    list.appendChild(dashEmptyState("Nothing scheduled this day."));
    return;
  }
  events.forEach(ev => {
    const row = dashListRow({
      id: ev.title,
      sub: ev.meta,
      date: "",
      dot: ev.cls.replace("dash-event--", "dash-dot--"),
      onOpen: ev.open,
    });
    if (ev.done) row.classList.add("is-done");
    list.appendChild(row);
  });
}

// ── KPI cards ────────────────────────────────────────────────

function dashKpiCard({ value, label, alert = false, onClick = null }) {
  const card = document.createElement(onClick ? "button" : "div");
  if (onClick) card.type = "button";
  card.className = "dash-kpi" + (alert && value > 0 ? " is-alert" : "");

  const valueEl = document.createElement("span");
  valueEl.className = "dash-kpi-value";
  valueEl.textContent = Number(value).toLocaleString();
  const labelEl = document.createElement("span");
  labelEl.className = "dash-kpi-label";
  labelEl.textContent = label;
  card.appendChild(valueEl);
  card.appendChild(labelEl);

  if (onClick) card.addEventListener("click", onClick);
  return card;
}

function renderDashKpis() {
  const wrap = document.getElementById("dashboardKpis");
  if (!wrap) return;

  const todayYmd = dashTodayYmd();
  const now = new Date();
  const in7Ymd = formatDateToYmd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7));

  const openSos = getDashOpenSalesOrders();
  const dueSoon = openSos.filter(order => {
    const cxl = normalizeToYmd(order["CXL Date"]);
    return cxl && cxl >= todayYmd && cxl <= in7Ymd;
  });
  const otwPos = (typeof allRows !== "undefined" ? allRows : [])
    .filter(row => getRowWorkflowStatus(row) === "OTW");
  const openShipments = getDashOpenShipments();
  const openAsns = getDashOpenAsnRequests();
  const overdue =
    openShipments.filter(s => {
      const ihd = normalizeToYmd(s["IHD"]);
      return ihd && ihd < todayYmd;
    }).length +
    openAsns.filter(r => {
      const date = normalizeToYmd(r[ASN_DATE_FIELD]);
      return date && date < todayYmd;
    }).length;

  const goTo = view => () => { if (typeof switchAppView === "function") switchAppView(view); };

  wrap.innerHTML = "";
  wrap.appendChild(dashKpiCard({ value: openSos.length, label: "Open SOs", onClick: goTo("sales") }));
  wrap.appendChild(dashKpiCard({ value: dueSoon.length, label: "SOs due in 7 days", onClick: goTo("sales") }));
  wrap.appendChild(dashKpiCard({ value: otwPos.length, label: "POs on the water", onClick: goTo("po") }));
  wrap.appendChild(dashKpiCard({ value: openShipments.length, label: "Open shipments", onClick: goTo("shipments") }));
  wrap.appendChild(dashKpiCard({
    value: openAsns.length,
    label: "Open ASNs",
    onClick: () => {
      if (typeof switchAppView === "function") switchAppView("requests");
      if (typeof switchRequestType === "function") switchRequestType("asn");
    },
  }));
  wrap.appendChild(dashKpiCard({ value: overdue, label: "Overdue arrivals", alert: true }));
}

// ── Panel list helpers ───────────────────────────────────────

function dashEmptyState(text) {
  const el = document.createElement("div");
  el.className = "dash-empty";
  el.textContent = text;
  return el;
}

function dashListRow({ id, sub, date, dateLabel = "", overdue = false, onOpen, action = null, dot = "" }) {
  const row = document.createElement("div");
  row.className = "dash-list-row";
  row.setAttribute("role", "button");
  row.tabIndex = 0;

  if (dot) {
    const dotEl = document.createElement("i");
    dotEl.className = `dash-dot ${dot}`;
    row.appendChild(dotEl);
  }

  const main = document.createElement("span");
  main.className = "dash-row-main";
  const idEl = document.createElement("span");
  idEl.className = "dash-row-id";
  idEl.textContent = id;
  main.appendChild(idEl);
  if (sub) {
    const subEl = document.createElement("span");
    subEl.className = "dash-row-sub";
    subEl.textContent = sub;
    main.appendChild(subEl);
  }
  row.appendChild(main);

  if (date || dateLabel) {
    const end = document.createElement("span");
    end.className = "dash-row-end";
    const dateEl = document.createElement("span");
    dateEl.className = "dash-row-date" + (overdue ? " is-overdue" : "");
    dateEl.textContent = date || "—";
    end.appendChild(dateEl);
    if (dateLabel) {
      const dateLabelEl = document.createElement("span");
      dateLabelEl.className = "dash-row-sub";
      dateLabelEl.textContent = dateLabel;
      end.appendChild(dateLabelEl);
    }
    row.appendChild(end);
  }

  if (action) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-secondary dash-row-action";
    btn.textContent = action.label;
    btn.addEventListener("click", e => {
      e.stopPropagation();
      action.onClick();
    });
    row.appendChild(btn);
  }

  if (onOpen) {
    row.addEventListener("click", onOpen);
    row.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onOpen();
      }
    });
  }
  return row;
}

// ── Open orders by week ──────────────────────────────────────
// Only three buckets, keyed by the SO's CXL week: past due, this week, next.

const DASH_WEEK_BUCKETS = [
  { id: "past", label: "Past Due" },
  { id: "this", label: "This Week" },
  { id: "next", label: "Next Week" },
];
let dashWeeksBucket = "this";

/** Which bucket an SO's CXL week falls in, or null if further out / undated. */
function dashOrderWeekBucket(order, thisWeekStart, nextWeekStart) {
  const cxlDate = parseYmdToLocalDate(normalizeToYmd(order["CXL Date"]));
  if (!cxlDate) return null;
  const weekStart = dashWeekStartYmd(cxlDate);
  if (weekStart < thisWeekStart) return "past";
  if (weekStart === thisWeekStart) return "this";
  if (weekStart === nextWeekStart) return "next";
  return null;
}

function renderDashWeeks() {
  const list = document.getElementById("dashWeeksList");
  if (!list) return;

  const todayYmd = dashTodayYmd();
  const thisWeekStart = dashWeekStartYmd(new Date());
  const nextWeekDate = new Date();
  nextWeekDate.setDate(nextWeekDate.getDate() + 7);
  const nextWeekStart = dashWeekStartYmd(nextWeekDate);

  const buckets = { past: [], this: [], next: [] };
  getDashOpenSalesOrders().forEach(order => {
    const bucket = dashOrderWeekBucket(order, thisWeekStart, nextWeekStart);
    if (bucket) buckets[bucket].push(order);
  });

  // Segmented control — reflect counts and the active selection.
  const tabs = document.getElementById("dashWeeksTabs");
  if (tabs) {
    tabs.querySelectorAll("[data-week-bucket]").forEach(btn => {
      const id = btn.dataset.weekBucket;
      const active = id === dashWeeksBucket;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
      const countEl = btn.querySelector(".dash-weeks-tab-count");
      if (countEl) countEl.textContent = buckets[id].length ? String(buckets[id].length) : "";
    });
  }

  const orders = buckets[dashWeeksBucket].slice().sort((a, b) =>
    normalizeToYmd(a["CXL Date"]).localeCompare(normalizeToYmd(b["CXL Date"])) ||
    String(a["SO #"]).localeCompare(String(b["SO #"]), undefined, { numeric: true })
  );

  const countEl = document.getElementById("dashWeeksCount");
  if (countEl) countEl.textContent = orders.length ? String(orders.length) : "";

  list.innerHTML = "";
  if (orders.length === 0) {
    const label = DASH_WEEK_BUCKETS.find(b => b.id === dashWeeksBucket)?.label ?? "";
    list.appendChild(dashEmptyState(`No open sales orders for ${label}.`));
    return;
  }

  orders.forEach(order => {
    const cxl = normalizeToYmd(order["CXL Date"]);
    const orderUnits = dashSoUnits(order);
    list.appendChild(dashListRow({
      id: `SO ${String(order["SO #"] ?? "").trim()}`,
      sub: String(order["Customer"] ?? "").trim(),
      date: formatDateForDisplay(cxl),
      dateLabel: orderUnits > 0 ? `${orderUnits.toLocaleString()} pcs` : "",
      overdue: cxl < todayYmd,
      onOpen: () => { if (typeof openSalesOrderModal === "function") openSalesOrderModal(order); },
    }));
  });
}

// ── Open shipments / ASNs ────────────────────────────────────

function renderDashShipments() {
  const list = document.getElementById("dashShipmentsList");
  if (!list) return;
  list.innerHTML = "";

  const todayYmd = dashTodayYmd();
  const shipments = getDashOpenShipments().sort((a, b) => {
    const aIhd = normalizeToYmd(a["IHD"]);
    const bIhd = normalizeToYmd(b["IHD"]);
    if (!aIhd && !bIhd) return 0;
    if (!aIhd) return 1;
    if (!bIhd) return -1;
    return aIhd.localeCompare(bIhd);
  });

  const countEl = document.getElementById("dashShipmentsCount");
  if (countEl) countEl.textContent = shipments.length ? String(shipments.length) : "";

  if (shipments.length === 0) {
    list.appendChild(dashEmptyState("No open shipments — everything has been received."));
    return;
  }

  shipments.forEach(shipment => {
    const id = String(shipment[SHIPMENT_ID_FIELD] ?? "").trim();
    const ihd = normalizeToYmd(shipment["IHD"]);
    const poCount = countPosForShipment(id);
    const method = String(shipment["Ship Method"] ?? "").trim();
    list.appendChild(dashListRow({
      id,
      sub: [method, poCount > 0 ? `${poCount} PO${poCount === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · "),
      date: ihd ? formatDateForDisplay(ihd) : "No IHD",
      dateLabel: "IHD",
      overdue: Boolean(ihd && ihd < todayYmd),
      onOpen: () => { if (typeof openShipmentDetail === "function") openShipmentDetail(shipment); },
      action: { label: "Receive", onClick: () => setShipmentReceived(id, true) },
    }));
  });
}

function renderDashAsns() {
  const list = document.getElementById("dashAsnList");
  if (!list) return;
  list.innerHTML = "";

  const todayYmd = dashTodayYmd();
  const requests = getDashOpenAsnRequests().sort((a, b) => {
    const aDate = normalizeToYmd(a[ASN_DATE_FIELD]);
    const bDate = normalizeToYmd(b[ASN_DATE_FIELD]);
    if (!aDate && !bDate) return 0;
    if (!aDate) return 1;
    if (!bDate) return -1;
    return aDate.localeCompare(bDate);
  });

  const countEl = document.getElementById("dashAsnCount");
  if (countEl) countEl.textContent = requests.length ? String(requests.length) : "";

  if (requests.length === 0) {
    list.appendChild(dashEmptyState("No open ASNs — everything has been picked up."));
    return;
  }

  requests.forEach(request => {
    const id = getAsnRequestRecordId(request);
    const date = normalizeToYmd(request[ASN_DATE_FIELD]);
    const poCount = dashAsnPoCount(request);
    const buyer = String(request["Buyer"] ?? "").trim();
    list.appendChild(dashListRow({
      id,
      sub: [buyer, poCount > 0 ? `${poCount} PO${poCount === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · "),
      date: date ? formatDateForDisplay(date) : "No date",
      dateLabel: "ASN Date",
      overdue: Boolean(date && date < todayYmd),
      onOpen: () => { if (typeof openAsnRequestDetail === "function") openAsnRequestDetail(id); },
      action: { label: "Picked Up", onClick: () => setAsnRequestPickedUp(id, true) },
    }));
  });
}

// ── Entry points ─────────────────────────────────────────────

function renderDashboard() {
  renderDashKpis();
  renderDashCalendar();
  renderDashDayPane();
  renderDashWeeks();
  renderDashShipments();
  renderDashAsns();
}

/** Re-render after data loads or a status change while the dashboard is open. */
function refreshDashboardIfActive() {
  if (typeof currentAppView !== "undefined" && currentAppView === "dashboard") {
    renderDashboard();
  }
}

function initDashboard() {
  document.getElementById("navLogoDashboard")?.addEventListener("click", () => {
    if (typeof switchAppView === "function") switchAppView("dashboard");
  });
  document.getElementById("dashCalPrev")?.addEventListener("click", () => stepDashMonth(-1));
  document.getElementById("dashCalNext")?.addEventListener("click", () => stepDashMonth(1));
  document.getElementById("dashCalToday")?.addEventListener("click", () => {
    const now = new Date();
    dashCalCursor = { year: now.getFullYear(), month: now.getMonth() };
    setDashCalTitle(dashCalCursor.year, dashCalCursor.month);
    if (!scrollDashCalToMonth(dashCalCursor.year, dashCalCursor.month)) {
      renderDashCalendar();
    }
  });
  document.getElementById("dashDayPaneClose")?.addEventListener("click", closeDashDayPane);

  document.getElementById("dashCalFilterBtn")?.addEventListener("click", e => {
    e.stopPropagation();
    toggleDashCalFilterPopover();
  });
  document.getElementById("dashCalFilterSelectAll")?.addEventListener("click", () => setDashCalFilterAll(true));
  document.getElementById("dashCalFilterClearAll")?.addEventListener("click", () => setDashCalFilterAll(false));
  document.addEventListener("click", e => {
    const pop = document.getElementById("dashCalFilterPopover");
    if (!pop || pop.hidden) return;
    if (pop.contains(e.target) || e.target.closest("#dashCalFilterBtn")) return;
    closeDashCalFilterPopover();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeDashCalFilterPopover();
  });

  // Clicking anywhere on the dashboard that isn't a date (or the day pane
  // itself) clears the selection and closes the overlay.
  document.getElementById("dashboardWrap")?.addEventListener("click", e => {
    if (!dashSelectedYmd) return;
    if (e.target.closest(".dash-cal-cell")) return;
    if (e.target.closest("#dashDayPane")) return;
    closeDashDayPane();
  });

  document.getElementById("dashWeeksTabs")?.addEventListener("click", e => {
    const btn = e.target.closest("[data-week-bucket]");
    if (!btn) return;
    dashWeeksBucket = btn.dataset.weekBucket;
    renderDashWeeks();
  });

  // Keep ≈one month visible as the window resizes.
  window.addEventListener("resize", () => {
    if (typeof currentAppView !== "undefined" && currentAppView === "dashboard") {
      sizeDashCalRows();
    }
  });
}

initDashboard();
