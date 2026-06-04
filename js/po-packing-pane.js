/**
 * Main PO table — vendor-portal-style packing list side panel (single mini-select).
 */
let poPackingPaneRow = null;
let poPackingPaneCartons = [];
let poPackingPaneSizeLabels = [];
let poPackingPaneSnapshot = null;
let poPackingPaneSaveInProgress = false;

const PO_PACKING_PANE = {
  pane: "poPackingPane",
  summary: "poPackingSummaryCard",
  status: "poPackingStatusMsg",
  notes: "poPackingNotes",
  countInput: "poCartonCountInput",
  decr: "poCartonDecrBtn",
  incr: "poCartonIncrBtn",
  gridHead: "poCartonGridHead",
  gridBody: "poCartonGridBody",
  gridWrap: "poCartonGridWrap",
  gridScroll: "poCartonGridScroll",
  gridHeadWrap: "poCartonGridHeadWrap",
  menuBtn: "poPackingMenuBtn",
  menuDropdown: "poPackingMenuDropdown",
  deleteMenu: "poMenuDeletePacking",
};

const PO_CARTON_COL = {
  num: 28,
  gap: 10,
  total: 42,
  weight: 72,
  panePad: 34,
  paneMax: 560,
  paneMin: 420,
  sizeMin: 40,
  sizeDefault: 46,
};

