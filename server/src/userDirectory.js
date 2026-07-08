/**
 * Tenant user directory — resolves the members of a tenant with their
 * email and (optional) display name. Used by /api/app-state to ship a
 * userId → name map to the client (so comments show names, not emails)
 * and by /api/settings/users to manage display names.
 *
 * Resilient to the profiles.display_name column not existing yet (i.e.
 * migration 007 not applied): falls back to email-only.
 */

import supabase from "./supabase.js";

function isMissingColumnError(error) {
  if (!error) return false;
  if (error.code === "42703") return true; // undefined_column
  const msg = String(error.message || "").toLowerCase();
  return msg.includes("display_name") && msg.includes("does not exist");
}

/**
 * Returns an array of { id, email, displayName, role } for every member
 * of the tenant, sorted by display name / email.
 */
export async function fetchTenantUsers(tenantId) {
  const { data: memberships, error: membershipErr } = await supabase
    .from("tenant_memberships")
    .select("user_id, role")
    .eq("tenant_id", tenantId);

  if (membershipErr) throw membershipErr;
  const ids = (memberships || []).map(m => m.user_id).filter(Boolean);
  if (ids.length === 0) return [];

  const roleById = new Map((memberships || []).map(m => [m.user_id, m.role]));

  // Prefer selecting display_name; retry without it if the column is absent.
  let profiles = [];
  let result = await supabase.from("profiles").select("id, email, display_name").in("id", ids);
  if (result.error && isMissingColumnError(result.error)) {
    result = await supabase.from("profiles").select("id, email").in("id", ids);
  }
  if (result.error) throw result.error;
  profiles = result.data || [];

  const users = profiles.map(p => ({
    id: p.id,
    email: p.email || "",
    displayName: String(p.display_name ?? "").trim(),
    role: roleById.get(p.id) || "",
  }));

  users.sort((a, b) =>
    (a.displayName || a.email).localeCompare(b.displayName || b.email, undefined, { sensitivity: "base" })
  );
  return users;
}

/** Compact { id: { email, displayName } } map for the app-state payload. */
export function usersToMap(users) {
  const map = {};
  (users || []).forEach(u => {
    map[u.id] = { email: u.email, displayName: u.displayName };
  });
  return map;
}
