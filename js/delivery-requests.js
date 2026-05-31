/** Delivery Request records and modals. */

const DELIVERY_REQUEST_DATA_FIELDS = ["Request Date", "Location", "Notes"];

let allDeliveryRequests = [];
let deliveryRequestPoNumbers = [];
let deliveryRequestModalRow = null;

function normalizeDeliveryRequest(row) {
  return { ...row };
}

function getDeliveryRequestById(id) {
  const key = String(id ?? "").trim();
  if (!key) return null;
  return allDeliveryRequests.find(r => String(r[DELIVERY_REQUEST_ID_FIELD] ?? "").trim() === key) ?? null;
}

function onDeliveryPickupDataLoaded(deliveryRequests, pickupRequests) {
  allDeliveryRequests = (deliveryRequests ?? []).map(normalizeDeliveryRequest);
  if (typeof onPickupRequestsDataLoaded === "function") {
    onPickupRequestsDataLoaded(pickupRequests);
  }
}

function updateDeliveryRequestButton() {
  const btn = document.getElementById("deliveryRequestBtn");
  if (!btn) return;
  const eligible = getCheckedFilteredPos().filter(isPoEligibleForDeliveryRequest);
  btn.hidden = currentAppView !== "po" || eligible.length === 0;
}

function openDeliveryRequestFromSelection() {
  if (isAppSaving()) return;
  const eligible = getCheckedFilteredPos().filter(isPoEligibleForDeliveryRequest);
  if (eligible.length === 0) {
    showIndicator("Select OTW or Arrived at Port POs first", "error");
    return;
  }
  deliveryRequestPoNumbers = eligible.map(row => row["PO #"]);
  deliveryRequestModalRow = null;
  renderDeliveryRequestModal(deliveryRequestPoNumbers);
}

function openDeliveryRequestDetail(id) {
  const request = getDeliveryRequestById(id);
  if (!request) return;
  deliveryRequestModalRow = request;
  deliveryRequestPoNumbers = allRows
    .filter(row => String(row[DELIVERY_REQUEST_ID_FIELD] ?? "").trim() === String(id).trim())
    .map(row => row["PO #"]);
  renderDeliveryRequestModal(deliveryRequestPoNumbers, request);
}

function renderDeliveryRequestIdCell(td, row) {
  td.className = "readonly readonly-no-select td-shipment-id-cell";
  const id = String(row[DELIVERY_REQUEST_ID_FIELD] ?? "").trim();
  if (!id) {
    setDisplayText(td, EMPTY_DISPLAY);
    return;
  }
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "shipment-id-link";
  btn.textContent = id;
  btn.title = "Open delivery request";
  btn.addEventListener("click", e => {
    e.stopPropagation();
    openDeliveryRequestDetail(id);
  });
  td.appendChild(btn);
}

function renderDeliveryRequestModal(poNumbers, request = {}) {
  const body = document.getElementById("deliveryRequestBody");
  const titleEl = document.getElementById("deliveryRequestModalTitle");
  if (!body) return;

  const pos = poNumbers
    .map(po => allRows.find(r => String(r["PO #"]) === String(po)))
    .filter(Boolean);

  const isEdit = Boolean(request[DELIVERY_REQUEST_ID_FIELD]);
  if (titleEl) {
    titleEl.textContent = isEdit
      ? `Delivery Request ${request[DELIVERY_REQUEST_ID_FIELD]}`
      : "Delivery Request";
  }

  body.innerHTML = "";
  body.appendChild(buildRequestModalLayout({
    formId: "deliveryRequestForm",
    formFields: [
      createRequestFormField("Request Date", "Request Date", request["Request Date"] ?? "", { type: "date" }),
      createRequestFormField("Location", "Location", request["Location"] ?? ""),
      createRequestFormField("Notes", "Notes", request["Notes"] ?? "", { type: "textarea" }),
    ],
    linkedPos: pos,
  }));
  setRequestModalPoCount(document.getElementById("deliveryRequestPoCount"), pos.length);
  bringModalToFront(document.getElementById("deliveryRequestOverlay"));
}

function closeDeliveryRequestModal() {
  deliveryRequestPoNumbers = [];
  deliveryRequestModalRow = null;
  document.getElementById("deliveryRequestOverlay")?.classList.remove("open");
}

async function submitDeliveryRequest() {
  if (isAppSaving() || deliveryRequestPoNumbers.length === 0) return;

  const form = document.getElementById("deliveryRequestForm");
  const data = readRequestForm(form);
  if (isEmptyValue(data["Request Date"])) {
    showIndicator("Request Date is required", "error");
    return;
  }
  if (isEmptyValue(data["Location"])) {
    showIndicator("Location is required", "error");
    return;
  }

  const poNumbers = deliveryRequestPoNumbers.slice();
  const savedRow = deliveryRequestModalRow;
  const isEdit = Boolean(savedRow?.[DELIVERY_REQUEST_ID_FIELD]);
  closeDeliveryRequestModal();
  setAppSaving(true, isEdit ? "Saving…" : "Creating delivery request…");
  showIndicator(`${isEdit ? "Saving" : "Creating"}${ELLIPSIS}`, "");

  try {
    if (isDemoMode()) {
      demoCreateOrUpdateDeliveryRequest(poNumbers, data, savedRow);
    } else {
      const json = await postAppsScript(
        isEdit
          ? {
              action: "updateDeliveryRequest",
              deliveryRequestId: savedRow[DELIVERY_REQUEST_ID_FIELD],
              request: data,
            }
          : {
              action: "createDeliveryRequest",
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

function demoCreateOrUpdateDeliveryRequest(poNumbers, data, existing) {
  let requestId = existing?.[DELIVERY_REQUEST_ID_FIELD];
  if (!requestId) {
    let max = 0;
    allDeliveryRequests.forEach(r => {
      const m = /^DR-(\d+)$/.exec(String(r[DELIVERY_REQUEST_ID_FIELD] ?? ""));
      if (m) max = Math.max(max, Number(m[1]));
    });
    requestId = `DR-${String(max + 1).padStart(4, "0")}`;
    allDeliveryRequests.push({ [DELIVERY_REQUEST_ID_FIELD]: requestId, ...data });
  } else {
    Object.assign(existing, data);
  }

  poNumbers.forEach(poNumber => {
    const row = allRows.find(r => String(r["PO #"]) === String(poNumber));
    if (!row) return;
    row[DELIVERY_REQUEST_ID_FIELD] = requestId;
    row["Status"] = "Scheduled";
  });
  resetLocalSelectedState(allRows);
  applyFilters();
  updateDeliveryRequestButton();
}

function initDeliveryRequests() {
  document.getElementById("deliveryRequestBtn")?.addEventListener("click", openDeliveryRequestFromSelection);
  document.getElementById("deliveryRequestSubmitBtn")?.addEventListener("click", submitDeliveryRequest);
  document.getElementById("deliveryRequestCancelBtn")?.addEventListener("click", closeDeliveryRequestModal);
  document.querySelector('[data-dismiss="delivery-request"]')?.addEventListener("click", closeDeliveryRequestModal);
  document.getElementById("deliveryRequestOverlay")?.addEventListener("click", e => {
    if (e.target.id === "deliveryRequestOverlay") closeDeliveryRequestModal();
  });
}

initDeliveryRequests();
