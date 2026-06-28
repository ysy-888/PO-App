import { createClient } from "@supabase/supabase-js";
import ws from "ws";

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
// Node < 22 has no native WebSocket; pass ws as the Realtime transport.
const supabase = createClient(url, key, {
  auth: { persistSession: false },
  realtime: { transport: ws },
});

export default supabase;
