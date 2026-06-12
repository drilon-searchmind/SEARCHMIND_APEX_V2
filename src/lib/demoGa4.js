import { eachDayInclusive, numHash } from "@/lib/demoAdMetrics";

function ymdKey(v) {
    if (!v) return "";
    const s = String(v).trim();
    if (s.length >= 8) return s.replace(/-/g, "").slice(0, 8);
    return s;
}

/**
 * GA4 demo timeseries for selected period (dimension date).
 */
export function getDemoGa4TimeseriesForRange(startDate, endDate) {
    const days = eachDayInclusive(startDate, endDate);
    return {
        dimensionHeaders: [{ name: "date" }],
        metricHeaders: [
            { name: "totalUsers" },
            { name: "screenPageViews" },
            { name: "bounceRate" },
            { name: "averageSessionDuration" },
        ],
        rows: days.map((date) => {
            const h = numHash(`ga4-${date}`);
            return {
                dimensionValues: [{ value: date.replace(/-/g, "") }],
                metricValues: [
                    { value: String(80 + (h % 40)) },
                    { value: String(400 + (h % 200)) },
                    { value: String(0.35 + (h % 10) / 100) },
                    { value: String(120 + (h % 60)) },
                ],
            };
        }),
    };
}

/** B2B dashboard demo GA4 daily metrics (extended metric set). */
export function getDemoB2BGa4DailyForRange(startDate, endDate) {
    const days = eachDayInclusive(startDate, endDate);
    return {
        dimensionHeaders: [{ name: "date" }],
        metricHeaders: [
            { name: "sessions" },
            { name: "totalUsers" },
            { name: "newUsers" },
            { name: "engagedSessions" },
            { name: "engagementRate" },
            { name: "averageSessionDuration" },
            { name: "eventCount" },
            { name: "conversions" },
            { name: "bounceRate" },
            { name: "screenPageViews" },
        ],
        rows: days.map((date) => {
            const h = numHash(`b2b-ga4-${date}`);
            const sessions = 120 + (h % 80);
            const users = 90 + (h % 50);
            const engaged = Math.round(sessions * (0.55 + (h % 15) / 100));
            return {
                dimensionValues: [{ value: date.replace(/-/g, "") }],
                metricValues: [
                    { value: String(sessions) },
                    { value: String(users) },
                    { value: String(Math.round(users * (0.35 + (h % 10) / 100))) },
                    { value: String(engaged) },
                    { value: String(0.5 + (h % 20) / 100) },
                    { value: String(90 + (h % 45)) },
                    { value: String(800 + (h % 400)) },
                    { value: String(3 + (h % 8)) },
                    { value: String(0.32 + (h % 12) / 100) },
                    { value: String(350 + (h % 180)) },
                ],
            };
        }),
    };
}

/**
 * Filter static GA4 JSON rows by date dimension when present.
 */
export function filterGa4DemoRowsByRange(data, startDate, endDate) {
    if (!data?.rows?.length || !startDate || !endDate) return data;
    const lo = ymdKey(startDate);
    const hi = ymdKey(endDate);
    const filtered = data.rows.filter((row) => {
        const v = row.dimensionValues?.[0]?.value;
        if (v == null) return true;
        const k = ymdKey(v);
        if (k.length !== 8) return true;
        return k >= lo && k <= hi;
    });
    if (filtered.length > 0) return { ...data, rows: filtered };
    return { ...data, rows: [] };
}
