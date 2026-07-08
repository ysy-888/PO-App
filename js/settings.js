/** Settings modal: General preferences and vendor portal links. */

let settingsSectionId = "general";
const ASN_DEFAULT_EMAIL_STORAGE_BASE = "asnDefaultEmailAddresses";
const ASN_CARRIERS_STORAGE_KEY = "asnCarriers";
const ASN_DEFAULT_CARRIER_STORAGE_KEY = "asnDefaultCarrierByBuyer";
const ASN_DEFAULT_EMAIL_BUYERS = [
  {
    key: "lulusFashionLounge",
    name: "Lulu's Fashion Lounge",
    aliases: ["lulu's fashion lounge", "lulus fashion lounge", "lulus"],
  },
  {
    key: "12thTribe",
    name: "12th Tribe",
    aliases: ["12th tribe"],
  },
];
let asnDefaultEmailAddresses = normalizeAsnDefaultEmailAddresses();

function createEmptyAsnDefaultEmailAddresses() {
  return ASN_DEFAULT_EMAIL_BUYERS.reduce((acc, buyer) => {
    acc[buyer.key] = { email: "", cc: "" };
    return acc;
  }, {});
}

function normalizeAsnDefaultEmailAddresses(value = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const normalized = createEmptyAsnDefaultEmailAddresses();
  ASN_DEFAULT_EMAIL_BUYERS.forEach(buyer => {
    const entry = source[buyer.key] && typeof source[buyer.key] === "object" ? source[buyer.key] : {};
    normalized[buyer.key] = {
      email: String(entry.email ?? "").trim(),
      cc: String(entry.cc ?? "").trim(),
    };
  });
  return normalized;
}

function loadAsnDefaultEmailAddressesPreference() {
  try {
    const raw = localStorage.getItem(scopedStorageKey(ASN_DEFAULT_EMAIL_STORAGE_BASE));
    applyAsnDefaultEmailAddressesPreference(raw ? JSON.parse(raw) : {});
  } catch {
    applyAsnDefaultEmailAddressesPreference();
  }
}

function applyAsnDefaultEmailAddressesPreference(value = {}) {
  asnDefaultEmailAddresses = normalizeAsnDefaultEmailAddresses(value);
  updateSettingsAsnDefaultEmailsUi();
  return getAsnDefaultEmailAddresses();
}

function saveAsnDefaultEmailAddressesPreference() {
  const payload = getAsnDefaultEmailAddresses();
  try {
    localStorage.setItem(scopedStorageKey(ASN_DEFAULT_EMAIL_STORAGE_BASE), JSON.stringify(payload));
  } catch {
    /* ignore storage failures */
  }
  if (typeof persistUserPreferencePatch === "function") {
    persistUserPreferencePatch({ asnDefaultEmailAddresses: payload });
  }
}

function getAsnDefaultEmailAddresses() {
  return normalizeAsnDefaultEmailAddresses(asnDefaultEmailAddresses);
}

function normalizeAsnBuyerName(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\u2019/g, "'")
    .replace(/\s+/g, " ");
}

function getAsnDefaultEmailAddressForBuyer(buyerName) {
  const buyerKey = normalizeAsnBuyerName(buyerName);
  if (!buyerKey) return { email: "", cc: "" };

  const match = ASN_DEFAULT_EMAIL_BUYERS.find(buyer => {
    const names = [buyer.name, ...buyer.aliases].map(normalizeAsnBuyerName);
    return names.includes(buyerKey);
  });
  if (!match) return { email: "", cc: "" };

  return { ...getAsnDefaultEmailAddresses()[match.key] };
}

function updateSettingsAsnDefaultEmailsUi() {
  const values = getAsnDefaultEmailAddresses();
  document.querySelectorAll("[data-asn-default-email-buyer]").forEach(row => {
    const key = row.dataset.asnDefaultEmailBuyer;
    const entry = values[key] ?? { email: "", cc: "" };
    row.querySelectorAll("[data-asn-default-email-field]").forEach(input => {
      const field = input.dataset.asnDefaultEmailField;
      input.value = entry[field] ?? "";
    });
  });
}

