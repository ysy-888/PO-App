/** Right-click context menu for table rows: Open, Select/Deselect, and PO add-to actions. */

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
  flipRowContextMenuSubmenus(left);
}

function flipRowContextMenuSubmenus(menuLeft) {
  if (!rowContextMenuEl) return;
  const openRight = menuLeft + 320 < window.innerWidth;
  rowContextMenuEl.querySelectorAll(".row-context-menu-submenu").forEach(sub => {
    sub.classList.toggle("opens-left", !openRight);
  });
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

function addRowContextMenuItem(label, onSelect, { disabled = false, separator = false } = {}) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "header-menu-item row-context-menu-item";
  if (separator) btn.classList.add("header-menu-item-separator");
  btn.textContent = label;
  btn.disabled = disabled;
  if (!disabled) {
    btn.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      hideRowContextMenu();
      onSelect();
    });
  }
  rowContextMenuEl.appendChild(btn);
}

function addRowContextMenuSubmenu(label, items, { emptyLabel = "None open", separator = false } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "row-context-menu-submenu-wrap";
  if (separator) wrap.classList.add("header-menu-item-separator");

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "header-menu-item row-context-menu-item row-context-menu-submenu-trigger";
  trigger.innerHTML =
    `<span>${label}</span><span class="header-menu-submenu-arrow" aria-hidden="true">›</span>`;
  trigger.addEventListener("click", e => {
    e.preventDefault();
    e.stopPropagation();
    const willOpen = !wrap.classList.contains("is-open");
    rowContextMenuEl.querySelectorAll(".row-context-menu-submenu-wrap.is-open").forEach(el => {
      if (el !== wrap) el.classList.remove("is-open");
    });
    wrap.classList.toggle("is-open", willOpen);
  });

  const sub = document.createElement("div");
  sub.className = "row-context-menu-submenu";

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "row-context-menu-empty";
    empty.textContent = emptyLabel;
    sub.appendChild(empty);
  } else {
    items.forEach(item => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "header-menu-item row-context-menu-item";
      btn.disabled = Boolean(item.disabled);
      if (item.sublabel) {
        btn.classList.add("row-context-menu-item-stacked");
        const title = document.createElement("span");
        title.className = "row-context-menu-item-title";
        title.textContent = item.label;
        const sublabel = document.createElement("span");
        sublabel.className = "row-context-menu-item-sub";
        sublabel.textContent = item.sublabel;
        btn.append(title, sublabel);
      } else {
        btn.textContent = item.label;
      }
      if (!item.disabled && typeof item.onSelect === "function") {
        btn.addEventListener("click", e => {
          e.preventDefault();
          e.stopPropagation();
          hideRowContextMenu();
          item.onSelect();
        });
      }
      sub.appendChild(btn);
    });
  }

  wrap.append(trigger, sub);
  rowContextMenuEl.appendChild(wrap);
}

