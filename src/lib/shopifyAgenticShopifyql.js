import { shopifyqlQuery } from "@/lib/shopifyApi";
import {
	SHOPIFY_AGENTIC_SHOPIFYQL_API_VERSIONS,
	getShopifyAdminApiVersion,
} from "@/lib/shopifyShopDomain";

/** Known Shopify Agentic Storefronts channel labels (exact, case-insensitive). */
const AGENTIC_CHANNEL_EXACT = new Set([
	"shop",
	"chatgpt",
	"microsoft copilot",
	"google ai mode and gemini",
	"perplexity",
	"agentic storefronts",
]);

const AGENTIC_CHANNEL_PATTERN =
	/agentic|chatgpt|copilot|gemini|perplexity|google ai|\bshop\b/i;

const AGENTIC_REFERRER_PATTERN =
	/chatgpt|openai|perplexity|copilot|gemini|google ai|claude\.ai/i;

/**
 * @param {unknown} err
 */
function parseErrorMessage(err) {
	if (typeof err === "string") return err;
	return String(err?.message ?? err ?? "");
}

/**
 * @param {unknown} parseErrors
 */
export function isAgenticColumnMissingError(parseErrors) {
	if (!Array.isArray(parseErrors) || parseErrors.length === 0) return false;
	return parseErrors.some((err) => {
		const msg = parseErrorMessage(err);
		return /agentic_|column.*not found|unknown column|invalid dimension|not found/i.test(msg);
	});
}

/**
 * @param {unknown} json
 */
function extractShopifyqlResult(json) {
	const shopifyql = json?.data?.shopifyqlQuery || {};
	return {
		tableData: shopifyql.tableData || { columns: [], rows: [] },
		parseErrors: shopifyql.parseErrors || [],
	};
}

/**
 * Pick one Admin API version for all agentic ShopifyQL calls in a request.
 * Probes agentic_sales_channel on the newest versions first.
 */
export async function resolveAgenticShopifyqlApiVersion(shopUrl, accessToken) {
	const preferred = getShopifyAdminApiVersion();
	const versions = [
		preferred,
		...SHOPIFY_AGENTIC_SHOPIFYQL_API_VERSIONS.filter((v) => v !== preferred),
	];

	const probe = `FROM sales
SHOW net_sales
GROUP BY agentic_sales_channel
SINCE startOfDay(-30d) UNTIL today
LIMIT 1`;

	for (const apiVersion of versions) {
		const json = await shopifyqlQuery(shopUrl, accessToken, probe, { apiVersion });
		const result = extractShopifyqlResult(json);
		if (!isAgenticColumnMissingError(result.parseErrors)) {
			return apiVersion;
		}
	}

	return preferred;
}

/**
 * @param {string} shopUrl
 * @param {string} accessToken
 * @param {string} query
 * @param {string} apiVersion
 */
async function runPinnedAgenticShopifyql(shopUrl, accessToken, query, apiVersion) {
	const json = await shopifyqlQuery(shopUrl, accessToken, query, { apiVersion });
	const result = extractShopifyqlResult(json);
	return {
		query,
		...result,
		apiVersion,
	};
}

/**
 * @param {string} label
 */
export function isAgenticSalesChannelLabel(label) {
	const normalized = String(label ?? "").trim().toLowerCase();
	if (!normalized) return false;
	if (AGENTIC_CHANNEL_EXACT.has(normalized)) return true;
	return AGENTIC_CHANNEL_PATTERN.test(normalized);
}

/**
 * @param {Array<Record<string, unknown>>} rows
 * @param {string} channelKey
 */
function filterAgenticSalesChannelRows(rows, channelKey = "sales_channel") {
	return (rows || []).filter((row) => isAgenticSalesChannelLabel(row?.[channelKey]));
}

function filterAgenticReferrerRows(rows, key = "referrer_source") {
	return (rows || []).filter((row) => {
		const label = String(row?.[key] ?? "").trim();
		return label && AGENTIC_REFERRER_PATTERN.test(label);
	});
}

function buildSalesChannelFallbackQuery(startDate, endDate) {
	return `FROM sales
SHOW net_sales, orders, gross_sales, total_sales
GROUP BY sales_channel
SINCE ${startDate} UNTIL ${endDate}
ORDER BY net_sales DESC
LIMIT 100`;
}

