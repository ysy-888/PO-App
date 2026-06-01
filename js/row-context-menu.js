/** Right-click context menu for table rows: Open, and Select/Deselect when available. */

let rowContextMenuEl = null;
let rowContextMenuDismissBound = false;

function ensureRowContextMenu() {
  if (rowContextMenuEl) return rowContextMenuEl;

  rowContextMenuEl = document.createElement("div");
  rowContextMenuEl.id = "rowContextMenu";
  rowContextMenuEl.className = "row-context-menu";
  rowContextMenuEl.hidden = true;
  rowContextMenuEl.addEventListener("click", e => e.stopPropagation());
  document.body.appendChild(rowContextMenuEl);
  return rowContextMenuEl;
}

function hideRowContextMenu() {
  if (!rowContextMenuEl) return;
  rowContextMenuEl.hidden = true;
  rowContextMenuEl.innerHTML = "";
}

function positionRowContextMenu(clientX, clientY) {
  if (!rowContextMenuEl) return;
  rowContextMenuEl.hidden = false;
  const padding = 8;
  const rect = rowContextMenuEl.getBoundingClientRect();
  let left = clientX;
  let top = clientY;
  if (left + rect.width > window.innerWidth - padding) {
    left = Math.max(padding, window.innerWidth - rect.width - padding);
  }
  if (top + rect.height > window.innerHeight - padding) {
    top = Math.max(padding, window.innerHeight - rect.height - padding);
  }
  rowContextMenuEl.style.left = `${left}px`;
  rowContextMenuEl.style.top = `${top}px`;
}

function bindRowContextMenuDismiss() {
  if (rowContextMenuDismissBound) return;
  rowContextMenuDismissBound = true;

  document.addEventListener("click", hideRowContextMenu);
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") hideRowContextMenu();
  });
  window.addEventListener("scroll", hideRowContextMenu, true);
  window.addEventListener("resize", hideRowContextMenu);
}

function addRowContextMenuItem(label, onSelect) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "header-menu-item row-context-menu-item";
  btn.textContent = label;
  btn.addEventListener("click", e => {
    e.preventDefault();
    e.stopPropagation();
    hideRowContextMenu();
    onSelect();
  });
  rowContextMenuEl.appendChild(btn);
}

function showRowContextMenu(clientX, clientY, { onOpen, canSelect = false, isSelected = false, onToggleSelect } = {}) {
  if (typeof onOpen !== "function") return;

  ensureRowContextMenu();
  bindRowContextMenuDismiss();
  rowContextMenuEl.innerHTML = "";

  addRowContextMenuItem("Open", onOpen);

  if (canSelect && typeof onToggleSelect === "function") {
    addRowContextMenuItem(isSelected ? "Deselect" : "Select", onToggleSelect);
  }

  positionRowContextMenu(clientX, clientY);
}

function shouldSkipRowContextMenu(e, tr) {
  if (!(e.target instanceof Element)) return true;
  if (tr.classList.contains("state-row")) return true;
  if (e.target.closest(".copyable-text")) return true;
  if (e.target.closest("#rowContextMenu")) return true;
  return false;
}

function syncLinkedPoRowCheckbox(tr, selected) {
  const cb = tr.querySelector(".po-select-checkbox:not(:disabled)");
  if (!cb || cb.checked === selected) return;
  cb.click();
}

