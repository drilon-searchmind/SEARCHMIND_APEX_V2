'use client';

import DashboardHeading from '@/components/dashboard/DashboardHeading';
import { useCustomers } from '@/hooks/useCustomers';
import { useParams, useRouter } from 'next/navigation';
import DateRangePicker from '@/components/dashboard/DateRangePicker';
import CobaltLoader from '@/components/ui/CobaltLoader';
import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { getCobaltChartBaseOptions } from '@/lib/charts/cobaltChartTheme';
import { COMMERCE_CHART_CHROME, METRIC_CHART_PALETTE } from '@/components/dashboard/chartColors';
import MarketsInsights, { marketsLede } from './MarketsInsights';
import MetricToggleBar from '../daily-overview/MetricToggleBar';
import {
    MARKETS_DEFAULT_VISIBLE_METRICS,
    marketsMetricColumnsWithVatLabels,
} from './marketsMetricConfig';
import { AD_SPEND_DAILY_COLUMN_KEYS } from '@/lib/mergeAdSpendDaily';
import { pushDashboardDateRangeApplied } from '@root/lib/gtmFunctions';
import {
    useDashboardFilters,
    buildAdSpendPlatformFilterProps,
} from '@/hooks/useDashboardHubShared';
import { useMarketsOverviewData } from './useMarketsOverviewData';
import MarketsMetricsTable from './MarketsMetricsTable';
import { aggregateIncludedMarketRows } from './marketsTotalsUtils';
import { isShopifyMarketsCustomer } from '@/lib/customerPlatformDisplay';
import { revenueVatDisplayLabelSuffix } from '@/lib/revenueVatDisplay';
import { useDashboardDataOptional } from '@/contexts/DashboardDataContext';
import './markets-overview.css';

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