function poPaneQty(val) {
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function poPaneCartonTotal(carton) {
  return poPackingPaneSizeLabels.reduce((sum, _, i) => sum + poPaneQty(carton["u" + i]), 0);
}

function poPaneFmtWeightKg(val) {
  const n = poPaneQty(val);
  return n > 0 ? n.toFixed(2) : "0";
}

function poPaneMakeEmptyCarton() {
  const c = {};
  poPackingPaneSizeLabels.forEach((_, i) => { c["u" + i] = 0; });
  c.weight = 0;
  return c;
}

function poPaneGetSizeLabelsFromRow(row) {
  if (typeof getSizeLabelsFromRow === "function") return getSizeLabelsFromRow(row);
  const labels = [];
  for (let i = 1; i <= 15; i++) {
    const label = String(row["Size " + i] ?? "").trim();
    if (label) labels.push(label);
  }
  return labels.length ? labels : ["Units"];
}

function poPaneSheetCartonsToPane(cartons) {
  return cartons.map(carton => {
    const out = {};
    poPackingPaneSizeLabels.forEach((_, i) => {
      out["u" + i] = poPaneQty(carton["Unit " + (i + 1)]);
    });
    out.weight = poPaneQty(carton[CARTON_WEIGHT_FIELD]);
    return out;
  });
}

function poPaneCartonsToSheet(cartons) {
  return cartons.map((carton, index) => {
    const out = { "Carton #": index + 1 };
    poPackingPaneSizeLabels.forEach((_, i) => {
      const qty = poPaneQty(carton["u" + i]);
      out["Unit " + (i + 1)] = qty ? String(qty) : "";
    });
    out["Total Units"] = poPaneCartonTotal(carton);
    const weight = poPaneQty(carton.weight);
    out[CARTON_WEIGHT_FIELD] = weight ? String(weight) : "";
    return out;
  });
}

function poPaneSerializeState() {
  const notes = String(document.getElementById(PO_PACKING_PANE.notes)?.value ?? "").trim();
  return JSON.stringify({
    notes,
    cartons: poPaneCartonsToSheet(poPackingPaneCartons),
  });
}

function poPaneCaptureSnapshot() {
  poPackingPaneSnapshot = poPaneSerializeState();
}

function poPaneHasPendingChanges() {
  if (!poPackingPaneSnapshot) return false;
  return poPaneSerializeState() !== poPackingPaneSnapshot;
}

function poPaneShowStatus(text, type) {
  const el = document.getElementById(PO_PACKING_PANE.status);
  if (!el) return;
  el.textContent = text;
  el.className = "status-msg show " + (type || "info");
}

function poPaneHideStatus() {
  const el = document.getElementById(PO_PACKING_PANE.status);
  if (!el) return;
  el.className = "status-msg";
}

function closePoPackingPane({ clearSelection = true } = {}) {
  const pane = document.getElementById(PO_PACKING_PANE.pane);
  if (pane) pane.hidden = true;
  poPackingPaneRow = null;
  poPackingPaneCartons = [];
  poPackingPaneSizeLabels = [];
  poPackingPaneSnapshot = null;
  document.getElementById(PO_PACKING_PANE.menuDropdown)?.setAttribute("hidden", "");
  if (clearSelection && typeof clearMiniSelection === "function") clearMiniSelection();
}

function syncPoPackingPaneFromMiniSelection() {
  if (typeof isPoTableViewActive === "function" && !isPoTableViewActive()) {
    closePoPackingPane({ clearSelection: false });
    return;
  }
  const miniRow = typeof getSingleMiniSelectedRow === "function" ? getSingleMiniSelectedRow() : null;
  if (!miniRow) {
    closePoPackingPane({ clearSelection: false });
    return;
  }
  const fullRow = typeof findRowByPo === "function" ? findRowByPo(miniRow["PO #"]) : miniRow;
  if (fullRow) openPoPackingPane(fullRow);
}

function openPoPackingPane(row) {
  if (!row) return;
  const poKey = String(row["PO #"] ?? "").trim();
  if (poPackingPaneRow && String(poPackingPaneRow["PO #"] ?? "").trim() === poKey && !document.getElementById(PO_PACKING_PANE.pane)?.hidden) {
    return;
  }

  poPackingPaneRow = row;
  poPackingPaneSizeLabels = poPaneGetSizeLabelsFromRow(row);
  const packingList = typeof getPackingListForPo === "function" ? getPackingListForPo(poKey) : null;
  const sheetCartons = packingList && typeof getPackingCartonsForList === "function"
    ? getPackingCartonsForList(getPackingListId(packingList))
    : [];

  if (sheetCartons.length > 0) {
    poPackingPaneCartons = poPaneSheetCartonsToPane(sheetCartons);
    const initialCount = Math.max(
      poPackingPaneCartons.length,
      Number(packingList?.["Carton Count"]) || 1
    );
    while (poPackingPaneCartons.length < initialCount) poPackingPaneCartons.push(poPaneMakeEmptyCarton());
  } else {
    poPackingPaneCartons = [poPaneMakeEmptyCarton()];
  }

  const pane = document.getElementById(PO_PACKING_PANE.pane);
  const countInput = document.getElementById(PO_PACKING_PANE.countInput);
  const notesInput = document.getElementById(PO_PACKING_PANE.notes);
  const deleteBtn = document.getElementById(PO_PACKING_PANE.deleteMenu);
  const readOnly = typeof isPoClosed === "function" && isPoClosed(row);

  if (countInput) countInput.value = String(poPackingPaneCartons.length);
  if (notesInput) notesInput.value = String(packingList?.["Notes"] ?? "").trim();
  if (deleteBtn) deleteBtn.hidden = !packingList;
  if (pane) pane.hidden = false;

  poPaneSetReadOnly(readOnly);
  poPaneBuildSummaryCard(row);
  poPaneBuildCartonGrid();
  poPaneCaptureSnapshot();
  poPaneHideStatus();
}

function poPaneSetReadOnly(readOnly) {
  const ids = [
    PO_PACKING_PANE.countInput,
    PO_PACKING_PANE.decr,
    PO_PACKING_PANE.incr,
    PO_PACKING_PANE.notes,
    "poPackingSaveBtn",
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === "BUTTON") el.disabled = readOnly;
    else el.readOnly = readOnly;
  });
  document.querySelectorAll("#poCartonGridBody input").forEach(inp => {
    inp.readOnly = readOnly;
  });
}

