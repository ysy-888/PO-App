/** ASN Request records and modal. */

const ASN_REQUEST_DATA_FIELDS = [
  "Request Date", "Notes",
];

let asnRequestPoNumbers = [];

function normalizeAsnRequest(row) {
  return { ...row };
}

function onAsnRequestsDataLoaded(asnRequests) {
  allAsnRequests = (asnRequests ?? []).map(normalizeAsnRequest);
}

function updateAsnRequestButton() {
  const btn = document.getElementById("asnRequestBtn");
  if (!btn) return;
  const selected = getCheckedFilteredPos();
  btn.hidden = currentAppView !== "po" ||
    !areRowsEligibleForAsnRequest(selected);
}

function openAsnRequestFromSelection() {
  if (isAppSaving()) return;
  const selected = getCheckedFilteredPos();
  if (!areRowsEligibleForAsnRequest(selected)) {
    showIndicator("Select OTW or Arrived at Port POs with packing lists, all LULU'S or all 12TH TRIBE, and no ASN request yet", "error");
    return;
  }
  asnRequestPoNumbers = selected.map(row => row["PO #"]);
  renderAsnRequestModal(asnRequestPoNumbers);
}

function renderAsnRequestModal(poNumbers) {
  const body = document.getElementById("asnRequestBody");
  if (!body) return;

  const pos = poNumbers
    .map(po => allRows.find(r => String(r["PO #"]) === String(po)))
    .filter(Boolean);

  body.innerHTML = "";
  body.appendChild(buildRequestModalLayout({
    formId: "asnRequestForm",
    formFields: [
      createRequestFormField("Request Date", "Request Date", formatDateToYmd(new Date()), { type: "date" }),
      createRequestFormField("Notes", "Notes", "", { type: "textarea" }),
    ],
    linkedPos: pos,
  }));
  setRequestModalPoCount(document.getElementById("asnRequestPoCount"), pos.length);
  bringModalToFront(document.getElementById("asnRequestOverlay"));
}

function closeAsnRequestModal() {
  asnRequestPoNumbers = [];
  clearModalFooterMessageForOverlay("asnRequestOverlay");
  document.getElementById("asnRequestOverlay")?.classList.remove("open");
}

async function submitAsnRequest() {
  if (isAppSaving() || asnRequestPoNumbers.length === 0) return;

  const form = document.getElementById("asnRequestForm");
  const data = readRequestForm(form);
  if (isEmptyValue(data["Request Date"])) {
    showIndicator("Request Date is required", "error");
    return;
  }

  const poNumbers = asnRequestPoNumbers.slice();
  closeAsnRequestModal();
  setAppSaving(true, "Creating ASN request...");
  showIndicator(`Creating ASN request${ELLIPSIS}`, "");

  try {
    if (isDemoMode()) {
      demoCreateAsnRequest(poNumbers, data);
    } else {
      const json = await postAppsScript({
        action: "createAsnRequest",
        poNumbers,
        request: data,
      });
      if (!json.success) throw new Error(json.error);
      await loadData();
    }
    showIndicator(`ASN request saved ${CHECK_MARK}`, "success");
  } catch (err) {
    showIndicator("ASN request failed: " + err.message, "error");
  } finally {
    setAppSaving(false);
  }
}

function demoCreateAsnRequest(poNumbers, data) {
  let max = 0;
  allAsnRequests.forEach(r => {
    const m = /^ASN-(\d+)$/.exec(String(r[ASN_REQUEST_ID_FIELD] ?? ""));
    if (m) max = Math.max(max, Number(m[1]));
  });
  const requestId = `ASN-${String(max + 1).padStart(4, "0")}`;
  allAsnRequests.push({
    [ASN_REQUEST_ID_FIELD]: requestId,
    ...data,
  });

  poNumbers.forEach(poNumber => {
    const row = allRows.find(r => String(r["PO #"]) === String(poNumber));
    if (!row) return;
    row[ASN_REQUEST_ID_FIELD] = requestId;
  });
  resetLocalSelectedState(allRows);
  applyFilters();
  if (typeof updateToolbarRequestButtons === "function") updateToolbarRequestButtons();
}

function initAsnRequests() {
  document.getElementById("asnRequestBtn")?.addEventListener("click", openAsnRequestFromSelection);
  document.getElementById("asnRequestSubmitBtn")?.addEventListener("click", submitAsnRequest);
  document.getElementById("asnRequestCancelBtn")?.addEventListener("click", closeAsnRequestModal);
  document.querySelector('[data-dismiss="asn-request"]')?.addEventListener("click", closeAsnRequestModal);
  bindDirectBackdropDismiss(document.getElementById("asnRequestOverlay"), closeAsnRequestModal);
}

initAsnRequests();
if (window.__pendingAsnRequests && typeof onAsnRequestsDataLoaded === "function") {
  onAsnRequestsDataLoaded(window.__pendingAsnRequests);
  window.__pendingAsnRequests = null;
}
