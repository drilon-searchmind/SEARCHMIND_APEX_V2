'use client';

import './daily-overview.css';
import DashboardHeading from '@/components/dashboard/DashboardHeading';
import { useCustomers } from '@/hooks/useCustomers';
import { useBusinessCategory } from '@/hooks/useBusinessCategory';
import { useParams } from 'next/navigation';
import DateRangePicker from '@/components/dashboard/DateRangePicker';
import { useState, useMemo } from 'react';
import { useDailyOverviewData } from './useDailyOverviewData';
import DailyMetricsTable from './DailyMetricsTable';
import RowComparisonPopover from './RowComparisonPopover';
import LastYearPeriodTable from './LastYearPeriodTable';
import MetricToggleBar from './MetricToggleBar';
import { DEFAULT_VISIBLE_METRICS, METRIC_COLUMNS } from './metricConfig';
import { applyCustomKpiLabelsToMetricColumns } from '@/lib/performanceDashboard/dailyOverviewCustomKpis';
import { AD_SPEND_DAILY_COLUMN_KEYS } from '@/lib/mergeAdSpendDaily';
import GraphCard from '@/components/dashboard/GraphCard';
import { pushDashboardDateRangeApplied } from '@root/lib/gtmFunctions';
import { useShopifyMarketsFilter } from '@/hooks/useShopifyMarketsFilter';
import { useAdSpendPlatformsFilter } from '@/hooks/useAdSpendPlatformsFilter';
import B2BDailyOverview from './B2BDailyOverview';

export default function DailyOverviewPage() {
    const params = useParams();
    const { customers } = useCustomers();
    const customer = customers.find((c) => c._id === params.customerId);
    const { isB2B } = useBusinessCategory(customer);

    if (isB2B) {
        return <B2BDailyOverview customer={customer} />;
    }

    return <EcommerceDailyOverview customer={customer} />;
}

