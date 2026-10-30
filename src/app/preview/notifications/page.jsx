"use client";

import { useMemo } from "react";
import StandaloneTopbarShell from "@/components/layout/StandaloneTopbarShell";
import NotificationsPage from "@/app/(protected)/notifications/page";
import { UserContext } from "@/contexts/UserContext";
import { CustomersOverrideContext } from "@/contexts/CustomersOverrideContext";

/**
 * Demo preview of the topbar bell and the notifications page with a seeded, made-up inbox, so both can be
 * reviewed without signing in. The notifications endpoints are answered locally; nothing here is real data.
 * `?empty=1` shows the empty state.
 */
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const ago = (ms) => new Date(Date.now() - ms).toISOString();

function seed() {
	return [
		{ id: "n1", title: "Tracking check failed on one property", body: "The server-side tag stopped responding at 04:12. Apex sent an alert to the team and is retrying.", linkUrl: "/home", imageUrl: "", category: "alert", readAt: null, createdAt: ago(12 * MIN), authorName: "Apex", authorImage: "" },
		{ id: "n2", title: "Data Wrapped is ready", body: "Your September wrapped is ready to play. It now covers every paid channel and compares with August.", linkUrl: "https://example.com/wrapped", imageUrl: "", category: "feature", readAt: null, createdAt: ago(3 * HOUR), authorName: "Searchmind", authorImage: "" },
		{ id: "n3", title: "New market flags in the filter", body: "Markets now show flags, and the Adspend filter and side menu show channel logos.", linkUrl: "", imageUrl: "", category: "feature", readAt: null, createdAt: ago(5 * HOUR), authorName: "", authorImage: "" },
		{ id: "n4", title: "Scheduled maintenance tonight", body: "Apex will be briefly unavailable between 02:00 and 02:15 while we update the data pipeline.", linkUrl: "", imageUrl: "", category: "system", readAt: ago(20 * HOUR), createdAt: ago(26 * HOUR), authorName: "Searchmind", authorImage: "" },
		{ id: "n5", title: "Reddit Ads dashboard rebuilt", body: "Communities, audience and ad level views are live, with exclusion candidates you can copy into Ads Manager.", linkUrl: "/home", imageUrl: "", category: "feature", readAt: ago(60 * HOUR), createdAt: ago(3 * 24 * HOUR), authorName: "Searchmind", authorImage: "" },
		{ id: "n6", title: "Budget pacing is behind for one property", body: "Spend is 18% behind the monthly plan. Review the Pace report to adjust budgets before month end.", linkUrl: "/home", imageUrl: "", category: "alert", readAt: ago(10 * 24 * HOUR), createdAt: ago(11 * 24 * HOUR), authorName: "Apex", authorImage: "" },
		{ id: "n7", title: "Welcome to Apex", body: "Pin the properties you use most from the home page, and open Guides for a short tour.", linkUrl: "", imageUrl: "", category: "system", readAt: ago(30 * 24 * HOUR), createdAt: ago(31 * 24 * HOUR), authorName: "Searchmind", authorImage: "" },
	];
}

if (typeof window !== "undefined" && !window.__apexNotificationsPreview) {
	window.__apexNotificationsPreview = true;
	const real = window.fetch.bind(window);
	const empty = new URLSearchParams(window.location.search).get("empty") === "1";
	let inbox = empty ? [] : seed();
	const json = (body) => Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));
	window.fetch = (input, init) => {
		const url = typeof input === "string" ? input : input?.url || "";
		if (url.startsWith("/api/notifications/mark-read")) {
			const now = new Date().toISOString();
			inbox = inbox.map((n) => (n.readAt ? n : { ...n, readAt: now }));
			return json({ ok: true });
		}
		if (url.startsWith("/api/notifications")) {
			const limit = Number(new URL(url, "http://x").searchParams.get("limit")) || 20;
			return json({ notifications: inbox.slice(0, limit), unreadCount: inbox.filter((n) => !n.readAt).length });
		}
		return real(input, init);
	};
}

export default function PreviewNotifications() {
	const user = useMemo(() => ({ id: "demo-user", email: "demo@example.com", name: "Demo", isAdmin: true, isExternal: false }), []);
	const customers = useMemo(() => ({ customers: [], loading: false, error: null, fetchCustomers: async () => {} }), []);
	return (
		<UserContext.Provider value={user}>
			<CustomersOverrideContext.Provider value={customers}>
				<style>{".apex-preview__main{padding:0 !important}"}</style>
				<StandaloneTopbarShell>
					<NotificationsPage />
				</StandaloneTopbarShell>
			</CustomersOverrideContext.Provider>
		</UserContext.Provider>
	);
}
