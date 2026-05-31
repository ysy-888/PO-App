/** EXF Request — batch WIP POs into the EXF Requested queue. */

let exfRequestPoNumbers = [];

function updateExfRequestButton() {
  const btn = document.getElementById("exfRequestBtn");
  if (!btn) return;
  const eligible = getCheckedFilteredPos().filter(isPoEligibleForExfRequest);
  btn.hidden = currentAppView !== "po" || eligible.length === 0;
}

function openExfRequestFromSelection() {
  if (isAppSaving()) return;
  const eligible = getCheckedFilteredPos().filter(isPoEligibleForExfRequest);
  if (eligible.length === 0) {
    showIndicator("Select WIP POs first", "error");
    return;
  }
  exfRequestPoNumbers = eligible.map(row => row["PO #"]);
  renderExfRequestModal(exfRequestPoNumbers);
}

function renderExfRequestModal(poNumbers) {
  const body = document.getElementById("exfRequestBody");
  if (!body) return;

  const pos = poNumbers
    .map(po => allRows.find(r => String(r["PO #"]) === String(po)))
    .filter(Boolean);

  body.innerHTML = "";
  body.appendChild(buildRequestModalLayout({
    formId: "exfRequestForm",
    formFields: [
      createRequestFormField("Notes", "Notes", "", { type: "textarea" }),
    ],
    linkedPos: pos,
  }));
  setRequestModalPoCount(document.getElementById("exfRequestPoCount"), pos.length);
  bringModalToFront(document.getElementById("exfRequestOverlay"));
}

function closeExfRequestModal() {
  exfRequestPoNumbers = [];
  document.getElementById("exfRequestOverlay")?.classList.remove("open");
}

async function submitExfRequest() {
  if (isAppSaving() || exfRequestPoNumbers.length === 0) return;

  const poNumbers = exfRequestPoNumbers.slice();
  const notes = readRequestForm(document.getElementById("exfRequestForm"))["Notes"] ?? "";
  closeExfRequestModal();
  setAppSaving(true, "Submitting EXF request…");
  showIndicator(`Submitting EXF request${ELLIPSIS}`, "");

  try {
    if (isDemoMode()) {
      demoExfRequest(poNumbers, notes);
    } else {
      const json = await postAppsScript({
        action: "exfRequest",
        poNumbers,
        notes,
      });
      if (!json.success) throw new Error(json.error);
      await loadData();
    }
    showIndicator(`EXF requested ${CHECK_MARK}`, "success");
  } catch (err) {
    showIndicator("EXF request failed: " + err.message, "error");
  } finally {
    setAppSaving(false);
  }
}

function demoExfRequest(poNumbers, notes) {
  poNumbers.forEach(poNumber => {
    const row = allRows.find(r => String(r["PO #"]) === String(poNumber));
    if (!row) return;
    row[EXF_REQUESTED_FIELD] = true;
    row["Status"] = "Requested";
    if (notes) row["Notes"] = notes;
  });
  resetLocalSelectedState(allRows);
  applyFilters();
  updateExfRequestButton();
}

function initExfRequest() {
  document.getElementById("exfRequestBtn")?.addEventListener("click", openExfRequestFromSelection);
  document.getElementById("exfRequestSubmitBtn")?.addEventListener("click", submitExfRequest);
  document.getElementById("exfRequestCancelBtn")?.addEventListener("click", closeExfRequestModal);
  document.querySelector('[data-dismiss="exf-request"]')?.addEventListener("click", closeExfRequestModal);
  document.getElementById("exfRequestOverlay")?.addEventListener("click", e => {
    if (e.target.id === "exfRequestOverlay") closeExfRequestModal();
  });
}

initExfRequest();
