"use client";

import React from 'react';
import dynamic from 'next/dynamic';
import Spinner from '@/components/ui/Spinner';
import GraphCard from '@/components/dashboard/GraphCard';

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

export default function CustomerPerformance({ segmentation = null, loading = false }) {
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

    // Cohort retention helpers
    const renderCohortCellStyle = (val) => {
        if (val === null || val === undefined) return {};
        const v = Math.max(0, Math.min(100, Number(val)));
        let bg = '#f3f4f6';
        if (v >= 40) bg = '#C6ED62';
        else if (v >= 15) bg = '#FDE68A';
        else if (v > 0) bg = '#FECACA';
        return { backgroundColor: bg };
    };

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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <div className="text-xs text-gray-500">Orders (period)</div>
                            <div className="font-semibold text-2xl mt-2 text-black">{formatNumber(segmentation.totalOrders || 0)}</div>
                        </div>
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <div className="text-xs text-gray-500">Returning customers</div>
                            <div className="font-semibold text-3xl mt-2 text-black">{formatNumber(segmentation.returningCustomers ?? segmentation.returningCount ?? 0)} <span className="text-sm text-gray-400">({segmentation.returningPct ?? 0}%)</span></div>
                        </div>
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <div className="text-xs text-gray-500">New customers</div>
                            <div className="font-semibold text-3xl mt-2 text-black">{formatNumber(segmentation.newCustomers ?? segmentation.newCount ?? 0)} <span className="text-sm text-gray-400">({segmentation.newPct ?? 0}%)</span></div>
                        </div>
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <div className="text-xs text-gray-500">Total Revenue (period)</div>
                            <div className="font-semibold text-2xl mt-2 text-black">{formatCurrency(segmentation.totalRevenue ?? 0)}</div>
                        </div>
                    </div>

                    {segmentation.cohortRetention && segmentation.cohortRetention.cohorts && segmentation.cohortRetention.cohorts.length > 0 && (
                        <div className="bg-white border border-gray-200 rounded-xl p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h6 className="text-[var(--color-primary-searchmind)] mb-1 font-bold">Cohort Retention</h6>
                                    <div className="text-sm text-gray-500">Showing retention for cohorts (weekly)</div>
                                </div>
                            </div>
                            <div className="overflow-auto">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-2 text-left">Cohort (week start)</th>
                                            <th className="px-4 py-2 text-right">Size</th>
                                            {Array.from({ length: segmentation.cohortRetention.weeks }, (_, i) => (
                                                <th key={i} className="px-3 py-2 text-center">Week {i}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {segmentation.cohortRetention.cohorts.map((c, idx) => (
                                            <tr key={idx} className="border-b last:border-b-0">
                                                <td className="px-4 py-2">{c.cohort}</td>
                                                <td className="px-4 py-2 text-right">{formatNumber(c.size)}</td>
                                                {Array.from({ length: segmentation.cohortRetention.weeks }, (_, i) => (
                                                    <td key={i} className="px-2 py-2 text-center">
                                                        <div className="inline-block w-16 py-1 rounded" style={renderCohortCellStyle(c.retention[i])}>
                                                            <div className="text-xs text-gray-800 font-semibold">{c.retention[i] ? `${c.retention[i]}%` : '—'}</div>
                                                        </div>
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}