const MarketsOverviewPage = () => {
    const params = useParams();
    const router = useRouter();
    const { customers } = useCustomers();
    const customer = customers.find((c) => c._id === params.customerId);
    const shared = useDashboardDataOptional();
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

    const filters = useDashboardFilters(customer, params.customerId);
    const { appliedExcludedPlatforms, spendQuerySuffix } = filters;

    const resolvedAppliedDateRange = shared?.appliedDateRange ?? appliedDateRange;
    const resolvedTempDateRange = shared?.tempDateRange ?? tempDateRange;
    const marketsQuerySuffix = spendQuerySuffix;

    useEffect(() => {
        if (!customer) return;
        if (!marketsEnabled) {
            router.replace(`/dashboard/${params.customerId}/home?page_id=overview`);
        }
    }, [customer, marketsEnabled, params.customerId, router]);

    useEffect(() => {
        setHiddenMarkets({});
    }, [customer?._id, resolvedAppliedDateRange.startDate, resolvedAppliedDateRange.endDate]);

    const handleDateRangeApply = (payload) => {
        pushDashboardDateRangeApplied({
            page: 'markets_overview',
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

    useEffect(() => {
        if (!shared) return;
        setAppliedDateRange(shared.appliedDateRange);
        setTempDateRange(shared.tempDateRange);
    }, [shared, shared?.appliedDateRange, shared?.tempDateRange]);

    const { rows, rowsPrev, loadingPrev, storeTotalRow, loading, error, featureDisabled, visibleMarketingColumnKeys } =
        useMarketsOverviewData(
            customer,
            resolvedAppliedDateRange,
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
        const baseColumns = marketsMetricColumnsWithVatLabels(
            customer?.CustomerSettings || {}
        );
        const adKeySet = new Set(AD_SPEND_DAILY_COLUMN_KEYS);
        if (visibleMarketingColumnKeys == null) return baseColumns;
        const allow = new Set(visibleMarketingColumnKeys);
        return baseColumns.filter(
            (col) => !adKeySet.has(col.key) || allow.has(col.key)
        );
    }, [visibleMarketingColumnKeys, customer?.CustomerSettings]);

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

    const chartMetricOptions = useMemo(() => {
        const vatSuffix = revenueVatDisplayLabelSuffix(customer?.CustomerSettings || {});
        const withVat = (key, label) =>
            ['netRevenue', 'returns', 'discounts', 'taxes', 'shippingCharges'].includes(key)
                ? `${label}${vatSuffix}`
                : label;
        return [
            { key: 'netRevenue', label: withVat('netRevenue', 'Net Revenue') },
            { key: 'orders', label: 'Orders' },
            { key: 'netProfit', label: 'Net Profit' },
            { key: 'roas', label: 'Blended ROAS' },
            { key: 'poas', label: 'Blended POAS' },
            { key: 'totalMarketingSpend', label: 'Spend' },
            { key: 'returns', label: withVat('returns', 'Returns') },
            { key: 'discounts', label: withVat('discounts', 'Discount') },
            { key: 'taxes', label: withVat('taxes', 'Taxes') },
            { key: 'shippingCharges', label: withVat('shippingCharges', 'Shipping Charges') },
            { key: 'transactionFee', label: 'Transaction Fees' },
        ];
    }, [customer?.CustomerSettings]);

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
        const periodFixed = Number(storeTotalRow?.fixedExpense) || 0;

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

    // One colour per market for the whole page (ranked by net revenue), distinct non-brand hues
    const marketColors = useMemo(() => {
        const ranked = [...(rows || [])].sort(
            (a, b) => (Number(b.netRevenue) || 0) - (Number(a.netRevenue) || 0)
        );
        return new Map(
            ranked.map((r, i) => [String(r.marketId), METRIC_CHART_PALETTE[i % METRIC_CHART_PALETTE.length]])
        );
    }, [rows]);
    const colorFor = useCallback(
        (marketId) => marketColors.get(String(marketId)) || METRIC_CHART_PALETTE[0],
        [marketColors]
    );

    // Comparison chart: included markets, ranked high to low on the chosen metric
    const chartRows = useMemo(
        () =>
            [...includedRows].sort(
                (a, b) => (Number(b?.[chartMetricKey]) || 0) - (Number(a?.[chartMetricKey]) || 0)
            ),
        [includedRows, chartMetricKey]
    );
    const isRatioMetric = chartMetricKey === 'roas' || chartMetricKey === 'poas';
    const isCountMetric = chartMetricKey === 'orders';

    const chartSeries = useMemo(() => {
        const selected = chartMetricOptions.find((o) => o.key === chartMetricKey);
        return [
            {
                name: selected?.label || chartMetricKey,
                data: chartRows.map((r) => {
                    const v = Number(r?.[chartMetricKey]);
                    return Number.isFinite(v) ? v : 0;
                }),
            },
        ];
    }, [chartRows, chartMetricKey, chartMetricOptions]);

    const chartOptions = useMemo(() => {
        const formatValue = (v) => {
            const n = Number(v) || 0;
            if (isRatioMetric) return n.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            if (isCountMetric) return Math.round(n).toLocaleString('da-DK');
            return `${Math.round(n).toLocaleString('da-DK')} kr.`;
        };
        const compactAxis = (v) => {
            const n = Number(v) || 0;
            if (isRatioMetric) return n.toLocaleString('da-DK', { maximumFractionDigits: 1 });
            const abs = Math.abs(n);
            if (abs >= 1e6) return `${(n / 1e6).toLocaleString('da-DK', { maximumFractionDigits: 1 })}m`;
            if (abs >= 1e3) return `${Math.round(n / 1e3).toLocaleString('da-DK')}k`;
            return Math.round(n).toLocaleString('da-DK');
        };
        const base = getCobaltChartBaseOptions();
        return {
            ...base,
            chart: { ...base.chart, type: 'bar', toolbar: { show: false }, zoom: { enabled: false } },
            colors: chartRows.map((r) => colorFor(r.marketId)),
            plotOptions: {
                bar: {
                    horizontal: true,
                    distributed: true,
                    borderRadius: 6,
                    borderRadiusApplication: 'end',
                    barHeight: '62%',
                    dataLabels: { position: 'top' },
                },
            },
            // Value sits just past the end of each bar, in ink, so it reads on any bar colour
            dataLabels: {
                enabled: true,
                formatter: formatValue,
                textAnchor: 'start',
                offsetX: 10,
                style: { fontSize: '12px', fontWeight: 600, colors: [COMMERCE_CHART_CHROME.legend] },
                background: { enabled: false },
                dropShadow: { enabled: false },
            },
            legend: { show: false },
            grid: {
                ...base.grid,
                padding: { ...(base.grid?.padding || {}), right: 90 },
                xaxis: { lines: { show: true } },
                yaxis: { lines: { show: false } },
            },
            xaxis: {
                ...base.xaxis,
                categories: chartRows.map((r) => r.marketName || r.marketId || '-'),
                labels: { ...base.xaxis.labels, formatter: compactAxis },
                axisBorder: { show: false },
            },
            // Horizontal bars take their value scale from yaxis; 20% headroom keeps the end label clear
            yaxis: {
                max: (dataMax) => (dataMax > 0 ? dataMax * 1.2 : undefined),
                labels: { style: { colors: COMMERCE_CHART_CHROME.legend, fontSize: '13px', fontWeight: 500 } },
            },
            tooltip: { ...base.tooltip, theme: 'dark', shared: false, intersect: true, y: { formatter: formatValue } },
            states: { hover: { filter: { type: 'none' } } },
        };
    }, [chartRows, colorFor, isRatioMetric, isCountMetric]);

    const chartRemountKey = useMemo(
        () => `${chartMetricKey}:${chartRows.map((r) => r.marketId).join('|')}`,
        [chartMetricKey, chartRows]
    );
    const chartHeight = Math.max(200, chartRows.length * 56 + 60);

    const headingSubtitle = !loading ? marketsLede(includedRows) : null;

    if (!customer || !marketsEnabled) {
        return (
            <div className="apex-perf w-full">
                <div className="apex-markets-loader-panel">
                    <CobaltLoader variant="block" title="Loading markets overview" />
                </div>
            </div>
        );
    }

    if (featureDisabled) {
        return (
            <div id="MarketsOverviewPage" className="apex-perf w-full apex-markets-stack">
                <div className="apex-markets-disabled">
                    Shopify Markets is not enabled for this customer.
                </div>
            </div>
        );
    }

    return (
        <div id="MarketsOverviewPage" className="apex-perf w-full apex-markets-stack">
            <DashboardHeading
                variant="cobalt"
                showRunAudit={false}
                title="Markets overview"
                label={customer.customerName}
                subtitle={headingSubtitle}
                customerId={params.customerId}
                dateRange={resolvedAppliedDateRange}
                loading={loading}
                dashboardType="markets-overview"
                dataSnapshot={{
                    marketRows: rows,
                    storeTotalRow: displayTotalRow,
                }}
                adSpendPlatformFilter={buildAdSpendPlatformFilterProps(filters)}
                right={
                    <DateRangePicker
                        variant="cobalt"
                        onApply={handleDateRangeApply}
                        startDate={resolvedTempDateRange.startDate}
                        endDate={resolvedTempDateRange.endDate}
                        onStartDateChange={(newStart) => {
                            if (shared?.handleStartDateChange) {
                                shared.handleStartDateChange(newStart);
                            } else {
                                setTempDateRange((dr) => ({ ...dr, startDate: newStart }));
                            }
                        }}
                        onEndDateChange={(newEnd) => {
                            if (shared?.handleEndDateChange) {
                                shared.handleEndDateChange(newEnd);
                            } else {
                                setTempDateRange((dr) => ({ ...dr, endDate: newEnd }));
                            }
                        }}
                    />
                }
            />

            {!loading && !error && includedRows.length > 0 ? (
                <MarketsInsights
                    rows={includedRows}
                    rowsPrev={rowsPrev}
                    loadingPrev={loadingPrev}
                    colorFor={colorFor}
                />
            ) : null}

            <div className="apex-markets-panel">
                <div className="apex-markets-chart-head">
                    <div>
                        <h3 className="apex-markets-panel__title">Market comparison</h3>
                        <p className="apex-markets-panel__subtitle">Included markets, ranked high to low</p>
                    </div>
                    <div className="apex-markets-field">
                        <label htmlFor="markets-chart-metric" className="apex-markets-field__label">
                            Metric
                        </label>
                        <select
                            id="markets-chart-metric"
                            className="apex-markets-select"
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
                {chartRows.length > 0 ? (
                    <div className="apex-markets-chart">
                        <ReactApexChart
                            key={chartRemountKey}
                            options={chartOptions}
                            series={chartSeries}
                            type="bar"
                            height={chartHeight}
                            width="100%"
                        />
                    </div>
                ) : (
                    <p className="apex-markets-panel__subtitle mb-0">
                        Include at least one market to render the comparison chart.
                    </p>
                )}
            </div>

            <div className="apex-markets-panel">
                <div className="apex-markets-panel__toolbar">
                    <div>
                        <h3 className="apex-markets-panel__title">All metrics by market</h3>
                        <p className="apex-markets-panel__subtitle">
                            Toggle columns, or untick a market to leave it out. Everything above follows your selection.
                        </p>
                    </div>
                    {!allMarketsIncluded ? (
                        <span className="apex-mk-tag is-warn">Totals reflect selection</span>
                    ) : null}
                </div>
                <MetricToggleBar
                    variant="cobalt"
                    visibleMetrics={visibleMetrics}
                    onToggle={handleMetricToggle}
                    metricColumns={metricColumns}
                />
                <MarketsMetricsTable
                    variant="cobalt"
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
        </div>
    );
};

export default MarketsOverviewPage;
