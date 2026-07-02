# Email relay (shipping@elevatordisco.com)

Minimal Apps Script project that sends mail for the PO App API. **No Google Sheet required.**

The API server (`server/src/email.js`) POSTs to this Web app; mail is sent via `MailApp` as **whoever deploys the script** — use `shipping@elevatordisco.com`.

## One-time setup

### 1. Create the Apps Script project

1. Sign in to Google as **shipping@elevatordisco.com**.
2. Open [script.google.com](https://script.google.com) → **New project**.
3. Name it e.g. `PO App Email Relay`.

### 2. Link clasp (on your dev machine)

```bash
npx clasp login   # use shipping@ when prompted
```

Copy the **Script ID** from **Project settings** into [.clasp.email.json](../.clasp.email.json):

```json
{
  "scriptId": "paste-script-id-here",
  "deploymentId": "YOUR_EMAIL_RELAY_DEPLOYMENT_ID_HERE",
  "rootDir": "email-relay"
}
```

### 3. Push code

```bash
npm run push:email
```

Or full push + deploy update:

```bash
npm run redeploy:email
```

(First time you need a deployment — step 4 — before `redeploy:email` works.)

### 4. Deploy as Web app

In the Apps Script editor (still as shipping@):

1. **Deploy → New deployment**
2. Type: **Web app**
3. **Execute as:** Me (`shipping@elevatordisco.com`)
4. **Who has access:** Anyone
5. Deploy and copy the `/exec` URL.

Put the **deployment ID** (middle segment of the URL, between `/s/` and `/exec`) into `deploymentId` in [.clasp.email.json](../.clasp.email.json).

Example URL:

`https://script.google.com/macros/s/AKfycbxxxxxxxx/exec`  
→ `deploymentId` = `AKfycbxxxxxxxx`

### 5. Configure the relay token

In the Apps Script editor:

1. Select `setupEmailRelayToken` in the function dropdown → **Run**.
2. Authorize the script (Gmail send scope only).
3. Open **Executions** or **View → Logs** and copy the token.

Set on the API server:

| Variable | Value |
|----------|--------|
| `APPS_SCRIPT_URL` | The `/exec` URL from step 4 |
| `APPS_SCRIPT_EMAIL_TOKEN` | Token from `setupEmailRelayToken()` |

**Render:** Dashboard → `po-app-api` → Environment → add both variables → redeploy.

**Local:** Add to `server/.env`.

### 6. Verify

Open the `/exec` URL in a browser. You should see:

```json
{"ok":true,"service":"po-app-email-relay","tokenConfigured":true}
```

From the app, resend a request email and confirm **Email Status = Sent** and messages come **from shipping@**.

## Routine updates

After editing `email-relay/Code.gs`:

```bash
npm run redeploy:email
```

(Log in with `npx clasp login` as **shipping@** — not support@ — if needed.)

**Important:** Web app emails send as whoever owns the deployment. In the Apps Script editor (as shipping@), open **Deploy → Manage deployments** and confirm **Execute as: Me** shows `shipping@elevatordisco.com`. If it shows another account, create a new deployment version while logged in as shipping@.

## Security

- The Web app URL is public; every POST must include `token` matching the `EMAIL_RELAY_TOKEN` script property.
- Only the API server should know that token (`APPS_SCRIPT_EMAIL_TOKEN`).
- To rotate: run `setupEmailRelayToken()` again and update Render/local env.

## Scope

This standalone relay is the only remaining Apps Script component. The app data backend is the Express/Supabase API.
