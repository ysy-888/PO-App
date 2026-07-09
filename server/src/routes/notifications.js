/**
 * GET  /api/notifications           — latest notifications for the caller + unread count
 * POST /api/notifications/mark-read — mark specific notifications read
 * POST /api/notifications/clear-all — delete all of the caller's notifications
 *
 * Notification rows are created elsewhere (e.g. the SO comment endpoint
 * when users are @mentioned). All queries are scoped to the signed-in
 * user, so portal (showroom) accounts can safely use these endpoints.
 */

import { Router } from "express";
import supabase from "../supabase.js";
import { requireAuth } from "../auth.js";

const router = Router();

/** Notifications table may predate migration 008 — treat as empty. */
function isMissingTableError(error) {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const msg = String(error.message || "").toLowerCase();
  return msg.includes("does not exist") || msg.includes("could not find the table");
}

router.get("/", requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("notifications")
      .select("id, data, read, created_at")
      .eq("tenant_id", req.tenantId)
      .eq("user_id", req.userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      if (isMissingTableError(error)) {
        return res.json({ success: true, notifications: [], unreadCount: 0, tableMissing: true });
      }
      throw error;
    }

    const notifications = (data || []).map(row => ({
      id: row.id,
      read: row.read === true,
      createdAt: row.created_at,
      ...((row.data && typeof row.data === "object") ? row.data : {}),
    }));
    const unreadCount = notifications.filter(n => !n.read).length;
    return res.json({ success: true, notifications, unreadCount });
  } catch (err) {
    console.error("notifications list failed:", err);
    return res.status(500).json({ success: false, error: "Failed to load notifications." });
  }
});

router.post("/mark-read", requireAuth, async (req, res) => {
  const ids = Array.isArray(req.body?.ids)
    ? req.body.ids.map(id => String(id ?? "").trim()).filter(Boolean)
    : [];
  if (ids.length === 0) return res.json({ success: true });

  try {
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("tenant_id", req.tenantId)
      .eq("user_id", req.userId)
      .in("id", ids);
    if (error && !isMissingTableError(error)) throw error;
    return res.json({ success: true });
  } catch (err) {
    console.error("notifications mark-read failed:", err);
    return res.status(500).json({ success: false, error: "Failed to update notifications." });
  }
});

router.post("/clear-all", requireAuth, async (req, res) => {
  try {
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("tenant_id", req.tenantId)
      .eq("user_id", req.userId);
    if (error && !isMissingTableError(error)) throw error;
    return res.json({ success: true });
  } catch (err) {
    console.error("notifications clear-all failed:", err);
    return res.status(500).json({ success: false, error: "Failed to clear notifications." });
  }
});

/**
 * Insert mention notifications (used by the SO comment endpoint).
 * Fails soft — a missing table or insert error never blocks the comment.
 */
export async function createMentionNotifications({ tenantId, userIds, data }) {
  const targets = [...new Set((userIds || []).filter(Boolean))];
  if (targets.length === 0) return;
  try {
    const rows = targets.map(userId => ({ tenant_id: tenantId, user_id: userId, data }));
    const { error } = await supabase.from("notifications").insert(rows);
    if (error && !isMissingTableError(error)) throw error;
  } catch (err) {
    console.warn("mention notifications insert failed:", err.message);
  }
}

export default router;
