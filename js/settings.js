/** Settings modal: General preferences and vendor portal links. */

let settingsSectionId = "general";
const vendorPortalLinkCache = new Map();

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

function updateSettingsDateFormatUi() {
  const select = document.getElementById("settingsDateFormatSelect");
  if (!select) return;
  const currentId = typeof getDateFormatId === "function" ? getDateFormatId() : DEFAULT_DATE_FORMAT_ID;
  select.value = currentId;
}

function updateSettingsUi() {
  updateSettingsCountdownUi();
  updateSettingsDateFormatUi();
  if (typeof updateVendorSubmitModeCheck === "function") updateVendorSubmitModeCheck();
  if (typeof updateSettingsVendorSubmissionsVisibility === "function") {
    updateSettingsVendorSubmissionsVisibility();
  }
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
  if (editTableFooter) editTableFooter.hidden = sectionId !== "edit-table";
  if (sectionId === "edit-table" && typeof prepareEditTableDraft === "function") prepareEditTableDraft();
  if (sectionId === "vendor-portal") renderVendorPortalLinksList();
}

function renderVendorPortalLinksList() {
  const list = document.getElementById("settingsVendorLinksList");
  if (!list) return;

  if (isDemoMode()) {
    list.innerHTML = '<p class="settings-empty">Vendor links are not available in demo mode.</p>';
    return;
  }

  const vendors = getDistinctVendorsFromRows();
  if (vendors.length === 0) {
    list.innerHTML = '<p class="settings-empty">No vendors found. Refresh PO data to load vendors from your sheet.</p>';
    return;
  }

  list.innerHTML = vendors.map(vendor => {
    const cachedUrl = vendorPortalLinkCache.get(vendor) ?? "";
    const hasUrl = Boolean(cachedUrl);
    return (
      `<div class="settings-vendor-row" data-vendor="${escapeHtml(vendor)}">` +
      `<div class="settings-vendor-row-main">` +
      `<span class="settings-vendor-name">${escapeHtml(vendor)}</span>` +
      `<div class="settings-vendor-actions">` +
      `<button type="button" class="btn btn-secondary settings-vendor-generate-btn">Generate link</button>` +
      `<button type="button" class="btn btn-secondary settings-vendor-copy-btn"${hasUrl ? "" : " hidden"}>Copy link</button>` +
      `</div>` +
      `</div>` +
      `<input type="text" class="settings-vendor-url" readonly${hasUrl ? "" : " hidden"} value="${escapeHtml(cachedUrl)}" aria-label="Portal link for ${escapeHtml(vendor)}" />` +
      `</div>`
    );
  }).join("");

  list.querySelectorAll(".settings-vendor-row").forEach(row => {
    const vendor = row.dataset.vendor;
    row.querySelector(".settings-vendor-generate-btn")?.addEventListener("click", () => {
      generateVendorPortalLinkForVendor(vendor, row);
    });
    row.querySelector(".settings-vendor-copy-btn")?.addEventListener("click", () => {
      copyVendorPortalLink(row, vendor);
    });
  });
}

async function copyVendorPortalLink(row, vendor) {
  const input = row.querySelector(".settings-vendor-url");
  const url = String(input?.value ?? vendorPortalLinkCache.get(vendor) ?? "").trim();
  if (!url) {
    showIndicator("Generate a link first", "error");
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    showIndicator(`Link copied for ${vendor} ${CHECK_MARK}`, "success");
  } catch {
    input?.focus();
    input?.select();
    showIndicator("Copy the link from the field below", "");
  }
}

function showVendorLinkInRow(row, vendor, url) {
  vendorPortalLinkCache.set(vendor, url);
  const input = row.querySelector(".settings-vendor-url");
  const copyBtn = row.querySelector(".settings-vendor-copy-btn");
  if (input) {
    input.value = url;
    input.hidden = false;
  }
  if (copyBtn) copyBtn.hidden = false;
}

async function generateVendorPortalLinkForVendor(vendor, row) {
  if (isDemoMode()) {
    showIndicator("Vendor links are not available in demo mode", "error");
    return;
  }

  const generateBtn = row.querySelector(".settings-vendor-generate-btn");
  if (generateBtn) {
    generateBtn.disabled = true;
    generateBtn.textContent = `Generating${ELLIPSIS}`;
  }

  showIndicator(`Generating link for ${vendor}${ELLIPSIS}`, "");
  try {
    const json = await postAppsScript({ action: "createVendorPortalLink", vendor, webAppUrl: getAppsScriptUrl() });
    if (!json.success) throw new Error(json.error);
    const url = json.url;
    showVendorLinkInRow(row, vendor, url);
    try {
      await navigator.clipboard.writeText(url);
      showIndicator(`Link copied for ${json.vendor} ${CHECK_MARK}`, "success");
    } catch {
      showIndicator(`Link generated for ${json.vendor} ${CHECK_MARK}`, "success");
    }
  } catch (err) {
    showIndicator("Failed to generate link: " + err.message, "error");
  } finally {
    if (generateBtn) {
      generateBtn.disabled = false;
      generateBtn.textContent = "Generate link";
    }
  }
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

  document.getElementById("settingsCloseBtn")?.addEventListener("click", closeSettingsModal);

  document.querySelectorAll(".settings-nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      selectSettingsSection(btn.dataset.settingsSection || "general");
    });
  });

  document.getElementById("settingsCountdownToggle")?.addEventListener("click", () => {
    if (typeof toggleCxlCountdown === "function") toggleCxlCountdown();
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
