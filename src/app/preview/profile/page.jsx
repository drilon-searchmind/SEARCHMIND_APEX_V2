"use client";

import { useMemo, useState } from "react";
import StandaloneTopbarShell from "@/components/layout/StandaloneTopbarShell";
import ProfilePage from "@/app/(protected)/profile/page";
import { UserContext } from "@/contexts/UserContext";
import { CustomersOverrideContext } from "@/contexts/CustomersOverrideContext";

/**
 * Demo preview of the profile page with a made-up user and properties, so it can be reviewed without
 * signing in. The save endpoints are answered locally and nothing is stored.
 * `?external=1` shows an external user with shared properties.
 */
const PROPERTIES = [
	{ _id: "p1", customerName: "Fjordlys Home" },
	{ _id: "p2", customerName: "Atlas Garden" },
	{ _id: "p3", customerName: "Bornholm Candles" },
	{ _id: "p4", customerName: "Havn & Co" },
	{ _id: "p5", customerName: "Skovbrynet Outdoor" },
];

if (typeof window !== "undefined" && !window.__apexProfilePreview) {
	window.__apexProfilePreview = true;
	const real = window.fetch.bind(window);
	const json = (body) => Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));
	window.fetch = (input, init) => {
		const url = typeof input === "string" ? input : input?.url || "";
		if (url.startsWith("/api/user/")) {
			let body = {};
			try {
				body = JSON.parse(init?.body || "{}");
			} catch {}
			return new Promise((resolve) => setTimeout(() => resolve(json(body)), 500));
		}
		return real(input, init);
	};
}

export default function PreviewProfile() {
	const external = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("external") === "1";
	const [user] = useState(() => ({
		id: "demo-user",
		name: "Maja Lindqvist",
		email: "maja.lindqvist@example.com",
		image: "",
		createdAt: "2025-03-12T09:00:00.000Z",
		slackId: "U01DEMO42",
		clickupId: "",
		isAdmin: !external,
		isExternal: external,
		favoritedCustomers: ["p1", "p2", "p3"],
		sharedCustomers: external ? ["p4", "p5"] : [],
	}));
	const customers = useMemo(() => ({ customers: PROPERTIES, loading: false, error: null, fetchCustomers: async () => {} }), []);
	return (
		<UserContext.Provider value={user}>
			<CustomersOverrideContext.Provider value={customers}>
				<style>{".apex-preview__main{padding:0 !important}"}</style>
				<StandaloneTopbarShell>
					<ProfilePage />
				</StandaloneTopbarShell>
			</CustomersOverrideContext.Provider>
		</UserContext.Provider>
	);
}
