"use client";

import React from 'react';
import dynamic from 'next/dynamic';
import GraphCard from '@/components/dashboard/GraphCard';

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

export default function ParentRevenueOrdersChart({ dailyData, loading }) {
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
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue & Orders Over Time</h3>
                <div className="flex justify-center items-center h-80 text-gray-400">
                    No data available for the selected period
                </div>
            </div>
        );
    }

    // Prepare chart data
    const categories = dailyData.map(d => d.period);
    const revenueData = dailyData.map(d => (d.revenue || 0).toFixed(2));
    const ordersData = dailyData.map(d => d.orders || 0);

    const chartSeries = [
        { name: 'Revenue (DKK)', data: revenueData },
        { name: 'Orders', data: ordersData }
    ];

    const chartOptions = {
        chart: {
            id: 'parent-revenue-orders',
            toolbar: { show: false },
            fontFamily: 'Outfit, sans-serif',
            zoom: { enabled: false }
        },
        stroke: { curve: 'smooth', width: 2 },
        colors: ['#C6ED62', '#406969'],
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
        yaxis: [
            {
                title: { text: 'Revenue (DKK)', style: { color: '#C6ED62' } },
                labels: {
                    style: { colors: '#1E2B2B' },
                    formatter: (val) => val !== undefined ? Number(val).toLocaleString() : val
                }
            },
            {
                opposite: true,
                title: { text: 'Orders', style: { color: '#406969' } },
                labels: {
                    style: { colors: '#1E2B2B' },
                    formatter: (val) => val !== undefined ? Number(val).toLocaleString() : val
                }
            }
        ],
        legend: {
            position: 'top',
            labels: { colors: '#1E2B2B' }
        },
        tooltip: {
            shared: true,
            intersect: false,
            theme: 'light',
            y: {
                formatter: (val, { seriesIndex }) => {
                    if (seriesIndex === 0) return `${Number(val).toLocaleString()} kr`;
                    return Number(val).toLocaleString();
                }
            }
        },
        dataLabels: { enabled: false },
        grid: { borderColor: '#e5e7eb', strokeDashArray: 0 }
    };

    return <GraphCard title="Revenue & Orders Over Time" chartOptions={chartOptions} chartSeries={chartSeries} chartType="area" height={380} />;
}