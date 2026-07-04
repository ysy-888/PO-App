// Modal-to-modal navigation stack shared by the PO, Sales Order, and Invoice modals.
// When a modal is opened from a link inside another modal, the source modal is
// pushed onto the stack so a "Back" button can return to it.

let modalNavStack = [];
let modalNavPendingEntry = null;
let modalNavReturning = false;

// Call right before opening a modal from a link inside another modal.
// entry: { type: "po" | "so" | "invoice", id: "<record number>" }
function modalNavPush(entry) {
  modalNavPendingEntry = entry;
}

// Called by each modal's open function. Maintains the stack and reports
// whether that modal should show a Back button.
function modalNavOnOpen() {
  if (modalNavReturning) {
    modalNavReturning = false;
  } else if (modalNavPendingEntry) {
    modalNavStack.push(modalNavPendingEntry);
    modalNavPendingEntry = null;
  } else {
    // Opened directly (table row, dashboard, etc.) — not part of a chain.
    modalNavStack = [];
  }
  return modalNavStack.length > 0;
}

function modalNavFindRecord(entry) {
  if (!entry) return null;
  if (entry.type === "po") {
    return typeof findRowByPo === "function" ? findRowByPo(entry.id) : null;
  }
  if (entry.type === "so") {
    return typeof findSalesOrderByNumber === "function" ? findSalesOrderByNumber(entry.id) : null;
  }
  if (entry.type === "invoice") {
    return typeof findInvoiceByNumber === "function" ? findInvoiceByNumber(entry.id) : null;
  }
  return null;
}

function modalNavOpenEntry(entry) {
  const record = modalNavFindRecord(entry);
  if (!record) return false;
  if (entry.type === "po" && typeof openPODetail === "function") {
    openPODetail(record);
    return true;
  }
  if (entry.type === "so" && typeof openSalesOrderModal === "function") {
    openSalesOrderModal(record);
    return true;
  }
  if (entry.type === "invoice" && typeof openInvoiceModal === "function") {
    openInvoiceModal(record);
    return true;
  }
  return false;
}

// Back button handler: closes the current modal and reopens the previous one.
function modalNavBack(closeCurrent) {
  const entry = modalNavStack.pop();
  if (typeof closeCurrent === "function") closeCurrent();
  if (!entry) return;
  modalNavReturning = true;
  const opened = modalNavOpenEntry(entry);
  modalNavReturning = false;
  if (!opened) modalNavStack = [];
}
