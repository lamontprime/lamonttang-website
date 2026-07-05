const DIMENSION_LABELS = {
  leadership: "Leadership clarity",
  culture: "Culture and incentives",
  data: "Data and infrastructure",
  workflow: "Workflow adoption",
  governance: "Governance judgment"
};

const VALID_FORMS = new Set(["diagnostic", "newsletter", "industry", "mba", "founder"]);

export function scoreDiagnostic(answers = {}) {
  const normalized = {};
  for (const key of Object.keys(DIMENSION_LABELS)) {
    const value = Number(answers[key]);
    normalized[key] = Number.isFinite(value) ? Math.min(5, Math.max(1, value)) : 3;
  }

  const values = Object.values(normalized);
  const score = Math.round((values.reduce((sum, value) => sum + value, 0) / 25) * 100);
  let segment = "Useful foundation";
  let message = "Useful foundation, but adoption risk is still visible.";
  let recommendation = "Pick one operating workflow, define the decision owner, and measure whether AI changes cycle time, quality, or cost.";

  if (score < 45) {
    segment = "High readiness gap";
    message = "High readiness gap. Start with leadership clarity and operating constraints before buying more tools.";
    recommendation = "Run a 90-minute leadership alignment session before funding new AI pilots. Name the business problem, accountable owner, constraints, and adoption metric.";
  } else if (score >= 75) {
    segment = "Ready to scale";
    message = "Strong base. The next challenge is scaling adoption without theatre.";
    recommendation = "Move from pilots to operating cadence: owner, weekly review, governance threshold, and a named workflow where AI changes how work gets done.";
  }

  const weakestDimension = Object.entries(normalized).sort((a, b) => a[1] - b[1])[0][0];

  return {
    score,
    segment,
    message,
    recommendation,
    weakestDimension,
    weakestLabel: DIMENSION_LABELS[weakestDimension],
    answers: normalized
  };
}

function safeString(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  return String(value).slice(0, 2000);
}

function validateLead(input) {
  if (!input || typeof input !== "object") throw new Error("Invalid payload.");
  const formName = safeString(input.formName);
  if (!VALID_FORMS.has(formName)) throw new Error("Unknown form type.");
  const data = input.data && typeof input.data === "object" ? input.data : {};
  const email = safeString(data.email).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("A valid email is required.");
  return { formName, data, email };
}

