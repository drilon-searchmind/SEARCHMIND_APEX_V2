import { useEffect, useState } from "react";
import { adSpendChannelsForShopifyMarketsFilterUi } from "@/lib/mergeAdSpendDaily";
import { useDashboardDataOptional } from "@/contexts/DashboardDataContext";
import { fetchMarketsOverviewJson } from "@/lib/dashboard/fetchMergedSources";

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
        storeTotalRow,
        loading,
        error,
        featureDisabled,
        visibleMarketingColumnKeys,
    };
}