function showRowContextMenu(clientX, clientY, {
  onOpen,
  canSelect = false,
  isSelected = false,
  onToggleSelect,
  extraItems = [],
  submenus = [],
} = {}) {
  if (typeof onOpen !== "function") return;

  ensureRowContextMenu();
  bindRowContextMenuDismiss();
  rowContextMenuEl.innerHTML = "";

  addRowContextMenuItem("Open", onOpen);

  if (canSelect && typeof onToggleSelect === "function") {
    addRowContextMenuItem(isSelected ? "Deselect" : "Select", onToggleSelect);
  }

  extraItems.forEach((item, index) => {
    addRowContextMenuItem(item.label, item.onSelect, {
      disabled: item.disabled,
      separator: index === 0 || item.separator,
    });
  });

  submenus.forEach((menu, index) => {
    addRowContextMenuSubmenu(menu.label, menu.items || [], {
      emptyLabel: menu.emptyLabel,
      separator: index === 0 && extraItems.length === 0,
    });
  });

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

function getContextMenuTargetPoRows(clickedRow) {
  const selected = typeof getCheckedFilteredPos === "function" ? getCheckedFilteredPos() : [];
  if (selected.length > 0) return selected;
  return clickedRow ? [clickedRow] : [];
}

function getContextMenuShipmentSubmenuItems(clickedRow) {
  if (typeof getOpenShipments !== "function" || typeof addPosToShipmentById !== "function") {
    return [];
  }

  return getOpenShipments()
    .slice()
    .sort((a, b) => String(a[SHIPMENT_ID_FIELD] ?? "").localeCompare(
      String(b[SHIPMENT_ID_FIELD] ?? ""),
      undefined,
      { numeric: true }
    ))
    .map(shipment => {
      const id = String(shipment[SHIPMENT_ID_FIELD] ?? "").trim();
      const method = String(shipment["Ship Method"] ?? "").trim();
      const poCount = typeof countPosForShipment === "function" ? countPosForShipment(id) : 0;
      const parts = [
        method,
        poCount > 0 ? `${poCount} PO${poCount === 1 ? "" : "s"}` : "",
      ].filter(Boolean);
      return {
        label: id || "Shipment",
        sublabel: parts.join(" · ") || "Open",
        onSelect() {
          addContextMenuPosToShipment(shipment, clickedRow);
        },
      };
    });
}

function getContextMenuAsnSubmenuItems(clickedRow) {
  if (typeof getOpenAsnRequests !== "function" || typeof addPosToAsnRequestById !== "function") {
    return [];
  }

  return getOpenAsnRequests()
    .slice()
    .sort((a, b) => getAsnRequestRecordId(b).localeCompare(getAsnRequestRecordId(a), undefined, { numeric: true }))
    .map(request => {
      const id = getAsnRequestRecordId(request);
      const buyer = String(request["Buyer"] ?? "").trim();
      const poCount = typeof getAsnRequestPoCount === "function" ? getAsnRequestPoCount(request) : 0;
      const parts = [
        buyer,
        poCount > 0 ? `${poCount} PO${poCount === 1 ? "" : "s"}` : "",
      ].filter(Boolean);
      return {
        label: id || "ASN Request",
        sublabel: parts.join(" · ") || "Open",
        onSelect() {
          addContextMenuPosToAsnRequest(request, clickedRow);
        },
      };
    });
}

function addContextMenuPosToShipment(shipment, clickedRow) {
  const rows = getContextMenuTargetPoRows(clickedRow);
  const eligible = typeof isPoEligibleForShipment === "function"
    ? rows.filter(isPoEligibleForShipment)
    : rows;
  if (eligible.length === 0) {
    showIndicator(
      rows.length > 1
        ? "Selected POs are not eligible for shipment"
        : "This PO is not eligible for shipment",
      "error"
    );
    return;
  }

  const skipped = rows.length - eligible.length;
  const poNumbers = eligible.map(row => String(row["PO #"] ?? "").trim()).filter(Boolean);
  const shipmentId = String(shipment?.[SHIPMENT_ID_FIELD] ?? "").trim();
  if (!shipmentId || poNumbers.length === 0) return;

  if (skipped > 0) {
    showIndicator(
      `Adding ${poNumbers.length} eligible PO${poNumbers.length === 1 ? "" : "s"} ` +
      `(${skipped} skipped)`,
      ""
    );
  }
  addPosToShipmentById(shipmentId, poNumbers);
}

function addContextMenuPosToAsnRequest(request, clickedRow) {
  const rows = getContextMenuTargetPoRows(clickedRow);
  if (rows.length === 0) {
    showIndicator("No POs to add", "error");
    return;
  }

  const requestId = typeof getAsnRequestRecordId === "function"
    ? getAsnRequestRecordId(request)
    : "";
  if (!requestId) return;

  const existing = new Set(
    typeof getRequestPoNumbers === "function"
      ? getRequestPoNumbers(request, ASN_REQUEST_ID_FIELD).map(String)
      : []
  );
  const poNumbers = rows
    .map(row => String(row["PO #"] ?? "").trim())
    .filter(po => po && !existing.has(po));

  if (poNumbers.length === 0) {
    showIndicator(
      rows.length === 1
        ? "This PO is already on that ASN request"
        : "Selected POs are already on that ASN request",
      "error"
    );
    return;
  }

  addPosToAsnRequestById(requestId, poNumbers);
}

function buildPoRowContextMenuExtras(row) {
  return {
    submenus: [
      {
        label: "Add to Shipment",
        emptyLabel: "No open shipments",
        items: getContextMenuShipmentSubmenuItems(row),
      },
      {
        label: "Add to ASN Request",
        emptyLabel: "No open ASN requests",
        items: getContextMenuAsnSubmenuItems(row),
      },
    ],
  };
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
      ...buildPoRowContextMenuExtras(row),
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