function poPaneBuildSummaryCard(row) {
  const card = document.getElementById(PO_PACKING_PANE.summary);
  if (!card) return;
  card.innerHTML = "";

  function addRow(label, value) {
    if (!value) return;
    const rowEl = document.createElement("div");
    rowEl.className = "po-summary-row";
    const lbl = document.createElement("span");
    lbl.className = "po-summary-label";
    lbl.textContent = label;
    const val = document.createElement("span");
    val.className = "po-summary-value";
    val.textContent = value;
    rowEl.appendChild(lbl);
    rowEl.appendChild(val);
    card.appendChild(rowEl);
  }

  addRow("PO #", row["PO #"]);
  addRow("Buyer PO #", row["Buyer PO #"]);
  addRow("Buyer", row["Buyer"]);
  addRow("Style #", row["Style #"]);
  addRow("Color", row["Color"]);
  if (row["EXF Request ID"]) addRow("EXF Req ID", row["EXF Request ID"]);
  if (row["EXF Date"]) addRow("EXF Date", row["EXF Date"]);
  if (row["EXF Memo"]) addRow("EXF Memo", row["EXF Memo"]);

  const totalsRow = document.createElement("div");
  totalsRow.className = "po-summary-totals";

  function addTotal(num, label, idSuffix) {
    const item = document.createElement("div");
    item.className = "po-summary-total-item";
    const n = document.createElement("div");
    n.className = "po-summary-total-item__num";
    n.id = "poSummaryTotal_" + idSuffix;
    n.textContent = String(num);
    const l = document.createElement("div");
    l.className = "po-summary-total-item__label";
    l.textContent = label;
    item.appendChild(n);
    item.appendChild(l);
    totalsRow.appendChild(item);
  }

  addTotal(poPackingPaneCartons.length || row["Ctn Qty"] || 0, "Cartons", "Cartons");
  const units = poPackingPaneCartons.reduce((sum, c) => sum + poPaneCartonTotal(c), 0);
  addTotal(units || row["Actual Qty"] || 0, "Total Units", "TotalUnits");
  const weight = poPackingPaneCartons.reduce((sum, c) => sum + poPaneQty(c.weight), 0);
  addTotal(poPaneFmtWeightKg(weight), "Total Weight", "TotalWeight");
  card.appendChild(totalsRow);

  const sizeTotalsRow = document.createElement("div");
  sizeTotalsRow.className = "po-summary-size-totals";
  poPackingPaneSizeLabels.forEach((label, i) => {
    const item = document.createElement("div");
    item.className = "po-summary-size-total-item";
    const lbl = document.createElement("div");
    lbl.className = "po-summary-size-total-item__label";
    lbl.textContent = label;
    const num = document.createElement("div");
    num.className = "po-summary-size-total-item__num";
    num.id = "poSummarySizeTotal_" + i;
    num.textContent = String(poPackingPaneCartons.reduce((sum, c) => sum + poPaneQty(c["u" + i]), 0));
    item.appendChild(lbl);
    item.appendChild(num);
    sizeTotalsRow.appendChild(item);
  });
  card.appendChild(sizeTotalsRow);
}

function poPaneRefreshSummaryTotals() {
  const ctnEl = document.getElementById("poSummaryTotal_Cartons");
  const unitEl = document.getElementById("poSummaryTotal_TotalUnits");
  const weightEl = document.getElementById("poSummaryTotal_TotalWeight");
  if (ctnEl) ctnEl.textContent = String(poPackingPaneCartons.length);
  const totalUnits = poPackingPaneCartons.reduce((sum, c) => sum + poPaneCartonTotal(c), 0);
  if (unitEl) unitEl.textContent = String(totalUnits);
  const totalWeight = poPackingPaneCartons.reduce((sum, c) => sum + poPaneQty(c.weight), 0);
  if (weightEl) weightEl.textContent = poPaneFmtWeightKg(totalWeight);
  poPackingPaneSizeLabels.forEach((_, i) => {
    const el = document.getElementById("poSummarySizeTotal_" + i);
    if (el) {
      el.textContent = String(poPackingPaneCartons.reduce((sum, c) => sum + poPaneQty(c["u" + i]), 0));
    }
  });
}

