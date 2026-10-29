"use client";

import { useEffect, useState } from "react";
import { formatComparisonPeriodDates } from "@/lib/dateRangeComparison";

const EMPTY = {
    metrics: [],
    metricsPrev: [],
    campaigns: [],
    campaignsPrev: [],
    ads: [],
    reach: null,
    demographics: null,
    warnings: [],
};

/**
 * Loads the LinkedIn payload for the applied range and the comparison range. The comparison range
 * only needs the account series and campaigns, so it is not asked for demographics.
 */
export function useLiDashboardData({ customer, appliedRange, appliedCompareRange, comparisonMethod }) {
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
                const adAccountId = settings.linkedinAdAccountId?.trim();
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
                const url = (s, e, extras = true) =>
                    `/api/linkedin-dashboard?adAccountId=${encodeURIComponent(adAccountId)}&startDate=${encodeURIComponent(s)}&endDate=${encodeURIComponent(e)}&dashboardCustomerId=${encodeURIComponent(String(customerId))}${extras ? "" : "&extras=0"}`;

                const fetches = [fetch(url(appliedRange.startDate, appliedRange.endDate))];
                if (!compDates.skip && compDates.startDate && compDates.endDate) {
                    fetches.push(fetch(url(compDates.startDate, compDates.endDate, false)));
                }
                const [curRes, prevRes] = await Promise.all(fetches);
                if (!curRes.ok) {
                    const errJson = await curRes.json().catch(() => ({}));
                    throw new Error(errJson.error || "Failed to fetch LinkedIn dashboard metrics");
                }
                const cur = await curRes.json();
                const prev = prevRes?.ok ? await prevRes.json() : null;
                if (cancelled) return;
                setData({
                    metrics: cur.metrics_by_date || [],
                    metricsPrev: prev?.metrics_by_date || [],
                    campaigns: cur.top_campaigns || [],
                    campaignsPrev: prev?.top_campaigns || [],
                    ads: cur.top_ads || [],
                    reach: cur.reach || null,
                    demographics: cur.demographics || null,
                    warnings: cur.warnings || [],
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
