/**
 * Map planner service + media to the customer’s channel performance (service dashboard) route.
 * Used to deep-link to ads/performance with optional search + date range via query string.
 */
export function getChannelPerformancePath({
	customerId,
	serviceName,
	media,
	lineName = "",
	startDate = "",
	endDate = "",
} = {}) {
	if (!customerId) return null;
	const base = `/dashboard/${encodeURIComponent(String(customerId))}/service-dashboard`;
	const qs = new URLSearchParams();
	if (lineName) qs.set("adSearch", lineName);
	if (startDate) qs.set("startDate", String(startDate).slice(0, 10));
	if (endDate) qs.set("endDate", String(endDate).slice(0, 10));
	const q = qs.toString();

	if (serviceName === "Paid Search" && (media === "Google" || media === "YouTube")) {
		return q ? `${base}/ppc?${q}` : `${base}/ppc`;
	}
	if (serviceName === "Paid Social" && media === "Pinterest") {
		return q ? `${base}/pinterest?${q}` : `${base}/pinterest`;
	}
	if (serviceName === "Paid Social" && media === "Snapchat") {
		return q ? `${base}/snapchat?${q}` : `${base}/snapchat`;
	}
	if (serviceName === "Paid Social" && media) {
		// One Meta / Facebook “PS” view; filter ads by name + period.
		return q ? `${base}/ps?${q}` : `${base}/ps`;
	}
	if (serviceName === "Email Marketing" && (media === "Email" || !media)) {
		const emQs = new URLSearchParams();
		if (startDate) emQs.set("startDate", String(startDate).slice(0, 10));
		if (endDate) emQs.set("endDate", String(endDate).slice(0, 10));
		return emQs.toString() ? `${base}/em?${emQs.toString()}` : `${base}/em`;
	}
	if (serviceName === "SEO" && (media === "Website" || !media)) {
		const seoQs = new URLSearchParams();
		if (startDate) seoQs.set("startDate", String(startDate).slice(0, 10));
		if (endDate) seoQs.set("endDate", String(endDate).slice(0, 10));
		return seoQs.toString() ? `${base}/seo?${seoQs.toString()}` : `${base}/seo`;
	}
	return null;
}
