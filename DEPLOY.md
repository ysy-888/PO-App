# Deploying the PO App

The app now uses GitHub Pages for the frontend and the Express/Supabase API for data and PDF generation. The old sheet-bound Apps Script backend has been removed.

## Frontend

GitHub Pages serves the static app from this repo. Push frontend changes to the configured Pages branch and refresh the live app after Pages finishes publishing.

## API Backend

The frontend calls the API URL configured in `js/config.js`. The API server owns Supabase access, request email assembly, and packing-list PDF generation.

Deploy API changes from the `server/` app using the hosting provider workflow for `https://po-app-api.onrender.com`.

### One-time setup for the performance/concurrency update

1. **Apply migration 006** — run `db/migrations/006_merge_po_updates.sql` in the
   Supabase SQL editor. This installs the atomic JSONB merge function that
   prevents concurrent edits from overwriting each other and collapses batch
   updates into one round trip. (Until it's applied, the API automatically
   falls back to the old per-row update path.)
2. **Set `SUPABASE_JWT_SECRET` on Render** — copy it from Supabase → Project
   Settings → API → JWT Settings. This lets the API verify session tokens
   locally instead of calling Supabase Auth on every request (~200-500ms saved
   per API call). Without it, the API falls back to the network check.
3. **`KEEP_ALIVE_URL`** (already in `render.yaml`) — the server pings its own
   `/health` every 10 minutes so the Render free tier doesn't spin down and
   cause 30-60s cold starts. Remove the env var to disable (e.g. if you
   upgrade to a paid plan, which is the more robust fix).

## Google Calendar + Drive (optional)

The API can sync dates to a Google Calendar and archive request PDFs to a
Drive folder. Both are driven by a service account and disabled until the
env vars are set (on Render and/or in `server/.env`):

1. In Google Cloud console → IAM & Admin → Service Accounts → your account →
   Keys → **Add key → JSON**. Set the downloaded JSON as
   `GOOGLE_SERVICE_ACCOUNT_KEY` (paste the raw JSON, or base64-encode it).
   Also enable the **Google Calendar API** and **Google Drive API** for the
   project (APIs & Services → Library).
2. **Calendar**: create (or pick) a calendar, share it with the service
   account's `client_email` with "Make changes to events", and set
   `GOOGLE_CALENDAR_ID` (Calendar settings → Integrate calendar).
   The server then keeps all-day events in sync for open-PO CXL dates and
   EXF/Pickup/Delivery request dates — on boot, every 6 hours, and on demand
   via `POST /api/google/sync-calendar`.
3. **Drive**: create a folder, share it with the `client_email` as Editor,
   and set `GOOGLE_DRIVE_FOLDER_ID` (the ID segment of the folder URL).
   Packing-list PDFs attached to request emails are then archived there
   automatically (same-name files are updated, not duplicated).

`GET /health` shows whether each side is configured.

## Email Relay

The only remaining Apps Script component is the standalone `email-relay/` project used by the API server to send mail as `shipping@elevatordisco.com`. It is not a data backend and is not bound to a spreadsheet.

Useful commands:

```bash
npm run push:email
npm run redeploy:email
```

Required API server environment variables:

- `APPS_SCRIPT_URL`: the email relay `/exec` URL.
- `APPS_SCRIPT_EMAIL_TOKEN`: relay token created by `setupEmailRelayToken()`.

Full relay setup lives in `email-relay/README.md`.
