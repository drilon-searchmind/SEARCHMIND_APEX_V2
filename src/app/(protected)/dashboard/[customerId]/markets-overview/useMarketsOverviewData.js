import { useEffect, useState } from "react";
import { adSpendChannelsForShopifyMarketsFilterUi } from "@/lib/mergeAdSpendDaily";
import { useDashboardDataOptional } from "@/contexts/DashboardDataContext";
import { fetchMarketsOverviewJson } from "@/lib/dashboard/fetchMergedSources";
import { formatComparisonPeriodDates, COMPARISON_METHOD } from "@/lib/dateRangeComparison";

async function fetchMarketsOverview(
    customerId,
    startDate,
    endDate,
    querySuffix = "",
    fetchMarketsOverviewCached
) {
    if (fetchMarketsOverviewCached) {
        return fetchMarketsOverviewCached(startDate, endDate, querySuffix);
    }
    return fetchMarketsOverviewJson({
        customerId,
        startDate,
        endDate,
        suffix: querySuffix,
    });
}

/**
 * @param {object|null} customer
 * @param {{ startDate: string, endDate: string }} appliedDateRange
 * @param {string} [querySuffix] — spend + market ad-spend filter query params
 * @param {Record<string, true>} [appliedExcludedPlatforms]
 */
export function useMarketsOverviewData(
    customer,
    appliedDateRange,
    querySuffix = "",
    appliedExcludedPlatforms = {}
) {
    const dashboardData = useDashboardDataOptional();
    const fetchMarketsOverviewCached = dashboardData?.fetchMarketsOverview;
    const isHubMode = dashboardData?.isHubMode === true;

    const [rows, setRows] = useState([]);
    const [storeTotalRow, setStoreTotalRow] = useState(null);
    const [loading, setLoading] = useState(() => !isHubMode);
    const [error, setError] = useState(null);
    const [featureDisabled, setFeatureDisabled] = useState(false);
    const [visibleMarketingColumnKeys, setVisibleMarketingColumnKeys] = useState(null);
    /** Previous period rows (same length, right before the range); loads after the main data. */
    const [rowsPrev, setRowsPrev] = useState([]);
    const [loadingPrev, setLoadingPrev] = useState(false);

    useEffect(() => {
        if (!customer || !appliedDateRange?.startDate || !appliedDateRange?.endDate) {
            return undefined;
        }

        const marketsOn =
            customer.customerType === "Shopify" &&
            customer.CustomerSettings?.shopifyMarketsEnabled === true;

        if (!marketsOn) {
            setFeatureDisabled(true);
            setRows([]);
            setStoreTotalRow(null);
            setLoading(false);
            setVisibleMarketingColumnKeys([]);
            return undefined;
        }

        setFeatureDisabled(false);
        if (!isHubMode) {
            setLoading(true);
        }
        setError(null);
        setVisibleMarketingColumnKeys(null);
        setRowsPrev([]);

        let cancelled = false;

        (async () => {
            try {
                const body = await fetchMarketsOverview(
                    customer._id,
                    appliedDateRange.startDate,
                    appliedDateRange.endDate,
                    querySuffix,
                    fetchMarketsOverviewCached
                );
                if (cancelled) return;

                if (body.featureDisabled) {
                    setFeatureDisabled(true);
                    setRows([]);
                    setStoreTotalRow(null);
                    setVisibleMarketingColumnKeys([]);
                    return;
                }

                setRows(Array.isArray(body.rows) ? body.rows : []);
                setStoreTotalRow(body.storeTotalRow || null);

                const excluded = Object.keys(appliedExcludedPlatforms || {}).filter(
                    (id) => appliedExcludedPlatforms[id] === true
                );

                const cols =
                    Array.isArray(body.visibleMarketingColumnKeys) &&
                    body.visibleMarketingColumnKeys.length > 0
                        ? body.visibleMarketingColumnKeys
                        : adSpendChannelsForShopifyMarketsFilterUi(
                              customer.CustomerSettings
                          )
                              .filter((c) => !excluded.includes(c.id))
                              .map((c) => c.dailyOverviewColumnKey);

                setVisibleMarketingColumnKeys(cols);
                if (!isHubMode) setLoading(false);

                // Previous period for per-market growth; never blocks the main view
                setLoadingPrev(true);
                try {
                    const { startDate: prevStart, endDate: prevEnd } = formatComparisonPeriodDates({
                        comparisonMethod: COMPARISON_METHOD.LAST_PERIOD,
                        startDate: appliedDateRange.startDate,
                        endDate: appliedDateRange.endDate,
                    });
                    const prevBody = await fetchMarketsOverview(
                        customer._id,
                        prevStart,
                        prevEnd,
                        querySuffix,
                        fetchMarketsOverviewCached
                    );
                    if (!cancelled) setRowsPrev(Array.isArray(prevBody?.rows) ? prevBody.rows : []);
                } catch (prevErr) {
                    console.error("Error fetching previous period markets:", prevErr);
                    if (!cancelled) setRowsPrev([]);
                } finally {
                    if (!cancelled) setLoadingPrev(false);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err?.message || "Failed to load markets");
                    setRows([]);
                    setStoreTotalRow(null);
                    setVisibleMarketingColumnKeys(null);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [customer, appliedDateRange, querySuffix, appliedExcludedPlatforms, fetchMarketsOverviewCached, isHubMode]);

    return {
        rows,
        rowsPrev,
        loadingPrev,
        storeTotalRow,
        loading,
        error,
        featureDisabled,
        visibleMarketingColumnKeys,
    };
}
