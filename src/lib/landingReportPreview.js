import { getDemoCustomerId } from "@/lib/demoCustomerId";

/** Public embed URL for a landing report preview (demo data only). */
export function getLandingReportPreviewSrc(report) {
	const demoId = getDemoCustomerId();
	return `/preview/dashboard/${demoId}/${report.path}?embed=1`;
}
