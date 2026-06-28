
loadColumnVisibility();
applyTwoLineTableHeaders();
loadCxlCountdownPreference();
loadSplitViewPreference();
loadDateFormatPreference();
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
// In API mode, initAuth() handles the first loadData() call after sign-in.
// In appsscript/demo mode, loadData() runs immediately as before.
if (typeof initAuth === "function") {
  initAuth().then(() => {
    if (typeof isApiMode !== "function" || !isApiMode()) loadData();
  });
} else {
  loadData();
}
