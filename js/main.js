
// #region agent log
fetch('http://127.0.0.1:7896/ingest/1212f48a-df35-4839-b188-b7be9a87de77',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c417e3'},body:JSON.stringify({sessionId:'c417e3',location:'main.js:initStart',message:'init sequence start',data:{loadDateFormatPreference:typeof loadDateFormatPreference,initHeaderMenu:typeof initHeaderMenu,loadData:typeof loadData},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
// #endregion
loadColumnVisibility();
applyTwoLineTableHeaders();
loadCxlCountdownPreference();
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
// #region agent log
fetch('http://127.0.0.1:7896/ingest/1212f48a-df35-4839-b188-b7be9a87de77',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c417e3'},body:JSON.stringify({sessionId:'c417e3',location:'main.js:beforeLoadData',message:'init sequence completed, calling loadData',data:{},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
// #endregion
loadData();
