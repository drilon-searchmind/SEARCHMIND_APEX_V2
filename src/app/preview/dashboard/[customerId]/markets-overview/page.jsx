"use client";

import { useMemo } from "react";
import MarketsOverviewPage from "@/app/(protected)/dashboard/[customerId]/markets-overview/page";
import { CustomersOverrideContext, useCustomersOverride } from "@/contexts/CustomersOverrideContext";

/**
 * Demo preview of the Markets view. The demo customer is shown as a Shopify Markets store;
 * /api/markets-overview serves seeded demo market rows for demo ids (DemoPreviewGuard limits
 * this route to those ids).
 */
export default function PreviewMarketsOverviewPage() {
	const parent = useCustomersOverride();

	const value = useMemo(() => {
		if (!parent) return parent;
		return {
			...parent,
			customers: (parent.customers || []).map((c) => ({
				...c,
				customerType: "Shopify",
				CustomerSettings: { ...(c.CustomerSettings || {}), shopifyMarketsEnabled: true },
			})),
		};
	}, [parent]);

	return (
		<CustomersOverrideContext.Provider value={value}>
			<MarketsOverviewPage />
		</CustomersOverrideContext.Provider>
	);
}
