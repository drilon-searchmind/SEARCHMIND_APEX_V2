"use client";

import React from 'react';
import dynamic from 'next/dynamic';
import GraphCard from '@/components/dashboard/GraphCard';

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

export default function ParentAdspendChart({ dailyData, loading }) {
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
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Ad Spend Allocation</h3>
                <div className="flex justify-center items-center h-80 text-gray-400">
                    No data available for the selected period
                </div>
            </div>
        );
    }

    // Prepare chart data
    const categories = dailyData.map(d => d.period);
    const facebookData = dailyData.map(d => (d.facebookSpend || 0).toFixed(2));
    const googleData = dailyData.map(d => (d.googleSpend || 0).toFixed(2));

    const chartSeries = [
        { name: 'Facebook Ads', data: facebookData },
        { name: 'Google Ads', data: googleData }
    ];

    const chartOptions = {
        chart: {
            id: 'parent-adspend',
            toolbar: { show: false },
            fontFamily: 'Outfit, sans-serif',
            zoom: { enabled: false }
        },
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
        xaxis: {
            categories,
            labels: {
                rotate: -45,
                style: { colors: '#406969' }
            },
            axisTicks: { show: true },
            axisBorder: { show: true }
        },
        yaxis: {
            title: { text: 'Ad Spend (DKK)', style: { color: '#1E2B2B' } },
            labels: {
                style: { colors: '#1E2B2B' },
                formatter: (val) => val !== undefined ? Number(val).toLocaleString() : val
            }
        },
        legend: {
            position: 'top',
            labels: { colors: '#1E2B2B' }
        },
        tooltip: {
            shared: true,
            theme: 'light',
            y: {
                formatter: (val) => `${Number(val).toLocaleString()} kr`
            }
        },
        dataLabels: { enabled: false },
        grid: { borderColor: '#e5e7eb', strokeDashArray: 0 }
    };

    return <GraphCard title="Ad Spend Allocation (Facebook & Google)" chartOptions={chartOptions} chartSeries={chartSeries} chartType="area" height={380} />;
}