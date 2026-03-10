"use client"

import React from "react";
import { useParams } from "next/navigation";
import { useCustomers } from "@/hooks/useCustomers";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import MetricCard from "@/components/dashboard/MetricCard";
import { FiDollarSign, FiTrendingUp, FiTrendingDown, FiShoppingCart, FiCreditCard, FiBarChart2, FiPieChart, FiShoppingBag, FiUserCheck } from "react-icons/fi";
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
    const [comparisonMethod, setComparisonMethod] = useState("Last Year");
    const [tempComparisonMethod, setTempComparisonMethod] = useState("Last Year");

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
    // Cached merged responses for metrics rebuild
    const [merged, setMerged] = useState(null);
    const [mergedPrev, setMergedPrev] = useState(null);

    // Main fetch: merged data
    useEffect(() => {
        if (!customer) return;
        setLoading(true);
        setError(null);
        (async () => {
            try {
                const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
                const start = dayjs(appliedDateRange.startDate);
                const end = dayjs(appliedDateRange.endDate);
                const days = end.diff(start, 'day') + 1;

                let prevStart, prevEnd;
                if (comparisonMethod === "Last Year") {
                    prevStart = start.subtract(1, 'year');
                    prevEnd = end.subtract(1, 'year');
                } else {
                    prevEnd = start.subtract(1, 'day');
                    prevStart = prevEnd.subtract(days - 1, 'day');
                }

                const [res, resPrev] = await Promise.all([
                    fetch(`${baseUrl}/api/merged-sources/${customer._id}?startDate=${appliedDateRange.startDate}&endDate=${appliedDateRange.endDate}&source=performance-dashboard`),
                    fetch(`${baseUrl}/api/merged-sources/${customer._id}?startDate=${prevStart.format('YYYY-MM-DD')}&endDate=${prevEnd.format('YYYY-MM-DD')}&source=performance-dashboard`)
                ]);
                if (!res.ok || !resPrev.ok) throw new Error('Failed to fetch merged data');
                const merged = await res.json();
                const mergedPrev = await resPrev.json();
                setMerged(merged);
                setMergedPrev(mergedPrev);
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

                setLoading(false);
            } catch (err) {
                setError(err.message);
                setLoading(false);
            }
        })();
    }, [customer, appliedDateRange, comparisonMethod]);

    // Build metrics when merged data is available
    useEffect(() => {
        if (!customer || !merged || !mergedPrev) return;
        const start = dayjs(appliedDateRange.startDate);
        const end = dayjs(appliedDateRange.endDate);
        const daysInRange = end.diff(start, 'day') + 1;

        const revenueType = customer?.CustomerSettings?.customerRevenueType || 'total_sales';
        const customerMetricPreference = customer?.CustomerSettings?.metricPreference || 'ROAS/POAS';

        const shopify = merged.shopifyDaily || [];
        const facebook = merged.facebookDaily || [];
        const google = merged.googleDaily || [];
        const shopifyPrev = mergedPrev.shopifyDaily || [];
        const facebookPrev = mergedPrev.facebookDaily || [];
        const googlePrev = mergedPrev.googleDaily || [];

        const revenue = shopify.reduce((sum, d) => sum + (d[revenueType] || 0), 0);
        const totalSales = shopify.reduce((sum, d) => sum + (d.total_sales || 0), 0);
        const grossSales = shopify.reduce((sum, d) => sum + (d.gross_sales || 0), 0);
        const discounts = shopify.reduce((sum, d) => sum + (d.discounts || 0), 0);
        const netRevenue = shopify.reduce((sum, d) => sum + (d.net_sales || 0), 0);
        const orders = shopify.reduce((sum, d) => sum + (d.orders || 0), 0);
        const returns = shopify.reduce((sum, d) => sum + (d.returns || 0), 0);
        const shippingCharges = shopify.reduce((sum, d) => sum + (d.shipping_charges || 0), 0);
        const taxes = shopify.reduce((sum, d) => sum + (d.taxes || 0), 0);
        const cost = [...facebook, ...google].reduce((sum, d) => sum + (d.spend || 0), 0);
        const metaSpend = facebook.reduce((sum, d) => sum + (d.spend || 0), 0);
        const googleSpend = google.reduce((sum, d) => sum + (d.spend || 0), 0);
        const aov = orders > 0 ? netRevenue / orders : 0;
        const roas = cost > 0 ? netRevenue / cost : null;
        const spendshare = netRevenue > 0 ? cost / netRevenue : 0;

        const revenuePrev = shopifyPrev.reduce((sum, d) => sum + (d[revenueType] || 0), 0);
        const totalSalesPrev = shopifyPrev.reduce((sum, d) => sum + (d.total_sales || 0), 0);
        const grossSalesPrev = shopifyPrev.reduce((sum, d) => sum + (d.gross_sales || 0), 0);
        const discountsPrev = shopifyPrev.reduce((sum, d) => sum + (d.discounts || 0), 0);
        const netRevenuePrev = shopifyPrev.reduce((sum, d) => sum + (d.net_sales || 0), 0);
        const ordersPrev = shopifyPrev.reduce((sum, d) => sum + (d.orders || 0), 0);
        const returnsPrev = shopifyPrev.reduce((sum, d) => sum + (d.returns || 0), 0);
        const shippingChargesPrev = shopifyPrev.reduce((sum, d) => sum + (d.shipping_charges || 0), 0);
        const taxesPrev = shopifyPrev.reduce((sum, d) => sum + (d.taxes || 0), 0);
        const costPrev = [...facebookPrev, ...googlePrev].reduce((sum, d) => sum + (d.spend || 0), 0);
        const metaSpendPrev = facebookPrev.reduce((sum, d) => sum + (d.spend || 0), 0);
        const googleSpendPrev = googlePrev.reduce((sum, d) => sum + (d.spend || 0), 0);
        const aovPrev = ordersPrev > 0 ? netRevenuePrev / ordersPrev : 0;
        const roasPrev = costPrev > 0 ? netRevenuePrev / costPrev : null;
        const spendsharePrev = netRevenuePrev > 0 ? costPrev / netRevenuePrev : 0;

        const cogsPercentage = customer?.CustomerStaticExpenses?.cogsPercentage || 0;
        const fetchCogs = customer?.CustomerSettings?.fetchCogsFromStore === true;
        const totalCogs = fetchCogs
            ? shopify.reduce((sum, d) => sum + (d.cost_of_goods_sold || 0), 0)
            : netRevenue * cogsPercentage;
        const prevTotalCogs = fetchCogs
            ? shopifyPrev.reduce((sum, d) => sum + (d.cost_of_goods_sold || 0), 0)
            : netRevenuePrev * cogsPercentage;
        let gross_profit_total_sales = netRevenue - totalCogs;
        const gross_profit_total_salesPrev = netRevenuePrev - prevTotalCogs;

        // Fixed costs: fixedExpenses is the monthly total. Prorate by actual days in each month (handles multi-month spans).
        const staticExp = customer?.CustomerStaticExpenses || {};
        console.log("::: STATIC EXPENSES :::");
        console.log({ staticExp });
        const fixedExpensesMonthly = Number(staticExp.fixedExpenses) || 0;
        const calcFixedForRange = (rangeStart, rangeEnd) => {
            let total = 0;
            let d = dayjs(rangeStart);
            const end = dayjs(rangeEnd);
            while (!d.isAfter(end)) {
                total += fixedExpensesMonthly / d.daysInMonth();
                d = d.add(1, 'day');
            }
            return total;
        };
        const fixedCosts = calcFixedForRange(start, end);
        const prevPeriodEnd = comparisonMethod === "Last Year" ? end.subtract(1, 'year') : start.subtract(1, 'day');
        const prevPeriodStart = prevPeriodEnd.subtract(daysInRange - 1, 'day');
        const fixedCostsPrev = calcFixedForRange(prevPeriodStart, prevPeriodEnd);

        // Variable costs: costs that scale with volume (shipping + pick & pack). Excludes transaction fee (shown separately).
        const shippingCostPerOrder = staticExp.shippingCostPerOrder ?? 0;
        const pickNPackCostPerOrder = staticExp.pickNPackCostPerOrder ?? 0;
        const transactionCostPct = staticExp.transactionCostPercentage ?? 0.015;
        const shippingCost = shippingCostPerOrder * orders;
        const shippingCostPrev = shippingCostPerOrder * ordersPrev;
        const pickPackCost = pickNPackCostPerOrder * orders;
        const pickPackCostPrev = pickNPackCostPerOrder * ordersPrev;
        const transactionFee = netRevenue * transactionCostPct;
        const transactionFeePrev = netRevenuePrev * transactionCostPct;
        const variableCosts = shippingCost + pickPackCost;
        const variableCostsPrev = shippingCostPrev + pickPackCostPrev;

        // EBIT = Net Revenue - All costs = Net Revenue - COGS - Fixed - Variable - Transaction Fee - Spend
        const allCosts = totalCogs + fixedCosts + variableCosts + transactionFee + cost;
        const allCostsPrev = prevTotalCogs + fixedCostsPrev + variableCostsPrev + transactionFeePrev + costPrev;
        const ebit = netRevenue - allCosts;
        const ebitPrev = netRevenuePrev - allCostsPrev;
        const ebitPct = netRevenue > 0 ? (ebit / netRevenue) * 100 : null;
        const ebitPctPrev = netRevenuePrev > 0 ? (ebitPrev / netRevenuePrev) * 100 : null;

        const fmt = (n, d = 0) => (n ?? 0).toLocaleString('da-DK', { maximumFractionDigits: d });
        const grossProfitCalculation = merged.calculationsData?.grossProfitCalculation || '';
        const totalAdspendCalculation = merged.calculationsData?.totalAdspendCalculation || '';
        const roasCalculation = `Net Revenue / Cost \n
                    = ${fmt(netRevenue)} / ${fmt(cost)} \n
                    = ${roas !== null ? roas.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A'}
                `;
        const poasCalculation = cost > 0 ? `(Net Profit / Spend) \n
                    = ${fmt(ebit)} / ${fmt(cost)} \n
                    = ${ (cost > 0 && ebit !== null) ? (ebit / cost).toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A'}
                ` : merged.calculationsData?.poasCalculation || '';
        const cacCalculation = merged.calculationsData?.cacCalculation || '';
        const apiValueLabels = merged.calculationsData?.valueLabels || {};

        function percentChange(current, prev) {
            if (prev === 0 || prev === null || prev === undefined) return null;
            return ((current - prev) / Math.abs(prev)) * 100;
        }
        function changeType(val) {
            if (val === null) return undefined;
            return val > 0 ? "up" : val < 0 ? "down" : undefined;
        }
        function formatDiff(current, prev, type) {
            if (prev === null || prev === undefined) return undefined;
            const diff = (current ?? 0) - (prev ?? 0);
            if (type === 'currency') {
                return diff >= 0
                    ? `+${diff.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 })}`
                    : diff.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 });
            }
            if (type === 'count') return diff >= 0 ? `+${diff}` : `${diff}`;
            if (type === 'ratio') return diff >= 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2);
            if (type === 'pct') return diff >= 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`;
            return undefined;
        }

        const poas = cost > 0 ? (ebit / cost) : null;
        const poasPrev = costPrev > 0 ? (ebitPrev / costPrev) : null;
        const cac = merged.CACTotalSales ?? null;
        const cacPrev = mergedPrev.CACTotalSales ?? null;

        // Build metrics array conditionally
                const metricsArray = [
                    {
                        key: 'orders',
                        label: "Orders",
                        value: orders !== null ? orders.toLocaleString('da-DK', { maximumFractionDigits: 0 }) : '-',
                        icon: <FiShoppingCart className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(orders, ordersPrev) !== null ? Math.abs(percentChange(orders, ordersPrev)).toFixed(0) : undefined,
                        changeType: changeType(percentChange(orders, ordersPrev)),
                        changeAbsolute: formatDiff(orders, ordersPrev, 'count'),
                        changePrevValue: ordersPrev != null ? ordersPrev.toLocaleString('da-DK', { maximumFractionDigits: 0 }) : undefined,
                        popOverContent: null,
                    },
                    {
                        key: 'total_sales',
                        label: 'Total Sales',
                        value: totalSales ? totalSales.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : '-',
                        icon: <FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(totalSales, totalSalesPrev) !== null ? Math.abs(percentChange(totalSales, totalSalesPrev)).toFixed(0) : undefined,
                        changeType: changeType(percentChange(totalSales, totalSalesPrev)),
                        changeAbsolute: formatDiff(totalSales, totalSalesPrev, 'currency'),
                        changePrevValue: totalSalesPrev != null ? totalSalesPrev.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : undefined,
                        popOverContent: null,
                    },
                    {
                        key: 'gross_sales',
                        label: 'Gross Sales',
                        value: grossSales ? grossSales.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : '-',
                        icon: <FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(grossSales, grossSalesPrev) !== null ? Math.abs(percentChange(grossSales, grossSalesPrev)).toFixed(0) : undefined,
                        changeType: changeType(percentChange(grossSales, grossSalesPrev)),
                        changeAbsolute: formatDiff(grossSales, grossSalesPrev, 'currency'),
                        changePrevValue: grossSalesPrev != null ? grossSalesPrev.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : undefined,
                        popOverContent: null,
                    },
                    {
                        key: 'discounts',
                        label: 'Discount',
                        value: discounts ? discounts.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : '-',
                        icon: <FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(discounts, discountsPrev) !== null ? Math.abs(percentChange(discounts, discountsPrev)).toFixed(0) : undefined,
                        changeType: changeType(percentChange(discounts, discountsPrev)),
                        changeAbsolute: formatDiff(discounts, discountsPrev, 'currency'),
                        changePrevValue: discountsPrev != null ? discountsPrev.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : undefined,
                        popOverContent: null,
                    },
                    {
                        key: 'revenue',
                        label: 'Net Revenue',
                        value: netRevenue ? netRevenue.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : '-',
                        icon: <FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(netRevenue, netRevenuePrev) !== null ? Math.abs(percentChange(netRevenue, netRevenuePrev)).toFixed(0) : undefined,
                        changeType: changeType(percentChange(netRevenue, netRevenuePrev)),
                        changeAbsolute: formatDiff(netRevenue, netRevenuePrev, 'currency'),
                        changePrevValue: netRevenuePrev != null ? netRevenuePrev.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : undefined,
                        tooltip: 'Net sales (after discounts, returns, etc.)',
                        popOverContent: `Net sales = Gross sales - (Discounts + Returns)\n= ${fmt(grossSales)} - (${fmt(discounts)} + ${fmt(returns)})\n= ${fmt(grossSales)} - ${fmt(discounts + returns)}\n= ${fmt(netRevenue)}`,
                        calcValueLabels: `Gross sales: ${fmt(grossSales)}\nDiscounts: ${fmt(discounts)}\nReturns: ${fmt(returns)}`,
                    },
                    {
                        key: 'cogs',
                        label: "- COGS",
                        value: totalCogs ? totalCogs.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : '-',
                        icon: <FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(totalCogs, prevTotalCogs) !== null ? Math.abs(percentChange(totalCogs, prevTotalCogs)).toFixed(0) : undefined,
                        changeType: changeType(percentChange(totalCogs, prevTotalCogs)),
                        changeAbsolute: formatDiff(totalCogs, prevTotalCogs, 'currency'),
                        changePrevValue: prevTotalCogs != null ? prevTotalCogs.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : undefined,
                        popOverContent: fetchCogs
                            ? `COGS (from Shopify store)\n= Sum of cost_of_goods_sold per day\n= ${fmt(totalCogs)}`
                            : `COGS = Net Revenue × COGS %\n= ${fmt(netRevenue)} × ${(cogsPercentage * 100).toFixed(1)}%\n= ${fmt(totalCogs)}`,
                        calcValueLabels: fetchCogs
                            ? `Cost of goods sold (from Shopify): ${fmt(totalCogs)}`
                            : `Net Revenue: ${fmt(netRevenue)}\nCOGS %: ${(cogsPercentage * 100).toFixed(1)}%`,
                    },
                    {
                        key: 'aov',
                        label: "NET AOV",
                        value: aov !== null ? aov.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : '-',
                        icon: <FiShoppingBag className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(aov, aovPrev) !== null ? Math.abs(percentChange(aov, aovPrev)).toFixed(0) : undefined,
                        changeType: changeType(percentChange(aov, aovPrev)),
                        changeAbsolute: formatDiff(aov, aovPrev, 'currency'),
                        changePrevValue: aovPrev != null ? aovPrev.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : undefined,
                        popOverContent: orders > 0 ? `Net AOV = Net Revenue / Orders\n= ${fmt(netRevenue)} / ${orders}\n= ${fmt(aov)}` : null,
                        calcValueLabels: `Net Revenue: ${fmt(netRevenue)}\nOrders: ${orders}`,
                    },
                    {
                        key: 'cost',
                        label: "Spend",
                        value: cost ? cost.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : '-',
                        icon: <FiCreditCard className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(cost, costPrev) !== null ? Math.abs(percentChange(cost, costPrev)).toFixed(0) : undefined,
                        changeType: changeType(percentChange(cost, costPrev)),
                        changeAbsolute: formatDiff(cost, costPrev, 'currency'),
                        changePrevValue: costPrev != null ? costPrev.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : undefined,
                        popOverContent: totalAdspendCalculation,
                        calcValueLabels: apiValueLabels.spend,
                    },
                    {
                        key: 'marketing_spend',
                        label: "Marketing Spend",
                        value: cost ? cost.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : '-',
                        icon: <FiCreditCard className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(cost, costPrev) !== null ? Math.abs(percentChange(cost, costPrev)).toFixed(0) : undefined,
                        changeType: changeType(percentChange(cost, costPrev)),
                        changeAbsolute: formatDiff(cost, costPrev, 'currency'),
                        changePrevValue: costPrev != null ? costPrev.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : undefined,
                        popOverContent: totalAdspendCalculation,
                        calcValueLabels: apiValueLabels.spend,
                    },
                    {
                        key: 'meta_spend',
                        label: "- Meta Spend",
                        value: metaSpend ? metaSpend.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : '-',
                        icon: <FiCreditCard className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(metaSpend, metaSpendPrev) !== null ? Math.abs(percentChange(metaSpend, metaSpendPrev)).toFixed(0) : undefined,
                        changeType: changeType(percentChange(metaSpend, metaSpendPrev)),
                        changeAbsolute: formatDiff(metaSpend, metaSpendPrev, 'currency'),
                        changePrevValue: metaSpendPrev != null ? metaSpendPrev.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : undefined,
                        popOverContent: null,
                    },
                    {
                        key: 'google_spend',
                        label: "- Google Ads Spend",
                        value: googleSpend ? googleSpend.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : '-',
                        icon: <FiCreditCard className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(googleSpend, googleSpendPrev) !== null ? Math.abs(percentChange(googleSpend, googleSpendPrev)).toFixed(0) : undefined,
                        changeType: changeType(percentChange(googleSpend, googleSpendPrev)),
                        changeAbsolute: formatDiff(googleSpend, googleSpendPrev, 'currency'),
                        changePrevValue: googleSpendPrev != null ? googleSpendPrev.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : undefined,
                        popOverContent: null,
                    },
                    {
                        key: 'shipping_cost',
                        label: "- Shipping Cost",
                        value: shippingCost ? shippingCost.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : '-',
                        icon: <FiCreditCard className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(shippingCost, shippingCostPrev) !== null ? Math.abs(percentChange(shippingCost, shippingCostPrev)).toFixed(0) : undefined,
                        changeType: changeType(percentChange(shippingCost, shippingCostPrev)),
                        changeAbsolute: formatDiff(shippingCost, shippingCostPrev, 'currency'),
                        changePrevValue: shippingCostPrev != null ? shippingCostPrev.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : undefined,
                        popOverContent: `Shipping Cost = Shipping per order × Orders\n= ${fmt(shippingCostPerOrder)} × ${orders}\n= ${fmt(shippingCost)}`,
                        calcValueLabels: `Shipping per order: ${fmt(shippingCostPerOrder)}\nOrders: ${orders}`,
                    },
                    {
                        key: 'pick_pack',
                        label: "- Pick & Pack",
                        value: pickPackCost ? pickPackCost.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : '-',
                        icon: <FiCreditCard className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(pickPackCost, pickPackCostPrev) !== null ? Math.abs(percentChange(pickPackCost, pickPackCostPrev)).toFixed(0) : undefined,
                        changeType: changeType(percentChange(pickPackCost, pickPackCostPrev)),
                        changeAbsolute: formatDiff(pickPackCost, pickPackCostPrev, 'currency'),
                        changePrevValue: pickPackCostPrev != null ? pickPackCostPrev.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : undefined,
                        popOverContent: `Pick & Pack = Pick & pack per order × Orders\n= ${fmt(pickNPackCostPerOrder)} × ${orders}\n= ${fmt(pickPackCost)}`,
                        calcValueLabels: `Pick & pack per order: ${fmt(pickNPackCostPerOrder)}\nOrders: ${orders}`,
                    },
                    {
                        key: 'total_expenses',
                        label: "Total Expenses",
                        value: allCosts ? allCosts.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : '-',
                        icon: <FiCreditCard className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(allCosts, allCostsPrev) !== null ? Math.abs(percentChange(allCosts, allCostsPrev)).toFixed(0) : undefined,
                        changeType: changeType(percentChange(allCosts, allCostsPrev)),
                        changeAbsolute: formatDiff(allCosts, allCostsPrev, 'currency'),
                        changePrevValue: allCostsPrev != null ? allCostsPrev.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : undefined,
                        popOverContent: `Total Expenses = COGS + Marketing + Variable + Fixed + Transaction Fee\n= ${fmt(totalCogs)} + ${fmt(cost)} + ${fmt(variableCosts)} + ${fmt(fixedCosts)} + ${fmt(transactionFee)}\n= ${fmt(allCosts)}`,
                        calcValueLabels: `COGS: ${fmt(totalCogs)}\nMarketing Spend: ${fmt(cost)}\nVariable Expenses: ${fmt(variableCosts)}\nFixed Expenses: ${fmt(fixedCosts)}\nTransaction Fee: ${fmt(transactionFee)}`,
                    },
                    {
                        key: 'roas',
                        label: "Blended ROAS",
                        value: roas !== null ? roas.toFixed(2) : '-',
                        icon: <FiBarChart2 className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(roas, roasPrev) !== null ? Math.abs(percentChange(roas, roasPrev)).toFixed(1) : undefined,
                        changeType: changeType(percentChange(roas, roasPrev)),
                        changeAbsolute: formatDiff(roas, roasPrev, 'ratio'),
                        changePrevValue: roasPrev != null ? roasPrev.toFixed(2) : undefined,
                        popOverContent: roasCalculation,
                        calcValueLabels: `Net Revenue: ${fmt(netRevenue)}\nSpend: ${fmt(cost)}`,
                    },
                    {
                        key: 'variable_costs',
                        label: "Variable Expenses",
                        value: variableCosts ? variableCosts.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : '-',
                        icon: <FiCreditCard className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(variableCosts, variableCostsPrev) !== null ? Math.abs(percentChange(variableCosts, variableCostsPrev)).toFixed(0) : undefined,
                        changeType: changeType(percentChange(variableCosts, variableCostsPrev)),
                        changeAbsolute: formatDiff(variableCosts, variableCostsPrev, 'currency'),
                        changePrevValue: variableCostsPrev != null ? variableCostsPrev.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : undefined,
                        popOverContent: `Variable Spend (scale with volume):\n(shipping + pick & pack) × orders\n= (${fmt(shippingCostPerOrder)} + ${fmt(pickNPackCostPerOrder)}) × ${orders}\n= ${fmt(variableCosts)}`,
                        calcValueLabels: `Shipping per order: ${fmt(shippingCostPerOrder)}\nPick & pack per order: ${fmt(pickNPackCostPerOrder)}\nOrders: ${orders}`,
                    },
                    {
                        key: 'fixed_costs',
                        label: "Fixed Expenses",
                        value: fixedCosts ? fixedCosts.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : '-',
                        icon: <FiCreditCard className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(fixedCosts, fixedCostsPrev) !== null ? Math.abs(percentChange(fixedCosts, fixedCostsPrev)).toFixed(0) : undefined,
                        changeType: changeType(percentChange(fixedCosts, fixedCostsPrev)),
                        changeAbsolute: formatDiff(fixedCosts, fixedCostsPrev, 'currency'),
                        changePrevValue: fixedCostsPrev != null ? fixedCostsPrev.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : undefined,
                        popOverContent: `Fixed Spend (prorated for period):\nfixedExpenses (monthly) × sum over each day of (1 / days in that month)\n= ${fmt(fixedExpensesMonthly)} prorated over ${daysInRange} days\n= ${fmt(fixedCosts)}`,
                        calcValueLabels: `Fixed expenses (monthly): ${fmt(fixedExpensesMonthly)}\nDays in range: ${daysInRange}`,
                    },
                    {
                        key: 'poas',
                        label: "Blended POAS",
                        value: poas !== null ? poas.toFixed(2) : '-',
                        icon: <FiPieChart className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(poas, poasPrev) !== null ? Math.abs(percentChange(poas, poasPrev)).toFixed(1) : undefined,
                        changeType: changeType(percentChange(poas, poasPrev)),
                        popOverContent: poasCalculation,
                        calcValueLabels: `Net Profit: ${fmt(ebit)}\nSpend: ${fmt(cost)}`,
                    },
                    {
                        key: 'gross_profit',
                        label: "Gross Profit",
                        value: gross_profit_total_sales ? gross_profit_total_sales.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : '-',
                        icon: <FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(gross_profit_total_sales, gross_profit_total_salesPrev) !== null ? Math.abs(percentChange(gross_profit_total_sales, gross_profit_total_salesPrev)).toFixed(0) : undefined,
                        changeType: changeType(percentChange(gross_profit_total_sales, gross_profit_total_salesPrev)),
                        changeAbsolute: formatDiff(gross_profit_total_sales, gross_profit_total_salesPrev, 'currency'),
                        changePrevValue: gross_profit_total_salesPrev != null ? gross_profit_total_salesPrev.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : undefined,
                        tooltip: 'Net Revenue - COGS',
                        popOverContent: grossProfitCalculation,
                        calcValueLabels: apiValueLabels.grossProfit,
                    },
                    {
                        key: 'returns',
                        label: 'Returns',
                        value: returns ? returns.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : '-',
                        icon: <FiTrendingUp className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(returns, returnsPrev) !== null ? Math.abs(percentChange(returns, returnsPrev)).toFixed(0) : undefined,
                        changeType: changeType(percentChange(returns, returnsPrev)),
                        changeAbsolute: formatDiff(returns, returnsPrev, 'currency'),
                        changePrevValue: returnsPrev != null ? returnsPrev.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : undefined,
                        popOverContent: null,
                    },
                    {
                        key: 'shipping_revenue',
                        label: 'Shipping Charges',
                        value: shippingCharges ? shippingCharges.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : '-',
                        icon: <FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(shippingCharges, shippingChargesPrev) !== null ? Math.abs(percentChange(shippingCharges, shippingChargesPrev)).toFixed(0) : undefined,
                        changeType: changeType(percentChange(shippingCharges, shippingChargesPrev)),
                        changeAbsolute: formatDiff(shippingCharges, shippingChargesPrev, 'currency'),
                        changePrevValue: shippingChargesPrev != null ? shippingChargesPrev.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : undefined,
                        popOverContent: null,
                    },
                    {
                        key: 'transaction_fee',
                        label: 'Transaction Fee',
                        value: transactionFee ? transactionFee.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : '-',
                        icon: <FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(transactionFee, transactionFeePrev) !== null ? Math.abs(percentChange(transactionFee, transactionFeePrev)).toFixed(0) : undefined,
                        changeType: changeType(percentChange(transactionFee, transactionFeePrev)),
                        changeAbsolute: formatDiff(transactionFee, transactionFeePrev, 'currency'),
                        changePrevValue: transactionFeePrev != null ? transactionFeePrev.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : undefined,
                        popOverContent: `Transaction Fee = Net Revenue × ${(transactionCostPct * 100).toFixed(2)}%\n= ${fmt(netRevenue)} × ${(transactionCostPct * 100).toFixed(2)}%\n= ${fmt(transactionFee)}`,
                        calcValueLabels: `Net Revenue: ${fmt(netRevenue)}\nTransaction %: ${(transactionCostPct * 100).toFixed(2)}%`,
                    },
                    {
                        key: 'tax',
                        label: 'Taxes',
                        value: taxes ? taxes.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : '-',
                        icon: <FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(taxes, taxesPrev) !== null ? Math.abs(percentChange(taxes, taxesPrev)).toFixed(0) : undefined,
                        changeType: changeType(percentChange(taxes, taxesPrev)),
                        changeAbsolute: formatDiff(taxes, taxesPrev, 'currency'),
                        changePrevValue: taxesPrev != null ? taxesPrev.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : undefined,
                        popOverContent: null,
                    },
                    {
                        key: 'ebit',
                        label: "Net Profit",
                        value: ebit != null ? ebit.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : '-',
                        icon: <FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(ebit, ebitPrev) !== null ? Math.abs(percentChange(ebit, ebitPrev)).toFixed(0) : undefined,
                        changeType: changeType(percentChange(ebit, ebitPrev)),
                        changeAbsolute: formatDiff(ebit, ebitPrev, 'currency'),
                        changePrevValue: ebitPrev != null ? ebitPrev.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : undefined,
                        popOverContent: `Net Profit = Net Revenue - All Spend\n= ${fmt(netRevenue)} - ${fmt(allCosts)}\n= ${fmt(ebit)}`,
                        calcValueLabels: `Net Revenue: ${fmt(netRevenue)}\nAll Spend (COGS + Fixed + Variable + Transaction Fee + Spend): ${fmt(allCosts)}`,
                    },
                    {
                        key: 'ebit_pct',
                        label: "EBIT%",
                        value: ebitPct !== null ? `${ebitPct.toFixed(1)}%` : '-',
                        icon: <FiPieChart className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(ebitPct, ebitPctPrev) !== null ? Math.abs(percentChange(ebitPct, ebitPctPrev)).toFixed(1) : undefined,
                        changeType: changeType(percentChange(ebitPct, ebitPctPrev)),
                        changeAbsolute: formatDiff(ebitPct, ebitPctPrev, 'pct'),
                        changePrevValue: ebitPctPrev != null ? `${ebitPctPrev.toFixed(1)}%` : undefined,
                        popOverContent: `EBIT = Net Revenue - All Spend\n= ${fmt(netRevenue)} - ${fmt(allCosts)}\n= ${fmt(ebit)}\nEBIT% = (EBIT / Net Revenue) × 100\n= (${fmt(ebit)} / ${fmt(netRevenue)}) × 100\n= ${ebitPct != null ? ebitPct.toFixed(1) : 'N/A'}%`,
                        calcValueLabels: `Net Revenue: ${fmt(netRevenue)}\nAll Spend (COGS + Fixed + Variable + Transaction Fee + Spend): ${fmt(allCosts)}`,
                    },
                ];

                // Add remaining metrics
                metricsArray.push(
                    {
                        key: 'cac',
                        label: "Blended CAC",
                        value: cac !== null ? cac.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : '-',
                        icon: <FiUserCheck className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                        change: percentChange(cac, cacPrev) !== null ? Math.abs(percentChange(cac, cacPrev)).toFixed(0) : undefined,
                        changeType: changeType(percentChange(cac, cacPrev)),
                        changeAbsolute: formatDiff(cac, cacPrev, 'currency'),
                        changePrevValue: cacPrev != null ? cacPrev.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }) : undefined,
                        popOverContent: cacCalculation,
                        calcValueLabels: apiValueLabels.cac,
                    },
                );

        setMetrics(metricsArray);

        setMetricsData({
            total_sales: totalSales,
            revenue: netRevenue,
            gross_profit: gross_profit_total_sales,
            total_expenses: allCosts,
            ebit,
            orders,
            returns,
            cost,
            roas: roas ?? 0,
            poas: poas ?? 0,
            aov,
            cac: cac ?? 0,
            spendshare: netRevenue > 0 ? cost / netRevenue : 0,
            cogs: totalCogs,
            ebit_pct: ebitPct ?? 0,
            fixed_costs: fixedCosts,
            variable_costs: variableCosts,
            shipping_cost: shippingCost,
            pick_pack: pickPackCost,
        });
    }, [customer, appliedDateRange, comparisonMethod, merged, mergedPrev]);

    // Chart color palette from CSS variables
    const [chartColors, setChartColors] = useState({});
    useEffect(() => {
        setChartColors(getChartColors());
    }, []);

    // Graph controls: metric toggles and aggregation (period vs monthly)
    const METRIC_OPTIONS = [
        // Net Revenue section
        { key: 'revenue', label: 'Net Revenue', icon: FiDollarSign },
        { key: 'orders', label: 'Orders', icon: FiShoppingCart },
        { key: 'aov', label: 'Net AOV', icon: FiShoppingBag },
        { key: 'total_sales', label: 'Gross Sales', icon: FiDollarSign },
        { key: 'returns', label: 'Refunds', icon: FiTrendingUp },
        { key: 'gross_profit', label: 'Gross Profit', icon: FiDollarSign },
        // Total Expenses section
        { key: 'cost', label: 'Marketing Spend', icon: FiCreditCard },
        { key: 'variable_costs', label: 'Variable Expenses', icon: FiCreditCard },
        { key: 'cogs', label: 'COGS', icon: FiDollarSign },
        { key: 'pick_pack', label: 'Pick & Pack', icon: FiCreditCard },
        { key: 'fixed_costs', label: 'Fixed Expenses', icon: FiCreditCard },
        // Net Profit section
        { key: 'ebit', label: 'Net Profit', icon: FiDollarSign },
        { key: 'roas', label: 'Blended ROAS', icon: FiTrendingUp },
        { key: 'cac', label: 'Blended CAC', icon: FiUserCheck },
        { key: 'poas', label: 'Blended POAS', icon: FiPieChart },
        { key: 'ebit_pct', label: 'EBIT%', icon: FiPieChart },
    ];
    const [selectedMetrics, setSelectedMetrics] = useState(['revenue']); // revenue default
    const [aggregateBy, setAggregateBy] = useState('period'); // 'period' | 'monthly'
    const [viewMode, setViewMode] = useState('standard'); // 'standard' | 'custom'
    const [showCalcs, setShowCalcs] = useState(false); // Default ON for Standard view

    // Standard view: 3 sections with metrics used in each calculation (primary metric excluded from breakdown)
    const STANDARD_SECTIONS = [
        {
            key: 'net_revenue',
            title: 'Net Revenue',
            metricKeys: ['revenue', 'orders', 'aov', 'gross_sales', 'discounts', 'returns', 'shipping_revenue', 'transaction_fee', 'tax'],
        },
        {
            key: 'total_expenses',
            title: 'Total Expenses',
            metricKeys: ['total_expenses', 'marketing_spend', 'meta_spend', 'google_spend', 'variable_costs', 'cogs', 'shipping_cost', 'pick_pack', 'fixed_costs'],
            variableSubItems: ['cogs', 'shipping_cost', 'pick_pack'], // Indent these under Variable expenses
        },
        {
            key: 'net_profit',
            title: 'Net Profit',
            metricKeys: ['ebit', 'roas', 'cac', 'poas', 'ebit_pct'],
        },
    ];

    // Helper to aggregate daily arrays by keyFn (period or month)
    const aggregateDaily = (shopifyArr, facebookArr, googleArr, keyFn) => {
        const map = {};
        const push = (k, obj) => {
            if (!map[k]) map[k] = { revenue: 0, totalRevenue: 0, orders: 0, cost: 0, costFacebook: 0, costGoogle: 0, cogs: 0, returns: 0 };
            map[k].totalRevenue += Number(obj.total_sales || 0);
            map[k].revenue += Number(obj.net_sales || obj.total_sales || 0);
            map[k].orders += Number(obj.orders || 0);
            map[k].cogs += Number(obj.cost_of_goods_sold || 0);
            map[k].returns += Number(obj.returns || 0);
        };
        (shopifyArr || []).forEach(d => push(keyFn(d.period), d));
        const addSpend = (k, spend, source) => {
            if (!map[k]) map[k] = { revenue: 0, totalRevenue: 0, orders: 0, cost: 0, costFacebook: 0, costGoogle: 0, cogs: 0, returns: 0 };
            const val = Number(spend || 0);
            map[k].cost += val;
            if (source === 'facebook') map[k].costFacebook += val;
            if (source === 'google') map[k].costGoogle += val;
        };
        (facebookArr || []).forEach(d => addSpend(keyFn(d.period), d.spend, 'facebook'));
        (googleArr || []).forEach(d => addSpend(keyFn(d.period), d.spend, 'google'));
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

        const staticExp = customer?.CustomerStaticExpenses || {};
        const fixedBase = Number(staticExp.fixedExpenses) || 0;
        const shippingPerOrder = staticExp.shippingCostPerOrder ?? 0;
        const pickPerOrder = staticExp.pickNPackCostPerOrder ?? 0;
        const txCostPct = staticExp.transactionCostPercentage ?? 0.015;

        const getFixedForPeriod = (k) => {
            if (aggregateBy === 'monthly') {
                return fixedBase; // full month
            }
            const daysInMonth = dayjs(k).daysInMonth();
            return fixedBase / daysInMonth;
        };

        selectedMetrics.forEach((metric) => {
            if (metric === 'cost') {
                const currDataPS = categories.map(k => { const v = currAgg[k]; return v ? Number((v.costFacebook || 0).toFixed(0)) : null; });
                const currDataPPC = categories.map(k => { const v = currAgg[k]; return v ? Number((v.costGoogle || 0).toFixed(0)) : null; });
                const prevDataPS = categories.map((k, idx) => { const prevKey = getPrevKeyForCategory(k, idx); const v = prevAgg[prevKey]; return v ? Number((v.costFacebook || 0).toFixed(0)) : null; });
                const prevDataPPC = categories.map((k, idx) => { const prevKey = getPrevKeyForCategory(k, idx); const v = prevAgg[prevKey]; return v ? Number((v.costGoogle || 0).toFixed(0)) : null; });
                series.push({ name: 'PS Spend (Current)', data: currDataPS });
                series.push({ name: 'PPC Spend (Current)', data: currDataPPC });
                series.push({ name: `PS Spend (${comparisonMethod})`, data: prevDataPS });
                series.push({ name: `PPC Spend (${comparisonMethod})`, data: prevDataPPC });
                return;
            }

            const currData = categories.map(k => {
                const v = currAgg[k];
                if (!v) return null;
                if (metric === 'revenue') return Number(v.revenue.toFixed(0));
                if (metric === 'total_sales') return Number(v.totalRevenue.toFixed(0));
                if (metric === 'returns') return Number((v.returns || 0).toFixed(0));
                if (metric === 'gross_profit') return Number((v.revenue - (v.cogs || 0)).toFixed(0));
                if (metric === 'cogs') return Number((v.cogs || 0).toFixed(0));
                if (metric === 'fixed_costs') return Number(getFixedForPeriod(k).toFixed(0));
                if (metric === 'variable_costs') return Number(((shippingPerOrder + pickPerOrder) * (v.orders || 0)).toFixed(0));
                if (metric === 'pick_pack') return Number(((pickPerOrder || 0) * (v.orders || 0)).toFixed(0));
                if (metric === 'ebit_pct') {
                    const rev = v.revenue || 0;
                    const cogs = v.cogs || 0;
                    const fixed = getFixedForPeriod(k);
                    const variable = (shippingPerOrder + pickPerOrder) * (v.orders || 0);
                    const txFee = rev * txCostPct;
                    const allCosts = cogs + fixed + variable + txFee + v.cost;
                    return rev > 0 ? Number(((rev - allCosts) / rev * 100).toFixed(1)) : null;
                }
                if (metric === 'ebit') {
                    const rev = v.revenue || 0;
                    const cogs = v.cogs || 0;
                    const fixed = getFixedForPeriod(k);
                    const variable = (shippingPerOrder + pickPerOrder) * (v.orders || 0);
                    const txFee = rev * txCostPct;
                    const allCosts = cogs + fixed + variable + txFee + v.cost;
                    return Number((rev - allCosts).toFixed(0));
                }
                if (metric === 'orders') return Number(v.orders || 0);
                if (metric === 'roas') return (v.cost > 0 ? Number((v.revenue / v.cost).toFixed(2)) : null);
                if (metric === 'poas') {
                    const rev = v.revenue || 0;
                    const cogs = v.cogs || 0;
                    const fixed = getFixedForPeriod(k);
                    const variable = (shippingPerOrder + pickPerOrder) * (v.orders || 0);
                    const txFee = rev * txCostPct;
                    const allCosts = cogs + fixed + variable + txFee + v.cost;
                    const ebit = rev - allCosts;
                    return (v.cost > 0 ? Number((ebit / v.cost).toFixed(2)) : null);
                }
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
                if (metric === 'cogs') return Number((v.cogs || 0).toFixed(0));
                if (metric === 'fixed_costs') return Number(getFixedForPeriod(prevKey).toFixed(0));
                if (metric === 'variable_costs') return Number(((shippingPerOrder + pickPerOrder) * (v.orders || 0)).toFixed(0));
                if (metric === 'pick_pack') return Number(((pickPerOrder || 0) * (v.orders || 0)).toFixed(0));
                if (metric === 'ebit_pct') {
                    const rev = v.revenue || 0;
                    const cogs = v.cogs || 0;
                    const fixed = getFixedForPeriod(prevKey);
                    const variable = (shippingPerOrder + pickPerOrder) * (v.orders || 0);
                    const txFee = rev * txCostPct;
                    const allCosts = cogs + fixed + variable + txFee + v.cost;
                    return rev > 0 ? Number(((rev - allCosts) / rev * 100).toFixed(1)) : null;
                }
                if (metric === 'ebit') {
                    const rev = v.revenue || 0;
                    const cogs = v.cogs || 0;
                    const fixed = getFixedForPeriod(prevKey);
                    const variable = (shippingPerOrder + pickPerOrder) * (v.orders || 0);
                    const txFee = rev * txCostPct;
                    const allCosts = cogs + fixed + variable + txFee + v.cost;
                    return Number((rev - allCosts).toFixed(0));
                }
                if (metric === 'orders') return Number(v.orders || 0);
                if (metric === 'roas') return (v.cost > 0 ? Number((v.revenue / v.cost).toFixed(2)) : null);
                if (metric === 'poas') {
                    const rev = v.revenue || 0;
                    const cogs = v.cogs || 0;
                    const fixed = getFixedForPeriod(prevKey);
                    const variable = (shippingPerOrder + pickPerOrder) * (v.orders || 0);
                    const txFee = rev * txCostPct;
                    const allCosts = cogs + fixed + variable + txFee + v.cost;
                    const ebit = rev - allCosts;
                    return (v.cost > 0 ? Number((ebit / v.cost).toFixed(2)) : null);
                }
                if (metric === 'aov') return (v.orders > 0 ? Number((v.revenue / v.orders).toFixed(0)) : null);
                if (metric === 'spendshare') return (v.revenue > 0 ? Number(((v.cost / v.revenue) * 100).toFixed(0)) : null);
                if (metric === 'cac') return (v.orders > 0 ? Number((v.cost / v.orders).toFixed(0)) : null);
                return null;
            });

            series.push({ name: `${METRIC_OPTIONS.find(o=>o.key===metric)?.label || metric} (${comparisonMethod})`, data: prevData });
        });

        const formatChartValue = (v) => (typeof v === 'number' && !isNaN(v) ? v.toLocaleString('da-DK', { maximumFractionDigits: 2, minimumFractionDigits: 0 }) : v);
        const isCurrentSeries = (s) => s.name && s.name.includes('(Current)');
        const options = {
            chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: 'Outfit, sans-serif' },
            xaxis: { categories, labels: { style: { colors: chartColors.primaryLighter || '#406969' } }, axisTicks: { show: true }, axisBorder: { show: true } },
            yaxis: { labels: { style: { colors: chartColors.primary || '#1E2B2B' }, formatter: formatChartValue } },
            tooltip: { theme: 'light', y: { formatter: formatChartValue } },
            colors: [chartColors.primaryLighter || '#406969', chartColors.lime || '#C6ED62', '#94a3b8', '#cbd5e1', chartColors.green || '#213834', '#f1f5f9'],
            stroke: { width: series.map((s) => isCurrentSeries(s) ? 2 : 1), curve: 'smooth', dashArray: series.map((s) => isCurrentSeries(s) ? 0 : 5) },
            fill: { type: 'solid', opacity: series.map((s) => isCurrentSeries(s) ? 1 : 0.5) },
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
                    metrics,
                    metricsData,
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

            {/* View Mode Toggler + Show calcs + Metrics Cards Section */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
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
                <button
                    type="button"
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors focus:outline-none ${showCalcs ? 'bg-[var(--color-primary-searchmind)] text-white border-[var(--color-primary-searchmind)]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                    onClick={() => setShowCalcs((v) => !v)}
                >
                    Show calcs
                </button>
            </div>

            {viewMode === 'standard' ? (
            <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mb-8">
                {loading ? (
                    <div className="col-span-full text-center py-12"><Spinner size={40} color="#406969" /></div>
                ) : error ? (
                    <div className="col-span-full text-center text-red-500 py-12">{error}</div>
                ) : (
                    STANDARD_SECTIONS.map((section) => {
                        const primaryKey = section.metricKeys[0];
                        const breakdownKeys = section.metricKeys.slice(1); // Exclude primary from breakdown
                        const sectionMetrics = metrics
                            .filter((m) => breakdownKeys.includes(m.key))
                            .sort((a, b) => breakdownKeys.indexOf(a.key) - breakdownKeys.indexOf(b.key));
                        const primaryMetric = metrics.find((m) => m.key === primaryKey);
                        const totalSales = metricsData?.total_sales || 0;
                        const primaryValue = primaryKey === 'total_sales' ? totalSales
                            : primaryKey === 'revenue' ? (metricsData?.revenue ?? 0)
                            : primaryKey === 'gross_profit' ? (metricsData?.gross_profit ?? 0)
                            : primaryKey === 'total_expenses' ? (metricsData?.total_expenses ?? 0)
                            : primaryKey === 'ebit' ? (metricsData?.ebit ?? 0)
                            : 0;
                        const pctOfTotal = totalSales > 0 ? ((primaryValue / totalSales) * 100).toFixed(1) : '0';

                        return (
                            <div
                                key={section.key}
                                className="flex flex-col rounded-xl border border-gray-200 bg-white overflow-hidden"
                            >
                                {/* Section header */}
                                <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
                                    <div className="text-sm font-medium text-gray-500 mb-1">{section.title}</div>
                                    <div className="flex items-end justify-between gap-2">
                                        <span className="text-2xl font-bold text-[var(--color-primary-searchmind)]">
                                            {primaryMetric?.value ?? '-'}
                                        </span>
                                        {totalSales > 0 && (
                                            <span className="text-xs text-gray-500 tabular-nums">
                                                {pctOfTotal}% of total sales
                                            </span>
                                        )}
                                    </div>
                                    {primaryMetric?.change !== undefined && (
                                        <div className="mt-2 flex items-center gap-1">
                                            <span className={`text-[0.65rem] rounded-sm font-medium flex items-center justify-end gap-1 px-2 py-1 tabular-nums ${primaryMetric.changeType === 'up' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                                                {primaryMetric.changeType === 'up' ? <FiTrendingUp className="text-sm" /> : <FiTrendingDown className="text-sm" />}
                                                {primaryMetric.change}%
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Section calculation (when Show calcs enabled) */}
                                {showCalcs && primaryMetric?.popOverContent && (
                                    <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/30">
                                        <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-[10px] font-mono text-gray-600 leading-tight">
                                            {primaryMetric.calcValueLabels && (
                                                <div className="mb-1.5 pb-1.5 border-b border-gray-200 space-y-0.5">
                                                    {primaryMetric.calcValueLabels.split('\n').filter(Boolean).map((line, i) => {
                                                        const colonIdx = line.indexOf(':');
                                                        const label = colonIdx >= 0 ? line.slice(0, colonIdx).trim() : line;
                                                        const val = colonIdx >= 0 ? line.slice(colonIdx + 1).trim() : '';
                                                        return (
                                                            <div key={i} className="flex justify-between gap-4">
                                                                <span className="text-gray-500">{label}</span>
                                                                <span className="tabular-nums">{val}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                            <div className="flex flex-col items-end gap-0.5">
                                                {(() => {
                                                    const calcLines = primaryMetric.popOverContent.split('\n').map((l) => l.trim()).filter((l) => l && l.startsWith('=') && /\d/.test(l));
                                                    return calcLines.map((line, i) => (
                                                        <span key={i} className={i === calcLines.length - 1 ? 'font-bold text-[var(--color-primary-searchmind)]' : ''}>
                                                            {line}
                                                        </span>
                                                    ));
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Section breakdown */}
                                <div className="flex flex-col divide-y divide-gray-100">
                                    {sectionMetrics.map((metric) => {
                                        const metricKey = metric.key;
                                        const isVariableSubItem = section.variableSubItems?.includes(metricKey);
                                        const toggleMetricSelection = (key) => {
                                            if (!key) return;
                                            setSelectedMetrics(prev =>
                                                prev.includes(key) ? (prev.length > 1 ? prev.filter(k => k !== key) : prev) : [...prev, key]
                                            );
                                        };
                                        const isSelected = selectedMetrics.includes(metricKey);
                                        const hasCalc = showCalcs && metric.popOverContent;
                                        const calcLines = metric.popOverContent ? metric.popOverContent.split('\n').map((l) => l.trim()).filter((l) => l && l.startsWith('=') && /\d/.test(l)) : [];

                                        return (
                                            <div
                                                key={metric.key}
                                                role="button"
                                                tabIndex={0}
                                                onClick={() => toggleMetricSelection(metricKey)}
                                                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleMetricSelection(metricKey)}
                                                className={`cursor-pointer transition-colors hover:bg-gray-50/50 ${isSelected ? 'bg-[#1E2B2B]/5' : ''}`}
                                                aria-pressed={isSelected}
                                            >
                                                <div className={`px-5 py-3 flex items-center justify-between gap-4 ${isVariableSubItem ? '' : ''}`}>
                                                    <span className="text-sm font-medium text-gray-700">{metric.label}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-semibold tabular-nums text-gray-900">{metric.value}</span>
                                                        <span className={`text-[0.65rem] rounded-sm font-medium flex items-center justify-end gap-0.5 px-1.5 py-0.5 min-w-[4rem] tabular-nums ${metric.changeType === 'up' ? 'text-green-600 bg-green-50' : metric.changeType === 'down' ? 'text-red-600 bg-red-50' : 'text-gray-600 bg-gray-100'}`}>
                                                            {metric.changeType === 'up' ? <FiTrendingUp className="text-xs" /> : metric.changeType === 'down' ? <FiTrendingDown className="text-xs" /> : null}
                                                            {(metric.change ?? 0)}%
                                                        </span>
                                                    </div>
                                                </div>
                                                {hasCalc && calcLines.length > 0 && (
                                                    <div className={`pb-3 pt-0 ${isVariableSubItem ? 'pl-8 pr-5' : 'px-5'}`}>
                                                        <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-[10px] font-mono text-gray-600 leading-tight">
                                                            {metric.calcValueLabels && (
                                                                <div className="mb-1.5 pb-1.5 border-b border-gray-200 space-y-0.5">
                                                                    {metric.calcValueLabels.split('\n').filter(Boolean).map((line, i) => {
                                                                        const colonIdx = line.indexOf(':');
                                                                        const label = colonIdx >= 0 ? line.slice(0, colonIdx).trim() : line;
                                                                        const val = colonIdx >= 0 ? line.slice(colonIdx + 1).trim() : '';
                                                                        return (
                                                                            <div key={i} className="flex justify-between gap-4">
                                                                                <span className="text-gray-500">{label}</span>
                                                                                <span className="tabular-nums">{val}</span>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                            <div className="flex flex-col items-end gap-0.5">
                                                                {calcLines.map((line, i) => (
                                                                    <span key={i} className={i === calcLines.length - 1 ? 'font-bold text-[var(--color-primary-searchmind)]' : ''}>
                                                                        {line}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
            </>
            ) : (
            <div className="mb-8">
                <Custom
                    customerId={params.customerId}
                    metricsData={metricsData}
                    metrics={metrics}
                    showCalcs={showCalcs}
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
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <div className="flex flex-wrap items-center gap-2">
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