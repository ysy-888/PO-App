/** Pickup Request records and modals. */

const PICKUP_REQUEST_DATA_FIELDS = ["Request Date", "Location", "Notes"];

let allPickupRequests = [];
let pickupRequestPoNumbers = [];
let pickupRequestModalRow = null;

function normalizePickupRequest(row) {
  return { ...row };
}

function getPickupRequestById(id) {
  const key = String(id ?? "").trim();
  if (!key) return null;
  return allPickupRequests.find(r => String(r[PICKUP_REQUEST_ID_FIELD] ?? "").trim() === key) ?? null;
}

function onPickupRequestsDataLoaded(pickupRequests) {
  allPickupRequests = (pickupRequests ?? []).map(normalizePickupRequest);
}

function updatePickupRequestButton() {
  const btn = document.getElementById("pickupRequestBtn");
  if (!btn) return;
  const eligible = getCheckedFilteredPos().filter(isPoEligibleForPickupRequest);
  btn.hidden = currentAppView !== "po" || eligible.length === 0;
}

function openPickupRequestFromSelection() {
  if (isAppSaving()) return;
  const eligible = getCheckedFilteredPos().filter(isPoEligibleForPickupRequest);
  if (eligible.length === 0) {
    showIndicator("Select OTW or Arrived at Port POs first", "error");
    return;
  }
  pickupRequestPoNumbers = eligible.map(row => row["PO #"]);
  pickupRequestModalRow = null;
  renderPickupRequestModal(pickupRequestPoNumbers);
}

function openPickupRequestDetail(id) {
  const request = getPickupRequestById(id);
  if (!request) return;
  pickupRequestModalRow = request;
  pickupRequestPoNumbers = allRows
    .filter(row => String(row[PICKUP_REQUEST_ID_FIELD] ?? "").trim() === String(id).trim())
    .map(row => row["PO #"]);
  renderPickupRequestModal(pickupRequestPoNumbers, request);
}

function renderPickupRequestModal(poNumbers, request = {}) {
  const body = document.getElementById("pickupRequestBody");
  const titleEl = document.getElementById("pickupRequestModalTitle");
  if (!body) return;

  const pos = poNumbers
    .map(po => allRows.find(r => String(r["PO #"]) === String(po)))
    .filter(Boolean);

  const isEdit = Boolean(request[PICKUP_REQUEST_ID_FIELD]);
  if (titleEl) {
    titleEl.textContent = isEdit
      ? `Pickup Request ${request[PICKUP_REQUEST_ID_FIELD]}`
      : "Pickup Request";
  }

  body.innerHTML = "";
  body.appendChild(buildRequestModalLayout({
    formId: "pickupRequestForm",
    formFields: [
      createRequestFormField("Request Date", "Request Date", request["Request Date"] ?? "", { type: "date" }),
      createRequestFormField("Location", "Location", request["Location"] ?? ""),
      createRequestFormField("Notes", "Notes", request["Notes"] ?? "", { type: "textarea" }),
    ],
    linkedPos: pos,
  }));
  setRequestModalPoCount(document.getElementById("pickupRequestPoCount"), pos.length);
  bringModalToFront(document.getElementById("pickupRequestOverlay"));
}

function closePickupRequestModal() {
  pickupRequestPoNumbers = [];
  pickupRequestModalRow = null;
  document.getElementById("pickupRequestOverlay")?.classList.remove("open");
}