function resolveRowContextMenuAction(tr) {
  if (tr.closest("#tableBody") && tr.dataset.po) {
    const row = typeof findRowByPo === "function" ? findRowByPo(tr.dataset.po) : null;
    if (!row) return null;
    return {
      onOpen() {
        if (typeof closeCellSelectDropdown === "function") closeCellSelectDropdown(false);
        if (typeof openPODetail === "function") openPODetail(row);
      },
      canSelect: true,
      isSelected: isTruthy(row["Selected"]),
      onToggleSelect() {
        const next = !isTruthy(row["Selected"]);
        if (toggleRowSelected(row, next)) {
          syncLinkedPoRowCheckbox(tr, next);
        }
      },
    };
  }

  if (tr.closest("#shipmentTableBody") && tr.dataset.shipmentId) {
    const shipment = typeof getShipmentById === "function"
      ? getShipmentById(tr.dataset.shipmentId)
      : null;
    if (!shipment) return null;
    return {
      onOpen() {
        if (typeof openShipmentDetail === "function") openShipmentDetail(shipment);
      },
      canSelect: true,
      isSelected: isTruthy(shipment["Selected"]),
      onToggleSelect() {
        if (typeof toggleShipmentSelected === "function") {
          toggleShipmentSelected(shipment, !isTruthy(shipment["Selected"]));
        }
      },
    };
  }

  if (tr.closest("#chargebackTableBody") && tr.dataset.chargebackId) {
    const chargeback = (allChargebacks ?? []).find(item =>
      String(item?.["Chargeback ID"] ?? "").trim() === String(tr.dataset.chargebackId ?? "").trim()
    );
    if (!chargeback) return null;
    const poRow = typeof getChargebackPoRow === "function" ? getChargebackPoRow(chargeback) : null;
    return {
      onOpen() {
        if (poRow && typeof openPODetail === "function") openPODetail(poRow);
      },
      canSelect: true,
      isSelected: isTruthy(chargeback["Selected"]),
      onToggleSelect() {
        if (typeof toggleChargebackSelected === "function") {
          toggleChargebackSelected(chargeback, !isTruthy(chargeback["Selected"]));
        }
      },
    };
  }

  if (tr.closest("#exfRequestTableBody") && tr.dataset.exfRequestId) {
    const id = tr.dataset.exfRequestId;
    return {
      onOpen() {
        if (typeof openExfRequestDetail === "function") openExfRequestDetail(id);
      },
    };
  }

  if (tr.closest("#asnRequestTableBody") && tr.dataset.asnRequestId) {
    const id = tr.dataset.asnRequestId;
    return {
      onOpen() {
        if (typeof openAsnRequestDetail === "function") openAsnRequestDetail(id);
      },
    };
  }

  if (tr.closest("#deliveryRequestTableBody") && tr.dataset.deliveryRequestId) {
    const id = tr.dataset.deliveryRequestId;
    return {
      onOpen() {
        if (typeof openDeliveryRequestDetail === "function") openDeliveryRequestDetail(id);
      },
    };
  }

  if (tr.closest("#pickupRequestTableBody") && tr.dataset.pickupRequestId) {
    const id = tr.dataset.pickupRequestId;
    return {
      onOpen() {
        if (typeof openPickupRequestDetail === "function") openPickupRequestDetail(id);
      },
    };
  }

  if (tr.closest(".shipment-linked-po-table") && tr.dataset.po && !tr.closest("#tableBody")) {
    const po = tr.dataset.po;
    const cb = tr.querySelector(".po-select-checkbox:not(:disabled)");
    return {
      onOpen() {
        if (typeof openRequestLinkedPoDetail === "function") {
          openRequestLinkedPoDetail(po);
        }
      },
      canSelect: Boolean(cb),
      isSelected: Boolean(cb?.checked),
      onToggleSelect() {
        syncLinkedPoRowCheckbox(tr, !cb.checked);
      },
    };
  }

  return null;
}

function initRowContextMenu() {
  document.addEventListener("contextmenu", e => {
    const tr = e.target instanceof Element ? e.target.closest("tbody tr") : null;
    if (!tr || shouldSkipRowContextMenu(e, tr)) {
      hideRowContextMenu();
      return;
    }

    const action = resolveRowContextMenuAction(tr);
    if (!action) {
      hideRowContextMenu();
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    showRowContextMenu(e.clientX, e.clientY, action);
  }, true);
}

initRowContextMenu();
