
"use client"


import React from "react";
import { useParams } from "next/navigation";
import { useCustomers } from "@/hooks/useCustomers";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import MetricCard from "@/components/dashboard/MetricCard";
import { FiDollarSign, FiTrendingUp, FiShoppingCart, FiCreditCard, FiBarChart2, FiPieChart, FiShoppingBag, FiUserCheck } from "react-icons/fi";
import GraphCard from "@/components/dashboard/GraphCard";
// import { revenueData, spendAllocationData, roasData, aovData } from "@/data/dashboardCharts";
import { useEffect, useState } from "react";
import dayjs from "dayjs";
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

    // Handlers for DateRangePicker (controlled)
    const handleDateRangeApply = ({ startDate, endDate }) => {
        setDateRange({ startDate, endDate });
    };
    const handleStartDateChange = (newStart) => {
        setDateRange(dr => ({ ...dr, startDate: newStart }));
    };
    const handleEndDateChange = (newEnd) => {
        setDateRange(dr => ({ ...dr, endDate: newEnd }));
    };

    // Metrics state
    const [metrics, setMetrics] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Fetch merged data and prepare chart data
    const [shopifyDaily, setShopifyDaily] = useState([]);
    const [facebookDaily, setFacebookDaily] = useState([]);
    const [googleDaily, setGoogleDaily] = useState([]);
    useEffect(() => {
        if (!customer) return;
        setLoading(true);
        setError(null);
        (async () => {
            try {
                const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
                // Calculate previous period
                const start = dayjs(dateRange.startDate);
                const end = dayjs(dateRange.endDate);
                const days = end.diff(start, 'day') + 1;
                const prevEnd = start.subtract(1, 'day');
                const prevStart = prevEnd.subtract(days - 1, 'day');
                // Fetch current and previous period in parallel
                const [res, resPrev] = await Promise.all([
                    fetch(`${baseUrl}/api/merged-sources/${customer._id}?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`),
                    fetch(`${baseUrl}/api/merged-sources/${customer._id}?startDate=${prevStart.format('YYYY-MM-DD')}&endDate=${prevEnd.format('YYYY-MM-DD')}`)
                ]);
                if (!res.ok || !resPrev.ok) throw new Error('Failed to fetch merged data');
                const merged = await res.json();
                const mergedPrev = await resPrev.json();
                // Save daily arrays for charts
                setShopifyDaily(merged.shopifyDaily || []);
                setFacebookDaily(merged.facebookDaily || []);
                setGoogleDaily(merged.googleDaily || []);

                // Aggregate for metric cards (current)
                const shopify = merged.shopifyDaily || [];
                const facebook = merged.facebookDaily || [];
                const google = merged.googleDaily || [];
                const revenue = shopify.reduce((sum, d) => sum + (d.total_sales || 0), 0);
                const orders = shopify.reduce((sum, d) => sum + (d.orders || 0), 0);
                const cost = [...facebook, ...google].reduce((sum, d) => sum + (d.spend || 0), 0);
                const aov = orders > 0 ? revenue / orders : 0;
                const roas = cost > 0 ? revenue / cost : null;

                // Aggregate for metric cards (previous)
                const shopifyPrev = mergedPrev.shopifyDaily || [];
                const facebookPrev = mergedPrev.facebookDaily || [];
                const googlePrev = mergedPrev.googleDaily || [];
                const revenuePrev = shopifyPrev.reduce((sum, d) => sum + (d.total_sales || 0), 0);
                const ordersPrev = shopifyPrev.reduce((sum, d) => sum + (d.orders || 0), 0);
                const costPrev = [...facebookPrev, ...googlePrev].reduce((sum, d) => sum + (d.spend || 0), 0);
                const aovPrev = ordersPrev > 0 ? revenuePrev / ordersPrev : 0;
                const roasPrev = costPrev > 0 ? revenuePrev / costPrev : null;

                // % change helpers
                function percentChange(current, prev) {
                    if (prev === 0 || prev === null || prev === undefined) return null;
                    return ((current - prev) / Math.abs(prev)) * 100;
                }
                function changeType(val) {
                    if (val === null) return undefined;
                    return val > 0 ? "up" : val < 0 ? "down" : undefined;
                }

                // POAS and CAC are placeholders for now
                const poas = null, poasPrev = null;
                const cac = null, cacPrev = null;

                setMetrics([
                    {
                        label: "Revenue (inc vat)",
                        value: revenue ? revenue.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' }) : '-',
                        icon: <FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(revenue, revenuePrev) !== null ? Math.abs(percentChange(revenue, revenuePrev)).toFixed(1) : undefined,
                        changeType: changeType(percentChange(revenue, revenuePrev)),
                    },
                    {
                        label: "Orders",
                        value: orders !== null ? orders.toLocaleString() : '-',
                        icon: <FiShoppingCart className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(orders, ordersPrev) !== null ? Math.abs(percentChange(orders, ordersPrev)).toFixed(1) : undefined,
                        changeType: changeType(percentChange(orders, ordersPrev)),
                    },
                    {
                        label: "Cost (Adspend)",
                        value: cost ? cost.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' }) : '-',
                        icon: <FiCreditCard className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(cost, costPrev) !== null ? Math.abs(percentChange(cost, costPrev)).toFixed(1) : undefined,
                        changeType: changeType(percentChange(cost, costPrev)),
                    },
                    {
                        label: "ROAS (inc vat)",
                        value: roas !== null ? roas.toFixed(2) : '-',
                        icon: <FiBarChart2 className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(roas, roasPrev) !== null ? Math.abs(percentChange(roas, roasPrev)).toFixed(1) : undefined,
                        changeType: changeType(percentChange(roas, roasPrev)),
                    },
                    {
                        label: "POAS (inc vat)",
                        value: poas !== null ? poas.toFixed(2) : '-',
                        icon: <FiPieChart className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: undefined,
                        changeType: undefined,
                    },
                    {
                        label: "AOV",
                        value: aov !== null ? aov.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' }) : '-',
                        icon: <FiShoppingBag className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(aov, aovPrev) !== null ? Math.abs(percentChange(aov, aovPrev)).toFixed(1) : undefined,
                        changeType: changeType(percentChange(aov, aovPrev)),
                    },
                    {
                        label: "CAC",
                        value: cac !== null ? cac.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' }) : '-',
                        icon: <FiUserCheck className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: undefined,
                        changeType: undefined,
                    },
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

    // Prepare chart data from real daily arrays
    // Revenue chart
    const revenueCategories = shopifyDaily.map(d => d.period);
    const revenueSeries = [{ name: 'Revenue', data: shopifyDaily.map(d => Number(d.total_sales).toFixed(2)) }];
    const revenueOptions = {
        chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: 'Outfit, sans-serif' },
        xaxis: { categories: revenueCategories, labels: { style: { colors: chartColors.primaryLighter || '#406969' } }, axisTicks: { show: true }, axisBorder: { show: true } },
        yaxis: { labels: { style: { colors: chartColors.primary || '#1E2B2B' } } },
        colors: [chartColors.lime || '#C6ED62'],
        stroke: { width: 2, curve: 'smooth' },
        fill: { type: 'solid', opacity: 1 },
        grid: { borderColor: '#e5e7eb', strokeDashArray: 0, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
        dataLabels: { enabled: false },
        tooltip: { theme: 'light' },
    };

    // Spend Allocation chart
    const spendCategories = shopifyDaily.map(d => d.period); // Use same x-axis as revenue
    // Align facebook and google spend by date
    const facebookSpendMap = Object.fromEntries(facebookDaily.map(d => [d.period, d.spend]));
    const googleSpendMap = Object.fromEntries(googleDaily.map(d => [d.period, d.spend]));
    const facebookSpendSeries = spendCategories.map(date => (facebookSpendMap[date] ? Number(facebookSpendMap[date]).toFixed(2) : '0.00'));
    const googleSpendSeries = spendCategories.map(date => (googleSpendMap[date] ? Number(googleSpendMap[date]).toFixed(2) : '0.00'));
    const spendAllocationSeries = [
        { name: 'Facebook', data: facebookSpendSeries },
        { name: 'Google', data: googleSpendSeries },
    ];
    const spendOptions = {
        chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: 'Outfit, sans-serif' },
        xaxis: { categories: spendCategories, labels: { style: { colors: chartColors.primaryLighter || '#406969' } }, axisTicks: { show: true }, axisBorder: { show: true } },
        yaxis: { labels: { style: { colors: chartColors.primary || '#1E2B2B' } } },
        colors: [chartColors.primaryLighter || '#406969', chartColors.lime || '#C6ED62'],
        stroke: { width: 2, curve: 'smooth' },
        fill: { type: 'solid', opacity: 1 },
        grid: { borderColor: '#e5e7eb', strokeDashArray: 0, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
        dataLabels: { enabled: false },
        tooltip: { theme: 'light' },
        legend: { show: true, position: 'top', labels: { colors: chartColors.primary || '#1E2B2B' } },
    };

    // ROAS chart
    const roasCategories = shopifyDaily.map(d => d.period);
    const roasSeries = [{
        name: 'ROAS',
        data: shopifyDaily.map((d, i) => {
            const spend = (Number(facebookSpendMap[d.period]) || 0) + (Number(googleSpendMap[d.period]) || 0);
            return spend > 0 ? (d.total_sales / spend).toFixed(2) : null;
        })
    }];
    const roasOptions = {
        chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: 'Outfit, sans-serif' },
        xaxis: { categories: roasCategories, labels: { style: { colors: chartColors.primaryLighter || '#406969' } }, axisTicks: { show: true }, axisBorder: { show: true } },
        yaxis: { labels: { style: { colors: chartColors.primary || '#1E2B2B' } } },
        colors: [chartColors.green || '#213834'],
        stroke: { width: 2, curve: 'smooth' },
        fill: { type: 'solid', opacity: 1 },
        grid: { borderColor: '#e5e7eb', strokeDashArray: 0, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
        dataLabels: { enabled: false },
        tooltip: { theme: 'light' },
    };

    // AOV chart
    const aovCategories = shopifyDaily.map(d => d.period);
    const aovSeries = [{
        name: 'AOV',
        data: shopifyDaily.map(d => d.orders > 0 ? (d.total_sales / d.orders).toFixed(2) : null)
    }];
    const aovOptions = {
        chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: 'Outfit, sans-serif' },
        xaxis: { categories: aovCategories, labels: { style: { colors: chartColors.primaryLighter || '#406969' } }, axisTicks: { show: true }, axisBorder: { show: true } },
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
                right={
                    <DateRangePicker
                        onApply={handleDateRangeApply}
                        startDate={dateRange.startDate}
                        endDate={dateRange.endDate}
                        onStartDateChange={handleStartDateChange}
                        onEndDateChange={handleEndDateChange}
                    />
                }
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
                {/* Revenue Graph */}
                {loading && (!shopifyDaily.length) ? (
                    <div className="flex items-center justify-center h-64"><Spinner size={40} color="#406969" /></div>
                ) : (
                    <GraphCard title="Revenue (inc VAT)" chartOptions={revenueOptions} chartSeries={revenueSeries} />
                )}

                {/* Spend Allocation Graph */}
                {loading && (!facebookDaily.length && !googleDaily.length) ? (
                    <div className="flex items-center justify-center h-64"><Spinner size={40} color="#406969" /></div>
                ) : (
                    <GraphCard title="Spend Allocation" chartOptions={spendOptions} chartSeries={spendAllocationSeries} />
                )}

                {/* ROAS Graph */}
                {loading && (!shopifyDaily.length) ? (
                    <div className="flex items-center justify-center h-64"><Spinner size={40} color="#406969" /></div>
                ) : (
                    <GraphCard title="ROAS" chartOptions={roasOptions} chartSeries={roasSeries} />
                )}

                {/* AOV Graph */}
                {loading && (!shopifyDaily.length) ? (
                    <div className="flex items-center justify-center h-64"><Spinner size={40} color="#406969" /></div>
                ) : (
                    <GraphCard title="Average Order Value" chartOptions={aovOptions} chartSeries={aovSeries} />
                )}
            </div>
        </div>
    );
}