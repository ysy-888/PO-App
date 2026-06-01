function initShipmentSelection() {
  const cb = document.getElementById("selectAllShipmentsCheckbox");
  cb?.addEventListener("click", e => {
    e.stopPropagation();
    setAllFilteredShipmentsSelected(cb.checked);
  });

  const chargebackCb = document.getElementById("selectAllChargebacksCheckbox");
  chargebackCb?.addEventListener("click", e => {
    e.stopPropagation();
    setAllFilteredChargebacksSelected(chargebackCb.checked);
  });

  document.getElementById("deleteShipmentBtn")?.addEventListener("click", deleteSelectedShipments);
  document.getElementById("deleteChargebackBtn")?.addEventListener("click", deleteSelectedChargebacks);
}

function initShipments() {
  document.getElementById("navTabPo")?.addEventListener("click", () => switchAppView("po"));
  document.getElementById("navTabRequests")?.addEventListener("click", () => switchAppView("requests"));
  document.getElementById("navTabShipments")?.addEventListener("click", () => switchAppView("shipments"));
  document.getElementById("navTabChargebacks")?.addEventListener("click", () => switchAppView("chargebacks"));
  document.getElementById("navTabPackingReviews")?.addEventListener("click", () => switchAppView("packingReviews"));
  document.getElementById("shipmentSearchInput")?.addEventListener("input", applyShipmentFilters);
  document.getElementById("chargebackSearchInput")?.addEventListener("input", applyChargebackFilters);

  // Unified requests search: routes to active type's filter
  document.getElementById("requestsSearchInput")?.addEventListener("input", e => {
    const q = e.target.value;
    // Mirror to the type-specific hidden input so individual filters pick it up
    const hiddenId = currentRequestType + "RequestSearchInput";
    const hiddenEl = document.getElementById(hiddenId);
    if (hiddenEl) hiddenEl.value = q;
    switchRequestType(currentRequestType);
  });

  // Request type filter buttons
  document.getElementById("requestTypeFilters")?.addEventListener("click", e => {
    const btn = e.target.closest("[data-request-type]");
    if (!btn) return;
    switchRequestType(btn.dataset.requestType);
  });
  document.getElementById("createShipmentBtn")?.addEventListener("click", openCreateShipmentFromSelection);
  document.getElementById("createShipmentSaveBtn")?.addEventListener("click", submitCreateShipment);
  document.getElementById("createShipmentCancelBtn")?.addEventListener("click", closeCreateShipmentModal);
  document.getElementById("createShipmentBody")?.addEventListener("input", () => {
    clearShipmentFooterMessage("createShipmentFooterMessage");
  });
  document.querySelector('[data-dismiss="create-shipment"]')?.addEventListener("click", closeCreateShipmentModal);
  document.getElementById("shipmentAddPosBtn")?.addEventListener("click", openShipmentAddPoPanel);
  document.getElementById("shipmentRemovePosBtn")?.addEventListener("click", removePosFromShipment);
  document.getElementById("shipmentModalSaveBtn")?.addEventListener("click", saveShipmentModal);
  document.getElementById("shipmentModalCloseBtn")?.addEventListener("click", closeShipmentModalForce);
  document.getElementById("shipmentModalBody")?.addEventListener("input", () => {
    clearShipmentFooterMessage("shipmentModalFooterMessage");
  });
  document.querySelector('[data-dismiss="shipment-modal"]')?.addEventListener("click", closeShipmentModalForce);
  document.getElementById("shipmentDetailAddPosBtn")?.addEventListener("click", openShipmentAddPoPanel);
  document.getElementById("shipmentDetailRemovePosBtn")?.addEventListener("click", removePosFromShipment);

  bindDirectBackdropDismiss(document.getElementById("shipmentModalOverlay"), closeShipmentModalForce);
  bindDirectBackdropDismiss(document.getElementById("createShipmentOverlay"), closeCreateShipmentModal);

  initShipmentSelection();
  switchAppView("po");
}

// Hook called from po-table.js after load
function onShipmentsDataLoaded(shipments) {
  allShipments = (shipments ?? []).map(normalizeShipment);
  resetLocalShipmentSelectedState(allShipments);
  refreshShipmentsView();
}

// Hook called from po-table.js after renderTable / selection changes
function onPoSelectionChanged() {
  updateToolbarRequestButtons();
}

initShipments();
if (window.__pendingShipments && typeof onShipmentsDataLoaded === "function") {
  onShipmentsDataLoaded(window.__pendingShipments);
  window.__pendingShipments = null;
}
