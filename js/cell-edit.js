/** @type {{ anchor: HTMLElement, col: string, row: Record<string, unknown> } | null} */
let openCellSelect = null;

/** @type {{ anchor: HTMLElement, col: string, row: Record<string, unknown>, input: HTMLInputElement, originalVal: unknown, suspendCloseUntil: number } | null} */
let openCellDateEdit = null;

function positionCellDatePopover(anchorEl) {
  const pop = document.getElementById("cellDatePopover");
  if (!pop || !anchorEl) return;

  const rect = anchorEl.getBoundingClientRect();
  pop.style.top = `${rect.bottom + 2}px`;
  pop.style.left = `${rect.left}px`;
  pop.style.minWidth = "";

  const popRect = pop.getBoundingClientRect();
  const maxLeft = window.innerWidth - popRect.width - 8;
  pop.style.left = `${Math.min(Math.max(8, rect.left), maxLeft)}px`;
}

function refreshCellDateAnchorDisplay(anchor, col, row) {
  applyDateCellDisplay(anchor, col, row, { context: "table" });
  if (isPoFieldEditable(col, row) && !SELECT_EDIT_COLS.has(col)) {
    wrapEditablePreview(anchor);
  }
}

function closeCellDatePopover(shouldCommit = true) {
  if (!openCellDateEdit) return;

  const { anchor, col, row, input, originalVal } = openCellDateEdit;
  let didChange = false;

  if (shouldCommit && input && isCompactDateInputCommitReady(input)) {
    const newVal = readCompactDateInputValue(input);
    if (getEditorComparableValue(col, newVal) !== getEditorComparableValue(col, originalVal)) {
      row[col] = newVal;
      if (col === "Ship Method" || col === "EST EXF") {
        syncEstIhdForRow(row);
      }
      didChange = true;
      const updates = { [col]: newVal };
      if (col === "EST EXF") updates["EST IHD"] = row["EST IHD"];
      saveUpdate(row["PO #"], updates);
    }
  }

  const pop = document.getElementById("cellDatePopover");
  if (pop) {
    pop.hidden = true;
    pop.innerHTML = "";
  }

  delete anchor.dataset.editing;
  anchor.classList.remove("editing");
  openCellDateEdit = null;

  if (didChange) {
    renderTable();
    updateModalIfOpen();
  } else {
    refreshCellDateAnchorDisplay(anchor, col, row);
  }
}

function suspendCellDatePopoverClose(ms = 60000) {
  if (!openCellDateEdit) return;
  openCellDateEdit.suspendCloseUntil = Date.now() + ms;
}

function isCellDatePopoverCloseSuspended() {
  return Boolean(openCellDateEdit && Date.now() < openCellDateEdit.suspendCloseUntil);
}

function openCellDatePopover(anchorEl, col, row) {
  if (isAppSaving()) return;
  if (!isPoFieldEditable(col, row)) return;
  if (openCellDateEdit?.anchor === anchorEl) {
    closeCellDatePopover(true);
    return;
  }

  closeCellSelectDropdown(false);
  closeCellDatePopover(false);

  const originalVal = row[col] ?? "";
  const pop = document.getElementById("cellDatePopover");
  if (!pop) return;

  pop.innerHTML = "";
  const { wrap, input, btn, picker } = createCompactDateInput({
    initialYmd: originalVal,
    inputClassName: "cell-date-popover-input",
  });

  btn?.addEventListener("click", () => suspendCellDatePopoverClose());
  picker?.addEventListener("change", () => {
    if (openCellDateEdit) openCellDateEdit.suspendCloseUntil = 0;
  });
  picker?.addEventListener("blur", () => {
    if (openCellDateEdit) openCellDateEdit.suspendCloseUntil = 0;
  });

  input.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      closeCellDatePopover(true);
      return;
    }
  });

  pop.appendChild(wrap);
  pop.hidden = false;

  anchorEl.dataset.editing = "active";
  anchorEl.classList.add("editing");
  openCellDateEdit = {
    anchor: anchorEl,
    col,
    row,
    input,
    originalVal,
    suspendCloseUntil: 0,
  };

  requestAnimationFrame(() => {
    positionCellDatePopover(anchorEl);
    input.focus();
    if (input.value) input.select();
  });
}

