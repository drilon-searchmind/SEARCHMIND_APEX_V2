/**
 * Postmark transactional template: external user welcome.
 * Template must define merge vars: product_url, product_name, name, action_url, login_url, username, password, company_name, company_address.
 */

const POSTMARK_URL = "https://api.postmarkapp.com/email/withTemplate";

const DEFAULT_APP_BASE = "https://apex.searchmind.tech";

/** Public app URL for login links (no trailing slash internally). */
export function getWelcomeAppBaseUrl() {
	const raw =
		process.env.POSTMARK_APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_BASE;
	return String(raw).replace(/\/$/, "");
}

export function buildExternalUserWelcomeTemplateModel({ name, email, plainPassword }) {
	const base = getWelcomeAppBaseUrl();
	const loginUrl = `${base}/`;

	return {
		product_url: loginUrl,
		product_name: process.env.POSTMARK_PRODUCT_NAME || "Searchmind Apex",
		name: name || "there",
		action_url: loginUrl,
		login_url: loginUrl,
		username: email,
		password: plainPassword,
		company_name: process.env.POSTMARK_COMPANY_NAME || "Searchmind",
		company_address: process.env.POSTMARK_COMPANY_ADDRESS || "",
	};
}

/**
 * @returns {Promise<{ ok: true, data: object } | { ok: false, skipped?: boolean, reason?: string, error?: unknown }>}
 */
export async function sendExternalUserWelcomeEmail({ to, name, email, plainPassword }) {
	const token = process.env.POSTMARK_API_TOKEN;
	if (!token) {
		console.warn("[postmark] POSTMARK_API_TOKEN missing; welcome email not sent");
		return { ok: false, skipped: true, reason: "no_token" };
	}

	const from = process.env.POSTMARK_FROM || "mc@searchmind.dk";

	const templateAlias = process.env.POSTMARK_TEMPLATE_ALIAS?.trim();
	const templateIdRaw = process.env.POSTMARK_TEMPLATE_ID;
	const templateId = templateIdRaw ? parseInt(templateIdRaw, 10) : 44428826;

	if (!templateAlias && (!Number.isFinite(templateId) || templateId <= 0)) {
		console.warn("[postmark] Set POSTMARK_TEMPLATE_ID or POSTMARK_TEMPLATE_ALIAS; welcome email not sent");
		return { ok: false, skipped: true, reason: "no_template" };
	}

	const body = {
		From: from,
		To: to,
		TemplateModel: buildExternalUserWelcomeTemplateModel({ name, email, plainPassword }),
		MessageStream: "outbound",
	};

	if (templateAlias) body.TemplateAlias = templateAlias;
	else body.TemplateId = templateId;

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
		console.error("[postmark] Welcome email failed:", res.status, data);
		return { ok: false, error: data };
	}

	return { ok: true, data };
}
