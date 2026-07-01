/**
 * Main PO table — vendor-portal-style packing list side panel (single mini-select).
 */
let poPackingPaneRow = null;
let poPackingPaneCartons = [];
let poPackingPaneSizeLabels = [];
let poPackingPaneSnapshot = null;
let poPackingPaneSaveInProgress = false;
let poPackingListTableOpen = false;

const PO_PACKING_PANE = {
  pane: "poPackingPane",
  title: "poPackingPaneTitle",
  vendor: "poPackingPaneVendor",
  statusBadge: "poPackingPaneStatus",
  summary: "poPackingSummaryCard",
  packingListSection: "poPackingListSection",
  packingListToggle: "poPackingListToggle",
  packingListTablePanel: "poPackingListTablePanel",
  status: "poPackingStatusMsg",
  notes: "poPackingNotes",
  notesSection: "poPackingNotesSection",
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
  paneMax: 720,
  paneMin: 540,
  sizeMin: 40,
  sizeDefault: 46,
  rightGutter: 12,
};

function poPaneQty(val) {
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function poPaneCartonTotal(carton) {
  return poPackingPaneSizeLabels.reduce((sum, _, i) => sum + poPaneQty(carton["u" + i]), 0);
}

function poPaneFmtWeightLbs(val) {
  const n = poPaneQty(val);
  return n > 0 ? n.toFixed(2) : "0";
}

function poPaneFmtTotalWeightLbs(val) {
  const n = Math.round(poPaneQty(val));
  return n + " lbs";
}

function poPaneMakeEmptyCarton() {
  const c = {};
  poPackingPaneSizeLabels.forEach((_, i) => { c["u" + i] = 0; });
  c.weightKg = 0;
  c.weightLbs = 0;
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

function poPaneUnitQtyFromRow(row, index) {
  const field = `PO Unit ${index + 1}`;
  return typeof toQtyNumber === "function" ? toQtyNumber(row[field]) : poPaneQty(row[field]);
}

function poPanePackingUnitQty(index) {
  return poPackingPaneCartons.reduce((sum, c) => sum + poPaneQty(c["u" + index]), 0);
}

function poPaneFormatQtyCell(n) {
  return n > 0 ? String(n) : "";
}

function poPanePoHasPackingList(poKey) {
  return typeof hasPackingList === "function" && hasPackingList(poKey);
}

function poPanePlaceSizeGridCell(el, row, col, colSpan = 1) {
  el.style.gridRow = String(row);
  el.style.gridColumn = colSpan > 1 ? `${col} / span ${colSpan}` : String(col);
}

function poPaneAppendSizeQtyBlock(card, row, showActualQty = false) {
  const count = poPackingPaneSizeLabels.length;
  if (count === 0) return;

  const block = document.createElement("div");
  block.className = "po-summary-size-block";
  block.style.setProperty("--po-size-count", String(count));

  const corner = document.createElement("div");
  corner.className = "po-summary-size-corner";
  poPanePlaceSizeGridCell(corner, 1, 1);
  block.appendChild(corner);

  const totalHeadSpacer = document.createElement("div");
  totalHeadSpacer.className = "po-summary-size-colhead po-summary-size-colhead--blank po-summary-size-total-col";
  totalHeadSpacer.setAttribute("aria-hidden", "true");
  poPanePlaceSizeGridCell(totalHeadSpacer, 1, 2);
  block.appendChild(totalHeadSpacer);

  poPackingPaneSizeLabels.forEach((label, i) => {
    const head = document.createElement("div");
    head.className = "po-summary-size-colhead";
    head.textContent = label;
    poPanePlaceSizeGridCell(head, 1, 3 + i);
    block.appendChild(head);
  });

  const poRowLabel = document.createElement("div");
  poRowLabel.className = "po-summary-label";
  poRowLabel.textContent = "PO Qty";
  poPanePlaceSizeGridCell(poRowLabel, 2, 1);
  block.appendChild(poRowLabel);

  const poTotal = typeof computePoQtyFromUnits === "function"
    ? computePoQtyFromUnits(row)
    : poPackingPaneSizeLabels.reduce((sum, _, i) => sum + poPaneUnitQtyFromRow(row, i), 0);
  const poTotalCell = document.createElement("div");
  poTotalCell.className = "po-summary-size-qty po-summary-size-qty--po po-summary-size-total-col";
  poTotalCell.textContent = poPaneFormatQtyCell(poTotal);
  poPanePlaceSizeGridCell(poTotalCell, 2, 2);
  block.appendChild(poTotalCell);

  poPackingPaneSizeLabels.forEach((_, i) => {
    const cell = document.createElement("div");
    cell.className = "po-summary-size-qty po-summary-size-qty--po";
    cell.id = "poSummaryPoUnit_" + i;
    cell.textContent = poPaneFormatQtyCell(poPaneUnitQtyFromRow(row, i));
    poPanePlaceSizeGridCell(cell, 2, 3 + i);
    block.appendChild(cell);
  });

  if (showActualQty) {
    const actRow = 4;

    const divider = document.createElement("div");
    divider.className = "po-summary-size-divider";
    divider.setAttribute("aria-hidden", "true");
    poPanePlaceSizeGridCell(divider, 3, 1, 2 + count);
    block.appendChild(divider);

    const actRowLabel = document.createElement("div");
    actRowLabel.className = "po-summary-label";
    actRowLabel.textContent = "Actual Qty";
    poPanePlaceSizeGridCell(actRowLabel, actRow, 1);
    block.appendChild(actRowLabel);

    const actTotal = poPackingPaneSizeLabels.reduce((sum, _, i) => sum + poPanePackingUnitQty(i), 0);
    const actTotalCell = document.createElement("div");
    actTotalCell.className = "po-summary-size-qty po-summary-size-qty--act po-summary-size-total-col";
    actTotalCell.id = "poSummaryActTotal";
    actTotalCell.textContent = poPaneFormatQtyCell(actTotal);
    poPanePlaceSizeGridCell(actTotalCell, actRow, 2);
    block.appendChild(actTotalCell);

    poPackingPaneSizeLabels.forEach((_, i) => {
      const cell = document.createElement("div");
      cell.className = "po-summary-size-qty po-summary-size-qty--act";
      cell.id = "poSummarySizeTotal_" + i;
      cell.textContent = poPaneFormatQtyCell(poPanePackingUnitQty(i));
      poPanePlaceSizeGridCell(cell, actRow, 3 + i);
      block.appendChild(cell);
    });
  }

  card.appendChild(block);
}

function poPaneSheetCartonsToPane(cartons) {
  return cartons.map(carton => {
    const out = {};
    poPackingPaneSizeLabels.forEach((_, i) => {
      out["u" + i] = poPaneQty(carton["Unit " + (i + 1)]);
    });
    out.weightKg = poPaneQty(carton[CARTON_WEIGHT_FIELD]);
    out.weightLbs = typeof getCartonWeightLbs === "function"
      ? getCartonWeightLbs(carton)
      : out.weightKg;
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
    const weight = poPaneQty(carton.weightKg);
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

function isPackingPaneStatusEl(el) {
  return el?.id === PO_PACKING_PANE.statusBadge;
}

function poPaneRenderStatusHeader(row) {
  const el = document.getElementById(PO_PACKING_PANE.statusBadge);
  if (!el || !row) return;

  const clone = el.cloneNode(false);
  el.replaceWith(clone);

  const statusVal = typeof getRowWorkflowStatus === "function"
    ? getRowWorkflowStatus(row)
    : (row["Status"] ?? "");
  clone.innerHTML = typeof renderStatus === "function" ? renderStatus(statusVal) : String(statusVal ?? "");
  clone.className = "packing-pane-status";
  clone.id = PO_PACKING_PANE.statusBadge;
  clone.title = "";

  if (typeof isPoFieldEditable === "function" && isPoFieldEditable("Status", row) && typeof bindSelectCellInteractions === "function") {
    clone.classList.add("editable", "select-cell");
    clone.title = "Click to choose";
    bindSelectCellInteractions(clone, "Status", row);
    return;
  }

  clone.classList.add("readonly", "readonly-no-select");
}

function poPaneRenderPaneHeader(row) {
  const poKey = String(row?.["PO #"] ?? "").trim();
  const titleEl = document.getElementById(PO_PACKING_PANE.title);
  const vendorEl = document.getElementById(PO_PACKING_PANE.vendor);
  if (titleEl) titleEl.textContent = poKey ? "PO # " + poKey : "";
  if (vendorEl) {
    const vendor = String(row?.["Vendor"] ?? "").trim();
    vendorEl.textContent = vendor;
    vendorEl.hidden = !vendor;
  }
}

function updatePackingPaneIfOpen() {
  if (!poPackingPaneRow || document.getElementById(PO_PACKING_PANE.pane)?.hidden) return;
  const poKey = String(poPackingPaneRow["PO #"] ?? "").trim();
  poPaneRenderPaneHeader(poPackingPaneRow);
  poPaneRenderStatusHeader(poPackingPaneRow);
  poPaneSyncNotesVisibility(poPackingPaneRow);
  poPaneSyncPackingListSectionVisibility(poKey);
  poPaneBuildSummaryCard(poPackingPaneRow);
}

function poPaneSyncNotesVisibility(row) {
  const section = document.getElementById(PO_PACKING_PANE.notesSection);
  const notesInput = document.getElementById(PO_PACKING_PANE.notes);
  if (!section) return;
  const raw = row?.["Notes"] ?? notesInput?.value ?? "";
  const notesText = typeof isEmptyValue === "function" && isEmptyValue(raw)
    ? ""
    : String(raw).trim();
  section.hidden = !notesText;
}

function poPaneSyncPackingListSectionVisibility(poKey) {
  const section = document.getElementById(PO_PACKING_PANE.packingListSection);
  if (!section) return;
  const visible = poPanePoHasPackingList(poKey);
  section.hidden = !visible;
  if (!visible) poPaneSetPackingListTableOpen(false);
}

function poPaneSetPackingListTableOpen(isOpen) {
  poPackingListTableOpen = isOpen;
  const panel = document.getElementById(PO_PACKING_PANE.packingListTablePanel);
  const toggle = document.getElementById(PO_PACKING_PANE.packingListToggle);
  const section = document.getElementById(PO_PACKING_PANE.packingListSection);
  if (panel) panel.hidden = !isOpen;
  if (toggle) toggle.setAttribute("aria-expanded", String(isOpen));
  if (section) section.classList.toggle("packing-list-section--open", isOpen);
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

function openPoPackingPane(row, { force = false } = {}) {
  if (!row) return;
  const poKey = String(row["PO #"] ?? "").trim();
  if (
    !force
    && poPackingPaneRow
    && String(poPackingPaneRow["PO #"] ?? "").trim() === poKey
    && !document.getElementById(PO_PACKING_PANE.pane)?.hidden
  ) {
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
  if (notesInput) {
    notesInput.value = String(row["Notes"] ?? "").trim();
    notesInput.readOnly = true;
  }
  poPaneSyncNotesVisibility(row);
  poPaneSyncPackingListSectionVisibility(poKey);
  if (deleteBtn) deleteBtn.hidden = !packingList;
  poPaneRenderPaneHeader(row);
  poPaneRenderStatusHeader(row);
  poPaneSetPackingListTableOpen(false);
  if (pane) pane.hidden = false;

  poPaneSetReadOnly(readOnly);
  poPaneBuildSummaryCard(row);
  poPaneBuildCartonGrid();
  poPaneRefreshSummaryTotals();
  poPaneCaptureSnapshot();
  poPaneHideStatus();
}

function poPaneSetReadOnly(readOnly) {
  const ids = [
    PO_PACKING_PANE.countInput,
    PO_PACKING_PANE.decr,
    PO_PACKING_PANE.incr,
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === "BUTTON") el.disabled = readOnly;
    else el.readOnly = readOnly;
  });
  const notesEl = document.getElementById(PO_PACKING_PANE.notes);
  if (notesEl) notesEl.readOnly = true;
  document.querySelectorAll("#poCartonGridBody input").forEach(inp => {
    inp.readOnly = readOnly;
  });
}

const PO_PANE_SUMMARY_DATE_COLS = new Set([
  "PO Date", "CXL Date", "EST EXF", "EST IHD", "EXF Date", "EXF Request Date",
]);

const PO_PANE_MAIN_SUMMARY_ROWS = [
  [{ label: "Buyer", col: "Buyer" }, { label: "Buyer PO #", col: "Buyer PO #" }],
  [{ label: "Style #", col: "Style #" }, { label: "Color", col: "Color" }],
  [{ label: "PO Date", col: "PO Date" }, { label: "CXL Date", col: "CXL Date" }],
  [{ label: "EST EXF", col: "EST EXF" }, { label: "EST IHD", col: "EST IHD" }],
  [{ label: "Old PO #", col: "Old PO #" }, { label: "SO #", col: "SO #" }],
  [{ label: "Ship Method", col: "Ship Method" }, null],
];

function poPaneFormatSummaryFieldValue(col, value) {
  if (isEmptyValue(value)) return "";
  if (PO_PANE_SUMMARY_DATE_COLS.has(col) || (typeof DATE_FIELDS !== "undefined" && DATE_FIELDS.has(col))) {
    return formatDateForDisplay(value);
  }
  return String(value).trim();
}

function poPaneAppendSummaryField(parent, label, value) {
  if (!value) return;
  const lbl = document.createElement("span");
  lbl.className = "po-summary-label";
  lbl.textContent = label;
  const val = document.createElement("span");
  val.className = "po-summary-value";
  val.textContent = value;
  parent.appendChild(lbl);
  parent.appendChild(val);
}

function poPaneCreateSummaryFieldsColumn() {
  const col = document.createElement("div");
  col.className = "po-summary-fields";
  return col;
}

function poPaneIsPhotoUrl(url) {
  return /^https?:\/\/.+/i.test(String(url ?? "").trim());
}

function poPaneGetPhotoMaxDimensions(contextEl) {
  const style = getComputedStyle(contextEl?.closest?.("#poPackingPane") || document.getElementById("poPackingPane") || document.documentElement);
  return {
    maxW: parseFloat(style.getPropertyValue("--po-pane-photo-max-width")) || 240,
    maxH: parseFloat(style.getPropertyValue("--po-pane-photo-max-height")) || 300,
  };
}

function poPaneApplyPhotoImageSize(img) {
  const { maxW, maxH } = poPaneGetPhotoMaxDimensions(img);
  const naturalW = img.naturalWidth;
  const naturalH = img.naturalHeight;
  if (!naturalW || !naturalH) return;
  const scale = Math.min(1, maxW / naturalW, maxH / naturalH);
  img.style.width = `${Math.round(naturalW * scale)}px`;
  img.style.height = `${Math.round(naturalH * scale)}px`;
}

function poPaneBindPhotoSizing(img) {
  const apply = () => poPaneApplyPhotoImageSize(img);
  if (img.complete && img.naturalWidth) {
    apply();
    return;
  }
  img.addEventListener("load", apply, { once: true });
}

function poPaneRenderPhoto(photoEl, url, photoIndex) {
  photoEl.innerHTML = "";
  photoEl.classList.remove("po-summary-photo--has-image", "po-summary-photo--error");
  const normalizedUrl = typeof normalizeStylePhotoUrl === "function"
    ? normalizeStylePhotoUrl(url)
    : String(url ?? "").trim();
  const openUrl = String(url ?? "").trim() || normalizedUrl;

  if (!poPaneIsPhotoUrl(normalizedUrl)) return;

  photoEl.classList.add("po-summary-photo--has-image");
  const img = document.createElement("img");
  img.className = "po-summary-photo-img";
  img.src = normalizedUrl;
  img.alt = `Photo ${photoIndex}`;
  img.loading = "lazy";
  img.title = "Open in new tab";
  img.addEventListener("click", e => {
    e.stopPropagation();
    window.open(openUrl, "_blank", "noopener,noreferrer");
  });
  poPaneBindPhotoSizing(img);
  img.addEventListener("error", () => {
    photoEl.classList.remove("po-summary-photo--has-image");
    photoEl.classList.add("po-summary-photo--error");
    img.remove();
  });
  photoEl.appendChild(img);
}

function poPaneAppendStylePhotos(card, row) {
  const stylePhotos = typeof getStylePhotosForRow === "function" ? getStylePhotosForRow(row) : null;
  const wrap = document.createElement("div");
  wrap.className = "po-summary-photos";

  STYLE_PHOTO_FIELDS.forEach((field, index) => {
    const slot = document.createElement("div");
    slot.className = "po-summary-photo-slot";
    const photo = document.createElement("div");
    photo.className = "po-summary-photo";
    photo.setAttribute("aria-label", field);
    poPaneRenderPhoto(photo, stylePhotos?.[field] ?? "", index + 1);
    slot.appendChild(photo);
    wrap.appendChild(slot);
  });

  card.appendChild(wrap);
}

function poPaneBuildSummaryCard(row) {
  const card = document.getElementById(PO_PACKING_PANE.summary);
  if (!card) return;
  card.innerHTML = "";

  const mainSection = document.createElement("div");
  mainSection.className = "po-summary-columns";
  const leftCol = poPaneCreateSummaryFieldsColumn();
  const rightCol = poPaneCreateSummaryFieldsColumn();

  PO_PANE_MAIN_SUMMARY_ROWS.forEach(([left, right]) => {
    if (left) {
      poPaneAppendSummaryField(leftCol, left.label, poPaneFormatSummaryFieldValue(left.col, row[left.col]));
    }
    if (right) {
      poPaneAppendSummaryField(rightCol, right.label, poPaneFormatSummaryFieldValue(right.col, row[right.col]));
    }
  });

  mainSection.appendChild(leftCol);
  mainSection.appendChild(rightCol);
  card.appendChild(mainSection);

  const exfReqId = poPaneFormatSummaryFieldValue("EXF Request ID", row["EXF Request ID"]);
  const exfDateRaw = row["EXF Date"] || row["EXF Request Date"];
  const exfDate = poPaneFormatSummaryFieldValue("EXF Date", exfDateRaw);
  if (exfReqId || exfDate) {
    const exfSection = document.createElement("div");
    exfSection.className = "po-summary-exf-section";
    const exfColumns = document.createElement("div");
    exfColumns.className = "po-summary-columns";
    const exfLeft = poPaneCreateSummaryFieldsColumn();
    const exfRight = poPaneCreateSummaryFieldsColumn();
    poPaneAppendSummaryField(exfLeft, "EXF Req ID", exfReqId);
    poPaneAppendSummaryField(exfRight, "EXF Date", exfDate);
    exfColumns.appendChild(exfLeft);
    exfColumns.appendChild(exfRight);
    exfSection.appendChild(exfColumns);
    card.appendChild(exfSection);
  }

  poPaneAppendSizeQtyBlock(card, row, poPanePoHasPackingList(String(row["PO #"] ?? "").trim()));
  poPaneAppendStylePhotos(card, row);
  poPaneSyncSummaryLabelColumn(card);
}

function poPaneSyncSummaryLabelColumn(card) {
  if (!card) return;
  requestAnimationFrame(() => {
    const labels = card.querySelectorAll(".po-summary-label");
    let maxW = 0;
    labels.forEach(el => {
      maxW = Math.max(maxW, el.scrollWidth);
    });
    if (maxW > 0) {
      card.style.setProperty("--po-summary-label-width", `${maxW}px`);
    }
  });
}

function poPaneRefreshSummaryTotals() {
  const ctnEl = document.getElementById("poSummaryTotal_Cartons");
  const unitEl = document.getElementById("poSummaryTotal_TotalUnits");
  const weightEl = document.getElementById("poSummaryTotal_TotalWeight");
  if (ctnEl) ctnEl.textContent = String(poPackingPaneCartons.length);
  const totalUnits = poPackingPaneCartons.reduce((sum, c) => sum + poPaneCartonTotal(c), 0);
  if (unitEl) unitEl.textContent = String(totalUnits);
  const totalWeight = poPackingPaneCartons.reduce((sum, c) => sum + poPaneQty(c.weightLbs), 0);
  if (weightEl) weightEl.textContent = poPaneFmtTotalWeightLbs(totalWeight);
  const actTotal = poPackingPaneSizeLabels.reduce((sum, _, i) => sum + poPanePackingUnitQty(i), 0);
  const actTotalEl = document.getElementById("poSummaryActTotal");
  if (actTotalEl) actTotalEl.textContent = poPaneFormatQtyCell(actTotal);
  poPackingPaneSizeLabels.forEach((_, i) => {
    const el = document.getElementById("poSummarySizeTotal_" + i);
    if (el) el.textContent = poPaneFormatQtyCell(poPanePackingUnitQty(i));
  });
}

function poPaneGetCartonGridLayout() {
  const count = Math.max(1, poPackingPaneSizeLabels.length);
  const fixed = PO_CARTON_COL.num
    + PO_CARTON_COL.gap * 2
    + PO_CARTON_COL.total
    + PO_CARTON_COL.weight
    + PO_CARTON_COL.rightGutter;
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
    PO_CARTON_COL.rightGutter,
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
    PO_CARTON_COL.rightGutter + "px",
  ].join(" ");
  const pane = document.getElementById(PO_PACKING_PANE.pane);
  const gridWrap = document.getElementById(PO_PACKING_PANE.gridWrap);
  if (pane) pane.style.setProperty("--packing-pane-width", paneW + "px");
  if (gridWrap) {
    gridWrap.style.setProperty("--carton-grid-width", tableW + "px");
    gridWrap.style.setProperty("--carton-grid-cols", cols);
  }
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

function poPaneCreateWeightField(value) {
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
  input.readOnly = true;
  input.tabIndex = -1;
  const suffix = document.createElement("span");
  suffix.className = "carton-weight-suffix";
  suffix.textContent = "lbs";
  field.appendChild(input);
  field.appendChild(suffix);
  return { field, input };
}

function poPaneParseClipboardTable(text) {
  const normalized = String(text ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const withoutTrailingNewline = normalized.endsWith("\n") ? normalized.slice(0, -1) : normalized;
  return withoutTrailingNewline.split("\n").map(line => line.split("\t"));
}

function poPaneNormalizePastedQty(value) {
  const raw = String(value ?? "").trim();
  if (raw === "") return "";
  const n = Number(raw.replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? String(n) : null;
}

function poPaneWriteCartonQtyInput(input, value) {
  const cartonIndex = Number(input.dataset.cartonIndex);
  const unitIndex = Number(input.dataset.unitIndex);
  if (!Number.isInteger(cartonIndex) || !Number.isInteger(unitIndex) || !poPackingPaneCartons[cartonIndex]) {
    return null;
  }

  input.value = value;
  poPackingPaneCartons[cartonIndex]["u" + unitIndex] = poPaneQty(value);
  const totalCell = document.querySelector(
    `#${PO_PACKING_PANE.gridBody} .carton-grid-total[data-carton-index="${cartonIndex}"]`
  );
  if (totalCell) {
    const total = poPaneCartonTotal(poPackingPaneCartons[cartonIndex]);
    totalCell.textContent = total > 0 ? String(total) : "";
  }
  return cartonIndex;
}

function poPaneHandleCartonQtyPaste(e) {
  const target = e.target;
  if (!(target instanceof HTMLInputElement) || !target.classList.contains("carton-grid-input") || target.readOnly) {
    return;
  }

  const clipboardText = e.clipboardData?.getData("text/plain") ?? "";
  if (!clipboardText || !/[\t\r\n]/.test(clipboardText)) return;

  const startCartonIndex = Number(target.dataset.cartonIndex);
  const startUnitIndex = Number(target.dataset.unitIndex);
  if (!Number.isInteger(startCartonIndex) || !Number.isInteger(startUnitIndex)) return;

  e.preventDefault();
  const changedCartonIndexes = new Set();
  const body = document.getElementById(PO_PACKING_PANE.gridBody);

  poPaneParseClipboardTable(clipboardText).forEach((cells, rowOffset) => {
    const cartonIndex = startCartonIndex + rowOffset;
    if (!poPackingPaneCartons[cartonIndex]) return;
    cells.forEach((cellValue, colOffset) => {
      const unitIndex = startUnitIndex + colOffset;
      if (unitIndex >= poPackingPaneSizeLabels.length) return;
      const normalizedValue = poPaneNormalizePastedQty(cellValue);
      if (normalizedValue === null) return;
      const input = body?.querySelector(
        `.carton-grid-input[data-carton-index="${cartonIndex}"][data-unit-index="${unitIndex}"]`
      );
      if (!(input instanceof HTMLInputElement)) return;
      const changedCartonIndex = poPaneWriteCartonQtyInput(input, normalizedValue);
      if (changedCartonIndex !== null) changedCartonIndexes.add(changedCartonIndex);
    });
  });

  if (changedCartonIndexes.size > 0) poPaneRefreshSummaryTotals();
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
      cell.className = "carton-grid-size-cell";
      const input = poPaneCreateQtyInput(carton["u" + i], () => {
        carton["u" + i] = poPaneQty(input.value);
        totalCell.textContent = poPaneCartonTotal(carton) > 0 ? String(poPaneCartonTotal(carton)) : "";
        poPaneRefreshSummaryTotals();
      }, readOnly);
      input.dataset.cartonIndex = String(idx);
      input.dataset.unitIndex = String(i);
      cell.appendChild(input);
      row.appendChild(cell);
    });

    poPaneAddGridGap(row);

    const totalCell = document.createElement("div");
    totalCell.className = "carton-grid-total";
    totalCell.dataset.cartonIndex = String(idx);
    totalCell.textContent = poPaneCartonTotal(carton) > 0 ? String(poPaneCartonTotal(carton)) : "";
    row.appendChild(totalCell);

    const weightCell = document.createElement("div");
    weightCell.className = "carton-grid-weight-cell";
    const weightField = poPaneCreateWeightField(carton.weightLbs);
    weightCell.appendChild(weightField.field);
    row.appendChild(weightCell);

    body.appendChild(row);
  });

  poPaneRefreshSummaryTotals();
}

function poPaneBuildCartonGrid() {
  poPaneSyncCartonGridLayout();
  const head = document.getElementById(PO_PACKING_PANE.gridHead);
  if (!head) return;
  head.innerHTML = "";
  const numHead = poPaneAddGridHeadCell(head, "#");
  numHead.className = "carton-grid-num";
  poPaneAddGridGap(head);
  poPackingPaneSizeLabels.forEach(label => {
    const cell = poPaneAddGridHeadCell(head, label);
    cell.classList.add("carton-grid-size-head");
  });
  poPaneAddGridGap(head);
  const totalHead = poPaneAddGridHeadCell(head, "Total");
  totalHead.classList.add("carton-grid-total-head");
  const weightHead = poPaneAddGridHeadCell(head, "Weight");
  weightHead.classList.add("carton-grid-weight-head");
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
  const menuBtn = document.getElementById(PO_PACKING_PANE.menuBtn);
  const menuDropdown = document.getElementById(PO_PACKING_PANE.menuDropdown);
  const menuClear = document.getElementById("poMenuClearPacking");
  const menuDelete = document.getElementById(PO_PACKING_PANE.deleteMenu);
  const menuPrint = document.getElementById("poMenuPrintPacking");
  const menuMulti = document.getElementById("poMenuMultiCarton");
  const mcModal = document.getElementById("poMultiCartonModal");
  const mcCancel = document.getElementById("poMultiCartonCancel");
  const mcApply = document.getElementById("poMultiCartonApply");

  const pane = document.getElementById(PO_PACKING_PANE.pane);
  pane?.addEventListener("mousedown", e => e.stopPropagation());

  document.getElementById(PO_PACKING_PANE.packingListToggle)?.addEventListener("click", () => {
    poPaneSetPackingListTableOpen(!poPackingListTableOpen);
  });

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
  document.getElementById(PO_PACKING_PANE.gridBody)?.addEventListener("paste", poPaneHandleCartonQtyPaste);

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
      openPoPackingPane(poPackingPaneRow, { force: true });
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

    let startIdx = poPackingPaneCartons.findIndex(c =>
      poPackingPaneSizeLabels.every((_, i) => poPaneQty(c["u" + i]) === 0)
    );
    if (startIdx === -1) startIdx = poPackingPaneCartons.length;

    const neededCount = startIdx + numCartons;
    while (poPackingPaneCartons.length < neededCount) poPackingPaneCartons.push(poPaneMakeEmptyCarton());

    for (let n = 0; n < numCartons; n++) {
      const c = poPackingPaneCartons[startIdx + n];
      poPackingPaneSizeLabels.forEach((_, i) => { c["u" + i] = sizeQtys[i]; });
    }

    poPaneSyncCartonCount(poPackingPaneCartons.length);
    if (mcModal) mcModal.hidden = true;
  });

}

initPoPackingPane();
