
async function saveUpdate(poNumber, updates, options = {}) {
  const silent = Boolean(options.silent);
  const sheetUpdates = Object.fromEntries(
    Object.entries(updates).filter(([field]) => !LOCAL_ONLY_COLS.has(field))
  );
  if (Object.keys(sheetUpdates).length === 0) return true;

  if (isDemoMode()) {
    if (!silent) showIndicator(`Demo mode ${EMPTY_DISPLAY} not saved to sheet`, "");
    return true;
  }

  // ── SaaS API path ──────────────────────────────────────────
  if (typeof isApiMode === "function" && isApiMode()) {
    const token = typeof getAccessToken === "function" ? getAccessToken() : null;
    if (!token) {
      if (!silent) showIndicator("Not signed in", "error");
      return false;
    }
    try {
      if (!silent) showIndicator(`Saving${ELLIPSIS}`, "");
      const res = await fetch(`${getApiBaseUrl()}/api/po/update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ poNumber, updates: sheetUpdates }),
      });
      const text = await res.text();
      let json = {};
      try { json = text ? JSON.parse(text) : {}; } catch (e) { throw new Error(text.trim() || e.message); }
      if (!json.success) throw new Error(json.error);
      if (!silent) showIndicator(`Saved ${CHECK_MARK}`, "success");
      return true;
    } catch (err) {
      if (!silent) showIndicator("Save failed: " + err.message, "error");
      return false;
    }
  }

  // ── Apps Script path (original) ────────────────────────────
  try {
    if (!silent) showIndicator(`Saving${ELLIPSIS}`, "");
    const res = await fetch(getAppsScriptUrl(), {
      method: "POST",
      body: JSON.stringify({ action: "update", poNumber, updates: sheetUpdates })
    });
    const text = await res.text();
    let json = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch (parseErr) {
      throw new Error(text.trim() || parseErr.message);
    }
    if (!json.success) throw new Error(json.error);
    if (!silent) showIndicator(`Saved ${CHECK_MARK}`, "success");
    return true;
  } catch (err) {
    if (!silent) showIndicator("Save failed: " + err.message, "error");
    return false;
  }
}

let appSaveInProgress = false;

function isAppSaving() {
  return appSaveInProgress;
}

function setAppSaving(active, message = "Saving…") {
  appSaveInProgress = active;
  document.body.classList.toggle("app-saving", active);
  document.body.setAttribute("aria-busy", active ? "true" : "false");

  const overlay = document.getElementById("appSavingOverlay");
  const msgEl = document.getElementById("appSavingMessage");
  if (overlay) {
    overlay.hidden = !active;
    overlay.setAttribute("aria-hidden", active ? "false" : "true");
  }
  if (msgEl && active) msgEl.textContent = message;
}

let indicatorTimer;
let modalFooterTimer;

function getTopmostOpenModalOverlay() {
  const open = [...document.querySelectorAll(".modal-backdrop.open")];
  if (!open.length) return null;
  return open.reduce((top, el) => {
    const z = Number.parseInt(el.style.zIndex || "", 10) || 1000;
    const topZ = Number.parseInt(top.style.zIndex || "", 10) || 1000;
    return z >= topZ ? el : top;
  });
}

function getModalFooterMessageEl(overlay) {
  return overlay?.querySelector(".modal-footer-message") ?? null;
}

function clearModalFooterMessageEl(el) {
  if (!el) return;
  el.textContent = "";
  el.hidden = true;
  el.classList.remove("success", "error");
}

function clearModalFooterMessageForOverlay(overlayOrId) {
  const overlay = typeof overlayOrId === "string"
    ? document.getElementById(overlayOrId)
    : overlayOrId;
  clearModalFooterMessageEl(getModalFooterMessageEl(overlay));
}

function setModalFooterMessage(msg, type = "", options = {}) {
  const overlay = options.overlay || getTopmostOpenModalOverlay();
  const el = getModalFooterMessageEl(overlay);
  if (!el) return false;

  el.textContent = msg;
  el.hidden = !msg;
  el.classList.remove("success", "error");
  if (type) el.classList.add(type);

  clearTimeout(modalFooterTimer);
  if (msg && type && !options.persist) {
    modalFooterTimer = setTimeout(() => clearModalFooterMessageEl(el), 2500);
  }
  return true;
}

function showIndicator(msg, type) {
  const overlayMsg = document.getElementById("appSavingMessage");
  if (isAppSaving() && !type && overlayMsg) {
    overlayMsg.textContent = msg;
    return;
  }

  if (setModalFooterMessage(msg, type)) return;

  const el = document.getElementById("saveIndicator");
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  el.className = "save-indicator visible" + (type ? ` ${type}` : "");
  clearTimeout(indicatorTimer);
  // In-progress messages (no type) stay visible until replaced by success/error.
  if (type) {
    indicatorTimer = setTimeout(() => {
      el.classList.remove("visible", "success", "error");
      el.hidden = true;
      el.textContent = "";
    }, 2500);
  }
}
