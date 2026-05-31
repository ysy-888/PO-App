/** Workflow status helpers — transitions, migration, and eligibility. */

const EXF_REQUESTED_FIELD = "EXF Requested";
const DELIVERY_REQUEST_ID_FIELD = "Delivery Request ID";
const PICKUP_REQUEST_ID_FIELD = "Pickup Request ID";

const SHIPPED_GROUP_STATUSES = new Set([
  "OTW", "Arrived at Port", "Scheduled", "In Warehouse",
]);

const DELIVERY_REQUEST_ELIGIBLE_STATUSES = new Set(["OTW", "Arrived at Port"]);

const SHIPMENT_REQUIRED_FIELDS = ["Ship Method", "Shipped", "ETD", "ETA", "IHD"];

const STATUS_MANUAL_TRANSITIONS = {
  Pending: ["Hold", "CXL", "WIP"],
  Hold: ["CXL", "WIP"],
  WIP: ["Hold", "CXL"],
  OTW: ["In Warehouse", "Hold", "CXL", "Closed"],
  "Arrived at Port": ["In Warehouse", "Hold", "CXL", "Closed"],
  Scheduled: ["In Warehouse", "Hold", "CXL", "Closed"],
  "In Warehouse": ["Hold", "CXL", "Closed"],
  Assigned: ["In Warehouse", "Hold", "CXL", "Closed"],
};

function isExfRequested(row) {
  return isTruthy(row[EXF_REQUESTED_FIELD]);
}

function getRowStatus(row) {
  return String(row["Status"] ?? "").trim();
}

function migrateLegacyStatusValue(status, row) {
  const s = String(status ?? "").trim();
  if (s === "Received") return "In Warehouse";
  if (s === "Arrived at WH") return "Arrived at Port";
  if (s === "Shipped") {
    const hasShipment = typeof poHasShipment === "function" && poHasShipment(row);
    return hasShipment ? "OTW" : "In Warehouse";
  }
  return s;
}

function migrateLegacyRow(row) {
  if (!row) return row;
  const status = getRowStatus(row);
  const migrated = migrateLegacyStatusValue(status, row);
  if (migrated !== status) row["Status"] = migrated;
  if (row[EXF_REQUESTED_FIELD] === undefined || row[EXF_REQUESTED_FIELD] === null) {
    row[EXF_REQUESTED_FIELD] = getRowStatus(row) === "Requested";
  }
  return row;
}

function migrateAllRows(rows) {
  rows.forEach(migrateLegacyRow);
}

function getAvailableStatusOptions(row) {
  const status = getRowStatus(row);
  if (status === "Requested") return [];

  let allowed;
  if (!status) {
    allowed = ["Pending", "WIP"];
  } else {
    allowed = STATUS_MANUAL_TRANSITIONS[status] ?? [];
  }

  const optionSet = new Set(allowed);
  if (status) optionSet.add(status);

  return STATUS_SORT_ORDER
    .filter(value => optionSet.has(value))
    .map(value => ({ value, label: value }));
}

function isStatusManuallyEditable(row) {
  return getAvailableStatusOptions(row).length > 0;
}

function rowMatchesShippedGroup(status) {
  return SHIPPED_GROUP_STATUSES.has(status);
}

function isPoEligibleForExfRequest(row) {
  return getRowStatus(row) === "WIP" && !isExfRequested(row);
}

function isPoEligibleForShipment(row) {
  return isExfRequested(row) &&
    getRowStatus(row) === "Requested" &&
    !poHasShipment(row);
}

function isPoEligibleForDeliveryRequest(row) {
  return DELIVERY_REQUEST_ELIGIBLE_STATUSES.has(getRowStatus(row)) &&
    isEmptyValue(row[DELIVERY_REQUEST_ID_FIELD]);
}

function isPoEligibleForPickupRequest(row) {
  return DELIVERY_REQUEST_ELIGIBLE_STATUSES.has(getRowStatus(row)) &&
    isEmptyValue(row[PICKUP_REQUEST_ID_FIELD]);
}

function getAvailableRequestedPos() {
  return allRows.filter(row =>
    isExfRequested(row) &&
    getRowStatus(row) === "Requested" &&
    !poHasShipment(row)
  );
}

function validateShipmentRequiredFields(shipment) {
  const missing = SHIPMENT_REQUIRED_FIELDS.filter(field => isEmptyValue(shipment[field]));
  if (missing.length === 0) return null;
  return `Required: ${missing.join(", ")}`;
}

function isDateOnOrBeforeToday(ymd) {
  const normalized = normalizeToYmd(ymd);
  if (!normalized) return false;
  const today = formatDateToYmd(new Date());
  return normalized <= today;
}

function getPickupRequestDateForRow(row) {
  const id = String(row[PICKUP_REQUEST_ID_FIELD] ?? "").trim();
  if (!id || typeof getPickupRequestById !== "function") {
    return row["Assign Date"] ?? "";
  }
  const request = getPickupRequestById(id);
  return request?.["Request Date"] ?? row["Assign Date"] ?? "";
}

function syncAssignDateFromPickupRequest(row) {
  if (!row) return row;
  const id = String(row[PICKUP_REQUEST_ID_FIELD] ?? "").trim();
  if (!id) return row;
  const date = getPickupRequestDateForRow(row);
  if (date) row["Assign Date"] = date;
  return row;
}

function syncAllAssignDatesFromPickupRequests(rows) {
  rows.forEach(syncAssignDateFromPickupRequest);
}

/** Collect PO updates from automatic transitions; caller persists via batch. */
function collectAutomaticStatusUpdates(rows, shipments) {
  /** @type {{ poNumber: string, updates: Record<string, unknown> }[]} */
  const batch = [];

  rows.forEach(row => {
    const poNumber = String(row["PO #"] ?? "").trim();
    if (!poNumber) return;

    const status = getRowStatus(row);
    const updates = {};

    if (status === "OTW") {
      const shipmentId = getPoShipmentId(row);
      const shipment = shipments?.find(s => String(s[SHIPMENT_ID_FIELD] ?? "").trim() === shipmentId);
      const eta = shipment?.ETA ?? row["ETA"];
      if (isDateOnOrBeforeToday(eta)) {
        updates.Status = "Arrived at Port";
      }
    }

    if (status === "Assigned") {
      const assignDate = getPickupRequestDateForRow(row);
      if (isDateOnOrBeforeToday(assignDate) && !isTruthy(row["Flag"])) {
        updates.Flag = true;
      }
    }

    if (Object.keys(updates).length > 0) {
      batch.push({ poNumber, updates });
      Object.assign(row, updates);
    }
  });

  return batch;
}

async function applyAutomaticStatusUpdates(rows, shipments) {
  const batch = collectAutomaticStatusUpdates(rows, shipments);
  if (batch.length === 0) return;
  if (isDemoMode()) return;

  try {
    const json = await postAppsScript({ action: "batchUpdatePos", items: batch }, { silent: true });
    if (!json.success) console.warn("Auto status update failed:", json.error);
  } catch (err) {
    console.warn("Auto status update failed:", err.message);
  }
}
