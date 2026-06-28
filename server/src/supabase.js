import { createClient } from "@supabase/supabase-js";

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
const supabase = createClient(url, key, {
  auth: { persistSession: false },
});

export default supabase;
