"use client";

import React from 'react';
import dynamic from 'next/dynamic';
import GraphCard from '@/components/dashboard/GraphCard';

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

export default function ParentROASChart({ dailyData, loading, metricPreference = 'ROAS/POAS' }) {
    if (loading) {
        return (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="flex justify-center items-center h-80">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary-searchmind)]"></div>
                </div>
            </div>
        );
    }

    if (!dailyData || dailyData.length === 0) {
        return (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    {metricPreference === 'Spendshare' ? 'Spendshare' : 'ROAS'} Over Time
                </h3>
                <div className="flex justify-center items-center h-80 text-gray-400">
                    No data available for the selected period
                </div>
            </div>
        );
    }

    // Prepare chart data based on metric preference
    const categories = dailyData.map(d => d.period);
    let metricData, metricName, yAxisTitle;

    if (metricPreference === 'Spendshare') {
        metricData = dailyData.map(d => {
            const totalSpend = (d.facebookSpend || 0) + (d.googleSpend || 0);
            const revenue = d.revenue || 0;
            return revenue > 0 ? ((totalSpend / revenue) * 100).toFixed(2) : 0;
        });
        metricName = 'Spendshare (%)';
        yAxisTitle = 'Spendshare (%)';
    } else {
        metricData = dailyData.map(d => {
            const totalSpend = (d.facebookSpend || 0) + (d.googleSpend || 0);
            const revenue = d.revenue || 0;
            return totalSpend > 0 ? (revenue / totalSpend).toFixed(2) : 0;
        });
        metricName = 'ROAS';
        yAxisTitle = 'ROAS';
    }

    const chartSeries = [
        { name: metricName, data: metricData }
    ];

    const chartOptions = {
        chart: {
            id: 'parent-roas',
            toolbar: { show: false },
            fontFamily: 'Outfit, sans-serif',
            zoom: { enabled: false }
        },
        stroke: { curve: 'smooth', width: 2 },
        colors: ['#213834'],
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
        xaxis: {
            type: 'category',
            categories,
            labels: {
                rotate: -45,
                style: { colors: '#406969' }
            },
            axisTicks: { show: true },
            axisBorder: { show: true }
        },
        yaxis: {
            title: { text: yAxisTitle, style: { color: '#1E2B2B' } },
            labels: {
                style: { colors: '#1E2B2B' },
                formatter: (val) => {
                    if (metricPreference === 'Spendshare') {
                        return `${Number(val).toFixed(2)}%`;
                    }
                    return Number(val).toFixed(2);
                }
            }
        },
        legend: {
            position: 'top',
            labels: { colors: '#1E2B2B' }
        },
        tooltip: {
            shared: true,
            intersect: false,
            theme: 'light',
            y: {
                formatter: (val) => {
                    if (metricPreference === 'Spendshare') {
                        return `${Number(val).toFixed(2)}%`;
                    }
                    return Number(val).toFixed(2);
                }
            }
        },
        dataLabels: { enabled: false },
        grid: { borderColor: '#e5e7eb', strokeDashArray: 0 }
    };

    const title = metricPreference === 'Spendshare' ? 'Spendshare Over Time' : 'ROAS Over Time';

    return <GraphCard title={title} chartOptions={chartOptions} chartSeries={chartSeries} chartType="area" height={380} />;
}