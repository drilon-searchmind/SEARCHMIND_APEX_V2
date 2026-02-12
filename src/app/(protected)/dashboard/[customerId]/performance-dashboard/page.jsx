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

    // If today is the 1st of the month, use 1st as both start and end
    // Otherwise, use 1st as start and yesterday as end
    const isFirstOfMonth = today.getDate() === 1;
    const defaultStart = `${yyyy}-${mm}-01`;
    const defaultEnd = isFirstOfMonth ? `${yyyy}-${mm}-01` : `${yyyy}-${mm}-${String(today.getDate() - 1).padStart(2, '0')}`;
    
    // Separate temp (input) and applied (fetch-triggered) date ranges
    const [tempDateRange, setTempDateRange] = useState({ startDate: defaultStart, endDate: defaultEnd });
    const [appliedDateRange, setAppliedDateRange] = useState({ startDate: defaultStart, endDate: defaultEnd });

    // Handlers for DateRangePicker (controlled)
    const handleDateRangeApply = ({ startDate, endDate }) => {
        setAppliedDateRange({ startDate, endDate });
    };
    const handleStartDateChange = (newStart) => {
        setTempDateRange(dr => ({ ...dr, startDate: newStart }));
    };
    const handleEndDateChange = (newEnd) => {
        setTempDateRange(dr => ({ ...dr, endDate: newEnd }));
    };

    // Comparison method state
    const [comparisonMethod, setComparisonMethod] = useState("Last Period");

    // Metrics state
    const [metrics, setMetrics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fetch merged data and prepare chart data
    const [shopifyDaily, setShopifyDaily] = useState([]);
    const [facebookDaily, setFacebookDaily] = useState([]);
    const [googleDaily, setGoogleDaily] = useState([]);
    // Previous period data for comparison
    const [shopifyDailyPrev, setShopifyDailyPrev] = useState([]);
    const [facebookDailyPrev, setFacebookDailyPrev] = useState([]);
    const [googleDailyPrev, setGoogleDailyPrev] = useState([]);
    useEffect(() => {
        if (!customer) return;
        setLoading(true);
        setError(null);
        (async () => {
            try {
                const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
                // Calculate previous period based on comparisonMethod
                const start = dayjs(appliedDateRange.startDate);
                const end = dayjs(appliedDateRange.endDate);
                const days = end.diff(start, 'day') + 1;

                let prevStart, prevEnd;
                if (comparisonMethod === "Last Year") {
                    // Same period last year
                    prevStart = start.subtract(1, 'year');
                    prevEnd = end.subtract(1, 'year');
                } else {
                    // Last Period (previous contiguous period of same length)
                    prevEnd = start.subtract(1, 'day');
                    prevStart = prevEnd.subtract(days - 1, 'day');
                }

                const [res, resPrev] = await Promise.all([
                    fetch(`${baseUrl}/api/merged-sources/${customer._id}?startDate=${appliedDateRange.startDate}&endDate=${appliedDateRange.endDate}`),
                    fetch(`${baseUrl}/api/merged-sources/${customer._id}?startDate=${prevStart.format('YYYY-MM-DD')}&endDate=${prevEnd.format('YYYY-MM-DD')}`)
                ]);
                if (!res.ok || !resPrev.ok) throw new Error('Failed to fetch merged data');
                const merged = await res.json();
                const mergedPrev = await resPrev.json();
                // Save daily arrays for charts
                setShopifyDaily(merged.shopifyDaily || []);
                setFacebookDaily(merged.facebookDaily || []);
                setGoogleDaily(merged.googleDaily || []);

                console.log("::: MERGED DATA :::");
                console.log({ merged });

                // Save previous period data for comparison
                setShopifyDailyPrev(mergedPrev.shopifyDaily || []);
                setFacebookDailyPrev(mergedPrev.facebookDaily || []);
                setGoogleDailyPrev(mergedPrev.googleDaily || []);

                // Revenue type logic
                const revenueType = customer?.CustomerSettings?.customerRevenueType || 'total_sales';
                const customerMetricPreference = customer?.CustomerSettings?.metricPreference || 'ROAS/POAS';
                console.log("::: REVENUE TYPE :::");
                console.log({ revenueType });

                // Aggregate for metric cards (current)
                const shopify = merged.shopifyDaily || [];
                const facebook = merged.facebookDaily || [];
                const google = merged.googleDaily || [];
                const revenue = shopify.reduce((sum, d) => sum + (d[revenueType] || 0), 0);
                const orders = shopify.reduce((sum, d) => sum + (d.orders || 0), 0);
                const cost = [...facebook, ...google].reduce((sum, d) => sum + (d.spend || 0), 0);
                const aov = orders > 0 ? revenue / orders : 0;
                const roas = cost > 0 ? revenue / cost : null;
                const spendshare = cost / revenue;
                
                // Calculate Gross Profit: use fetched COGS if enabled, otherwise use merged value
                const fetchCogs = customer?.CustomerSettings?.fetchCogsFromStore === true;
                let gross_profit_total_sales = 0;
                if (fetchCogs) {
                    // Calculate COGS from fetched cost_of_goods_sold and use Revenue - COGS formula
                    const totalCogs = shopify.reduce((sum, d) => sum + (d.cost_of_goods_sold || 0), 0);
                    gross_profit_total_sales = revenue - totalCogs;
                } else {
                    // Use the value from merged (calculated using percentage)
                    gross_profit_total_sales = merged.grossProfitTotalSales || 0;
                }

                // Aggregate for metric cards (previous)
                const shopifyPrev = mergedPrev.shopifyDaily || [];
                const facebookPrev = mergedPrev.facebookDaily || [];
                const googlePrev = mergedPrev.googleDaily || [];
                const revenuePrev = shopifyPrev.reduce((sum, d) => sum + (d[revenueType] || 0), 0);
                const ordersPrev = shopifyPrev.reduce((sum, d) => sum + (d.orders || 0), 0);
                const costPrev = [...facebookPrev, ...googlePrev].reduce((sum, d) => sum + (d.spend || 0), 0);
                const aovPrev = ordersPrev > 0 ? revenuePrev / ordersPrev : 0;
                const roasPrev = costPrev > 0 ? revenuePrev / costPrev : null;
                const spendsharePrev = costPrev / revenuePrev;
                const gross_profit_total_salesPrev = mergedPrev.grossProfitTotalSales || 0; 

                // Calculations
                const grossProfitCalculation = merged.calculationsData?.grossProfitCalculation || '';
                const totalAdspendCalculation = merged.calculationsData?.totalAdspendCalculation || '';
                const roasCalculation = `Revenue / Cost \n
                    = ${revenue.toFixed(2)} / ${cost.toFixed(2)} \n
                    = ${roas !== null ? roas.toFixed(2) : 'N/A'}
                `;
                const poasCalculation = merged.calculationsData?.poasCalculation || '';
                const cacCalculation = merged.calculationsData?.cacCalculation || '';

                // % change helpers
                function percentChange(current, prev) {
                    if (prev === 0 || prev === null || prev === undefined) return null;
                    return ((current - prev) / Math.abs(prev)) * 100;
                }
                function changeType(val) {
                    if (val === null) return undefined;
                    return val > 0 ? "up" : val < 0 ? "down" : undefined;
                }

                // POAS and CAC
                const poas = merged.POASTotalSales ?? null;
                const poasPrev = mergedPrev.POASTotalSales ?? null;
                const cac = merged.CACTotalSales ?? null;
                const cacPrev = mergedPrev.CACTotalSales ?? null;

                // Build metrics array conditionally
                const metricsArray = [
                    {
                        label: `Revenue (${revenueType === 'net_sales' ? ', net sales' : 'total sales'})`,
                        value: revenue ? revenue.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' }) : '-',
                        icon: <FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(revenue, revenuePrev) !== null ? Math.abs(percentChange(revenue, revenuePrev)).toFixed(1) : undefined,
                        changeType: changeType(percentChange(revenue, revenuePrev)),
                        tooltip: revenueType === 'net_sales' ? 'Net sales (after discounts, returns, etc.)' : undefined,
                        popOverContent: null,
                    },
                    {
                        label: "Gross Profit (inc vat)",
                        value: gross_profit_total_sales ? gross_profit_total_sales.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' }) : '-',
                        icon: <FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(gross_profit_total_sales, gross_profit_total_salesPrev) !== null ? Math.abs(percentChange(gross_profit_total_sales, gross_profit_total_salesPrev)).toFixed(1) : undefined,
                        changeType: changeType(percentChange(gross_profit_total_sales, gross_profit_total_salesPrev)),
                        popOverContent: grossProfitCalculation,
                    },
                    {
                        label: "Orders",
                        value: orders !== null ? orders.toLocaleString() : '-',
                        icon: <FiShoppingCart className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(orders, ordersPrev) !== null ? Math.abs(percentChange(orders, ordersPrev)).toFixed(1) : undefined,
                        changeType: changeType(percentChange(orders, ordersPrev)),
                        popOverContent: null,
                    },
                    {
                        label: "Cost (Adspend)",
                        value: cost ? cost.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' }) : '-',
                        icon: <FiCreditCard className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(cost, costPrev) !== null ? Math.abs(percentChange(cost, costPrev)).toFixed(1) : undefined,
                        changeType: changeType(percentChange(cost, costPrev)),
                        popOverContent: totalAdspendCalculation,
                    },
                ];

                // Conditionally add ROAS or Spendshare based on preference
                if (customerMetricPreference === 'Spendshare') {
                    metricsArray.push({
                        label: "Spendshare",
                        value: spendshare !== null && !isNaN(spendshare) ? `${(spendshare * 100).toFixed(2)}%` : '-',
                        icon: <FiBarChart2 className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(spendshare, spendsharePrev) !== null ? Math.abs(percentChange(spendshare, spendsharePrev)).toFixed(1) : undefined,
                        changeType: changeType(percentChange(spendshare, spendsharePrev)),
                        popOverContent: null,
                    });
                } else {
                    // Default to ROAS/POAS
                    metricsArray.push({
                        label: "ROAS",
                        value: roas !== null ? roas.toFixed(2) : '-',
                        icon: <FiBarChart2 className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(roas, roasPrev) !== null ? Math.abs(percentChange(roas, roasPrev)).toFixed(1) : undefined,
                        changeType: changeType(percentChange(roas, roasPrev)),
                        popOverContent: roasCalculation,
                    });
                }

                // Add remaining metrics
                metricsArray.push(
                    {
                        label: "POAS",
                        value: poas !== null ? poas.toFixed(2) : '-',
                        icon: <FiPieChart className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(poas, poasPrev) !== null ? Math.abs(percentChange(poas, poasPrev)).toFixed(1) : undefined,
                        changeType: changeType(percentChange(poas, poasPrev)),
                        popOverContent: poasCalculation,
                    },
                    {
                        label: "AOV",
                        value: aov !== null ? aov.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' }) : '-',
                        icon: <FiShoppingBag className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(aov, aovPrev) !== null ? Math.abs(percentChange(aov, aovPrev)).toFixed(1) : undefined,
                        changeType: changeType(percentChange(aov, aovPrev)),
                        popOverContent: null,
                    },
                    {
                        label: "CAC",
                        value: cac !== null ? cac.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' }) : '-',
                        icon: <FiUserCheck className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(cac, cacPrev) !== null ? Math.abs(percentChange(cac, cacPrev)).toFixed(1) : undefined,
                        changeType: changeType(percentChange(cac, cacPrev)),
                        popOverContent: cacCalculation,
                    },
                );

                setMetrics(metricsArray);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        })();
    }, [customer, appliedDateRange, comparisonMethod]);

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
    const revenueSeries = [
        { name: 'Revenue (Current)', data: shopifyDaily.map(d => Number(d.total_sales).toFixed(2)) },
        { name: `Revenue (${comparisonMethod})`, data: shopifyDailyPrev.map(d => Number(d.total_sales).toFixed(2)) }
    ];
    const revenueOptions = {
        chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: 'Outfit, sans-serif' },
        xaxis: { categories: revenueCategories, labels: { style: { colors: chartColors.primaryLighter || '#406969' } }, axisTicks: { show: true }, axisBorder: { show: true } },
        yaxis: { labels: { style: { colors: chartColors.primary || '#1E2B2B' } } },
        colors: [chartColors.lime || '#C6ED62', '#94a3b8'],
        stroke: { width: [2, 1], curve: 'smooth', dashArray: [0, 5] },
        fill: { type: 'solid', opacity: [1, 0.5] },
        grid: { borderColor: '#e5e7eb', strokeDashArray: 0, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
        dataLabels: { enabled: false },
        tooltip: { theme: 'light' },
        legend: { show: true, position: 'top', labels: { colors: chartColors.primary || '#1E2B2B' } },
    };

    // Spend Allocation chart
    const spendCategories = shopifyDaily.map(d => d.period); // Use same x-axis as revenue
    // Align facebook and google spend by date (current)
    const facebookSpendMap = Object.fromEntries(facebookDaily.map(d => [d.period, d.spend]));
    const googleSpendMap = Object.fromEntries(googleDaily.map(d => [d.period, d.spend]));
    const facebookSpendSeries = spendCategories.map(date => (facebookSpendMap[date] ? Number(facebookSpendMap[date]).toFixed(2) : '0.00'));
    const googleSpendSeries = spendCategories.map(date => (googleSpendMap[date] ? Number(googleSpendMap[date]).toFixed(2) : '0.00'));

    // Align facebook and google spend by date (previous)
    const facebookSpendMapPrev = Object.fromEntries(facebookDailyPrev.map(d => [d.period, d.spend]));
    const googleSpendMapPrev = Object.fromEntries(googleDailyPrev.map(d => [d.period, d.spend]));

    // Map current period dates to corresponding previous period dates
    const facebookSpendSeriesPrev = spendCategories.map(date => {
        let prevDate;
        if (comparisonMethod === "Last Year") {
            // Same date last year
            const currentDate = dayjs(date);
            prevDate = currentDate.subtract(1, 'year').format('YYYY-MM-DD');
        } else {
            // Last Period - same date in previous contiguous period
            const currentDate = dayjs(date);
            const periodStart = dayjs(appliedDateRange.startDate);
            const periodEnd = dayjs(appliedDateRange.endDate);
            const daysDiff = currentDate.diff(periodStart, 'day');
            const prevPeriodStart = periodStart.subtract(periodEnd.diff(periodStart, 'day') + 1, 'day');
            prevDate = prevPeriodStart.add(daysDiff, 'day').format('YYYY-MM-DD');
        }
        return facebookSpendMapPrev[prevDate] ? Number(facebookSpendMapPrev[prevDate]).toFixed(2) : '0.00';
    });

    const googleSpendSeriesPrev = spendCategories.map(date => {
        let prevDate;
        if (comparisonMethod === "Last Year") {
            // Same date last year
            const currentDate = dayjs(date);
            prevDate = currentDate.subtract(1, 'year').format('YYYY-MM-DD');
        } else {
            // Last Period - same date in previous contiguous period
            const currentDate = dayjs(date);
            const periodStart = dayjs(appliedDateRange.startDate);
            const periodEnd = dayjs(appliedDateRange.endDate);
            const daysDiff = currentDate.diff(periodStart, 'day');
            const prevPeriodStart = periodStart.subtract(periodEnd.diff(periodStart, 'day') + 1, 'day');
            prevDate = prevPeriodStart.add(daysDiff, 'day').format('YYYY-MM-DD');
        }
        return googleSpendMapPrev[prevDate] ? Number(googleSpendMapPrev[prevDate]).toFixed(2) : '0.00';
    });

    const spendAllocationSeries = [
        { name: 'Facebook (Current)', data: facebookSpendSeries },
        { name: 'Google (Current)', data: googleSpendSeries },
        { name: `Facebook (${comparisonMethod})`, data: facebookSpendSeriesPrev },
        { name: `Google (${comparisonMethod})`, data: googleSpendSeriesPrev },
    ];
    const spendOptions = {
        chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: 'Outfit, sans-serif' },
        xaxis: { categories: spendCategories, labels: { style: { colors: chartColors.primaryLighter || '#406969' } }, axisTicks: { show: true }, axisBorder: { show: true } },
        yaxis: { labels: { style: { colors: chartColors.primary || '#1E2B2B' } } },
        colors: [
            chartColors.primaryLighter || '#406969',  // Facebook Current
            chartColors.lime || '#C6ED62',            // Google Current
            '#94a3b8',                                // Facebook Previous (muted)
            '#cbd5e1'                                 // Google Previous (muted)
        ],
        stroke: { width: [2, 2, 1, 1], curve: 'smooth', dashArray: [0, 0, 5, 5] },
        fill: { type: 'solid', opacity: [1, 1, 0.5, 0.5] },
        grid: { borderColor: '#e5e7eb', strokeDashArray: 0, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
        dataLabels: { enabled: false },
        tooltip: { theme: 'light' },
        legend: { show: true, position: 'top', labels: { colors: chartColors.primary || '#1E2B2B' } },
    };

    // Determine metric preference
    const customerMetricPreference = customer?.CustomerSettings?.metricPreference || 'ROAS/POAS';

    // ROAS or Spendshare chart (conditional)
    const metricCategories = shopifyDaily.map(d => d.period);
    let metricSeries, metricOptions, metricTitle;

    if (customerMetricPreference === 'Spendshare') {
        // Spendshare chart
        metricSeries = [
            {
                name: 'Spendshare (Current)',
                data: shopifyDaily.map((d, i) => {
                    const spend = (Number(facebookSpendMap[d.period]) || 0) + (Number(googleSpendMap[d.period]) || 0);
                    return d.total_sales > 0 ? ((spend / d.total_sales) * 100).toFixed(2) : null;
                })
            },
            {
                name: `Spendshare (${comparisonMethod})`,
                data: shopifyDaily.map((d, i) => {
                    let prevDate;
                    if (comparisonMethod === "Last Year") {
                        const currentDate = dayjs(d.period);
                        prevDate = currentDate.subtract(1, 'year').format('YYYY-MM-DD');
                    } else {
                        const currentDate = dayjs(d.period);
                        const periodStart = dayjs(appliedDateRange.startDate);
                        const periodEnd = dayjs(appliedDateRange.endDate);
                        const daysDiff = currentDate.diff(periodStart, 'day');
                        const prevPeriodStart = periodStart.subtract(periodEnd.diff(periodStart, 'day') + 1, 'day');
                        prevDate = prevPeriodStart.add(daysDiff, 'day').format('YYYY-MM-DD');
                    }

                    // Find corresponding previous period data
                    const prevShopifyData = shopifyDailyPrev.find(pd => pd.period === prevDate);
                    const prevSpend = (Number(facebookSpendMapPrev[prevDate]) || 0) + (Number(googleSpendMapPrev[prevDate]) || 0);

                    return prevShopifyData && prevShopifyData.total_sales > 0 ? ((prevSpend / prevShopifyData.total_sales) * 100).toFixed(2) : null;
                })
            }
        ];
        metricTitle = 'Spendshare (%)';
    } else {
        // ROAS chart (default)
        metricSeries = [
            {
                name: 'ROAS (Current)',
                data: shopifyDaily.map((d, i) => {
                    const spend = (Number(facebookSpendMap[d.period]) || 0) + (Number(googleSpendMap[d.period]) || 0);
                    return spend > 0 ? (d.total_sales / spend).toFixed(2) : null;
                })
            },
            {
                name: `ROAS (${comparisonMethod})`,
                data: shopifyDaily.map((d, i) => {
                    let prevDate;
                    if (comparisonMethod === "Last Year") {
                        const currentDate = dayjs(d.period);
                        prevDate = currentDate.subtract(1, 'year').format('YYYY-MM-DD');
                    } else {
                        const currentDate = dayjs(d.period);
                        const periodStart = dayjs(appliedDateRange.startDate);
                        const periodEnd = dayjs(appliedDateRange.endDate);
                        const daysDiff = currentDate.diff(periodStart, 'day');
                        const prevPeriodStart = periodStart.subtract(periodEnd.diff(periodStart, 'day') + 1, 'day');
                        prevDate = prevPeriodStart.add(daysDiff, 'day').format('YYYY-MM-DD');
                    }

                    // Find corresponding previous period data
                    const prevShopifyData = shopifyDailyPrev.find(pd => pd.period === prevDate);
                    const prevSpend = (Number(facebookSpendMapPrev[prevDate]) || 0) + (Number(googleSpendMapPrev[prevDate]) || 0);

                    return prevShopifyData && prevSpend > 0 ? (prevShopifyData.total_sales / prevSpend).toFixed(2) : null;
                })
            }
        ];
        metricTitle = 'ROAS';
    }

    metricOptions = {
        chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: 'Outfit, sans-serif' },
        xaxis: { categories: metricCategories, labels: { style: { colors: chartColors.primaryLighter || '#406969' } }, axisTicks: { show: true }, axisBorder: { show: true } },
        yaxis: { labels: { style: { colors: chartColors.primary || '#1E2B2B' } } },
        colors: [chartColors.green || '#213834', '#94a3b8'],
        stroke: { width: [2, 1], curve: 'smooth', dashArray: [0, 5] },
        fill: { type: 'solid', opacity: [1, 0.5] },
        grid: { borderColor: '#e5e7eb', strokeDashArray: 0, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
        dataLabels: { enabled: false },
        tooltip: { theme: 'light' },
        legend: { show: true, position: 'top', labels: { colors: chartColors.primary || '#1E2B2B' } },
    };

    // AOV chart
    const aovCategories = shopifyDaily.map(d => d.period);
    const aovSeries = [
        {
            name: 'AOV (Current)',
            data: shopifyDaily.map(d => d.orders > 0 ? (d.total_sales / d.orders).toFixed(2) : null)
        },
        {
            name: `AOV (${comparisonMethod})`,
            data: shopifyDaily.map((d, i) => {
                let prevDate;
                if (comparisonMethod === "Last Year") {
                    const currentDate = dayjs(d.period);
                    prevDate = currentDate.subtract(1, 'year').format('YYYY-MM-DD');
                } else {
                    const currentDate = dayjs(d.period);
                    const periodStart = dayjs(appliedDateRange.startDate);
                    const periodEnd = dayjs(appliedDateRange.endDate);
                    const daysDiff = currentDate.diff(periodStart, 'day');
                    const prevPeriodStart = periodStart.subtract(periodEnd.diff(periodStart, 'day') + 1, 'day');
                    prevDate = prevPeriodStart.add(daysDiff, 'day').format('YYYY-MM-DD');
                }

                // Find corresponding previous period data
                const prevShopifyData = shopifyDailyPrev.find(pd => pd.period === prevDate);
                return prevShopifyData && prevShopifyData.orders > 0 ? (prevShopifyData.total_sales / prevShopifyData.orders).toFixed(2) : null;
            })
        }
    ];
    const aovOptions = {
        chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: 'Outfit, sans-serif' },
        xaxis: { categories: aovCategories, labels: { style: { colors: chartColors.primaryLighter || '#406969' } }, axisTicks: { show: true }, axisBorder: { show: true } },
        yaxis: { labels: { style: { colors: chartColors.primary || '#1E2B2B' } } },
        colors: [chartColors.secondary || '#D6CDB6', '#94a3b8'],
        stroke: { width: [2, 1], curve: 'smooth', dashArray: [0, 5] },
        fill: { type: 'solid', opacity: [1, 0.5] },
        grid: { borderColor: '#e5e7eb', strokeDashArray: 0, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
        dataLabels: { enabled: false },
        tooltip: { theme: 'light' },
        legend: { show: true, position: 'top', labels: { colors: chartColors.primary || '#1E2B2B' } },
    };

    return (
        <div className="w-full">
            {/* Top Card */}
            <DashboardHeading
                title="Performance Dashboard"
                label={customer ? customer.customerName : ""}
                customerId={params.customerId}
                dateRange={appliedDateRange}
                comparisonMethod={comparisonMethod}
                loading={loading}
                dashboardType="performance-dashboard"
                dataSnapshot={{
                    metrics: metrics,
                    dailyData: {
                        shopify: shopifyDaily,
                        facebook: facebookDaily,
                        google: googleDaily
                    },
                    aggregates: {
                        revenue: shopifyDaily.reduce((sum, d) => sum + (d.total_sales || 0), 0),
                        orders: shopifyDaily.reduce((sum, d) => sum + (d.orders || 0), 0),
                        cost: [...facebookDaily, ...googleDaily].reduce((sum, d) => sum + (d.spend || 0), 0),
                    },
                    revenueType: customer?.CustomerSettings?.customerRevenueType || 'total_sales',
                    metricPreference: customer?.CustomerSettings?.metricPreference || 'ROAS/POAS'
                }}
                right={
                    <DateRangePicker
                        onApply={handleDateRangeApply}
                        startDate={tempDateRange.startDate}
                        endDate={tempDateRange.endDate}
                        onStartDateChange={handleStartDateChange}
                        onEndDateChange={handleEndDateChange}
                        loading={loading}
                    />
                }
                showComparisonMethodToggler={true}
                onComparisonMethodChange={setComparisonMethod}
            />

            {/* Metrics Cards Section */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 w-full mb-8">
                {loading ? (
                    <div className="col-span-4 text-center"><Spinner size={40} color="#406969" /></div>
                ) : error ? (
                    <div className="col-span-4 text-center text-red-500">{error}</div>
                ) : (
                    metrics.map((metric, idx) => (
                        <MetricCard key={idx} {...metric} comparisonMethod={comparisonMethod} />
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

                {/* ROAS or Spendshare Graph */}
                {loading && (!shopifyDaily.length) ? (
                    <div className="flex items-center justify-center h-64"><Spinner size={40} color="#406969" /></div>
                ) : (
                    <GraphCard title={metricTitle} chartOptions={metricOptions} chartSeries={metricSeries} />
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