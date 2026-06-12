import { channelSpendTotalsFromMerged, totalAdSpendFromMerged } from "@/lib/mergeAdSpendDaily";
import {
    percentChange,
    changeTypeForMetric,
    formatPercentChangeDisplay,
} from "@/lib/performanceDashboard/metricComparisonChange";
import { evaluateB2BFormula, buildB2BDailyMetricsRow } from "./b2bKpiFormulaUtils";
import { B2B_PCT_KEYS, B2B_RATIO_KEYS } from "./b2bKpiConstants";

const fmt = (n, d = 0) =>
    (n ?? 0).toLocaleString("da-DK", { maximumFractionDigits: d, minimumFractionDigits: d });

const fmtCur = (n) =>
    n != null && !Number.isNaN(n)
        ? n.toLocaleString("da-DK", {
              style: "currency",
              currency: "DKK",
              maximumFractionDigits: 0,
          })
        : "-";

function formatDiff(current, prev, type) {
    if (prev === null || prev === undefined) return undefined;
    const diff = (current ?? 0) - (prev ?? 0);
    if (type === "currency") {
        return diff >= 0
            ? `+${fmtCur(diff)}`
            : fmtCur(diff);
    }
    if (type === "count") return diff >= 0 ? `+${diff}` : `${diff}`;
    if (type === "ratio") return diff >= 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2);
    if (type === "pct") return diff >= 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`;
    return undefined;
}

function formatMetricValue(key, value) {
    if (value == null || Number.isNaN(value)) return "-";
    if (key === "averageSessionDuration") {
        const sec = Number(value) || 0;
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}m ${String(s).padStart(2, "0")}s`;
    }
    if (B2B_PCT_KEYS.has(key) || key === "engagementRate" || key === "bounce_rate") {
        const pct = Number(value) <= 1 ? Number(value) * 100 : Number(value);
        return `${pct.toFixed(1)}%`;
    }
    if (B2B_RATIO_KEYS.has(key) && !B2B_PCT_KEYS.has(key)) {
        return fmt(value, 2);
    }
    if (key.includes("spend") || key.startsWith("cost") || key === "marketing_spend") {
        return fmtCur(value);
    }
    return fmt(value, 0);
}

function makeMetricEntry(key, label, current, prev, { icon, popOverContent, calcValueLabels, ga4ConversionSettingsActive } = {}) {
    const pct = percentChange(current, prev);
    const isCurrency =
        key.includes("spend") || key.startsWith("cost") || key === "marketing_spend";
    const isPct = B2B_PCT_KEYS.has(key) || key === "engagementRate" || key === "bounce_rate";
    const isRatio = B2B_RATIO_KEYS.has(key) && !isPct;
    const isDuration = key === "averageSessionDuration";

    return {
        key,
        label,
        value: formatMetricValue(key, current),
        change: formatPercentChangeDisplay(pct, isRatio || isPct ? 1 : 0),
        changeType: changeTypeForMetric(key, pct),
        changeAbsolute: formatDiff(
            current,
            prev,
            isDuration ? "ratio" : isPct ? "pct" : isRatio ? "ratio" : isCurrency ? "currency" : "count"
        ),
        changePrevValue: formatMetricValue(key, prev),
        icon,
        popOverContent: popOverContent ?? null,
        calcValueLabels: calcValueLabels ?? null,
        ga4ConversionSettingsActive: ga4ConversionSettingsActive === true,
    };
}

