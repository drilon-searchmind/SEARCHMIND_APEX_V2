import { shopifyqlQuery } from "@/lib/shopifyApi";
import { SHOPIFY_AGENTIC_SHOPIFYQL_API_VERSIONS } from "@/lib/shopifyShopDomain";

const AGENTIC_SALES_CHANNEL_PATTERN =
	/agentic|chatgpt|copilot|gemini|perplexity|google ai|shop app/i;

/**
 * @param {unknown} parseErrors
 */
export function isAgenticColumnMissingError(parseErrors) {
	if (!Array.isArray(parseErrors) || parseErrors.length === 0) return false;
	return parseErrors.some((err) => {
		const msg = String(err?.message ?? err ?? "");
		return /agentic_|column.*not found|unknown column|invalid dimension/i.test(msg);
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
 * Try a ShopifyQL query against newer Admin API versions (agentic dimensions need recent ShopifyQL schema).
 * @param {string} shopUrl
 * @param {string} accessToken
 * @param {string} query
 * @param {string[]} [apiVersions]
 */
export async function runAgenticShopifyql(shopUrl, accessToken, query, apiVersions = SHOPIFY_AGENTIC_SHOPIFYQL_API_VERSIONS) {
	let last = {
		query,
		tableData: { columns: [], rows: [] },
		parseErrors: [],
		apiVersion: null,
		fallback: null,
	};

	for (const apiVersion of apiVersions) {
		const json = await shopifyqlQuery(shopUrl, accessToken, query, { apiVersion });
		const result = extractShopifyqlResult(json);
		last = {
			query,
			...result,
			apiVersion,
			fallback: null,
		};
		if (!isAgenticColumnMissingError(result.parseErrors)) {
			return last;
		}
	}

	return last;
}

/**
 * @param {Array<Record<string, unknown>>} rows
 * @param {string} channelKey
 */
function filterAgenticSalesChannelRows(rows, channelKey = "sales_channel") {
	return (rows || []).filter((row) => {
		const label = String(row?.[channelKey] ?? "").trim();
		return label && AGENTIC_SALES_CHANNEL_PATTERN.test(label);
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

function buildReferringFromPaymentsQuery(startDate, endDate) {
	return `FROM payments
SHOW net_sales, orders, gross_sales, total_sales
GROUP BY agentic_referring_channel
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

function buildDailySalesChannelFallbackQuery(startDate, endDate) {
	return `FROM sales
SHOW net_sales, orders
GROUP BY day, sales_channel
SINCE ${startDate} UNTIL ${endDate}
ORDER BY day ASC
LIMIT 500`;
}

/**
 * Agentic sales channel report with API version escalation + sales_channel fallback.
 */
export async function fetchAgenticSalesChannelReport(shopUrl, accessToken, startDate, endDate) {
	const primaryQuery = `FROM sales
SHOW net_sales, orders, gross_sales, total_sales
GROUP BY agentic_sales_channel
SINCE ${startDate} UNTIL ${endDate}
ORDER BY net_sales DESC
LIMIT 100`;

	const primary = await runAgenticShopifyql(shopUrl, accessToken, primaryQuery);
	if (!isAgenticColumnMissingError(primary.parseErrors)) {
		return { ...primary, query: primaryQuery, dimension: "agentic_sales_channel" };
	}

	const fallbackQuery = buildSalesChannelFallbackQuery(startDate, endDate);
	const fallback = await runAgenticShopifyql(shopUrl, accessToken, fallbackQuery);
	const filteredRows = filterAgenticSalesChannelRows(fallback.tableData?.rows, "sales_channel");

	return {
		query: fallbackQuery,
		apiVersion: fallback.apiVersion,
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
		note:
			"agentic_sales_channel unavailable on this store/API version — filtered sales_channel rows matching agentic/AI channel names instead.",
	};
}

/**
 * Agentic referring channel report — tries FROM sales then FROM payments.
 */
export async function fetchAgenticReferringChannelReport(shopUrl, accessToken, startDate, endDate) {
	const salesQuery = buildReferringFromSalesQuery(startDate, endDate);
	const salesAttempt = await runAgenticShopifyql(shopUrl, accessToken, salesQuery);
	if (!isAgenticColumnMissingError(salesAttempt.parseErrors)) {
		return {
			...salesAttempt,
			query: salesQuery,
			dimension: "agentic_referring_channel",
			schema: "sales",
		};
	}

	const paymentsQuery = buildReferringFromPaymentsQuery(startDate, endDate);
	const paymentsAttempt = await runAgenticShopifyql(shopUrl, accessToken, paymentsQuery);
	return {
		...paymentsAttempt,
		query: paymentsQuery,
		dimension: "agentic_referring_channel",
		schema: "payments",
		fallback: isAgenticColumnMissingError(paymentsAttempt.parseErrors)
			? "unavailable"
			: "payments_schema",
		note: isAgenticColumnMissingError(paymentsAttempt.parseErrors)
			? "agentic_referring_channel not available on this store/API version yet."
			: "Used FROM payments schema for agentic_referring_channel.",
	};
}

/**
 * Daily agentic sales breakdown with fallback to filtered sales_channel.
 */
export async function fetchAgenticSalesChannelDailyReport(shopUrl, accessToken, startDate, endDate) {
	const primaryQuery = `FROM sales
SHOW net_sales, orders
GROUP BY day, agentic_sales_channel
SINCE ${startDate} UNTIL ${endDate}
ORDER BY day ASC
LIMIT 500`;

	const primary = await runAgenticShopifyql(shopUrl, accessToken, primaryQuery);
	if (!isAgenticColumnMissingError(primary.parseErrors)) {
		return { ...primary, query: primaryQuery, dimension: "agentic_sales_channel" };
	}

	const fallbackQuery = buildDailySalesChannelFallbackQuery(startDate, endDate);
	const fallback = await runAgenticShopifyql(shopUrl, accessToken, fallbackQuery);
	const filteredRows = filterAgenticSalesChannelRows(fallback.tableData?.rows, "sales_channel");

	return {
		query: fallbackQuery,
		apiVersion: fallback.apiVersion,
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
		note:
			"agentic_sales_channel unavailable — daily breakdown uses sales_channel rows matching agentic/AI names.",
	};
}
