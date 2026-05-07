/**
 * Apex Radar Performance Investigator — Google Ads (campaign / geo daily metrics aggregated to PI shapes).
 */

import { fetchGoogleAdsMetrics } from "@/lib/googleAdsApi";
import {
    buildPiFunnelFromAggregates,
    buildPiMonthRowsForYear,
    priorPeriodRange,
} from "@/lib/apexRadarPerformanceInvestigatorFacebook";

function mapGoogleSumsToPiMetrics(impr, clicks, cost, conv, convValue) {
    const ctr = impr > 0 ? clicks / impr : null;
    const freq = null;
    const avgCpc = clicks > 0 ? cost / clicks : null;
    const convRate = clicks > 0 ? conv / clicks : null;
    const aov = conv > 0 ? convValue / conv : null;
    const roas = cost > 0 ? convValue / cost : null;
    const cpa = conv > 0 ? cost / conv : null;
    return {
        impr: impr || 0,
        clicks: clicks || 0,
        ctr,
        freq,
        avgCpc,
        cost: cost || 0,
        conv: conv || 0,
        convValue: convValue || 0,
        convRate,
        aov,
        roas,
        cpa,
    };
}

function aggregateGoogleRowsForRange(metrics) {
    let impr = 0;
    let clicks = 0;
    let cost = 0;
    let conv = 0;
    let convVal = 0;
    for (const row of metrics || []) {
        const m = row.metrics || {};
        const costMicros = Number(m.cost_micros ?? 0);
        cost += Number.isFinite(costMicros) ? costMicros / 1_000_000 : 0;
        impr += Number(m.impressions ?? 0) || 0;
        clicks += Number(m.clicks ?? 0) || 0;
        conv += Number(m.conversions ?? 0) || 0;
        convVal += Number(m.conversions_value ?? 0) || 0;
    }
    return mapGoogleSumsToPiMetrics(impr, clicks, cost, conv, convVal);
}

/**
 * @returns {Map<string, object>} key `YYYY-MM` → PI metric fields
 */
export async function fetchGooglePiMonthlyByMonthKey({
    googleAdsCustomerId,
    since,
    until,
    countryFilter,
    countryExclude,
}) {
    const { metrics } = await fetchGoogleAdsMetrics(
        googleAdsCustomerId,
        since,
        until,
        countryFilter,
        countryExclude
    );
    const byMonth = new Map();
    const byMonthBuckets = new Map();
    for (const row of metrics || []) {
        const dateRaw = row.segments?.date;
        if (!dateRaw) continue;
        const key = String(dateRaw).slice(0, 7);
        if (key.length < 7) continue;
        if (!byMonthBuckets.has(key)) {
            byMonthBuckets.set(key, { impr: 0, clicks: 0, cost: 0, conv: 0, convVal: 0 });
        }
        const b = byMonthBuckets.get(key);
        const m = row.metrics || {};
        const costMicros = Number(m.cost_micros ?? 0);
        b.cost += Number.isFinite(costMicros) ? costMicros / 1_000_000 : 0;
        b.impr += Number(m.impressions ?? 0) || 0;
        b.clicks += Number(m.clicks ?? 0) || 0;
        b.conv += Number(m.conversions ?? 0) || 0;
        b.convVal += Number(m.conversions_value ?? 0) || 0;
    }
    for (const [key, b] of byMonthBuckets.entries()) {
        byMonth.set(key, mapGoogleSumsToPiMetrics(b.impr, b.clicks, b.cost, b.conv, b.convVal));
    }
    return byMonth;
}

export async function fetchGooglePiRangeAggregate({
    googleAdsCustomerId,
    since,
    until,
    countryFilter,
    countryExclude,
}) {
    const { metrics } = await fetchGoogleAdsMetrics(
        googleAdsCustomerId,
        since,
        until,
        countryFilter,
        countryExclude
    );
    if (!metrics?.length) return null;
    return aggregateGoogleRowsForRange(metrics);
}

export { buildPiFunnelFromAggregates, buildPiMonthRowsForYear, priorPeriodRange };
