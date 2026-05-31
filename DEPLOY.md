# Deploying the PO App

This app has two parts: **frontend** (HTML/JS/CSS on GitHub Pages) and **backend** (`apps-script.gs` on Google Apps Script). Test and production use **separate Google Sheets**; publishing code does **not** copy sheet data or settings.

## Daily development

1. Edit files locally (`index.html`, `js/`, `po-table.css`, `apps-script.gs`).
2. Open the app and use **Menu → Test Mode** to point at the test spreadsheet.
3. Push backend changes to the test Apps Script project:
   ```bash
   npm install
   npm run push:test
   ```
4. In the app: **Refresh** and verify against test data.

## One-time setup

### Test Google Sheet + Web App

1. **File → Make a copy** of the production spreadsheet (or create a new sheet with matching `POs` headers).
2. On the copy: **Extensions → Apps Script** — paste `apps-script.gs`, save.
3. **Deploy → New deployment → Web app** (Execute as: Me; choose appropriate access).
4. Copy the `/exec` URL into `APPS_SCRIPT_URL_TEST` in [js/config.js](js/config.js).
5. Copy the **Script ID** (Project Settings) into [.clasp.test.json](.clasp.test.json).

### Production Apps Script (clasp)

1. Open the production spreadsheet’s Apps Script project.
2. Copy its **Script ID** into [.clasp.prod.json](.clasp.prod.json).
3. Log in to clasp once:
   ```bash
   npx clasp login
   ```

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
npm run push:prod
```

Then in the **production** Apps Script editor:

- **Deploy → Manage deployments**
- Edit the Web app deployment → **New version** → Deploy

(Or run `npm run deploy:prod` to create a deployment entry; you may still need to attach it to the Web app URL in the UI.)

### 3. Verify

1. Open the live GitHub Pages URL.
2. **Menu → Live Mode** (if you were in test).
3. **Refresh** and confirm production data and behavior.

You can also use **Menu → Publish to production…** (visible in Test Mode) for this checklist inside the app.

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
