# Deploying the PO App

The app now uses GitHub Pages for the frontend and the Express/Supabase API for data and PDF generation. The old sheet-bound Apps Script backend has been removed.

## Frontend

GitHub Pages serves the static app from this repo. Push frontend changes to the configured Pages branch and refresh the live app after Pages finishes publishing.

## API Backend

The frontend calls the API URL configured in `js/config.js`. The API server owns Supabase access, request email assembly, and packing-list PDF generation.

Deploy API changes from the `server/` app using the hosting provider workflow for `https://po-app-api.onrender.com`.

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
