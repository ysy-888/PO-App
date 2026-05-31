

function renderSelectedCell(td, row) {

  td.className = "td-select-cell readonly-no-select";

  const cb = document.createElement("input");

  cb.type = "checkbox";

  cb.className = "po-select-checkbox";

  cb.checked = isTruthy(row["Selected"]);

  cb.setAttribute("aria-label", `Select PO ${row["PO #"] ?? ""}`);

  cb.addEventListener("click", e => {

    e.stopPropagation();

    toggleRowSelected(row, cb.checked);

  });

  td.appendChild(cb);

}



function createPoFlagButton(row) {

  const flagged = isTruthy(row["Flag"]);

  const btn = document.createElement("button");

  btn.type = "button";

  btn.className = "po-flag-btn" + (flagged ? " is-flagged" : "");

  btn.setAttribute("aria-label", flagged ? "Unflag PO" : "Flag PO");

  btn.title = flagged ? "Unflag" : "Flag";

  btn.innerHTML = FLAG_ICON_SVG;

  btn.addEventListener("click", e => {

    e.stopPropagation();

    toggleRowFlag(row);

  });

  return btn;

}



function renderFlagCell(td, row) {

  td.className = "td-flag-cell readonly-no-select";

  td.replaceChildren();

  td.appendChild(createPoFlagButton(row));

}



function renderPackingListIndicatorCell(td, row) {

  td.className = "td-packing-list-cell readonly readonly-no-select";

  td.replaceChildren();

  if (!hasPackingList(row["PO #"])) return;

  const icon = document.createElement("span");

  icon.className = "po-packing-list-indicator";

  icon.title = "Packing list exists";

  icon.setAttribute("aria-label", "Packing list exists");

  icon.innerHTML = PACKING_LIST_ICON_SVG;

  td.appendChild(icon);

}



function renderTable() {

  closeCellSelectDropdown(false);

  const tbody = document.getElementById("tableBody");

  const rowsToRender = getPagedRows();

  updateRowCounter();

  updatePaginationUI();



  if (filteredRows.length === 0) {

    tbody.innerHTML = `<tr class="state-row"><td colspan="${visibleColumnCount()}">No POs match your filters.</td></tr>`;

    applyColumnVisibility();

    updateSelectAllHeader();

    return;

  }



  tbody.innerHTML = "";

  rowsToRender.forEach(row => {

    const tr = document.createElement("tr");

    tr.dataset.po = row["PO #"];



    tr.className = "clickable-row";

    if (isTruthy(row["Flag"])) tr.classList.add("row-flagged");

    COLUMNS.forEach(col => {

      const td = document.createElement("td");

      td.dataset.col = col;



      if (col === "Selected") {

        renderSelectedCell(td, row);

        tr.appendChild(td);

        return;

      }

      if (col === "Flag") {

        renderFlagCell(td, row);

        tr.appendChild(td);

        return;

      }

      if (col === "Packing List") {

        renderPackingListIndicatorCell(td, row);

        tr.appendChild(td);

        return;

      }

      if (col === "Shipment ID") {

        if (typeof renderShipmentIdCell === "function") renderShipmentIdCell(td, row);

        else {

          td.className = "readonly readonly-no-select";

          setDisplayText(td, isEmptyValue(row[col]) ? EMPTY_DISPLAY : row[col]);

        }

        tr.appendChild(td);

        return;

      }

      if (col === "Delivery Request ID" && typeof renderDeliveryRequestIdCell === "function") {

        renderDeliveryRequestIdCell(td, row);

        tr.appendChild(td);

        return;

      }

      if (col === "Pickup Request ID" && typeof renderPickupRequestIdCell === "function") {

        renderPickupRequestIdCell(td, row);

        tr.appendChild(td);

        return;

      }

      if (col === "EXF Requested") {

        td.className = "readonly readonly-no-select";

        setDisplayText(td, isTruthy(row[col]) ? "Yes" : EMPTY_DISPLAY);

        tr.appendChild(td);

        return;

      }

      if (col === "Assign Date" && typeof renderAssignDateCell === "function") {

        renderAssignDateCell(td, row);

        tr.appendChild(td);

        return;

      }



      const editable = col !== "N41 Status" && isPoFieldEditable(col, row);

      const val = getColumnFilterRawValue(col, row);



      if (editable) {

        td.className = "editable";

        td.title = SELECT_EDIT_COLS.has(col) ? "Click to choose" : "Click to edit";

        bindEditableCell(td, col, row);

      } else if (

        READONLY_NO_SELECT_COLS.has(col)

        || SHIPMENT_MANAGED_PO_FIELDS.has(col)

        || (col === "Ship Method" && typeof poHasShipment === "function" && poHasShipment(row))

      ) {

        td.className = "readonly readonly-no-select";

      } else if (COPY_ON_CLICK_COLS.has(col)) {

        td.className = "readonly";

      } else {

        td.className = "readonly";

      }



      if (col === "Status") {

        td.innerHTML = renderStatus(val);

      } else if (DATE_FIELDS.has(col)) {

        applyDateCellDisplay(td, col, row, { context: "table" });

      } else if (COPY_ON_CLICK_COLS.has(col)) {

        mountCopyableText(td, col, val);

      } else if ((col === "Actual Qty" || col === "Ctn Qty") && toQtyNumber(val) <= 0) {

        setDisplayText(td, EMPTY_DISPLAY);

      } else if (isEmptyValue(val)) {

        setDisplayText(td, EMPTY_DISPLAY);

      } else {

        td.textContent = val;

        td.classList.remove("empty-display");

      }



      if (editable && !SELECT_EDIT_COLS.has(col)) {

        wrapEditablePreview(td);

      }



      tr.appendChild(td);

    });



    tbody.appendChild(tr);

  });



  applyColumnVisibility();

  updateSelectAllHeader();

  applyMiniSelectionClasses();

}

