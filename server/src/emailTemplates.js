function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(value) {
  const s = String(value ?? "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return s;
  return `${m[2]}/${m[3]}/${m[1].slice(2)}`;
}

function qty(value) {
  const n = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(n) && n !== 0 ? n.toLocaleString() : "";
}

function getPoColumns(rows) {
  const preferred = ["PO #", "Style #", "Color", "Buyer", "Buyer PO #", "PO Qty", "Actual Qty", "Ctn Qty", "Ship Method", "CXL Date"];
  return preferred.filter(col => rows.some(row => String(row?.[col] ?? "").trim()));
}

function buildPoText(rows) {
  if (!rows.length) return "No linked POs.";
  const columns = getPoColumns(rows);
  return [
    columns.join(" | "),
    ...rows.map(row => columns.map(col => {
      if (col.includes("Date")) return formatDate(row[col]);
      if (col.includes("Qty")) return qty(row[col]) || String(row[col] ?? "");
      return String(row[col] ?? "");
    }).join(" | ")),
  ].join("\n");
}

function buildPoHtml(rows) {
  if (!rows.length) return "<p>No linked POs.</p>";
  const columns = getPoColumns(rows);
  const header = columns.map(col => `<th>${escapeHtml(col)}</th>`).join("");
  const body = rows.map(row => `<tr>${columns.map(col => {
    let value = row[col];
    if (col.includes("Date")) value = formatDate(value);
    if (col.includes("Qty")) value = qty(value) || value;
    return `<td>${escapeHtml(value)}</td>`;
  }).join("")}</tr>`).join("");
  return `<table class="po-table"><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
}

function wrapHtml(title, bodyHtml) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: Arial, sans-serif; color: #111827; line-height: 1.5; }
      .card { max-width: 900px; margin: 0 auto; }
      .muted { color: #6b7280; }
      .po-table { border-collapse: collapse; width: 100%; margin-top: 16px; font-size: 13px; }
      .po-table th, .po-table td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
      .po-table th { background: #f9fafb; }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>${escapeHtml(title)}</h2>
      ${bodyHtml}
      <p class="muted">www.elevatordisco.com</p>
    </div>
  </body>
</html>`;
}

function requestNotes(data, field) {
  const notes = String(data?.[field] ?? "").trim();
  return notes ? `\nNotes: ${notes}` : "";
}

function requestNotesHtml(data, field) {
  const notes = String(data?.[field] ?? "").trim();
  return notes ? `<p><strong>Notes:</strong><br>${escapeHtml(notes).replace(/\n/g, "<br>")}</p>` : "";
}

export function buildCustomerEmailHtml(body) {
  return wrapHtml("Elevator Disco", `<p>${escapeHtml(body).replace(/\n/g, "<br>")}</p>`);
}

export function buildExfEmail(requestId, data, poRows) {
  const title = `EXF Request ${requestId}`;
  const subject = `EXF Request ${formatDate(data["EXF Date"])} - ${data.Vendor ?? ""}`.trim();
  const text = [
    "Hello,",
    "",
    "Please confirm EXF readiness for the POs below.",
    "",
    `EXF Request: ${requestId}`,
    `Vendor: ${data.Vendor ?? ""}`,
    `EXF Date: ${formatDate(data["EXF Date"])}`,
    `PO Count: ${poRows.length}${requestNotes(data, "EXF Req Notes")}`,
    "",
    buildPoText(poRows),
    "",
    "www.elevatordisco.com",
  ].join("\n");
  const html = wrapHtml(title, `
    <p>Hello,</p>
    <p>Please confirm EXF readiness for the POs below.</p>
    <p><strong>Vendor:</strong> ${escapeHtml(data.Vendor)}<br>
    <strong>EXF Date:</strong> ${escapeHtml(formatDate(data["EXF Date"]))}<br>
    <strong>PO Count:</strong> ${poRows.length}</p>
    ${requestNotesHtml(data, "EXF Req Notes")}
    ${buildPoHtml(poRows)}
  `);
  return { to: data["Vendor Email"], cc: data["EXF Req CC"], subject, text, html };
}

export function buildAsnEmail(requestId, data, poRows) {
  const title = `ASN Request ${requestId}`;
  const subject = `ASN Request ${formatDate(data["ASN Date"])} - ${data.Buyer ?? ""}`.trim();
  const text = [
    "Hello,",
    "",
    "Please see the ASN request below.",
    "",
    `ASN Request: ${requestId}`,
    `ASN Date: ${formatDate(data["ASN Date"])}`,
    `Buyer: ${data.Buyer ?? ""}`,
    `PO Count: ${poRows.length}${requestNotes(data, "ASN Req Notes")}`,
    "",
    buildPoText(poRows),
    "",
    "www.elevatordisco.com",
  ].join("\n");
  const html = wrapHtml(title, `
    <p>Hello,</p>
    <p>Please see the ASN request below.</p>
    <p><strong>ASN Date:</strong> ${escapeHtml(formatDate(data["ASN Date"]))}<br>
    <strong>Buyer:</strong> ${escapeHtml(data.Buyer)}<br>
    <strong>PO Count:</strong> ${poRows.length}</p>
    ${requestNotesHtml(data, "ASN Req Notes")}
    ${buildPoHtml(poRows)}
  `);
  return { to: data["Buyer Email"], cc: data.CC, subject, text, html };
}

export function buildDeliveryPickupEmail(requestType, requestId, data, poRows) {
  const dateField = requestType === "Delivery" ? "Delivery Date" : "Pickup Date";
  const notesField = requestType === "Delivery" ? "Delivery Req Notes" : "Pickup Req Notes";
  const title = `${requestType} Request ${requestId}`;
  const subject = `${requestType} Request ${formatDate(data[dateField])} - ${data.To ?? ""}`.trim();
  const text = [
    "Hello,",
    "",
    `Please see the ${requestType.toLowerCase()} request below.`,
    "",
    `${requestType} Request: ${requestId}`,
    `${requestType} Date: ${formatDate(data[dateField])}`,
    `From: ${data.From ?? ""}`,
    `To: ${data.To ?? ""}`,
    `PO Count: ${poRows.length}${requestNotes(data, notesField)}`,
    "",
    buildPoText(poRows),
    "",
    "www.elevatordisco.com",
  ].join("\n");
  const html = wrapHtml(title, `
    <p>Hello,</p>
    <p>Please see the ${escapeHtml(requestType.toLowerCase())} request below.</p>
    <p><strong>${escapeHtml(requestType)} Date:</strong> ${escapeHtml(formatDate(data[dateField]))}<br>
    <strong>From:</strong> ${escapeHtml(data.From)}<br>
    <strong>To:</strong> ${escapeHtml(data.To)}<br>
    <strong>PO Count:</strong> ${poRows.length}</p>
    ${requestNotesHtml(data, notesField)}
    ${buildPoHtml(poRows)}
  `);
  return { to: data["Email To"], cc: data["Email CC"], subject, text, html };
}

export function buildApprovalEmail(approvalId, data, poRow = {}) {
  const type = String(data["Approval Type"] ?? "").trim();
  const poNumber = String(data["PO #"] ?? "").trim();
  const title = `${type || "Approval"} Request ${approvalId}`;
  const subject = `${type || "Approval"} Approval Request - PO ${poNumber}`.trim();
  const unitLines = Array.from({ length: 15 }, (_, index) => index + 1)
    .map(i => {
      const label = String(poRow[`Size ${i}`] ?? `Unit ${i}`).trim();
      const value = String(data[`Approval Unit ${i}`] ?? "").trim();
      return value ? `${label}: ${value}` : "";
    })
    .filter(Boolean);
  const text = [
    "Hello,",
    "",
    "Please review the approval request below.",
    "",
    `Approval Request: ${approvalId}`,
    `PO #: ${poNumber}`,
    `Approval Type: ${type}`,
    data["Ext CXL Date"] ? `Ext CXL Date: ${formatDate(data["Ext CXL Date"])}` : "",
    unitLines.length ? `Quantities:\n${unitLines.join("\n")}` : "",
    requestNotes(data, "Approval Req Notes").trim(),
    "",
    "www.elevatordisco.com",
  ].filter(line => line !== "").join("\n");
  const html = wrapHtml(title, `
    <p>Hello,</p>
    <p>Please review the approval request below.</p>
    <p><strong>PO #:</strong> ${escapeHtml(poNumber)}<br>
    <strong>Approval Type:</strong> ${escapeHtml(type)}${data["Ext CXL Date"] ? `<br><strong>Ext CXL Date:</strong> ${escapeHtml(formatDate(data["Ext CXL Date"]))}` : ""}</p>
    ${unitLines.length ? `<p><strong>Quantities:</strong><br>${unitLines.map(escapeHtml).join("<br>")}</p>` : ""}
    ${requestNotesHtml(data, "Approval Req Notes")}
  `);
  return { to: data["Email To"], cc: data["Email CC"], subject, text, html };
}