function initCellDatePopover() {
  const pop = document.getElementById("cellDatePopover");
  if (!pop) return;

  pop.addEventListener("focusout", () => {
    if (!openCellDateEdit || pop.hidden) return;
    requestAnimationFrame(() => {
      if (!openCellDateEdit || pop.hidden || isCellDatePopoverCloseSuspended()) return;
      if (!pop.contains(document.activeElement)) {
        closeCellDatePopover(true);
      }
    });
  });

  document.addEventListener("mousedown", e => {
    if (!openCellDateEdit || pop.hidden) return;
    if (isCellDatePopoverCloseSuspended()) return;
    if (pop.contains(e.target) || openCellDateEdit.anchor.contains(e.target)) return;
    closeCellDatePopover(true);
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && openCellDateEdit) {
      closeCellDatePopover(false);
    }
  });

  window.addEventListener("resize", () => {
    if (openCellDateEdit) positionCellDatePopover(openCellDateEdit.anchor);
  });

  document.querySelector(".table-scroll-y")?.addEventListener("scroll", () => {
    if (openCellDateEdit) positionCellDatePopover(openCellDateEdit.anchor);
  }, { passive: true });
}

function getCellSelectOptions(col, row) {
  if (col === "Status") {
    return getAvailableStatusOptions(row ?? {});
  }
  if (col === "Ship Method") {
    return ["", ...SHIP_OPTIONS].map(value => ({
      value,
      label: value || EMPTY_DISPLAY,
    }));
  }
  return [];
}

function positionCellSelectDropdown(anchorEl) {
  const pop = document.getElementById("cellSelectDropdown");
  if (!pop || !anchorEl) return;

  const rect = anchorEl.getBoundingClientRect();
  pop.style.top = `${rect.bottom + 2}px`;
  pop.style.left = `${rect.left}px`;
  pop.style.width = `${rect.width}px`;
}

function renderCellSelectDropdown(col, row) {
  const pop = document.getElementById("cellSelectDropdown");
  if (!pop) return;

  const currentVal = row[col] ?? "";
  pop.dataset.col = col;
  pop.innerHTML = "";

  getCellSelectOptions(col, row).forEach(({ value, label }) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cell-select-option";
    if (value === currentVal) btn.classList.add("selected");

    if (col === "Status" && value) {
      btn.innerHTML = renderStatus(value);
    } else {
      btn.textContent = label;
    }

    btn.addEventListener("click", e => {
      e.stopPropagation();
      selectCellSelectOption(value);
    });

    pop.appendChild(btn);
  });
}

function closeCellSelectDropdown(clearAnchorState = true) {
  const pop = document.getElementById("cellSelectDropdown");
  if (pop) pop.hidden = true;

  if (clearAnchorState && openCellSelect?.anchor) {
    delete openCellSelect.anchor.dataset.editing;
    openCellSelect.anchor.classList.remove("select-cell-open", "select-cell-hover");
  }

  openCellSelect = null;
}

function selectCellSelectOption(value) {
  if (isAppSaving()) return;
  if (!openCellSelect) return;

  const { anchor, col, row } = openCellSelect;
  const currentVal = row[col] ?? "";
  const inModal = isModalFieldEl(anchor);

  if (value === currentVal) {
    closeCellSelectDropdown();
    return;
  }

  closeCellSelectDropdown(false);
  delete anchor.dataset.editing;
  anchor.classList.remove("select-cell-open", "select-cell-hover");

  row[col] = value;
  if (col === "Ship Method") {
    syncEstIhdForRow(row);
  }

  if (inModal) {
    if (col === "Ship Method") {
      updateModalIfOpen();
    } else {
      setFieldDisplayContent(anchor, col, row);
    }
    updateModalSaveState();
    return;
  }

  const updates = { [col]: value };
  if (col === "Ship Method") {
    updates["EST IHD"] = row["EST IHD"];
  }

  saveUpdate(row["PO #"], updates);
  renderTable();
  updateModalIfOpen();
}

function openCellSelectDropdown(anchorEl, col, row) {
  if (isAppSaving()) return;
  if (!isPoFieldEditable(col, row)) return;
  if (openCellSelect?.anchor === anchorEl) {
    closeCellSelectDropdown();
    return;
  }

  closeCellSelectDropdown(false);
  closeCellDatePopover(false);
  openCellSelect = { anchor: anchorEl, col, row };

  anchorEl.dataset.editing = "active";
  anchorEl.classList.add("select-cell-open");
  anchorEl.classList.remove("select-cell-hover");

  renderCellSelectDropdown(col, row);
  const pop = document.getElementById("cellSelectDropdown");
  if (!pop) return;

  pop.hidden = false;
  requestAnimationFrame(() => positionCellSelectDropdown(anchorEl));
}

