/**
 * Client-safe helpers for B2B (GA4) parent property / Market Overview groups.
 */
import { isB2BCustomer } from "@/lib/customerBusinessCategory";
import { AD_SPEND_CHANNELS, adSpendByPeriodMap } from "@/lib/mergeAdSpendDaily";
import { buildB2BDailyRows } from "@/lib/b2bDashboard/buildB2BDailyRows";
import { computeB2BMetricsData } from "@/lib/b2bDashboard/b2bOverviewMetrics";

/** True when every child of the group is a B2B (GA4) property. */
export function isB2BParentGroup(childCustomers) {
    return Array.isArray(childCustomers) && childCustomers.length > 0 && childCustomers.every(isB2BCustomer);
}

const SUM_KEYS = [
    "sessions",
    "totalUsers",
    "newUsers",
    "engagedSessions",
    "eventCount",
    "conversions",
    "screenPageViews",
];
const WEIGHTED_KEYS = ["engagementRate", "bounceRate", "averageSessionDuration"];

function emptyTotals() {
    return Object.fromEntries([...SUM_KEYS, ...WEIGHTED_KEYS].map((k) => [k, 0]));
}

/**
 * Combine GA4 totals objects (sum counts, session-weighted rates).
 * @param {Array<Record<string, number>|null|undefined>} totalsList
 */
export function combineGa4Totals(totalsList) {
    const out = emptyTotals();
    const weighted = Object.fromEntries(WEIGHTED_KEYS.map((k) => [k, 0]));
    for (const t of totalsList || []) {
        if (!t) continue;
        for (const k of SUM_KEYS) out[k] += Number(t[k]) || 0;
        const w = Number(t.sessions) || 0;
        for (const k of WEIGHTED_KEYS) weighted[k] += (Number(t[k]) || 0) * w;
    }
    for (const k of WEIGHTED_KEYS) {
        out[k] = out.sessions > 0 ? weighted[k] / out.sessions : 0;
    }
    return out;
}

/**
 * Synthetic B2B API-like payload for a set of child rows (current or previous period).
 * @param {Array<Record<string, any>>} rows — aggregated API rows (businessCategory "b2b")
 * @param {"current"|"prev"} which
 */
export function buildParentB2BPayload(rows, which = "current") {
    const b2bRows = (rows || []).filter((r) => r?.b2b);
    const ga4Totals = combineGa4Totals(b2bRows.map((r) => r.b2b?.[which]?.ga4Totals));

    const channelTotals = {};
    for (const c of AD_SPEND_CHANNELS) channelTotals[c.id] = 0;
    for (const r of b2bRows) {
        const src = which === "prev" ? r.prevData?.channelAdspend : r.channelAdspend;
        for (const c of AD_SPEND_CHANNELS) channelTotals[c.id] += Number(src?.[c.id]) || 0;
    }
    const totalSpend = Object.values(channelTotals).reduce((s, v) => s + v, 0);

    const payload = {
        ga4Configured: b2bRows.some((r) => r.b2b?.ga4Configured),
        ga4Totals,
        efficiency: {
            costPerSession: ga4Totals.sessions > 0 ? totalSpend / ga4Totals.sessions : 0,
            costPerConversion: ga4Totals.conversions > 0 ? totalSpend / ga4Totals.conversions : 0,
            conversionRate:
                ga4Totals.sessions > 0 ? (ga4Totals.conversions / ga4Totals.sessions) * 100 : 0,
        },
    };
    // One synthetic daily entry per channel so shared spend helpers (totals) keep working.
    for (const c of AD_SPEND_CHANNELS) {
        payload[c.mergeKey] = [{ period: "total", spend: channelTotals[c.id] }];
    }
    return payload;
}

/**
 * Overview metric maps (same keys as single-property B2B dashboard).
 */
export function computeParentB2BMetrics(rows, visibleAdChannels = []) {
    const current = buildParentB2BPayload(rows, "current");
    const comparison = buildParentB2BPayload(rows, "prev");
    return computeB2BMetricsData(current, comparison, visibleAdChannels);
}

const ADDITIVE_DAILY_KEYS = [
    "sessions",
    "totalUsers",
    "newUsers",
    "engagedSessions",
    "eventCount",
    "conversions",
    "screenPageViews",
    "totalMarketingSpend",
    "psCost",
    "ppcCost",
    "pinterestCost",
    "snapchatCost",
    "bingCost",
    "redditCost",
];

/**
 * Per-child payload → shape expected by buildB2BDailyRows.
 */
function childDailyToB2BPayload(result, usePrev) {
    const payload = { ga4Daily: usePrev ? result.ga4DailyPrev || [] : result.ga4Daily || [] };
    for (const c of AD_SPEND_CHANNELS) {
        payload[c.mergeKey] = usePrev ? result[`${c.mergeKey}Prev`] || [] : result[c.mergeKey] || [];
    }
    payload.adSpendByPeriod = adSpendByPeriodMap(payload);
    return payload;
}

/**
 * Aggregate daily rows across enabled B2B children (date-aligned, no cross-year alignment).
 * @param {Array<Record<string, any>>} dailyDataList
 * @param {{ usePrev?: boolean }} [options]
 */
export function buildParentB2BDailyRows(dailyDataList, options = {}) {
    const { usePrev = false } = options;
    /** @type {Record<string, Record<string, number|string>>} */
    const byDate = {};
    /** @type {Record<string, Record<string, number>>} */
    const weights = {};

    for (const result of dailyDataList || []) {
        if (result?.businessCategory !== "b2b") continue;
        const childRows = buildB2BDailyRows(childDailyToB2BPayload(result, usePrev));
        for (const row of childRows) {
            if (!byDate[row.date]) {
                byDate[row.date] = { date: row.date };
                for (const k of ADDITIVE_DAILY_KEYS) byDate[row.date][k] = 0;
                for (const k of WEIGHTED_KEYS) byDate[row.date][k] = 0;
                weights[row.date] = { sessions: 0 };
            }
            const target = byDate[row.date];
            for (const k of ADDITIVE_DAILY_KEYS) target[k] += Number(row[k]) || 0;
            const w = Number(row.sessions) || 0;
            weights[row.date].sessions += w;
            for (const k of WEIGHTED_KEYS) target[k] += (Number(row[k]) || 0) * w;
        }
    }

    return Object.values(byDate)
        .sort((a, b) => String(a.date).localeCompare(String(b.date)))
        .map((row) => {
            const sessions = Number(row.sessions) || 0;
            for (const k of WEIGHTED_KEYS) {
                row[k] = sessions > 0 ? Number(row[k]) / sessions : 0;
            }
            row.costPerSession = sessions > 0 ? row.totalMarketingSpend / sessions : 0;
            row.costPerConversion =
                row.conversions > 0 ? row.totalMarketingSpend / row.conversions : 0;
            return row;
        });
}