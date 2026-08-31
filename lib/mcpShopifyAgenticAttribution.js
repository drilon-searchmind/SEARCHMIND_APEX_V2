import { shopifyqlQuery } from "@/lib/shopifyApi";
import { isDemoCustomerId } from "@/lib/demoCustomer";
import { parseMcpDateRange } from "@root/lib/mcpApiHelpers";
import { loadShopifyCredentialsForMcp } from "@root/lib/mcpProxyAllowlist";

function buildSalesByAgenticSalesChannelQuery(startDate, endDate) {
	return `FROM sales
SHOW net_sales, orders, gross_sales, total_sales
GROUP BY agentic_sales_channel
SINCE ${startDate} UNTIL ${endDate}
ORDER BY net_sales DESC
LIMIT 100`;
}

function buildSalesByAgenticReferringChannelQuery(startDate, endDate) {
	return `FROM sales
SHOW net_sales, orders, gross_sales, total_sales
GROUP BY agentic_referring_channel
SINCE ${startDate} UNTIL ${endDate}
ORDER BY net_sales DESC
LIMIT 100`;
}

function buildAgenticSalesChannelDailyQuery(startDate, endDate) {
	return `FROM sales
SHOW net_sales, orders
GROUP BY day, agentic_sales_channel
SINCE ${startDate} UNTIL ${endDate}
ORDER BY day ASC
LIMIT 500`;
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

function demoAgenticAttribution() {
	return {
		salesByAgenticSalesChannel: {
			tableData: {
				columns: [
					{ name: "agentic_sales_channel", displayName: "Agentic sales channel" },
					{ name: "net_sales", displayName: "Net sales" },
					{ name: "orders", displayName: "Orders" },
				],
				rows: [
					{
						agentic_sales_channel: "ChatGPT",
						net_sales: "18420.00",
						orders: "42",
					},
					{
						agentic_sales_channel: "Google AI Mode and Gemini",
						net_sales: "9650.00",
						orders: "18",
					},
					{
						agentic_sales_channel: "Microsoft Copilot",
						net_sales: "3120.00",
						orders: "7",
					},
				],
			},
			parseErrors: [],
		},
		salesByAgenticReferringChannel: {
			tableData: {
				columns: [
					{ name: "agentic_referring_channel", displayName: "Agentic referring channel" },
					{ name: "net_sales", displayName: "Net sales" },
					{ name: "orders", displayName: "Orders" },
				],
				rows: [
					{
						agentic_referring_channel: "ChatGPT",
						net_sales: "22100.00",
						orders: "51",
					},
					{
						agentic_referring_channel: "Google AI Mode and Gemini",
						net_sales: "11200.00",
						orders: "24",
					},
				],
			},
			parseErrors: [],
		},
		agenticSalesChannelDaily: {
			tableData: {
				columns: [
					{ name: "day", displayName: "Day" },
					{ name: "agentic_sales_channel", displayName: "Agentic sales channel" },
					{ name: "net_sales", displayName: "Net sales" },
					{ name: "orders", displayName: "Orders" },
				],
				rows: [
					{ day: "2026-08-01", agentic_sales_channel: "ChatGPT", net_sales: "820.00", orders: "2" },
					{ day: "2026-08-02", agentic_sales_channel: "ChatGPT", net_sales: "1240.00", orders: "3" },
				],
			},
			parseErrors: [],
		},
	};
}

/**
 * Shopify Agentic Storefronts attribution via read-only ShopifyQL.
 * Uses Shopify's native agentic_sales_channel and agentic_referring_channel dimensions.
 * @param {string} customerId
 * @param {Record<string, string>} params
 */
export async function fetchMcpShopifyAgenticAttribution(customerId, params = {}) {
	const range = parseMcpDateRange(params.startDate, params.endDate);
	const creds = await loadShopifyCredentialsForMcp(customerId);
	const isDemo = isDemoCustomerId(customerId) || creds.isDemo;

	if (isDemo) {
		return {
			customerId,
			...range,
			demo: true,
			kind: "shopifyql-agentic-attribution",
			...demoAgenticAttribution(),
			notes: demoAgenticNotes(),
		};
	}

	const { startDate, endDate } = range;
	const [salesByAgenticSalesChannel, salesByAgenticReferringChannel, agenticSalesChannelDaily] =
		await Promise.all([
			runShopifyql(
				creds.shopUrl,
				creds.accessToken,
				buildSalesByAgenticSalesChannelQuery(startDate, endDate)
			),
			runShopifyql(
				creds.shopUrl,
				creds.accessToken,
				buildSalesByAgenticReferringChannelQuery(startDate, endDate)
			),
			runShopifyql(
				creds.shopUrl,
				creds.accessToken,
				buildAgenticSalesChannelDailyQuery(startDate, endDate)
			),
		]);

	return {
		customerId,
		...range,
		kind: "shopifyql-agentic-attribution",
		salesByAgenticSalesChannel,
		salesByAgenticReferringChannel,
		agenticSalesChannelDaily,
		notes: demoAgenticNotes(),
	};
}

function demoAgenticNotes() {
	return [
		"salesByAgenticSalesChannel: orders/revenue where an AI agent directly facilitated the sale (Shopify Agentic Storefronts checkout).",
		"salesByAgenticReferringChannel: attributed sales where an AI agent referred the buyer to the online store.",
		"agenticSalesChannelDaily: daily breakdown by agentic_sales_channel.",
		"Pair with /api/shopify-channel-attribution (sessions by referrer/UTM) and shopify_graphql_read queryType ordersAttribution for order-level fields.",
		"ShopifyQL dimensions: agentic_sales_channel, agentic_referring_channel (FROM sales schema).",
	];
}