function initCellSelectDropdown() {
  document.addEventListener("click", e => {
    const pop = document.getElementById("cellSelectDropdown");
    if (!pop || pop.hidden) return;
    if (pop.contains(e.target) || e.target.closest(".select-cell")) return;
    closeCellSelectDropdown();
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && openCellSelect) {
      closeCellSelectDropdown();
    }
  });

  window.addEventListener("resize", () => {
    if (openCellSelect) positionCellSelectDropdown(openCellSelect.anchor);
  });

  document.querySelector(".table-scroll-y")?.addEventListener("scroll", () => {
    if (openCellSelect) positionCellSelectDropdown(openCellSelect.anchor);
  }, { passive: true });

  document.getElementById("modalBody")?.addEventListener("scroll", () => {
    if (openCellSelect) positionCellSelectDropdown(openCellSelect.anchor);
  }, { passive: true });
}

function createCellInput(col, val) {
  if (col === "Notes") {
    const textarea = document.createElement("textarea");
    textarea.className = "cell-input cell-textarea";
    textarea.value = val;
    textarea.rows = 3;
    return textarea;
  }

  if (DATE_FIELDS.has(col)) {
    const { wrap } = createCompactDateInput({
      initialYmd: val,
      inputClassName: "cell-input cell-input--date",
    });
    return wrap;
  }

  const input = document.createElement("input");
  input.type = "text";
  input.className = "cell-input";
  input.value = val;
  return input;
}

function getCellEditorInput(editorEl) {
  if (editorEl instanceof HTMLInputElement || editorEl instanceof HTMLTextAreaElement) {
    return editorEl;
  }
  return editorEl.querySelector(".compact-date-input, .cell-input, .cell-textarea");
}

function readCellEditorValue(col, input) {
  if (DATE_FIELDS.has(col)) return readCompactDateInputValue(input);
  return input.value ?? "";
}

function getEditorComparableValue(col, val) {
  if (DATE_FIELDS.has(col)) {
    return normalizeToYmd(val) || normalizeCompactDateInputValue(val) || "";
  }
  return String(val ?? "").trim();
}

function isModalFieldEl(fieldEl) {
  return Boolean(fieldEl?.classList?.contains("modal-field-value"));
}

function isPoModalOpenForRow(row) {
  if (!modalRow || !row) return false;
  const overlay = document.getElementById("modalOverlay");
  if (!overlay?.classList.contains("open")) return false;
  return String(modalRow["PO #"]) === String(row["PO #"]);
}

function snapshotModalRow(row) {
  return { ...row };
}

function fieldValuesEqual(col, a, b) {
  if (col === "Flag") return isTruthy(a) === isTruthy(b);
  if (DATE_FIELDS.has(col)) {
    return getEditorComparableValue(col, a) === getEditorComparableValue(col, b);
  }
  return String(a ?? "").trim() === String(b ?? "").trim();
}

function getModalPendingUpdates() {
  if (!modalRow || !modalSnapshot) return {};
  const updates = {};
  const keys = new Set([...Object.keys(modalRow), ...Object.keys(modalSnapshot)]);
  keys.forEach(key => {
    if (LOCAL_ONLY_COLS.has(key)) return;
    if (fieldValuesEqual(key, modalRow[key], modalSnapshot[key])) return;
    updates[key] = modalRow[key];
  });
  return updates;
}

function hasModalPendingChanges() {
  return Object.keys(getModalPendingUpdates()).length > 0 || hasPackingListPendingChanges();
}

function updateModalSaveState() {
  const saveBtn = document.getElementById("modalSaveBtn");
  if (!saveBtn) return;
  saveBtn.disabled = !hasModalPendingChanges();
}

function refreshAfterModalFieldEdit(fieldEl, col, row) {
  delete fieldEl.dataset.editing;
  fieldEl.classList.remove("editing");
  setFieldDisplayContent(fieldEl, col, row);
  if (isPoFieldEditable(col, row) && !SELECT_EDIT_COLS.has(col)) {
    wrapEditablePreview(fieldEl);
  }
  if (col === "Ship Method" || col === "EST EXF") {
    updateModalIfOpen();
  }
  updateModalSaveState();
}

