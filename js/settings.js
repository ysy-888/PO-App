/** Settings modal: General preferences and vendor portal links. */

let settingsSectionId = "general";
const ASN_DEFAULT_EMAIL_STORAGE_BASE = "asnDefaultEmailAddresses";
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
  const isPoEdit = sectionId === "edit-table";
  const isSoEdit = sectionId === "edit-so-table";
  if (editTableFooter) editTableFooter.hidden = !isPoEdit && !isSoEdit;
  const editOk = document.getElementById("editTableOk");
  const editCancel = document.getElementById("editTableCancel");
  const soOk = document.getElementById("soEditTableOk");
  const soCancel = document.getElementById("soEditTableCancel");
  if (editOk) editOk.hidden = !isPoEdit;
  if (editCancel) editCancel.hidden = !isPoEdit;
  if (soOk) soOk.hidden = !isSoEdit;
  if (soCancel) soCancel.hidden = !isSoEdit;
  if (sectionId === "edit-table" && typeof prepareEditTableDraft === "function") prepareEditTableDraft();
  if (sectionId === "edit-so-table" && typeof prepareSoEditTableDraft === "function") prepareSoEditTableDraft();
}

function openSettingsModal(sectionId = "general") {
  if (typeof closeHeaderMenu === "function") closeHeaderMenu();
  selectSettingsSection(sectionId);
  updateSettingsUi();
  const overlay = document.getElementById("settingsOverlay");
  if (!overlay) return;
  overlay.classList.add("open");
  overlay.setAttribute("aria-hidden", "false");
  if (typeof bringModalToFront === "function") bringModalToFront(overlay);
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

  document.getElementById("settingsCloseBtn")?.addEventListener("click", closeSettingsModal);

  document.querySelectorAll(".settings-nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      selectSettingsSection(btn.dataset.settingsSection || "general");
    });
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
