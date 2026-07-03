/**
 * Google Calendar + Drive integration (service account).
 *
 * Configuration (all optional — features no-op when unset):
 *   GOOGLE_SERVICE_ACCOUNT_KEY  service-account JSON key, raw or base64-encoded
 *   GOOGLE_CALENDAR_ID          calendar to sync PO/request dates into
 *   GOOGLE_DRIVE_FOLDER_ID      Drive folder that receives generated PDFs
 *
 * Setup: share the target calendar ("Make changes to events") and Drive
 * folder ("Editor") with the service account's client_email.
 *
 * Calendar events are managed idempotently: every event gets a deterministic
 * ID derived from its source record plus a private extended property
 * (poAppManaged=true) so the sync only ever touches events it created.
 */

import crypto from "node:crypto";
import { JWT } from "google-auth-library";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

function parseServiceAccountKey(raw) {
  if (!raw) return null;
  const text = raw.trim().startsWith("{")
    ? raw
    : Buffer.from(raw, "base64").toString("utf8");
  try {
    const key = JSON.parse(text);
    return key.client_email && key.private_key ? key : null;
  } catch {
    return null;
  }
}

const serviceAccountKey = parseServiceAccountKey(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
export const calendarId = (process.env.GOOGLE_CALENDAR_ID || "").trim();
export const driveFolderId = (process.env.GOOGLE_DRIVE_FOLDER_ID || "").trim();

if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY && !serviceAccountKey) {
  console.warn("GOOGLE_SERVICE_ACCOUNT_KEY is set but could not be parsed — Google integration disabled.");
}

export const calendarConfigured = Boolean(serviceAccountKey && calendarId);
export const driveConfigured = Boolean(serviceAccountKey && driveFolderId);

let authClient = null;
function getAuthClient() {
  if (!serviceAccountKey) return null;
  if (!authClient) {
    authClient = new JWT({
      email: serviceAccountKey.client_email,
      key: serviceAccountKey.private_key,
      scopes: [CALENDAR_SCOPE, DRIVE_SCOPE],
    });
  }
  return authClient;
}

async function googleFetch(url, options = {}) {
  const client = getAuthClient();
  if (!client) throw new Error("Google service account not configured.");
  const { token } = await client.getAccessToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  return res;
}

async function googleJson(url, options = {}) {
  const res = await googleFetch(url, options);
  const text = await res.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch { /* non-JSON error body */ }
  if (!res.ok) {
    const err = new Error(json?.error?.message || `Google API ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

export function getGoogleStatus() {
  return {
    serviceAccount: serviceAccountKey ? serviceAccountKey.client_email : "",
    calendarConfigured,
    driveConfigured,
  };
}

// ── Calendar ─────────────────────────────────────────────────

const MANAGED_PROP = "poAppManaged";

/** Deterministic Calendar event ID (hex sha1 is valid base32hex). */
export function calendarEventId(...parts) {
  return crypto.createHash("sha1").update(parts.join("|")).digest("hex");
}

function calendarUrl(path, params = {}) {
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}${path}`
  );
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return url;
}

function nextYmd(ymd) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function eventBody({ summary, description, dateYmd }) {
  return {
    summary,
    description: description || "",
    start: { date: dateYmd },
    end: { date: nextYmd(dateYmd) }, // all-day events end the next day (exclusive)
    extendedProperties: { private: { [MANAGED_PROP]: "true" } },
    status: "confirmed",
  };
}

/** List every event this app manages in the calendar. Returns Map(id → event). */
export async function listManagedCalendarEvents() {
  const events = new Map();
  let pageToken = "";
  do {
    const params = {
      privateExtendedProperty: `${MANAGED_PROP}=true`,
      maxResults: "2500",
      singleEvents: "true",
      fields: "items(id,summary,description,start),nextPageToken",
    };
    if (pageToken) params.pageToken = pageToken;
    const json = await googleJson(calendarUrl("/events", params));
    (json.items || []).forEach((ev) => events.set(ev.id, ev));
    pageToken = json.nextPageToken || "";
  } while (pageToken);
  return events;
}

/** Create an event with a fixed ID; if the ID already exists (or was
 *  previously deleted and tombstoned), patch it back into shape instead. */
export async function upsertCalendarEvent(id, { summary, description, dateYmd }) {
  const body = eventBody({ summary, description, dateYmd });
  try {
    await googleJson(calendarUrl("/events"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
  } catch (err) {
    if (err.status !== 409) throw err;
    await patchCalendarEvent(id, body);
  }
}

export async function patchCalendarEvent(id, body) {
  await googleJson(calendarUrl(`/events/${encodeURIComponent(id)}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function deleteCalendarEvent(id) {
  try {
    const res = await googleFetch(calendarUrl(`/events/${encodeURIComponent(id)}`), {
      method: "DELETE",
    });
    if (!res.ok && res.status !== 404 && res.status !== 410) {
      throw new Error(`Calendar delete failed (${res.status})`);
    }
  } catch (err) {
    if (err.status !== 404 && err.status !== 410) throw err;
  }
}

// ── Drive ────────────────────────────────────────────────────

/** Find a file by exact name inside the configured folder. */
async function findDriveFileByName(filename) {
  const q = `name = '${filename.replace(/'/g, "\\'")}' and '${driveFolderId}' in parents and trashed = false`;
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", q);
  url.searchParams.set("fields", "files(id,name)");
  url.searchParams.set("supportsAllDrives", "true");
  url.searchParams.set("includeItemsFromAllDrives", "true");
  const json = await googleJson(url);
  return json.files?.[0] || null;
}

function multipartBody(metadata, buffer, mimeType, boundary) {
  const head = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`
  );
  const tail = Buffer.from(`\r\n--${boundary}--`);
  return Buffer.concat([head, buffer, tail]);
}

/**
 * Upload a file into the configured Drive folder.
 * If a file with the same name already exists there, its content is replaced
 * (new version) instead of creating a duplicate.
 * Returns { id, webViewLink } on success.
 */
export async function uploadFileToDrive({ filename, buffer, mimeType = "application/pdf" }) {
  if (!driveConfigured) throw new Error("Google Drive is not configured.");

  const existing = await findDriveFileByName(filename);
  const boundary = `poapp${crypto.randomBytes(12).toString("hex")}`;
  const headers = { "Content-Type": `multipart/related; boundary=${boundary}` };

  let url;
  let method;
  let metadata;
  if (existing) {
    url = new URL(`https://www.googleapis.com/upload/drive/v3/files/${existing.id}`);
    method = "PATCH";
    metadata = { name: filename };
  } else {
    url = new URL("https://www.googleapis.com/upload/drive/v3/files");
    method = "POST";
    metadata = { name: filename, parents: [driveFolderId] };
  }
  url.searchParams.set("uploadType", "multipart");
  url.searchParams.set("supportsAllDrives", "true");
  url.searchParams.set("fields", "id,webViewLink");

  return googleJson(url, {
    method,
    headers,
    body: multipartBody(metadata, buffer, mimeType, boundary),
  });
}

/** Fire-and-forget Drive archive of email attachments ({filename, contentBase64}). */
export function archiveAttachmentsToDrive(attachments) {
  if (!driveConfigured || !Array.isArray(attachments) || attachments.length === 0) return;
  for (const att of attachments) {
    if (!att?.filename || !att?.contentBase64) continue;
    uploadFileToDrive({
      filename: att.filename,
      buffer: Buffer.from(att.contentBase64, "base64"),
      mimeType: att.mimeType || "application/pdf",
    }).catch((err) => {
      console.warn(`Drive upload failed for ${att.filename}:`, err.message);
    });
  }
}
