"use client";

import React, { useState } from 'react';
import GraphCard from '@/components/dashboard/GraphCard';
import MetricCard from '@/components/dashboard/MetricCard';
import CobaltLoader from '@/components/ui/CobaltLoader';
import { FiDollarSign, FiTrendingUp, FiPackage } from 'react-icons/fi';
import { AD_SPEND_CHANNELS } from '@/lib/mergeAdSpendDaily';

function MetricWithCalc({ showCalcs, label, value, icon, popOverContent, calcValueLabels }) {
    const hasCalc = showCalcs && popOverContent;
    const calcLines = hasCalc
        ? popOverContent.split('\n').map((l) => l.trim()).filter((l) => l && l.startsWith('=') && /\d/.test(l))
        : [];

    return (
        <div className="apex-ecom-metric-wrap">
            <MetricCard variant="cobalt" label={label} value={value} icon={icon} popOverContent={null} />
            {hasCalc && (calcLines.length > 0 || calcValueLabels) && (
                <div className="apex-ecom-calc">
                    {calcValueLabels && (
                        <div className="space-y-0.5 mb-1.5 pb-1.5 border-b border-[var(--color-rule)]">
                            {calcValueLabels.split('\n').filter(Boolean).map((line, i) => {
                                const colonIdx = line.indexOf(':');
                                const lbl = colonIdx >= 0 ? line.slice(0, colonIdx).trim() : line;
                                const val = colonIdx >= 0 ? line.slice(colonIdx + 1).trim() : '';
                                return (
                                    <div key={i} className="apex-ecom-calc__row">
                                        <span>{lbl}</span>
                                        <span>{val}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {calcLines.length > 0 && (
                        <div className="apex-ecom-calc__result">
                            {calcLines.map((line, i) => (
                                i === calcLines.length - 1 ? (
                                    <strong key={i}>{line}</strong>
                                ) : (
                                    <span key={i}>{line}</span>
                                )
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function MetricGroup({ label, children }) {
    return (
        <div className="apex-ecom-metric-group">
            <h3 className="apex-ecom-metric-group__label">{label}</h3>
            <div className="apex-ecom-metrics">{children}</div>
        </div>
    );
}

const LOADING_STUB = {
    dailySeries: [],
    firstOrdersCount: null,
    totalOrders: null,
    totalNetRevenue: null,
    ncaNetRevenue: null,
    returningCustomerNetRevenue: null,
    ltv30: null,
    ltv90: null,
    ltv180: null,
    adSpend: null,
    adSpendByChannel: null,
};

export default function CustomerPerformance({
    segmentation = null,
    loading = false,
    ltvLoading = false,
    ltvError = null,
    visibleAdSpendChannels = null,
}) {
    const [showCalcs, setShowCalcs] = useState(false);
    const formatNumber = (n) => (n === undefined || n === null ? '—' : Number(n).toLocaleString());
    const formatCurrency = (v) => (v === undefined || v === null ? '—' : `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })} kr`);
    const fmt = (n) => (n != null ? Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—');
    const formatPct = (part, total) => (total != null && total > 0 && part != null ? Math.round((part / total) * 100) : null);
    const withPct = (display, part, total) => {
        const pct = formatPct(part, total);
        return display !== '—' && pct != null ? `${display} (${pct} %)` : display;
    };

    const data = segmentation ?? LOADING_STUB;

    const channelsForPaidMediaBreakdown =
        !loading && segmentation && visibleAdSpendChannels != null
            ? visibleAdSpendChannels
            : AD_SPEND_CHANNELS;

    const showPaidMediaByChannelBlock =
        Boolean(data.adSpendByChannel || loading) &&
        (loading || visibleAdSpendChannels == null || visibleAdSpendChannels.length > 0);

    const categories = data?.dailySeries?.map(d => d.period) || [];
    const newSeriesData = data?.dailySeries?.map(d => d.newCustomers || 0) || [];
    const returningSeriesData = data?.dailySeries?.map(d => d.returningCustomers || 0) || [];

    const timeSeriesChartOptions = {
        chart: {
            id: 'segmentation-timeseries',
            toolbar: { show: false },
            stacked: true,
        },
        stroke: { curve: 'smooth', width: 2 },
        fill: {
            type: 'solid',
            opacity: 0.92,
        },
        xaxis: { categories, labels: { rotate: -45 } },
        yaxis: {
            labels: {
                formatter: (v) => Math.round(v).toLocaleString('da-DK'),
            },
        },
        legend: { position: 'top', horizontalAlign: 'left' },
        tooltip: { shared: true, y: { formatter: (v) => formatNumber(v) } },
        dataLabels: { enabled: false },
    };

    const timeSeriesChartSeries = [
        { name: 'New', data: newSeriesData },
        { name: 'Returning', data: returningSeriesData },
    ];

    const firstOrders = data.firstOrdersCount ?? 0;
    const adSpend = data.adSpend ?? 0;
    const nCAC = firstOrders > 0 && adSpend > 0 ? adSpend / firstOrders : null;
    const ltvNcac = (ltv) => (ltv != null && nCAC != null && nCAC > 0 ? (ltv / nCAC).toFixed(2) : '—');
    const ltv30 = data.ltv30;
    const ltv90 = data.ltv90;
    const ltv180 = data.ltv180;
    const channelSpendLines = (data.adSpendByChannel
        ? channelsForPaidMediaBreakdown.map(
              (c) => `${c.label}: ${fmt(data.adSpendByChannel[c.metricsDataKey] ?? 0)} kr`
          ).join('\n')
        : '') || '';
    const nCacCalcLabels = (ltvVal) => {
        if (nCAC == null || ltvVal == null) return null;
        return `Paid media (total): ${fmt(adSpend)} kr\n${channelSpendLines ? `${channelSpendLines}\n` : ''}New customer orders: ${fmt(firstOrders)}\nnCAC: ${fmt(nCAC)} kr\nLTV: ${fmt(ltvVal)} kr`;
    };

    return (
        <section className="apex-ecom-panel">
            <div className="apex-ecom-panel__head">
                <div>
                    <h2 className="apex-ecom-panel__title">Customer Segmentation</h2>
                    <p className="apex-ecom-panel__subtitle">New vs returning customers, LTV, and acquisition efficiency</p>
                </div>
                {!loading && segmentation && (
                    <button
                        type="button"
                        className={`apex-perf-chip${showCalcs ? ' is-active' : ''}`}
                        onClick={() => setShowCalcs((v) => !v)}
                    >
                        Show calcs
                    </button>
                )}
            </div>

            {!loading && !segmentation ? (
                <div className="apex-ecom-empty">No segmentation data available</div>
            ) : loading && !segmentation ? (
                <div className="apex-perf-loading">
                    <CobaltLoader
                        variant="block"
                        title="Loading customer data"
                        request="GET /api/customer-segmentation-shopifyql"
                    />
                </div>
            ) : (
                <>
                    <div className="apex-ecom-chart-block">
                        <GraphCard
                            variant="cobalt"
                            hideChartToggle
                            title="New vs Returning customers over time"
                            chartOptions={timeSeriesChartOptions}
                            chartSeries={timeSeriesChartSeries}
                            chartType="area"
                            height={320}
                        />
                    </div>

                    <MetricGroup label="Orders">
                        <MetricWithCalc showCalcs={showCalcs}
                            label="New customer orders"
                            value={withPct(data.firstOrdersCount != null ? formatNumber(data.firstOrdersCount) : '—', data.firstOrdersCount, data.totalOrders)}
                            icon={<FiPackage />}
                            calcValueLabels={data.firstOrdersCount != null && data.totalOrders != null ? `New customer orders: ${fmt(data.firstOrdersCount)}\nTotal orders: ${fmt(data.totalOrders)}\n% of total: ${formatPct(data.firstOrdersCount, data.totalOrders) ?? '—'}%` : null}
                            popOverContent={data.firstOrdersCount != null && data.totalOrders != null ? `= ${fmt(data.firstOrdersCount)} (${formatPct(data.firstOrdersCount, data.totalOrders)}% of total)` : null}
                        />
                        <MetricWithCalc showCalcs={showCalcs}
                            label="Returning customer orders"
                            value={(() => {
                                const val = data.totalOrders != null && data.firstOrdersCount != null ? data.totalOrders - data.firstOrdersCount : null;
                                return withPct(val != null ? formatNumber(val) : '—', val, data.totalOrders);
                            })()}
                            icon={<FiPackage />}
                            calcValueLabels={data.totalOrders != null && data.firstOrdersCount != null ? `Total orders: ${fmt(data.totalOrders)}\nNew customer orders: ${fmt(data.firstOrdersCount)}\nReturning: ${fmt(data.totalOrders - data.firstOrdersCount)}\n% of total: ${formatPct(data.totalOrders - data.firstOrdersCount, data.totalOrders) ?? '—'}%` : null}
                            popOverContent={data.totalOrders != null && data.firstOrdersCount != null ? `= ${fmt(data.totalOrders)} - ${fmt(data.firstOrdersCount)}\n= ${fmt(data.totalOrders - data.firstOrdersCount)} (${formatPct(data.totalOrders - data.firstOrdersCount, data.totalOrders)}% of total)` : null}
                        />
                        <MetricWithCalc showCalcs={showCalcs}
                            label="Total customer orders"
                            value={data.totalOrders != null ? formatNumber(data.totalOrders) : '—'}
                            icon={<FiPackage />}
                            calcValueLabels={data.totalOrders != null ? `New customer orders: ${fmt(data.firstOrdersCount)}\nReturning customer orders: ${fmt((data.totalOrders ?? 0) - (data.firstOrdersCount ?? 0))}\nTotal: ${fmt(data.totalOrders)}` : null}
                            popOverContent={data.firstOrdersCount != null && data.totalOrders != null ? `= ${fmt(data.firstOrdersCount)} + ${fmt(data.totalOrders - data.firstOrdersCount)}\n= ${fmt(data.totalOrders)}` : null}
                        />
                    </MetricGroup>

                    <MetricGroup label="Revenue">
                        <MetricWithCalc showCalcs={showCalcs}
                            label="New customer revenue"
                            value={withPct(data.ncaNetRevenue != null ? formatCurrency(data.ncaNetRevenue) : '—', data.ncaNetRevenue, data.totalNetRevenue)}
                            icon={<FiDollarSign />}
                            calcValueLabels={data.ncaNetRevenue != null && data.totalNetRevenue != null ? `New customer revenue: ${fmt(data.ncaNetRevenue)} kr\nTotal revenue: ${fmt(data.totalNetRevenue)} kr\n% of total: ${formatPct(data.ncaNetRevenue, data.totalNetRevenue) ?? '—'}%` : null}
                            popOverContent={data.ncaNetRevenue != null && data.totalNetRevenue != null ? `= ${fmt(data.ncaNetRevenue)} kr (${formatPct(data.ncaNetRevenue, data.totalNetRevenue)}% of total)` : null}
                        />
                        <MetricWithCalc showCalcs={showCalcs}
                            label="Returning customer revenue"
                            value={withPct(data.returningCustomerNetRevenue != null ? formatCurrency(data.returningCustomerNetRevenue) : '—', data.returningCustomerNetRevenue, data.totalNetRevenue)}
                            icon={<FiDollarSign />}
                            calcValueLabels={data.returningCustomerNetRevenue != null && data.totalNetRevenue != null ? `Returning customer revenue: ${fmt(data.returningCustomerNetRevenue)} kr\nTotal revenue: ${fmt(data.totalNetRevenue)} kr\n% of total: ${formatPct(data.returningCustomerNetRevenue, data.totalNetRevenue) ?? '—'}%` : null}
                            popOverContent={data.returningCustomerNetRevenue != null && data.totalNetRevenue != null ? `= ${fmt(data.returningCustomerNetRevenue)} kr (${formatPct(data.returningCustomerNetRevenue, data.totalNetRevenue)}% of total)` : null}
                        />
                        <MetricWithCalc showCalcs={showCalcs}
                            label="Total customer revenue"
                            value={data.totalNetRevenue != null ? formatCurrency(data.totalNetRevenue) : '—'}
                            icon={<FiDollarSign />}
                            calcValueLabels={data.ncaNetRevenue != null && data.returningCustomerNetRevenue != null ? `New customer revenue: ${fmt(data.ncaNetRevenue)} kr\nReturning customer revenue: ${fmt(data.returningCustomerNetRevenue)} kr\nTotal: ${fmt(data.totalNetRevenue)} kr` : null}
                            popOverContent={data.ncaNetRevenue != null && data.returningCustomerNetRevenue != null ? `= ${fmt(data.ncaNetRevenue)} + ${fmt(data.returningCustomerNetRevenue)}\n= ${fmt(data.totalNetRevenue)} kr` : null}
                        />
                    </MetricGroup>

                    {ltvError && (
                        <div className="apex-ecom-alert">
                            <span className="font-medium">LTV unavailable:</span>
                            <span>{ltvError}</span>
                        </div>
                    )}

                    <MetricGroup label="Lifetime value">
                        <MetricWithCalc showCalcs={showCalcs}
                            label="LTV 30 days"
                            value={data.ltv30 != null ? formatCurrency(data.ltv30) : '—'}
                            icon={<FiTrendingUp />}
                            calcValueLabels={data.ltv30 != null ? `LTV 30 days: ${fmt(data.ltv30)} kr\n(Sum of revenue in first 30 days from first purchase / count of customers)` : null}
                            popOverContent={data.ltv30 != null ? `= ${fmt(data.ltv30)} kr (avg per customer)` : null}
                        />
                        <MetricWithCalc showCalcs={showCalcs}
                            label="LTV 90 days"
                            value={ltvLoading && data.ltv90 == null ? '…' : (data.ltv90 != null ? formatCurrency(data.ltv90) : '—')}
                            icon={<FiTrendingUp />}
                            calcValueLabels={data.ltv90 != null ? `LTV 90 days: ${fmt(data.ltv90)} kr\n(Sum of revenue in first 90 days from first purchase / count of customers)` : null}
                            popOverContent={data.ltv90 != null ? `= ${fmt(data.ltv90)} kr (avg per customer)` : null}
                        />
                        <MetricWithCalc showCalcs={showCalcs}
                            label="LTV 180 days"
                            value={ltvLoading && data.ltv180 == null ? '…' : (data.ltv180 != null ? formatCurrency(data.ltv180) : '—')}
                            icon={<FiTrendingUp />}
                            calcValueLabels={data.ltv180 != null ? `LTV 180 days: ${fmt(data.ltv180)} kr\n(Sum of revenue in first 180 days from first purchase / count of customers)` : null}
                            popOverContent={data.ltv180 != null ? `= ${fmt(data.ltv180)} kr (avg per customer)` : null}
                        />
                    </MetricGroup>

                    {showPaidMediaByChannelBlock && (
                        <MetricGroup label="Paid media">
                            <div className="apex-ecom-channels">
                                <p className="apex-ecom-channels__title">Spend by channel</p>
                                <div className="apex-ecom-channels__grid">
                                    {channelsForPaidMediaBreakdown.map((c) => {
                                        const amt = loading
                                            ? null
                                            : (data.adSpendByChannel?.[c.metricsDataKey] ?? 0);
                                        return (
                                            <div key={c.id} className="apex-ecom-channel">
                                                <div className="apex-ecom-channel__label">{c.label}</div>
                                                <div className="apex-ecom-channel__value">
                                                    {amt == null ? '—' : `${fmt(amt)} kr`}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </MetricGroup>
                    )}

                    <MetricGroup label="Acquisition efficiency">
                        <MetricWithCalc showCalcs={showCalcs}
                            label="LTV/nCAC 30 days"
                            value={ltvNcac(data.ltv30)}
                            icon={<FiTrendingUp />}
                            calcValueLabels={nCacCalcLabels(ltv30)}
                            popOverContent={nCAC != null && ltv30 != null ? `= ${fmt(adSpend)} / ${fmt(firstOrders)}\n= ${fmt(nCAC)} kr (nCAC)\n= ${fmt(ltv30)} / ${fmt(nCAC)}\n= ${ltvNcac(ltv30)} (LTV/nCAC)` : null}
                        />
                        <MetricWithCalc showCalcs={showCalcs}
                            label="LTV/nCAC 90 days"
                            value={ltvLoading && data.ltv90 == null ? '…' : ltvNcac(data.ltv90)}
                            icon={<FiTrendingUp />}
                            calcValueLabels={nCacCalcLabels(ltv90)}
                            popOverContent={nCAC != null && ltv90 != null ? `= ${fmt(adSpend)} / ${fmt(firstOrders)}\n= ${fmt(nCAC)} kr (nCAC)\n= ${fmt(ltv90)} / ${fmt(nCAC)}\n= ${ltvNcac(ltv90)} (LTV/nCAC)` : null}
                        />
                        <MetricWithCalc showCalcs={showCalcs}
                            label="LTV/nCAC 180 days"
                            value={ltvLoading && data.ltv180 == null ? '…' : ltvNcac(data.ltv180)}
                            icon={<FiTrendingUp />}
                            calcValueLabels={nCacCalcLabels(ltv180)}
                            popOverContent={nCAC != null && ltv180 != null ? `= ${fmt(adSpend)} / ${fmt(firstOrders)}\n= ${fmt(nCAC)} kr (nCAC)\n= ${fmt(ltv180)} / ${fmt(nCAC)}\n= ${ltvNcac(ltv180)} (LTV/nCAC)` : null}
                        />
                    </MetricGroup>
                </>
            )}
        </section>
    );
}
