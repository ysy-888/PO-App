
loadColumnVisibility();
applyTwoLineTableHeaders();
loadCxlCountdownPreference();
loadSplitViewPreference();
loadDateFormatPreference();
loadAsnDefaultEmailAddressesPreference();
initDivisionFilters();
initStatusFilters();
applyDefaultStatusFilter(defaultStatusFilter);
initColumnFilterHeaders();
initFlagFilterHeader();
initCellSelectDropdown();
initCellDatePopover();
initPoModalActions();
initPagination();
initPaginationKeyboard();
initHeaderMenu();
initSettings();
initFeatureSettings();
initHeaderTooltips();
initCsvImportSummary();
initEditTable();
initRowSelection();
initToolbarKeyboard();
initSearchInput();
updateSortHeaders();
updateColumnFilterHeaderStates();
updateFlagFilterHeaderState();
applyColumnOrder();
applyColumnVisibility();
// initAuth() handles the first loadData() call after sign-in.
// Show the CSV-import-style spinner until that first load finishes.
if (typeof setAppSaving === "function") setAppSaving(true, "Loading...");
if (typeof initAuth === "function") {
  initAuth();
} else {
  loadData();
}
