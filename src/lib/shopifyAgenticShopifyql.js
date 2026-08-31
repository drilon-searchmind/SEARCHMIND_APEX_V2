import { shopifyqlQuery } from "./shopifyApi.js";
import {
	SHOPIFY_AGENTIC_SHOPIFYQL_API_VERSIONS,
	getShopifyAdminApiVersion,
} from "./shopifyShopDomain.js";

/** Known Shopify Agentic Storefronts channel labels (exact, case-insensitive). */
const AGENTIC_CHANNEL_EXACT = new Set([
	"shop",
	"chatgpt",
	"chatgpt.com",
	"microsoft copilot",
	"google ai mode and gemini",
	"perplexity",
	"agentic storefronts",
	"shop_app",
]);

const AGENTIC_CHANNEL_PATTERN =
	/agentic|chatgpt|copilot|gemini|perplexity|google ai|shop_app|\bshop\b/i;

const AGENTIC_REFERRER_PATTERN =
	/chatgpt|openai|perplexity|copilot|gemini|google ai|claude\.ai|shop_app|shop app/i;

/** UTM sources that indicate AI / agentic storefront traffic in Shopify sessions. */
const AGENTIC_UTM_SOURCE_EXACT = new Set([
	"chatgpt.com",
	"chatgpt",
	"openai",
	"perplexity",
	"copilot.com",
	"copilot",
	"gemini",
	"shop_app",
	"shop app",
]);

const AGENTIC_UTM_SOURCE_PATTERN =
	/chatgpt|openai|perplexity|copilot|gemini|google.?ai|shop_app|shop app/i;

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

/**
 * @param {string} utmSource
 */
export function isAgenticUtmSource(utmSource) {
	const normalized = String(utmSource ?? "").trim().toLowerCase();
	if (!normalized) return false;
	if (AGENTIC_UTM_SOURCE_EXACT.has(normalized)) return true;
	return AGENTIC_UTM_SOURCE_PATTERN.test(normalized);
}

/**
 * @param {Array<Record<string, unknown>>} rows
 */
function filterAgenticUtmRows(rows) {
	return (rows || []).filter((row) => isAgenticUtmSource(row?.utm_source));
}

function buildUtmSourceQuery(startDate, endDate) {
	return `FROM sessions
SHOW sessions, online_store_visitors, conversion_rate
GROUP BY utm_source, utm_medium
SINCE ${startDate} UNTIL ${endDate}
ORDER BY sessions DESC
LIMIT 250`;
}