let poTableRefreshQueued = false;

/** Defer full table rebuild so modal close / save overlay can paint first. */
function queuePoTableRefresh() {
  if (poTableRefreshQueued) return;
  poTableRefreshQueued = true;
  requestAnimationFrame(() => {
    poTableRefreshQueued = false;
    renderTable();
  });
}

function renderStatus(val) {

  if (isEmptyValue(val)) return `<span class="empty-display">${EMPTY_DISPLAY}</span>`;

  const cls = STATUS_BADGE[val] || "badge-cancelled";

  return `<span class="badge ${cls}">${escapeHtml(val)}</span>`;

}



function getCopyText(col, rawVal) {

  if (isEmptyValue(rawVal)) return "";

  if (DATE_FIELDS.has(col)) return formatDateForDisplay(rawVal);

  return String(rawVal).trim();

}



async function copyCellValue(col, rawVal) {

  const text = getCopyText(col, rawVal);

  if (!text || text === EMPTY_DISPLAY) {

    showIndicator("Nothing to copy", "error");

    return;

  }



  try {

    await navigator.clipboard.writeText(text);

    showIndicator(`Copied ${text}`, "success");

  } catch {

    showIndicator("Copy failed", "error");

  }

}



function mountCopyableText(container, col, rawVal) {

  container.innerHTML = "";

  const text = getCopyText(col, rawVal);

  if (!text || text === EMPTY_DISPLAY) {

    setDisplayText(container, EMPTY_DISPLAY);

    return;

  }



  container.classList.remove("empty-display");

  const span = document.createElement("span");

  span.className = "copyable-text";

  span.textContent = text;

  span.title = "Right-click to copy";

  span.addEventListener("contextmenu", e => {

    e.preventDefault();

    e.stopPropagation();

    copyCellValue(col, rawVal);

  });

  container.appendChild(span);

}

