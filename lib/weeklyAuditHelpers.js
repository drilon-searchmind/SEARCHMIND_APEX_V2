import {
    COMPARISON_METHOD,
    DATE_FORMAT,
    getComparisonPeriodRange,
} from "@/lib/dateRangeComparison";

/** @typedef {'prev_period'|'yoy'} WeeklyAuditCompareMode */
/** @typedef {'active'|'contracted_not_connected'|'access_error'|'empty'|'not_contracted'} ServiceStatus */

/**
 * @param {number|null|undefined} n
 * @param {number} [decimals=2]
 */
export function roundNum(n, decimals = 2) {
    if (n == null || Number.isNaN(n)) return null;
    const f = 10 ** decimals;
    return Math.round(Number(n) * f) / f;
}

/**
 * @param {number|null|undefined} current
 * @param {number|null|undefined} previous
 */
export function deltaPct(current, previous) {
    const c = Number(current);
    const p = Number(previous);
    if (!Number.isFinite(c) || !Number.isFinite(p) || p === 0) return null;
    return roundNum(((c - p) / Math.abs(p)) * 100, 1);
}

/**
 * @param {number|null|undefined} current
 * @param {number|null|undefined} previous
 * @param {{ includeDelta?: boolean }} [opts]
 */
export function metricCompare(current, previous, opts = {}) {
    const includeDelta = opts.includeDelta !== false;
    const out = {
        current: roundNum(current),
        previous: roundNum(previous),
    };
    if (includeDelta) {
        out.deltaPct = deltaPct(current, previous);
    }
    return out;
}

/**
 * @param {string} periodStart
 * @param {string} periodEnd
 * @param {WeeklyAuditCompareMode} [compare='prev_period']
 */
export function resolveWeeklyAuditPreviousPeriod(periodStart, periodEnd, compare = "prev_period") {
    const method =
        compare === "yoy" ? COMPARISON_METHOD.LAST_YEAR : COMPARISON_METHOD.LAST_PERIOD;
    const comp = getComparisonPeriodRange({
        comparisonMethod: method,
        startDate: periodStart,
        endDate: periodEnd,
    });
    if (comp.skip || !comp.prevStart || !comp.prevEnd) {
        throw new Error("Could not resolve comparison period");
    }
    return {
        prevStart: comp.prevStart.format(DATE_FORMAT),
        prevEnd: comp.prevEnd.format(DATE_FORMAT),
    };
}

/**
 * @param {Array<Record<string, unknown>>} rows
 * @param {string} field
 */
export function sumDailyField(rows, field) {
    return (rows || []).reduce((sum, d) => sum + (parseFloat(d[field]) || 0), 0);
}

/**
 * Returns absolute positive returns total from shopify daily rows.
 * @param {Array<Record<string, unknown>>} shopifyDaily
 */
export function sumReturnsAbs(shopifyDaily) {
    const raw = sumDailyField(shopifyDaily, "returns");
    return Math.abs(raw);
}

/**
 * @param {import('@/lib/mergedSourcesApi').fetchMergedSources extends (...args: any[]) => Promise<infer R> ? R : never} merged
 */
export function aggregateBlendedFromMerged(merged) {
    const shopifyDaily = merged.shopifyDaily || [];
    const netSales = sumDailyField(shopifyDaily, "net_sales");
    const orders = sumDailyField(shopifyDaily, "orders");
    const returns = sumReturnsAbs(shopifyDaily);

    const fbSpend = sumDailyField(merged.facebookDaily, "spend");
    const googleSpend = sumDailyField(merged.googleDaily, "spend");
    const otherSpend =
        sumDailyField(merged.pinterestDaily, "spend") +
        sumDailyField(merged.snapchatDaily, "spend") +
        sumDailyField(merged.bingDaily, "spend") +
        sumDailyField(merged.redditDaily, "spend");
    const totalSpend = fbSpend + googleSpend + otherSpend;
    const grossProfitNet = merged.grossProfitNetSales ?? netSales;
    const poas = totalSpend > 0 ? grossProfitNet / totalSpend : null;
    const blendedRoas = totalSpend > 0 ? netSales / totalSpend : null;
    const cpa = orders > 0 ? totalSpend / orders : null;
    const returnsRatePct = netSales > 0 ? (returns / netSales) * 100 : null;

    return {
        totalSpend,
        googleSpend,
        metaSpend: fbSpend,
        otherSpend,
        netSales,
        orders,
        returns,
        returnsRatePct: roundNum(returnsRatePct, 1),
        grossProfitNet,
        poas,
        blendedRoas,
        cpa,
    };
}

