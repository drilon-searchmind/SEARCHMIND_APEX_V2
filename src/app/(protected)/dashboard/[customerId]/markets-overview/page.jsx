'use client';

import DashboardHeading from '@/components/dashboard/DashboardHeading';
import { useCustomers } from '@/hooks/useCustomers';
import { useParams, useRouter } from 'next/navigation';
import DateRangePicker from '@/components/dashboard/DateRangePicker';
import { useCallback, useEffect, useMemo, useState } from 'react';
import GraphCard from '@/components/dashboard/GraphCard';
import MetricToggleBar from '../daily-overview/MetricToggleBar';
import {
    MARKETS_DEFAULT_VISIBLE_METRICS,
    MARKETS_METRIC_COLUMNS,
} from './marketsMetricConfig';
import { AD_SPEND_DAILY_COLUMN_KEYS } from '@/lib/mergeAdSpendDaily';
import { pushDashboardDateRangeApplied } from '@root/lib/gtmFunctions';
import { useAdSpendPlatformsFilter } from '@/hooks/useAdSpendPlatformsFilter';
import { useMarketsOverviewData } from './useMarketsOverviewData';
import MarketsMetricsTable from './MarketsMetricsTable';
import { aggregateIncludedMarketRows } from './marketsTotalsUtils';
import { isShopifyMarketsCustomer } from '@/lib/customerPlatformDisplay';