function poPaneGetCartonGridLayout() {
  const count = Math.max(1, poPackingPaneSizeLabels.length);
  const fixed = PO_CARTON_COL.num + PO_CARTON_COL.gap * 2 + PO_CARTON_COL.total + PO_CARTON_COL.weight;
  const sizeW = Math.max(
    PO_CARTON_COL.sizeMin,
    Math.min(
      PO_CARTON_COL.sizeDefault,
      Math.floor((PO_CARTON_COL.paneMax - PO_CARTON_COL.panePad - fixed) / count)
    )
  );
  const colWidths = [
    PO_CARTON_COL.num,
    PO_CARTON_COL.gap,
    ...Array(count).fill(sizeW),
    PO_CARTON_COL.gap,
    PO_CARTON_COL.total,
    PO_CARTON_COL.weight,
  ];
  const tableW = colWidths.reduce((sum, w) => sum + w, 0);
  const paneW = Math.min(PO_CARTON_COL.paneMax, Math.max(PO_CARTON_COL.paneMin, tableW + PO_CARTON_COL.panePad));
  return { sizeW, tableW, paneW, colWidths };
}

function poPaneSyncCartonGridLayout() {
  const { sizeW, tableW, paneW } = poPaneGetCartonGridLayout();
  const count = Math.max(1, poPackingPaneSizeLabels.length);
  const cols = [
    PO_CARTON_COL.num + "px",
    PO_CARTON_COL.gap + "px",
    ...Array(count).fill(sizeW + "px"),
    PO_CARTON_COL.gap + "px",
    PO_CARTON_COL.total + "px",
    PO_CARTON_COL.weight + "px",
  ].join(" ");
  const pane = document.getElementById(PO_PACKING_PANE.pane);
  const gridWrap = document.getElementById(PO_PACKING_PANE.gridWrap);
  if (pane) pane.style.setProperty("--packing-pane-width", paneW + "px");
  if (gridWrap) {
    gridWrap.style.setProperty("--carton-grid-width", tableW + "px");
    gridWrap.style.setProperty("--carton-grid-cols", cols);
  }
}

function poPaneSyncCartonGridScrollbarPad() {
  const scroll = document.getElementById(PO_PACKING_PANE.gridScroll);
  const headWrap = document.getElementById(PO_PACKING_PANE.gridHeadWrap);
  if (!scroll || !headWrap) return;
  const sb = scroll.offsetWidth - scroll.clientWidth;
  headWrap.style.paddingRight = sb > 0 ? sb + "px" : "0";
}

function poPaneAddGridGap(parent) {
  const gap = document.createElement("div");
  gap.className = "carton-grid-gap";
  gap.setAttribute("aria-hidden", "true");
  parent.appendChild(gap);
}

function poPaneAddGridHeadCell(parent, text) {
  const cell = document.createElement("div");
  cell.textContent = text;
  parent.appendChild(cell);
  return cell;
}

function poPaneCreateQtyInput(value, onInput, readOnly) {
  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.step = "1";
  input.inputMode = "numeric";
  input.className = "carton-grid-input";
  input.value = value > 0 ? value : "";
  input.placeholder = EN_DASH;
  if (readOnly) input.readOnly = true;
  if (typeof bindNumberInput === "function") bindNumberInput(input);
  input.addEventListener("input", onInput);
  return input;
}

function poPaneCreateWeightField(value, onInput, readOnly) {
  const field = document.createElement("div");
  field.className = "carton-weight-field";
  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.step = "0.01";
  input.inputMode = "decimal";
  input.className = "carton-weight-input";
  input.value = value > 0 ? value : "";
  input.placeholder = EN_DASH;
  if (readOnly) input.readOnly = true;
  if (typeof bindNumberInput === "function") bindNumberInput(input);
  input.addEventListener("input", onInput);
  const suffix = document.createElement("span");
  suffix.className = "carton-weight-suffix";
  suffix.textContent = "kg";
  field.appendChild(input);
  field.appendChild(suffix);
  return { field, input };
}

