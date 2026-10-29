"use client";

import { useEffect, useState } from "react";
import { formatComparisonPeriodDates } from "@/lib/dateRangeComparison";

const EMPTY = {
    metrics: [],
    metricsPrev: [],
    campaigns: [],
    campaignsPrev: [],
    window: null,
    windowPrev: null,
};

/**
 * Loads the Pinterest payload for the applied range and, when a comparison is on, for the
 * comparison range. `notConnected` is true when the property has no Pinterest ad account.
 */
export function usePinDashboardData({ customer, appliedRange, appliedCompareRange, comparisonMethod }) {
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

        (async () => {
            try {
                const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
                const res = await fetch(`${baseUrl}/api/customers/${customerId}`);
                if (!res.ok) throw new Error("Failed to fetch customer settings");
                const settings = (await res.json()).CustomerSettings || {};
                const adAccountId = settings.pinterestAdAccountId?.trim();
                if (!adAccountId) {
                    if (!cancelled) {
                        setNotConnected(true);
                        setData(EMPTY);
                    }
                    return;
                }

                const compDates = formatComparisonPeriodDates({
                    comparisonMethod,
                    startDate: appliedRange.startDate,
                    endDate: appliedRange.endDate,
                    compareStartDate: appliedCompareRange.startDate,
                    compareEndDate: appliedCompareRange.endDate,
                });
                const url = (s, e) =>
                    `/api/pinterest-dashboard?adAccountId=${encodeURIComponent(adAccountId)}&startDate=${encodeURIComponent(s)}&endDate=${encodeURIComponent(e)}&dashboardCustomerId=${encodeURIComponent(String(customerId))}`;

                const fetches = [fetch(url(appliedRange.startDate, appliedRange.endDate))];
                if (!compDates.skip && compDates.startDate && compDates.endDate) {
                    fetches.push(fetch(url(compDates.startDate, compDates.endDate)));
                }
                const [curRes, prevRes] = await Promise.all(fetches);
                if (!curRes.ok) {
                    const errJson = await curRes.json().catch(() => ({}));
                    throw new Error(errJson.error || "Failed to fetch Pinterest dashboard metrics");
                }
                const cur = await curRes.json();
                const prev = prevRes?.ok ? await prevRes.json() : null;
                if (cancelled) return;
                setData({
                    metrics: cur.metrics_by_date || [],
                    metricsPrev: prev?.metrics_by_date || [],
                    campaigns: cur.top_campaigns || [],
                    campaignsPrev: prev?.top_campaigns || [],
                    window: cur.analytics_window || null,
                    windowPrev: prev?.analytics_window || null,
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

    return { ...data, loading, error, notConnected };
}
