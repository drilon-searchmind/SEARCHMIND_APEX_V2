import { useEffect, useState } from "react";
import { formatComparisonPeriodDates, COMPARISON_METHOD } from "@/lib/dateRangeComparison";

/** Session cache so switching between the SEO tabs does not refetch the same insights. */
const cache = new Map();

/**
 * Loads /api/seo-dashboard/insights for the applied range (shared by Opportunities and
 * Keywords and pages). Returns { data, loading, error }.
 */
export function useSeoInsightsData({
    siteUrl,
    customerId,
    startDate,
    endDate,
    appliedCompareRange,
    comparisonMethod,
    keywordSettingsVersion = 0,
}) {
    const [state, setState] = useState({ data: null, loading: false, error: null, key: null });

    const compDates = formatComparisonPeriodDates({
        comparisonMethod,
        startDate,
        endDate,
        compareStartDate: appliedCompareRange?.startDate,
        compareEndDate: appliedCompareRange?.endDate,
    });
    const useCompare = !compDates.skip && comparisonMethod !== COMPARISON_METHOD.NONE;
    const compareStartDate = useCompare ? compDates.startDate : undefined;
    const compareEndDate = useCompare ? compDates.endDate : undefined;
    const key = JSON.stringify([siteUrl, customerId, startDate, endDate, compareStartDate, compareEndDate, keywordSettingsVersion]);

    useEffect(() => {
        if (!siteUrl || !startDate || !endDate) return undefined;
        if (cache.has(key)) {
            // Cached result: resolve on the next tick rather than inside the effect body
            const hit = cache.get(key);
            const t = setTimeout(() => setState({ data: hit, loading: false, error: null, key }), 0);
            return () => clearTimeout(t);
        }
        let cancelled = false;
        const t = setTimeout(() => setState((s) => ({ ...s, loading: true, error: null, key })), 0);
        (async () => {
            try {
                const res = await fetch("/api/seo-dashboard/insights", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ siteUrl, startDate, endDate, customerId, compareStartDate, compareEndDate }),
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json.error || "Failed to load organic insights");
                cache.set(key, json);
                if (!cancelled) setState({ data: json, loading: false, error: null, key });
            } catch (e) {
                if (!cancelled) setState({ data: null, loading: false, error: e.message, key });
            }
        })();
        return () => {
            cancelled = true;
            clearTimeout(t);
        };
    }, [key, siteUrl, startDate, endDate, customerId, compareStartDate, compareEndDate]);

    // Ignore a result that belongs to an earlier range while a new one is loading
    const current = state.key === key;
    return {
        data: current ? state.data : null,
        loading: !current || state.loading,
        error: current ? state.error : null,
    };
}
