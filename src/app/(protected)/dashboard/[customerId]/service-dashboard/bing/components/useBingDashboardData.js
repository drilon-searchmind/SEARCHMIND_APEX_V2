"use client";

import { useEffect, useState } from "react";
import { formatComparisonPeriodDates } from "@/lib/dateRangeComparison";
import { buildBrandGenericSpendByDate } from "@/lib/googlePpcDashboardUtils";

const EMPTY = {
    metrics: [],
    metricsPrev: [],
    campaigns: [],
    campaignsPrev: [],
    searchTerms: [],
    brandGeneric: [],
    accountSummary: {},
    deviceSplit: [],
    networkSplit: [],
    impressionShare: null,
    warnings: [],
};

/** Daily row in the shape the shared paid search components read (they were built for Google Ads). */
function mapDaily(row) {
    const clicks = Number(row.clicks) || 0;
    const impressions = Number(row.impressions) || 0;
    const conversions = Number(row.conversions) || 0;
    const value = Number(row.conversion_value) || 0;
    const spend = Number(row.ad_spend) || 0;
    return {
        date: row.date,
        clicks,
        impressions,
        conversions,
        conversions_value: value,
        ad_spend: spend,
        roas: spend > 0 ? value / spend : 0,
        ctr: impressions > 0 ? clicks / impressions : 0,
        cpc: clicks > 0 ? spend / clicks : 0,
        conv_rate: clicks > 0 ? conversions / clicks : 0,
        cpa: conversions > 0 ? spend / conversions : 0,
    };
}

function mapCampaign(c) {
    const spend = Number(c.ad_spend) || 0;
    const conversions = Number(c.conversions) || 0;
    const clicks = Number(c.clicks) || 0;
    const value = Number(c.conversion_value) || 0;
    return {
        campaign_name: c.campaign_name,
        ad_spend: spend,
        clicks,
        impressions: Number(c.impressions) || 0,
        conversions,
        conversions_value: value,
        roas: spend > 0 ? value / spend : 0,
        ctr: Number(c.ctr) || 0,
        cpc: clicks > 0 ? spend / clicks : 0,
        cpa: conversions > 0 ? spend / conversions : 0,
        conv_rate: clicks > 0 ? conversions / clicks : 0,
        impression_share: null,
    };
}

function friendlyError(message) {
    const m = String(message || "");
    if (/Missing bingAdsAccountId|Missing bingAdsCustomerId/i.test(m)) return { notConnected: true, message: null };
    if (/must be a numeric ID/i.test(m)) {
        return {
            notConnected: false,
            message:
                "The Microsoft Advertising IDs in Property Settings look wrong. Use the numeric Account ID and Customer ID from Microsoft Advertising, not the account number (for example F118BTG2).",
        };
    }
    return { notConnected: false, message: m };
}

/**
 * Loads the Microsoft Ads payload for the applied range and the comparison range, and maps it to
 * the shape the shared paid search components use.
 */
export function useBingDashboardData({ customer, appliedRange, appliedCompareRange, comparisonMethod }) {
    const [data, setData] = useState(EMPTY);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notConnected, setNotConnected] = useState(false);
    const customerId = customer?._id;

    useEffect(() => {
        if (!customerId) return undefined;
        let cancelled = false;
        setLoading(true);
        setError(null);
        setNotConnected(false);

        const compDates = formatComparisonPeriodDates({
            comparisonMethod,
            startDate: appliedRange.startDate,
            endDate: appliedRange.endDate,
            compareStartDate: appliedCompareRange.startDate,
            compareEndDate: appliedCompareRange.endDate,
        });
        const url = (s, e) =>
            `/api/bing-dashboard?startDate=${encodeURIComponent(s)}&endDate=${encodeURIComponent(e)}&dashboardCustomerId=${encodeURIComponent(String(customerId))}`;

        (async () => {
            try {
                const fetches = [fetch(url(appliedRange.startDate, appliedRange.endDate))];
                if (!compDates.skip && compDates.startDate && compDates.endDate) {
                    fetches.push(fetch(url(compDates.startDate, compDates.endDate)));
                }
                const [curRes, prevRes] = await Promise.all(fetches);
                if (!curRes.ok) {
                    const errJson = await curRes.json().catch(() => ({}));
                    throw new Error(errJson.error || "Failed to fetch Microsoft Ads dashboard metrics");
                }
                const cur = await curRes.json();
                const prev = prevRes?.ok ? await prevRes.json() : null;
                if (cancelled) return;
                setData({
                    metrics: (cur.metrics_by_date || []).map(mapDaily),
                    metricsPrev: (prev?.metrics_by_date || []).map(mapDaily),
                    campaigns: (cur.top_campaigns || []).map(mapCampaign),
                    campaignsPrev: (prev?.top_campaigns || []).map(mapCampaign),
                    searchTerms: cur.search_terms || [],
                    brandGeneric: buildBrandGenericSpendByDate(cur.campaigns_by_date || []),
                    accountSummary: {},
                    deviceSplit: cur.device_split || [],
                    networkSplit: cur.network_split || [],
                    impressionShare: cur.impression_share || null,
                    warnings: cur.warnings || [],
                });
            } catch (err) {
                if (cancelled) return;
                const f = friendlyError(err.message);
                setNotConnected(f.notConnected);
                setError(f.message);
                setData(EMPTY);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [customerId, appliedRange, appliedCompareRange, comparisonMethod]);

    return { ...data, loading, error, notConnected };
}
