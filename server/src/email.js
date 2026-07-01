const DEFAULT_EMAIL_TIMEOUT_MS = 60_000;

/** shipping@ standalone email-relay Web app deployment ID */
export const SHIPPING_EMAIL_RELAY_DEPLOYMENT_ID =
  "AKfycbwj21tDgZBM19ALLOPpHMlMCnf9-VY4prU6l0m3K3E5O7S5PxTtXJFGxtQHFLGAEb0";

export function parseRelayDeploymentId(url) {
  const match = /\/macros\/s\/([^/]+)\/exec/.exec(String(url ?? ""));
  return match ? match[1] : "";
}

function normalizeRecipients(value) {
  if (Array.isArray(value)) {
    return value.map(item => String(item ?? "").trim()).filter(Boolean).join(",");
  }
  return String(value ?? "")
    .split(/[;,]/)
    .map(item => item.trim())
    .filter(Boolean)
    .join(",");
}

async function readResponseJson(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(text.trim() || `Email service returned HTTP ${res.status}`);
  }
}

export function getEmailServiceStatus() {
  const appsScriptUrl = String(process.env.APPS_SCRIPT_URL ?? "").trim();
  const emailToken = String(process.env.APPS_SCRIPT_EMAIL_TOKEN ?? "").trim();
  const deploymentId = parseRelayDeploymentId(appsScriptUrl);
  const usingShippingRelay = deploymentId === SHIPPING_EMAIL_RELAY_DEPLOYMENT_ID;
  return {
    configured: Boolean(appsScriptUrl),
    tokenConfigured: Boolean(emailToken),
    provider: appsScriptUrl ? "appsscript" : "none",
    deploymentId,
    usingShippingRelay,
    relayReady: !usingShippingRelay || Boolean(emailToken),
  };
}

function normalizeAttachments(attachments) {
  if (!Array.isArray(attachments) || attachments.length === 0) return [];
  return attachments
    .map(item => ({
      filename: String(item?.filename ?? "attachment.pdf").trim() || "attachment.pdf",
      mimeType: String(item?.mimeType ?? "application/pdf").trim() || "application/pdf",
      contentBase64: String(item?.contentBase64 ?? "").trim(),
    }))
    .filter(item => item.contentBase64);
}

export async function sendEmail({ to, cc = "", subject, text = "", html = "", attachments = [] } = {}) {
  const normalizedTo = normalizeRecipients(to);
  const normalizedCc = normalizeRecipients(cc);
  const normalizedSubject = String(subject ?? "").trim();
  const body = String(text ?? "").trim();
  const htmlBody = String(html ?? "").trim();

  if (!normalizedTo) return { emailSent: false, emailError: "Recipient email is required." };
  if (!normalizedSubject) return { emailSent: false, emailError: "Email subject is required." };
  if (!body && !htmlBody) return { emailSent: false, emailError: "Email body is required." };

  const appsScriptUrl = String(process.env.APPS_SCRIPT_URL ?? "").trim();
  if (!appsScriptUrl) {
    return {
      emailSent: false,
      emailError: "Email service is not configured. Set APPS_SCRIPT_URL on the API server.",
    };
  }

  const emailToken = String(process.env.APPS_SCRIPT_EMAIL_TOKEN ?? "").trim();
  const deploymentId = parseRelayDeploymentId(appsScriptUrl);
  if (deploymentId === SHIPPING_EMAIL_RELAY_DEPLOYMENT_ID && !emailToken) {
    return {
      emailSent: false,
      emailError: "APPS_SCRIPT_EMAIL_TOKEN is not set on the API server.",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_EMAIL_TIMEOUT_MS);

  const normalizedAttachments = normalizeAttachments(attachments);

  try {
    const payload = {
      action: "sendRawEmail",
      to: normalizedTo,
      cc: normalizedCc,
      subject: normalizedSubject,
      body,
      htmlBody,
    };
    if (emailToken) payload.token = emailToken;
    if (normalizedAttachments.length > 0) payload.attachments = normalizedAttachments;

    const res = await fetch(appsScriptUrl, {
      method: "POST",
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const json = await readResponseJson(res);
    if (!json.success) {
      return { emailSent: false, emailError: json.error || `Email service returned HTTP ${res.status}` };
    }
    return { emailSent: true, emailError: "" };
  } catch (err) {
    return {
      emailSent: false,
      emailError: err.name === "AbortError" ? "Email service timed out." : (err.message || String(err)),
    };
  } finally {
    clearTimeout(timeout);
  }
}
