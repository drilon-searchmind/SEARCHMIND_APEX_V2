"use client";

import dayjs from "dayjs";
import ShareOfSearchPage from "@/app/(protected)/dashboard/[customerId]/share-of-search/page";

/**
 * Demo preview of Share of Search with seeded Keyword Planner style answers, so the page can be reviewed
 * without signing in. Brands are whatever you type; the monthly volumes are generated, not real data.
 * `?groups=1` starts with a saved group.
 */
const MONTHS = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];

function hash(str) {
	let h = 2166136261;
	for (let i = 0; i < str.length; i++) {
		h ^= str.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return Math.abs(h);
}

function monthsBetween(start, end) {
	const out = [];
	let d = dayjs(start).startOf("month");
	const last = dayjs(end).endOf("month");
	while (!d.isAfter(last, "month")) {
		out.push({ year: d.year(), month: MONTHS[d.month()] });
		d = d.add(1, "month");
	}
	return out;
}

function buildMetrics(brands, startDate, endDate) {
	const months = monthsBetween(startDate, endDate);
	const rows = brands.map((brand, bi) => {
		const base = 3000 + (hash(brand) % 9000);
		const monthly = months.map((m, i) => ({
			year: m.year,
			month: m.month,
			monthlySearches: Math.round(base * (1 + 0.25 * Math.sin((i + bi) / 1.7) + (bi % 2 ? 0.004 : -0.002) * i * 10)),
		}));
		const vol = monthly.reduce((s, m) => s + m.monthlySearches, 0);
		return { brand, apiKeywordText: brand, volumeInRange: vol, avgMonthlySearches: Math.round(vol / Math.max(months.length, 1)), monthlySearchVolumes: monthly, sharePct: 0 };
	});
	const total = rows.reduce((s, r) => s + r.volumeInRange, 0) || 1;
	rows.forEach((r, i) => {
		r.sharePct = Math.round((r.volumeInRange / total) * 10000) / 100;
		const drift = ((hash(r.brand + "p") % 80) - 40) / 10;
		r.sharePctPreviousPeriod = Math.max(0, Math.round((r.sharePct - drift / 3) * 100) / 100);
		r.sharePctLastYear = Math.max(0, Math.round((r.sharePct - drift) * 100) / 100);
	});
	const len = dayjs(endDate).diff(dayjs(startDate), "day") + 1;
	return {
		rows,
		comparisonRanges: {
			previousPeriod: { startDate: dayjs(startDate).subtract(len, "day").format("YYYY-MM-DD"), endDate: dayjs(startDate).subtract(1, "day").format("YYYY-MM-DD"), ok: true },
			lastYear: { startDate: dayjs(startDate).subtract(1, "year").format("YYYY-MM-DD"), endDate: dayjs(endDate).subtract(1, "year").format("YYYY-MM-DD"), ok: true },
			rangesEqual: false,
			note: null,
		},
	};
}

if (typeof window !== "undefined" && !window.__apexSosPreview) {
	window.__apexSosPreview = true;
	const real = window.fetch.bind(window);
	const json = (body) => Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));
	const withGroups = new URLSearchParams(window.location.search).get("groups") === "1";
	let groups = withGroups ? [{ id: "g-demo", name: "Fjordlys", brands: ["fjordlys home", "fjordlys lamper"] }] : [];
	let history = [
		{ _id: "h1", brands: ["fjordlys", "lys interior", "nordlys"], geoLabel: "DK", startDate: "2025-11-01", endDate: "2026-10-31", createdAt: new Date(Date.now() - 3 * 86400000).toISOString(), rows: [] },
	];
	window.fetch = (input, init) => {
		const url = typeof input === "string" ? input : input?.url || "";
		if (url.includes("/api/share-of-search/") && url.includes("/brand-groups")) {
			if (init?.method === "PUT") {
				try {
					groups = JSON.parse(init.body).brandGroups || [];
				} catch {}
			}
			return json({ brandGroups: groups });
		}
		if (url.includes("/api/share-of-search/")) {
			const method = init?.method || "GET";
			if (method === "POST") {
				const body = JSON.parse(init.body || "{}");
				const metrics = buildMetrics(body.brands || [], body.startDate, body.endDate);
				history = [{ _id: `h${history.length + 1}`, brands: body.brands, geoLabel: body.geoLabel, startDate: body.startDate, endDate: body.endDate, createdAt: new Date().toISOString(), rows: metrics.rows }, ...history];
				return new Promise((resolve) => setTimeout(() => resolve(json({ metrics, snapshot: null })), 700));
			}
			if (method === "DELETE") {
				const id = new URL(url, "http://x").searchParams.get("snapshotId");
				history = history.filter((h) => h._id !== id);
				return json({ ok: true });
			}
			return json({ items: history });
		}
		return real(input, init);
	};
}

export default function PreviewShareOfSearch() {
	return <ShareOfSearchPage />;
}
