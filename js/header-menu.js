const CXL_COUNTDOWN_STORAGE_BASE = "cxlCountdown";
const PAGE_SIZE_STORAGE_BASE = "pageSize";
const DEFAULT_PAGE_SIZE = "60";

/** Escape a value for safe interpolation into innerHTML strings. */
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const EMPTY_DISPLAY = "\u2014";
const EN_DASH = "\u2013";
const ELLIPSIS = "\u2026";
const CHECK_MARK = "\u2713";
const CHARGEBACK_ID_FIELD = "Chargeback ID";
const PACKING_LIST_ID_FIELD = "Packing List ID";
const CHARGEBACK_STATUSES = ["Open", "Approved", "Deducted", "Disputed"];
const CHARGEBACK_REASONS = [
  "Delayed",
  "Damaged",
  "Shortage",
  "Overage",
  "Wrong Packing",
  "Wrong Ticketing/Labeling",
  "No Packing List",
  "Wrong Packing List Info",
  "Other",
];

let cxlCountdownEnabled = false;

function loadCxlCountdownPreference() {
  try {
    cxlCountdownEnabled = localStorage.getItem(scopedStorageKey(CXL_COUNTDOWN_STORAGE_BASE)) === "1";
  } catch {
    cxlCountdownEnabled = false;
  }
}

function saveCxlCountdownPreference() {
  try {
    localStorage.setItem(scopedStorageKey(CXL_COUNTDOWN_STORAGE_BASE), cxlCountdownEnabled ? "1" : "0");
  } catch {
    /* ignore storage failures */
  }
}

function updateHeaderMenuCountdownCheck() {
  const check = document.getElementById("headerMenuCountdownCheck");
  const toggleBtn = document.getElementById("headerMenuToggleCountdown");
  if (check) check.hidden = !cxlCountdownEnabled;
  if (toggleBtn) toggleBtn.setAttribute("aria-checked", cxlCountdownEnabled ? "true" : "false");
}

function setCxlCountdownEnabled(enabled) {
  cxlCountdownEnabled = enabled;
  saveCxlCountdownPreference();
  updateHeaderMenuCountdownCheck();
  renderTable();
  updateModalIfOpen();
}

function toggleCxlCountdown() {
  setCxlCountdownEnabled(!cxlCountdownEnabled);
}

function isPoTableViewActive() {
  const wrap = document.getElementById("poTableWrap");
  return Boolean(wrap && !wrap.hidden);
}

function isPaginationKeyboardEnabled() {
  if (!isPoTableViewActive()) return false;
  if (isPageSizeAll()) return false;
  if (filteredRows.length <= pageSize) return false;
  return true;
}

function initPaginationKeyboard() {
  document.addEventListener("keydown", e => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    if (isTypingInField(e.target)) return;
    if (document.querySelector(".modal-backdrop.open")) return;
    if (typeof openCellSelect !== "undefined" && openCellSelect) return;
    if (!isPaginationKeyboardEnabled()) return;

    e.preventDefault();
    if (e.key === "ArrowLeft") goToPage(currentPage - 1);
    else goToPage(currentPage + 1);
  });
}

function focusPoSearch() {
  const input = document.getElementById("searchInput");
  if (!input) return;
  input.focus();
  input.select();
}

function updateSearchInputState(input) {
  if (!input) return;
  const hasText = input.value.trim().length > 0;
  const showFilled = hasText && document.activeElement !== input;
  input.classList.toggle("has-value", showFilled);
}

function initSearchInput() {
  const input = document.getElementById("searchInput");
  if (!input) return;
  input.addEventListener("focus", () => input.classList.remove("has-value"));
  input.addEventListener("blur", () => updateSearchInputState(input));
  updateSearchInputState(input);
  input.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    input.blur();
  });
}

function initToolbarKeyboard() {
  document.addEventListener("keydown", e => {
    if (!isPoTableViewActive()) return;
    if (document.querySelector(".modal-backdrop.open")) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === " " || e.code === "Space") {
      if (isTypingInField(e.target)) return;
      if (miniSelectedIndices.size > 0) return;
      e.preventDefault();
      focusPoSearch();
      return;
    }

    if (isTypingInField(e.target)) return;

    const key = e.key.toLowerCase();
    if (key === "a") {
      e.preventDefault();
      setDivisionFilter("");
    } else if (key === "e") {
      e.preventDefault();
      setDivisionFilter("Elevator Disco");
    } else if (key === "f") {
      e.preventDefault();
      setDivisionFilter("Freesia");
    }
  });
}

