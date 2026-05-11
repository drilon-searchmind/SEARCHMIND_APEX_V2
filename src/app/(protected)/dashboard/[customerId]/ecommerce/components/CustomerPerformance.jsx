"use client";

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import GraphCard from '@/components/dashboard/GraphCard';
import MetricCard from '@/components/dashboard/MetricCard';
import Spinner from '@/components/ui/Spinner';
import { FiDollarSign, FiTrendingUp, FiPackage } from 'react-icons/fi';
import { AD_SPEND_CHANNELS } from '@/lib/mergeAdSpendDaily';

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

function MetricWithCalc({ showCalcs, label, value, icon, popOverContent, calcValueLabels }) {
    const hasCalc = showCalcs && popOverContent;
    const calcLines = hasCalc ? popOverContent.split('\n').map((l) => l.trim()).filter((l) => l && l.startsWith('=') && /\d/.test(l)) : [];
    return (
        <div className={hasCalc ? 'flex flex-col' : ''}>
            <MetricCard label={label} value={value} icon={icon} popOverContent={null} />
            {hasCalc && (calcLines.length > 0 || calcValueLabels) && (
                <div className="mt-0.5 px-3 py-2 rounded-b-xl bg-gray-50 border border-t-0 border-gray-200 text-[10px] font-mono text-gray-600 leading-tight translate-y-[-10px]">
                    {calcValueLabels && (
                        <div className="mb-1.5 pb-1.5 border-b border-gray-200 space-y-0.5">
                            {calcValueLabels.split('\n').filter(Boolean).map((line, i) => {
                                const colonIdx = line.indexOf(':');
                                const lbl = colonIdx >= 0 ? line.slice(0, colonIdx).trim() : line;
                                const val = colonIdx >= 0 ? line.slice(colonIdx + 1).trim() : '';
                                return (
                                    <div key={i} className="flex justify-between gap-4">
                                        <span className="text-gray-500">{lbl}</span>
                                        <span className="tabular-nums">{val}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {calcLines.length > 0 && (
                        <div className="flex flex-col items-end">
                            {calcLines.map((line, i) => (
                                <span key={i} className={i === calcLines.length - 1 ? 'font-bold text-[var(--color-primary-searchmind)]' : ''}>
                                    {line}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// Stub for skeleton layout while loading (all nulls so cards show "—")
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

    const data = loading ? LOADING_STUB : segmentation;

    // Use full channel list while loading; after load, only channels with integration + meaningful spend
    const channelsForPaidMediaBreakdown =
        !loading && visibleAdSpendChannels != null
            ? visibleAdSpendChannels
            : AD_SPEND_CHANNELS;

    const showPaidMediaByChannelBlock =
        Boolean(data.adSpendByChannel || loading) &&
        (loading || visibleAdSpendChannels == null || visibleAdSpendChannels.length > 0);
    const categories = data?.dailySeries?.map(d => d.period) || [];
    const newSeriesData = data?.dailySeries?.map(d => d.newCustomers || 0) || [];
    const returningSeriesData = data?.dailySeries?.map(d => d.returningCustomers || 0) || [];

    const timeSeriesChartOptions = {
        chart: { id: 'segmentation-timeseries', toolbar: { show: false }, fontFamily: 'Outfit, sans-serif' },
        stroke: { curve: 'smooth', width: 2 },
        colors: ['#406969', '#C6ED62'],
        fill: {
            type: 'gradient',
            gradient: {
                shade: 'light',
                type: 'vertical',
                shadeIntensity: 0.4,
                inverseColors: false,
                opacityFrom: 0.45,
                opacityTo: 0.10,
                stops: [5, 80, 100]
            }
        },
        xaxis: { categories, labels: { rotate: -45 } },
        legend: { position: 'top' },
        tooltip: { shared: true, y: { formatter: v => formatNumber(v) } },
        dataLabels: { enabled: false },
        grid: { borderColor: '#e5e7eb' },
    };

    const timeSeriesChartSeries = [
        { name: 'Returning', data: returningSeriesData },
        { name: 'New', data: newSeriesData },
    ];

    return (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">Customer Segmentation</h3>
                    <p className="text-sm text-gray-400">New vs returning customers</p>
                </div>
            </div>

            {!loading && !segmentation ? (
                <div className="text-sm text-gray-500">No segmentation data available</div>
            ) : (
                <div className="space-y-4">
                    <GraphCard title="New vs Returning customers over time" chartOptions={timeSeriesChartOptions} chartSeries={timeSeriesChartSeries} chartType="area" height={320} />

                    <div className="flex items-center gap-3 mb-4">
                        <button
                            type="button"
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors focus:outline-none ${showCalcs ? 'bg-[var(--color-primary-searchmind)] text-white border-[var(--color-primary-searchmind)]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                            onClick={() => setShowCalcs((v) => !v)}
                        >
                            Show calcs
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {/* Row 1: Orders */}
                        <MetricWithCalc showCalcs={showCalcs}
                            label="New customer orders"
                            value={withPct(data.firstOrdersCount != null ? formatNumber(data.firstOrdersCount) : '—', data.firstOrdersCount, data.totalOrders)}
                            icon={<FiPackage className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />}
                            calcValueLabels={data.firstOrdersCount != null && data.totalOrders != null ? `New customer orders: ${fmt(data.firstOrdersCount)}\nTotal orders: ${fmt(data.totalOrders)}\n% of total: ${formatPct(data.firstOrdersCount, data.totalOrders) ?? '—'}%` : null}
                            popOverContent={data.firstOrdersCount != null && data.totalOrders != null ? `= ${fmt(data.firstOrdersCount)} (${formatPct(data.firstOrdersCount, data.totalOrders)}% of total)` : null}
                        />
                        <MetricWithCalc showCalcs={showCalcs}
                            label="Returning customer orders"
                            value={(() => {
                                const val = data.totalOrders != null && data.firstOrdersCount != null ? data.totalOrders - data.firstOrdersCount : null;
                                return withPct(val != null ? formatNumber(val) : '—', val, data.totalOrders);
                            })()}
                            icon={<FiPackage className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />}
                            calcValueLabels={data.totalOrders != null && data.firstOrdersCount != null ? `Total orders: ${fmt(data.totalOrders)}\nNew customer orders: ${fmt(data.firstOrdersCount)}\nReturning: ${fmt(data.totalOrders - data.firstOrdersCount)}\n% of total: ${formatPct(data.totalOrders - data.firstOrdersCount, data.totalOrders) ?? '—'}%` : null}
                            popOverContent={data.totalOrders != null && data.firstOrdersCount != null ? `= ${fmt(data.totalOrders)} - ${fmt(data.firstOrdersCount)}\n= ${fmt(data.totalOrders - data.firstOrdersCount)} (${formatPct(data.totalOrders - data.firstOrdersCount, data.totalOrders)}% of total)` : null}
                        />
                        <MetricWithCalc showCalcs={showCalcs}
                            label="Total customer orders"
                            value={data.totalOrders != null ? formatNumber(data.totalOrders) : '—'}
                            icon={<FiPackage className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />}
                            calcValueLabels={data.totalOrders != null ? `New customer orders: ${fmt(data.firstOrdersCount)}\nReturning customer orders: ${fmt((data.totalOrders ?? 0) - (data.firstOrdersCount ?? 0))}\nTotal: ${fmt(data.totalOrders)}` : null}
                            popOverContent={data.firstOrdersCount != null && data.totalOrders != null ? `= ${fmt(data.firstOrdersCount)} + ${fmt(data.totalOrders - data.firstOrdersCount)}\n= ${fmt(data.totalOrders)}` : null}
                        />
                        {/* Row 2: Revenue */}
                        <MetricWithCalc showCalcs={showCalcs}
                            label="New customer revenue"
                            value={withPct(data.ncaNetRevenue != null ? formatCurrency(data.ncaNetRevenue) : '—', data.ncaNetRevenue, data.totalNetRevenue)}
                            icon={<FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />}
                            calcValueLabels={data.ncaNetRevenue != null && data.totalNetRevenue != null ? `New customer revenue: ${fmt(data.ncaNetRevenue)} kr\nTotal revenue: ${fmt(data.totalNetRevenue)} kr\n% of total: ${formatPct(data.ncaNetRevenue, data.totalNetRevenue) ?? '—'}%` : null}
                            popOverContent={data.ncaNetRevenue != null && data.totalNetRevenue != null ? `= ${fmt(data.ncaNetRevenue)} kr (${formatPct(data.ncaNetRevenue, data.totalNetRevenue)}% of total)` : null}
                        />
                        <MetricWithCalc showCalcs={showCalcs}
                            label="Returning customer revenue"
                            value={withPct(data.returningCustomerNetRevenue != null ? formatCurrency(data.returningCustomerNetRevenue) : '—', data.returningCustomerNetRevenue, data.totalNetRevenue)}
                            icon={<FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />}
                            calcValueLabels={data.returningCustomerNetRevenue != null && data.totalNetRevenue != null ? `Returning customer revenue: ${fmt(data.returningCustomerNetRevenue)} kr\nTotal revenue: ${fmt(data.totalNetRevenue)} kr\n% of total: ${formatPct(data.returningCustomerNetRevenue, data.totalNetRevenue) ?? '—'}%` : null}
                            popOverContent={data.returningCustomerNetRevenue != null && data.totalNetRevenue != null ? `= ${fmt(data.returningCustomerNetRevenue)} kr (${formatPct(data.returningCustomerNetRevenue, data.totalNetRevenue)}% of total)` : null}
                        />
                        <MetricWithCalc showCalcs={showCalcs}
                            label="Total customer revenue"
                            value={data.totalNetRevenue != null ? formatCurrency(data.totalNetRevenue) : '—'}
                            icon={<FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />}
                            calcValueLabels={data.ncaNetRevenue != null && data.returningCustomerNetRevenue != null ? `New customer revenue: ${fmt(data.ncaNetRevenue)} kr\nReturning customer revenue: ${fmt(data.returningCustomerNetRevenue)} kr\nTotal: ${fmt(data.totalNetRevenue)} kr` : null}
                            popOverContent={data.ncaNetRevenue != null && data.returningCustomerNetRevenue != null ? `= ${fmt(data.ncaNetRevenue)} + ${fmt(data.returningCustomerNetRevenue)}\n= ${fmt(data.totalNetRevenue)} kr` : null}
                        />
                        {/* Row 3: LTV */}
                        {ltvError && (
                            <div className="col-span-full flex items-center gap-2 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                                <span className="font-medium">LTV unavailable:</span>
                                <span>{ltvError}</span>
                            </div>
                        )}
                        <MetricWithCalc showCalcs={showCalcs}
                            label="LTV 30 days"
                            value={data.ltv30 != null ? formatCurrency(data.ltv30) : '—'}
                            icon={<FiTrendingUp className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />}
                            calcValueLabels={data.ltv30 != null ? `LTV 30 days: ${fmt(data.ltv30)} kr\n(Sum of revenue in first 30 days from first purchase / count of customers)` : null}
                            popOverContent={data.ltv30 != null ? `= ${fmt(data.ltv30)} kr (avg per customer)` : null}
                        />
                        <MetricWithCalc showCalcs={showCalcs}
                            label="LTV 90 days"
                            value={ltvLoading && data.ltv90 == null ? <Spinner size={20} className="inline-block" /> : (data.ltv90 != null ? formatCurrency(data.ltv90) : '—')}
                            icon={<FiTrendingUp className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />}
                            calcValueLabels={data.ltv90 != null ? `LTV 90 days: ${fmt(data.ltv90)} kr\n(Sum of revenue in first 90 days from first purchase / count of customers)` : null}
                            popOverContent={data.ltv90 != null ? `= ${fmt(data.ltv90)} kr (avg per customer)` : null}
                        />
                        <MetricWithCalc showCalcs={showCalcs}
                            label="LTV 180 days"
                            value={ltvLoading && data.ltv180 == null ? <Spinner size={20} className="inline-block" /> : (data.ltv180 != null ? formatCurrency(data.ltv180) : '—')}
                            icon={<FiTrendingUp className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />}
                            calcValueLabels={data.ltv180 != null ? `LTV 180 days: ${fmt(data.ltv180)} kr\n(Sum of revenue in first 180 days from first purchase / count of customers)` : null}
                            popOverContent={data.ltv180 != null ? `= ${fmt(data.ltv180)} kr (avg per customer)` : null}
                        />
                        {showPaidMediaByChannelBlock && (
                            <div className="col-span-full rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-3">
                                <p className="text-xs font-semibold text-gray-700 mb-2">Paid media by channel</p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                                    {channelsForPaidMediaBreakdown.map((c) => {
                                        const amt = loading
                                            ? null
                                            : (data.adSpendByChannel?.[c.metricsDataKey] ?? 0);
                                        return (
                                            <div key={c.id} className="rounded-md border border-gray-200 bg-white px-2 py-1.5">
                                                <div className="text-[10px] text-gray-500 leading-tight">{c.label}</div>
                                                <div className="text-sm font-semibold tabular-nums text-gray-900">
                                                    {amt == null ? '—' : `${fmt(amt)} kr`}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        {/* Row 4: LTV/nCAC — nCAC = total paid media spend / new customer orders */}
                        {(() => {
                            const firstOrders = data.firstOrdersCount ?? 0;
                            const adSpend = data.adSpend ?? 0;
                            const nCAC = firstOrders > 0 && adSpend > 0 ? adSpend / firstOrders : null;
                            const ltvNcac = (ltv) => (ltv != null && nCAC != null && nCAC > 0 ? (ltv / nCAC).toFixed(2) : '—');
                            const ltv30 = data.ltv30;
                            const ltv90 = data.ltv90;
                            const ltv180 = data.ltv180;
                            const channelSpendLines = (data.adSpendByChannel
                                ? channelsForPaidMediaBreakdown.map(
                                      (c) =>
                                          `${c.label}: ${fmt(data.adSpendByChannel[c.metricsDataKey] ?? 0)} kr`
                                  ).join('\n')
                                : '') || '';
                            const nCacCalcLabels = (ltvVal) => {
                                if (nCAC == null || ltvVal == null) return null;
                                const head = `Paid media (total): ${fmt(adSpend)} kr\n${channelSpendLines ? `${channelSpendLines}\n` : ''}New customer orders: ${fmt(firstOrders)}\nnCAC: ${fmt(nCAC)} kr\nLTV: ${fmt(ltvVal)} kr`;
                                return head;
                            };
                            return (
                                <>
                                    <MetricWithCalc showCalcs={showCalcs}
                                        label="LTV/nCAC 30 days"
                                        value={ltvNcac(data.ltv30)}
                                        icon={<FiTrendingUp className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />}
                                        calcValueLabels={nCacCalcLabels(ltv30)}
                                        popOverContent={nCAC != null && ltv30 != null ? `= ${fmt(adSpend)} / ${fmt(firstOrders)}\n= ${fmt(nCAC)} kr (nCAC)\n= ${fmt(ltv30)} / ${fmt(nCAC)}\n= ${ltvNcac(ltv30)} (LTV/nCAC)` : null}
                                    />
                                    <MetricWithCalc showCalcs={showCalcs}
                                        label="LTV/nCAC 90 days"
                                        value={ltvLoading && data.ltv90 == null ? <Spinner size={20} className="inline-block" /> : ltvNcac(data.ltv90)}
                                        icon={<FiTrendingUp className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />}
                                        calcValueLabels={nCacCalcLabels(ltv90)}
                                        popOverContent={nCAC != null && ltv90 != null ? `= ${fmt(adSpend)} / ${fmt(firstOrders)}\n= ${fmt(nCAC)} kr (nCAC)\n= ${fmt(ltv90)} / ${fmt(nCAC)}\n= ${ltvNcac(ltv90)} (LTV/nCAC)` : null}
                                    />
                                    <MetricWithCalc showCalcs={showCalcs}
                                        label="LTV/nCAC 180 days"
                                        value={ltvLoading && data.ltv180 == null ? <Spinner size={20} className="inline-block" /> : ltvNcac(data.ltv180)}
                                        icon={<FiTrendingUp className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />}
                                        calcValueLabels={nCacCalcLabels(ltv180)}
                                        popOverContent={nCAC != null && ltv180 != null ? `= ${fmt(adSpend)} / ${fmt(firstOrders)}\n= ${fmt(nCAC)} kr (nCAC)\n= ${fmt(ltv180)} / ${fmt(nCAC)}\n= ${ltvNcac(ltv180)} (LTV/nCAC)` : null}
                                    />
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
}