function buildB2BCalcContent(key, data, { conversionEventNames = [], conversionSource = "default" } = {}) {
    const sessions = data?.sessions ?? 0;
    const conversions = data?.conversions ?? 0;
    const cost = data?.marketing_spend ?? data?.cost ?? 0;
    const convRate = data?.conversion_rate ?? (sessions > 0 ? (conversions / sessions) * 100 : 0);
    const cpl = data?.cost_per_lead ?? (conversions > 0 ? cost / conversions : 0);
    const cps = data?.cost_per_session ?? (sessions > 0 ? cost / sessions : 0);
    const leadsPer1k = data?.leads_per_1k_spend ?? (cost > 0 ? (conversions / cost) * 1000 : 0);
    const spc = data?.sessions_per_conversion ?? (conversions > 0 ? sessions / conversions : 0);

    const convLabel =
        conversionSource === "custom" && conversionEventNames.length
            ? `Sum of GA4 events: ${conversionEventNames.join(", ")}`
            : "GA4 key events (default conversions metric)";

    switch (key) {
        case "conversions":
            return {
                popOverContent: `${convLabel}\n= ${fmt(conversions)}`,
                calcValueLabels: `Source: ${conversionSource === "custom" ? "Custom events" : "GA4 default"}\nEvents: ${
                    conversionEventNames.length ? conversionEventNames.join(", ") : "All key events"
                }`,
                ga4ConversionSettingsActive: conversionSource === "custom",
            };
        case "conversion_rate":
            return {
                popOverContent: `Conversion Rate = Conversions / Sessions × 100\n= ${fmt(conversions)} / ${fmt(sessions)} × 100\n= ${convRate.toFixed(2)}%`,
                calcValueLabels: `Conversions: ${fmt(conversions)}\nSessions: ${fmt(sessions)}`,
            };
        case "cost_per_lead":
            return {
                popOverContent: `Cost per Lead = Marketing Spend / Conversions\n= ${fmtCur(cost)} / ${fmt(conversions)}\n= ${fmtCur(cpl)}`,
                calcValueLabels: `Marketing Spend: ${fmtCur(cost)}\nConversions: ${fmt(conversions)}`,
            };
        case "cost_per_session":
            return {
                popOverContent: `Cost per Session = Marketing Spend / Sessions\n= ${fmtCur(cost)} / ${fmt(sessions)}\n= ${fmtCur(cps)}`,
                calcValueLabels: `Marketing Spend: ${fmtCur(cost)}\nSessions: ${fmt(sessions)}`,
            };
        case "leads_per_1k_spend":
            return {
                popOverContent: `Leads per 1k Spend = (Conversions / Spend) × 1000\n= (${fmt(conversions)} / ${fmtCur(cost)}) × 1000\n= ${leadsPer1k.toFixed(2)}`,
                calcValueLabels: `Conversions: ${fmt(conversions)}\nSpend: ${fmtCur(cost)}`,
            };
        case "sessions_per_conversion":
            return {
                popOverContent: `Sessions per Lead = Sessions / Conversions\n= ${fmt(sessions)} / ${fmt(conversions)}\n= ${spc.toFixed(2)}`,
                calcValueLabels: `Sessions: ${fmt(sessions)}\nConversions: ${fmt(conversions)}`,
            };
        case "marketing_spend":
        case "cost":
            return {
                popOverContent: `Total Ad Spend\n= ${fmtCur(cost)}`,
                calcValueLabels: `Total: ${fmtCur(cost)}`,
            };
        case "sessions":
            return {
                popOverContent: `Sessions (GA4)\n= ${fmt(sessions)}`,
                calcValueLabels: `Sessions: ${fmt(sessions)}`,
            };
        case "engagement_rate":
        case "engagementRate": {
            const rate = data?.engagement_rate ?? data?.engagementRate ?? 0;
            const pct = Number(rate) <= 1 ? rate * 100 : rate;
            return {
                popOverContent: `Engagement Rate (GA4 average)\n= ${pct.toFixed(1)}%`,
                calcValueLabels: `Rate: ${pct.toFixed(1)}%`,
            };
        }
        default:
            return {};
    }
}

function enrichMetricWithCalcs(metric, metricsData, calcContext) {
    const calc = buildB2BCalcContent(metric.key, metricsData, calcContext);
    if (!calc.popOverContent) return metric;
    return { ...metric, ...calc };
}

/**
 * Build flat metricsData + prev from B2B dashboard API payloads.
 */
