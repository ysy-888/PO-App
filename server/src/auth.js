/**
 * requireAuth middleware
 *
 * Validates the Supabase JWT from the Authorization header,
 * then resolves the caller's tenant_id from tenant_memberships.
 *
 * On success, attaches to the request object:
 *   req.userId   (string)
 *   req.tenantId (string)
 *
 * On failure, responds 401 or 403 and stops the chain.
 */

import supabase from "./supabase.js";

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "Missing or malformed Authorization header." });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return res.status(401).json({ success: false, error: "Empty bearer token." });
  }

  // Validate the JWT with Supabase.
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) {
    return res.status(401).json({ success: false, error: "Invalid or expired session. Please log in again." });
  }

  // Resolve tenant membership.
  // For now a user must belong to exactly one tenant; the first one wins.
  // Multi-tenant switching can be added later via a request header.
  const { data: memberships, error: memberErr } = await supabase
    .from("tenant_memberships")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .limit(1);

  if (memberErr) {
    console.error("tenant_memberships lookup failed:", memberErr);
    return res.status(500).json({ success: false, error: "Could not resolve tenant." });
  }

  if (!memberships || memberships.length === 0) {
    return res.status(403).json({ success: false, error: "Your account is not associated with any company. Contact your administrator." });
  }

  req.userId = user.id;
  req.tenantId = memberships[0].tenant_id;
  req.userRole = memberships[0].role;
  next();
}
