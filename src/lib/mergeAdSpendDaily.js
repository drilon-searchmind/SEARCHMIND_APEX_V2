/**
 * Keys on merged-sources payloads that hold `{ period, spend }[]` daily ad rows.
 * Keep in sync with `fetchMergedSources` in mergedSourcesApi.js.
 */

import { isAdSpendPlatformConfigured } from "./customerServiceIntegrations";
import { normalizeRedditSettings } from "./redditCustomerSettings";

export const MERGED_AD_DAILY_KEYS = [
    "facebookDaily",
    "googleDaily",
    "pinterestDaily",
    "snapchatDaily",
    "bingDaily",
    "redditDaily",
];

/**
 * Sum total spend across all paid media daily arrays on a merged-sources object.
 * @param {Record<string, unknown>} merged
 * @returns {number}
 */
export function totalAdSpendFromMerged(merged) {
    let t = 0;
    for (const k of MERGED_AD_DAILY_KEYS) {
        for (const d of merged?.[k] || []) {
            t += Number(d?.spend || 0);
        }
    }
    return t;
}

/**
 * @param {Array<{ date?: string, DATE?: string, ad_spend?: number, spend?: number }>} metrics_by_date
 * @returns {Array<{ period: string, spend: number }>}
 */
export function metricsByDateToSpendDaily(metrics_by_date) {
    const rows = metrics_by_date || [];
    return rows
        .map((r) => {
            const raw = r?.date ?? r?.DATE;
            const period = raw != null ? String(raw).slice(0, 10) : "";
            if (!period) return null;
            const spend =
                parseFloat(r?.ad_spend ?? r?.AD_SPEND ?? r?.spend ?? 0) || 0;
            return { period, spend };
        })
        .filter(Boolean)
        .sort((a, b) => a.period.localeCompare(b.period));
}

/**
 * Merge all channel daily rows into one map by calendar date (sums spend when duplicate period keys exist).
 * @param {Record<string, unknown>} merged
 * @returns {Record<string, number>}
 */
export function adSpendByPeriodMap(merged) {
    /** @type {Record<string, number>} */
    const map = {};
    for (const k of MERGED_AD_DAILY_KEYS) {
        for (const d of merged?.[k] || []) {
            const p = d?.period;
            if (!p) continue;
            const ymd = String(p).slice(0, 10);
            map[ymd] = (map[ymd] || 0) + (Number(d.spend) || 0);
        }
    }
    return map;
}

/**
 * Canonical paid-media channels: merge-sources keys → UI / metricsData keys.
 * `bucketKey` is used in `aggregateShopifyAndAdSpendByPeriodFromRows` per-period buckets.
 */
export const AD_SPEND_CHANNELS = [
    {
        id: "facebook",
        mergeKey: "facebookDaily",
        bucketKey: "costFacebook",
        metricsDataKey: "meta_spend",
        dailyOverviewColumnKey: "psCost",
        label: "Meta",
        paceChartName: "Meta (cumulative)",
    },
    {
        id: "google",
        mergeKey: "googleDaily",
        bucketKey: "costGoogle",
        metricsDataKey: "google_spend",
        dailyOverviewColumnKey: "ppcCost",
        label: "Google Ads",
        paceChartName: "Google Ads (cumulative)",
    },
    {
        id: "pinterest",
        mergeKey: "pinterestDaily",
        bucketKey: "costPinterest",
        metricsDataKey: "pinterest_spend",
        dailyOverviewColumnKey: "pinterestCost",
        label: "Pinterest Ads",
        paceChartName: "Pinterest (cumulative)",
    },
    {
        id: "snapchat",
        mergeKey: "snapchatDaily",
        bucketKey: "costSnapchat",
        metricsDataKey: "snapchat_spend",
        dailyOverviewColumnKey: "snapchatCost",
        label: "Snapchat Ads",
        paceChartName: "Snapchat (cumulative)",
    },
    {
        id: "bing",
        mergeKey: "bingDaily",
        bucketKey: "costBing",
        metricsDataKey: "bing_spend",
        dailyOverviewColumnKey: "bingCost",
        label: "Microsoft (Bing) Ads",
        paceChartName: "Bing (cumulative)",
    },
    {
        id: "reddit",
        mergeKey: "redditDaily",
        bucketKey: "costReddit",
        metricsDataKey: "reddit_spend",
        dailyOverviewColumnKey: "redditCost",
        label: "Reddit Ads",
        paceChartName: "Reddit (cumulative)",
    },
];