function wrapLine(text, width = 86) {
  const words = safeString(text).replace(/\s+/g, " ").trim().split(" ");
  const lines = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > width) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function pdfEscape(text) {
  return safeString(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function toBase64(input) {
  if (typeof btoa === "function") return btoa(input);
  return Buffer.from(input, "binary").toString("base64");
}

export function buildReportLines(lead, diagnostic) {
  const name = safeString(lead.data.first_name || lead.data.name || "Reader", "Reader");
  const segment = safeString(lead.data.segment || "Not provided");
  const lines = [
    "Lamont Tang - AI Readiness Snapshot",
    "AI Strategy. Built in the Trenches.",
    "",
    `Name: ${name}`,
    `Email: ${lead.email}`,
    `Audience lens: ${segment}`,
    `Readiness score: ${diagnostic.score}%`,
    `Profile: ${diagnostic.segment}`,
    "",
    diagnostic.message,
    "",
    "Dimension scores"
  ];

  for (const [key, label] of Object.entries(DIMENSION_LABELS)) {
    lines.push(`${label}: ${diagnostic.answers[key]}/5`);
  }

  lines.push(
    "",
    `Weakest dimension: ${diagnostic.weakestLabel}`,
    `Recommended next move: ${diagnostic.recommendation}`,
    "",
    "How to use this result",
    "Treat the score as a conversation starter, not a grade. The useful move is to pick the weakest operating assumption and test it against a real workflow within two weeks.",
    "",
    "Next step",
    "Reply to the diagnostic email or submit the relevant Industry Partner, MBA, or Founder intake form at lamonttang.com."
  );

  return lines.flatMap((line) => wrapLine(line));
}

export function buildSimplePdfBase64(lines) {
  const textCommands = lines.slice(0, 48).map((line) => `(${pdfEscape(line)}) Tj T*`).join("\n");
  const stream = `BT /F1 11 Tf 50 760 Td 14 TL\n${textCommands}\nET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return toBase64(pdf);
}

function buildHtmlEmail(lead, diagnostic, isDiagnostic) {
  const name = safeString(lead.data.first_name || lead.data.name || "there", "there");
  if (!isDiagnostic) {
    return `<p>Hi ${name},</p><p>Thanks for reaching out through lamonttang.com. Your submission has been captured and routed for review.</p><p>Lamont Tang<br>AI Strategy. Built in the Trenches.</p>`;
  }
  return `<p>Hi ${name},</p><p>Your AI Readiness Snapshot is attached as a PDF.</p><p><strong>Score:</strong> ${diagnostic.score}%<br><strong>Profile:</strong> ${diagnostic.segment}<br><strong>Weakest dimension:</strong> ${diagnostic.weakestLabel}</p><p>${diagnostic.recommendation}</p><p>Lamont Tang<br>AI Strategy. Built in the Trenches.</p>`;
}

async function storeLead(env, record) {
  if (!env?.LEADS_KV?.put) return { mode: "not_configured" };
  await env.LEADS_KV.put(record.id, JSON.stringify(record), {
    metadata: {
      formName: record.formName,
      email: record.email,
      createdAt: record.createdAt
    }
  });
  return { mode: "kv", key: record.id };
}

async function sendViaResend(env, lead, diagnostic, pdfBase64) {
  if (!env?.RESEND_API_KEY) return { mode: "mock", sent: false, reason: "RESEND_API_KEY not configured" };

  const isDiagnostic = lead.formName === "diagnostic";
  const to = [lead.email];
  const bcc = env.LAMONT_INBOX ? [env.LAMONT_INBOX] : undefined;
  const subject = isDiagnostic
    ? `Your AI Readiness Snapshot: ${diagnostic.score}%`
    : `Lamont Tang site submission received: ${lead.formName}`;

  const emailPayload = {
    from: env.FROM_EMAIL || "Lamont Tang <hello@lamonttang.com>",
    to,
    bcc,
    subject,
    html: buildHtmlEmail(lead, diagnostic, isDiagnostic)
  };

  if (isDiagnostic && pdfBase64) {
    emailPayload.attachments = [{
      filename: "Lamont-Tang-AI-Readiness-Snapshot.pdf",
      content: pdfBase64
    }];
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(emailPayload)
  });

  const responseText = await response.text();
  if (!response.ok) {
    return { mode: "error", sent: false, status: response.status, detail: responseText.slice(0, 500) };
  }

  return { mode: "sent", sent: true, provider: "resend", detail: responseText.slice(0, 500) };
}

export async function processLead(input, env = {}) {
  const lead = validateLead(input);
  const createdAt = new Date().toISOString();
  const id = `${createdAt.replace(/[:.]/g, "-")}-${lead.formName}-${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;
  const diagnostic = lead.formName === "diagnostic"
    ? scoreDiagnostic(input.diagnosticAnswers)
    : null;
  const reportLines = diagnostic ? buildReportLines(lead, diagnostic) : [];
  const pdfBase64 = diagnostic ? buildSimplePdfBase64(reportLines) : null;

  const record = {
    id,
    formName: lead.formName,
    email: lead.email,
    data: lead.data,
    diagnostic,
    submittedAt: input.submittedAt || createdAt,
    pageUrl: safeString(input.pageUrl),
    createdAt
  };

  const storage = await storeLead(env, record);
  const email = await sendViaResend(env, lead, diagnostic, pdfBase64);

  const message = lead.formName === "diagnostic"
    ? (email.mode === "sent"
      ? "Report generated and emailed. You can also download the PDF here."
      : "Report generated. Email is in mock mode until RESEND_API_KEY is configured.")
    : (email.mode === "sent"
      ? "Submission captured and confirmation email sent."
      : "Submission captured. Email is in mock mode until RESEND_API_KEY is configured.");

  return {
    ok: true,
    id,
    formName: lead.formName,
    message,
    diagnostic,
    reportLines,
    pdfBase64,
    storage,
    email
  };
}