export function computeB2BMetricsData(current, comparison, visibleAdChannels = []) {
    const ga4 = current?.ga4Totals || {};
    const ga4Prev = comparison?.ga4Totals || {};
    const efficiency = current?.efficiency || {};
    const efficiencyPrev = comparison?.efficiency || {};

    const cost = totalAdSpendFromMerged(current || {});
    const costPrev = totalAdSpendFromMerged(comparison || {});
    const chTotals = channelSpendTotalsFromMerged(current || {});
    const chTotalsPrev = channelSpendTotalsFromMerged(comparison || {});

    const sessions = ga4.sessions || 0;
    const conversions = ga4.conversions || 0;

    const data = {
        sessions,
        totalUsers: ga4.totalUsers || 0,
        newUsers: ga4.newUsers || 0,
        new_users: ga4.newUsers || 0,
        engagedSessions: ga4.engagedSessions || 0,
        engagementRate: ga4.engagementRate || 0,
        engagement_rate: ga4.engagementRate || 0,
        averageSessionDuration: ga4.averageSessionDuration || 0,
        bounceRate: ga4.bounceRate || 0,
        bounce_rate: ga4.bounceRate || 0,
        screenPageViews: ga4.screenPageViews || 0,
        eventCount: ga4.eventCount || 0,
        conversions,
        conversion_rate: efficiency.conversionRate ?? 0,
        cost,
        marketing_spend: cost,
        cost_per_session: efficiency.costPerSession ?? 0,
        cost_per_lead: efficiency.costPerConversion ?? 0,
        leads_per_1k_spend: cost > 0 ? (conversions / cost) * 1000 : 0,
        sessions_per_conversion: conversions > 0 ? sessions / conversions : 0,
        sessions_base: sessions,
    };

    for (const ch of visibleAdChannels) {
        data[ch.metricsDataKey] = chTotals[ch.metricsDataKey] ?? 0;
    }

    const dataPrev = {
        sessions: ga4Prev.sessions || 0,
        totalUsers: ga4Prev.totalUsers || 0,
        newUsers: ga4Prev.newUsers || 0,
        new_users: ga4Prev.newUsers || 0,
        engagedSessions: ga4Prev.engagedSessions || 0,
        engagementRate: ga4Prev.engagementRate || 0,
        engagement_rate: ga4Prev.engagementRate || 0,
        averageSessionDuration: ga4Prev.averageSessionDuration || 0,
        bounceRate: ga4Prev.bounceRate || 0,
        bounce_rate: ga4Prev.bounceRate || 0,
        screenPageViews: ga4Prev.screenPageViews || 0,
        eventCount: ga4Prev.eventCount || 0,
        conversions: ga4Prev.conversions || 0,
        conversion_rate: efficiencyPrev.conversionRate ?? 0,
        cost: costPrev,
        marketing_spend: costPrev,
        cost_per_session: efficiencyPrev.costPerSession ?? 0,
        cost_per_lead: efficiencyPrev.costPerConversion ?? 0,
        leads_per_1k_spend: costPrev > 0 ? ((ga4Prev.conversions || 0) / costPrev) * 1000 : 0,
        sessions_per_conversion:
            (ga4Prev.conversions || 0) > 0 ? (ga4Prev.sessions || 0) / ga4Prev.conversions : 0,
        sessions_base: ga4Prev.sessions || 0,
    };

    for (const ch of visibleAdChannels) {
        dataPrev[ch.metricsDataKey] = chTotalsPrev[ch.metricsDataKey] ?? 0;
    }

    return { metricsData: data, metricsDataPrev: dataPrev };
}

const METRIC_LABELS = {
    sessions: "Sessions",
    totalUsers: "Users",
    newUsers: "New Users",
    new_users: "New Users",
    engagedSessions: "Engaged Sessions",
    engagement_rate: "Engagement Rate",
    engagementRate: "Engagement Rate",
    averageSessionDuration: "Avg. Session Duration",
    bounce_rate: "Bounce Rate",
    screenPageViews: "Pageviews",
    eventCount: "Events",
    conversions: "Conversions",
    conversion_rate: "Conversion Rate",
    marketing_spend: "Total Ad Spend",
    cost: "Marketing Spend",
    cost_per_session: "Cost per Session",
    cost_per_lead: "Cost per Lead",
    leads_per_1k_spend: "Leads per 1k Spend",
    sessions_per_conversion: "Sessions per Lead",
    meta_spend: "Meta spend",
    google_spend: "Google Ads spend",
    pinterest_spend: "Pinterest spend",
    snapchat_spend: "Snapchat spend",
    bing_spend: "Microsoft Ads spend",
    reddit_spend: "Reddit spend",
};

