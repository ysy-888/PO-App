/**
 * One-time Google OAuth setup for the PO App.
 *
 * Walks through the consent flow as the account that should own the
 * calendar events and Drive files (e.g. shipping@elevatordisco.com) and
 * prints the GOOGLE_OAUTH_REFRESH_TOKEN to configure on the server.
 *
 * Prerequisites (Google Cloud console → APIs & Services):
 *   - OAuth consent screen configured (User type: Internal)
 *   - An OAuth client ID of type "Desktop app"
 *   - Calendar API + Drive API enabled
 *
 * Usage (from the server/ directory, with GOOGLE_OAUTH_CLIENT_ID and
 * GOOGLE_OAUTH_CLIENT_SECRET in server/.env or the environment):
 *
 *   node scripts/google-oauth-setup.mjs
 *
 * Then open the printed URL, sign in as the target account, approve,
 * and copy the printed refresh token into server/.env and Render.
 */

import "dotenv/config";
import http from "node:http";
import { OAuth2Client } from "google-auth-library";
import { GOOGLE_SCOPES } from "../src/google.js";

const clientId = (process.env.GOOGLE_OAUTH_CLIENT_ID || "").trim();
const clientSecret = (process.env.GOOGLE_OAUTH_CLIENT_SECRET || "").trim();

if (!clientId || !clientSecret) {
  console.error(
    "Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET first (in server/.env or the environment).\n" +
    "Create them in Google Cloud console → APIs & Services → Credentials → Create credentials → OAuth client ID → Desktop app."
  );
  process.exit(1);
}

const PORT = 53682;
const redirectUri = `http://127.0.0.1:${PORT}/callback`;
const client = new OAuth2Client(clientId, clientSecret, redirectUri);

const authUrl = client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent", // force a refresh token even if previously authorized
  scope: GOOGLE_SCOPES,
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, redirectUri);
  if (url.pathname !== "/callback") {
    res.writeHead(404).end();
    return;
  }

  const errorParam = url.searchParams.get("error");
  const code = url.searchParams.get("code");

  if (errorParam || !code) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end(`Authorization failed: ${errorParam || "no code returned"}. You can close this tab.`);
    console.error(`\nAuthorization failed: ${errorParam || "no code returned"}`);
    server.close();
    process.exit(1);
  }

  try {
    const { tokens } = await client.getToken(code);
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Authorized! You can close this tab and return to the terminal.");

    if (!tokens.refresh_token) {
      console.error(
        "\nGoogle did not return a refresh token. This usually means the app was already " +
        "authorized for this account — remove it under myaccount.google.com → Security → " +
        "Third-party access, then run this script again."
      );
      server.close();
      process.exit(1);
    }

    console.log("\nSuccess! Add this to server/.env and to the Render environment:\n");
    console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}\n`);
    console.log("(GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET are also required on Render.)");
    server.close();
    process.exit(0);
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Token exchange failed — check the terminal.");
    console.error("\nToken exchange failed:", err.message);
    server.close();
    process.exit(1);
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("\n1. Open this URL in your browser:");
  console.log(`\n${authUrl}\n`);
  console.log("2. Sign in as the account that should own the calendar/Drive files");
  console.log("   (e.g. shipping@elevatordisco.com) and click Allow.");
  console.log("\nWaiting for authorization…");
});
