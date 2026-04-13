/**
 * Send a test email using a Postmark *template* (the HTML lives in Postmark; this only supplies merge data).
 *
 * Run from repo root:
 *   node scripts/send-postmark-welcome-test.js
 *
 * Required in .env:
 *   POSTMARK_API_TOKEN=your-server-api-token
 *
 * Optional:
 *   POSTMARK_TEMPLATE_ID=44428826 (numeric ID from template URL — default below)
 *   POSTMARK_TEMPLATE_ALIAS=my-alias  (if you set an alias in Postmark, use this instead of ID)
 *   POSTMARK_FROM=mc@searchmind.dk    (must be a verified sender or on a verified domain)
 *   POSTMARK_TO=dbr@searchmind.dk
 *   POSTMARK_APP_BASE_URL=https://apex.searchmind.tech (optional; this is the default)
 *
 * Optional test merge overrides:
 *   TEMPLATE_NAME, TEMPLATE_USERNAME, TEMPLATE_PASSWORD
 *
 * Docs: https://postmarkapp.com/developer/api/templates-api#send-email-with-template
 */

import "dotenv/config";

import {
  buildExternalUserWelcomeTemplateModel,
  getWelcomeAppBaseUrl,
} from "../lib/postmarkWelcomeEmail.js";

const POSTMARK_URL = "https://api.postmarkapp.com/email/withTemplate";

const token = process.env.POSTMARK_API_TOKEN;
const templateIdRaw = process.env.POSTMARK_TEMPLATE_ID;
const templateAlias = process.env.POSTMARK_TEMPLATE_ALIAS?.trim();
/** Default matches template in server …/templates/44428826/edit */
const templateId = templateIdRaw ? parseInt(templateIdRaw, 10) : 44428826;

const from = process.env.POSTMARK_FROM || "mc@searchmind.dk";
const to = process.env.POSTMARK_TO || "dbr@searchmind.dk";

if (!token) {
  console.error("Missing POSTMARK_API_TOKEN in .env");
  process.exit(1);
}

if (!templateAlias && (!Number.isFinite(templateId) || templateId <= 0)) {
  console.error("Set POSTMARK_TEMPLATE_ID to a positive number, or POSTMARK_TEMPLATE_ALIAS.");
  process.exit(1);
}

const templateModel = buildExternalUserWelcomeTemplateModel({
  name: process.env.TEMPLATE_NAME || "there",
  email: process.env.TEMPLATE_USERNAME || "you@example.com",
  plainPassword: process.env.TEMPLATE_PASSWORD || "test-password-123",
});

console.log("Using app base URL:", getWelcomeAppBaseUrl());

const body = {
  From: from,
  To: to,
  TemplateModel: templateModel,
  MessageStream: "outbound",
};

if (templateAlias) {
  body.TemplateAlias = templateAlias;
} else {
  body.TemplateId = templateId;
}

const res = await fetch(POSTMARK_URL, {
  method: "POST",
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Postmark-Server-Token": token,
  },
  body: JSON.stringify(body),
});

const data = await res.json().catch(() => ({}));

if (!res.ok) {
  console.error("Postmark error:", res.status, data);
  process.exit(1);
}

console.log("Sent OK. Postmark response:", JSON.stringify(data, null, 2));
