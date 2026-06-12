import { AD_SPEND_CHANNELS } from "@/lib/mergeAdSpendDaily";
import { toParts } from "@/app/(protected)/dashboard/[customerId]/performance-dashboard/components/kpiFormulaUtils";

/**
 * Build a single day's B2B metrics object (for charts + formula eval).
 */
export function buildB2BDailyMetricsRow(date, ga4 = {}, spend = 0, merged = {}) {
    const sessions = ga4.sessions || 0;
    const conversions = ga4.conversions || 0;
    const cost = Number(spend) || 0;

    const row = {
        period: date,
        date,
        sessions,
        totalUsers: ga4.totalUsers || 0,
        newUsers: ga4.newUsers || 0,
        engagedSessions: ga4.engagedSessions || 0,
        engagementRate: ga4.engagementRate || 0,
        engagement_rate: ga4.engagementRate || 0,
        averageSessionDuration: ga4.averageSessionDuration || 0,
        bounceRate: ga4.bounceRate || 0,
        bounce_rate: ga4.bounceRate || 0,
        screenPageViews: ga4.screenPageViews || 0,
        eventCount: ga4.eventCount || 0,
        conversions,
        cost,
        marketing_spend: cost,
        conversion_rate: sessions > 0 ? (conversions / sessions) * 100 : 0,
        cost_per_session: sessions > 0 ? cost / sessions : 0,
        cost_per_lead: conversions > 0 ? cost / conversions : 0,
        leads_per_1k_spend: cost > 0 ? (conversions / cost) * 1000 : 0,
        sessions_per_conversion: conversions > 0 ? sessions / conversions : 0,
    };

    for (const ch of AD_SPEND_CHANNELS) {
        const match = (merged?.[ch.mergeKey] || []).find(
            (d) => String(d.period).slice(0, 10) === date
        );
        row[ch.metricsDataKey] = match ? Number(match.spend) || 0 : 0;
    }

    return row;
}

function applyFormula(parts, metrics) {
    if (!parts?.length) return null;
    if (parts.length === 1 && parts[0].type === "metric") {
        return Number(metrics[parts[0].value]) || 0;
    }

    const tokens = parts.map((p) => {
        if (p.type === "metric") return Number(metrics[p.value]) || 0;
        return p.value;
    });

    let result = tokens[0];
    for (let i = 1; i < tokens.length; i += 2) {
        const op = tokens[i];
        const rhs = tokens[i + 1];
        if (rhs === undefined) break;
        switch (op) {
            case "+":
                result += rhs;
                break;
            case "-":
                result -= rhs;
                break;
            case "*":
                result *= rhs;
                break;
            case "/":
                result = rhs !== 0 ? result / rhs : 0;
                break;
            default:
                break;
        }
    }
    return result;
}

/** Evaluate a custom KPI formula against B2B metricsData or daily row. */
export function evaluateB2BFormula(kpi, data) {
    const parts = toParts(kpi);
    if (!parts) return null;
    return applyFormula(parts, data || {});
}
