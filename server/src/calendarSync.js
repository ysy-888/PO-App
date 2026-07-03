/**
 * Syncs PO App dates into the configured Google Calendar as all-day events:
 *
 *   Sales orders — one event per SO with a CXL Date, on that date
 *   Shipments    — one event per shipment with an IHD, on that date
 *   ASNs         — one event per ASN request with an ASN Date, on that date
 *
 * The sync is a diff: it lists the events it manages (marked with a private
 * extended property), compares them to what the database says, and only
 * inserts/patches/deletes the differences — so steady-state runs are cheap.
 * Events dated more than LOOKBACK_DAYS in the past are left untouched as
 * history. Runs on a timer from index.js and on demand via
 * POST /api/google/sync-calendar.
 */

import supabase from "./supabase.js";
import {
  buildPoText,
  REQUEST_EMAIL_TABLE_COLUMNS,
  REQUEST_EMAIL_TABLE_LABELS,
} from "./emailTemplates.js";
import { getCartonWeightLbs } from "./packingListPrint/helpers.js";
import {
  calendarConfigured,
  calendarEventId,
  eventBody,
  listManagedCalendarEvents,
  upsertCalendarEvent,
  patchCalendarEvent,
  deleteCalendarEvent,
} from "./google.js";

// Google Calendar colorIds (1-11).
// Sales orders use the blue/purple family, varying by Order Type so they
// still read as one group; shipments and ASNs sit outside that family.
const SO_COLOR_BY_ORDER_TYPE = {
  "MAJOR": "9",         // blueberry (dark blue)
  "PRIVATE LABEL": "3", // grape (purple)
  "SPECIALTY": "1",     // lavender (light purple)
};
const SHIPMENT_COLOR_ID = "11"; // tomato (red — same as ASN)
const ASN_COLOR_ID = "11";      // tomato (red)

// Google Calendar caps descriptions around 8k characters.
const MAX_DESCRIPTION_LENGTH = 7500;

const LOOKBACK_DAYS = 60;
// Calendar API default quota is ~600 requests/min; pace mutations well under it.
const MUTATION_DELAY_MS = 150;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function toYmd(value) {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(value ?? "").trim());
  return m ? m[1] : "";
}

function cutoffYmd() {
  const d = new Date();
  d.setDate(d.getDate() - LOOKBACK_DAYS);
  return d.toISOString().slice(0, 10);
}

async function fetchAll(table) {
  const { data, error } = await supabase.from(table).select("tenant_id, data");
  if (error) {
    console.warn(`calendar sync: ${table} query failed:`, error.message);
    return [];
  }
  return data || [];
}

function describe(lines) {
  return lines.filter(Boolean).join("\n");
}

function clampDescription(text) {
  if (text.length <= MAX_DESCRIPTION_LENGTH) return text;
  return `${text.slice(0, MAX_DESCRIPTION_LENGTH - 1)}…`;
}

/** Same table the request emails use, from the same builder. */
function poTable(poRows) {
  return buildPoText(poRows, REQUEST_EMAIL_TABLE_COLUMNS, REQUEST_EMAIL_TABLE_LABELS);
}

/**
 * Loads PO rows enriched with packing Weight (lbs) — mirroring the
 * enrichment the request emails apply — and returns lookups keyed by
 * `${tenantId}|…` for use when building shipment/ASN descriptions.
 */