function initSettingsAsnDefaultEmails() {
  document.querySelectorAll("[data-asn-default-email-buyer]").forEach(row => {
    const key = row.dataset.asnDefaultEmailBuyer;
    row.querySelectorAll("[data-asn-default-email-field]").forEach(input => {
      input.addEventListener("change", () => {
        const field = input.dataset.asnDefaultEmailField;
        if (field !== "email" && field !== "cc") return;
        const next = getAsnDefaultEmailAddresses();
        if (!next[key]) return;
        next[key][field] = String(input.value ?? "").trim();
        applyAsnDefaultEmailAddressesPreference(next);
        saveAsnDefaultEmailAddressesPreference();
      });
    });
  });
}

// ── Carrier management ────────────────────────────────────────────────────────

let asnCarriers = [];
let asnDefaultCarrierByBuyer = {};

function getAsnCarriers() {
  return [...asnCarriers];
}

function getAsnDefaultCarrierForBuyer(buyerName) {
  const key = normalizeAsnBuyerName(buyerName);
  if (!key) return null;
  const match = ASN_DEFAULT_EMAIL_BUYERS.find(buyer => {
    const names = [buyer.name, ...buyer.aliases].map(normalizeAsnBuyerName);
    return names.includes(key);
  });
  if (!match) return null;
  const carrierName = asnDefaultCarrierByBuyer[match.key];
  if (!carrierName) return null;
  return asnCarriers.find(c => c.name === carrierName) ?? null;
}

function normalizeAsnCarriersArray(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(c => ({
      name: String(c?.name ?? "").trim(),
      email: String(c?.email ?? "").trim(),
      cc: String(c?.cc ?? "").trim(),
    }))
    .filter(c => c.name);
}

function loadAsnCarriersPreference() {
  try {
    const carriersRaw = localStorage.getItem(scopedStorageKey(ASN_CARRIERS_STORAGE_KEY));
    const defaultsRaw = localStorage.getItem(scopedStorageKey(ASN_DEFAULT_CARRIER_STORAGE_KEY));
    applyAsnCarriersPreference(
      carriersRaw ? JSON.parse(carriersRaw) : [],
      defaultsRaw ? JSON.parse(defaultsRaw) : {}
    );
  } catch {
    applyAsnCarriersPreference([], {});
  }
}

function applyAsnCarriersPreference(carriers, defaultsByBuyer) {
  asnCarriers = normalizeAsnCarriersArray(carriers);
  asnDefaultCarrierByBuyer = (defaultsByBuyer && typeof defaultsByBuyer === "object" && !Array.isArray(defaultsByBuyer))
    ? { ...defaultsByBuyer }
    : {};
  renderSettingsCarrierList();
  renderSettingsAsnDefaultCarrierList();
}

function saveAsnCarriersPreference() {
  try {
    localStorage.setItem(scopedStorageKey(ASN_CARRIERS_STORAGE_KEY), JSON.stringify(asnCarriers));
    localStorage.setItem(scopedStorageKey(ASN_DEFAULT_CARRIER_STORAGE_KEY), JSON.stringify(asnDefaultCarrierByBuyer));
  } catch { /* ignore */ }
  if (typeof persistUserPreferencePatch === "function") {
    persistUserPreferencePatch({ asnCarriers, asnDefaultCarrierByBuyer });
  }
}

// Carrier list rendering

let _carrierEditIndex = -1;

