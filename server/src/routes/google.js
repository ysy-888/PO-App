/**
 * GET  /api/google/status        — integration configuration state
 * POST /api/google/sync-calendar — trigger a calendar sync now
 */

import { Router } from "express";
import { requireAuth } from "../auth.js";
import { getGoogleStatus } from "../google.js";
import { syncCalendar } from "../calendarSync.js";

const router = Router();

router.get("/status", requireAuth, (_req, res) => {
  res.json({ success: true, ...getGoogleStatus() });
});

router.post("/sync-calendar", requireAuth, async (_req, res) => {
  const result = await syncCalendar();
  if (result.skipped) {
    return res.status(400).json({ success: false, error: result.reason });
  }
  if (!result.success) {
    return res.status(500).json({ success: false, error: result.error || "Sync failed." });
  }
  return res.json({ success: true, ...result });
});

export default router;