/**
 * @param {Array<Record<string, unknown>>} metricsByDate
 * @param {Array<Record<string, unknown>>} [topCampaigns]
 * @param {Array<Record<string, unknown>>} [impressionShareDaily]
 */
export function aggregatePpcFromGoogle(metricsByDate, topCampaigns = [], impressionShareDaily = []) {
    const rows = metricsByDate || [];
    const spend = rows.reduce((s, d) => s + (parseFloat(d.ad_spend) || 0), 0);
    const conversions = rows.reduce((s, d) => s + (parseFloat(d.conversions) || 0), 0);
    const conversionValue = rows.reduce((s, d) => s + (parseFloat(d.conversions_value) || 0), 0);
    const clicks = rows.reduce((s, d) => s + (parseFloat(d.clicks) || 0), 0);
    const impressions = rows.reduce((s, d) => s + (parseFloat(d.impressions) || 0), 0);
    const roas = spend > 0 ? conversionValue / spend : null;
    const cpa = conversions > 0 ? spend / conversions : null;
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : null;
    const cpc = clicks > 0 ? spend / clicks : null;

    let impressionShare = null;
    let isLostBudgetPct = null;
    let isLostRankPct = null;
    const isRows = impressionShareDaily?.length ? impressionShareDaily : rows;
    if (isRows.length) {
        const n = isRows.length;
        impressionShare =
            isRows.reduce((s, d) => s + (parseFloat(d.impression_share) || 0), 0) / n;
        isLostBudgetPct =
            isRows.reduce((s, d) => s + (parseFloat(d.is_lost_budget) || 0), 0) / n;
        isLostRankPct =
            isRows.reduce((s, d) => s + (parseFloat(d.is_lost_rank) || 0), 0) / n;
    }

    const lastDay = rows[rows.length - 1];
    const zeroSpendLastDay = lastDay ? parseFloat(lastDay.ad_spend) === 0 : false;

    const topThree = (topCampaigns || [])
        .slice()
        .sort((a, b) => (parseFloat(b.conversions_value) || 0) - (parseFloat(a.conversions_value) || 0))
        .slice(0, 3)
        .map((c) => ({
            name: c.campaign_name || c.name || "Unknown",
            roas:
                parseFloat(c.ad_spend) > 0
                    ? roundNum((parseFloat(c.conversions_value) || 0) / parseFloat(c.ad_spend))
                    : null,
            spend: roundNum(parseFloat(c.ad_spend)),
        }));

    return {
        spend,
        roas,
        poas: null,
        conversions,
        conversionValue,
        cpa,
        ctr: roundNum(ctr, 2),
        cpc: roundNum(cpc, 2),
        impressionShare: roundNum(impressionShare != null ? impressionShare * 100 : null, 1),
        isLostBudgetPct: roundNum(isLostBudgetPct != null ? isLostBudgetPct * 100 : null, 1),
        isLostRankPct: roundNum(isLostRankPct != null ? isLostRankPct * 100 : null, 1),
        zeroSpendLastDay,
        topCampaigns: topThree,
    };
}

/**
 * @param {Array<Record<string, unknown>>} metricsByDate
 * @param {Array<Record<string, unknown>>} [topCampaigns]
 */
export function aggregatePsFromFacebook(metricsByDate, topCampaigns = []) {
    const rows = metricsByDate || [];
    const spend = rows.reduce((s, d) => s + (parseFloat(d.ad_spend) || 0), 0);
    const conversions = rows.reduce((s, d) => s + (parseFloat(d.conversions) || 0), 0);
    const conversionValue = rows.reduce((s, d) => s + (parseFloat(d.conversion_value) || 0), 0);
    const clicks = rows.reduce((s, d) => s + (parseFloat(d.clicks) || 0), 0);
    const impressions = rows.reduce((s, d) => s + (parseFloat(d.impressions) || 0), 0);
    const roas = spend > 0 ? conversionValue / spend : null;
    const cpa = conversions > 0 ? spend / conversions : null;
    const linkCtr = impressions > 0 ? (clicks / impressions) * 100 : null;

    let frequency = null;
    const freqRows = rows.filter((d) => d.frequency != null);
    if (freqRows.length) {
        frequency =
            freqRows.reduce((s, d) => s + (parseFloat(d.frequency) || 0), 0) / freqRows.length;
    }

    const lastDay = rows[rows.length - 1];
    const zeroSpendLastDay = lastDay ? parseFloat(lastDay.ad_spend) === 0 : false;

    const topThree = (topCampaigns || [])
        .slice()
        .sort(
            (a, b) =>
                (parseFloat(b.conversion_value ?? b.spend) || 0) -
                (parseFloat(a.conversion_value ?? a.spend) || 0)
        )
        .slice(0, 3)
        .map((c) => {
            const cSpend = parseFloat(c.spend ?? c.ad_spend) || 0;
            const cVal = parseFloat(c.conversion_value) || 0;
            return {
                name: c.campaign_name || c.name || "Unknown",
                roas: cSpend > 0 ? roundNum(cVal / cSpend) : null,
                spend: roundNum(cSpend),
            };
        });

    return {
        spend,
        roas,
        conversions,
        conversionValue,
        cpa,
        frequency: roundNum(frequency, 2),
        linkCtr: roundNum(linkCtr, 2),
        conversionType: "purchase",
        zeroSpendLastDay,
        funnelAvailable: false,
        newVsReturningAvailable: false,
        topCampaigns: topThree,
    };
}

