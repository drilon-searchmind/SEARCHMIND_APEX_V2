import { getDemoPayload } from "@/lib/demoCustomer";
import { eachDayInclusive, numHash } from "@/lib/demoAdMetrics";
import { buildDemoSeoSupplemental } from "@/lib/seoDashboardBundle";

export function buildDemoSeoMetricsForRange(startDate, endDate) {
    const template = getDemoPayload("seoDashboardMetrics") || {};
    const rows = eachDayInclusive(startDate, endDate).map((date) => {
        const h = numHash(`seo-${date}`);
        return {
            keys: [date],
            clicks: 20 + (h % 15),
            impressions: 800 + (h % 200),
            ctr: 0.03,
            position: 12 + (h % 8),
        };
    });
    return {
        metrics: { rows },
        keywords: template.keywords || { rows: [] },
        urls: template.urls || { rows: [] },
        supplemental: buildDemoSeoSupplemental(startDate, endDate),
    };
}
