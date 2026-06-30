const DEFAULT_EMAIL_TIMEOUT_MS = 60_000;

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
  return {
    configured: Boolean(appsScriptUrl),
    provider: appsScriptUrl ? "appsscript" : "none",
  };
}

export async function sendEmail({ to, cc = "", subject, text = "", html = "" } = {}) {
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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_EMAIL_TIMEOUT_MS);

  try {
    const res = await fetch(appsScriptUrl, {
      method: "POST",
      body: JSON.stringify({
        action: "sendRawEmail",
        to: normalizedTo,
        cc: normalizedCc,
        subject: normalizedSubject,
        body,
        htmlBody,
      }),
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