/** Daily overview `metricConfig` keys for paid media columns (same order as `AD_SPEND_CHANNELS`). */
export const AD_SPEND_DAILY_COLUMN_KEYS = AD_SPEND_CHANNELS.map(
    (c) => c.dailyOverviewColumnKey
);

/**
 * Channels whose integration is configured for the customer (IDs + auth rules).
 * @param {Record<string, unknown>|null|undefined} settings - CustomerSettings
 * @returns {typeof AD_SPEND_CHANNELS[number][]}
 */
export function adSpendChannelsConfigured(settings) {
    if (!settings) return [];
    return AD_SPEND_CHANNELS.filter((c) => isAdSpendPlatformConfigured(settings, c.id));
}

/** Reddit appears in the Spend filter when the customer has a Reddit app (client) id. */
export function isRedditInShopifyMarketsSpendFilter(settings) {
    const appId = normalizeRedditSettings(settings).appId;
    return String(appId || "").trim().length > 0;
}

/**
 * Spend filter checkboxes in Shopify Markets views: configured integrations + Reddit when app id is set.
 * @param {Record<string, unknown>|null|undefined} settings - CustomerSettings
 * @returns {typeof AD_SPEND_CHANNELS[number][]}
 */
export function adSpendChannelsForShopifyMarketsFilterUi(settings) {
    const channels = adSpendChannelsConfigured(settings);
    const ids = new Set(channels.map((c) => c.id));
    if (isRedditInShopifyMarketsSpendFilter(settings) && !ids.has("reddit")) {
        const reddit = AD_SPEND_CHANNELS.find((c) => c.id === "reddit");
        if (reddit) channels.push(reddit);
    }
    return channels;
}

/**
 * Default for Shopify Markets Spend filter: all visible channels included (nothing excluded).
 * @returns {Record<string, true>}
 */
export function buildDefaultExcludedAdSpendPlatformsForShopifyMarkets() {
    return {};
}

/**
 * Channels to show on dashboards: configured + meaningful spend in current or comparison merged payload.
 * Spend with total ≤ minSpendExclusive for both periods is hidden (default hides 0 and 1).
 *
 * @param {Record<string, unknown>|null|undefined} settings - CustomerSettings
 * @param {Record<string, unknown>|null|undefined} merged
 * @param {Record<string, unknown>|null|undefined} mergedPrev
 * @param {number} [minSpendExclusive=1]
 */
export function adSpendChannelsForSpendTotals(
    settings,
    channelTotalsCurrent,
    channelTotalsPrev,
    minSpendExclusive = 1
) {
    const configured = adSpendChannelsConfigured(settings);
    if (!channelTotalsCurrent || typeof channelTotalsCurrent !== "object") return configured;
    const tPrev =
        channelTotalsPrev && typeof channelTotalsPrev === "object"
            ? channelTotalsPrev
            : null;

    return configured.filter((c) => {
        const a = Number(channelTotalsCurrent[c.metricsDataKey]) || 0;
        if (!tPrev) return a > minSpendExclusive;
        const b = Number(tPrev[c.metricsDataKey]) || 0;
        return a > minSpendExclusive || b > minSpendExclusive;
    });
}

export function adSpendChannelsForDashboard(settings, merged, mergedPrev, minSpendExclusive = 1) {
    const configured = adSpendChannelsConfigured(settings);
    if (!merged) return configured;
    const tCurr = channelSpendTotalsFromMerged(merged);
    const tPrev = mergedPrev ? channelSpendTotalsFromMerged(mergedPrev) : undefined;
    return adSpendChannelsForSpendTotals(settings, tCurr, tPrev, minSpendExclusive);
}

/**
 * @param {Record<string, unknown>} merged
 * @returns {Record<string, number>} e.g. { meta_spend, google_spend, ... }
 */
export function channelSpendTotalsFromMerged(merged) {
    /** @type {Record<string, number>} */
    const out = {};
    for (const c of AD_SPEND_CHANNELS) {
        out[c.metricsDataKey] = (merged?.[c.mergeKey] || []).reduce(
            (s, d) => s + Number(d?.spend || 0),
            0
        );
    }
    return out;
}

