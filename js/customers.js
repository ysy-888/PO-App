/** Customers list view with compose-and-send email. */

const CUSTOMER_SELECT_COL = "__select";
const CUSTOMER_ACTION_COL = "__action";
const CUSTOMER_EMAIL_SENT_AT_FIELD = "Email Sent At";

const CUSTOMER_TABLE_COLUMNS = [
  CUSTOMER_SELECT_COL,
  "Customer",
  "Address",
  "Line 2",
  "City",
  "State",
  "Zip",
  "Country",
  "Contact",
  "Phone #",
  "Email",
  CUSTOMER_EMAIL_SENT_AT_FIELD,
  CUSTOMER_ACTION_COL,
];

const CUSTOMER_UI_ONLY_COLS = new Set([CUSTOMER_SELECT_COL, CUSTOMER_ACTION_COL]);

const CUSTOMER_DISPLAY_COLUMNS = CUSTOMER_TABLE_COLUMNS.filter(
  col => !CUSTOMER_UI_ONLY_COLS.has(col)
);

const CUSTOMER_SEARCH_COLUMNS = CUSTOMER_DISPLAY_COLUMNS;

const CUSTOMER_EMAIL_SUBJECT_TEMPLATE =
  "[ELEVATOR DISCO] ✨ - CUSTOMER - Your Order Is Ready to Ship!";

const CUSTOMER_EMAIL_BODY_TEMPLATE = `Dear CUSTOMER,

Exciting news—your order is ready to be shipped!

We are thrilled to get these beautiful styles on their way to you and can't wait for them to arrive at your storefront. We hope you love every piece as much as we enjoyed creating and preparing them for you.

As we prepare your order for shipment, we noticed that we need updated payment information before we can proceed. Your credit card was denied transaction.

We are excited to get these beautiful styles delivered to your storefront and appreciate your prompt attention to this matter.



Please reply with updated information.

Name on Card:
CC#:
Exp:
CVV#:
Billing Address:


Thank you for your continued support and for being a valued part of the Elevator Disco community. We truly appreciate your business and look forward to bringing you many more exciting styles in the future.

Warm regards,

The Elevator Disco Team`;

function applyCustomerEmailTemplate(text, customerName) {
  const name = String(customerName ?? "").trim();
  return String(text ?? "").replace(/CUSTOMER/g, name);
}

let filteredCustomers = [];
let customerSelectedKeys = new Set();
let customerEmailOpInProgress = false;
let customerEmailTarget = null;
let customerEmailMode = "single";

function getCustomerKey(row) {
  return String(row?.Customer ?? "").trim();
}

function getCustomerEmail(row) {
  return String(row?.Email ?? "").trim();
}

function isCustomerSelectable(row) {
  return Boolean(getCustomerKey(row) && getCustomerEmail(row));
}

function getFilteredSelectableCustomerKeys() {
  return filteredCustomers
    .filter(isCustomerSelectable)
    .map(getCustomerKey)
    .filter(Boolean);
}

function onCustomersDataLoaded(rows) {
  allCustomers = (rows ?? []).map(row => ({ ...row }));
  customerSelectedKeys = new Set(
    [...customerSelectedKeys].filter(key => allCustomers.some(row => getCustomerKey(row) === key))
  );
  applyCustomerFilters();
}

function applyCustomerFilters() {
  const q = (document.getElementById("customersSearchInput")?.value ?? "").toLowerCase();
  filteredCustomers = allCustomers.filter(row => {
    if (!q) return true;
    return CUSTOMER_SEARCH_COLUMNS
      .map(col => String(row[col] ?? ""))
      .join(" ")
      .toLowerCase()
      .includes(q);
  });
  filteredCustomers.sort((a, b) =>
    String(a.Customer ?? "").localeCompare(String(b.Customer ?? ""), undefined, { sensitivity: "base" })
  );
  renderCustomersTable();
  updateCustomerRowCounter();
  updateCustomerSelectionUi();
}

