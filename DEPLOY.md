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
Drive folder. Disabled until the env vars are set (on Render and/or in
`server/.env`).

Auth uses OAuth as a real account (e.g. `shipping@elevatordisco.com`) —
events and files are owned by that account, and no service-account key is
needed (org policy blocks key creation anyway):

1. In Google Cloud console → APIs & Services → **Library**, enable the
   **Google Calendar API** and **Google Drive API**.
2. **OAuth consent screen**: User type **Internal**, fill in the app name,
   save (no verification needed for Internal).
3. **Credentials → Create credentials → OAuth client ID → Desktop app.**
   Put the client ID/secret in `server/.env` as `GOOGLE_OAUTH_CLIENT_ID`
   and `GOOGLE_OAUTH_CLIENT_SECRET`.
4. From `server/`, run `node scripts/google-oauth-setup.mjs`, open the
   printed URL, sign in as the target account, and approve. Copy the printed
   `GOOGLE_OAUTH_REFRESH_TOKEN` into `server/.env`. Set all three OAuth vars
   on Render too.
5. **Calendar**: set `GOOGLE_CALENDAR_ID` — either `primary` (the account's
   own calendar) or the ID of a shared calendar the account can edit
   (Calendar settings → Integrate calendar). The server keeps all-day events
   in sync for open-PO CXL dates and EXF/Pickup/Delivery request dates — on
   boot, every 6 hours, and on demand via `POST /api/google/sync-calendar`.
6. **Drive**: create a folder the account can edit and set
   `GOOGLE_DRIVE_FOLDER_ID` (the ID segment of the folder URL). Packing-list
   PDFs attached to request emails are then archived there automatically
   (same-name files are updated, not duplicated).

A service account also still works as a fallback: set
`GOOGLE_SERVICE_ACCOUNT_KEY` (JSON key, raw or base64) instead of the OAuth
vars, and share the calendar/folder with the key's `client_email`.

`GET /health` shows the auth mode and whether each side is configured.

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
