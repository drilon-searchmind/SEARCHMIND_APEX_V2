"use client";

import { useEffect, useState } from "react";
import { formatComparisonPeriodDates } from "@/lib/dateRangeComparison";
import { isDemoCustomerId } from "@/lib/demoCustomer";
import { normalizeRedditSettings } from "@/lib/redditCustomerSettings";

const EMPTY = {
    metrics: [],
    metricsPrev: [],
    campaigns: [],
    campaignsPrev: [],
    adGroups: [],
    ads: [],
    account: null,
    audience: null,
    warnings: [],
};

/**
 * Loads the Reddit payload for the applied range and the comparison range. The comparison range only
 * needs the account series and campaign totals, so it does not ask for the extra breakdowns.
 * `notConnected` is true when the property has no ad account or no Reddit Ads authorization.
 */
export function useRedditDashboardData({ customer, appliedRange, appliedCompareRange, comparisonMethod }) {
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
                if (!isDemoCustomerId(String(customerId))) {
                    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
                    const res = await fetch(`${baseUrl}/api/customers/${customerId}`);
                    if (!res.ok) throw new Error("Failed to fetch customer settings");
                    const red = normalizeRedditSettings((await res.json()).CustomerSettings || {});
                    const hasAuth =
                        !!red.accessToken?.trim() || (!!red.appId?.trim() && !!red.appSecret?.trim() && !!red.refreshToken?.trim()) || (!!red.appId?.trim() && !!red.appSecret?.trim());
                    if (!red.accountId?.trim() || !hasAuth) {
                        if (!cancelled) {
                            setNotConnected(true);
                            setData(EMPTY);
                        }
                        return;
                    }
                }

                const compDates = formatComparisonPeriodDates({
                    comparisonMethod,
                    startDate: appliedRange.startDate,
                    endDate: appliedRange.endDate,
                    compareStartDate: appliedCompareRange.startDate,
                    compareEndDate: appliedCompareRange.endDate,
                });
                const url = (s, e, extras = true) =>
                    `/api/reddit-dashboard?startDate=${encodeURIComponent(s)}&endDate=${encodeURIComponent(e)}&dashboardCustomerId=${encodeURIComponent(String(customerId))}${extras ? "" : "&extras=0"}`;

                const fetches = [fetch(url(appliedRange.startDate, appliedRange.endDate))];
                if (!compDates.skip && compDates.startDate && compDates.endDate) {
                    fetches.push(fetch(url(compDates.startDate, compDates.endDate, false)));
                }
                const [curRes, prevRes] = await Promise.all(fetches);
                if (!curRes.ok) {
                    const errJson = await curRes.json().catch(() => ({}));
                    throw new Error(errJson.error || "Failed to fetch Reddit Ads dashboard metrics");
                }
                const cur = await curRes.json();
                const prev = prevRes?.ok ? await prevRes.json() : null;
                if (cancelled) return;
                setData({
                    metrics: cur.metrics_by_date || [],
                    metricsPrev: prev?.metrics_by_date || [],
                    campaigns: cur.top_campaigns || [],
                    campaignsPrev: prev?.top_campaigns || [],
                    adGroups: cur.ad_groups || [],
                    ads: cur.ads || [],
                    account: cur.account || null,
                    audience: cur.audience || null,
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