function poPaneRenderCartonRows() {
  const body = document.getElementById(PO_PACKING_PANE.gridBody);
  if (!body) return;
  const readOnly = typeof isPoClosed === "function" && isPoClosed(poPackingPaneRow);
  body.innerHTML = "";

  poPackingPaneCartons.forEach((carton, idx) => {
    const row = document.createElement("div");
    row.className = "carton-grid-row";

    const numCell = document.createElement("div");
    numCell.className = "carton-grid-num";
    numCell.textContent = String(idx + 1);
    row.appendChild(numCell);
    poPaneAddGridGap(row);

    poPackingPaneSizeLabels.forEach((_, i) => {
      const cell = document.createElement("div");
      const input = poPaneCreateQtyInput(carton["u" + i], () => {
        carton["u" + i] = poPaneQty(input.value);
        totalCell.textContent = poPaneCartonTotal(carton) > 0 ? String(poPaneCartonTotal(carton)) : "";
        poPaneRefreshSummaryTotals();
      }, readOnly);
      cell.appendChild(input);
      row.appendChild(cell);
    });

    poPaneAddGridGap(row);

    const totalCell = document.createElement("div");
    totalCell.className = "carton-grid-total";
    totalCell.textContent = poPaneCartonTotal(carton) > 0 ? String(poPaneCartonTotal(carton)) : "";
    row.appendChild(totalCell);

    const weightCell = document.createElement("div");
    const weightField = poPaneCreateWeightField(carton.weight, () => {
      carton.weight = poPaneQty(weightField.input.value);
      poPaneRefreshSummaryTotals();
    }, readOnly);
    weightCell.appendChild(weightField.field);
    row.appendChild(weightCell);

    body.appendChild(row);
  });

  poPaneRefreshSummaryTotals();
  requestAnimationFrame(poPaneSyncCartonGridScrollbarPad);
}

function poPaneBuildCartonGrid() {
  poPaneSyncCartonGridLayout();
  const head = document.getElementById(PO_PACKING_PANE.gridHead);
  if (!head) return;
  head.innerHTML = "";
  const numHead = poPaneAddGridHeadCell(head, "#");
  numHead.className = "carton-grid-num";
  poPaneAddGridGap(head);
  poPackingPaneSizeLabels.forEach(label => poPaneAddGridHeadCell(head, label));
  poPaneAddGridGap(head);
  poPaneAddGridHeadCell(head, "Total");
  poPaneAddGridHeadCell(head, "Weight");
  poPaneRenderCartonRows();
}

function poPaneSyncCartonCount(count) {
  while (poPackingPaneCartons.length < count) poPackingPaneCartons.push(poPaneMakeEmptyCarton());
  if (poPackingPaneCartons.length > count) poPackingPaneCartons.length = count;
  const countInput = document.getElementById(PO_PACKING_PANE.countInput);
  if (countInput) countInput.value = String(poPackingPaneCartons.length);
  poPaneRenderCartonRows();
}