const MarketsOverviewPage = () => {
    const params = useParams();
    const router = useRouter();
    const { customers } = useCustomers();
    const customer = customers.find((c) => c._id === params.customerId);
    const marketsEnabled = isShopifyMarketsCustomer(customer);

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const isFirstOfMonth = today.getDate() === 1;
    const defaultStart = `${yyyy}-${mm}-01`;
    const defaultEnd = isFirstOfMonth
        ? `${yyyy}-${mm}-01`
        : `${yyyy}-${mm}-${String(today.getDate() - 1).padStart(2, '0')}`;

    const [tempDateRange, setTempDateRange] = useState({
        startDate: defaultStart,
        endDate: defaultEnd,
    });
    const [appliedDateRange, setAppliedDateRange] = useState({
        startDate: defaultStart,
        endDate: defaultEnd,
    });
    const [hiddenMarkets, setHiddenMarkets] = useState({});
    const [chartMetricKey, setChartMetricKey] = useState('netRevenue');

    useEffect(() => {
        if (!customer) return;
        if (!marketsEnabled) {
            router.replace(`/dashboard/${params.customerId}/performance-dashboard`);
        }
    }, [customer, marketsEnabled, params.customerId, router]);

    useEffect(() => {
        setHiddenMarkets({});
    }, [customer?._id, appliedDateRange.startDate, appliedDateRange.endDate]);

    const handleDateRangeApply = ({ startDate, endDate }) => {
        pushDashboardDateRangeApplied({
            page: 'markets_overview',
            customerId: params.customerId,
            startDate,
            endDate,
        });
        setAppliedDateRange({ startDate, endDate });
    };

    const [filterAdSpendByMarket, setFilterAdSpendByMarket] = useState(true);

    const {
        adSpendFilterUiChannels,
        draftExcludedPlatforms,
        appliedExcludedPlatforms,
        toggleAdSpendPlatformDraft,
        applyAdSpendPlatformFilters,
        syncDraftFromAppliedSpend,
        spendQuerySuffix,
    } = useAdSpendPlatformsFilter(customer, marketsEnabled);

    const marketsQuerySuffix = useMemo(() => {
        const adPart = filterAdSpendByMarket
            ? '&shopifyMarketFilterAdSpend=1'
            : '&shopifyMarketFilterAdSpend=0';
        return `${spendQuerySuffix}${adPart}`;
    }, [spendQuerySuffix, filterAdSpendByMarket]);

    const { rows, storeTotalRow, loading, error, featureDisabled, visibleMarketingColumnKeys } =
        useMarketsOverviewData(
            customer,
            appliedDateRange,
            marketsQuerySuffix,
            appliedExcludedPlatforms
        );

    const toggleMarketRow = useCallback((marketId, included) => {
        setHiddenMarkets((prev) => {
            const next = { ...prev };
            if (included) delete next[marketId];
            else next[marketId] = true;
            return next;
        });
    }, []);

    const [userColumnVisibility, setUserColumnVisibility] = useState({});

    const metricColumns = useMemo(() => {
        const adKeySet = new Set(AD_SPEND_DAILY_COLUMN_KEYS);
        if (visibleMarketingColumnKeys == null) return MARKETS_METRIC_COLUMNS;
        const allow = new Set(visibleMarketingColumnKeys);
        return MARKETS_METRIC_COLUMNS.filter(
            (col) => !adKeySet.has(col.key) || allow.has(col.key)
        );
    }, [visibleMarketingColumnKeys]);

    const visibleMetrics = useMemo(() => {
        const out = {};
        for (const m of metricColumns) {
            out[m.key] =
                userColumnVisibility[m.key] !== undefined
                    ? userColumnVisibility[m.key]
                    : MARKETS_DEFAULT_VISIBLE_METRICS[m.key] ?? true;
        }
        return out;
    }, [metricColumns, userColumnVisibility]);

    const handleMetricToggle = (key) => {
        if (!metricColumns.some((m) => m.key === key)) return;
        setUserColumnVisibility((prev) => {
            const defaults = MARKETS_DEFAULT_VISIBLE_METRICS[key] ?? true;
            const current = prev[key] !== undefined ? prev[key] : defaults;
            const next = { ...prev, [key]: !current };
            const count = metricColumns.filter((m) => {
                const v =
                    next[m.key] !== undefined
                        ? next[m.key]
                        : MARKETS_DEFAULT_VISIBLE_METRICS[m.key] ?? true;
                return v;
            }).length;
            if (count === 0) return prev;
            return next;
        });
    };

    const chartMetricOptions = useMemo(
        () => [
            { key: 'netRevenue', label: 'Net Revenue' },
            { key: 'orders', label: 'Orders' },
            { key: 'netProfit', label: 'Net Profit' },
            { key: 'roas', label: 'Blended ROAS' },
            { key: 'poas', label: 'Blended POAS' },
            { key: 'totalMarketingSpend', label: 'Spend' },
            { key: 'returns', label: 'Returns' },
            { key: 'discounts', label: 'Discount' },
            { key: 'taxes', label: 'Taxes' },
            { key: 'shippingCharges', label: 'Shipping Charges' },
            { key: 'transactionFee', label: 'Transaction Fees' },
        ],
        []
    );

    const includedRows = useMemo(
        () => (rows || []).filter((r) => hiddenMarkets[r.marketId] !== true),
        [rows, hiddenMarkets]
    );

    const allMarketsIncluded = useMemo(() => {
        const all = rows || [];
        if (!all.length) return true;
        return all.every((r) => hiddenMarkets[r.marketId] !== true);
    }, [rows, hiddenMarkets]);

    const displayTotalRow = useMemo(() => {
        const periodFixed =
            Number(storeTotalRow?.fixedExpense) ||
            Number(includedRows[0]?.fixedExpense) ||
            0;

        if (!includedRows.length) {
            return {
                marketId: '__selection_total__',
                marketName: 'Total',
                ...aggregateIncludedMarketRows([], { fixedExpense: periodFixed }),
            };
        }

        if (allMarketsIncluded && storeTotalRow) {
            return storeTotalRow;
        }

        return {
            marketId: '__selection_total__',
            marketName: 'Total',
            isSelectionTotal: true,
            ...aggregateIncludedMarketRows(includedRows, { fixedExpense: periodFixed }),
        };
    }, [includedRows, allMarketsIncluded, storeTotalRow]);

    const chartRows = includedRows;

    const chartCategories = useMemo(
        () => chartRows.map((r) => r.marketName || r.marketId || '—'),
        [chartRows]
    );

    const chartSeries = useMemo(() => {
        const selected = chartMetricOptions.find((o) => o.key === chartMetricKey);
        return [
            {
                name: selected?.label || chartMetricKey,
                data: chartRows.map((r) => {
                    const v = Number(r?.[chartMetricKey]);
                    return Number.isFinite(v) ? v : 0;
                }),
                color: '#406969',
            },
        ];
    }, [chartRows, chartMetricKey, chartMetricOptions]);

    const chartOptions = useMemo(
        () => ({
            chart: { id: 'markets-overview-metric', toolbar: { show: false }, fontFamily: 'Outfit, sans-serif' },
            xaxis: { categories: chartCategories, labels: { rotate: -35 } },
            yaxis: {
                labels: {
                    formatter: (v) => String(Math.round(Number(v) || 0)),
                },
            },
            dataLabels: { enabled: false },
            tooltip: {
                shared: false,
                intersect: true,
                y: { formatter: (v) => String(Math.round(Number(v) || 0)) },
            },
            grid: {
                borderColor: '#e5e7eb',
                strokeDashArray: 0,
                xaxis: { lines: { show: false } },
                yaxis: { lines: { show: true } },
            },
        }),
        [chartCategories]
    );

    const chartRemountKey = useMemo(
        () =>
            `${chartMetricKey}:${chartCategories.join('\u0001')}`,
        [chartMetricKey, chartCategories]
    );

    if (!customer || !marketsEnabled) {
        return (
            <div className="w-full flex justify-center items-center min-h-[240px]">
                <p className="text-gray-500 text-sm">Loading…</p>
            </div>
        );
    }

    if (featureDisabled) {
        return (
            <div className="w-full p-8 text-center text-gray-600">
                Shopify Markets is not enabled for this customer.
            </div>
        );
    }

    return (
        <div id="MarketsOverviewPage" className="w-full">
            <DashboardHeading
                title="Markets"
                label={customer.customerName}
                customerId={params.customerId}
                dateRange={appliedDateRange}
                loading={loading}
                dashboardType="markets-overview"
                dataSnapshot={{
                    marketRows: rows,
                    storeTotalRow: displayTotalRow,
                }}
                adSpendPlatformFilter={
                    adSpendFilterUiChannels.length > 0
                        ? {
                              options: adSpendFilterUiChannels.map((c) => ({
                                  id: c.id,
                                  label: c.label,
                              })),
                              excludedPlatforms: draftExcludedPlatforms,
                              appliedExcludedPlatforms,
                              onTogglePlatform: toggleAdSpendPlatformDraft,
                              onMenuWillOpen: syncDraftFromAppliedSpend,
                              onApplySpend: applyAdSpendPlatformFilters,
                          }
                        : null
                }
                right={
                    <DateRangePicker
                        onApply={handleDateRangeApply}
                        startDate={tempDateRange.startDate}
                        endDate={tempDateRange.endDate}
                        onStartDateChange={(newStart) =>
                            setTempDateRange((dr) => ({ ...dr, startDate: newStart }))
                        }
                        onEndDateChange={(newEnd) =>
                            setTempDateRange((dr) => ({ ...dr, endDate: newEnd }))
                        }
                    />
                }
            />

            <div className="mt-8 bg-white rounded-xl border border-gray-200 p-6">
                <div className="mb-5">
                    <MetricToggleBar
                        visibleMetrics={visibleMetrics}
                        onToggle={handleMetricToggle}
                        metricColumns={metricColumns}
                    />
                    <h3 className="text-lg font-semibold">Blended ROAS / POAS by Market</h3>
                    <label className="mt-3 flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                            type="checkbox"
                            className="rounded border-gray-300"
                            checked={filterAdSpendByMarket}
                            onChange={(e) => setFilterAdSpendByMarket(e.target.checked)}
                        />
                        Filter ad spend by market
                    </label>
                </div>
                <MarketsMetricsTable
                    rows={rows}
                    storeTotalRow={displayTotalRow}
                    loading={loading}
                    error={error}
                    visibleMetrics={visibleMetrics}
                    metricColumns={metricColumns}
                    hiddenMarkets={hiddenMarkets}
                    onToggleMarket={toggleMarketRow}
                />
            </div>

            <div className="mt-8 bg-white rounded-xl border border-gray-200 p-6">
                <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
                    <h3 className="text-lg font-semibold">Market Graph</h3>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Metric:</span>
                        <select
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            value={chartMetricKey}
                            onChange={(e) => setChartMetricKey(e.target.value)}
                        >
                            {chartMetricOptions.map((opt) => (
                                <option key={opt.key} value={opt.key}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
                <GraphCard
                    key={chartRemountKey}
                    title={chartMetricOptions.find((o) => o.key === chartMetricKey)?.label || 'Metric'}
                    chartOptions={chartOptions}
                    chartSeries={chartSeries}
                    chartType="bar"
                    height={360}
                />
            </div>
        </div>
    );
};

export default MarketsOverviewPage;