function renderSettingsCarrierList() {
  const container = document.getElementById("settingsCarrierList");
  if (!container) return;
  container.innerHTML = "";

  if (asnCarriers.length === 0 && _carrierEditIndex !== -2) {
    const empty = document.createElement("p");
    empty.className = "settings-hint";
    empty.textContent = "No carriers yet. Click + Add Carrier to create one.";
    container.appendChild(empty);
  }

  asnCarriers.forEach((carrier, idx) => {
    const row = document.createElement("div");
    row.className = "settings-carrier-row";

    if (_carrierEditIndex === idx) {
      // Editable row
      row.classList.add("settings-carrier-row--edit");
      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.className = "shipment-form-input settings-carrier-input";
      nameInput.placeholder = "Carrier name";
      nameInput.value = carrier.name;
      nameInput.dataset.field = "name";

      const emailInput = document.createElement("input");
      emailInput.type = "text";
      emailInput.className = "shipment-form-input settings-carrier-input";
      emailInput.placeholder = "Email";
      emailInput.value = carrier.email;
      emailInput.dataset.field = "email";

      const ccInput = document.createElement("input");
      ccInput.type = "text";
      ccInput.className = "shipment-form-input settings-carrier-input";
      ccInput.placeholder = "CC (optional)";
      ccInput.value = carrier.cc;
      ccInput.dataset.field = "cc";

      const saveBtn = document.createElement("button");
      saveBtn.type = "button";
      saveBtn.className = "btn btn-primary btn-sm settings-carrier-action-btn";
      saveBtn.textContent = "Save";
      saveBtn.addEventListener("click", () => {
        const name = nameInput.value.trim();
        if (!name) { nameInput.focus(); return; }
        asnCarriers[idx] = { name, email: emailInput.value.trim(), cc: ccInput.value.trim() };
        _carrierEditIndex = -1;
        saveAsnCarriersPreference();
        renderSettingsCarrierList();
        renderSettingsAsnDefaultCarrierList();
      });

      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "btn btn-sm settings-carrier-action-btn";
      cancelBtn.textContent = "Cancel";
      cancelBtn.addEventListener("click", () => {
        _carrierEditIndex = -1;
        renderSettingsCarrierList();
      });

      row.appendChild(nameInput);
      row.appendChild(emailInput);
      row.appendChild(ccInput);
      row.appendChild(saveBtn);
      row.appendChild(cancelBtn);
    } else {
      // Read-only row
      const nameEl = document.createElement("span");
      nameEl.className = "settings-carrier-name";
      nameEl.textContent = carrier.name;

      const emailEl = document.createElement("span");
      emailEl.className = "settings-carrier-email";
      emailEl.textContent = carrier.email || "—";

      const ccEl = document.createElement("span");
      ccEl.className = "settings-carrier-cc";
      ccEl.textContent = carrier.cc ? `CC: ${carrier.cc}` : "";

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "btn btn-sm settings-carrier-action-btn";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => {
        _carrierEditIndex = idx;
        renderSettingsCarrierList();
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "btn btn-sm btn-danger settings-carrier-action-btn";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", () => {
        if (!window.confirm(`Delete carrier "${carrier.name}"?`)) return;
        // Clear any defaults that reference this carrier
        Object.keys(asnDefaultCarrierByBuyer).forEach(key => {
          if (asnDefaultCarrierByBuyer[key] === carrier.name) delete asnDefaultCarrierByBuyer[key];
        });
        asnCarriers.splice(idx, 1);
        saveAsnCarriersPreference();
        renderSettingsCarrierList();
        renderSettingsAsnDefaultCarrierList();
      });

      const actions = document.createElement("div");
      actions.className = "settings-carrier-actions";
      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);

      row.appendChild(nameEl);
      row.appendChild(emailEl);
      row.appendChild(ccEl);
      row.appendChild(actions);
    }
    container.appendChild(row);
  });

  // New carrier form at bottom when adding
  if (_carrierEditIndex === -2) {
    const row = document.createElement("div");
    row.className = "settings-carrier-row settings-carrier-row--edit";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "shipment-form-input settings-carrier-input";
    nameInput.placeholder = "Carrier name";
    nameInput.dataset.field = "name";

    const emailInput = document.createElement("input");
    emailInput.type = "text";
    emailInput.className = "shipment-form-input settings-carrier-input";
    emailInput.placeholder = "Email";
    emailInput.dataset.field = "email";

    const ccInput = document.createElement("input");
    ccInput.type = "text";
    ccInput.className = "shipment-form-input settings-carrier-input";
    ccInput.placeholder = "CC (optional)";
    ccInput.dataset.field = "cc";

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "btn btn-primary btn-sm settings-carrier-action-btn";
    saveBtn.textContent = "Add";
    saveBtn.addEventListener("click", () => {
      const name = nameInput.value.trim();
      if (!name) { nameInput.focus(); return; }
      asnCarriers.push({ name, email: emailInput.value.trim(), cc: ccInput.value.trim() });
      _carrierEditIndex = -1;
      saveAsnCarriersPreference();
      renderSettingsCarrierList();
      renderSettingsAsnDefaultCarrierList();
    });

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn btn-sm settings-carrier-action-btn";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => {
      _carrierEditIndex = -1;
      renderSettingsCarrierList();
    });

    row.appendChild(nameInput);
    row.appendChild(emailInput);
    row.appendChild(ccInput);
    row.appendChild(saveBtn);
    row.appendChild(cancelBtn);
    container.appendChild(row);
    requestAnimationFrame(() => nameInput.focus());
  }
}