function buildReferringFromSalesQuery(startDate, endDate) {
	return `FROM sales
SHOW net_sales, orders, gross_sales, total_sales
GROUP BY agentic_referring_channel
SINCE ${startDate} UNTIL ${endDate}
ORDER BY net_sales DESC
LIMIT 100`;
}

function buildSessionsReferrerQuery(startDate, endDate) {
	return `FROM sessions
SHOW sessions, online_store_visitors, conversion_rate
GROUP BY referrer_source
SINCE ${startDate} UNTIL ${endDate}
ORDER BY sessions DESC
LIMIT 100`;
}

function buildDailyAgenticSalesQuery(startDate, endDate) {
	return `FROM sales
SHOW net_sales, orders
GROUP BY day, agentic_sales_channel
SINCE ${startDate} UNTIL ${endDate}
ORDER BY day ASC
LIMIT 500`;
}

function buildDailySalesChannelFallbackQuery(startDate, endDate) {
	return `FROM sales
SHOW net_sales, orders
GROUP BY day, sales_channel
SINCE ${startDate} UNTIL ${endDate}
ORDER BY day ASC
LIMIT 500`;
}

function emptyRowsNote(dimension, rowCount) {
	if (rowCount > 0) return null;
	return `Native ${dimension} query succeeded on this API version but returned 0 rows — likely no agentic sales recorded in the selected period (not a code error).`;
}

/**
 * @param {object} params
 * @param {string} params.shopUrl
 * @param {string} params.accessToken
 * @param {string} params.startDate
 * @param {string} params.endDate
 * @param {string} params.apiVersion
 */
export async function fetchAgenticSalesChannelReport({
	shopUrl,
	accessToken,
	startDate,
	endDate,
	apiVersion,
}) {
	const primaryQuery = `FROM sales
SHOW net_sales, orders, gross_sales, total_sales
GROUP BY agentic_sales_channel
SINCE ${startDate} UNTIL ${endDate}
ORDER BY net_sales DESC
LIMIT 100`;

	const primary = await runPinnedAgenticShopifyql(shopUrl, accessToken, primaryQuery, apiVersion);
	if (!isAgenticColumnMissingError(primary.parseErrors)) {
		const rows = primary.tableData?.rows || [];
		return {
			...primary,
			query: primaryQuery,
			dimension: "agentic_sales_channel",
			fallback: null,
			note: emptyRowsNote("agentic_sales_channel", rows.length),
		};
	}

	const fallbackQuery = buildSalesChannelFallbackQuery(startDate, endDate);
	const fallback = await runPinnedAgenticShopifyql(
		shopUrl,
		accessToken,
		fallbackQuery,
		apiVersion
	);
	const allChannelRows = fallback.tableData?.rows || [];
	const filteredRows = filterAgenticSalesChannelRows(allChannelRows, "sales_channel");

	return {
		query: fallbackQuery,
		apiVersion,
		parseErrors: fallback.parseErrors,
		fallback: "sales_channel_filter",
		dimension: "sales_channel",
		tableData: {
			columns: fallback.tableData?.columns?.length
				? fallback.tableData.columns
				: [
						{ name: "sales_channel", displayName: "Sales channel" },
						{ name: "net_sales", displayName: "Net sales" },
						{ name: "orders", displayName: "Orders" },
					],
			rows: filteredRows,
		},
		allSalesChannelsSample: filteredRows.length ? undefined : allChannelRows.slice(0, 15),
		note:
			filteredRows.length > 0
				? "agentic_sales_channel unavailable — matched agentic/Shop channel names from sales_channel."
				: allChannelRows.length > 0
					? "agentic_sales_channel unavailable — no agentic/Shop channels in sales_channel breakdown (see allSalesChannelsSample)."
					: "agentic_sales_channel unavailable and sales_channel breakdown returned no rows for this period.",
	};
}

/**
 * @param {object} params
 */
