/**
 * PO App — email relay for shipping@elevatordisco.com
 *
 * Standalone Apps Script project (no spreadsheet). The API server calls this
 * Web app to send mail via MailApp as the deploying user.
 *
 * One-time setup after first deploy:
 *   1. Run setupEmailRelayToken() once in the Apps Script editor.
 *   2. Copy the logged token to APPS_SCRIPT_EMAIL_TOKEN on the API server.
 */

function corsResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function errorResponse_(err) {
  console.error(err && err.stack ? err.stack : err);
  const message = err && err.message ? String(err.message).trim() : "";
  return corsResponse({
    success: false,
    error: message || "Request failed.",
  });
}

function normalizeEmailRecipients_(value) {
  return String(value ?? "")
    .split(/[;,\n\r]+/)
    .map(function(email) { return email.trim(); })
    .filter(Boolean)
    .join(", ");
}

function isAuthorizedRequest_(payload) {
  const expected = PropertiesService.getScriptProperties().getProperty("EMAIL_RELAY_TOKEN");
  if (!expected) return false;
  return payload && String(payload.token || "") === expected;
}

function handleSendRawEmail(payload) {
  const to = normalizeEmailRecipients_(payload.to);
  const cc = normalizeEmailRecipients_(payload.cc);
  const subject = String(payload.subject ?? "").trim();
  const body = String(payload.body ?? "").trim();
  const htmlBody = String(payload.htmlBody ?? "").trim();

  if (!to) return corsResponse({ success: false, error: "Recipient email is required." });
  if (!subject) return corsResponse({ success: false, error: "Subject is required." });
  if (!body && !htmlBody) return corsResponse({ success: false, error: "Message body is required." });

  const options = {
    to: to,
    subject: subject,
    body: body || htmlBody.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
  };
  if (htmlBody) options.htmlBody = htmlBody;
  if (cc) options.cc = cc;
  if (Array.isArray(payload.attachments) && payload.attachments.length > 0) {
    options.attachments = payload.attachments.map(function(item) {
      const bytes = Utilities.base64Decode(String(item.contentBase64 || ""));
      return Utilities.newBlob(
        bytes,
        String(item.mimeType || "application/pdf"),
        String(item.filename || "attachment.pdf")
      );
    });
  }
  MailApp.sendEmail(options);
  return corsResponse({ success: true });
}

function doGet() {
  const tokenConfigured = Boolean(
    PropertiesService.getScriptProperties().getProperty("EMAIL_RELAY_TOKEN")
  );
  return corsResponse({
    ok: true,
    service: "po-app-email-relay",
    tokenConfigured: tokenConfigured,
  });
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return corsResponse({ success: false, error: "Empty request body." });
    }
    const payload = JSON.parse(e.postData.contents);
    if (!isAuthorizedRequest_(payload)) {
      return corsResponse({ success: false, error: "Unauthorized." });
    }
    const action = String(payload.action || "");
    if (action === "sendRawEmail") return handleSendRawEmail(payload);
    return corsResponse({ success: false, error: "Unknown action: " + action });
  } catch (err) {
    return errorResponse_(err);
  }
}

/**
 * Run once in the Apps Script editor (logged in as shipping@).
 * Logs a token — copy it to APPS_SCRIPT_EMAIL_TOKEN on Render / server .env.
 */
function setupEmailRelayToken() {
  const token = Utilities.getUuid() + Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperty("EMAIL_RELAY_TOKEN", token);
  Logger.log("EMAIL_RELAY_TOKEN configured. Set this on the API server as APPS_SCRIPT_EMAIL_TOKEN:\n" + token);
  return token;
}
