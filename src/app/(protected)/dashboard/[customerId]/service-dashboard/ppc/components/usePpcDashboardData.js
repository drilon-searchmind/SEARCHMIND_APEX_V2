"use client";

import { useEffect, useState } from "react";
import { formatComparisonPeriodDates } from "@/lib/dateRangeComparison";

const EMPTY = {
    metrics: [],
    metricsPrev: [],
    campaigns: [],
    campaignsPrev: [],
    searchTerms: [],
    brandGeneric: [],
    accountSummary: {},
};

/**
 * Loads the Google Ads PPC payload for the applied range and, when a comparison is on,
 * the same payload for the comparison range.
 */
export function usePpcDashboardData({ customer, appliedRange, appliedCompareRange, comparisonMethod }) {
    const [data, setData] = useState(EMPTY);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const customerId = customer?._id;

    useEffect(() => {
        if (!customerId) return undefined;
        let cancelled = false;
        setLoading(true);
        setError(null);

        const buildUrl = (settings, range) => {
            const { googleAdsCustomerId, googleAdsCountryFilter, googleAdsCountryExclude } = settings;
            const countryParams = [
                googleAdsCountryFilter ? `countryFilter=${encodeURIComponent(googleAdsCountryFilter)}` : "",
                googleAdsCountryExclude ? `countryExclude=${encodeURIComponent(googleAdsCountryExclude)}` : "",
            ]
                .filter(Boolean)
                .join("&");
            const countryParam = countryParams ? `&${countryParams}` : "";
            const dash = `&dashboardCustomerId=${encodeURIComponent(String(customerId))}`;
            return `/api/google-ppc-dashboard?customerId=${encodeURIComponent(googleAdsCustomerId)}&startDate=${encodeURIComponent(range.startDate)}&endDate=${encodeURIComponent(range.endDate)}${countryParam}${dash}`;
        };

        (async () => {
            try {
                const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
                const res = await fetch(`${baseUrl}/api/customers/${customerId}`);
                if (!res.ok) throw new Error("Failed to fetch customer settings");
                const settings = (await res.json()).CustomerSettings || {};
                if (!settings.googleAdsCustomerId) throw new Error("Missing Google Ads customer ID");

                const compDates = formatComparisonPeriodDates({
                    comparisonMethod,
                    startDate: appliedRange.startDate,
                    endDate: appliedRange.endDate,
                    compareStartDate: appliedCompareRange.startDate,
                    compareEndDate: appliedCompareRange.endDate,
                });

                const fetches = [fetch(buildUrl(settings, appliedRange))];
                if (!compDates.skip && compDates.startDate && compDates.endDate) {
                    fetches.push(fetch(buildUrl(settings, { startDate: compDates.startDate, endDate: compDates.endDate })));
                }
                const [curRes, prevRes] = await Promise.all(fetches);
                if (!curRes.ok) throw new Error("Failed to fetch Google Ads PPC dashboard metrics");
                const cur = await curRes.json();
                const prev = prevRes?.ok ? await prevRes.json() : null;
                if (cancelled) return;
                setData({
                    metrics: cur.metrics_by_date || [],
                    metricsPrev: prev?.metrics_by_date || [],
                    campaigns: cur.campaigns_performance || [],
                    campaignsPrev: prev?.campaigns_performance || [],
                    searchTerms: cur.search_terms || [],
                    brandGeneric: cur.brand_generic_spend_by_date || [],
                    accountSummary: cur.account_summary || {},
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

    return { ...data, loading, error };
}
