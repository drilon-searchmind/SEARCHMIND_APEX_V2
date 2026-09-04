import { shopifyqlQuery } from "@/lib/shopifyApi";
import { isDemoCustomerId } from "@/lib/demoCustomer";
import { parseMcpDateRange } from "@root/lib/mcpApiHelpers";
import { loadShopifyCredentialsForMcp } from "@root/lib/mcpProxyAllowlist";

/** Domains commonly used by AI / agentic referrers (substring match, lowercase). */
const AI_REFERRER_DOMAIN_PATTERN =
	/perplexity|chatgpt|openai|copilot|gemini|claude\.ai|shop\.app|you\.com|phind|meta\.ai/i;

/**
 * @param {string} startDate
 * @param {string} endDate
 * @param {{ humanOnly?: boolean, limit?: number }} [options]
 */
export function buildTrafficByReferrerDomainQuery(startDate, endDate, options = {}) {
	const humanOnly = options.humanOnly !== false;
	const limit = Math.min(Math.max(options.limit ?? 250, 1), 500);
	const whereClause = humanOnly ? "\nWHERE human_or_bot_session = 'human'" : "";

	return `FROM sessions
SHOW sessions, online_store_visitors, conversion_rate
GROUP BY referrer_domain${whereClause}
SINCE ${startDate} UNTIL ${endDate}
ORDER BY sessions DESC
LIMIT ${limit}`;
}

/**
 * @param {unknown} domain
 */
export function isAiReferrerDomain(domain) {
	const normalized = String(domain ?? "").trim().toLowerCase();
	if (!normalized) return false;
	return AI_REFERRER_DOMAIN_PATTERN.test(normalized);
}

/**
 * @param {Array<Record<string, unknown>>} rows
 */
export function filterAiReferrerDomainRows(rows) {
	return (rows || []).filter((row) => isAiReferrerDomain(row?.referrer_domain));
}

/**
 * @param {string} shopUrl
 * @param {string} accessToken
 * @param {string} query
 */
async function runShopifyql(shopUrl, accessToken, query) {
	const res = await shopifyqlQuery(shopUrl, accessToken, query);
	const shopifyql = res?.data?.shopifyqlQuery || {};
	return {
		query,
		tableData: shopifyql.tableData || { columns: [], rows: [] },
		parseErrors: shopifyql.parseErrors || [],
	};
}

function demoReferrerDomainSessions() {
	return {
		trafficByReferrerDomain: {
			query: buildTrafficByReferrerDomainQuery("2026-06-01", "2026-08-31"),
			tableData: {
				columns: [
					{ name: "referrer_domain", displayName: "Referrer domain" },
					{ name: "sessions", displayName: "Sessions" },
					{ name: "online_store_visitors", displayName: "Online store visitors" },
					{ name: "conversion_rate", displayName: "Conversion rate" },
				],
				rows: [
					{ referrer_domain: "google.com", sessions: "4200", online_store_visitors: "3900", conversion_rate: "0.02" },
					{ referrer_domain: "perplexity.ai", sessions: "58", online_store_visitors: "55", conversion_rate: "0.0" },
					{ referrer_domain: "chatgpt.com", sessions: "2263", online_store_visitors: "2083", conversion_rate: "0.008" },
					{ referrer_domain: "facebook.com", sessions: "3100", online_store_visitors: "2900", conversion_rate: "0.015" },
				],
			},
			parseErrors: [],
			dimension: "referrer_domain",
			schema: "sessions",
			humanTrafficOnly: true,
		},
		aiReferrerDomains: {
			rows: [
				{ referrer_domain: "perplexity.ai", sessions: "58", online_store_visitors: "55", conversion_rate: "0.0" },
				{ referrer_domain: "chatgpt.com", sessions: "2263", online_store_visitors: "2083", conversion_rate: "0.008" },
			],
			note: "Subset of referrer_domain rows matching known AI/agent domains (perplexity.ai, chatgpt.com, openai.com, copilot, etc.).",
		},
	};
}

/**
 * Shopify sessions grouped by referrer_domain (domain-level traffic, UTM-independent).
 * @param {string} customerId
 * @param {Record<string, string>} params
 */
export async function fetchMcpShopifyReferrerDomainSessions(customerId, params = {}) {
	const range = parseMcpDateRange(params.startDate, params.endDate);
	const creds = await loadShopifyCredentialsForMcp(customerId);
	const isDemo = isDemoCustomerId(customerId) || creds.isDemo;

	if (isDemo) {
		const demo = demoReferrerDomainSessions();
		return {
			customerId,
			...range,
			demo: true,
			kind: "shopifyql-referrer-domain-sessions",
			...demo,
			notes: referrerDomainNotes(),
		};
	}

	const { startDate, endDate } = range;
	const query = buildTrafficByReferrerDomainQuery(startDate, endDate);
	const trafficByReferrerDomain = await runShopifyql(creds.shopUrl, creds.accessToken, query);
	const allRows = trafficByReferrerDomain.tableData?.rows || [];
	const aiRows = filterAiReferrerDomainRows(allRows);

	return {
		customerId,
		...range,
		kind: "shopifyql-referrer-domain-sessions",
		trafficByReferrerDomain: {
			...trafficByReferrerDomain,
			dimension: "referrer_domain",
			schema: "sessions",
			humanTrafficOnly: true,
			note:
				"Sessions grouped by referring site domain (e.g. perplexity.ai, chatgpt.com). Compares platforms on equal footing regardless of UTM tagging.",
		},
		aiReferrerDomains: {
			rows: aiRows,
			note:
				aiRows.length > 0
					? "Known AI/agent referrer domains in this period — use for Perplexity vs ChatGPT vs Copilot session comparisons."
					: "No known AI/agent referrer domains in this period (see full trafficByReferrerDomain rows).",
		},
		notes: referrerDomainNotes(),
	};
}

function referrerDomainNotes() {
	return [
		"trafficByReferrerDomain: FROM sessions GROUP BY referrer_domain (human traffic only).",
		"Use referrer_domain instead of referrer_source or utm_source when platforms tag links inconsistently.",
		"aiReferrerDomains: filtered subset for perplexity.ai, chatgpt.com, openai.com, copilot, gemini, shop.app, etc.",
		"Pair with /api/shopify-agentic-attribution for order/revenue attribution by channel.",
	];
}
