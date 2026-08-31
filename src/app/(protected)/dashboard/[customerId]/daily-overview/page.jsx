'use client';

import './daily-overview.css';
import DashboardHeading from '@/components/dashboard/DashboardHeading';
import { useCustomers } from '@/hooks/useCustomers';
import { useBusinessCategory } from '@/hooks/useBusinessCategory';
import { useParams } from 'next/navigation';
import DateRangePicker from '@/components/dashboard/DateRangePicker';
import { useState, useMemo, useEffect } from 'react';
import { useDailyOverviewData } from './useDailyOverviewData';
import DailyMetricsTable from './DailyMetricsTable';
import LastYearPeriodTable from './LastYearPeriodTable';
import MetricToggleBar from './MetricToggleBar';
import { DEFAULT_VISIBLE_METRICS, METRIC_COLUMNS } from './metricConfig';
import { applyCustomKpiLabelsToMetricColumns } from '@/lib/performanceDashboard/dailyOverviewCustomKpis';
import { AD_SPEND_DAILY_COLUMN_KEYS } from '@/lib/mergeAdSpendDaily';
import GraphCard from '@/components/dashboard/GraphCard';
import {
    getCobaltChartBaseOptions,
    applyCobaltSeriesStyle,
} from '@/lib/charts/cobaltChartTheme';
import { pushDashboardDateRangeApplied } from '@root/lib/gtmFunctions';
import {
    useDashboardFilters,
    buildShopifyMarketFilterProps,
    buildAdSpendPlatformFilterProps,
} from '@/hooks/useDashboardHubShared';
import B2BDailyOverview from './B2BDailyOverview';
import { useDashboardDataOptional } from '@/contexts/DashboardDataContext';

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
    const shared = useDashboardDataOptional();

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

    const handleDateRangeApply = (payload) => {
        pushDashboardDateRangeApplied({
            page: 'daily_overview',
            customerId: params.customerId,
            startDate: payload.startDate,
            endDate: payload.endDate,
        });
        if (shared?.handleDateRangeApply) {
            shared.handleDateRangeApply(payload);
        } else {
            setAppliedDateRange({ startDate: payload.startDate, endDate: payload.endDate });
        }
    };
    const handleStartDateChange = (newStart) => {
        if (shared?.handleStartDateChange) {
            shared.handleStartDateChange(newStart);
        } else {
            setTempDateRange((dr) => ({ ...dr, startDate: newStart }));
        }
    };
    const handleEndDateChange = (newEnd) => {
        if (shared?.handleEndDateChange) {
            shared.handleEndDateChange(newEnd);
        } else {
            setTempDateRange((dr) => ({ ...dr, endDate: newEnd }));
        }
    };

    useEffect(() => {
        if (!shared) return;
        setAppliedDateRange(shared.appliedDateRange);
        setTempDateRange(shared.tempDateRange);
    }, [shared, shared?.appliedDateRange, shared?.tempDateRange]);

    const filters = useDashboardFilters(customer, params.customerId);
    const {
        shopifyMarketsFeatureOn,
        appliedExcludedPlatforms,
        mergedSourcesQuerySuffix,
    } = filters;

    const resolvedAppliedDateRange = shared?.appliedDateRange ?? appliedDateRange;
    const resolvedTempDateRange = shared?.tempDateRange ?? tempDateRange;

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
    } = useDailyOverviewData(customer, resolvedAppliedDateRange, mergedSourcesQuerySuffix, marketsSpendColumns);

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
    const [showLastYearTable, setShowLastYearTable] = useState(false);

    const revenueColumnLabel =
        metricColumns.find((c) => c.key === 'netRevenue')?.label ?? 'Net Revenue';

    const { trendChartSeries, trendChartOptions } = useMemo(() => {
        if (!rows?.length) {
            return { trendChartSeries: [], trendChartOptions: {} };
        }

        const options = getCobaltChartBaseOptions();
        options.chart = {
            ...options.chart,
            id: 'daily-overview-trend',
            toolbar: { show: false },
        };
        options.xaxis = {
            ...options.xaxis,
            categories: rows.map((r) => r.date),
            labels: {
                ...options.xaxis?.labels,
                rotate: -45,
            },
        };

        const series = applyCobaltSeriesStyle(
            [
                {
                    name: revenueColumnLabel,
                    data: rows.map((r) => Math.round(r.netRevenue || 0)),
                },
                {
                    name: 'Spend',
                    data: rows.map((r) =>
                        Math.round(
                            r.totalMarketingSpend ?? (r.ppcCost || 0) + (r.psCost || 0)
                        )
                    ),
                },
                {
                    name: 'Net Profit',
                    data: rows.map((r) => Math.round(r.netProfit ?? 0)),
                },
            ],
            options
        );

        return { trendChartSeries: series, trendChartOptions: options };
    }, [rows, revenueColumnLabel]);

    return (
        <div id="DailyOverviewPage" className="apex-perf w-full">
            <DashboardHeading
                variant="cobalt"
                showRunAudit={false}
                title="Daily Overview"
                label={customer ? customer.customerName : ''}
                customerId={params.customerId}
                dateRange={resolvedAppliedDateRange}
                loading={loading}
                dashboardType="daily-overview"
                dataSnapshot={{
                    dailyRows: rows,
                    previousPeriodRows: rowsPrev,
                    lastYearRows: rowsLastYear,
                    metricPreference: customerMetricPreference,
                    revenueType: revenueTypeState,
                }}
                shopifyMarketFilter={buildShopifyMarketFilterProps(filters)}
                adSpendPlatformFilter={buildAdSpendPlatformFilterProps(filters)}
                right={
                    <DateRangePicker
                        variant="cobalt"
                        onApply={handleDateRangeApply}
                        startDate={resolvedTempDateRange.startDate}
                        endDate={resolvedTempDateRange.endDate}
                        onStartDateChange={handleStartDateChange}
                        onEndDateChange={handleEndDateChange}
                    />
                }
            />

            <div className="apex-daily-panel">
                <div className="apex-daily-panel__head">
                    <MetricToggleBar
                        variant="cobalt"
                        visibleMetrics={visibleMetrics}
                        onToggle={handleMetricToggle}
                        showTrendChart={showTrendChart}
                        onTrendChartToggle={() => setShowTrendChart((v) => !v)}
                        showLastYearTable={showLastYearTable}
                        onLastYearTableToggle={() => setShowLastYearTable((v) => !v)}
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
                    metricColumns={metricColumns}
                />
            </div>

            {showLastYearTable && (
                <div className="apex-daily-panel apex-daily-panel--muted">
                    <h3 className="apex-daily-panel__title">Last Year Period</h3>
                    <p className="apex-daily-panel__subtitle">Full month — raw daily data</p>
                    <LastYearPeriodTable
                        variant="cobalt"
                        rowsLastYear={rowsLastYear}
                        rows={rows}
                        loading={loadingLastYear}
                        visibleMetrics={visibleMetrics}
                        metricColumns={metricColumns}
                    />
                </div>
            )}
        </div>
    );
}

