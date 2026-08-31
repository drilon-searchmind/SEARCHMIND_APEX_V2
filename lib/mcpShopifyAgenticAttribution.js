import { isDemoCustomerId } from "@/lib/demoCustomer";
import { fetchAllAgenticShopifyqlReports } from "@/lib/shopifyAgenticShopifyql";
import { parseMcpDateRange } from "@root/lib/mcpApiHelpers";
import { loadShopifyCredentialsForMcp } from "@root/lib/mcpProxyAllowlist";

function demoAgenticAttribution() {
	return {
		shopifyqlApiVersion: "demo",
		salesByAgenticSalesChannel: {
			tableData: {
				columns: [
					{ name: "agentic_sales_channel", displayName: "Agentic sales channel" },
					{ name: "net_sales", displayName: "Net sales" },
					{ name: "orders", displayName: "Orders" },
				],
				rows: [
					{ agentic_sales_channel: "Shop", net_sales: "2000.00", orders: "12" },
					{ agentic_sales_channel: "ChatGPT", net_sales: "18420.00", orders: "42" },
				],
			},
			parseErrors: [],
			apiVersion: "demo",
			fallback: null,
		},
		salesByAgenticReferringChannel: {
			tableData: {
				columns: [
					{ name: "agentic_referring_channel", displayName: "Agentic referring channel" },
					{ name: "net_sales", displayName: "Net sales" },
					{ name: "orders", displayName: "Orders" },
				],
				rows: [{ agentic_referring_channel: "ChatGPT", net_sales: "22100.00", orders: "51" }],
			},
			parseErrors: [],
			apiVersion: "demo",
			fallback: null,
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
					{ day: "2026-08-01", agentic_sales_channel: "Shop", net_sales: "820.00", orders: "2" },
				],
			},
			parseErrors: [],
			apiVersion: "demo",
			fallback: null,
		},
	};
}

function demoAgenticNotes(apiVersion) {
	return [
		`All agentic ShopifyQL sub-queries share one resolved apiVersion (${apiVersion}).`,
		"salesByAgenticSalesChannel: agentic_sales_channel, or sales_channel fallback matching Shop/ChatGPT/Copilot/etc.",
		"salesByAgenticReferringChannel: agentic_referring_channel, or sessions.referrer_source AI filter fallback.",
		"Empty rows with fallback:null means native dimension works but no agentic activity in the date range.",
		"Pair with /api/shopify-channel-attribution and shopify_graphql_read ordersAttribution.",
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
		const demo = demoAgenticAttribution();
		return {
			customerId,
			...range,
			demo: true,
			kind: "shopifyql-agentic-attribution",
			...demo,
			notes: demoAgenticNotes(demo.shopifyqlApiVersion),
		};
	}

	const { startDate, endDate } = range;
	const reports = await fetchAllAgenticShopifyqlReports(
		creds.shopUrl,
		creds.accessToken,
		startDate,
		endDate
	);

	return {
		customerId,
		...range,
		kind: "shopifyql-agentic-attribution",
		...reports,
		notes: demoAgenticNotes(reports.shopifyqlApiVersion),
	};
}
