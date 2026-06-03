const BATCH_EDIT_NO_CHANGE = "__NO_CHANGE__";

function getBatchEditSelectedRows() {
  if (typeof getCheckedFilteredPos === "function") return getCheckedFilteredPos();
  return filteredRows.filter(row => isTruthy(row["Selected"]));
}

function setBatchEditFooterMessage(message, type = "") {
  const el = document.getElementById("batchEditFooterMessage");
  if (!el) return;
  el.textContent = message;
  el.hidden = !message;
  el.classList.remove("success", "error");
  if (type) el.classList.add(type);
}

function clearBatchEditFooterMessage() {
  setBatchEditFooterMessage("");
}

function appendBatchEditOption(select, value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  select.appendChild(option);
}

function populateBatchEditSelects(rows) {
  const statusSelect = document.getElementById("batchEditStatusSelect");
  const shipMethodSelect = document.getElementById("batchEditShipMethodSelect");
  if (!statusSelect || !shipMethodSelect) return;

  statusSelect.innerHTML = "";
  appendBatchEditOption(statusSelect, BATCH_EDIT_NO_CHANGE, "No change");
  const statusOptions = new Set();
  rows.forEach(row => {
    if (!isPoFieldEditable("Status", row)) return;
    getAvailableStatusOptions(row).forEach(option => statusOptions.add(option.value));
  });
  STATUS_SORT_ORDER
    .filter(status => statusOptions.has(status))
    .forEach(status => appendBatchEditOption(statusSelect, status, status));
  if (statusOptions.size === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No eligible status changes";
    option.disabled = true;
    statusSelect.appendChild(option);
  }

  shipMethodSelect.innerHTML = "";
  appendBatchEditOption(shipMethodSelect, BATCH_EDIT_NO_CHANGE, "No change");
  appendBatchEditOption(shipMethodSelect, "", "Blank");
  SHIP_OPTIONS.forEach(method => appendBatchEditOption(shipMethodSelect, method, method));
}

function updateBatchEditButton() {
  const btn = document.getElementById("batchEditBtn");
  if (!btn) return;
  const inPoView = typeof currentAppView === "undefined" || currentAppView === "po";
  const selectedCount = inPoView ? getBatchEditSelectedRows().length : 0;
  btn.hidden = selectedCount < 2;
}

function openBatchEditModal() {
  const selectedRows = getBatchEditSelectedRows();
  if (selectedRows.length < 2) {
    showIndicator("Select at least 2 POs to batch edit", "error");
    updateBatchEditButton();
    return;
  }

  populateBatchEditSelects(selectedRows);
  clearBatchEditFooterMessage();

  const countEl = document.getElementById("batchEditPoCount");
  if (countEl) countEl.textContent = `${selectedRows.length} selected`;

  document.getElementById("batchEditOverlay")?.classList.add("open");
  requestAnimationFrame(() => document.getElementById("batchEditStatusSelect")?.focus());
}

function closeBatchEditModal() {
  document.getElementById("batchEditOverlay")?.classList.remove("open");
  clearBatchEditFooterMessage();
}

function isBatchStatusValueAllowed(row, value) {
  if (!isPoFieldEditable("Status", row)) return false;
  return getAvailableStatusOptions(row).some(option => option.value === value);
}

function getBatchEditRequestedValues() {
  return {
    status: document.getElementById("batchEditStatusSelect")?.value ?? BATCH_EDIT_NO_CHANGE,
    shipMethod: document.getElementById("batchEditShipMethodSelect")?.value ?? BATCH_EDIT_NO_CHANGE,
  };
}

