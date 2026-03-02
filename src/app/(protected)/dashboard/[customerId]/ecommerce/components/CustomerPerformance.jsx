"use client";

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import Spinner from '@/components/ui/Spinner';
import GraphCard from '@/components/dashboard/GraphCard';
import MetricCard from '@/components/dashboard/MetricCard';
import { FiDollarSign, FiTrendingUp, FiPackage } from 'react-icons/fi';

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

export default function CustomerPerformance({ segmentation = null, loading = false, extendedMetricsLoading = false }) {
    const [showCalcs, setShowCalcs] = useState(false);
    const formatNumber = (n) => (n === undefined || n === null ? '—' : Number(n).toLocaleString());
    const formatCurrency = (v) => (v === undefined || v === null ? '—' : `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })} kr`);
    const fmt = (n) => (n != null ? Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—');
    const formatPct = (part, total) => (total != null && total > 0 && part != null ? Math.round((part / total) * 100) : null);
    const withPct = (display, part, total) => {
        const pct = formatPct(part, total);
        return display !== '—' && pct != null ? `${display} (${pct} %)` : display;
    };

    const MetricWithCalc = ({ label, value, icon, popOverContent, calcValueLabels }) => {
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
    };

    // Prepare chart data
    const categories = segmentation?.dailySeries?.map(d => d.period) || [];
    const newSeriesData = segmentation?.dailySeries?.map(d => d.newCustomers || 0) || [];
    const returningSeriesData = segmentation?.dailySeries?.map(d => d.returningCustomers || 0) || [];

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

            {loading ? (
                <div className="flex justify-center items-center h-40"><Spinner size={36} /></div>
            ) : !segmentation ? (
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
                        <MetricWithCalc
                            label="New customer orders"
                            value={extendedMetricsLoading && segmentation.firstOrdersCount == null ? <Spinner size={20} className="inline-block" /> : withPct(segmentation.firstOrdersCount != null ? formatNumber(segmentation.firstOrdersCount) : '—', segmentation.firstOrdersCount, segmentation.totalOrders)}
                            icon={<FiPackage className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />}
                            calcValueLabels={segmentation.firstOrdersCount != null && segmentation.totalOrders != null ? `New customer orders: ${fmt(segmentation.firstOrdersCount)}\nTotal orders: ${fmt(segmentation.totalOrders)}\n% of total: ${formatPct(segmentation.firstOrdersCount, segmentation.totalOrders) ?? '—'}%` : null}
                            popOverContent={segmentation.firstOrdersCount != null && segmentation.totalOrders != null ? `= ${fmt(segmentation.firstOrdersCount)} (${formatPct(segmentation.firstOrdersCount, segmentation.totalOrders)}% of total)` : null}
                        />
                        <MetricWithCalc
                            label="Returning customer orders"
                            value={extendedMetricsLoading && (segmentation.totalOrders == null || segmentation.firstOrdersCount == null) ? <Spinner size={20} className="inline-block" /> : (() => {
                                const val = segmentation.totalOrders != null && segmentation.firstOrdersCount != null ? segmentation.totalOrders - segmentation.firstOrdersCount : null;
                                return withPct(val != null ? formatNumber(val) : '—', val, segmentation.totalOrders);
                            })()}
                            icon={<FiPackage className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />}
                            calcValueLabels={segmentation.totalOrders != null && segmentation.firstOrdersCount != null ? `Total orders: ${fmt(segmentation.totalOrders)}\nNew customer orders: ${fmt(segmentation.firstOrdersCount)}\nReturning: ${fmt(segmentation.totalOrders - segmentation.firstOrdersCount)}\n% of total: ${formatPct(segmentation.totalOrders - segmentation.firstOrdersCount, segmentation.totalOrders) ?? '—'}%` : null}
                            popOverContent={segmentation.totalOrders != null && segmentation.firstOrdersCount != null ? `= ${fmt(segmentation.totalOrders)} - ${fmt(segmentation.firstOrdersCount)}\n= ${fmt(segmentation.totalOrders - segmentation.firstOrdersCount)} (${formatPct(segmentation.totalOrders - segmentation.firstOrdersCount, segmentation.totalOrders)}% of total)` : null}
                        />
                        <MetricWithCalc
                            label="Total customer orders"
                            value={extendedMetricsLoading && segmentation.totalOrders == null ? <Spinner size={20} className="inline-block" /> : (segmentation.totalOrders != null ? formatNumber(segmentation.totalOrders) : '—')}
                            icon={<FiPackage className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />}
                            calcValueLabels={segmentation.totalOrders != null ? `New customer orders: ${fmt(segmentation.firstOrdersCount)}\nReturning customer orders: ${fmt((segmentation.totalOrders ?? 0) - (segmentation.firstOrdersCount ?? 0))}\nTotal: ${fmt(segmentation.totalOrders)}` : null}
                            popOverContent={segmentation.firstOrdersCount != null && segmentation.totalOrders != null ? `= ${fmt(segmentation.firstOrdersCount)} + ${fmt(segmentation.totalOrders - segmentation.firstOrdersCount)}\n= ${fmt(segmentation.totalOrders)}` : null}
                        />
                        {/* Row 2: Revenue */}
                        <MetricWithCalc
                            label="New customer revenue"
                            value={extendedMetricsLoading && segmentation.ncaNetRevenue == null ? <Spinner size={20} className="inline-block" /> : withPct(segmentation.ncaNetRevenue != null ? formatCurrency(segmentation.ncaNetRevenue) : '—', segmentation.ncaNetRevenue, segmentation.totalNetRevenue)}
                            icon={<FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />}
                            calcValueLabels={segmentation.ncaNetRevenue != null && segmentation.totalNetRevenue != null ? `New customer revenue: ${fmt(segmentation.ncaNetRevenue)} kr\nTotal revenue: ${fmt(segmentation.totalNetRevenue)} kr\n% of total: ${formatPct(segmentation.ncaNetRevenue, segmentation.totalNetRevenue) ?? '—'}%` : null}
                            popOverContent={segmentation.ncaNetRevenue != null && segmentation.totalNetRevenue != null ? `= ${fmt(segmentation.ncaNetRevenue)} kr (${formatPct(segmentation.ncaNetRevenue, segmentation.totalNetRevenue)}% of total)` : null}
                        />
                        <MetricWithCalc
                            label="Returning customer revenue"
                            value={extendedMetricsLoading && segmentation.returningCustomerNetRevenue == null ? <Spinner size={20} className="inline-block" /> : withPct(segmentation.returningCustomerNetRevenue != null ? formatCurrency(segmentation.returningCustomerNetRevenue) : '—', segmentation.returningCustomerNetRevenue, segmentation.totalNetRevenue)}
                            icon={<FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />}
                            calcValueLabels={segmentation.returningCustomerNetRevenue != null && segmentation.totalNetRevenue != null ? `Returning customer revenue: ${fmt(segmentation.returningCustomerNetRevenue)} kr\nTotal revenue: ${fmt(segmentation.totalNetRevenue)} kr\n% of total: ${formatPct(segmentation.returningCustomerNetRevenue, segmentation.totalNetRevenue) ?? '—'}%` : null}
                            popOverContent={segmentation.returningCustomerNetRevenue != null && segmentation.totalNetRevenue != null ? `= ${fmt(segmentation.returningCustomerNetRevenue)} kr (${formatPct(segmentation.returningCustomerNetRevenue, segmentation.totalNetRevenue)}% of total)` : null}
                        />
                        <MetricWithCalc
                            label="Total customer revenue"
                            value={extendedMetricsLoading && segmentation.totalNetRevenue == null ? <Spinner size={20} className="inline-block" /> : (segmentation.totalNetRevenue != null ? formatCurrency(segmentation.totalNetRevenue) : '—')}
                            icon={<FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />}
                            calcValueLabels={segmentation.ncaNetRevenue != null && segmentation.returningCustomerNetRevenue != null ? `New customer revenue: ${fmt(segmentation.ncaNetRevenue)} kr\nReturning customer revenue: ${fmt(segmentation.returningCustomerNetRevenue)} kr\nTotal: ${fmt(segmentation.totalNetRevenue)} kr` : null}
                            popOverContent={segmentation.ncaNetRevenue != null && segmentation.returningCustomerNetRevenue != null ? `= ${fmt(segmentation.ncaNetRevenue)} + ${fmt(segmentation.returningCustomerNetRevenue)}\n= ${fmt(segmentation.totalNetRevenue)} kr` : null}
                        />
                        {/* Row 3: LTV */}
                        <MetricWithCalc
                            label="LTV 30 days"
                            value={extendedMetricsLoading && segmentation.ltv30 == null ? <Spinner size={20} className="inline-block" /> : (segmentation.ltv30 != null ? formatCurrency(segmentation.ltv30) : '—')}
                            icon={<FiTrendingUp className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />}
                            calcValueLabels={segmentation.ltv30 != null ? `LTV 30 days: ${fmt(segmentation.ltv30)} kr\n(Sum of revenue in first 30 days from first purchase / count of customers)` : null}
                            popOverContent={segmentation.ltv30 != null ? `= ${fmt(segmentation.ltv30)} kr (avg per customer)` : null}
                        />
                        <MetricWithCalc
                            label="LTV 90 days"
                            value={extendedMetricsLoading && segmentation.ltv90 == null ? <Spinner size={20} className="inline-block" /> : (segmentation.ltv90 != null ? formatCurrency(segmentation.ltv90) : '—')}
                            icon={<FiTrendingUp className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />}
                            calcValueLabels={segmentation.ltv90 != null ? `LTV 90 days: ${fmt(segmentation.ltv90)} kr\n(Sum of revenue in first 90 days from first purchase / count of customers)` : null}
                            popOverContent={segmentation.ltv90 != null ? `= ${fmt(segmentation.ltv90)} kr (avg per customer)` : null}
                        />
                        <MetricWithCalc
                            label="LTV 180 days"
                            value={extendedMetricsLoading && segmentation.ltv180 == null ? <Spinner size={20} className="inline-block" /> : (segmentation.ltv180 != null ? formatCurrency(segmentation.ltv180) : '—')}
                            icon={<FiTrendingUp className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />}
                            calcValueLabels={segmentation.ltv180 != null ? `LTV 180 days: ${fmt(segmentation.ltv180)} kr\n(Sum of revenue in first 180 days from first purchase / count of customers)` : null}
                            popOverContent={segmentation.ltv180 != null ? `= ${fmt(segmentation.ltv180)} kr (avg per customer)` : null}
                        />
                        {/* Row 4: LTV/nCAC — nCAC = ad spend (FB+Google) / new customer orders, LTV/nCAC = LTV / nCAC */}
                        {(() => {
                            const firstOrders = segmentation.firstOrdersCount ?? 0;
                            const adSpend = segmentation.adSpend ?? 0;
                            const nCAC = firstOrders > 0 && adSpend > 0 ? adSpend / firstOrders : null;
                            const ltvNcac = (ltv) => (ltv != null && nCAC != null && nCAC > 0 ? (ltv / nCAC).toFixed(2) : '—');
                            const ltv30 = segmentation.ltv30;
                            const ltv90 = segmentation.ltv90;
                            const ltv180 = segmentation.ltv180;
                            return (
                                <>
                                    <MetricWithCalc
                                        label="LTV/nCAC 30 days"
                                        value={extendedMetricsLoading && (segmentation.ltv30 == null || segmentation.adSpend == null) ? <Spinner size={20} className="inline-block" /> : ltvNcac(segmentation.ltv30)}
                                        icon={<FiTrendingUp className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />}
                                        calcValueLabels={nCAC != null && ltv30 != null ? `Ad spend (FB+Google): ${fmt(adSpend)} kr\nNew customer orders: ${fmt(firstOrders)}\nnCAC: ${fmt(nCAC)} kr\nLTV 30 days: ${fmt(ltv30)} kr` : null}
                                        popOverContent={nCAC != null && ltv30 != null ? `= ${fmt(adSpend)} / ${fmt(firstOrders)}\n= ${fmt(nCAC)} kr (nCAC)\n= ${fmt(ltv30)} / ${fmt(nCAC)}\n= ${ltvNcac(ltv30)} (LTV/nCAC)` : null}
                                    />
                                    <MetricWithCalc
                                        label="LTV/nCAC 90 days"
                                        value={extendedMetricsLoading && (segmentation.ltv90 == null || segmentation.adSpend == null) ? <Spinner size={20} className="inline-block" /> : ltvNcac(segmentation.ltv90)}
                                        icon={<FiTrendingUp className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />}
                                        calcValueLabels={nCAC != null && ltv90 != null ? `Ad spend (FB+Google): ${fmt(adSpend)} kr\nNew customer orders: ${fmt(firstOrders)}\nnCAC: ${fmt(nCAC)} kr\nLTV 90 days: ${fmt(ltv90)} kr` : null}
                                        popOverContent={nCAC != null && ltv90 != null ? `= ${fmt(adSpend)} / ${fmt(firstOrders)}\n= ${fmt(nCAC)} kr (nCAC)\n= ${fmt(ltv90)} / ${fmt(nCAC)}\n= ${ltvNcac(ltv90)} (LTV/nCAC)` : null}
                                    />
                                    <MetricWithCalc
                                        label="LTV/nCAC 180 days"
                                        value={extendedMetricsLoading && (segmentation.ltv180 == null || segmentation.adSpend == null) ? <Spinner size={20} className="inline-block" /> : ltvNcac(segmentation.ltv180)}
                                        icon={<FiTrendingUp className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />}
                                        calcValueLabels={nCAC != null && ltv180 != null ? `Ad spend (FB+Google): ${fmt(adSpend)} kr\nNew customer orders: ${fmt(firstOrders)}\nnCAC: ${fmt(nCAC)} kr\nLTV 180 days: ${fmt(ltv180)} kr` : null}
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