/**
 * @param {Record<string, unknown>} merged
 * @returns {Record<string, Array<{ period: string, spend: number }>>}
 */
export function channelDailyRowsFromMerged(merged) {
    /** @type {Record<string, Array<{ period: string, spend: number }>>} */
    const ch = {};
    for (const c of AD_SPEND_CHANNELS) {
        ch[c.id] = Array.isArray(merged?.[c.mergeKey]) ? merged[c.mergeKey] : [];
    }
    return ch;
}

/**
 * Per-period buckets for Shopify + each ad channel (for Performance / Custom charts).
 * @param {unknown[]} shopifyArr
 * @param {Record<string, Array<{ period: string, spend?: number }>>} channelRows — keys: facebook, google, pinterest, snapchat, bing, reddit
 * @param {(period: string) => string} keyFn
 */
export function aggregateShopifyAndAdSpendByPeriodFromRows(shopifyArr, channelRows, keyFn) {
    const map = {};
    const bucket = () => ({
        revenue: 0,
        totalRevenue: 0,
        grossSales: 0,
        discounts: 0,
        orders: 0,
        cost: 0,
        costFacebook: 0,
        costGoogle: 0,
        costPinterest: 0,
        costSnapchat: 0,
        costBing: 0,
        costReddit: 0,
        cogs: 0,
        returns: 0,
    });
    const ensure = (k) => {
        if (!map[k]) map[k] = bucket();
        return map[k];
    };
    (shopifyArr || []).forEach((d) => {
        const k = keyFn(d.period);
        const o = ensure(k);
        o.totalRevenue += Number(d.total_sales || 0);
        o.grossSales += Number(d.gross_sales || 0);
        o.discounts += Number(d.discounts || 0);
        o.revenue += Number(d.net_sales || d.total_sales || 0);
        o.orders += Number(d.orders || 0);
        o.cogs += Number(d.cost_of_goods_sold || 0);
        o.returns += Number(d.returns || 0);
    });
    for (const spec of AD_SPEND_CHANNELS) {
        const arr = channelRows[spec.id] || [];
        const bk = spec.bucketKey;
        for (const d of arr) {
            const k = keyFn(d.period);
            const o = ensure(k);
            const v = Number(d.spend || 0);
            o.cost += v;
            o[bk] += v;
        }
    }
    return map;
}

/** Cumulative spend lines for pace-report (matches total cost chart: first point "0"). */
export function buildChannelCumulativeSpendSeriesForPace(merged, allPeriods, channelSpecs = AD_SPEND_CHANNELS) {
    if (!Array.isArray(allPeriods) || allPeriods.length === 0) return [];
    const specs = Array.isArray(channelSpecs) && channelSpecs.length > 0 ? channelSpecs : AD_SPEND_CHANNELS;
    const series = [];
    for (const spec of specs) {
        const daySpend = {};
        for (const d of merged?.[spec.mergeKey] || []) {
            const p = String(d?.period || "").slice(0, 10);
            if (!p) continue;
            daySpend[p] = (daySpend[p] || 0) + Number(d.spend || 0);
        }
        let cumulative = 0;
        const totals = allPeriods.map((period) => {
            cumulative += daySpend[String(period).slice(0, 10)] || 0;
            return cumulative;
        });
        const data = allPeriods.map((_, idx) =>
            idx === 0 ? "0" : String(Math.round(totals[idx]))
        );
        series.push({ name: spec.paceChartName, data });
    }
    return series;
}

/**
 * Legacy: non–Meta/Google spend combined as one series (deprecated; prefer per-channel).
 * @param {Record<string, unknown>} merged
 * @returns {Array<{ period: string, spend: number }>}
 */
export function combineOtherPaidDailyRows(merged) {
    /** @type {Record<string, number>} */
    const byPeriod = {};
    for (const k of MERGED_AD_DAILY_KEYS) {
        if (k === "facebookDaily" || k === "googleDaily") continue;
        for (const d of merged?.[k] || []) {
            const raw = d?.period;
            if (!raw) continue;
            const ymd = String(raw).slice(0, 10);
            byPeriod[ymd] = (byPeriod[ymd] || 0) + (Number(d.spend) || 0);
        }
    }
    return Object.entries(byPeriod)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, spend]) => ({ period, spend }));
}