async function poPaneSavePackingList() {
  if (!poPackingPaneRow || poPackingPaneSaveInProgress || isAppSaving()) return;
  if (typeof isPoClosed === "function" && isPoClosed(poPackingPaneRow)) {
    poPaneShowStatus("Closed POs cannot be edited.", "error");
    return;
  }
  if (!poPaneHasPendingChanges()) {
    poPaneShowStatus("No changes to save.", "info");
    return;
  }

  const editorRoot = document.getElementById(PO_PACKING_PANE.pane);
  const cartons = poPaneCartonsToSheet(poPackingPaneCartons);
  const existingPackingList = getPackingListForPo(poPackingPaneRow["PO #"]);
  const notes = String(document.getElementById(PO_PACKING_PANE.notes)?.value ?? "").trim();

  if (cartons.some(c => poPaneQty(c["Total Units"]) <= 0)) {
    poPaneShowStatus("A carton quantity cannot be zero.", "error");
    return;
  }

  const packingList = {
    "Carton Count": cartons.length,
    "Notes": notes,
  };

  poPackingPaneSaveInProgress = true;
  const saveBtn = document.getElementById("poPackingSaveBtn");
  const spinner = document.getElementById("poPackingSaveSpinner");
  if (saveBtn) saveBtn.disabled = true;
  if (spinner) spinner.hidden = false;
  poPaneHideStatus();
  showIndicator(`Saving packing list${ELLIPSIS}`, "");

  try {
    if (isDemoMode()) {
      const poNumber = normalizePoNumber(poPackingPaneRow["PO #"]);
      const packingListId = getPackingListId(existingPackingList) || generateDemoPackingListId();
      upsertLocalPackingList(poNumber, packingListId, packingList, cartons);
      Object.assign(poPackingPaneRow, buildPackingPoUpdatesFromCartons(cartons, cartons.length));
      if (typeof applyModalUpdatesToTableRow === "function") {
        applyModalUpdatesToTableRow(poNumber, buildPackingPoUpdatesFromCartons(cartons, cartons.length));
      }
      renderTable();
      openPoPackingPane(poPackingPaneRow);
      showIndicator(`Saved ${CHECK_MARK}`, "success");
      return;
    }

    const existingForSave = { ...(existingPackingList || {}), Notes: notes };
    const prepared = preparePackingListSave({
      editor: editorRoot,
      row: poPackingPaneRow,
      existingPackingList: existingForSave,
      cartons,
    }, {});

    if (!prepared) return;

    if (prepared.mergedUpdates) {
      Object.assign(poPackingPaneRow, prepared.mergedUpdates);
      if (typeof applyModalUpdatesToTableRow === "function") {
        applyModalUpdatesToTableRow(normalizePoNumber(poPackingPaneRow["PO #"]), prepared.mergedUpdates);
      }
      renderTable();
    }

    if (prepared.syncToServer) {
      await prepared.syncToServer();
    }

    openPoPackingPane(poPackingPaneRow);
    showIndicator(`Saved ${CHECK_MARK}`, "success");
  } catch (err) {
    poPaneShowStatus("Save failed: " + err.message, "error");
    showIndicator("Save failed: " + err.message, "error");
  } finally {
    poPackingPaneSaveInProgress = false;
    if (saveBtn) saveBtn.disabled = typeof isPoClosed === "function" && isPoClosed(poPackingPaneRow);
    if (spinner) spinner.hidden = true;
  }
}

