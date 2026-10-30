"use client";

import { useMemo } from "react";
import CustomerTable from "@/components/table/CustomerTable";
import { CustomersOverrideContext } from "@/contexts/CustomersOverrideContext";
import { UserContext } from "@/contexts/UserContext";
import "@/app/(protected)/home/home.css";
import "@/app/(protected)/home/home-v2.css";

/**
 * Demo preview of /home with a seeded, made-up workspace, so the page can be reviewed without signing in.
 * Property names are invented; nothing here is customer data.
 */
const GROUPS = {
	nordic: "Nordic Brands",
	atlas: "Atlas Retail",
};

const DEMO_PROPERTIES = [
	["Fjordlys Home", "Shopify", GROUPS.nordic],
	["Skovbrynet Outdoor", "Shopify", GROUPS.nordic],
	["Havn & Co", "Shopify Markets", GROUPS.nordic],
	["Kornet Bakery Supply", "WooCommerce", GROUPS.nordic],
	["Lys Interiør", "Magento", GROUPS.nordic],
	["Atlas Garden", "Shopify", GROUPS.atlas],
	["Atlas Pet Supplies", "WooCommerce", GROUPS.atlas],
	["Atlas Tools", "Shopify Markets", GROUPS.atlas],
	["Bornholm Candles", "Shopify", null],
	["Mørk Coffee Roasters", "DanDomain", null],
	["Stenbro Furniture", "Magento", null],
	["Vinterhaven Kids", "Shopify", null],
].map(([customerName, type, parent], i) => ({
	_id: `demo-home-${i + 1}`,
	customerName,
	customerType: type === "Shopify Markets" ? "Shopify" : type,
	CustomerSettings: type === "Shopify Markets" ? { shopifyMarketsEnabled: true } : {},
	parentCustomer: parent || undefined,
}));

const DEMO_USER = {
	id: "demo-user",
	isAdmin: true,
	isExternal: false,
	favoritedCustomers: ["demo-home-1", "demo-home-6", "demo-home-9"],
};

// The news and parent group endpoints need a session, so the preview answers them locally.
if (typeof window !== "undefined" && !window.__apexHomePreviewFetch) {
	window.__apexHomePreviewFetch = true;
	const realFetch = window.fetch.bind(window);
	window.fetch = (input, init) => {
		const url = typeof input === "string" ? input : input?.url || "";
		const json = (body) => Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));
		if (url.startsWith("/api/news")) {
			return json({
				posts: [
					{
						slug: "demo",
						title: "Demo post: what changed in Apex this month",
						excerpt: "A made-up news item so the preview shows how the news card looks.",
						publishedAt: "2026-10-01T09:00:00.000Z",
					},
				],
			});
		}
		if (url.startsWith("/api/parent-customers")) {
			return json(Object.values(GROUPS).map((name) => ({ _id: name, name })));
		}
		return realFetch(input, init);
	};
}

export default function PreviewHomePage() {
	const value = useMemo(
		() => ({
			customers: DEMO_PROPERTIES,
			loading: false,
			error: null,
			fetchCustomers: async () => {},
			createCustomer: async () => {
				throw new Error("Not available in preview");
			},
			updateCustomer: async () => {
				throw new Error("Not available in preview");
			},
			deleteCustomer: async () => {
				throw new Error("Not available in preview");
			},
		}),
		[]
	);

	return (
		<UserContext.Provider value={DEMO_USER}>
			<style>{".apex-preview__main{padding:0 !important}"}</style>
			<CustomersOverrideContext.Provider value={value}>
				<div id="HomePage" className="apex-home-shell">
					<CustomerTable />
				</div>
			</CustomersOverrideContext.Provider>
		</UserContext.Provider>
	);
}
