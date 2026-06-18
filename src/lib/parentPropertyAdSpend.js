import {
    AD_SPEND_CHANNELS,
    adSpendChannelsForShopifyMarketsFilterUi,
    channelDailyRowsFromMerged,
    channelSpendTotalsFromMerged,
    totalAdSpendFromMerged,
} from "./mergeAdSpendDaily";
import { parentChildDayDisplayRevenue } from "./parentPropertyMetrics";

/** Key on parent aggregated daily rows, e.g. `facebookSpend`, `snapchatSpend`. */
export function parentDailySpendKey(channelId) {
    return `${channelId}Spend`;
}

/** Sum all channel spend fields on a parent aggregated daily row. */
export function parentTotalSpendFromDailyRow(d) {
    let total = 0;
    for (const c of AD_SPEND_CHANNELS) {
        total += Number(d?.[parentDailySpendKey(c.id)] || 0);
    }
    return total;
}

/**
 * Per-channel totals + legacy row fields for parent property table/API rows.
 * @param {Record<string, unknown>} merged
 */
export function parentRowAdspendFromMerged(merged) {
    const totals = channelSpendTotalsFromMerged(merged);
    /** @type {Record<string, number>} */
    const channelAdspend = {};
    for (const c of AD_SPEND_CHANNELS) {
        channelAdspend[c.id] = Number(totals[c.metricsDataKey]) || 0;
    }
    return {
        channelAdspend,
        facebookAdspend: channelAdspend.facebook ?? 0,
        googleAdspend: channelAdspend.google ?? 0,
        snapchatAdspend: channelAdspend.snapchat ?? 0,
        redditAdspend: channelAdspend.reddit ?? 0,
        pinterestAdspend: channelAdspend.pinterest ?? 0,
        bingAdspend: channelAdspend.bing ?? 0,
        adspend: totalAdSpendFromMerged(merged),
    };
}

/**
 * Union of Spend-filter channels across all children (Shopify Markets rules).
 * @param {Array<{ CustomerSettings?: Record<string, unknown> }>} childCustomers
 */
export function parentGroupVisibleAdSpendChannels(childCustomers) {
    /** @type {Map<string, typeof AD_SPEND_CHANNELS[number]>} */
    const byId = new Map();
    for (const c of childCustomers || []) {
        for (const ch of adSpendChannelsForShopifyMarketsFilterUi(c?.CustomerSettings || {})) {
            if (!byId.has(ch.id)) byId.set(ch.id, ch);
        }
    }
    return AD_SPEND_CHANNELS.filter((c) => byId.has(c.id));
}

/**
 * @param {Array<Record<string, unknown>>} dailyDataList — per-child daily payloads from parent API
 * @param {string} shopifyRevenueField
 * @param {Record<string, { CustomerSettings?: Record<string, unknown> }>} [customersById]
 */
export function aggregateParentGroupDailyChart(
    dailyDataList,
    shopifyRevenueField = "net_sales",
    customersById = {}
) {
    /** @type {Record<string, Record<string, number|string>>} */
    const dailyMap = {};

    const ensure = (period) => {
        if (!dailyMap[period]) {
            dailyMap[period] = { period, revenue: 0, orders: 0 };
            for (const c of AD_SPEND_CHANNELS) {
                dailyMap[period][parentDailySpendKey(c.id)] = 0;
            }
        }
        return dailyMap[period];
    };

    for (const result of dailyDataList || []) {
        const customerSettings =
            customersById[String(result._id)]?.CustomerSettings || {};
        const shopifyDaily = result.shopifyDaily || [];
        for (const d of shopifyDaily) {
            const row = ensure(d.period);
            const rv =
                parentChildDayDisplayRevenue(d, shopifyRevenueField, customerSettings) || 0;
            row.revenue += rv;
            row.orders += d.orders || 0;
        }

        for (const c of AD_SPEND_CHANNELS) {
            const arr = result[c.mergeKey] || [];
            const key = parentDailySpendKey(c.id);
            for (const d of arr) {
                const row = ensure(d.period);
                row[key] += Number(d.spend || 0);
            }
        }
    }

    return Object.values(dailyMap).sort((a, b) => String(a.period).localeCompare(String(b.period)));
}

/**
 * Build dailyData / dailyDataPrev fields for parent aggregated API child payload.
 * @param {Record<string, unknown>} mergedCurrent
 * @param {Record<string, unknown>} mergedPrev
 */
export function parentChildDailyPayloadFromMerged(mergedCurrent, mergedPrev) {
    const curr = channelDailyRowsFromMerged(mergedCurrent);
    const prev = channelDailyRowsFromMerged(mergedPrev);
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const c of AD_SPEND_CHANNELS) {
        out[c.mergeKey] = curr[c.id] || [];
        const prevKey = `${c.mergeKey}Prev`;
        out[prevKey] = prev[c.id] || [];
    }
    return out;
}
