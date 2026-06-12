/**
 * Client-safe: builds daily table rows from /api/b2b-dashboard payload (no GA4 API imports).
 */

/**
 * @param {Record<string, unknown>} data - B2B dashboard API `current` or `comparison` payload
 */
export function buildB2BDailyRows(data) {
    const ga4ByDate = Object.fromEntries((data.ga4Daily || []).map((row) => [row.date, row]));
    const spendMap = data.adSpendByPeriod || {};

    const dates = Array.from(
        new Set([...Object.keys(ga4ByDate), ...Object.keys(spendMap)])
    ).sort();

    const channelKeys = [
        { key: "facebookDaily", field: "psCost" },
        { key: "googleDaily", field: "ppcCost" },
        { key: "pinterestDaily", field: "pinterestCost" },
        { key: "snapchatDaily", field: "snapchatCost" },
        { key: "bingDaily", field: "bingCost" },
        { key: "redditDaily", field: "redditCost" },
    ];

    return dates.map((date) => {
        const ga4 = ga4ByDate[date] || {};
        const row = {
            date,
            sessions: ga4.sessions || 0,
            totalUsers: ga4.totalUsers || 0,
            newUsers: ga4.newUsers || 0,
            engagedSessions: ga4.engagedSessions || 0,
            engagementRate: ga4.engagementRate || 0,
            averageSessionDuration: ga4.averageSessionDuration || 0,
            eventCount: ga4.eventCount || 0,
            conversions: ga4.conversions || 0,
            bounceRate: ga4.bounceRate || 0,
            screenPageViews: ga4.screenPageViews || 0,
            totalMarketingSpend: spendMap[date] || 0,
            psCost: 0,
            ppcCost: 0,
            pinterestCost: 0,
            snapchatCost: 0,
            bingCost: 0,
            redditCost: 0,
        };

        for (const { key, field } of channelKeys) {
            const match = (data[key] || []).find((d) => String(d.period).slice(0, 10) === date);
            row[field] = match ? Number(match.spend) || 0 : 0;
        }

        row.costPerSession = row.sessions > 0 ? row.totalMarketingSpend / row.sessions : 0;
        row.costPerConversion = row.conversions > 0 ? row.totalMarketingSpend / row.conversions : 0;

        return row;
    });
}
