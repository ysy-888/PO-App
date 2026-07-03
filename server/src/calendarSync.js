/**
 * Syncs PO App dates into the configured Google Calendar as all-day events:
 *
 *   CXL dates      — one event per open PO with a CXL Date
 *   EXF dates      — one event per EXF request with an EXF Date
 *   Pickup dates   — one event per pickup request with a Pickup Date
 *   Delivery dates — one event per delivery request with a Delivery Date
 *
 * The sync is a diff: it lists the events it manages (marked with a private
 * extended property), compares them to what the database says, and only
 * inserts/patches/deletes the differences — so steady-state runs are cheap.
 * Events dated more than LOOKBACK_DAYS in the past are left untouched as
 * history. Runs on a timer from index.js and on demand via
 * POST /api/google/sync-calendar.
 */

import supabase from "./supabase.js";
import { isPoClosed } from "./importHelpers.js";
import {
  calendarConfigured,
  calendarEventId,
  listManagedCalendarEvents,
  upsertCalendarEvent,
  patchCalendarEvent,
  deleteCalendarEvent,
} from "./google.js";

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

/** Build the desired event set from the database. Map(eventId → event spec). */
async function buildDesiredEvents(cutoff) {
  const desired = new Map();

  const add = (idParts, dateYmd, summary, description) => {
    if (!dateYmd || dateYmd < cutoff) return;
    desired.set(calendarEventId(...idParts), { summary, description, dateYmd });
  };

  const [pos, exfs, pickups, deliveries] = await Promise.all([
    fetchAll("purchase_orders"),
    fetchAll("exf_requests"),
    fetchAll("pickup_requests"),
    fetchAll("delivery_requests"),
  ]);

  for (const row of pos) {
    const po = row.data || {};
    if (isPoClosed(po)) continue;
    const poNumber = String(po["PO #"] ?? "").trim();
    const date = toYmd(po["CXL Date"]);
    if (!poNumber || !date) continue;
    add(
      ["cxl", row.tenant_id, poNumber],
      date,
      `CXL: PO ${poNumber}${po["Buyer"] ? ` · ${po["Buyer"]}` : ""}`,
      describe([
        po["Style #"] && `Style: ${po["Style #"]}${po["Color"] ? ` / ${po["Color"]}` : ""}`,
        po["PO Qty"] && `Qty: ${po["PO Qty"]}`,
        po["Vendor"] && `Vendor: ${po["Vendor"]}`,
        po["Status"] && `Status: ${po["Status"]}`,
      ])
    );
  }

  const addRequestEvents = (rows, { idField, dateField, label }) => {
    for (const row of rows) {
      const data = row.data || {};
      const entityId = String(data[idField] ?? "").trim();
      const date = toYmd(data[dateField]);
      if (!entityId || !date) continue;
      const poNumbers = String(data["PO Numbers"] ?? data["PO #"] ?? "").trim();
      add(
        [label.toLowerCase(), row.tenant_id, entityId],
        date,
        `${label}: ${entityId}`,
        describe([
          poNumbers && `POs: ${poNumbers}`,
          data["From"] && `From: ${data["From"]}`,
          data["To"] && `To: ${data["To"]}`,
        ])
      );
    }
  };

  addRequestEvents(exfs, { idField: "EXF Request ID", dateField: "EXF Date", label: "EXF" });
  addRequestEvents(pickups, { idField: "Pickup Request ID", dateField: "Pickup Date", label: "Pickup" });
  addRequestEvents(deliveries, { idField: "Delivery Request ID", dateField: "Delivery Date", label: "Delivery" });

  return desired;
}

function eventNeedsUpdate(existing, spec) {
  return (
    existing.summary !== spec.summary ||
    (existing.description || "") !== (spec.description || "") ||
    existing.start?.date !== spec.dateYmd
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
        await patchCalendarEvent(id, {
          summary: spec.summary,
          description: spec.description || "",
          start: { date: spec.dateYmd },
          end: { date: nextDay(spec.dateYmd) },
          status: "confirmed",
        });
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

function nextDay(ymd) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
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
