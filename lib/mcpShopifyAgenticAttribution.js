import { isDemoCustomerId } from "@/lib/demoCustomer";
import {
	fetchAgenticReferringChannelReport,
	fetchAgenticSalesChannelDailyReport,
	fetchAgenticSalesChannelReport,
} from "@/lib/shopifyAgenticShopifyql";
import { parseMcpDateRange } from "@root/lib/mcpApiHelpers";
import { loadShopifyCredentialsForMcp } from "@root/lib/mcpProxyAllowlist";

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
			apiVersion: "demo",
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
			apiVersion: "demo",
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
			apiVersion: "demo",
		},
	};
}

function demoAgenticNotes() {
	return [
		"salesByAgenticSalesChannel: orders/revenue where an AI agent directly facilitated the sale (Shopify Agentic Storefronts checkout).",
		"salesByAgenticReferringChannel: attributed sales where an AI agent referred the buyer to the online store.",
		"agenticSalesChannelDaily: daily breakdown by agentic_sales_channel (or sales_channel fallback).",
		"Queries use Admin API 2026-04 → 2026-01 → 2025-10 for ShopifyQL agentic dimensions.",
		"If agentic_sales_channel is missing, falls back to filtering sales_channel for agentic/AI names.",
		"Pair with /api/shopify-channel-attribution (sessions by referrer/UTM) and shopify_graphql_read ordersAttribution.",
	];
}

/**
 * Shopify Agentic Storefronts attribution via read-only ShopifyQL.
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
			fetchAgenticSalesChannelReport(creds.shopUrl, creds.accessToken, startDate, endDate),
			fetchAgenticReferringChannelReport(creds.shopUrl, creds.accessToken, startDate, endDate),
			fetchAgenticSalesChannelDailyReport(creds.shopUrl, creds.accessToken, startDate, endDate),
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
