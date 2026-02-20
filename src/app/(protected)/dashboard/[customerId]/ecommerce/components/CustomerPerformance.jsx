"use client";

import React from 'react';
import dynamic from 'next/dynamic';
import Spinner from '@/components/ui/Spinner';
import GraphCard from '@/components/dashboard/GraphCard';
import MetricCard from '@/components/dashboard/MetricCard';
import { FiUsers, FiUserPlus, FiDollarSign, FiTrendingUp, FiPackage } from 'react-icons/fi';

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

export default function CustomerPerformance({ segmentation = null, loading = false, extendedMetricsLoading = false }) {
    const formatNumber = (n) => (n === undefined || n === null ? '—' : Number(n).toLocaleString());
    const formatCurrency = (v) => (v === undefined || v === null ? '—' : `${Number(v).toLocaleString()} kr`);

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

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        <MetricCard
                            label="New customers"
                            value={`${formatNumber(segmentation.newCustomers ?? segmentation.newCount ?? 0)} (${segmentation.newPct ?? 0}%)`}
                            icon={<FiUserPlus className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />}
                        />
                        <MetricCard
                            label="Returning customers"
                            value={`${formatNumber(segmentation.returningCustomers ?? segmentation.returningCount ?? 0)} (${segmentation.returningPct ?? 0}%)`}
                            icon={<FiUsers className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />}
                        />
                        <MetricCard
                            label="Orders (period)"
                            value={formatNumber(segmentation.totalOrders || 0)}
                            icon={<FiPackage className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />}
                        />
                        <MetricCard
                            label="Total Revenue (period)"
                            value={segmentation.totalRevenue != null ? Number(segmentation.totalRevenue).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                            unit="kr"
                            icon={<FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />}
                        />
                        <MetricCard
                            label="NCA Revenue"
                            value={segmentation.ncaRevenue != null ? Number(segmentation.ncaRevenue).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                            unit="kr"
                            icon={<FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />}
                        />
                        <MetricCard
                            label="LTV 30 days"
                            value={extendedMetricsLoading && segmentation.ltv30 == null ? <Spinner size={20} className="inline-block" /> : (segmentation.ltv30 != null ? Number(segmentation.ltv30).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—')}
                            unit={segmentation.ltv30 != null ? 'kr' : undefined}
                            icon={<FiTrendingUp className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />}
                        />
                        <MetricCard
                            label="LTV 90 days"
                            value={extendedMetricsLoading && segmentation.ltv90 == null ? <Spinner size={20} className="inline-block" /> : (segmentation.ltv90 != null ? Number(segmentation.ltv90).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—')}
                            unit={segmentation.ltv90 != null ? 'kr' : undefined}
                            icon={<FiTrendingUp className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />}
                        />
                        <MetricCard
                            label="NCA Net Revenue"
                            value={extendedMetricsLoading && segmentation.ncaNetRevenue == null ? <Spinner size={20} className="inline-block" /> : (segmentation.ncaNetRevenue != null ? Number(segmentation.ncaNetRevenue).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—')}
                            unit={segmentation.ncaNetRevenue != null ? 'kr' : undefined}
                            icon={<FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />}
                        />
                        <MetricCard
                            label="Returning Customer Net Revenue"
                            value={extendedMetricsLoading && segmentation.returningCustomerNetRevenue == null ? <Spinner size={20} className="inline-block" /> : (segmentation.returningCustomerNetRevenue != null ? Number(segmentation.returningCustomerNetRevenue).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—')}
                            unit={segmentation.returningCustomerNetRevenue != null ? 'kr' : undefined}
                            icon={<FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}