async function submitPickupRequest() {
  if (isAppSaving() || pickupRequestPoNumbers.length === 0) return;

  const form = document.getElementById("pickupRequestForm");
  const data = readRequestForm(form);
  if (isEmptyValue(data["Request Date"])) {
    showIndicator("Request Date is required", "error");
    return;
  }
  if (isEmptyValue(data["Location"])) {
    showIndicator("Location is required", "error");
    return;
  }

  const poNumbers = pickupRequestPoNumbers.slice();
  const savedRow = pickupRequestModalRow;
  closePickupRequestModal();
  setAppSaving(true, savedRow ? "Saving…" : "Creating pickup request…");
  showIndicator(`${savedRow ? "Saving" : "Creating"}${ELLIPSIS}`, "");

  try {
    if (isDemoMode()) {
      demoCreateOrUpdatePickupRequest(poNumbers, data, savedRow);
    } else {
      const json = await postAppsScript(
        savedRow
          ? {
              action: "updatePickupRequest",
              pickupRequestId: savedRow[PICKUP_REQUEST_ID_FIELD],
              request: data,
            }
          : {
              action: "createPickupRequest",
              poNumbers,
              request: data,
            }
      );
      if (!json.success) throw new Error(json.error);
      await loadData();
    }
    showIndicator(`Saved ${CHECK_MARK}`, "success");
  } catch (err) {
    showIndicator("Save failed: " + err.message, "error");
  } finally {
    setAppSaving(false);
  }
}

function demoCreateOrUpdatePickupRequest(poNumbers, data, existing) {
  let requestId = existing?.[PICKUP_REQUEST_ID_FIELD];
  if (!requestId) {
    let max = 0;
    allPickupRequests.forEach(r => {
      const m = /^PR-(\d+)$/.exec(String(r[PICKUP_REQUEST_ID_FIELD] ?? ""));
      if (m) max = Math.max(max, Number(m[1]));
    });
    requestId = `PR-${String(max + 1).padStart(4, "0")}`;
    allPickupRequests.push({ [PICKUP_REQUEST_ID_FIELD]: requestId, ...data });
  } else {
    Object.assign(existing, data);
  }

  poNumbers.forEach(poNumber => {
    const row = allRows.find(r => String(r["PO #"]) === String(poNumber));
    if (!row) return;
    row[PICKUP_REQUEST_ID_FIELD] = requestId;
    row["Assign Date"] = data["Request Date"];
    if (String(row["Division"] ?? "").trim() === "Freesia") {
      row["Status"] = "Assigned";
    }
  });
  resetLocalSelectedState(allRows);
  applyFilters();
  updatePickupRequestButton();
}

function initPickupRequests() {
  document.getElementById("pickupRequestBtn")?.addEventListener("click", openPickupRequestFromSelection);
  document.getElementById("pickupRequestSubmitBtn")?.addEventListener("click", submitPickupRequest);
  document.getElementById("pickupRequestCancelBtn")?.addEventListener("click", closePickupRequestModal);
  document.querySelector('[data-dismiss="pickup-request"]')?.addEventListener("click", closePickupRequestModal);
  document.getElementById("pickupRequestOverlay")?.addEventListener("click", e => {
    if (e.target.id === "pickupRequestOverlay") closePickupRequestModal();
  });
}

initPickupRequests();

function renderAssignDateCell(td, row, { interactionLocked = false } = {}) {
  const pickupId = String(row[PICKUP_REQUEST_ID_FIELD] ?? "").trim();
  const dateVal = getPickupRequestDateForRow(row);

  if (pickupId && !interactionLocked) {
    td.className = "readonly readonly-no-select";
    if (isEmptyValue(dateVal)) {
      setDisplayText(td, EMPTY_DISPLAY);
      return;
    }
    const link = document.createElement("button");
    link.type = "button";
    link.className = "shipment-id-link pickup-request-date-link";
    link.textContent = formatDateForDisplay(dateVal);
    link.title = "Open pickup request";
    link.addEventListener("click", e => {
      e.stopPropagation();
      openPickupRequestDetail(pickupId);
    });
    td.appendChild(link);
    return;
  }

  if (isPoFieldEditable("Assign Date", row) && !interactionLocked) {
    td.className = "editable";
    td.title = "Click to edit";
    bindEditableCell(td, "Assign Date", row);
    applyDateCellDisplay(td, "Assign Date", row, { context: "table" });
    wrapEditablePreview(td);
    return;
  }

  td.className = "readonly readonly-no-select";
  applyDateCellDisplay(td, "Assign Date", { ...row, "Assign Date": dateVal }, { context: "table" });
}
