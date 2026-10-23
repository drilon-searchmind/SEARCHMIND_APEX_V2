"use client";

import { useEffect, useState } from "react";
import { formatComparisonPeriodDates } from "@/lib/dateRangeComparison";
import { mapCreativeAdRow } from "@/lib/facebookPsDashboardUtils";

const EMPTY = {
    metrics: [],
    metricsPrev: [],
    campaigns: [],
    campaignsPrev: [],
    placements: [],
    placementsPrev: [],
    accountSummary: {},
    ads: [],
};

/**
 * Loads the Meta paid social payload for the applied range, the comparison range when one is on,
 * and the ad-level rows (which fail separately so the rest of the page still renders).
 */
export function usePsDashboardData({ customer, appliedRange, appliedCompareRange, comparisonMethod }) {
    const [data, setData] = useState(EMPTY);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [adError, setAdError] = useState(null);
    const customerId = customer?._id;

    useEffect(() => {
        if (!customerId) return undefined;
        let cancelled = false;
        setLoading(true);
        setError(null);
        setAdError(null);

        const buildParams = (settings, range) => {
            const { facebookAdAccountId, customerMetaID, customerMetaIDExclude } = settings;
            const adAccountId = facebookAdAccountId.startsWith("act_") ? facebookAdAccountId : `act_${facebookAdAccountId}`;
            const p = new URLSearchParams({
                adAccountId,
                since: range.startDate,
                until: range.endDate,
                dashboardCustomerId: String(customerId),
            });
            if (customerMetaID) p.set("customerMetaID", customerMetaID);
            if (customerMetaIDExclude) p.set("customerMetaIDExclude", customerMetaIDExclude);
            return p.toString();
        };

        (async () => {
            try {
                const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
                const res = await fetch(`${baseUrl}/api/customers/${customerId}`);
                if (!res.ok) throw new Error("Failed to fetch customer settings");
                const settings = (await res.json()).CustomerSettings || {};
                if (!settings.facebookAdAccountId) throw new Error("Missing Facebook Ad Account ID");

                const compDates = formatComparisonPeriodDates({
                    comparisonMethod,
                    startDate: appliedRange.startDate,
                    endDate: appliedRange.endDate,
                    compareStartDate: appliedCompareRange.startDate,
                    compareEndDate: appliedCompareRange.endDate,
                });

                const insightsFetches = [fetch(`/api/facebook-campaign-insights?${buildParams(settings, appliedRange)}`)];
                if (!compDates.skip && compDates.startDate && compDates.endDate) {
                    insightsFetches.push(
                        fetch(`/api/facebook-campaign-insights?${buildParams(settings, { startDate: compDates.startDate, endDate: compDates.endDate })}`)
                    );
                }
                const adsFetch = fetch(`/api/facebook-ads-ad-performance?${buildParams(settings, appliedRange)}`);

                const [[curRes, prevRes], adsRes] = await Promise.all([Promise.all(insightsFetches), adsFetch]);
                if (!curRes.ok) throw new Error("Failed to fetch Facebook PS dashboard metrics");
                const cur = await curRes.json();
                const prev = prevRes?.ok ? await prevRes.json() : null;

                let ads = [];
                let adsMessage = null;
                try {
                    const adsJson = await adsRes.json();
                    if (!adsRes.ok) throw new Error(adsJson.error || "Failed to load ads performance");
                    ads = (Array.isArray(adsJson.ads) ? adsJson.ads : []).map(mapCreativeAdRow);
                } catch (e) {
                    adsMessage = e.message || "Failed to load ads performance";
                }

                if (cancelled) return;
                setAdError(adsMessage);
                setData({
                    metrics: cur.metrics_by_date || [],
                    metricsPrev: prev?.metrics_by_date || [],
                    campaigns: cur.campaigns_performance || [],
                    campaignsPrev: prev?.campaigns_performance || [],
                    placements: cur.placements || [],
                    placementsPrev: prev?.placements || [],
                    accountSummary: cur.account_summary || {},
                    ads,
                });
            } catch (err) {
                if (!cancelled) {
                    setError(err.message);
                    setData(EMPTY);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [customerId, appliedRange, appliedCompareRange, comparisonMethod]);

    return { ...data, loading, error, adError };
}