function commitActiveModalEditor() {
  const active = document.querySelector("#modalOverlay .modal-field-value[data-editing='active']");
  if (!active || !modalRow) return;
  const editorEl = active.querySelector(".compact-date-input-wrap, .cell-input, .cell-textarea");
  const input = editorEl ? getCellEditorInput(editorEl) : null;
  if (!input) return;
  const col = active.dataset.col;
  if (!col) return;

  if (DATE_FIELDS.has(col) && !isCompactDateInputCommitReady(input)) {
    active.onblur = null;
    input.onblur = null;
    refreshAfterModalFieldEdit(active, col, modalRow);
    return;
  }

  active.onblur = null;
  input.onblur = null;
  modalRow[col] = readCellEditorValue(col, input);
  if (col === "Ship Method" || col === "EST EXF") {
    syncEstIhdForRow(modalRow);
  }
  refreshAfterModalFieldEdit(active, col, modalRow);
}

function attachCellEditorHandlers(fieldEl, col, row, input, originalVal) {
  const originalComparable = getEditorComparableValue(col, originalVal);
  const inModal = isModalFieldEl(fieldEl);

  function commit() {
    if (DATE_FIELDS.has(col) && !isCompactDateInputCommitReady(input)) {
      cancelEdit();
      return;
    }

    const newVal = readCellEditorValue(col, input);
    if (getEditorComparableValue(col, newVal) === originalComparable) {
      if (inModal) {
        refreshAfterModalFieldEdit(fieldEl, col, row);
      } else {
        renderTable();
        updateModalIfOpen();
      }
      return;
    }

    row[col] = newVal;
    if (col === "Ship Method" || col === "EST EXF") {
      syncEstIhdForRow(row);
    }

    if (inModal) {
      refreshAfterModalFieldEdit(fieldEl, col, row);
      return;
    }

    const updates = { [col]: newVal };
    if (col === "Ship Method" || col === "EST EXF") {
      updates["EST IHD"] = row["EST IHD"];
    }

    saveUpdate(row["PO #"], updates);
    renderTable();
    updateModalIfOpen();
  }

  function cancelEdit() {
    if (inModal) {
      refreshAfterModalFieldEdit(fieldEl, col, row);
      return;
    }
    renderTable();
    updateModalIfOpen();
  }

  input.onblur = commit;
  input.onkeydown = e => {
    if (e.key === "Escape") cancelEdit();
    if (e.key === "Enter") {
      if (col === "Notes" && e.shiftKey) return;
      if (col === "Notes") e.preventDefault();
      input.blur();
    }
  };
}

function mountFieldEditor(fieldEl, col, row) {
  if (isAppSaving()) return;
  if (!isPoFieldEditable(col, row)) return;
  if (fieldEl.dataset.editing === "active") return;

  const val = row[col] ?? "";
  const editorEl = createCellInput(col, val);
  const input = getCellEditorInput(editorEl);

  fieldEl.innerHTML = "";
  fieldEl.appendChild(editorEl);
  fieldEl.classList.add("editing");
  fieldEl.dataset.editing = "active";
  attachCellEditorHandlers(fieldEl, col, row, input, val);
  input.focus();
  if (input instanceof HTMLInputElement && DATE_FIELDS.has(col)) {
    input.select();
  }
}

function mountCellEditor(td, col, row) {
  mountFieldEditor(td, col, row);
}

function bindSelectCellInteractions(anchorEl, col, row) {
  anchorEl.classList.add("select-cell");

  anchorEl.addEventListener("mouseenter", () => {
    if (anchorEl.dataset.editing) return;
    anchorEl.classList.add("select-cell-hover");
  });

  anchorEl.addEventListener("mouseleave", () => {
    if (anchorEl.dataset.editing === "active") return;
    anchorEl.classList.remove("select-cell-hover");
  });

  anchorEl.addEventListener("mousedown", e => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    openCellSelectDropdown(anchorEl, col, row);
  });
}

function bindEditableCell(td, col, row) {
  if (!isPoFieldEditable(col, row)) return;
  if (SELECT_EDIT_COLS.has(col)) {
    bindSelectCellInteractions(td, col, row);
    return;
  }

  td.onclick = () => startEdit(td, col, row);
}

function startEdit(td, col, row) {
  if (!isPoFieldEditable(col, row)) return;
  if (DATE_FIELDS.has(col) && !isModalFieldEl(td)) {
    openCellDatePopover(td, col, row);
    return;
  }
  if (td.dataset.editing === "active") return;
  mountFieldEditor(td, col, row);
}
