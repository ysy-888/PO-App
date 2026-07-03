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

let dashCalCursor = null; // { year, month } — null = current month

/** Max event chips shown per calendar day before collapsing behind "+N more". */
const DASH_CAL_MAX_EVENTS = 4;

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
    events.push({
      kind: 0,
      dateYmd: date,
      title: `SO ${soNum}`,
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
      kind: 1,
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
      kind: 2,
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
    if (!byDate.has(ev.dateYmd)) byDate.set(ev.dateYmd, []);
    byDate.get(ev.dateYmd).push(ev);
  });
  return byDate;
}

// ── Calendar grid ────────────────────────────────────────────

function getDashCalCursor() {
  if (!dashCalCursor) {
    const now = new Date();
    dashCalCursor = { year: now.getFullYear(), month: now.getMonth() };
  }
  return dashCalCursor;
}

function stepDashMonth(delta) {
  const { year, month } = getDashCalCursor();
  const next = new Date(year, month + delta, 1);
  dashCalCursor = { year: next.getFullYear(), month: next.getMonth() };
  renderDashCalendar();
}

function renderDashCalendar() {
  const grid = document.getElementById("dashCalGrid");
  if (!grid) return;

  const { year, month } = getDashCalCursor();
  const title = document.getElementById("dashCalTitle");
  if (title) {
    title.textContent = new Date(year, month, 1)
      .toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }

  const byDate = buildDashEventsByDate();
  const todayYmd = dashTodayYmd();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks = Math.ceil((firstDay + daysInMonth) / 7);

  grid.innerHTML = "";

  const head = document.createElement("div");
  head.className = "dash-cal-head";
  ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach(day => {
    const cell = document.createElement("div");
    cell.className = "dash-cal-head-cell";
    cell.textContent = day;
    head.appendChild(cell);
  });
  grid.appendChild(head);

  const body = document.createElement("div");
  body.className = "dash-cal-body";

  for (let i = 0; i < weeks * 7; i++) {
    const date = new Date(year, month, 1 - firstDay + i);
    const ymd = formatDateToYmd(date);
    const cell = document.createElement("div");
    cell.className = "dash-cal-cell";
    if (date.getMonth() !== month) cell.classList.add("is-outside");
    if (ymd === todayYmd) cell.classList.add("is-today");

    const num = document.createElement("span");
    num.className = "dash-cal-date";
    num.textContent = String(date.getDate());
    cell.appendChild(num);

    const dayEvents = byDate.get(ymd) || [];
    // Busy days collapse to a few chips + "+N more" so one day can't blow up the row.
    const collapsed = dayEvents.length > DASH_CAL_MAX_EVENTS + 1;

    dayEvents.forEach((ev, index) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = `dash-event ${ev.cls}${ev.done ? " is-done" : ""}`;
      if (collapsed && index >= DASH_CAL_MAX_EVENTS) chip.classList.add("dash-event-overflow");
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

      chip.addEventListener("click", ev.open);
      cell.appendChild(chip);
    });

    if (collapsed) {
      const hiddenCount = dayEvents.length - DASH_CAL_MAX_EVENTS;
      const more = document.createElement("button");
      more.type = "button";
      more.className = "dash-cal-more";
      more.textContent = `+${hiddenCount} more`;
      more.addEventListener("click", () => {
        const expanded = cell.classList.toggle("is-expanded");
        more.textContent = expanded ? "Show less" : `+${hiddenCount} more`;
      });
      cell.appendChild(more);
    }

    body.appendChild(cell);
  }

  grid.appendChild(body);
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

function dashListRow({ id, sub, date, dateLabel = "", overdue = false, onOpen, action = null }) {
  const row = document.createElement("div");
  row.className = "dash-list-row";
  row.setAttribute("role", "button");
  row.tabIndex = 0;

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

function renderDashWeeks() {
  const list = document.getElementById("dashWeeksList");
  if (!list) return;
  list.innerHTML = "";

  const todayYmd = dashTodayYmd();
  const thisWeekStart = dashWeekStartYmd(new Date());

  const orders = getDashOpenSalesOrders()
    .filter(order => normalizeToYmd(order["CXL Date"]))
    .sort((a, b) =>
      normalizeToYmd(a["CXL Date"]).localeCompare(normalizeToYmd(b["CXL Date"])) ||
      String(a["SO #"]).localeCompare(String(b["SO #"]), undefined, { numeric: true })
    );

  const countEl = document.getElementById("dashWeeksCount");
  if (countEl) countEl.textContent = orders.length ? String(orders.length) : "";

  if (orders.length === 0) {
    list.appendChild(dashEmptyState("No open sales orders with a CXL date."));
    return;
  }

  // Group by CXL week (Sun–Sat); everything before this week collapses into "Past due".
  const groups = new Map();
  orders.forEach(order => {
    const cxlDate = parseYmdToLocalDate(normalizeToYmd(order["CXL Date"]));
    if (!cxlDate) return;
    const weekStart = dashWeekStartYmd(cxlDate);
    const key = weekStart < thisWeekStart ? "past" : weekStart;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(order);
  });

  const keys = [...groups.keys()].sort((a, b) => {
    if (a === "past") return -1;
    if (b === "past") return 1;
    return a.localeCompare(b);
  });

  keys.forEach(key => {
    const group = groups.get(key);
    const units = group.reduce((sum, order) => sum + dashSoUnits(order), 0);

    const header = document.createElement("div");
    header.className = "dash-week-header";
    if (key === "past") header.classList.add("is-overdue");
    else if (key === thisWeekStart) header.classList.add("is-current");

    const labelEl = document.createElement("span");
    labelEl.textContent = key === "past"
      ? "Past due"
      : (key === thisWeekStart ? "This week" : `Week of ${formatDateForDisplay(key)}`);
    const metaEl = document.createElement("span");
    metaEl.textContent = `${group.length} SO${group.length === 1 ? "" : "s"}${units > 0 ? ` · ${units.toLocaleString()} pcs` : ""}`;
    header.appendChild(labelEl);
    header.appendChild(metaEl);
    list.appendChild(header);

    group.forEach(order => {
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
    dashCalCursor = null;
    renderDashCalendar();
  });
}

initDashboard();