/**
 * @param {{ daily?: { rows?: Array<Record<string, unknown>> }, topKeywords?: { rows?: Array<Record<string, unknown>> } }} seoPayload
 * @param {string} periodEnd
 */
export function aggregateSeoFromGsc(seoPayload, periodEnd) {
    const dailyRows = seoPayload?.daily?.rows || seoPayload?.metrics?.rows || [];
    const clicks = dailyRows.reduce((s, r) => s + (parseFloat(r.clicks) || 0), 0);
    const impressions = dailyRows.reduce((s, r) => s + (parseFloat(r.impressions) || 0), 0);
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : null;

    let weightedPos = 0;
    let posWeight = 0;
    for (const r of dailyRows) {
        const imp = parseFloat(r.impressions) || 0;
        const pos = parseFloat(r.position ?? r.avgPosition) || 0;
        if (imp > 0 && pos > 0) {
            weightedPos += pos * imp;
            posWeight += imp;
        }
    }
    const avgPosition = posWeight > 0 ? weightedPos / posWeight : null;

    const keywordRows = seoPayload?.topKeywords?.rows || [];
    const topNonBrandKeywords = keywordRows
        .slice(0, 5)
        .map((r) => r.keys?.[0] || r.query || "")
        .filter(Boolean);

    const endMs = new Date(`${periodEnd}T00:00:00Z`).getTime();
    const nowMs = Date.now();
    const gscDelayWarning = nowMs - endMs < 3 * 24 * 60 * 60 * 1000;

    return {
        clicks,
        impressions,
        ctr: roundNum(ctr, 2),
        avgPosition: roundNum(avgPosition, 2),
        brandClassified: false,
        brandedSharePct: null,
        nonBrandedSharePct: null,
        seoValueEstimate: null,
        seoValueMethod: null,
        gscDelayWarning,
        topNonBrandKeywords,
    };
}

/**
 * @param {Record<string, number>} current
 * @param {Record<string, number>} previous
 * @param {number} netSalesCurrent
 */
export function aggregateEmFromKlaviyo(current, previous, netSalesCurrent) {
    const attributedRevenue = current.conversion_value ?? 0;
    const shareOfTotalPct =
        netSalesCurrent > 0 ? roundNum((attributedRevenue / netSalesCurrent) * 100, 1) : null;

    return {
        attributedRevenue,
        shareOfTotalPct,
        orders: current.conversions ?? 0,
        openRate: current.open_rate != null ? roundNum(current.open_rate * 100, 1) : null,
        clickRate: current.click_rate != null ? roundNum(current.click_rate * 100, 2) : null,
        recipients: current.recipients ?? 0,
        unsubscribes: current.unsubscribes ?? 0,
        listGrowthAvailable: false,
        empty: (current.recipients ?? 0) === 0,
        _previous: previous,
    };
}

/** @type {Record<string, { serviceKey: string, integrationKey: string, clickupKey: string }>} */
export const WEEKLY_AUDIT_SERVICE_MAP = {
    ppc: { serviceKey: "ppc", integrationKey: "googleAds", clickupKey: "ppc" },
    ps: { serviceKey: "ps", integrationKey: "meta", clickupKey: "ps" },
    seo: { serviceKey: "seo", integrationKey: "googleSearchConsole", clickupKey: "seo" },
    em: { serviceKey: "em", integrationKey: "klaviyo", clickupKey: "email" },
};