function buildBatchEditItems(rows, requested) {
  const localUpdates = [];
  let skippedEdits = 0;

  rows.forEach(row => {
    const updates = {};
    const nextRow = { ...row };

    if (requested.status !== BATCH_EDIT_NO_CHANGE) {
      if (String(row["Status"] ?? "").trim() !== requested.status) {
        if (isBatchStatusValueAllowed(row, requested.status)) {
          updates["Status"] = requested.status;
          nextRow["Status"] = requested.status;
        } else {
          skippedEdits++;
        }
      }
    }

    if (requested.shipMethod !== BATCH_EDIT_NO_CHANGE) {
      if (String(row["Ship Method"] ?? "").trim() !== requested.shipMethod) {
        if (isPoFieldEditable("Ship Method", row)) {
          nextRow["Ship Method"] = requested.shipMethod;
          syncEstIhdForRow(nextRow);
          updates["Ship Method"] = requested.shipMethod;
          updates["EST IHD"] = nextRow["EST IHD"];
        } else {
          skippedEdits++;
        }
      }
    }

    const sheetUpdates = filterAppsScriptPoUpdates(updates);
    if (Object.keys(sheetUpdates).length > 0) {
      localUpdates.push({ row, updates: sheetUpdates });
    }
  });

  return {
    items: localUpdates.map(({ row, updates }) => ({
      poNumber: row["PO #"],
      updates,
    })),
    localUpdates,
    skippedEdits,
  };
}

function applyBatchEditUpdatesLocally(localUpdates) {
  localUpdates.forEach(({ row, updates }) => {
    Object.assign(row, updates);
  });
}

function getBatchEditSuccessMessage(updatedCount, skippedEdits) {
  const rowLabel = updatedCount === 1 ? "PO" : "POs";
  if (skippedEdits > 0) {
    return `Updated ${updatedCount} ${rowLabel}; skipped ${skippedEdits} ineligible field edit${skippedEdits === 1 ? "" : "s"}.`;
  }
  return `Updated ${updatedCount} ${rowLabel}.`;
}

async function submitBatchEdit() {
  if (isAppSaving()) return;

  const rows = getBatchEditSelectedRows();
  if (rows.length < 2) {
    setBatchEditFooterMessage("Select at least 2 POs.", "error");
    updateBatchEditButton();
    return;
  }

  const requested = getBatchEditRequestedValues();
  if (requested.status === BATCH_EDIT_NO_CHANGE && requested.shipMethod === BATCH_EDIT_NO_CHANGE) {
    setBatchEditFooterMessage("Choose a Status or Ship Method to apply.", "error");
    return;
  }

  const { items, localUpdates, skippedEdits } = buildBatchEditItems(rows, requested);
  if (items.length === 0) {
    const message = skippedEdits > 0
      ? "No eligible selected POs can receive those changes."
      : "Selected POs already have those values.";
    setBatchEditFooterMessage(message, "error");
    return;
  }

  try {
    setAppSaving(true, `Updating ${items.length} POs...`);
    if (!isDemoMode()) {
      const json = await postAppsScript({ action: "batchUpdatePos", items });
      if (!json.success) throw new Error(json.error || "Batch edit failed");
    }

    applyBatchEditUpdatesLocally(localUpdates);
    resetLocalSelectedState(allRows);
    clearMiniSelection();
    closeBatchEditModal();
    applyFilters();
    if (typeof updateToolbarRequestButtons === "function") updateToolbarRequestButtons();
    setAppSaving(false);
    const message = isDemoMode()
      ? "Demo mode - changes not saved to sheet."
      : getBatchEditSuccessMessage(items.length, skippedEdits);
    showIndicator(message, isDemoMode() ? "" : "success");
  } catch (err) {
    setBatchEditFooterMessage("Batch edit failed: " + err.message, "error");
  } finally {
    setAppSaving(false);
  }
}

function initBatchEdit() {
  document.getElementById("batchEditBtn")?.addEventListener("click", openBatchEditModal);
  document.getElementById("batchEditApplyBtn")?.addEventListener("click", submitBatchEdit);
  document.getElementById("batchEditCancelBtn")?.addEventListener("click", closeBatchEditModal);
  document.getElementById("batchEditCloseBtn")?.addEventListener("click", closeBatchEditModal);
  document.getElementById("batchEditBody")?.addEventListener("input", clearBatchEditFooterMessage);
  document.getElementById("batchEditOverlay")?.addEventListener("click", e => {
    if (e.target?.id === "batchEditOverlay") closeBatchEditModal();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && document.getElementById("batchEditOverlay")?.classList.contains("open")) {
      closeBatchEditModal();
    }
  });
  updateBatchEditButton();
}

initBatchEdit();