async function buildPoLookups() {
  const [pos, packingLists, packingCartons] = await Promise.all([
    fetchAll("purchase_orders"),
    fetchAll("packing_lists"),
    fetchAll("packing_cartons"),
  ]);

  // Packing list → PO, then sum carton weights per PO.
  const listToPo = new Map();
  for (const row of packingLists) {
    const listId = String(row.data?.["Packing List ID"] ?? "").trim();
    const po = String(row.data?.["PO #"] ?? "").trim();
    if (listId && po) listToPo.set(`${row.tenant_id}|${listId}`, `${row.tenant_id}|${po}`);
  }
  const weightByPo = new Map();
  for (const row of packingCartons) {
    const listId = String(row.data?.["Packing List ID"] ?? "").trim();
    const poKey = listToPo.get(`${row.tenant_id}|${listId}`);
    if (!poKey) continue;
    weightByPo.set(poKey, (weightByPo.get(poKey) || 0) + getCartonWeightLbs(row.data || {}));
  }

  const poByNumber = new Map();
  const posByShipment = new Map();
  for (const row of pos) {
    const data = row.data || {};
    const poNumber = String(data["PO #"] ?? "").trim();
    if (!poNumber) continue;
    const poKey = `${row.tenant_id}|${poNumber}`;
    const enriched = { ...data, Weight: weightByPo.get(poKey) || "" };
    poByNumber.set(poKey, enriched);

    const shipmentId = String(data["Shipment ID"] ?? "").trim();
    if (shipmentId) {
      const shipKey = `${row.tenant_id}|${shipmentId}`;
      if (!posByShipment.has(shipKey)) posByShipment.set(shipKey, []);
      posByShipment.get(shipKey).push(enriched);
    }
  }
  posByShipment.forEach((rows) =>
    rows.sort((a, b) =>
      String(a["PO #"]).localeCompare(String(b["PO #"]), undefined, { numeric: true })
    )
  );

  return { poByNumber, posByShipment };
}

/** Build the desired event set from the database. Map(eventId → event spec). */
async function buildDesiredEvents(cutoff) {
  const desired = new Map();

  const add = (idParts, dateYmd, summary, description, colorId = "") => {
    if (!dateYmd || dateYmd < cutoff) return;
    desired.set(calendarEventId(...idParts), { summary, description, dateYmd, colorId });
  };

  const [salesOrders, shipments, asns, { poByNumber, posByShipment }] = await Promise.all([
    fetchAll("sales_orders"),
    fetchAll("shipments"),
    fetchAll("asn_requests"),
    buildPoLookups(),
  ]);

  for (const row of salesOrders) {
    const so = row.data || {};
    const soNumber = String(so["SO #"] ?? "").trim();
    const date = toYmd(so["CXL Date"]);
    if (!soNumber || !date) continue;
    // Shopify orders don't belong on the operations calendar.
    if (String(so["Order Type"] ?? "").trim().toUpperCase() === "SHOPIFY") continue;
    // Styles and units live on the SO's line items, not the header.
    const lines = Array.isArray(so["Lines"]) ? so["Lines"] : [];
    const styleNumbers = [...new Set(
      lines.map((line) => String(line?.["Style #"] ?? "").trim()).filter(Boolean)
    )];
    const totalUnits = lines.reduce(
      (sum, line) => sum + (Number(line?.["Total Units"]) || 0), 0
    );
    add(
      ["so-cxl", row.tenant_id, soNumber],
      date,
      `SO# ${soNumber}${so["Customer"] ? ` · ${so["Customer"]}` : ""}`,
      describe([
        so["Customer PO #"] && `Customer PO #: ${so["Customer PO #"]}`,
        styleNumbers.length > 0 && `Style #s: ${styleNumbers.join(", ")}`,
        totalUnits > 0 && `Units: ${totalUnits}`,
        so["Ship Date"] && `Ship Date: ${toYmd(so["Ship Date"])}`,
        so["N41 Status"] && `N41 Status: ${so["N41 Status"]}`,
      ]),
      SO_COLOR_BY_ORDER_TYPE[String(so["Order Type"] ?? "").trim().toUpperCase()] || ""
    );
  }

  for (const row of shipments) {
    const shipment = row.data || {};
    const shipmentId = String(shipment["Shipment ID"] ?? "").trim();
    const date = toYmd(shipment["IHD"]);
    if (!shipmentId || !date) continue;
    const poRows = posByShipment.get(`${row.tenant_id}|${shipmentId}`) || [];
    add(
      ["shipment-ihd", row.tenant_id, shipmentId],
      date,
      shipmentId,
      clampDescription([
        describe([
          shipment["Ship Method"] && `Ship Method: ${shipment["Ship Method"]}`,
          shipment["Vessel"] && `Vessel: ${shipment["Vessel"]}`,
          shipment["ETA"] && `ETA: ${toYmd(shipment["ETA"])}`,
        ]),
        poTable(poRows),
      ].filter(Boolean).join("\n\n")),
      SHIPMENT_COLOR_ID
    );
  }

  for (const row of asns) {
    const asn = row.data || {};
    const asnId = String(asn["ASN Request ID"] ?? "").trim();
    const date = toYmd(asn["ASN Date"]);
    if (!asnId || !date) continue;
    const poRows = String(asn["PO Numbers"] ?? "")
      .split(",")
      .map((po) => poByNumber.get(`${row.tenant_id}|${po.trim()}`))
      .filter(Boolean);
    add(
      ["asn", row.tenant_id, asnId],
      date,
      `${asnId}${asn["Buyer"] ? ` · ${asn["Buyer"]}` : ""}`,
      clampDescription([
        describe([
          asn["Carrier"] && `Carrier: ${asn["Carrier"]}`,
        ]),
        poTable(poRows),
      ].filter(Boolean).join("\n\n")),
      ASN_COLOR_ID
    );
  }

  return desired;
}