function initPoPackingPane() {
  const paneClose = document.getElementById("poPackingPaneClose");
  const decr = document.getElementById(PO_PACKING_PANE.decr);
  const incr = document.getElementById(PO_PACKING_PANE.incr);
  const countInput = document.getElementById(PO_PACKING_PANE.countInput);
  const saveBtn = document.getElementById("poPackingSaveBtn");
  const menuBtn = document.getElementById(PO_PACKING_PANE.menuBtn);
  const menuDropdown = document.getElementById(PO_PACKING_PANE.menuDropdown);
  const menuClear = document.getElementById("poMenuClearPacking");
  const menuDelete = document.getElementById(PO_PACKING_PANE.deleteMenu);
  const menuPrint = document.getElementById("poMenuPrintPacking");
  const menuMulti = document.getElementById("poMenuMultiCarton");
  const mcModal = document.getElementById("poMultiCartonModal");
  const mcCancel = document.getElementById("poMultiCartonCancel");
  const mcApply = document.getElementById("poMultiCartonApply");

  paneClose?.addEventListener("click", () => closePoPackingPane({ clearSelection: true }));

  decr?.addEventListener("click", () => {
    const next = Math.max(1, Math.floor(Number(countInput?.value) || 1) - 1);
    poPaneSyncCartonCount(next);
  });
  incr?.addEventListener("click", () => {
    const next = Math.max(1, Math.floor(Number(countInput?.value) || 1) + 1);
    poPaneSyncCartonCount(next);
  });
  countInput?.addEventListener("change", () => {
    const next = Math.max(1, Math.floor(Number(countInput.value) || 1));
    poPaneSyncCartonCount(next);
  });
  if (countInput && typeof bindNumberInput === "function") bindNumberInput(countInput);

  saveBtn?.addEventListener("click", () => poPaneSavePackingList());

  menuBtn?.addEventListener("click", e => {
    e.stopPropagation();
    if (menuDropdown) menuDropdown.hidden = !menuDropdown.hidden;
  });
  document.addEventListener("click", () => {
    if (menuDropdown) menuDropdown.hidden = true;
  });

  menuClear?.addEventListener("click", () => {
    if (menuDropdown) menuDropdown.hidden = true;
    if (!confirm("Clear all carton data in this draft?")) return;
    poPackingPaneCartons = [poPaneMakeEmptyCarton()];
    poPaneSyncCartonCount(1);
    poPaneHideStatus();
  });

  menuPrint?.addEventListener("click", () => {
    if (menuDropdown) menuDropdown.hidden = true;
    if (!poPackingPaneRow || typeof printPackingList !== "function") return;
    printPackingList({ poNumbers: [poPackingPaneRow["PO #"]], mode: "individual" });
  });

  menuDelete?.addEventListener("click", async () => {
    if (menuDropdown) menuDropdown.hidden = true;
    if (!poPackingPaneRow) return;
    const packingList = getPackingListForPo(poPackingPaneRow["PO #"]);
    if (!packingList || typeof deletePackingListFromPanel !== "function") return;
    await deletePackingListFromPanel(poPackingPaneRow, packingList);
    if (typeof getSingleMiniSelectedRow === "function" && getSingleMiniSelectedRow()) {
      openPoPackingPane(poPackingPaneRow);
    } else {
      closePoPackingPane({ clearSelection: false });
    }
  });

  menuMulti?.addEventListener("click", () => {
    if (menuDropdown) menuDropdown.hidden = true;
    const fields = document.getElementById("poMultiCartonSizeFields");
    if (!fields || !mcModal) return;
    fields.innerHTML = "";
    poPackingPaneSizeLabels.forEach((label, i) => {
      const div = document.createElement("div");
      div.className = "modal-field modal-size-item";
      const lbl = document.createElement("label");
      lbl.textContent = label;
      lbl.htmlFor = "poMcSize_" + i;
      const inp = document.createElement("input");
      inp.type = "number";
      inp.min = "0";
      inp.step = "1";
      inp.id = "poMcSize_" + i;
      inp.placeholder = "0";
      if (typeof bindNumberInput === "function") bindNumberInput(inp);
      div.appendChild(lbl);
      div.appendChild(inp);
      fields.appendChild(div);
    });
    document.getElementById("poMultiCartonCount").value = "1";
    document.getElementById("poMultiCartonWeight").value = "";
    mcModal.hidden = false;
  });

  mcCancel?.addEventListener("click", () => { if (mcModal) mcModal.hidden = true; });
  mcModal?.addEventListener("click", e => {
    if (e.target === mcModal) mcModal.hidden = true;
  });
  mcApply?.addEventListener("click", () => {
    const sizeQtys = poPackingPaneSizeLabels.map((_, i) => {
      const inp = document.getElementById("poMcSize_" + i);
      return inp ? poPaneQty(inp.value) : 0;
    });
    const numCartons = Math.max(1, Math.floor(Number(document.getElementById("poMultiCartonCount")?.value) || 1));
    const weight = poPaneQty(document.getElementById("poMultiCartonWeight")?.value);

    let startIdx = poPackingPaneCartons.findIndex(c =>
      poPackingPaneSizeLabels.every((_, i) => poPaneQty(c["u" + i]) === 0)
    );
    if (startIdx === -1) startIdx = poPackingPaneCartons.length;

    const neededCount = startIdx + numCartons;
    while (poPackingPaneCartons.length < neededCount) poPackingPaneCartons.push(poPaneMakeEmptyCarton());

    for (let n = 0; n < numCartons; n++) {
      const c = poPackingPaneCartons[startIdx + n];
      poPackingPaneSizeLabels.forEach((_, i) => { c["u" + i] = sizeQtys[i]; });
      c.weight = weight;
    }

    poPaneSyncCartonCount(poPackingPaneCartons.length);
    if (mcModal) mcModal.hidden = true;
  });

  window.addEventListener("resize", () => {
    if (!document.getElementById(PO_PACKING_PANE.pane)?.hidden) poPaneSyncCartonGridScrollbarPad();
  });
}

initPoPackingPane();