function updateCustomerSelectionUi() {
  const batchBtn = document.getElementById("customersBatchEmailBtn");
  const selectAllCb = document.getElementById("customersSelectAllCheckbox");
  const selectableKeys = getFilteredSelectableCustomerKeys();
  const selectedCount = selectableKeys.filter(key => customerSelectedKeys.has(key)).length;

  if (batchBtn) {
    batchBtn.hidden = selectedCount < 2;
    batchBtn.disabled = customerEmailOpInProgress || isAppSaving();
  }

  if (selectAllCb) {
    const allSelected = selectableKeys.length > 0 && selectedCount === selectableKeys.length;
    const someSelected = selectedCount > 0 && !allSelected;
    selectAllCb.checked = allSelected;
    selectAllCb.indeterminate = someSelected;
    selectAllCb.disabled = selectableKeys.length === 0 || customerEmailOpInProgress || isAppSaving();
  }
}

function setCustomerSelectAll(checked) {
  const selectableKeys = getFilteredSelectableCustomerKeys();
  if (checked) selectableKeys.forEach(key => customerSelectedKeys.add(key));
  else selectableKeys.forEach(key => customerSelectedKeys.delete(key));
  renderCustomersTable();
  updateCustomerRowCounter();
  updateCustomerSelectionUi();
}

function toggleCustomerSelection(customerKey, checked) {
  if (!customerKey) return;
  if (checked) customerSelectedKeys.add(customerKey);
  else customerSelectedKeys.delete(customerKey);
  updateCustomerRowCounter();
  updateCustomerSelectionUi();
}

function updateCustomerRowCounter() {
  const el = document.getElementById("customersRowCounter");
  if (!el) return;
  const total = filteredCustomers.length;
  const rowText = total === 1 ? "1 customer" : `${total} customers`;
  const selectableKeys = getFilteredSelectableCustomerKeys();
  const selectedCount = selectableKeys.filter(key => customerSelectedKeys.has(key)).length;
  el.textContent = selectedCount >= 1
    ? `${selectedCount} selected out of ${rowText}`
    : rowText;
}

function formatCustomerCell(col, row) {
  const val = row[col] ?? "";
  if (col === CUSTOMER_EMAIL_SENT_AT_FIELD) {
    return formatDateForDisplay(val);
  }
  if (isEmptyValue(val)) return EMPTY_DISPLAY;
  return String(val);
}

function renderCustomerSelectCell(td, row) {
  td.className = "readonly readonly-no-select customer-select-cell";
  const customerKey = getCustomerKey(row);
  const selectable = isCustomerSelectable(row);
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.className = "customer-select-checkbox";
  cb.checked = customerSelectedKeys.has(customerKey);
  cb.disabled = !selectable || customerEmailOpInProgress || isAppSaving();
  cb.setAttribute("aria-label", selectable ? `Select ${customerKey}` : "No email on file");
  cb.addEventListener("click", e => e.stopPropagation());
  cb.addEventListener("change", () => toggleCustomerSelection(customerKey, cb.checked));
  td.appendChild(cb);
}

function renderCustomerEmailSentCell(td, row) {
  td.className = "readonly customer-email-sent-cell";
  const sentAt = String(row[CUSTOMER_EMAIL_SENT_AT_FIELD] ?? "").trim();
  if (isEmptyValue(sentAt)) {
    setDisplayText(td, EMPTY_DISPLAY);
    return;
  }
  const badge = document.createElement("span");
  badge.className = "customer-email-sent-badge";
  badge.title = formatDateForDisplay(sentAt);
  badge.textContent = formatDateForDisplay(sentAt);
  td.appendChild(badge);
}

function renderCustomerSendCell(td, row) {
  td.className = "readonly customer-action-cell";
  const email = getCustomerEmail(row);
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-primary btn-sm customer-send-btn";
  btn.textContent = "Send";
  btn.disabled = !email || customerEmailOpInProgress || isAppSaving();
  btn.setAttribute("aria-label", email ? `Send email to ${row.Customer}` : "No email on file");
  btn.addEventListener("click", e => {
    e.stopPropagation();
    openCustomerEmailModal(row);
  });
  td.appendChild(btn);
}