function renderSettingsAsnDefaultCarrierList() {
  const container = document.getElementById("settingsAsnDefaultCarrierList");
  if (!container) return;
  container.innerHTML = "";

  ASN_DEFAULT_EMAIL_BUYERS.forEach(buyer => {
    const row = document.createElement("div");
    row.className = "settings-asn-default-carrier-row";

    const label = document.createElement("div");
    label.className = "settings-asn-default-email-buyer";
    label.textContent = buyer.name;

    const selectWrap = document.createElement("label");
    selectWrap.className = "settings-email-field";

    const selectLabel = document.createElement("span");
    selectLabel.textContent = "Default Carrier";

    const select = document.createElement("select");
    select.className = "shipment-form-input filter-select settings-carrier-select";

    const blankOpt = document.createElement("option");
    blankOpt.value = "";
    blankOpt.textContent = "— None —";
    select.appendChild(blankOpt);

    asnCarriers.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.name;
      opt.textContent = c.name;
      if (asnDefaultCarrierByBuyer[buyer.key] === c.name) opt.selected = true;
      select.appendChild(opt);
    });

    select.addEventListener("change", () => {
      if (select.value) asnDefaultCarrierByBuyer[buyer.key] = select.value;
      else delete asnDefaultCarrierByBuyer[buyer.key];
      saveAsnCarriersPreference();
    });

    selectWrap.appendChild(selectLabel);
    selectWrap.appendChild(select);
    row.appendChild(label);
    row.appendChild(selectWrap);
    container.appendChild(row);
  });
}

function initSettingsCarriers() {
  document.getElementById("settingsCarrierAddBtn")?.addEventListener("click", () => {
    _carrierEditIndex = -2;
    renderSettingsCarrierList();
  });
}

// ─────────────────────────────────────────────────────────────────────────────