function updateHeaderMenuChecks() {
  updateHeaderMenuCountdownCheck();
  updateAppModeMenuLabel();
  updateTestModeBanner();
  updatePublishMenuItemVisibility();
}

function updatePublishMenuItemVisibility() {
  const btn = document.getElementById("headerMenuPublishToProduction");
  if (btn) btn.hidden = !isTestMode();
}

function updateAppModeMenuLabel() {
  const label = document.getElementById("headerMenuAppModeLabel");
  if (!label) return;
  label.textContent = isTestMode() ? "Live Mode" : "Test Mode";
}

function updateTestModeBanner() {
  const banner = document.getElementById("testModeBanner");
  const active = isTestMode();
  if (banner) banner.hidden = !active;
  document.body.classList.toggle("test-mode-active", active);
}

function toggleAppMode() {
  if (typeof isAppSaving === "function" && isAppSaving()) return;

  if (!isTestMode()) {
    if (!isTestUrlConfigured()) {
      showIndicator("Test server URL not configured in js/config.js", "error");
      return;
    }
    if (!confirm("Switch to Test Mode? You will leave production data and use the test database.")) {
      return;
    }
  } else if (!confirm("Switch to Live Mode? You will return to production data.")) {
    return;
  }

  closeHeaderMenu();
  try {
    localStorage.setItem(APP_MODE_STORAGE_KEY, isTestMode() ? "live" : "test");
  } catch {
    showIndicator("Could not save mode preference", "error");
    return;
  }
  location.reload();
}

function openPublishToProductionModal() {
  closeHeaderMenu();
  document.getElementById("publishToProductionOverlay")?.classList.add("open");
}

function closePublishToProductionModal() {
  document.getElementById("publishToProductionOverlay")?.classList.remove("open");
}

function initPublishToProductionModal() {
  const overlay = document.getElementById("publishToProductionOverlay");
  const closeBtn = document.getElementById("publishToProductionCloseBtn");
  const okBtn = document.getElementById("publishToProductionOkBtn");
  if (!overlay) return;

  const dismiss = () => closePublishToProductionModal();
  closeBtn?.addEventListener("click", dismiss);
  okBtn?.addEventListener("click", dismiss);
  overlay.addEventListener("click", e => {
    if (e.target === overlay) dismiss();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && overlay.classList.contains("open")) dismiss();
  });
}

function closeHeaderMenu() {
  const menu = document.getElementById("headerMenuDropdown");
  const btn = document.getElementById("headerMenuBtn");
  if (menu) menu.hidden = true;
  if (btn) btn.setAttribute("aria-expanded", "false");
}

function openHeaderMenu() {
  const menu = document.getElementById("headerMenuDropdown");
  const btn = document.getElementById("headerMenuBtn");
  if (!menu || !btn) return;
  menu.hidden = false;
  btn.setAttribute("aria-expanded", "true");
  updateHeaderMenuChecks();
}

function initHeaderMenu() {
  const btn = document.getElementById("headerMenuBtn");
  const menu = document.getElementById("headerMenuDropdown");
  if (!btn || !menu) return;

  btn.addEventListener("click", e => {
    e.stopPropagation();
    if (menu.hidden) openHeaderMenu();
    else closeHeaderMenu();
  });

  document.getElementById("headerMenuEditTable")?.addEventListener("click", e => {
    e.stopPropagation();
    closeHeaderMenu();
    openEditTablePopover(btn);
  });

  initCsvImport();

  initPublishToProductionModal();

  document.getElementById("headerMenuToggleAppMode")?.addEventListener("click", e => {
    e.stopPropagation();
    toggleAppMode();
  });

  document.getElementById("headerMenuPublishToProduction")?.addEventListener("click", e => {
    e.stopPropagation();
    openPublishToProductionModal();
  });

  document.getElementById("headerMenuToggleCountdown")?.addEventListener("click", e => {
    e.stopPropagation();
    toggleCxlCountdown();
  });

  document.addEventListener("click", e => {
    if (menu.hidden) return;
    if (menu.contains(e.target) || btn.contains(e.target)) return;
    closeHeaderMenu();
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeHeaderMenu();
  });

  updateHeaderMenuChecks();
}
