/**
 * requireAuth middleware
 *
 * Validates the Supabase JWT from the Authorization header,
 * then resolves the caller's tenant_id from tenant_memberships.
 *
 * Fast path: when SUPABASE_JWT_SECRET is set, the token is verified
 * locally (no network call to Supabase Auth). Tenant membership is
 * cached in memory for a short TTL so repeat requests skip the
 * membership query too. Without the secret, falls back to the
 * original supabase.auth.getUser() network check.
 *
 * On success, attaches to the request object:
 *   req.userId    (string)
 *   req.userEmail (string, may be empty)
 *   req.tenantId  (string)
 *   req.userRole  (string)
 *
 * On failure, responds 401 or 403 and stops the chain.
 */

import { jwtVerify } from "jose";
import supabase from "./supabase.js";

const jwtSecret = process.env.SUPABASE_JWT_SECRET;
const jwtKey = jwtSecret ? new TextEncoder().encode(jwtSecret) : null;

// userId → { tenantId, role, expiresAt }
// Revoking a membership can take up to MEMBERSHIP_TTL_MS to propagate.
const MEMBERSHIP_TTL_MS = 5 * 60 * 1000;
const MEMBERSHIP_CACHE_MAX = 5000;
const membershipCache = new Map();

/** Verify the JWT locally when possible; fall back to Supabase Auth. */
async function resolveUser(token) {
  if (jwtKey) {
    try {
      const { payload } = await jwtVerify(token, jwtKey, { audience: "authenticated" });
      if (payload.sub) return { userId: payload.sub, email: payload.email || "" };
    } catch {
      // Signature/alg mismatch or expiry — fall through to the network
      // check, which is authoritative (covers JWT secret rotation).
    }
  }

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return { userId: user.id, email: user.email || "" };
}

async function resolveMembership(userId) {
  const cached = membershipCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached;

  const { data: memberships, error } = await supabase
    .from("tenant_memberships")
    .select("tenant_id, role")
    .eq("user_id", userId)
    .limit(1);

  if (error) {
    console.error("tenant_memberships lookup failed:", error);
    return { error };
  }
  if (!memberships || memberships.length === 0) return null;

  const entry = {
    tenantId: memberships[0].tenant_id,
    role: memberships[0].role,
    expiresAt: Date.now() + MEMBERSHIP_TTL_MS,
  };
  if (membershipCache.size >= MEMBERSHIP_CACHE_MAX) membershipCache.clear();
  membershipCache.set(userId, entry);
  return entry;
}

/**
 * Showroom portal accounts (external sales team). They may only load the
 * (sales-order-only) app state and post Sales Order comments; every other
 * API endpoint is rejected here so the restriction covers all routers.
 */
export const PORTAL_ROLE = "showroom";

export function isPortalRole(role) {
  return String(role ?? "").trim().toLowerCase() === PORTAL_ROLE;
}

const PORTAL_ALLOWED_ENDPOINTS = [
  { method: "GET", path: "/api/app-state" },
  { method: "POST", path: "/api/sales-orders/comment" },
  // Notifications are per-user (mentions in SO comments) — portal-safe.
  { method: "GET", path: "/api/notifications" },
  { method: "POST", path: "/api/notifications/mark-read" },
  { method: "POST", path: "/api/notifications/clear-all" },
];

function isPortalEndpointAllowed(req) {
  const path = String(req.originalUrl || "").split("?")[0].replace(/\/+$/, "");
  return PORTAL_ALLOWED_ENDPOINTS.some(e => e.method === req.method && e.path === path);
}

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "Missing or malformed Authorization header." });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return res.status(401).json({ success: false, error: "Empty bearer token." });
  }

  const user = await resolveUser(token);
  if (!user) {
    return res.status(401).json({ success: false, error: "Invalid or expired session. Please log in again." });
  }

  const membership = await resolveMembership(user.userId);
  if (membership?.error) {
    return res.status(500).json({ success: false, error: "Could not resolve tenant." });
  }
  if (!membership) {
    return res.status(403).json({ success: false, error: "Your account is not associated with any company. Contact your administrator." });
  }

  if (isPortalRole(membership.role) && !isPortalEndpointAllowed(req)) {
    return res.status(403).json({ success: false, error: "This action is not available in the showroom portal." });
  }

  req.userId = user.userId;
  req.userEmail = user.email;
  req.tenantId = membership.tenantId;
  req.userRole = membership.role;
  next();
}
