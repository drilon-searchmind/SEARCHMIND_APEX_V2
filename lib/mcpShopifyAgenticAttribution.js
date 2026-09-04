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
		shopChannelSales: {
			tableData: {
				columns: [
					{ name: "sales_channel", displayName: "Sales channel" },
					{ name: "net_sales", displayName: "Net sales" },
					{ name: "orders", displayName: "Orders" },
				],
				rows: [{ sales_channel: "Shop", net_sales: "13395.00", orders: "32" }],
			},
			parseErrors: [],
			apiVersion: "demo",
		},
		trafficByAgenticUtmSource: {
			tableData: {
				columns: [
					{ name: "utm_source", displayName: "UTM source" },
					{ name: "utm_medium", displayName: "UTM medium" },
					{ name: "sessions", displayName: "Sessions" },
				],
				rows: [
					{ utm_source: "chatgpt.com", utm_medium: "referral", sessions: "2263" },
					{ utm_source: "perplexity", utm_medium: "referral", sessions: "58" },
				],
			},
			parseErrors: [],
			apiVersion: "demo",
		},
		salesByReferringChannel: {
			tableData: {
				columns: [
					{ name: "referring_channel", displayName: "Referring channel" },
					{ name: "net_sales", displayName: "Net sales" },
					{ name: "orders", displayName: "Orders" },
				],
				rows: [
					{ referring_channel: "Shop", net_sales: "13395.00", orders: "32" },
					{ referring_channel: "ChatGPT", net_sales: "4460.00", orders: "18" },
				],
			},
			agenticApproximation: {
				rows: [
					{ referring_channel: "Shop", net_sales: "13395.00", orders: "32" },
					{ referring_channel: "ChatGPT", net_sales: "4460.00", orders: "18" },
				],
			},
			parseErrors: [],
			apiVersion: "demo",
			attribution: "LAST_CLICK_ATTRIBUTION",
			dimension: "referring_channel",
		},
	};
}

function demoAgenticNotes(apiVersion) {
	return [
		`All agentic ShopifyQL sub-queries share one resolved apiVersion (${apiVersion}).`,
		"shopChannelSales: sales_channel = Shop (proxy for Shopify Admin Agentic widget Shop revenue).",
		"trafficByAgenticUtmSource: sessions by utm_source filtered for chatgpt.com, perplexity, copilot.com, openai, shop_app.",
		"salesByAgenticSalesChannel: native agentic_sales_channel or sales_channel fallback.",
		"salesByAgenticReferringChannel: native agentic_referring_channel, then referring_channel sales, then UTM/referrer session fallback.",
		"salesByReferringChannel: full standard referring_channel breakdown (Shopify-suggested approximation; may include non-agentic channels).",
		"Per-agent revenue breakdown (ChatGPT vs Copilot vs Shop) via referring_channel is approximate — compare to Admin Agentic widget, not guaranteed to match.",
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
