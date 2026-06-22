'use client';

import DashboardHeading from '@/components/dashboard/DashboardHeading';
import { useCustomers } from '@/hooks/useCustomers';
import { useParams, useRouter } from 'next/navigation';
import DateRangePicker from '@/components/dashboard/DateRangePicker';
import CobaltLoader from '@/components/ui/CobaltLoader';
import { useCallback, useEffect, useMemo, useState } from 'react';
import GraphCard from '@/components/dashboard/GraphCard';
import MetricToggleBar from '../daily-overview/MetricToggleBar';
import {
    MARKETS_DEFAULT_VISIBLE_METRICS,
    marketsMetricColumnsWithVatLabels,
} from './marketsMetricConfig';
import { AD_SPEND_DAILY_COLUMN_KEYS } from '@/lib/mergeAdSpendDaily';
import { pushDashboardDateRangeApplied } from '@root/lib/gtmFunctions';
import { useAdSpendPlatformsFilter } from '@/hooks/useAdSpendPlatformsFilter';
import { useMarketsOverviewData } from './useMarketsOverviewData';
import MarketsMetricsTable from './MarketsMetricsTable';
import { aggregateIncludedMarketRows } from './marketsTotalsUtils';
import { isShopifyMarketsCustomer } from '@/lib/customerPlatformDisplay';
import { revenueVatDisplayLabelSuffix } from '@/lib/revenueVatDisplay';
import './markets-overview.css';

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

    const {
        adSpendFilterUiChannels,
        draftExcludedPlatforms,
        appliedExcludedPlatforms,
        toggleAdSpendPlatformDraft,
        applyAdSpendPlatformFilters,
        syncDraftFromAppliedSpend,
        spendQuerySuffix,
    } = useAdSpendPlatformsFilter(customer, marketsEnabled);

    const marketsQuerySuffix = spendQuerySuffix;

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
            },
        ];
    }, [chartRows, chartMetricKey, chartMetricOptions]);

    const chartOptions = useMemo(
        () => ({
            xaxis: { categories: chartCategories, labels: { rotate: -35 } },
            yaxis: {
                labels: {
                    formatter: (v) => String(Math.round(Number(v) || 0)),
                },
            },
            tooltip: {
                shared: false,
                intersect: true,
                y: { formatter: (v) => String(Math.round(Number(v) || 0)) },
            },
        }),
        [chartCategories]
    );

    const chartRemountKey = useMemo(
        () => `${chartMetricKey}:${chartCategories.join('\u0001')}`,
        [chartMetricKey, chartCategories]
    );

    const marketCount = rows?.length ?? 0;
    const includedCount = includedRows.length;
    const headingSubtitle = `${appliedDateRange.startDate} to ${appliedDateRange.endDate} · Compare ROAS and POAS per Shopify market`;

    if (!customer || !marketsEnabled) {
        return (
            <div className="cobalt-perf w-full" data-theme="cobalt">
                <div className="apex-markets-loader-panel">
                    <CobaltLoader variant="block" title="Loading markets overview" />
                </div>
            </div>
        );
    }

    if (featureDisabled) {
        return (
            <div id="MarketsOverviewPage" className="cobalt-perf w-full apex-markets-stack" data-theme="cobalt">
                <div className="apex-markets-disabled">
                    Shopify Markets is not enabled for this customer.
                </div>
            </div>
        );
    }

    return (
        <div id="MarketsOverviewPage" className="cobalt-perf w-full apex-markets-stack" data-theme="cobalt">
            <DashboardHeading
                variant="cobalt"
                showRunAudit={false}
                title="Markets Overview"
                label={customer.customerName}
                subtitle={headingSubtitle}
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
                        variant="cobalt"
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

            <div className="apex-markets-summary">
                <span className="apex-markets-summary__chip">
                    <strong>{marketCount}</strong> markets
                </span>
                <span className="apex-markets-summary__chip">
                    <strong>{includedCount}</strong> in chart
                </span>
                {!allMarketsIncluded ? (
                    <span className="apex-markets-summary__chip">
                        Totals reflect selection
                    </span>
                ) : null}
            </div>

            <div className="apex-markets-panel">
                <div className="apex-markets-panel__toolbar">
                    <div>
                        <h3 className="apex-markets-panel__title">Blended ROAS / POAS by market</h3>
                        <p className="apex-markets-panel__subtitle">
                            Toggle columns or exclude markets with the checkboxes — chart and totals follow your selection.
                        </p>
                    </div>
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

            <div className="apex-markets-panel">
                <div className="apex-markets-chart-head">
                    <div>
                        <h3 className="apex-markets-panel__title">Market comparison</h3>
                        <p className="apex-markets-panel__subtitle">
                            Bar chart for included markets only
                        </p>
                    </div>
                    <div className="apex-markets-field">
                        <label htmlFor="markets-chart-metric" className="apex-markets-field__label">
                            Chart metric
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
                    <GraphCard
                        key={chartRemountKey}
                        variant="cobalt"
                        title={chartMetricOptions.find((o) => o.key === chartMetricKey)?.label || 'Metric'}
                        chartOptions={chartOptions}
                        chartSeries={chartSeries}
                        chartType="bar"
                        height={360}
                        hideChartToggle
                    />
                ) : (
                    <p className="apex-markets-panel__subtitle mb-0">
                        Include at least one market to render the comparison chart.
                    </p>
                )}
            </div>
        </div>
    );
};

export default MarketsOverviewPage;
