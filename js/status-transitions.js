/** Workflow status helpers — transitions, migration, and eligibility. */

const EXF_REQUESTED_FIELD = "EXF Requested";
const ASN_REQUEST_ID_FIELD = "ASN Request ID";
const DELIVERY_REQUEST_ID_FIELD = "Delivery Request ID";
const PICKUP_REQUEST_ID_FIELD = "Pickup Request ID";

const SHIPPED_GROUP_STATUSES = new Set([
  "OTW", "Scheduled",
]);

const DELIVERY_REQUEST_ELIGIBLE_STATUSES = new Set(["OTW"]);
const ASN_REQUEST_BUYERS = new Set(["LULU'S FASHION LOUNGE", "12TH TRIBE"]);

const SHIPMENT_REQUIRED_FIELDS = ["Ship Method", "Shipped", "ETD", "ETA", "IHD"];

const STATUS_MANUAL_TRANSITIONS = {
  Pending: ["Hold", "CXL", "WIP"],
  Hold: ["CXL", "WIP"],
  WIP: ["Hold", "CXL"],
  OTW: ["In Warehouse", "Hold", "CXL", "Closed"],
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

/** True when the PO workflow is Closed (explicit Status or inferred from N41). */
function isPoClosed(row) {
  if (!row) return false;
  if (typeof getRowWorkflowStatus === "function") {
    return getRowWorkflowStatus(row) === "Closed";
  }
  return getRowStatus(row) === "Closed";
}

function getN41Status(row) {
  return String(row["N41 Status"] ?? "").trim();
}

/** N41 shows Closed while PO workflow Status is still active — update N41 to match. */
function isN41ClosedStatusMismatch(row) {
  return getN41Status(row) === "Closed" && getRowStatus(row) !== "Closed";
}

/** Set PO Status to Closed when N41 is Closed and workflow Status is unset. */
function syncStatusClosedFromN41(row) {
  if (!row) return row;
  if (getN41Status(row) !== "Closed") return row;
  if (!getRowStatus(row)) row["Status"] = "Closed";
  return row;
}

function syncAllStatusClosedFromN41(rows) {
  rows.forEach(syncStatusClosedFromN41);
}

function migrateLegacyStatusValue(status, row) {
  const s = String(status ?? "").trim();
  if (s === "Received") return "In Warehouse";
  if (s === "Arrived at Port") return "OTW";
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
  if (!String(row["EXF Date"] ?? "").trim() && String(row["EXF Request Date"] ?? "").trim()) {
    row["EXF Date"] = row["EXF Request Date"];
  }
  return row;
}

function migrateAllRows(rows) {
  rows.forEach(migrateLegacyRow);
  syncAllStatusClosedFromN41(rows);
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
  return getRowStatus(row) === "WIP" &&
    !isExfRequested(row);
}

function isPoEligibleForShipment(row) {
  return isExfRequested(row) &&
    getRowStatus(row) === "Requested" &&
    !poHasShipment(row);
}

function poHasPackingList(row) {
  return typeof hasPackingList === "function" && hasPackingList(row?.["PO #"]);
}

function isFreesiaPo(row) {
  return String(row?.["Division"] ?? "").trim().toLowerCase() === "freesia";
}

function normalizeRequestRuleValue(value) {
  return String(value ?? "").trim().toUpperCase();
}

function poHasAsnRequest(row) {
  return !isEmptyValue(row?.[ASN_REQUEST_ID_FIELD]);
}

function poHasDeliveryOrPickupRequest(row) {
  return !isEmptyValue(row?.[DELIVERY_REQUEST_ID_FIELD]) ||
    !isEmptyValue(row?.[PICKUP_REQUEST_ID_FIELD]);
}

function isPoReadyForRequest(row) {
  return DELIVERY_REQUEST_ELIGIBLE_STATUSES.has(getRowStatus(row)) &&
    poHasPackingList(row);
}

function allRowsHaveSameEligibleAsnBuyer(rows) {
  if (rows.length === 0) return false;
  return [...ASN_REQUEST_BUYERS].some(buyer =>
    rows.every(row => normalizeRequestRuleValue(row?.["Buyer"]) === buyer)
  );
}

function allRowsAreElevatorDisco(rows) {
  return rows.length > 0 &&
    rows.every(row => normalizeRequestRuleValue(row?.["Division"]) === "ELEVATOR DISCO");
}

function selectedRowsAreReadyForRequests(rows) {
  return rows.length > 0 && rows.every(isPoReadyForRequest);
}

function areRowsEligibleForAsnRequest(rows) {
  return selectedRowsAreReadyForRequests(rows) &&
    allRowsHaveSameEligibleAsnBuyer(rows) &&
    rows.every(row =>
      isEmptyValue(row[ASN_REQUEST_ID_FIELD]) &&
      !poHasDeliveryOrPickupRequest(row)
    );
}

function areRowsEligibleForPickupRequest(rows) {
  return selectedRowsAreReadyForRequests(rows) &&
    allRowsHaveSameEligibleAsnBuyer(rows) &&
    rows.every(row =>
      poHasAsnRequest(row) &&
      isEmptyValue(row[PICKUP_REQUEST_ID_FIELD]) &&
      isEmptyValue(row[DELIVERY_REQUEST_ID_FIELD])
    );
}

function areRowsEligibleForDeliveryRequest(rows) {
  return selectedRowsAreReadyForRequests(rows) &&
    allRowsAreElevatorDisco(rows) &&
    rows.every(row =>
      isEmptyValue(row[DELIVERY_REQUEST_ID_FIELD]) &&
      isEmptyValue(row[PICKUP_REQUEST_ID_FIELD])
    );
}

function isPoEligibleForAsnRequest(row) {
  return isPoReadyForRequest(row) &&
    ASN_REQUEST_BUYERS.has(normalizeRequestRuleValue(row?.["Buyer"])) &&
    !poHasDeliveryOrPickupRequest(row) &&
    isEmptyValue(row[ASN_REQUEST_ID_FIELD]);
}

function isPoEligibleForDeliveryRequest(row) {
  return isPoReadyForRequest(row) &&
    normalizeRequestRuleValue(row?.["Division"]) === "ELEVATOR DISCO" &&
    isEmptyValue(row[DELIVERY_REQUEST_ID_FIELD]) &&
    isEmptyValue(row[PICKUP_REQUEST_ID_FIELD]);
}

function isPoEligibleForPickupRequest(row) {
  return isPoReadyForRequest(row) &&
    ASN_REQUEST_BUYERS.has(normalizeRequestRuleValue(row?.["Buyer"])) &&
    poHasAsnRequest(row) &&
    isEmptyValue(row[PICKUP_REQUEST_ID_FIELD]) &&
    isEmptyValue(row[DELIVERY_REQUEST_ID_FIELD]);
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

    if (status === "Assigned") {
      const assignDate = getPickupRequestDateForRow(row);
      if (isDateOnOrBeforeToday(assignDate) && !isTruthy(row["Flag"])) {
        updates.Flag = true;
      }
    }

    if (getN41Status(row) === "Closed" && !status) {
      updates.Status = "Closed";
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
    let json;
    if (typeof isApiMode === "function" && isApiMode()) {
      json = await postApi("/api/po/batch-update", { items: batch });
    } else {
      json = await postAppsScript({ action: "batchUpdatePos", items: batch }, { silent: true });
    }
    if (!json.success) console.warn("Auto status update failed:", json.error);
  } catch (err) {
    console.warn("Auto status update failed:", err.message);
  }
}