export async function fetchAgenticReferringChannelReport({
	shopUrl,
	accessToken,
	startDate,
	endDate,
	apiVersion,
}) {
	const salesQuery = buildReferringFromSalesQuery(startDate, endDate);
	const salesAttempt = await runPinnedAgenticShopifyql(
		shopUrl,
		accessToken,
		salesQuery,
		apiVersion
	);

	if (!isAgenticColumnMissingError(salesAttempt.parseErrors)) {
		const rows = salesAttempt.tableData?.rows || [];
		return {
			...salesAttempt,
			query: salesQuery,
			dimension: "agentic_referring_channel",
			schema: "sales",
			fallback: null,
			note: emptyRowsNote("agentic_referring_channel", rows.length),
		};
	}

	const sessionsQuery = buildSessionsReferrerQuery(startDate, endDate);
	const sessionsAttempt = await runPinnedAgenticShopifyql(
		shopUrl,
		accessToken,
		sessionsQuery,
		apiVersion
	);
	const allReferrerRows = sessionsAttempt.tableData?.rows || [];
	const filteredRows = filterAgenticReferrerRows(allReferrerRows, "referrer_source");

	return {
		query: sessionsQuery,
		apiVersion,
		parseErrors: sessionsAttempt.parseErrors,
		dimension: "referrer_source",
		schema: "sessions",
		fallback: "sessions_referrer_filter",
		tableData: {
			columns: sessionsAttempt.tableData?.columns?.length
				? sessionsAttempt.tableData.columns
				: [
						{ name: "referrer_source", displayName: "Referrer source" },
						{ name: "sessions", displayName: "Sessions" },
					],
			rows: filteredRows,
		},
		allReferrerSourcesSample:
			filteredRows.length ? undefined : allReferrerRows.slice(0, 15),
		note:
			filteredRows.length > 0
				? "agentic_referring_channel unavailable — AI/agent referrers from sessions.referrer_source."
				: "agentic_referring_channel unavailable — no AI referrers in sessions for this period (see allReferrerSourcesSample).",
	};
}

/**
 * @param {object} params
 */
export async function fetchAgenticSalesChannelDailyReport({
	shopUrl,
	accessToken,
	startDate,
	endDate,
	apiVersion,
}) {
	const primaryQuery = buildDailyAgenticSalesQuery(startDate, endDate);
	const primary = await runPinnedAgenticShopifyql(shopUrl, accessToken, primaryQuery, apiVersion);

	if (!isAgenticColumnMissingError(primary.parseErrors)) {
		const rows = primary.tableData?.rows || [];
		return {
			...primary,
			query: primaryQuery,
			dimension: "agentic_sales_channel",
			fallback: null,
			note: emptyRowsNote("agentic_sales_channel (daily)", rows.length),
		};
	}

	const fallbackQuery = buildDailySalesChannelFallbackQuery(startDate, endDate);
	const fallback = await runPinnedAgenticShopifyql(
		shopUrl,
		accessToken,
		fallbackQuery,
		apiVersion
	);
	const filteredRows = filterAgenticSalesChannelRows(fallback.tableData?.rows, "sales_channel");

	return {
		query: fallbackQuery,
		apiVersion,
		parseErrors: fallback.parseErrors,
		fallback: "sales_channel_filter",
		dimension: "sales_channel",
		tableData: {
			columns: fallback.tableData?.columns?.length
				? fallback.tableData.columns
				: [
						{ name: "day", displayName: "Day" },
						{ name: "sales_channel", displayName: "Sales channel" },
						{ name: "net_sales", displayName: "Net sales" },
						{ name: "orders", displayName: "Orders" },
					],
			rows: filteredRows,
		},
		note: "agentic_sales_channel unavailable — daily breakdown filtered to agentic/Shop sales_channel rows.",
	};
}

/**
 * Run all agentic ShopifyQL reports with one shared resolved API version.
 */
export async function fetchAllAgenticShopifyqlReports(shopUrl, accessToken, startDate, endDate) {
	const apiVersion = await resolveAgenticShopifyqlApiVersion(shopUrl, accessToken);
	const base = { shopUrl, accessToken, startDate, endDate, apiVersion };

	const [salesByAgenticSalesChannel, salesByAgenticReferringChannel, agenticSalesChannelDaily] =
		await Promise.all([
			fetchAgenticSalesChannelReport(base),
			fetchAgenticReferringChannelReport(base),
			fetchAgenticSalesChannelDailyReport(base),
		]);

	return {
		shopifyqlApiVersion: apiVersion,
		salesByAgenticSalesChannel,
		salesByAgenticReferringChannel,
		agenticSalesChannelDaily,
	};
}