/**
 * Build MetricCard-compatible array for all B2B keys + custom KPI replacements.
 */
export function buildB2BMetricsArray({
    metricsData,
    metricsDataPrev,
    metricKeys,
    customKpis = [],
    replacementByKey = {},
    conversionEventNames = [],
    conversionSource = "default",
}) {
    const calcContext = { conversionEventNames, conversionSource };
    const keys = metricKeys || Object.keys(METRIC_LABELS);
    const metrics = [];

    for (const key of keys) {
        const rep = replacementByKey[key];
        if (rep) {
            metrics.push({
                key,
                label: rep.kpiName,
                value: formatMetricValue(key, rep.value),
                change: formatPercentChangeDisplay(
                    percentChange(rep.value, rep.valuePrev),
                    B2B_RATIO_KEYS.has(key) ? 1 : 0
                ),
                changeType: changeTypeForMetric(
                    key,
                    percentChange(rep.value, rep.valuePrev)
                ),
                changePrevValue: formatMetricValue(key, rep.valuePrev),
                isCustomReplacement: true,
                customKpiId: rep.kpiId,
            });
            continue;
        }

        const label = METRIC_LABELS[key] || key;
        const entry = makeMetricEntry(key, label, metricsData?.[key], metricsDataPrev?.[key]);
        metrics.push(enrichMetricWithCalcs(entry, metricsData, calcContext));
    }

    for (const kpi of customKpis) {
        if (kpi.replacesStandardMetricKey) continue;
        const val = evaluateB2BFormula(kpi, metricsData);
        const valPrev = evaluateB2BFormula(kpi, metricsDataPrev);
        metrics.push({
            key: `custom_${kpi.id || kpi._id}`,
            label: kpi.name,
            value: val != null ? fmt(val, 2) : "-",
            change: formatPercentChangeDisplay(percentChange(val, valPrev), 1),
            changeType: changeTypeForMetric(kpi.name, percentChange(val, valPrev)),
            isCustom: true,
            customKpiId: kpi.id || kpi._id,
        });
    }

    return metrics;
}

export function buildB2BReplacementMap(customKpis, metricsData, metricsDataPrev) {
    /** @type {Record<string, { kpiId: string, kpiName: string, value: number, valuePrev: number }>} */
    const map = {};
    for (const kpi of customKpis || []) {
        const key = kpi.replacesStandardMetricKey;
        if (!key) continue;
        map[key] = {
            kpiId: String(kpi.id || kpi._id),
            kpiName: kpi.name,
            value: evaluateB2BFormula(kpi, metricsData) ?? 0,
            valuePrev: evaluateB2BFormula(kpi, metricsDataPrev) ?? 0,
        };
    }
    return map;
}

/** Daily row metrics for custom KPI charts. */
export function buildB2BDailySeries(current, comparison) {
    const ga4ByDate = Object.fromEntries((current?.ga4Daily || []).map((d) => [d.date, d]));
    const ga4PrevByDate = Object.fromEntries((comparison?.ga4Daily || []).map((d) => [d.date, d]));
    const spendMap = current?.adSpendByPeriod || {};
    const spendPrevMap = comparison?.adSpendByPeriod || {};

    const dates = Array.from(
        new Set([
            ...(current?.ga4Daily || []).map((d) => d.date),
            ...Object.keys(spendMap),
        ])
    ).sort();

    const currRows = dates.map((date) =>
        buildB2BDailyMetricsRow(date, ga4ByDate[date], spendMap[date] || 0, current)
    );

    const prevDates = (comparison?.ga4Daily || []).map((d) => d.date).sort();
    const prevRows = prevDates.map((date) =>
        buildB2BDailyMetricsRow(date, ga4PrevByDate[date], spendPrevMap[date] || 0, comparison)
    );

    return { currRows, prevRows, categories: dates };
}