function buildShopChannelSalesQuery(startDate, endDate) {
	return `FROM sales
SHOW net_sales, orders, gross_sales, total_sales
GROUP BY sales_channel
SINCE ${startDate} UNTIL ${endDate}
ORDER BY net_sales DESC
LIMIT 100`;
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

/**
 * Standard Shopify analytics dimension (documented approximation for Agentic breakdown).
 * @param {string} startDate
 * @param {string} endDate
 * @param {"LAST_CLICK"|"FIRST_CLICK"|null} attribution
 */
function buildReferringChannelSalesQuery(startDate, endDate, attribution = "LAST_CLICK") {
	const withClause =
		attribution === "LAST_CLICK"
			? " WITH LAST_CLICK_ATTRIBUTION"
			: attribution === "FIRST_CLICK"
				? " WITH FIRST_CLICK_ATTRIBUTION"
				: "";
	const orderMetric =
		attribution === "LAST_CLICK"
			? "net_sales__last_click"
			: attribution === "FIRST_CLICK"
				? "net_sales__first_click"
				: "net_sales";

	return `FROM sales
SHOW net_sales, orders, gross_sales, total_sales
GROUP BY referring_channel${withClause}
SINCE ${startDate} UNTIL ${endDate}
ORDER BY ${orderMetric} DESC
LIMIT 100`;
}

/**
 * @param {unknown} label
 */
export function isAgenticReferringChannelLabel(label) {
	return isAgenticSalesChannelLabel(label);
}

/**
 * @param {Array<Record<string, unknown>>} rows
 */
function filterAgenticReferringChannelRows(rows) {
	return (rows || []).filter((row) => isAgenticReferringChannelLabel(row?.referring_channel));
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
 * Shopify-recommended approximation: FROM sales GROUP BY referring_channel.
 * Tries last-click attribution first, then plain GROUP BY.
 * @param {object} params
 */
export async function fetchSalesByReferringChannelReport({
	shopUrl,
	accessToken,
	startDate,
	endDate,
	apiVersion,
}) {
	const defaultColumns = [
		{ name: "referring_channel", displayName: "Referring channel" },
		{ name: "net_sales", displayName: "Net sales" },
		{ name: "orders", displayName: "Orders" },
	];

	const attributedQuery = buildReferringChannelSalesQuery(startDate, endDate, "LAST_CLICK");
	let result = await runPinnedAgenticShopifyql(
		shopUrl,
		accessToken,
		attributedQuery,
		apiVersion
	);
	let attribution = "LAST_CLICK_ATTRIBUTION";
	let query = attributedQuery;

	if (result.parseErrors?.length) {
		const simpleQuery = buildReferringChannelSalesQuery(startDate, endDate, null);
		result = await runPinnedAgenticShopifyql(shopUrl, accessToken, simpleQuery, apiVersion);
		attribution = null;
		query = simpleQuery;
	}

	const allRows = result.tableData?.rows || [];
	const agenticRows = filterAgenticReferringChannelRows(allRows);

	return {
		query,
		apiVersion,
		parseErrors: result.parseErrors,
		dimension: "referring_channel",
		schema: "sales",
		attribution,
		fallback: attribution ? null : "no_attribution",
		tableData: {
			columns: result.tableData?.columns?.length ? result.tableData.columns : defaultColumns,
			rows: allRows,
		},
		agenticApproximation: {
			rows: agenticRows,
			note:
				agenticRows.length > 0
					? "Rows where referring_channel matches known AI/agentic labels — approximate proxy for Agentic widget, not guaranteed to match."
					: "No referring_channel rows matched known AI/agentic labels (see full tableData.rows).",
		},
		note:
			allRows.length > 0
				? "Standard referring_channel sales breakdown (Shopify-suggested approximation for Agentic Storefronts revenue)."
				: "referring_channel query succeeded but returned no rows for this period.",
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

	const referringChannelReport = await fetchSalesByReferringChannelReport({
		shopUrl,
		accessToken,
		startDate,
		endDate,
		apiVersion,
	});
	if (
		!referringChannelReport.parseErrors?.length &&
		(referringChannelReport.tableData?.rows || []).length > 0
	) {
		return {
			...referringChannelReport,
			fallback: "referring_channel",
			note: "agentic_referring_channel unavailable — using standard referring_channel sales breakdown (Shopify-suggested approximation).",
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
	const filteredReferrerRows = filterAgenticReferrerRows(allReferrerRows, "referrer_source");

	const utmQuery = buildUtmSourceQuery(startDate, endDate);
	const utmAttempt = await runPinnedAgenticShopifyql(shopUrl, accessToken, utmQuery, apiVersion);
	const allUtmRows = utmAttempt.tableData?.rows || [];
	const filteredUtmRows = filterAgenticUtmRows(allUtmRows);

	const primaryRows =
		filteredUtmRows.length > 0
			? filteredUtmRows
			: filteredReferrerRows;

	return {
		query: filteredUtmRows.length > 0 ? utmQuery : sessionsQuery,
		apiVersion,
		parseErrors: [...(sessionsAttempt.parseErrors || []), ...(utmAttempt.parseErrors || [])].filter(
			Boolean
		),
		dimension: filteredUtmRows.length > 0 ? "utm_source" : "referrer_source",
		schema: filteredUtmRows.length > 0 ? "sessions" : "sessions",
		fallback: filteredUtmRows.length > 0 ? "sessions_utm_filter" : "sessions_referrer_filter",
		tableData: {
			columns:
				filteredUtmRows.length > 0
					? utmAttempt.tableData?.columns?.length
						? utmAttempt.tableData.columns
						: [
								{ name: "utm_source", displayName: "UTM source" },
								{ name: "utm_medium", displayName: "UTM medium" },
								{ name: "sessions", displayName: "Sessions" },
							]
					: sessionsAttempt.tableData?.columns?.length
						? sessionsAttempt.tableData.columns
						: [
								{ name: "referrer_source", displayName: "Referrer source" },
								{ name: "sessions", displayName: "Sessions" },
							],
			rows: primaryRows,
		},
		trafficByAgenticUtmSource: {
			query: utmQuery,
			tableData: {
				columns: utmAttempt.tableData?.columns || [],
				rows: filteredUtmRows,
			},
			allUtmSourcesSample: filteredUtmRows.length ? undefined : allUtmRows.slice(0, 20),
			parseErrors: utmAttempt.parseErrors || [],
		},
		allReferrerSourcesSample:
			filteredReferrerRows.length ? undefined : allReferrerRows.slice(0, 15),
		note:
			filteredUtmRows.length > 0
				? "agentic_referring_channel unavailable on sales — AI/agent sessions from utm_source (chatgpt.com, perplexity, copilot.com, shop_app, etc.)."
				: filteredReferrerRows.length > 0
					? "agentic_referring_channel unavailable — AI/agent referrers from sessions.referrer_source."
					: "No agentic UTM or referrer traffic in this period (see allUtmSourcesSample / allReferrerSourcesSample).",
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
 * Explicit Shop sales channel row (matches Shopify Admin Agentic widget "Shop" line).
 */
export async function fetchShopChannelSalesReport({
	shopUrl,
	accessToken,
	startDate,
	endDate,
	apiVersion,
}) {
	const query = buildShopChannelSalesQuery(startDate, endDate);
	const result = await runPinnedAgenticShopifyql(shopUrl, accessToken, query, apiVersion);
	const allRows = result.tableData?.rows || [];
	const shopRows = allRows.filter(
		(row) => String(row?.sales_channel ?? "").trim().toLowerCase() === "shop"
	);

	return {
		query,
		apiVersion,
		parseErrors: result.parseErrors,
		dimension: "sales_channel",
		tableData: {
			columns: result.tableData?.columns?.length
				? result.tableData.columns
				: [
						{ name: "sales_channel", displayName: "Sales channel" },
						{ name: "net_sales", displayName: "Net sales" },
						{ name: "orders", displayName: "Orders" },
					],
			rows: shopRows,
		},
		allSalesChannelsSample: shopRows.length ? undefined : allRows.slice(0, 15),
		note:
			shopRows.length > 0
				? "Shop channel sales — closest APEX proxy for Shopify Admin Agentic Storefronts Shop revenue line."
				: "No sales_channel row named Shop in this period.",
	};
}

/**
 * Sessions from AI/agent UTM sources (always included in agentic bundle).
 */
export async function fetchAgenticUtmTrafficReport({
	shopUrl,
	accessToken,
	startDate,
	endDate,
	apiVersion,
}) {
	const query = buildUtmSourceQuery(startDate, endDate);
	const result = await runPinnedAgenticShopifyql(shopUrl, accessToken, query, apiVersion);
	const allRows = result.tableData?.rows || [];
	const filteredRows = filterAgenticUtmRows(allRows);

	return {
		query,
		apiVersion,
		parseErrors: result.parseErrors,
		dimension: "utm_source",
		schema: "sessions",
		tableData: {
			columns: result.tableData?.columns?.length
				? result.tableData.columns
				: [
						{ name: "utm_source", displayName: "UTM source" },
						{ name: "utm_medium", displayName: "UTM medium" },
						{ name: "sessions", displayName: "Sessions" },
					],
			rows: filteredRows,
		},
		allUtmSourcesSample: filteredRows.length ? undefined : allRows.slice(0, 25),
		note: "AI/agent session traffic by utm_source — includes chatgpt.com, perplexity, copilot.com, openai, shop_app.",
	};
}

/**
 * Run all agentic ShopifyQL reports with one shared resolved API version.
 */
export async function fetchAllAgenticShopifyqlReports(shopUrl, accessToken, startDate, endDate) {
	const apiVersion = await resolveAgenticShopifyqlApiVersion(shopUrl, accessToken);
	const base = { shopUrl, accessToken, startDate, endDate, apiVersion };

	const [
		salesByAgenticSalesChannel,
		salesByAgenticReferringChannel,
		salesByReferringChannel,
		agenticSalesChannelDaily,
		shopChannelSales,
		trafficByAgenticUtmSource,
	] = await Promise.all([
		fetchAgenticSalesChannelReport(base),
		fetchAgenticReferringChannelReport(base),
		fetchSalesByReferringChannelReport(base),
		fetchAgenticSalesChannelDailyReport(base),
		fetchShopChannelSalesReport(base),
		fetchAgenticUtmTrafficReport(base),
	]);

	return {
		shopifyqlApiVersion: apiVersion,
		salesByAgenticSalesChannel,
		salesByAgenticReferringChannel,
		salesByReferringChannel,
		agenticSalesChannelDaily,
		shopChannelSales,
		trafficByAgenticUtmSource,
	};
}