function getDistinctVendorsFromRows() {
  return [...new Set(
    (allRows ?? [])
      .map(r => String(r["Vendor"] ?? "").trim())
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

function updateSettingsCountdownUi() {
  const toggleBtn = document.getElementById("settingsCountdownToggle");
  if (toggleBtn) toggleBtn.setAttribute("aria-checked", cxlCountdownEnabled ? "true" : "false");
}

function updateSettingsSplitViewUi() {
  const toggleBtn = document.getElementById("settingsSplitViewToggle");
  const enabled = typeof isSplitViewEnabled === "function" ? isSplitViewEnabled() : true;
  if (toggleBtn) toggleBtn.setAttribute("aria-checked", enabled ? "true" : "false");
}

function updateSettingsDateFormatUi() {
  const select = document.getElementById("settingsDateFormatSelect");
  if (!select) return;
  const currentId = typeof getDateFormatId === "function" ? getDateFormatId() : DEFAULT_DATE_FORMAT_ID;
  select.value = currentId;
}

function updateSettingsUi() {
  updateSettingsCountdownUi();
  updateSettingsSplitViewUi();
  updateSettingsDateFormatUi();
  updateSettingsAsnDefaultEmailsUi();
  renderSettingsCarrierList();
  renderSettingsAsnDefaultCarrierList();
  if (typeof updateVendorSubmitModeCheck === "function") updateVendorSubmitModeCheck();
  if (typeof updateSettingsVendorSubmissionsVisibility === "function") {
    updateSettingsVendorSubmissionsVisibility();
  }
  if (typeof updateFeatureTogglesUi === "function") updateFeatureTogglesUi();
}

function initSettingsVendorSubmitMode() {
  document.querySelectorAll("#settingsVendorSubmitModeList [data-vendor-submit-mode]").forEach(item => {
    item.addEventListener("click", () => {
      if (typeof setVendorSubmitModeFromSettings === "function") {
        setVendorSubmitModeFromSettings(item.dataset.vendorSubmitMode);
      }
    });
  });
}

function buildSettingsDateFormatSelect() {
  const select = document.getElementById("settingsDateFormatSelect");
  if (!select || typeof DATE_FORMAT_OPTIONS === "undefined") return;

  select.innerHTML = DATE_FORMAT_OPTIONS.map(opt => (
    `<option value="${escapeHtml(opt.id)}">${escapeHtml(opt.label)}</option>`
  )).join("");

  select.addEventListener("change", () => {
    if (typeof setDateFormat === "function") setDateFormat(select.value);
    updateSettingsDateFormatUi();
  });

  updateSettingsDateFormatUi();
}

function getEditTableTarget() {
  const select = document.getElementById("editTableTargetSelect");
  return select?.value ?? "po";
}

function prepareCurrentEditTableTarget() {
  const target = getEditTableTarget();
  if (target === "po" && typeof prepareEditTableDraft === "function") prepareEditTableDraft();
  else if (target === "so" && typeof prepareSoEditTableDraft === "function") prepareSoEditTableDraft();
  else if (target === "inv" && typeof prepareInvoiceEditTableDraft === "function") prepareInvoiceEditTableDraft();
}

function syncEditTableGroupVisibility() {
  const target = getEditTableTarget();
  const groupPo = document.getElementById("editTableGroupPo");
  const groupSo = document.getElementById("editTableGroupSo");
  const groupInv = document.getElementById("editTableGroupInv");
  if (groupPo) groupPo.hidden = target !== "po";
  if (groupSo) groupSo.hidden = target !== "so";
  if (groupInv) groupInv.hidden = target !== "inv";
}

function selectSettingsSection(sectionId) {
  settingsSectionId = sectionId;
  document.querySelectorAll(".settings-nav-item").forEach(btn => {
    const active = btn.dataset.settingsSection === sectionId;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-current", active ? "page" : "false");
  });
  document.querySelectorAll(".settings-section").forEach(panel => {
    panel.hidden = panel.dataset.settingsSection !== sectionId;
  });
  const editTableFooter = document.getElementById("settingsEditTableFooter");
  const isEdit = sectionId === "edit-table";
  if (editTableFooter) editTableFooter.hidden = !isEdit;
  if (isEdit) {
    syncEditTableGroupVisibility();
    prepareCurrentEditTableTarget();
  }
}

function openSettingsModal(sectionId = "general") {
  if (typeof isPortalMode === "function" && isPortalMode()) return;
  if (typeof closeHeaderMenu === "function") closeHeaderMenu();
  selectSettingsSection(sectionId);
  updateSettingsUi();
  loadSettingsUsers();
  const overlay = document.getElementById("settingsOverlay");
  if (!overlay) return;
  overlay.classList.add("open");
  overlay.setAttribute("aria-hidden", "false");
  if (typeof bringModalToFront === "function") bringModalToFront(overlay);
}

// ── User display names ────────────────────────────────────────────────────────

let settingsUsers = [];

async function loadSettingsUsers() {
  const list = document.getElementById("settingsUsersList");
  if (!list) return;
  list.innerHTML = `<p class="settings-users-status">Loading…</p>`;
  try {
    const json = await getApi("/api/settings/users");
    if (!json.success) throw new Error(json.error || "Failed to load users.");
    settingsUsers = Array.isArray(json.users) ? json.users : [];
    renderSettingsUsersList();
  } catch (err) {
    list.innerHTML = "";
    const p = document.createElement("p");
    p.className = "settings-users-status is-error";
    p.textContent = "Could not load users: " + err.message;
    list.appendChild(p);
  }
}

function renderSettingsUsersList() {
  const list = document.getElementById("settingsUsersList");
  if (!list) return;
  list.innerHTML = "";
  if (settingsUsers.length === 0) {
    const p = document.createElement("p");
    p.className = "settings-users-status";
    p.textContent = "No users found.";
    list.appendChild(p);
    return;
  }

  settingsUsers.forEach(user => {
    const row = document.createElement("div");
    row.className = "settings-user-row";

    const info = document.createElement("div");
    info.className = "settings-user-info";
    const emailEl = document.createElement("span");
    emailEl.className = "settings-user-email";
    emailEl.textContent = user.email || "(no email)";
    info.appendChild(emailEl);
    if (user.role) {
      const roleEl = document.createElement("span");
      roleEl.className = "settings-user-role";
      roleEl.textContent = user.role;
      info.appendChild(roleEl);
    }

    const field = document.createElement("div");
    field.className = "settings-user-field";
    const input = document.createElement("input");
    input.type = "text";
    input.className = "shipment-form-input settings-user-name-input";
    input.placeholder = "Display name";
    input.value = user.displayName || "";
    input.maxLength = 120;
    const status = document.createElement("span");
    status.className = "settings-user-save-status";

    const save = async () => {
      const displayName = input.value.trim();
      if (displayName === (user.displayName || "")) return;
      status.textContent = "Saving…";
      status.className = "settings-user-save-status";
      input.disabled = true;
      try {
        const json = await postApi("/api/settings/user-display-name", { userId: user.id, displayName });
        if (!json.success) throw new Error(json.error || "Save failed.");
        user.displayName = displayName;
        // Reflect the change in the live comment directory immediately.
        if (typeof getTenantUsersById === "function") {
          const dir = getTenantUsersById();
          if (dir[user.id]) dir[user.id].displayName = displayName;
        }
        status.textContent = "Saved";
        status.className = "settings-user-save-status is-saved";
        setTimeout(() => { status.textContent = ""; }, 2000);
      } catch (err) {
        status.textContent = err.message || "Error";
        status.className = "settings-user-save-status is-error";
      } finally {
        input.disabled = false;
      }
    };

    input.addEventListener("blur", save);
    input.addEventListener("keydown", e => { if (e.key === "Enter") input.blur(); });

    field.appendChild(input);
    field.appendChild(status);
    row.appendChild(info);
    row.appendChild(field);
    list.appendChild(row);
  });
}

function closeSettingsModal() {
  const overlay = document.getElementById("settingsOverlay");
  if (!overlay) return;
  overlay.classList.remove("open");
  overlay.setAttribute("aria-hidden", "true");
}

function initSettings() {
  buildSettingsDateFormatSelect();
  initSettingsVendorSubmitMode();
  initSettingsAsnDefaultEmails();
  loadAsnCarriersPreference();
  initSettingsCarriers();

  document.getElementById("settingsCloseBtn")?.addEventListener("click", closeSettingsModal);

  document.querySelectorAll(".settings-nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      selectSettingsSection(btn.dataset.settingsSection || "general");
    });
  });

  document.getElementById("editTableTargetSelect")?.addEventListener("change", () => {
    syncEditTableGroupVisibility();
    prepareCurrentEditTableTarget();
  });

  document.getElementById("editTableOk")?.addEventListener("click", () => {
    const target = getEditTableTarget();
    if (target === "po" && typeof applyEditTableFromPopover === "function") {
      applyEditTableFromPopover();
    } else if (target === "so" && typeof applySoEditTableFromPopover === "function") {
      applySoEditTableFromPopover();
    } else if (target === "inv" && typeof applyInvoiceEditTableFromPopover === "function") {
      applyInvoiceEditTableFromPopover();
    }
    closeSettingsModal();
  });

  document.getElementById("editTableCancel")?.addEventListener("click", () => {
    const target = getEditTableTarget();
    if (target === "po" && typeof cancelEditTableFromPopover === "function") {
      cancelEditTableFromPopover();
    } else if (target === "so" && typeof cancelSoEditTableFromPopover === "function") {
      cancelSoEditTableFromPopover();
    } else if (target === "inv" && typeof cancelInvoiceEditTableFromPopover === "function") {
      cancelInvoiceEditTableFromPopover();
    }
    closeSettingsModal();
  });

  // Shared "Save as default" / "Reset to default" — dispatch to the active target.
  document.getElementById("editTableSaveDefault")?.addEventListener("click", () => {
    const target = getEditTableTarget();
    if (target === "po" && typeof saveDefaultColumnVisibility === "function") saveDefaultColumnVisibility();
    else if (target === "so" && typeof saveSoEditTableDefault === "function") saveSoEditTableDefault();
    else if (target === "inv" && typeof saveInvEditTableDefault === "function") saveInvEditTableDefault();
  });
  document.getElementById("editTableResetDefault")?.addEventListener("click", () => {
    const target = getEditTableTarget();
    if (target === "po" && typeof resetEditTableToDefault === "function") resetEditTableToDefault();
    else if (target === "so" && typeof resetSoEditTableToDefault === "function") resetSoEditTableToDefault();
    else if (target === "inv" && typeof resetInvEditTableToDefault === "function") resetInvEditTableToDefault();
  });

  document.getElementById("invEditTableSelectAll")?.addEventListener("click", () => {
    if (typeof setInvEditTableDraftSelectAll === "function") setInvEditTableDraftSelectAll(true);
  });
  document.getElementById("invEditTableClearAll")?.addEventListener("click", () => {
    if (typeof setInvEditTableDraftSelectAll === "function") setInvEditTableDraftSelectAll(false);
  });

  document.getElementById("settingsCountdownToggle")?.addEventListener("click", () => {
    if (typeof toggleCxlCountdown === "function") toggleCxlCountdown();
  });

  document.getElementById("settingsSplitViewToggle")?.addEventListener("click", () => {
    if (typeof toggleSplitView === "function") toggleSplitView();
  });

  const overlay = document.getElementById("settingsOverlay");
  bindDirectBackdropDismiss(overlay, closeSettingsModal);

  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (!overlay?.classList.contains("open")) return;
    e.preventDefault();
    closeSettingsModal();
  });

  updateSettingsUi();
}
