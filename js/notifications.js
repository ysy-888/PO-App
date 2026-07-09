/**
 * Header notifications bell — @mention alerts from Sales Order comments.
 *
 * Notifications are fetched from /api/notifications after each data load
 * and on a slow poll. Clicking one marks it read and opens the Sales
 * Order it points at; "Clear all" deletes everything for the user.
 */

let appNotifications = [];
let appNotificationsUnread = 0;
let notificationsPollTimer = null;

const NOTIFICATIONS_POLL_MS = 2 * 60 * 1000;

function formatNotificationTime(at) {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "";
  const date = `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}`;
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${date}, ${time}`;
}

function isNotificationsPanelOpen() {
  const panel = document.getElementById("notificationsPanel");
  return Boolean(panel && !panel.hidden);
}

function updateNotificationsBadge() {
  const badge = document.getElementById("notificationsBadge");
  if (!badge) return;
  if (appNotificationsUnread > 0) {
    badge.textContent = appNotificationsUnread > 9 ? "9+" : String(appNotificationsUnread);
    badge.hidden = false;
  } else {
    badge.hidden = true;
  }
}

async function refreshNotifications() {
  if (typeof getApi !== "function") return;
  if (typeof getAccessToken === "function" && !getAccessToken()) return;
  try {
    const json = await getApi("/api/notifications", { timeoutMs: 15000 });
    if (!json?.success) return;
    appNotifications = Array.isArray(json.notifications) ? json.notifications : [];
    appNotificationsUnread = Number(json.unreadCount ?? 0);
    updateNotificationsBadge();
    if (isNotificationsPanelOpen()) renderNotificationsPanel();
  } catch {
    // Offline or signed out — leave the current state alone.
  }
}

function markNotificationRead(notification) {
  if (!notification || notification.read) return;
  notification.read = true;
  appNotificationsUnread = Math.max(0, appNotificationsUnread - 1);
  updateNotificationsBadge();
  postApi("/api/notifications/mark-read", { ids: [notification.id] }).catch(() => {});
}

function openNotificationTarget(notification) {
  closeNotificationsPanel();
  markNotificationRead(notification);

  const soNumber = String(notification?.soNumber ?? "").trim();
  if (!soNumber) return;
  const order = (typeof allSalesOrders !== "undefined" ? allSalesOrders : [])
    .find(o => String(o?.["SO #"] ?? "").trim() === soNumber);
  if (!order) {
    showIndicator(`SO #${soNumber} is not available`, "error");
    return;
  }
  if (typeof switchAppView === "function" && typeof currentAppView !== "undefined" && currentAppView !== "sales") {
    switchAppView("sales");
  }
  if (typeof openSalesOrderModal === "function") openSalesOrderModal(order);
}

function renderNotificationsPanel() {
  const list = document.getElementById("notificationsList");
  if (!list) return;
  list.innerHTML = "";

  if (appNotifications.length === 0) {
    const empty = document.createElement("p");
    empty.className = "notifications-empty";
    empty.textContent = "No notifications.";
    list.appendChild(empty);
    return;
  }

  appNotifications.forEach(n => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "notification-item" + (n.read ? "" : " is-unread");

    const top = document.createElement("div");
    top.className = "notification-top";
    const from = document.createElement("span");
    from.className = "notification-from";
    const fromLabel = typeof getUserDisplayLabel === "function"
      ? getUserDisplayLabel(String(n.fromId ?? ""), String(n.from ?? ""))
      : String(n.from ?? "");
    from.textContent = `${fromLabel} mentioned you`;
    const time = document.createElement("span");
    time.className = "notification-time";
    time.textContent = formatNotificationTime(n.at || n.createdAt);
    top.appendChild(from);
    top.appendChild(time);
    item.appendChild(top);

    const soInfo = document.createElement("div");
    soInfo.className = "notification-so-info";
    soInfo.textContent = [
      n.soNumber ? `SO #${n.soNumber}` : "",
      String(n.customer ?? "").trim(),
      String(n.customerPo ?? "").trim() ? `PO ${String(n.customerPo).trim()}` : "",
    ].filter(Boolean).join(" · ");
    item.appendChild(soInfo);

    const preview = document.createElement("div");
    preview.className = "notification-preview";
    preview.textContent = String(n.preview ?? "");
    item.appendChild(preview);

    item.addEventListener("click", () => openNotificationTarget(n));
    list.appendChild(item);
  });
}

function openNotificationsPanel() {
  const panel = document.getElementById("notificationsPanel");
  const btn = document.getElementById("notificationsBtn");
  if (!panel) return;
  renderNotificationsPanel();
  panel.hidden = false;
  btn?.setAttribute("aria-expanded", "true");
  // Pull the latest while the panel is open.
  refreshNotifications();
}

function closeNotificationsPanel() {
  const panel = document.getElementById("notificationsPanel");
  if (panel) panel.hidden = true;
  document.getElementById("notificationsBtn")?.setAttribute("aria-expanded", "false");
}

function toggleNotificationsPanel() {
  if (isNotificationsPanelOpen()) closeNotificationsPanel();
  else openNotificationsPanel();
}

async function clearAllNotifications() {
  const hadAny = appNotifications.length > 0;
  appNotifications = [];
  appNotificationsUnread = 0;
  updateNotificationsBadge();
  renderNotificationsPanel();
  if (!hadAny) return;
  try {
    const json = await postApi("/api/notifications/clear-all", {});
    if (!json.success) throw new Error(json.error || "Clear failed.");
    showIndicator(`Notifications cleared ${CHECK_MARK}`, "success");
  } catch (err) {
    showIndicator("Clear failed: " + err.message, "error");
    refreshNotifications();
  }
}

function initNotifications() {
  document.getElementById("notificationsBtn")?.addEventListener("click", e => {
    e.stopPropagation();
    toggleNotificationsPanel();
  });
  document.getElementById("notificationsClearAllBtn")?.addEventListener("click", e => {
    e.stopPropagation();
    clearAllNotifications();
  });

  document.addEventListener("click", e => {
    if (!isNotificationsPanelOpen()) return;
    if (e.target.closest("#notificationsPanel") || e.target.closest("#notificationsBtn")) return;
    closeNotificationsPanel();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeNotificationsPanel();
  });

  if (!notificationsPollTimer) {
    notificationsPollTimer = setInterval(refreshNotifications, NOTIFICATIONS_POLL_MS);
  }
}

initNotifications();
