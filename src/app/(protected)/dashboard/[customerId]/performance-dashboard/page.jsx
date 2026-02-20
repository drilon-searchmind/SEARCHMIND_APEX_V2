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
import Custom from "./components/Custom";

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

    // Handlers for DateRangePicker (controlled) - comparison only applies on Apply
    const handleDateRangeApply = ({ startDate, endDate, comparisonMethod: appliedComparison }) => {
        setAppliedDateRange({ startDate, endDate });
        if (appliedComparison) setComparisonMethod(appliedComparison);
    };
    const handleStartDateChange = (newStart) => {
        setTempDateRange(dr => ({ ...dr, startDate: newStart }));
    };
    const handleEndDateChange = (newEnd) => {
        setTempDateRange(dr => ({ ...dr, endDate: newEnd }));
    };

    // Comparison method: applied (triggers fetch) vs temp (shown in picker until Apply)
    const [comparisonMethod, setComparisonMethod] = useState("Last Period");
    const [tempComparisonMethod, setTempComparisonMethod] = useState("Last Period");

    // Metrics state
    const [metrics, setMetrics] = useState([]);
    const [metricsData, setMetricsData] = useState(null);
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
                const totalSales = shopify.reduce((sum, d) => sum + (d.total_sales || 0), 0);
                const netRevenue = shopify.reduce((sum, d) => sum + (d.net_sales || 0), 0);
                const orders = shopify.reduce((sum, d) => sum + (d.orders || 0), 0);
                const returns = shopify.reduce((sum, d) => sum + (d.returns || 0), 0);
                const cost = [...facebook, ...google].reduce((sum, d) => sum + (d.spend || 0), 0);
                const aov = orders > 0 ? netRevenue / orders : 0;
                const roas = cost > 0 ? netRevenue / cost : null;
                const spendshare = cost / revenue;
                
                // Calculate Gross Profit (force using net_sales): subtract COGS from netRevenue
                const cogsPercentage = customer?.CustomerStaticExpenses?.cogsPercentage || 0;
                const fetchCogs = customer?.CustomerSettings?.fetchCogsFromStore === true;
                const totalCogs = fetchCogs
                    ? shopify.reduce((sum, d) => sum + (d.cost_of_goods_sold || 0), 0)
                    : netRevenue * cogsPercentage;
                let gross_profit_total_sales = netRevenue - totalCogs;

                // Aggregate for metric cards (previous)
                const shopifyPrev = mergedPrev.shopifyDaily || [];
                const facebookPrev = mergedPrev.facebookDaily || [];
                const googlePrev = mergedPrev.googleDaily || [];
                const revenuePrev = shopifyPrev.reduce((sum, d) => sum + (d[revenueType] || 0), 0);
                const totalSalesPrev = shopifyPrev.reduce((sum, d) => sum + (d.total_sales || 0), 0);
                const netRevenuePrev = shopifyPrev.reduce((sum, d) => sum + (d.net_sales || 0), 0);
                const ordersPrev = shopifyPrev.reduce((sum, d) => sum + (d.orders || 0), 0);
                const returnsPrev = shopifyPrev.reduce((sum, d) => sum + (d.returns || 0), 0);
                const costPrev = [...facebookPrev, ...googlePrev].reduce((sum, d) => sum + (d.spend || 0), 0);
                const aovPrev = ordersPrev > 0 ? netRevenuePrev / ordersPrev : 0;
                const roasPrev = costPrev > 0 ? netRevenuePrev / costPrev : null;
                const spendsharePrev = costPrev / revenuePrev;
                const prevTotalCogs = fetchCogs
                    ? shopifyPrev.reduce((sum, d) => sum + (d.cost_of_goods_sold || 0), 0)
                    : netRevenuePrev * cogsPercentage;
                const gross_profit_total_salesPrev = netRevenuePrev - prevTotalCogs;

                // Calculations
                const grossProfitCalculation = merged.calculationsData?.grossProfitCalculation || '';
                const totalAdspendCalculation = merged.calculationsData?.totalAdspendCalculation || '';
                const roasCalculation = `Net Revenue / Cost \n
                    = ${netRevenue.toFixed(2)} / ${cost.toFixed(2)} \n
                    = ${roas !== null ? roas.toFixed(2) : 'N/A'}
                `;
                const poasCalculation = cost > 0 ? `(Net Profit / Cost) \n
                    = ${gross_profit_total_sales.toFixed(2)} / ${cost.toFixed(2)} \n
                    = ${ (cost > 0 && gross_profit_total_sales !== null) ? ( (gross_profit_total_sales / cost).toFixed(2) ) : 'N/A'}
                ` : merged.calculationsData?.poasCalculation || '';
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
                const poas = cost > 0 ? (gross_profit_total_sales / cost) : null;
                const poasPrev = costPrev > 0 ? (gross_profit_total_salesPrev / costPrev) : null;
                const cac = merged.CACTotalSales ?? null;
                const cacPrev = mergedPrev.CACTotalSales ?? null;

                // Build metrics array conditionally
                const metricsArray = [
                    {
                        key: 'total_sales',
                        label: 'Total Sales',
                        value: totalSales ? totalSales.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : '-',
                        icon: <FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(totalSales, totalSalesPrev) !== null ? Math.abs(percentChange(totalSales, totalSalesPrev)).toFixed(0) : undefined,
                        changeType: changeType(percentChange(totalSales, totalSalesPrev)),
                        popOverContent: null,
                    },
                    {
                        key: 'revenue',
                        label: 'Net Revenue',
                        value: netRevenue ? netRevenue.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : '-',
                        icon: <FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(netRevenue, netRevenuePrev) !== null ? Math.abs(percentChange(netRevenue, netRevenuePrev)).toFixed(0) : undefined,
                        changeType: changeType(percentChange(netRevenue, netRevenuePrev)),
                        tooltip: 'Net sales (after discounts, returns, etc.)',
                        popOverContent: null,
                    },
                    {
                        key: 'gross_profit',
                        label: "Net Profit",
                        // prefer merged net-sales based gross profit when available
                        value: (merged.grossProfitNetSales ?? gross_profit_total_sales) ? ( (merged.grossProfitNetSales ?? gross_profit_total_sales).toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) ) : '-',
                        icon: <FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange((merged.grossProfitNetSales ?? gross_profit_total_sales), (mergedPrev.grossProfitNetSales ?? gross_profit_total_salesPrev)) !== null ? Math.abs(percentChange((merged.grossProfitNetSales ?? gross_profit_total_sales), (mergedPrev.grossProfitNetSales ?? gross_profit_total_salesPrev))).toFixed(0) : undefined,
                        changeType: changeType(percentChange((merged.grossProfitNetSales ?? gross_profit_total_sales), (mergedPrev.grossProfitNetSales ?? gross_profit_total_salesPrev))),
                        popOverContent: grossProfitCalculation,
                    },
                    {
                        key: 'orders',
                        label: "Orders",
                        value: orders !== null ? orders.toLocaleString('da-DK', { maximumFractionDigits: 0 }) : '-',
                        icon: <FiShoppingCart className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(orders, ordersPrev) !== null ? Math.abs(percentChange(orders, ordersPrev)).toFixed(0) : undefined,
                        changeType: changeType(percentChange(orders, ordersPrev)),
                        popOverContent: null,
                    },
                    {
                        key: 'returns',
                        label: 'Refunds',
                        value: returns ? returns.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : '-',
                        icon: <FiTrendingUp className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(returns, returnsPrev) !== null ? Math.abs(percentChange(returns, returnsPrev)).toFixed(0) : undefined,
                        changeType: changeType(percentChange(returns, returnsPrev)),
                        popOverContent: null,
                    },
                    {
                        key: 'cost',
                        label: "Spend",
                        value: cost ? cost.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : '-',
                        icon: <FiCreditCard className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(cost, costPrev) !== null ? Math.abs(percentChange(cost, costPrev)).toFixed(0) : undefined,
                        changeType: changeType(percentChange(cost, costPrev)),
                        popOverContent: totalAdspendCalculation,
                    },
                ];

                // Conditionally add ROAS or Spendshare based on preference
                if (customerMetricPreference === 'Spendshare') {
                    metricsArray.push({
                        key: 'spendshare',
                        label: "Spendshare",
                        value: spendshare !== null && !isNaN(spendshare) ? `${Math.round(spendshare * 100)}%` : '-',
                        icon: <FiBarChart2 className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(spendshare, spendsharePrev) !== null ? Math.abs(percentChange(spendshare, spendsharePrev)).toFixed(0) : undefined,
                        changeType: changeType(percentChange(spendshare, spendsharePrev)),
                        popOverContent: null,
                    });
                } else {
                    // Default to ROAS/POAS
                    metricsArray.push({
                        key: 'roas',
                        label: "Blended ROAS",
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
                        key: 'poas',
                        label: "Blended POAS",
                        value: poas !== null ? poas.toFixed(2) : '-',
                        icon: <FiPieChart className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(poas, poasPrev) !== null ? Math.abs(percentChange(poas, poasPrev)).toFixed(1) : undefined,
                        changeType: changeType(percentChange(poas, poasPrev)),
                        popOverContent: poasCalculation,
                    },
                    {
                        key: 'aov',
                        label: "Net AOV",
                        value: aov !== null ? aov.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : '-',
                        icon: <FiShoppingBag className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(aov, aovPrev) !== null ? Math.abs(percentChange(aov, aovPrev)).toFixed(0) : undefined,
                        changeType: changeType(percentChange(aov, aovPrev)),
                        popOverContent: null,
                    },
                    {
                        key: 'cac',
                        label: "Blended CAC",
                        value: cac !== null ? cac.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : '-',
                        icon: <FiUserCheck className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(cac, cacPrev) !== null ? Math.abs(percentChange(cac, cacPrev)).toFixed(0) : undefined,
                        changeType: changeType(percentChange(cac, cacPrev)),
                        popOverContent: cacCalculation,
                    },
                );

                setMetrics(metricsArray);

                // Raw numeric values for Custom KPI formulas
                const gprofit = merged.grossProfitNetSales ?? gross_profit_total_sales;
                setMetricsData({
                    total_sales: totalSales,
                    revenue: netRevenue,
                    gross_profit: gprofit,
                    orders,
                    returns,
                    cost,
                    roas: roas ?? 0,
                    poas: poas ?? 0,
                    aov,
                    cac: cac ?? 0,
                    spendshare: revenue > 0 ? cost / revenue : 0,
                });
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

    // Graph controls: metric toggles and aggregation (period vs monthly)
    const METRIC_OPTIONS = [
        { key: 'revenue', label: 'Net Revenue', icon: FiDollarSign },
        { key: 'total_sales', label: 'Total Sales', icon: FiDollarSign },
        { key: 'gross_profit', label: 'Net Profit', icon: FiDollarSign },
        { key: 'returns', label: 'Refunds', icon: FiTrendingUp },
        { key: 'orders', label: 'Orders', icon: FiShoppingCart },
        { key: 'cost', label: 'Cost', icon: FiCreditCard },
        { key: 'roas', label: 'Blended ROAS', icon: FiTrendingUp },
        { key: 'poas', label: 'Blended POAS', icon: FiPieChart },
        { key: 'aov', label: 'Net AOV', icon: FiShoppingBag },
        { key: 'cac', label: 'Blended CAC', icon: FiUserCheck },
    ];
    const [selectedMetrics, setSelectedMetrics] = useState(['revenue']); // revenue default
    const [aggregateBy, setAggregateBy] = useState('period'); // 'period' | 'monthly'
    const [viewMode, setViewMode] = useState('standard'); // 'standard' | 'custom'

    // Helper to aggregate daily arrays by keyFn (period or month)
    const aggregateDaily = (shopifyArr, facebookArr, googleArr, keyFn) => {
        const map = {};
        const push = (k, obj) => {
            if (!map[k]) map[k] = { revenue: 0, totalRevenue: 0, orders: 0, cost: 0, cogs: 0, returns: 0 };
            // totalRevenue = total_sales, revenue = net_sales when available (fallback to total_sales)
            map[k].totalRevenue += Number(obj.total_sales || 0);
            map[k].revenue += Number(obj.net_sales || obj.total_sales || 0);
            map[k].orders += Number(obj.orders || 0);
            map[k].cogs += Number(obj.cost_of_goods_sold || 0);
            map[k].returns += Number(obj.returns || 0);
        };
        (shopifyArr || []).forEach(d => push(keyFn(d.period), d));
        // build spend map
        const addSpend = (k, spend) => {
            if (!map[k]) map[k] = { revenue: 0, totalRevenue: 0, orders: 0, cost: 0, cogs: 0, returns: 0 };
            map[k].cost += Number(spend || 0);
        };
        (facebookArr || []).forEach(d => addSpend(keyFn(d.period), d.spend));
        (googleArr || []).forEach(d => addSpend(keyFn(d.period), d.spend));
        return map;
    };

    // Build series for selected metrics and current + comparison (aligned)
    const buildSeriesFromSelected = () => {
        const keyFn = (period) => aggregateBy === 'monthly' ? dayjs(period).format('YYYY-MM') : period;
        const currAgg = aggregateDaily(shopifyDaily, facebookDaily, googleDaily, keyFn);
        const prevAgg = aggregateDaily(shopifyDailyPrev, facebookDailyPrev, googleDailyPrev, keyFn);

        const categories = Object.keys(currAgg).sort();
        const series = [];

        // days/months count in applied range
        const daysInRange = dayjs(appliedDateRange.endDate).diff(dayjs(appliedDateRange.startDate), 'day') + 1;

        const getPrevKeyForCategory = (currKey, idx) => {
            if (aggregateBy === 'monthly') {
                if (comparisonMethod === 'Last Year') {
                    return dayjs(currKey + '-01').subtract(1, 'year').format('YYYY-MM');
                }
                // Last Period: map months by index relative to previous contiguous month block
                const periodStartMonth = dayjs(appliedDateRange.startDate).startOf('month');
                const prevPeriodEnd = periodStartMonth.subtract(1, 'day').endOf('month');
                const prevPeriodStart = prevPeriodEnd.startOf('month');
                return prevPeriodStart.add(idx, 'month').format('YYYY-MM');
            }
            // daily
            if (comparisonMethod === 'Last Year') {
                return dayjs(currKey).subtract(1, 'year').format('YYYY-MM-DD');
            }
            const prevStart = dayjs(appliedDateRange.startDate).subtract(daysInRange, 'day');
            return prevStart.add(idx, 'day').format('YYYY-MM-DD');
        };

        selectedMetrics.forEach((metric) => {
            const currData = categories.map(k => {
                const v = currAgg[k];
                if (!v) return null;
                if (metric === 'revenue') return Number(v.revenue.toFixed(0));
                if (metric === 'total_sales') return Number(v.totalRevenue.toFixed(0));
                if (metric === 'returns') return Number((v.returns || 0).toFixed(0));
                if (metric === 'gross_profit') return Number((v.revenue - (v.cogs || 0)).toFixed(0));
                if (metric === 'cost') return Number(v.cost.toFixed(0));
                if (metric === 'orders') return Number(v.orders || 0);
                if (metric === 'roas') return (v.cost > 0 ? Number((v.revenue / v.cost).toFixed(2)) : null);
                if (metric === 'poas') return (v.cost > 0 ? Number(((v.revenue - (v.cogs || 0)) / v.cost).toFixed(2)) : null);
                if (metric === 'aov') return (v.orders > 0 ? Number((v.revenue / v.orders).toFixed(0)) : null);
                if (metric === 'spendshare') return (v.revenue > 0 ? Number(((v.cost / v.revenue) * 100).toFixed(0)) : null);
                if (metric === 'cac') return (v.orders > 0 ? Number((v.cost / v.orders).toFixed(0)) : null);
                return null;
            });

            series.push({ name: `${METRIC_OPTIONS.find(o=>o.key===metric)?.label || metric} (Current)`, data: currData });

            const prevData = categories.map((k, idx) => {
                const prevKey = getPrevKeyForCategory(k, idx);
                const v = prevAgg[prevKey];
                if (!v) return null;
                if (metric === 'revenue') return Number(v.revenue.toFixed(0));
                if (metric === 'total_sales') return Number(v.totalRevenue.toFixed(0));
                if (metric === 'returns') return Number((v.returns || 0).toFixed(0));
                if (metric === 'gross_profit') return Number((v.revenue - (v.cogs || 0)).toFixed(0));
                if (metric === 'cost') return Number(v.cost.toFixed(0));
                if (metric === 'orders') return Number(v.orders || 0);
                if (metric === 'roas') return (v.cost > 0 ? Number((v.revenue / v.cost).toFixed(2)) : null);
                if (metric === 'poas') return (v.cost > 0 ? Number(((v.revenue - (v.cogs || 0)) / v.cost).toFixed(2)) : null);
                if (metric === 'aov') return (v.orders > 0 ? Number((v.revenue / v.orders).toFixed(0)) : null);
                if (metric === 'spendshare') return (v.revenue > 0 ? Number(((v.cost / v.revenue) * 100).toFixed(0)) : null);
                if (metric === 'cac') return (v.orders > 0 ? Number((v.cost / v.orders).toFixed(0)) : null);
                return null;
            });

            series.push({ name: `${METRIC_OPTIONS.find(o=>o.key===metric)?.label || metric} (${comparisonMethod})`, data: prevData });
        });

        const formatChartValue = (v) => (typeof v === 'number' && !isNaN(v) ? v.toLocaleString('da-DK', { maximumFractionDigits: 2, minimumFractionDigits: 0 }) : v);
        const options = {
            chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: 'Outfit, sans-serif' },
            xaxis: { categories, labels: { style: { colors: chartColors.primaryLighter || '#406969' } }, axisTicks: { show: true }, axisBorder: { show: true } },
            yaxis: { labels: { style: { colors: chartColors.primary || '#1E2B2B' }, formatter: formatChartValue } },
            tooltip: { theme: 'light', y: { formatter: formatChartValue } },
            colors: [chartColors.lime || '#C6ED62', '#94a3b8', chartColors.primaryLighter || '#406969', '#cbd5e1', chartColors.green || '#213834', '#f1f5f9'],
            stroke: { width: series.map((_,i) => i % 2 === 0 ? 2 : 1), curve: 'smooth', dashArray: series.map((_,i) => i % 2 === 1 ? 5 : 0) },
            fill: { type: 'solid', opacity: [1,0.5] },
            grid: { borderColor: '#e5e7eb', strokeDashArray: 0, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
            dataLabels: { enabled: false },
            tooltip: { theme: 'light' },
            legend: { show: true, position: 'top', labels: { colors: chartColors.primary || '#1E2B2B' } },
        };

        return { series, options };
    };

    const { series: combinedSeries, options: combinedOptions } = buildSeriesFromSelected();

    // Chart options for each graph
    // No fill/gradient for now
    const noFill = { type: 'solid', opacity: 0 };

    // Prepare chart data from real daily arrays
    // Revenue chart
    const revenueCategories = shopifyDaily.map(d => d.period);
    const revenueSeries = [
        { name: 'Revenue (Current)', data: shopifyDaily.map(d => Number(d.total_sales).toFixed(0)) },
        { name: `Revenue (${comparisonMethod})`, data: shopifyDailyPrev.map(d => Number(d.total_sales).toFixed(0)) }
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
    const facebookSpendSeries = spendCategories.map(date => (facebookSpendMap[date] ? Number(facebookSpendMap[date]).toFixed(0) : '0'));
    const googleSpendSeries = spendCategories.map(date => (googleSpendMap[date] ? Number(googleSpendMap[date]).toFixed(0) : '0'));

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
        return facebookSpendMapPrev[prevDate] ? Number(facebookSpendMapPrev[prevDate]).toFixed(0) : '0';
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
        return googleSpendMapPrev[prevDate] ? Number(googleSpendMapPrev[prevDate]).toFixed(0) : '0';
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
                    return d.total_sales > 0 ? ((spend / d.total_sales) * 100).toFixed(0) : null;
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

                    return prevShopifyData && prevShopifyData.total_sales > 0 ? ((prevSpend / prevShopifyData.total_sales) * 100).toFixed(0) : null;
                })
            }
        ];
        metricTitle = 'Spendshare (%)';
    } else {
        // ROAS chart (default) - use blended ROAS label
        const roasLabel = METRIC_OPTIONS.find(o => o.key === 'roas')?.label || 'Blended ROAS';
        metricSeries = [
            {
                name: `${roasLabel} (Current)`,
                data: shopifyDaily.map((d, i) => {
                    const spend = (Number(facebookSpendMap[d.period]) || 0) + (Number(googleSpendMap[d.period]) || 0);
                    return spend > 0 ? ( (Number(d.net_sales || d.total_sales) / spend) ).toFixed(2) : null;
                })
            },
            {
                name: `${roasLabel} (${comparisonMethod})`,
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

                    return prevShopifyData && prevSpend > 0 ? ( (Number(prevShopifyData.net_sales || prevShopifyData.total_sales) / prevSpend) ).toFixed(2) : null;
                })
            }
        ];
        metricTitle = roasLabel;
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
            name: 'Net AOV (Current)',
            data: shopifyDaily.map(d => d.orders > 0 ? ((Number(d.net_sales || d.total_sales) / d.orders)).toFixed(0) : null)
        },
        {
            name: `Net AOV (${comparisonMethod})`,
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
                return prevShopifyData && prevShopifyData.orders > 0 ? ((Number(prevShopifyData.net_sales || prevShopifyData.total_sales) / prevShopifyData.orders)).toFixed(0) : null;
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
                        showComparisonMethodToggler={true}
                        comparisonMethod={tempComparisonMethod}
                        onComparisonMethodChange={setTempComparisonMethod}
                    />
                }
            />

            {/* View Mode Toggler + Metrics Cards Section */}
            <div className="mb-4">
                <div className="flex border border-gray-200 bg-gray-100 rounded-lg overflow-hidden w-fit">
                    <button
                        type="button"
                        className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium focus:outline-none transition-colors duration-150 ${viewMode === 'standard' ? 'bg-white text-[var(--color-primary-searchmind)] shadow-sm' : 'text-gray-500 hover:text-[var(--color-primary-searchmind)]'}`}
                        style={{ borderRadius: '8px 0 0 8px' }}
                        onClick={() => setViewMode('standard')}
                    >
                        Standard
                    </button>
                    <button
                        type="button"
                        className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium focus:outline-none transition-colors duration-150 ${viewMode === 'custom' ? 'bg-white text-[var(--color-primary-searchmind)] shadow-sm' : 'text-gray-500 hover:text-[var(--color-primary-searchmind)]'}`}
                        style={{ borderRadius: '0 8px 8px 0' }}
                        onClick={() => setViewMode('custom')}
                    >
                        Custom
                    </button>
                </div>
            </div>

            {viewMode === 'standard' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6 w-full mb-8">
                {loading ? (
                    <div className="col-span-4 text-center"><Spinner size={40} color="#406969" /></div>
                ) : error ? (
                    <div className="col-span-4 text-center text-red-500">{error}</div>
                ) : (
                    metrics.map((metric, idx) => {
                        // derive a metric key from label to match toggles
                        const getMetricKeyFromLabel = (label) => {
                            if (!label) return null;
                            const l = label.toLowerCase();
                            if (l.includes('revenue')) return 'revenue';
                            if (l.includes('gross')) return 'gross_profit';
                            if (l.includes('cost') || l.includes('adspend') || l.includes('spend')) return 'cost';
                            if (l.includes('order')) return 'orders';
                            if (l.includes('roas')) return 'roas';
                            if (l.includes('poas')) return 'poas';
                            if (l.includes('aov')) return 'aov';
                            if (l.includes('cac')) return 'cac';
                            if (l.includes('spendshare')) return 'spendshare';
                            return null;
                        };

                        const metricKey = metric.key || getMetricKeyFromLabel(metric.label);

                        const toggleMetricSelection = (key) => {
                            if (!key) return;
                            setSelectedMetrics(prev =>
                                prev.includes(key) ? (prev.length > 1 ? prev.filter(k => k !== key) : prev) : [...prev, key]
                            );
                        };

                        const isSelected = metricKey ? selectedMetrics.includes(metricKey) : false;

                        return (
                            <div
                                key={idx}
                                role="button"
                                tabIndex={0}
                                onClick={() => toggleMetricSelection(metricKey)}
                                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleMetricSelection(metricKey)}
                                className="cursor-pointer rounded-lg"
                                aria-pressed={metricKey ? isSelected : undefined}
                            >
                                <MetricCard {...metric} comparisonMethod={comparisonMethod} isActive={isSelected} />
                            </div>
                        );
                    })
                )}
            </div>
            ) : (
            <div className="mb-8">
                <Custom
                    customerId={params.customerId}
                    metricsData={metricsData}
                    shopifyDaily={shopifyDaily}
                    facebookDaily={facebookDaily}
                    googleDaily={googleDaily}
                    shopifyDailyPrev={shopifyDailyPrev}
                    facebookDailyPrev={facebookDailyPrev}
                    googleDailyPrev={googleDailyPrev}
                    appliedDateRange={appliedDateRange}
                    comparisonMethod={comparisonMethod}
                    aggregateBy={aggregateBy}
                    chartColors={chartColors}
                />
            </div>
            )}

            {/* Single Toggleable Graph Section - Standard view only */}
            {viewMode === 'standard' && (
            <div className="w-full mb-8">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        {METRIC_OPTIONS.map(opt => (
                            <button
                                key={opt.key}
                                className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors duration-150 ${selectedMetrics.includes(opt.key) ? 'bg-[var(--color-primary-searchmind)] text-white border-[var(--color-primary-searchmind)]' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'}`}
                                onClick={() => setSelectedMetrics(prev => prev.includes(opt.key) ? (prev.length > 1 ? prev.filter(k => k !== opt.key) : prev) : [...prev, opt.key])}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center h-64"><Spinner size={40} color="#406969" /></div>
                ) : (
                    <GraphCard title={selectedMetrics.length === 1 ? `${METRIC_OPTIONS.find(o=>o.key===selectedMetrics[0])?.label} Over Time` : 'Performance Metrics Over Time'} chartOptions={combinedOptions} chartSeries={combinedSeries} />
                )}
            </div>
            )}
        </div>
    );
}