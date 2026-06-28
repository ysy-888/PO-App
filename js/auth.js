/**
 * js/auth.js — Supabase Auth for the SaaS backend path.
 *
 * Only active when BACKEND === "api" (set in js/config.js).
 * When BACKEND === "appsscript" this file is a no-op: getAccessToken()
 * returns null and the rest of the app uses Apps Script as before.
 *
 * Loaded as a <script> tag in index.html BEFORE js/data-pipeline.js.
 * Requires the Supabase JS CDN script to be loaded first (see index.html).
 */

/* global supabase, SUPABASE_URL, SUPABASE_ANON_KEY, BACKEND */

let _supabaseClient = null;
let _session = null;

function _getSupabaseClient() {
  if (_supabaseClient) return _supabaseClient;
  if (typeof supabase === "undefined" || !supabase.createClient) {
    throw new Error("Supabase JS client not loaded. Check the CDN <script> tag in index.html.");
  }
  _supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return _supabaseClient;
}

/**
 * Returns the current access token (JWT) for authenticated API calls,
 * or null when not in API mode or not logged in.
 */
function getAccessToken() {
  return _session?.access_token ?? null;
}

/**
 * Returns the current Supabase session object, or null.
 */
function getAuthSession() {
  return _session;
}

// ── Login UI ─────────────────────────────────────────────────

function _buildLoginOverlay() {
  const overlay = document.createElement("div");
  overlay.id = "authLoginOverlay";
  overlay.style.cssText = [
    "position:fixed;inset:0;z-index:9999",
    "display:flex;align-items:center;justify-content:center",
    "background:rgba(0,0,0,0.45)",
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
  ].join(";");

  const card = document.createElement("div");
  card.style.cssText = [
    "background:#fff;border-radius:10px;padding:36px 32px;width:340px",
    "box-shadow:0 8px 32px rgba(0,0,0,0.18)",
  ].join(";");

  card.innerHTML = `
    <h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#1a1a18;">Sign in</h2>
    <p style="margin:0 0 24px;font-size:13px;color:#6b7280;">Enter your email and password to continue.</p>
    <div id="authLoginError" style="display:none;margin-bottom:16px;padding:10px 12px;background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;font-size:13px;color:#b91c1c;"></div>
    <label style="display:block;margin-bottom:4px;font-size:13px;font-weight:600;color:#374151;">Email</label>
    <input id="authEmailInput" type="email" autocomplete="email" placeholder="you@example.com"
      style="width:100%;box-sizing:border-box;border:1px solid #d1d5db;border-radius:6px;padding:9px 12px;font-size:14px;margin-bottom:16px;outline:none;" />
    <label style="display:block;margin-bottom:4px;font-size:13px;font-weight:600;color:#374151;">Password</label>
    <input id="authPasswordInput" type="password" autocomplete="current-password" placeholder="••••••••"
      style="width:100%;box-sizing:border-box;border:1px solid #d1d5db;border-radius:6px;padding:9px 12px;font-size:14px;margin-bottom:24px;outline:none;" />
    <button id="authSignInBtn"
      style="width:100%;padding:10px;background:#1a1a18;color:#fff;border:none;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;">
      Sign in
    </button>
  `;

  overlay.appendChild(card);
  return overlay;
}

async function _attemptLogin(overlay) {
  const email = document.getElementById("authEmailInput")?.value?.trim() ?? "";
  const password = document.getElementById("authPasswordInput")?.value ?? "";
  const errEl = document.getElementById("authLoginError");
  const btn = document.getElementById("authSignInBtn");

  if (!email || !password) {
    if (errEl) { errEl.textContent = "Email and password are required."; errEl.style.display = "block"; }
    return;
  }

  btn.disabled = true;
  btn.textContent = "Signing in…";
  if (errEl) errEl.style.display = "none";

  const client = _getSupabaseClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });

  btn.disabled = false;
  btn.textContent = "Sign in";

  if (error) {
    if (errEl) { errEl.textContent = error.message || "Sign in failed."; errEl.style.display = "block"; }
    return;
  }

  _session = data.session;
  overlay.remove();

  // Kick off data load now that we have a valid token.
  if (typeof loadData === "function") loadData();
}

function _showLoginUI() {
  const overlay = _buildLoginOverlay();
  document.body.appendChild(overlay);

  document.getElementById("authSignInBtn")?.addEventListener("click", () => _attemptLogin(overlay));

  // Allow pressing Enter in the password field to submit.
  document.getElementById("authPasswordInput")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") _attemptLogin(overlay);
  });
}

// ── Initialisation ───────────────────────────────────────────

/**
 * Called once at app startup (from main.js or DOMContentLoaded).
 * In appsscript mode this is a no-op.
 * In api mode, restores an existing session or shows the login UI.
 */
async function initAuth() {
  if (typeof BACKEND === "undefined" || BACKEND !== "api") return;
  if (!SUPABASE_URL || SUPABASE_URL === "YOUR_SUPABASE_PROJECT_URL_HERE") {
    console.warn("auth.js: SUPABASE_URL not configured. Set it in js/config.js.");
    return;
  }

  const client = _getSupabaseClient();

  // Try to restore an existing session from localStorage.
  const { data: { session } } = await client.auth.getSession();
  if (session) {
    _session = session;
    if (typeof loadData === "function") loadData();
    return;
  }

  // No session — block the UI and show the login form.
  _showLoginUI();

  // Listen for sign-in events (e.g. magic link, OAuth redirect).
  client.auth.onAuthStateChange((_event, newSession) => {
    if (newSession) {
      _session = newSession;
      const overlay = document.getElementById("authLoginOverlay");
      if (overlay) overlay.remove();
      if (typeof loadData === "function") loadData();
    }
  });
}
