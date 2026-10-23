"use client";

import { useEffect, useState } from "react";
import { formatComparisonPeriodDates } from "@/lib/dateRangeComparison";

const EMPTY = {
    campaignTotals: null,
    campaignTotalsPrev: null,
    topCampaigns: [],
    flowTotals: null,
    topFlows: [],
    flowDaily: [],
    flowDailyPrev: [],
    upcoming: [],
};

/**
 * Loads the email dashboard in stages so the page is useful early.
 *   1. campaigns + flow totals, in parallel (the numbers on top)
 *   2. daily flow series (trend chart)
 *   3. the comparison period (change chips)
 * Klaviyo allows about two reports a minute; the API route retries on 429 and the later stages
 * simply wait for their turn instead of the page sleeping a fixed minute between calls.
 */
export function useEmDashboardData({ customerId, enabled, appliedRange, appliedCompareRange, comparisonMethod }) {
    const [data, setData] = useState(EMPTY);
    const [loading, setLoading] = useState(true);
    const [flowsLoading, setFlowsLoading] = useState(false);
    const [dailyLoading, setDailyLoading] = useState(false);
    const [prevLoading, setPrevLoading] = useState(false);
    const [error, setError] = useState(null);
    const [flowsError, setFlowsError] = useState(null);

    useEffect(() => {
        if (!customerId || !enabled) {
            setLoading(false);
            return undefined;
        }
        const controller = new AbortController();
        const { signal } = controller;

        const compDates = formatComparisonPeriodDates({
            comparisonMethod,
            startDate: appliedRange.startDate,
            endDate: appliedRange.endDate,
            compareStartDate: appliedCompareRange.startDate,
            compareEndDate: appliedCompareRange.endDate,
        });
        const hasPrev = !compDates.skip && compDates.startDate && compDates.endDate;

        const get = async (part, range) => {
            const qs = new URLSearchParams({ part, startDate: range.startDate, endDate: range.endDate });
            const res = await fetch(`/api/klaviyo-dashboard/${customerId}?${qs}`, { signal });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Klaviyo API error");
            return res.json();
        };
        const patch = (next) => setData((cur) => ({ ...cur, ...next }));

        setLoading(true);
        setFlowsLoading(true);
        setDailyLoading(false);
        setPrevLoading(false);
        setError(null);
        setFlowsError(null);
        setData(EMPTY);

        // Upcoming sends are optional and cheap (not a report), so they never block anything
        fetch(`/api/klaviyo-scheduled-campaigns/${customerId}?daysAhead=30&includeDrafts=false`, { signal })
            .then((r) => (r.ok ? r.json() : null))
            .then((j) => j && patch({ upcoming: j.campaigns || [] }))
            .catch(() => {});

        (async () => {
            try {
                const [summary, flows] = await Promise.all([
                    get("summary", appliedRange),
                    get("flows", appliedRange).catch((e) => {
                        if (e.name !== "AbortError") setFlowsError(e.message);
                        return null;
                    }),
                ]);
                if (signal.aborted) return;
                patch({
                    campaignTotals: summary.metrics_by_date?.[0] || null,
                    topCampaigns: summary.top_campaigns || [],
                    flowTotals: flows?.flow_totals || null,
                    topFlows: flows?.top_flows || [],
                });
                setLoading(false);
                setFlowsLoading(false);

                setDailyLoading(true);
                try {
                    const daily = await get("daily", appliedRange);
                    if (signal.aborted) return;
                    patch({ flowDaily: daily.flow_daily || [] });
                    // Without a flow report the daily series still gives the flow totals
                    if (!flows && daily.flow_totals) patch({ flowTotals: daily.flow_totals });
                } catch (e) {
                    if (e.name === "AbortError") return;
                } finally {
                    if (!signal.aborted) setDailyLoading(false);
                }

                if (hasPrev) {
                    setPrevLoading(true);
                    const prevRange = { startDate: compDates.startDate, endDate: compDates.endDate };
                    try {
                        const prevSummary = await get("summary", prevRange);
                        if (signal.aborted) return;
                        patch({ campaignTotalsPrev: prevSummary.metrics_by_date?.[0] || null });
                        const prevDaily = await get("daily", prevRange);
                        if (signal.aborted) return;
                        patch({ flowDailyPrev: prevDaily.flow_daily || [] });
                    } catch (e) {
                        if (e.name === "AbortError") return;
                    } finally {
                        if (!signal.aborted) setPrevLoading(false);
                    }
                }
            } catch (e) {
                if (e.name === "AbortError") return;
                setError(e.message);
                setLoading(false);
                setFlowsLoading(false);
            }
        })();

        return () => controller.abort();
    }, [customerId, enabled, appliedRange, appliedCompareRange, comparisonMethod]);

    return { ...data, loading, flowsLoading, dailyLoading, prevLoading, error, flowsError };
}
