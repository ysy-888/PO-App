# Deploying the PO App

This app has two parts: **frontend** (HTML/JS/CSS on GitHub Pages) and **backend** (`apps-script.gs` on Google Apps Script). Test and production use **separate Google Sheets**; publishing code does **not** copy sheet data or settings.

## Daily development

1. Edit files locally (`index.html`, `js/`, `po-table.css`, `apps-script.gs`).
2. Open the app and use **Menu → Test Mode** to point at the test spreadsheet.
3. Publish backend changes to the test Web app (push **and** update the live `/exec` URL):
   ```bash
   npm install
   npm run redeploy:test
   ```
   Optional description: `npm run redeploy:test -- vendor portal fix`
4. In the app: **Refresh** and verify against test data.

**Note:** `npm run push:test` only uploads code to the Apps Script editor. The app calls the `/exec` Web app URL, which stays on an old version until you **redeploy** (command above) or use **Deploy → Manage deployments → New version** in the Apps Script UI.

## One-time setup

### Test Google Sheet + Web App

1. **File → Make a copy** of the production spreadsheet (or create a new sheet with matching `POs` headers).
2. On the copy: **Extensions → Apps Script** — paste `apps-script.gs`, save.
3. **Deploy → New deployment → Web app** (Execute as: Me; choose appropriate access).
4. Copy the `/exec` URL into `APPS_SCRIPT_URL_TEST` in [js/config.js](js/config.js).
5. Copy the **Script ID** (Project Settings) into [.clasp.test.json](.clasp.test.json).
6. Copy the **deployment ID** (middle segment of the `/exec` URL, between `/s/` and `/exec`) into `deploymentId` in [.clasp.test.json](.clasp.test.json).

### Production Apps Script (clasp)

1. Open the production spreadsheet’s Apps Script project.
2. Copy its **Script ID** into [.clasp.prod.json](.clasp.prod.json).
3. Copy the **deployment ID** from `APPS_SCRIPT_URL_LIVE` in [js/config.js](js/config.js) into `deploymentId` in [.clasp.prod.json](.clasp.prod.json).
4. Log in to clasp once:
   ```bash
   npx clasp login
   ```

### API email relay (shipping@ — no spreadsheet)

API mode sends mail through a **standalone** script in [email-relay/](email-relay/). Full steps: [email-relay/README.md](email-relay/README.md).

Summary:

1. Create a new Apps Script project as **shipping@elevatordisco.com** (not bound to a sheet).
2. Fill [.clasp.email.json](.clasp.email.json) with `scriptId` and `deploymentId`.
3. `npm run redeploy:email`
4. Run `setupEmailRelayToken()` once in the editor; set `APPS_SCRIPT_EMAIL_TOKEN` on Render.
5. Set `APPS_SCRIPT_URL` on Render to the new `/exec` URL.

### GitHub Pages

- Repo: `https://github.com/ysy-888/PO-App.git`
- Confirm **Settings → Pages** serves from branch `main` at `/` (repo root).

## Publish to production (code only)

When changes are tested in Test Mode:

### 1. Frontend (GitHub Pages)

```bash
git add .
git commit -m "Describe your change"
git push origin main
```

GitHub Pages updates automatically from `main`.

### 2. Backend (Apps Script)

```bash
npm run redeploy:prod
```

Optional description: `npm run redeploy:prod -- describe your change`

This pushes `apps-script.gs` and updates the **existing** Web app URL (no change to [js/config.js](js/config.js)).

**Alternative (UI):** After `npm run push:prod`, open the production Apps Script editor → **Deploy → Manage deployments** → edit the Web app → **New version** → Deploy.

Do **not** use `npm run deploy:prod` for routine updates — that creates a **new** deployment URL. Use `redeploy:prod` instead.

### 3. Verify

1. Open the live GitHub Pages URL.
2. **Menu → Live Mode** (if you were in test).
3. **Refresh** and confirm production data and behavior.

## Troubleshooting

### Test Mode shows demo rows or “not configured”

In [js/config.js](js/config.js), `URL_PLACEHOLDER` and `TEST_URL_PLACEHOLDER` must stay as the magic strings `YOUR_…_HERE`. Real URLs belong only on `APPS_SCRIPT_URL_LIVE` and `APPS_SCRIPT_URL_TEST`.

### OAuth `401 invalid_client` when deploying Apps Script

- Prefer a **fresh** Apps Script project on the test sheet (paste `apps-script.gs`, authorize by running `doGet` once in the editor).
- Check **Project Settings → Google Cloud Platform project** and OAuth consent screen in Cloud Console.
- For `@elevatordisco.com` Workspace accounts, OAuth may need to be **Internal** to your org.

### clasp push fails

- Ensure `scriptId` in `.clasp.test.json` / `.clasp.prod.json` is correct.
- Run `npx clasp login` with the Google account that owns the script.

### App still runs old backend after push

- `push` alone does not update the Web app. Run `npm run redeploy:test` or `npm run redeploy:prod`.
- If you created a new Web app deployment, update `deploymentId` in the matching `.clasp.*.json` and the URL in [js/config.js](js/config.js).
