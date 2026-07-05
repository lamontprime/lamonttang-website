const DIMENSION_LABELS = {
    leadership: "Leadership clarity",
    culture: "Culture and incentives",
    data: "Data and infrastructure",
    workflow: "Workflow adoption",
    governance: "Governance judgment"
};

const VALID_FORMS = new Set(["diagnostic", "newsletter", "industry", "mba", "founder"]);

const DIGEST_CHECKPOINT_KEY = "__digest_checkpoint__";

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

function htmlEscape(value) {
    return safeString(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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

async function sendEmailViaResend(env, payload) {
    if (!env?.RESEND_API_KEY) return { mode: "mock", sent: false, reason: "RESEND_API_KEY not configured" };

  const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
                Authorization: `Bearer ${env.RESEND_API_KEY}`,
                "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
  });

  const responseText = await response.text();
    if (!response.ok) {
          return { mode: "error", sent: false, status: response.status, detail: responseText.slice(0, 500) };
    }

  return { mode: "sent", sent: true, provider: "resend", detail: responseText.slice(0, 500) };
}

async function sendViaResend(env, lead, diagnostic, pdfBase64) {
    const isDiagnostic = lead.formName === "diagnostic";
    const to = [lead.email];
    // Per-submission BCC to Lamont was removed on 2026-07-05: he now gets one
  // daily digest instead (see runDigest() below / functions/api/digest.js),
  // rather than an email for every single test or real submission.
  const bcc = undefined;
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

  return sendEmailViaResend(env, emailPayload);
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

// ---- Admin / CRM support ----

export function checkAdminSecret(env, request) {
    const configured = env?.ADMIN_SECRET;
    if (!configured) return { ok: false, reason: "ADMIN_SECRET not configured" };
    const url = new URL(request.url);
    const provided = url.searchParams.get("secret") || request.headers.get("x-admin-secret");
    if (provided !== configured) return { ok: false, reason: "Invalid or missing secret" };
    return { ok: true };
}

export async function listLeads(env, { formFilter } = {}) {
    if (!env?.LEADS_KV?.list) return [];
    const leads = [];
    let cursor;
    do {
          const page = await env.LEADS_KV.list({ cursor, limit: 1000 });
          for (const key of page.keys) {
                  if (key.name === DIGEST_CHECKPOINT_KEY) continue;
                  const meta = key.metadata || {};
                  if (formFilter && meta.formName !== formFilter) continue;
                  leads.push({ key: key.name, ...meta });
          }
          cursor = page.cursor;
          if (page.list_complete) break;
    } while (cursor);

  leads.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    return leads;
}

export async function getLeadDetail(env, key) {
    if (!env?.LEADS_KV?.get) return null;
    const raw = await env.LEADS_KV.get(key);
    if (!raw) return null;
    try {
          return JSON.parse(raw);
    } catch {
          return null;
    }
}

export function renderLeadsHtml(leads, { activeFilter } = {}) {
    const filterLink = (name, label) => {
          const href = name ? `?form=${encodeURIComponent(name)}` : "?";
          const active = (activeFilter || "") === (name || "");
          return `<a href="${href}" style="margin-right:12px;${active ? "font-weight:700;color:#B45309;" : "color:#1A2B4A;"}">${htmlEscape(label)}</a>`;
    };

  const rows = leads.map((lead) => {
        const data = lead.data || {};
        const name = htmlEscape(data.first_name || data.name || "—");
        const score = lead.diagnostic ? `${lead.diagnostic.score}%` : "—";
        const summary = htmlEscape(
                data.message || data.description || data.problem || data.challenge || data.segment || ""
              ).slice(0, 140);
        return `<tr>
              <td>${htmlEscape(lead.createdAt || "")}</td>
                    <td><strong>${htmlEscape(lead.formName || "")}</strong></td>
                          <td>${name}</td>
                                <td>${htmlEscape(lead.email || "")}</td>
                                      <td>${score}</td>
                                            <td>${summary}</td>
                                                </tr>`;
  }).join("\n");

  return `<!DOCTYPE html>
  <html>
  <head>
  <meta charset="utf-8">
  <title>Lamont Tang — Leads</title>
  <style>
    body { font-family: Inter, Arial, sans-serif; margin: 32px; color: #0C1524; background: #F8F6F1; }
      h1 { font-family: Montserrat, Arial, sans-serif; color: #1A2B4A; }
        table { border-collapse: collapse; width: 100%; background: #fff; }
          th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #E8EDF5; font-size: 14px; vertical-align: top; }
            th { background: #1A2B4A; color: #fff; }
              .meta { color: #64748B; margin-bottom: 16px; }
              </style>
              </head>
              <body>
              <h1>Leads &amp; Submissions</h1>
              <p class="meta">${leads.length} record(s). ${filterLink(null, "All")} ${filterLink("diagnostic", "Diagnostic")} ${filterLink("newsletter", "Newsletter")} ${filterLink("industry", "Industry")} ${filterLink("mba", "MBA")} ${filterLink("founder", "Founder")}</p>
              <table>
              <thead><tr><th>Submitted</th><th>Form</th><th>Name</th><th>Email</th><th>Score</th><th>Notes</th></tr></thead>
              <tbody>
              ${rows || '<tr><td colspan="6">No submissions yet.</td></tr>'}
              </tbody>
              </table>
              </body>
              </html>`;
}

// ---- Daily digest ----

export async function runDigest(env) {
    if (!env?.LEADS_KV?.list) return { sent: false, reason: "LEADS_KV not configured" };

  const checkpointRaw = await env.LEADS_KV.get(DIGEST_CHECKPOINT_KEY);
    const checkpoint = checkpointRaw || "1970-01-01T00:00:00.000Z";
    const now = new Date().toISOString();

  const allLeads = await listLeads(env);
    const newLeads = allLeads.filter((lead) => (lead.createdAt || "") > checkpoint);

  if (newLeads.length === 0) {
        await env.LEADS_KV.put(DIGEST_CHECKPOINT_KEY, now);
        return { sent: false, reason: "No new submissions since last digest.", checked: allLeads.length };
  }

  const byForm = {};
    for (const lead of newLeads) {
          byForm[lead.formName] = (byForm[lead.formName] || 0) + 1;
    }
    const summaryLine = Object.entries(byForm).map(([form, count]) => `${count} ${form}`).join(", ");

  const rows = newLeads.map((lead) => {
        const data = lead.data || {};
        const name = htmlEscape(data.first_name || data.name || "—");
        return `<li><strong>${htmlEscape(lead.formName)}</strong> — ${name} (${htmlEscape(lead.email)})${lead.diagnostic ? ` — score ${lead.diagnostic.score}%` : ""}</li>`;
  }).join("\n");

  const adminUrl = env.SITE_URL ? `${env.SITE_URL}/admin/leads?secret=YOUR_ADMIN_SECRET` : "/admin/leads";

  const html = `<p>Hi Lamont,</p>
  <p><strong>${newLeads.length} new submission(s)</strong> on lamonttang.com since the last digest (${summaryLine}).</p>
  <ul>${rows}</ul>
  <p>Full detail (including message text) is in the leads view: <a href="${adminUrl}">${adminUrl}</a></p>
  <p>— Automated daily digest</p>`;

  const email = await sendEmailViaResend(env, {
        from: env.FROM_EMAIL || "Lamont Tang <hello@lamonttang.com>",
        to: [env.LAMONT_INBOX || "lamontprime2@gmail.com"],
        subject: `lamonttang.com: ${newLeads.length} new submission${newLeads.length === 1 ? "" : "s"} today`,
        html
  });

  await env.LEADS_KV.put(DIGEST_CHECKPOINT_KEY, now);

  return { sent: email.mode === "sent", count: newLeads.length, email };
}