function EcommerceDailyOverview({ customer: customerProp }) {
    const params = useParams();
    const { customers } = useCustomers();
    const customer = customerProp || customers.find((c) => c._id === params.customerId);

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

    const handleDateRangeApply = ({ startDate, endDate }) => {
        pushDashboardDateRangeApplied({
            page: 'daily_overview',
            customerId: params.customerId,
            startDate,
            endDate,
        });
        setAppliedDateRange({ startDate, endDate });
    };
    const handleStartDateChange = (newStart) => {
        setTempDateRange((dr) => ({ ...dr, startDate: newStart }));
    };
    const handleEndDateChange = (newEnd) => {
        setTempDateRange((dr) => ({ ...dr, endDate: newEnd }));
    };

    const {
        shopifyMarketsFeatureOn,
        shopifyMarkets,
        shopifyMarketsLoading,
        excludedShopifyMarkets,
        appliedExcludedShopifyMarkets,
        toggleShopifyMarket,
        applyShopifyMarketFilters,
        syncDraftFromAppliedMarkets,
        marketQuerySuffix,
        draftFilterAdSpendByMarket,
        appliedFilterAdSpendByMarket,
        setDraftFilterAdSpendByMarket,
    } = useShopifyMarketsFilter(customer, params.customerId);

    const {
        adSpendFilterUiChannels,
        draftExcludedPlatforms,
        appliedExcludedPlatforms,
        toggleAdSpendPlatformDraft,
        applyAdSpendPlatformFilters,
        syncDraftFromAppliedSpend,
        spendQuerySuffix,
    } = useAdSpendPlatformsFilter(customer, shopifyMarketsFeatureOn);

    const mergedSourcesQuerySuffix = `${marketQuerySuffix}${spendQuerySuffix}`;

    const marketsSpendColumns = useMemo(
        () =>
            shopifyMarketsFeatureOn
                ? {
                      shopifyMarkets: true,
                      appliedExcludedPlatforms,
                  }
                : null,
        [shopifyMarketsFeatureOn, appliedExcludedPlatforms]
    );

    const {
        rows,
        rowsPrev,
        rowsLastYear,
        loading,
        loadingLastYear,
        error,
        revenueTypeState,
        customerMetricPreference,
        visibleMarketingColumnKeys,
        customKpis,
    } = useDailyOverviewData(customer, appliedDateRange, mergedSourcesQuerySuffix, marketsSpendColumns);

    const [hoveredRowIndex, setHoveredRowIndex] = useState(null);
    const [hoveredRowTable, setHoveredRowTable] = useState(null);
    const [hoveredRowPosition, setHoveredRowPosition] = useState({
        top: 0,
        left: 0,
    });
    const [tableWidth, setTableWidth] = useState(null);

    const handleRowHover = ({ index, tableType, position, tableWidth: w }) => {
        setHoveredRowIndex(index);
        setHoveredRowTable(tableType);
        setHoveredRowPosition(position);
        setTableWidth(w);
    };
    const handleRowHoverLeave = () => {
        setHoveredRowIndex(null);
        setHoveredRowTable(null);
        setTableWidth(null);
    };

    const [userColumnVisibility, setUserColumnVisibility] = useState({});

    const metricColumns = useMemo(() => {
        const adKeySet = new Set(AD_SPEND_DAILY_COLUMN_KEYS);
        let cols = METRIC_COLUMNS;
        if (visibleMarketingColumnKeys != null) {
            const allow = new Set(visibleMarketingColumnKeys);
            cols = METRIC_COLUMNS.filter(
                (col) => !adKeySet.has(col.key) || allow.has(col.key)
            );
        }
        return applyCustomKpiLabelsToMetricColumns(cols, customKpis);
    }, [visibleMarketingColumnKeys, customKpis]);

    const visibleMetrics = useMemo(() => {
        const out = {};
        for (const m of metricColumns) {
            out[m.key] =
                userColumnVisibility[m.key] !== undefined
                    ? userColumnVisibility[m.key]
                    : DEFAULT_VISIBLE_METRICS[m.key] ?? true;
        }
        return out;
    }, [metricColumns, userColumnVisibility]);

    const handleMetricToggle = (key) => {
        if (!metricColumns.some((m) => m.key === key)) return;
        setUserColumnVisibility((prev) => {
            const defaults = DEFAULT_VISIBLE_METRICS[key] ?? true;
            const current = prev[key] !== undefined ? prev[key] : defaults;
            const next = { ...prev, [key]: !current };
            const count = metricColumns.filter((m) => {
                const v = next[m.key] !== undefined ? next[m.key] : DEFAULT_VISIBLE_METRICS[m.key] ?? true;
                return v;
            }).length;
            if (count === 0) return prev;
            return next;
        });
    };

    const [showTrendChart, setShowTrendChart] = useState(false);

    const revenueColumnLabel =
        metricColumns.find((c) => c.key === 'netRevenue')?.label ?? 'Net Revenue';

    const trendChartSeries = useMemo(() => {
        if (!rows?.length) return [];
        return [
            {
                name: revenueColumnLabel,
                data: rows.map((r) => Math.round(r.netRevenue || 0)),
                color: '#406969',
            },
            {
                name: 'Spend',
				data: rows.map((r) => Math.round(r.totalMarketingSpend ?? ((r.ppcCost || 0) + (r.psCost || 0)))),
                color: '#D6CDB6',
            },
            {
                name: 'Net Profit',
                data: rows.map((r) => Math.round(r.netProfit ?? 0)),
                color: '#1E2B2B',
            },
        ];
    }, [rows, revenueColumnLabel]);

    const trendChartOptions = useMemo(
        () => ({
            chart: {
                id: 'daily-overview-trend',
                toolbar: { show: false },
                fontFamily: 'Outfit, sans-serif',
            },
            xaxis: {
                categories: rows?.map((r) => r.date) || [],
                labels: { rotate: -45 },
                axisTicks: { show: true },
                axisBorder: { show: true },
            },
            stroke: { curve: 'smooth', width: 2 },
            legend: { show: true, position: 'top' },
            tooltip: { shared: true },
            grid: {
                borderColor: '#e5e7eb',
                strokeDashArray: 0,
                xaxis: { lines: { show: false } },
                yaxis: { lines: { show: true } },
            },
            dataLabels: { enabled: false },
        }),
        [rows]
    );

    return (
        <div id="DailyOverviewPage" className="cobalt-perf w-full" data-theme="cobalt">
            <DashboardHeading
                variant="cobalt"
                showRunAudit={false}
                title="Daily Overview"
                label={customer ? customer.customerName : ''}
                customerId={params.customerId}
                dateRange={appliedDateRange}
                loading={loading}
                dashboardType="daily-overview"
                dataSnapshot={{
                    dailyRows: rows,
                    previousPeriodRows: rowsPrev,
                    lastYearRows: rowsLastYear,
                    metricPreference: customerMetricPreference,
                    revenueType: revenueTypeState,
                }}
                shopifyMarketFilter={
                    shopifyMarketsFeatureOn
                        ? {
                              loading: shopifyMarketsLoading,
                              options: shopifyMarkets,
                              excludedMarkets: excludedShopifyMarkets,
                              appliedExcludedMarkets: appliedExcludedShopifyMarkets,
                              onToggleMarket: toggleShopifyMarket,
                              onMenuWillOpen: syncDraftFromAppliedMarkets,
                              onApplyMarkets: applyShopifyMarketFilters,
                              filterAdSpendByMarket: draftFilterAdSpendByMarket,
                              appliedFilterAdSpendByMarket,
                              onFilterAdSpendByMarketChange: setDraftFilterAdSpendByMarket,
                          }
                        : null
                }
                adSpendPlatformFilter={
                    shopifyMarketsFeatureOn && adSpendFilterUiChannels.length > 0
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
                        variant="cobalt"
                        onApply={handleDateRangeApply}
                        startDate={tempDateRange.startDate}
                        endDate={tempDateRange.endDate}
                        onStartDateChange={handleStartDateChange}
                        onEndDateChange={handleEndDateChange}
                    />
                }
            />

            <div className="apex-daily-panel">
                <div className="apex-daily-panel__toolbar">
                    <MetricToggleBar
                        variant="cobalt"
                        visibleMetrics={visibleMetrics}
                        onToggle={handleMetricToggle}
                        showTrendChart={showTrendChart}
                        onTrendChartToggle={() => setShowTrendChart((v) => !v)}
                        metricColumns={metricColumns}
                    />
                    <h3 className="apex-daily-panel__title">Daily Metrics</h3>
                </div>
                {showTrendChart && rows?.length > 0 && (
                    <div className="mb-6">
                        <GraphCard
                            variant="cobalt"
                            title="Net Revenue, Spend & Net Profit Over Time"
                            chartOptions={trendChartOptions}
                            chartSeries={trendChartSeries}
                            chartType="line"
                            height={320}
                        />
                    </div>
                )}
                <DailyMetricsTable
                    variant="cobalt"
                    rows={rows}
                    rowsPrev={rowsPrev}
                    rowsLastYear={rowsLastYear}
                    loading={loading}
                    error={error}
                    visibleMetrics={visibleMetrics}
                    onRowHover={handleRowHover}
                    onRowHoverLeave={handleRowHoverLeave}
                    metricColumns={metricColumns}
                />
            </div>

            <RowComparisonPopover
                visible={false}
                position={hoveredRowPosition}
                tableWidth={tableWidth}
                hoveredRowTable={hoveredRowTable}
                hoveredRowIndex={hoveredRowIndex}
                rows={rows}
                rowsLastYear={rowsLastYear}
                visibleMetrics={visibleMetrics}
                metricColumns={metricColumns}
            />

            <div className="apex-daily-panel apex-daily-panel--muted">
                <h3 className="apex-daily-panel__title">Last Year Period</h3>
                <p className="apex-daily-panel__subtitle">Full month</p>
                <LastYearPeriodTable
                    variant="cobalt"
                    rowsLastYear={rowsLastYear}
                    rows={rows}
                    loading={loadingLastYear}
                    visibleMetrics={visibleMetrics}
                    onRowHover={handleRowHover}
                    onRowHoverLeave={handleRowHoverLeave}
                    metricColumns={metricColumns}
                />
            </div>
        </div>
    );
}