function renderCustomersTable() {
  const tbody = document.getElementById("customersTableBody");
  if (!tbody) return;

  if (filteredCustomers.length === 0) {
    tbody.innerHTML = `<tr class="state-row"><td colspan="${CUSTOMER_TABLE_COLUMNS.length}">No customers yet. Import a Customer Master CSV to get started.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";
  filteredCustomers.forEach(row => {
    const tr = document.createElement("tr");
    tr.classList.add("customer-row");
    const customerKey = getCustomerKey(row);
    if (customerKey) tr.dataset.customerKey = customerKey;
    if (customerSelectedKeys.has(customerKey)) tr.classList.add("customer-row--selected");

    CUSTOMER_TABLE_COLUMNS.forEach(col => {
      const td = document.createElement("td");
      td.dataset.col = col;
      if (col === CUSTOMER_SELECT_COL) {
        renderCustomerSelectCell(td, row);
      } else if (col === CUSTOMER_ACTION_COL) {
        renderCustomerSendCell(td, row);
      } else if (col === CUSTOMER_EMAIL_SENT_AT_FIELD) {
        renderCustomerEmailSentCell(td, row);
      } else {
        setDisplayText(td, formatCustomerCell(col, row));
      }
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}

function updateLocalCustomerEmailSent(customerKey, sentAt) {
  if (!customerKey || !sentAt) return;
  const apply = row => {
    if (getCustomerKey(row) === customerKey) {
      row[CUSTOMER_EMAIL_SENT_AT_FIELD] = sentAt;
    }
  };
  allCustomers.forEach(apply);
  filteredCustomers.forEach(apply);
}

function setCustomerEmailModalFields({ title, to, toReadonly, subject, body, sendLabel }) {
  const titleEl = document.getElementById("customerEmailModalTitle");
  const toEl = document.getElementById("customerEmailTo");
  const toField = document.getElementById("customerEmailToField");
  const subjectEl = document.getElementById("customerEmailSubject");
  const bodyEl = document.getElementById("customerEmailBody");
  const sendBtn = document.getElementById("customerEmailSendBtn");
  if (titleEl) titleEl.textContent = title;
  if (toEl) toEl.value = to ?? "";
  if (toField) toField.hidden = false;
  if (subjectEl) subjectEl.value = subject ?? "";
  if (bodyEl) bodyEl.value = body ?? "";
  if (sendBtn) sendBtn.textContent = sendLabel ?? "Send";
}

function openCustomerEmailModal(row) {
  const email = getCustomerEmail(row);
  if (!email) return;

  customerEmailMode = "single";
  customerEmailTarget = row;
  const overlay = document.getElementById("customerEmailOverlay");
  if (!overlay) return;

  const customerName = getCustomerKey(row);
  setCustomerEmailModalFields({
    title: "EMAIL CUSTOMER",
    to: email,
    toReadonly: true,
    subject: applyCustomerEmailTemplate(CUSTOMER_EMAIL_SUBJECT_TEMPLATE, customerName),
    body: applyCustomerEmailTemplate(CUSTOMER_EMAIL_BODY_TEMPLATE, customerName),
    sendLabel: "Send",
  });
  overlay.classList.add("open");
  document.getElementById("customerEmailSubject")?.focus();
}

function openCustomerBatchEmailModal() {
  const selectedNames = getSelectedCustomerKeysForBatch();
  if (selectedNames.length < 2) return;

  customerEmailMode = "batch";
  customerEmailTarget = null;
  const overlay = document.getElementById("customerEmailOverlay");
  if (!overlay) return;

  setCustomerEmailModalFields({
    title: "BATCH EMAIL",
    to: selectedNames.join(", "),
    toReadonly: true,
    subject: CUSTOMER_EMAIL_SUBJECT_TEMPLATE,
    body: CUSTOMER_EMAIL_BODY_TEMPLATE,
    sendLabel: `Send ${selectedNames.length} emails`,
  });
  overlay.classList.add("open");
  document.getElementById("customerEmailSubject")?.focus();
}

function closeCustomerEmailModal() {
  document.getElementById("customerEmailOverlay")?.classList.remove("open");
  customerEmailTarget = null;
  customerEmailMode = "single";
}

function getSelectedCustomerKeysForBatch() {
  return getFilteredSelectableCustomerKeys().filter(key => customerSelectedKeys.has(key));
}

async function submitCustomerEmail() {
  if (customerEmailOpInProgress || isAppSaving()) return;

  const subject = String(document.getElementById("customerEmailSubject")?.value ?? "").trim();
  const body = String(document.getElementById("customerEmailBody")?.value ?? "").trim();

  if (!subject) {
    showIndicator("Subject is required", "error");
    return;
  }
  if (!body) {
    showIndicator("Message body is required", "error");
    return;
  }

  if (isDemoMode()) {
    showIndicator("Email send is not available in demo mode", "error");
    return;
  }

  customerEmailOpInProgress = true;
  renderCustomersTable();
  updateCustomerSelectionUi();

  if (customerEmailMode === "batch") {
    await submitCustomerBatchEmail(subject, body);
    return;
  }

  const to = String(document.getElementById("customerEmailTo")?.value ?? "").trim();
  const customerKey = getCustomerKey(customerEmailTarget);

  if (!to) {
    showIndicator("Recipient email is required", "error");
    customerEmailOpInProgress = false;
    renderCustomersTable();
    updateCustomerSelectionUi();
    return;
  }

  setAppSaving(true, "Sending email…");

  try {
    const json = await postAppsScript({
      action: "sendCustomerEmail",
      to,
      subject,
      body,
      customer: customerKey,
    });
    if (!json.success) throw new Error(json.error || "Send failed");
    if (json.sentAt) updateLocalCustomerEmailSent(customerKey, json.sentAt);
    closeCustomerEmailModal();
    showIndicator("Email sent", "success");
  } catch (err) {
    showIndicator("Send failed: " + err.message, "error");
  } finally {
    customerEmailOpInProgress = false;
    setAppSaving(false);
    renderCustomersTable();
    updateCustomerSelectionUi();
  }
}

async function submitCustomerBatchEmail(subject, body) {
  const customerKeys = getSelectedCustomerKeysForBatch();
  if (customerKeys.length < 2) {
    customerEmailOpInProgress = false;
    renderCustomersTable();
    updateCustomerSelectionUi();
    return;
  }

  setAppSaving(true, `Sending ${customerKeys.length} emails${ELLIPSIS}`);

  try {
    const json = await postAppsScript({
      action: "batchSendCustomerEmail",
      customers: customerKeys,
      subject,
      body,
    });
    if (!json.success) throw new Error(json.error || "Batch send failed");

    const sentAtByCustomer = json.sentAtByCustomer ?? {};
    (json.sentCustomers ?? []).forEach(customerKey => {
      updateLocalCustomerEmailSent(customerKey, sentAtByCustomer[customerKey] || formatDateToYmd(new Date()));
    });

    customerSelectedKeys = new Set(
      [...customerSelectedKeys].filter(key => !(json.sentCustomers ?? []).includes(key))
    );
    closeCustomerEmailModal();

    const errorCount = Array.isArray(json.errors) ? json.errors.length : 0;
    const sentCount = json.sent || (json.sentCustomers ?? []).length;
    if (errorCount > 0) {
      showIndicator(`Sent ${sentCount} email${sentCount === 1 ? "" : "s"}, ${errorCount} failed`, "error");
    } else {
      showIndicator(`Sent ${sentCount} email${sentCount === 1 ? "" : "s"}`, "success");
    }
  } catch (err) {
    showIndicator("Batch send failed: " + err.message, "error");
  } finally {
    customerEmailOpInProgress = false;
    setAppSaving(false);
    renderCustomersTable();
    updateCustomerRowCounter();
    updateCustomerSelectionUi();
  }
}

function initCustomers() {
  document.getElementById("customersSearchInput")?.addEventListener("input", applyCustomerFilters);
  document.getElementById("customersSelectAllCheckbox")?.addEventListener("click", e => {
    e.stopPropagation();
    setCustomerSelectAll(e.target.checked);
  });
  document.getElementById("customersBatchEmailBtn")?.addEventListener("click", openCustomerBatchEmailModal);
  document.getElementById("customerEmailSendBtn")?.addEventListener("click", submitCustomerEmail);
  document.getElementById("customerEmailCancelBtn")?.addEventListener("click", closeCustomerEmailModal);
  document.getElementById("customerEmailCloseBtn")?.addEventListener("click", closeCustomerEmailModal);

  const overlay = document.getElementById("customerEmailOverlay");
  bindDirectBackdropDismiss(overlay, closeCustomerEmailModal);
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && overlay?.classList.contains("open")) closeCustomerEmailModal();
  });
}

initCustomers();
