
async function saveUpdate(poNumber, updates) {
  const sheetUpdates = Object.fromEntries(
    Object.entries(updates).filter(([field]) => !LOCAL_ONLY_COLS.has(field))
  );
  if (Object.keys(sheetUpdates).length === 0) return true;

  if (isDemoMode()) {
    showIndicator(`Demo mode ${EMPTY_DISPLAY} not saved to sheet`, "");
    return true;
  }
  try {
    showIndicator(`Saving${ELLIPSIS}`, "");
    const res = await fetch(getAppsScriptUrl(), {
      method: "POST",
      body: JSON.stringify({ action: "update", poNumber, updates: sheetUpdates })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    showIndicator(`Saved ${CHECK_MARK}`, "success");
    return true;
  } catch (err) {
    showIndicator("Save failed: " + err.message, "error");
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
function showIndicator(msg, type) {
  const overlayMsg = document.getElementById("appSavingMessage");
  if (isAppSaving() && !type && overlayMsg) {
    overlayMsg.textContent = msg;
    return;
  }

  const el = document.getElementById("saveIndicator");
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  el.className = "save-indicator visible" + (type ? ` ${type}` : "");
  clearTimeout(indicatorTimer);
  indicatorTimer = setTimeout(() => {
    el.classList.remove("visible", "success", "error");
    el.hidden = true;
    el.textContent = "";
  }, 2500);
}
