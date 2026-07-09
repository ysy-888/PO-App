
async function saveUpdate(poNumber, updates, options = {}) {
  const silent = Boolean(options.silent);
  const sheetUpdates = Object.fromEntries(
    Object.entries(updates).filter(([field]) => !LOCAL_ONLY_COLS.has(field))
  );
  if (Object.keys(sheetUpdates).length === 0) return true;

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

let appSaveInProgress = false;
/** True until the first successful (or failed) app-state load finishes. */
let appInitialLoadPending = true;

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

function clearAppInitialLoading() {
  if (!appInitialLoadPending) return;
  appInitialLoadPending = false;
  if (typeof setAppSaving === "function") setAppSaving(false);
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
  el.querySelector(".message-dismiss-btn")?.remove();
  el.textContent = "";
  el.hidden = true;
  el.classList.remove("success", "error", "is-persistent");
}

function clearIndicator() {
  const el = document.getElementById("saveIndicator");
  const wrap = document.getElementById("saveIndicatorWrap");
  const dismiss = document.getElementById("saveIndicatorDismiss");
  clearTimeout(indicatorTimer);
  if (!el) return;
  el.textContent = "";
  el.className = "save-indicator";
  if (wrap) wrap.hidden = true;
  else el.hidden = true;
  if (dismiss) dismiss.hidden = true;
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

  clearTimeout(modalFooterTimer);
  el.querySelector(".message-dismiss-btn")?.remove();
  el.classList.remove("success", "error", "is-persistent");

  if (!msg) {
    clearModalFooterMessageEl(el);
    return true;
  }

  if (type === "error") {
    el.replaceChildren();
    const text = document.createElement("span");
    text.className = "modal-footer-message-text";
    text.textContent = msg;
    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.className = "message-dismiss-btn";
    dismiss.setAttribute("aria-label", "Dismiss message");
    dismiss.textContent = "✕";
    dismiss.addEventListener("click", () => clearModalFooterMessageEl(el));
    el.appendChild(text);
    el.appendChild(dismiss);
    el.hidden = false;
    el.classList.add("error", "is-persistent");
    return true;
  }

  el.textContent = msg;
  el.hidden = false;
  if (type) el.classList.add(type);

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
  const wrap = document.getElementById("saveIndicatorWrap");
  const dismiss = document.getElementById("saveIndicatorDismiss");
  if (!el) return;

  el.textContent = msg;
  if (wrap) wrap.hidden = false;
  else el.hidden = false;
  el.className = "save-indicator visible" + (type ? ` ${type}` : "");
  clearTimeout(indicatorTimer);

  const isError = type === "error";
  if (dismiss) dismiss.hidden = !isError;

  // Success auto-dismisses; errors stay until the user clicks X.
  if (type === "success") {
    indicatorTimer = setTimeout(() => clearIndicator(), 2500);
  }
}

function initSaveIndicator() {
  document.getElementById("saveIndicatorDismiss")?.addEventListener("click", clearIndicator);
}

initSaveIndicator();
