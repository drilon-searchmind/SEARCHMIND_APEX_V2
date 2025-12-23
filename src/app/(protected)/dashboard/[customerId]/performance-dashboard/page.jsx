
"use client"


import React from "react";
import { useParams } from "next/navigation";
import { useCustomers } from "@/hooks/useCustomers";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import MetricCard from "@/components/dashboard/MetricCard";
import { FiDollarSign, FiTrendingUp, FiShoppingCart, FiCreditCard, FiBarChart2, FiPieChart, FiShoppingBag, FiUserCheck } from "react-icons/fi";
import GraphCard from "@/components/dashboard/GraphCard";
import { revenueData, spendAllocationData, roasData, aovData } from "@/data/dashboardCharts";
import { useEffect, useState } from "react";
import { getChartColors } from "@/components/dashboard/chartColors";

export default function PerformanceDashboard() {
    const params = useParams();
    const { customers } = useCustomers();
    const customer = customers.find(c => c._id === params.customerId);

    // Dummy data for now
    const metrics = [
        { label: "Revenue (inc vat)", value: "$20,000", change: 10, changeType: "up", icon: <FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" /> },
        { label: "Gross Profit", value: "$8,000", change: 5, changeType: "up", icon: <FiTrendingUp className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" /> },
        { label: "Orders", value: "1,200", change: -2, changeType: "down", icon: <FiShoppingCart className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" /> },
        { label: "Cost (Adspend)", value: "$5,000", change: 3, changeType: "up", icon: <FiCreditCard className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" /> },
        { label: "ROAS (inc vat)", value: "4.0", change: 1, changeType: "up", icon: <FiBarChart2 className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" /> },
        { label: "POAS (inc vat)", value: "1.6", change: 0, changeType: undefined, icon: <FiPieChart className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" /> },
        { label: "AOV", value: "$16.67", change: 0, changeType: undefined, icon: <FiShoppingBag className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" /> },
        { label: "CAC", value: "$4.17", change: -1, changeType: "down", icon: <FiUserCheck className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" /> },
    ];

    // Chart color palette from CSS variables
    const [chartColors, setChartColors] = useState({});
    useEffect(() => {
        setChartColors(getChartColors());
    }, []);

    // Chart options for each graph
    // No fill/gradient for now
    const noFill = { type: 'solid', opacity: 0 };

    const revenueOptions = {
        chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: 'Outfit, sans-serif' },
        xaxis: { categories: revenueData.categories, labels: { style: { colors: chartColors.primaryLighter || '#406969' } }, axisTicks: { show: true }, axisBorder: { show: true } },
        yaxis: { labels: { style: { colors: chartColors.primary || '#1E2B2B' } } },
        colors: [chartColors.lime || '#C6ED62'],
        stroke: { width: 2, curve: 'smooth' },
        fill: { type: 'solid', opacity: 1 },
        grid: { borderColor: '#e5e7eb', strokeDashArray: 0, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
        dataLabels: { enabled: false },
        tooltip: { theme: 'light' },
    };
    const spendOptions = {
        chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: 'Outfit, sans-serif' },
        xaxis: { categories: spendAllocationData.categories, labels: { style: { colors: chartColors.primaryLighter || '#406969' } }, axisTicks: { show: true }, axisBorder: { show: true } },
        yaxis: { labels: { style: { colors: chartColors.primary || '#1E2B2B' } } },
        colors: [chartColors.primaryLighter || '#406969', chartColors.lime || '#C6ED62'],
        stroke: { width: 2, curve: 'smooth' },
        fill: { type: 'solid', opacity: 1 },
        grid: { borderColor: '#e5e7eb', strokeDashArray: 0, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
        dataLabels: { enabled: false },
        tooltip: { theme: 'light' },
        legend: { show: true, position: 'top', labels: { colors: chartColors.primary || '#1E2B2B' } },
    };
    const roasOptions = {
        chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: 'Outfit, sans-serif' },
        xaxis: { categories: roasData.categories, labels: { style: { colors: chartColors.primaryLighter || '#406969' } }, axisTicks: { show: true }, axisBorder: { show: true } },
        yaxis: { labels: { style: { colors: chartColors.primary || '#1E2B2B' } } },
        colors: [chartColors.green || '#213834'],
        stroke: { width: 2, curve: 'smooth' },
        fill: { type: 'solid', opacity: 1 },
        grid: { borderColor: '#e5e7eb', strokeDashArray: 0, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
        dataLabels: { enabled: false },
        tooltip: { theme: 'light' },
    };
    const aovOptions = {
        chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: 'Outfit, sans-serif' },
        xaxis: { categories: aovData.categories, labels: { style: { colors: chartColors.primaryLighter || '#406969' } }, axisTicks: { show: true }, axisBorder: { show: true } },
        yaxis: { labels: { style: { colors: chartColors.primary || '#1E2B2B' } } },
        colors: [chartColors.secondary || '#D6CDB6'],
        stroke: { width: 2, curve: 'smooth' },
        fill: { type: 'solid', opacity: 1 },
        grid: { borderColor: '#e5e7eb', strokeDashArray: 0, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
        dataLabels: { enabled: false },
        tooltip: { theme: 'light' },
    };

    return (
        <div className="w-full">
            {/* Top Card */}
            <DashboardHeading
                title="Performance Dashboard"
                label={customer ? customer.customerName : ""}
                right={<DateRangePicker />}
            />

            {/* Metrics Cards Section */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 w-full mb-8">
                {metrics.map((metric, idx) => (
                    <MetricCard key={idx} {...metric} />
                ))}
            </div>

            {/* Graphs Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                <GraphCard title="Revenue (inc VAT)" chartOptions={revenueOptions} chartSeries={revenueData.series} />
                <GraphCard title="Spend Allocation" chartOptions={spendOptions} chartSeries={spendAllocationData.series} />
                <GraphCard title="ROAS" chartOptions={roasOptions} chartSeries={roasData.series} />
                <GraphCard title="Average Order Value" chartOptions={aovOptions} chartSeries={aovData.series} />
            </div>
        </div>
    );
}