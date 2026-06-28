/** Styles list view (Style Master). */

const STYLE_TABLE_COLUMNS = [
  "Style #",
  "Color",
  "Size Cat",
  "Style Category",
  "Description",
  "Size Run",
];

const STYLE_SEARCH_COLUMNS = [
  "Style #",
  "Color",
  "Size Cat",
  "Style Category",
  "Description",
];

let filteredStyles = [];

function getStyleSizeRunPreview(row) {
  return SIZE_FIELDS
    .map(f => String(row[f] ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

function onStylesDataLoaded(rows) {
  allStyles = (rows ?? []).map(row => ({ ...row }));
  buildStyleMasterIndex(allStyles);
  applyStyleFilters();
}

function applyStyleFilters() {
  const q = (document.getElementById("stylesSearchInput")?.value ?? "").toLowerCase();
  filteredStyles = allStyles.filter(row => {
    if (!q) return true;
    return STYLE_SEARCH_COLUMNS
      .map(col => String(row[col] ?? ""))
      .join(" ")
      .toLowerCase()
      .includes(q);
  });
  filteredStyles.sort((a, b) => {
    const styleCmp = String(a["Style #"] ?? "").localeCompare(
      String(b["Style #"] ?? ""),
      undefined,
      { sensitivity: "base" }
    );
    if (styleCmp !== 0) return styleCmp;
    return String(a.Color ?? "").localeCompare(String(b.Color ?? ""), undefined, { sensitivity: "base" });
  });
  renderStylesTable();
  updateStyleRowCounter();
}

function updateStyleRowCounter() {
  const el = document.getElementById("stylesRowCounter");
  if (!el) return;
  const total = filteredStyles.length;
  el.textContent = total === 1 ? "1 style" : `${total} styles`;
}

function renderStylesTable() {
  const tbody = document.getElementById("stylesTableBody");
  if (!tbody) return;

  if (filteredStyles.length === 0) {
    tbody.innerHTML = `<tr class="state-row"><td colspan="${STYLE_TABLE_COLUMNS.length}">No styles yet. Import a Style Master CSV to get started.</td></tr>`;
    return;
  }

  tbody.replaceChildren();
  filteredStyles.forEach(row => {
    const tr = document.createElement("tr");
    STYLE_TABLE_COLUMNS.forEach(col => {
      const td = document.createElement("td");
      if (col === "Size Run") {
        td.textContent = getStyleSizeRunPreview(row) || "—";
      } else {
        td.textContent = String(row[col] ?? "") || "—";
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

function initStylesView() {
  document.getElementById("stylesSearchInput")?.addEventListener("input", applyStyleFilters);
}

initStylesView();
