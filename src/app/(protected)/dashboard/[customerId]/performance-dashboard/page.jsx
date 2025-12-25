
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
import Spinner from "@/components/ui/Spinner";

export default function PerformanceDashboard() {
    const params = useParams();
    const { customers } = useCustomers();
    const customer = customers.find(c => c._id === params.customerId);

    // Date range state
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const defaultEnd = `${yyyy}-${mm}-${dd}`;
    const defaultStart = `${yyyy}-${mm}-01`;
    const [dateRange, setDateRange] = useState({ startDate: defaultStart, endDate: defaultEnd });

    // Metrics state
    const [metrics, setMetrics] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Fetch merged data
    useEffect(() => {
        if (!customer) return;
        setLoading(true);
        setError(null);
        (async () => {
            try {
                const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
                const res = await fetch(`${baseUrl}/api/merged-sources/${customer._id}?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`);
                if (!res.ok) throw new Error('Failed to fetch merged data');

                const merged = await res.json();
                console.log({merged})
                const shopify = merged.shopify && merged.shopify[0] ? merged.shopify[0] : {};
                const revenue = shopify.total_sales ? parseFloat(shopify.total_sales) : 0;
                const orders = shopify.orders ? parseInt(shopify.orders) : null; // If available
                const aov = shopify.total_sales / (shopify.orders || 1); // Fallback if orders is null
                const cost = (merged.facebookAdspend || 0) + (merged.googleAdspend || 0);
                const roas = cost > 0 ? revenue / cost : null;
                // POAS and CAC are placeholders for now
                const poas = null;
                const cac = null;
                setMetrics([
                    { label: "Revenue (inc vat)", value: revenue ? revenue.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' }) : '-', icon: <FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" /> },
                    { label: "Orders", value: orders !== null ? orders.toLocaleString() : '-', icon: <FiShoppingCart className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" /> },
                    { label: "Cost (Adspend)", value: cost ? cost.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' }) : '-', icon: <FiCreditCard className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" /> },
                    { label: "ROAS (inc vat)", value: roas !== null ? roas.toFixed(2) : '-', icon: <FiBarChart2 className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" /> },
                    { label: "POAS (inc vat)", value: poas !== null ? poas.toFixed(2) : '-', icon: <FiPieChart className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" /> },
                    { label: "AOV", value: aov !== null ? aov.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' }) : '-', icon: <FiShoppingBag className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" /> },
                    { label: "CAC", value: cac !== null ? cac.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' }) : '-', icon: <FiUserCheck className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" /> },
                ]);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        })();
    }, [customer, dateRange]);

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
                {loading ? (
                    <div className="col-span-4 text-center"><Spinner size={40} color="#406969" /></div>
                ) : error ? (
                    <div className="col-span-4 text-center text-red-500">{error}</div>
                ) : (
                    metrics.map((metric, idx) => (
                        <MetricCard key={idx} {...metric} />
                    ))
                )}
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