function eventNeedsUpdate(existing, spec) {
  return (
    existing.summary !== spec.summary ||
    (existing.description || "") !== (spec.description || "") ||
    existing.start?.date !== spec.dateYmd ||
    (existing.colorId || "") !== (spec.colorId || "") ||
    // Reminders must be explicitly disabled on every managed event.
    existing.reminders?.useDefault !== false ||
    (existing.reminders?.overrides || []).length > 0
  );
}

let syncInProgress = false;

export async function syncCalendar() {
  if (!calendarConfigured) {
    return { skipped: true, reason: "Calendar not configured." };
  }
  if (syncInProgress) {
    return { skipped: true, reason: "Sync already running." };
  }

  syncInProgress = true;
  try {
    const cutoff = cutoffYmd();
    const [desired, existing] = await Promise.all([
      buildDesiredEvents(cutoff),
      listManagedCalendarEvents(),
    ]);

    let created = 0;
    let updated = 0;
    let deleted = 0;

    for (const [id, spec] of desired) {
      const current = existing.get(id);
      if (!current) {
        await upsertCalendarEvent(id, spec);
        created++;
        await sleep(MUTATION_DELAY_MS);
      } else if (eventNeedsUpdate(current, spec)) {
        await patchCalendarEvent(id, eventBody(spec));
        updated++;
        await sleep(MUTATION_DELAY_MS);
      }
    }

    for (const [id, ev] of existing) {
      if (desired.has(id)) continue;
      const evDate = ev.start?.date || "";
      // Past events beyond the lookback window are kept as history.
      if (evDate && evDate < cutoff) continue;
      await deleteCalendarEvent(id);
      deleted++;
      await sleep(MUTATION_DELAY_MS);
    }

    const summary = { created, updated, deleted, tracked: desired.size };
    console.log(
      `Calendar sync: +${created} ~${updated} -${deleted} (${desired.size} tracked events)`
    );
    return { success: true, ...summary };
  } catch (err) {
    console.error("Calendar sync failed:", err.message);
    return { success: false, error: err.message };
  } finally {
    syncInProgress = false;
  }
}

/**
 * Debounced sync trigger for save paths: coalesces bursts of edits into one
 * sync shortly after the last write. If a sync is mid-flight when the timer
 * fires, it retries so the latest changes aren't missed.
 */
let debounceTimer = null;
export function requestCalendarSync(delayMs = 15 * 1000) {
  if (!calendarConfigured) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    const result = await syncCalendar();
    if (result.skipped && result.reason === "Sync already running.") {
      requestCalendarSync(30 * 1000);
    }
  }, delayMs);
  debounceTimer.unref?.();
}

/** Boot-time scheduler: first sync shortly after start, then every 6 hours. */
export function scheduleCalendarSync() {
  if (!calendarConfigured) return;
  const initial = setTimeout(() => {
    syncCalendar();
  }, 30 * 1000);
  initial.unref();
  const interval = setInterval(() => {
    syncCalendar();
  }, 6 * 60 * 60 * 1000);
  interval.unref();
  console.log("Google Calendar sync scheduled (boot + every 6h).");
}
