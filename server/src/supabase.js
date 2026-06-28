import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy server/.env.example to server/.env and fill in the values."
  );
}

// Service-role client — bypasses RLS.
// Never expose this key to the browser.
// The API always enforces tenant scoping in code before any query.
// Node 20 on Render has no global WebSocket; @supabase/supabase-js requires one.
const supabase = createClient(url, key, {
  auth: { persistSession: false },
  global: { WebSocket },
});

export default supabase;