/**
 * @param {string} serviceKey
 * @param {boolean} contracted
 * @param {boolean} integrationOn
 * @param {{ ok: boolean, empty?: boolean, error?: string|null }} fetchResult
 * @param {string[]} responsible
 */
export function resolveServiceStatus(serviceKey, contracted, integrationOn, fetchResult, responsible) {
    /** @type {ServiceStatus} */
    let status = "not_contracted";
    let note = null;

    if (!contracted && !integrationOn) {
        status = "not_contracted";
    } else if (contracted && !integrationOn) {
        status = "contracted_not_connected";
        note =
            serviceKey === "em"
                ? "Klaviyo ikke koblet"
                : `${serviceKey.toUpperCase()} integration not connected`;
    } else if (integrationOn && fetchResult.error) {
        status = "access_error";
        note = fetchResult.error;
    } else if (integrationOn && fetchResult.empty) {
        status = "empty";
    } else if (integrationOn && fetchResult.ok) {
        status = "active";
    } else if (contracted) {
        status = "contracted_not_connected";
    }

    return { status, responsible, note };
}

/**
 * @param {Record<string, unknown>} currentBlended
 * @param {Record<string, unknown>} previousBlended
 */
export function buildBlendedSection(currentBlended, previousBlended) {
    const ordersDelta = deltaPct(currentBlended.orders, previousBlended.orders);
    return {
        totalSpend: metricCompare(currentBlended.totalSpend, previousBlended.totalSpend),
        googleSpend: metricCompare(currentBlended.googleSpend, previousBlended.googleSpend),
        metaSpend: metricCompare(currentBlended.metaSpend, previousBlended.metaSpend),
        otherSpend: metricCompare(currentBlended.otherSpend, previousBlended.otherSpend),
        netSales: metricCompare(currentBlended.netSales, previousBlended.netSales),
        orders: metricCompare(currentBlended.orders, previousBlended.orders),
        returns: metricCompare(currentBlended.returns, previousBlended.returns),
        returnsRatePct: {
            current: currentBlended.returnsRatePct,
            previous: previousBlended.returnsRatePct,
        },
        grossProfitNet: metricCompare(
            currentBlended.grossProfitNet,
            previousBlended.grossProfitNet,
            { includeDelta: false }
        ),
        poas: metricCompare(currentBlended.poas, previousBlended.poas),
        blendedRoas: metricCompare(currentBlended.blendedRoas, previousBlended.blendedRoas),
        cpa: metricCompare(currentBlended.cpa, previousBlended.cpa),
        cvrProxyDeltaPct: ordersDelta,
    };
}

/**
 * @param {Record<string, unknown>} current
 * @param {Record<string, unknown>} previous
 * @param {string[]} numericKeys
 */
export function buildChannelSection(current, previous, numericKeys) {
    /** @type {Record<string, unknown>} */
    const section = {};
    for (const key of numericKeys) {
        if (key === "topCampaigns" || key === "conversionType") continue;
        if (key === "zeroSpendLastDay" || key === "funnelAvailable" || key === "newVsReturningAvailable") {
            section[key] = current[key];
            continue;
        }
        if (key === "isLostBudgetPct" || key === "isLostRankPct") {
            section[key] = current[key];
            continue;
        }
        section[key] = metricCompare(current[key], previous[key]);
    }
    if (current.topCampaigns) section.topCampaigns = current.topCampaigns;
    if (current.conversionType) section.conversionType = current.conversionType;
    return section;
}

/**
 * @param {{ current: Record<string, unknown>, previous: Record<string, unknown> }} returnsCompare
 * @param {Array<Record<string, unknown>>} shopifyDaily
 */
export function detectReturnsAlarm(returnsCompare, shopifyDaily) {
    const delta = returnsCompare.deltaPct;
    if (delta != null && delta > 50) return true;
    const dailyReturns = (shopifyDaily || []).map((d) => Math.abs(parseFloat(d.returns) || 0));
    if (dailyReturns.length < 2) return false;
    const avg = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
    const max = Math.max(...dailyReturns);
    return avg > 0 && max > avg * 2.5;
}

/**
 * @param {boolean} ppcZero
 * @param {boolean} psZero
 * @param {boolean} ppcActive
 * @param {boolean} psActive
 */
export function detectZeroSpendAlarm(ppcZero, psZero, ppcActive, psActive) {
    return (ppcActive && ppcZero) || (psActive && psZero);
}
