"use client";

import React, { useEffect, useState, useMemo } from "react";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import { useParams } from "next/navigation";
import MetricCard from "@/components/dashboard/MetricCard";
import Spinner from "@/components/ui/Spinner";
import { FiTrendingUp, FiDollarSign, FiShoppingCart, FiPercent } from "react-icons/fi";
import FormButton from "@/components/form/FormButton";
import Link from "next/link";
import ParentRevenueOrdersChart from "./components/ParentRevenueOrdersChart";
import ParenteAdspendChart from "./components/ParentAdspendChart";
import ParentROASChart from "./components/ParentROASChart";

export default function ParentPropertyHome() {
    const params = useParams();
    const parentCustomerId = params.parentCustomerId;
    const [parentCustomer, setParentCustomer] = useState(null);
    const [childCustomers, setChildCustomers] = useState([]);
    const [allTableRows, setAllTableRows] = useState([]); // Store all fetched data
    const [enabledProperties, setEnabledProperties] = useState({}); // Track which properties are enabled
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [allDailyChartData, setAllDailyChartData] = useState([]); // Store all daily data
    const [chartLoading, setChartLoading] = useState(false);

    // Separate temp (input) and applied (fetch-triggered) date ranges
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const defaultEnd = `${yyyy}-${mm}-${dd}`;
    const defaultStart = `${yyyy}-${mm}-01`;
    const [tempDateRange, setTempDateRange] = useState({ startDate: defaultStart, endDate: defaultEnd });
    const [appliedDateRange, setAppliedDateRange] = useState({ startDate: defaultStart, endDate: defaultEnd });

    // Comparison method: applied (triggers fetch) vs temp (picker until Apply)
    const [comparisonMethod, setComparisonMethod] = useState("Last Year");
    const [tempComparisonMethod, setTempComparisonMethod] = useState("Last Year");
    // Determine the predominant metric preference from child customers
    const [predominantMetricPreference, setPredominantMetricPreference] = useState('ROAS/POAS');

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

    // Toggle property enable/disable
    const toggleProperty = (customerId, newState) => {
        setEnabledProperties(prev => ({
            ...prev,
            [customerId]: newState
        }));
    };

    // Initialize enabled properties when child customers are loaded
    useEffect(() => {
        if (childCustomers.length > 0) {
            const initialEnabled = {};
            childCustomers.forEach(customer => {
                initialEnabled[customer._id] = true; // All enabled by default
            });
            setEnabledProperties(initialEnabled);
        }
    }, [childCustomers]);

    // Fetch parent customer and its child customers
    useEffect(() => {
        setLoading(true);
        setError(null);
        (async () => {
            try {
                const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
                const res = await fetch(`${baseUrl}/api/parent-customers/${parentCustomerId}`);
                if (!res.ok) throw new Error("Failed to fetch parent customer");
                const parent = await res.json();
                setParentCustomer(parent);
                setChildCustomers(parent.customers || []);
            } catch (err) {
                setError(err.message);
                setChildCustomers([]);
            } finally {
                setLoading(false);
            }
        })();
    }, [parentCustomerId]);

    // Helper for percent change
    function percentChange(current, prev) {
        if (prev === 0 || prev === null || prev === undefined) return null;
        return ((current - prev) / Math.abs(prev)) * 100;
    }

    // Fetch metrics for all child customers (store all data)
    useEffect(() => {
        if (!childCustomers.length) {
            setAllTableRows([]);
            setAllDailyChartData([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        setChartLoading(true);
        setError(null);
        (async () => {
            try {
                const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

                const start = new Date(appliedDateRange.startDate);
                const end = new Date(appliedDateRange.endDate);
                const msDay = 24 * 60 * 60 * 1000;
                const days = Math.floor((end - start) / msDay) + 1;

                let prevStart, prevEnd;
                if (comparisonMethod === "Last Year") {
                    prevStart = new Date(start);
                    prevStart.setFullYear(prevStart.getFullYear() - 1);
                    prevEnd = new Date(end);
                    prevEnd.setFullYear(prevEnd.getFullYear() - 1);
                } else {
                    const prevEndMs = start.getTime() - msDay;
                    const prevStartMs = prevEndMs - (days - 1) * msDay;
                    prevStart = new Date(prevStartMs);
                    prevEnd = new Date(prevEndMs);
                }
                const prevStartStr = prevStart.toISOString().slice(0, 10);
                const prevEndStr = prevEnd.toISOString().slice(0, 10);

                // Fetch merged data for all child customers in parallel
                const [results, resultsPrev, dailyResults] = await Promise.all([
                    Promise.all(
                        childCustomers.map(async (customer) => {
                            const res = await fetch(`${baseUrl}/api/merged-sources/${customer._id}?startDate=${appliedDateRange.startDate}&endDate=${appliedDateRange.endDate}&source=parent-property`);
                            if (!res.ok) throw new Error("Failed to fetch data for " + customer.customerName);
                            const merged = await res.json();
                            const revenueType = customer?.CustomerSettings?.customerRevenueType || 'total_sales';
                            const metricPreference = customer?.CustomerSettings?.metricPreference || 'ROAS/POAS';
                            const shopify = merged.shopifyDaily || [];
                            const facebook = merged.facebookDaily || [];
                            const google = merged.googleDaily || [];
                            const revenue = shopify.reduce((sum, d) => sum + (d[revenueType] || 0), 0);
                            const orders = shopify.reduce((sum, d) => sum + (d.orders || 0), 0);
                            const adspend = [...facebook, ...google].reduce((sum, d) => sum + (d.spend || 0), 0);
                            const aov = orders > 0 ? revenue / orders : 0;
                            const roas = adspend > 0 ? revenue / adspend : null;
                            const spendshare = revenue > 0 ? adspend / revenue : null;
                            return {
                                _id: customer._id,
                                customerName: customer.customerName,
                                revenue,
                                orders,
                                adspend,
                                roas,
                                spendshare,
                                aov,
                                revenueType,
                                metricPreference,
                            };
                        })
                    ),
                    Promise.all(
                        childCustomers.map(async (customer) => {
                            const res = await fetch(`${baseUrl}/api/merged-sources/${customer._id}?startDate=${prevStartStr}&endDate=${prevEndStr}&source=parent-property`);
                            if (!res.ok) return { revenue: 0, adspend: 0, orders: 0, roas: null, spendshare: null };
                            const merged = await res.json();
                            const revenueType = customer?.CustomerSettings?.customerRevenueType || 'total_sales';
                            const shopify = merged.shopifyDaily || [];
                            const facebook = merged.facebookDaily || [];
                            const google = merged.googleDaily || [];
                            const revenue = shopify.reduce((sum, d) => sum + (d[revenueType] || 0), 0);
                            const orders = shopify.reduce((sum, d) => sum + (d.orders || 0), 0);
                            const adspend = [...facebook, ...google].reduce((sum, d) => sum + (d.spend || 0), 0);
                            const roas = adspend > 0 ? revenue / adspend : null;
                            const spendshare = revenue > 0 ? adspend / revenue : null;
                            return { _id: customer._id, revenue, adspend, orders, roas, spendshare };
                        })
                    ),
                    // Fetch daily data for charts
                    Promise.all(
                        childCustomers.map(async (customer) => {
                            const res = await fetch(`${baseUrl}/api/merged-sources/${customer._id}?startDate=${appliedDateRange.startDate}&endDate=${appliedDateRange.endDate}&source=parent-property`);
                            if (!res.ok) return null;
                            const merged = await res.json();
                            const revenueType = customer?.CustomerSettings?.customerRevenueType || 'total_sales';
                            return {
                                _id: customer._id,
                                shopifyDaily: merged.shopifyDaily || [],
                                facebookDaily: merged.facebookDaily || [],
                                googleDaily: merged.googleDaily || [],
                                revenueType,
                            };
                        })
                    )
                ]);

                // Store all fetched data
                const rowsWithPrev = results.map((row, idx) => ({
                    ...row,
                    prevData: resultsPrev[idx]
                }));
                setAllTableRows(rowsWithPrev);

                // Store all daily data with customer ID
                setAllDailyChartData(dailyResults.filter(r => r !== null));

                // Determine predominant metric preference from all results
                const preferenceCounts = results.reduce((acc, r) => {
                    acc[r.metricPreference] = (acc[r.metricPreference] || 0) + 1;
                    return acc;
                }, {});
                const predominant = Object.keys(preferenceCounts).reduce((a, b) =>
                    preferenceCounts[a] > preferenceCounts[b] ? a : b, 'ROAS/POAS'
                );
                setPredominantMetricPreference(predominant);

            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
                setChartLoading(false);
            }
        })();
    }, [childCustomers, appliedDateRange, comparisonMethod]);

    // Filter data based on enabled properties
    const { filteredTableRows, filteredDailyData, metrics, metricsPrev } = useMemo(() => {
        const filtered = allTableRows.filter(row => enabledProperties[row._id]);

        // Aggregate filtered daily data
        const dailyMap = {};
        allDailyChartData
            .filter(result => enabledProperties[result._id])
            .forEach(result => {
                const { shopifyDaily, facebookDaily, googleDaily, revenueType } = result;

                shopifyDaily.forEach(d => {
                    if (!dailyMap[d.period]) {
                        dailyMap[d.period] = { period: d.period, revenue: 0, orders: 0, facebookSpend: 0, googleSpend: 0 };
                    }
                    dailyMap[d.period].revenue += d[revenueType] || 0;
                    dailyMap[d.period].orders += d.orders || 0;
                });

                facebookDaily.forEach(d => {
                    if (!dailyMap[d.period]) {
                        dailyMap[d.period] = { period: d.period, revenue: 0, orders: 0, facebookSpend: 0, googleSpend: 0 };
                    }
                    dailyMap[d.period].facebookSpend += d.spend || 0;
                });

                googleDaily.forEach(d => {
                    if (!dailyMap[d.period]) {
                        dailyMap[d.period] = { period: d.period, revenue: 0, orders: 0, facebookSpend: 0, googleSpend: 0 };
                    }
                    dailyMap[d.period].googleSpend += d.spend || 0;
                });
            });

        const aggregatedDaily = Object.values(dailyMap).sort((a, b) => a.period.localeCompare(b.period));

        // Calculate metrics from filtered data
        const totalRevenue = filtered.reduce((sum, r) => sum + r.revenue, 0);
        const totalAdspend = filtered.reduce((sum, r) => sum + r.adspend, 0);
        const totalOrders = filtered.reduce((sum, r) => sum + r.orders, 0);
        const combinedRoas = totalAdspend > 0 ? totalRevenue / totalAdspend : null;
        const combinedSpendshare = totalRevenue > 0 ? totalAdspend / totalRevenue : null;

        const totalRevenuePrev = filtered.reduce((sum, r) => sum + (r.prevData?.revenue || 0), 0);
        const totalAdspendPrev = filtered.reduce((sum, r) => sum + (r.prevData?.adspend || 0), 0);
        const totalOrdersPrev = filtered.reduce((sum, r) => sum + (r.prevData?.orders || 0), 0);
        const combinedRoasPrev = totalAdspendPrev > 0 ? totalRevenuePrev / totalAdspendPrev : null;
        const combinedSpendsharePrev = totalRevenuePrev > 0 ? totalAdspendPrev / totalRevenuePrev : null;

        return {
            filteredTableRows: filtered,
            filteredDailyData: aggregatedDaily,
            metrics: { revenue: totalRevenue, adspend: totalAdspend, orders: totalOrders, roas: combinedRoas, spendshare: combinedSpendshare },
            metricsPrev: { revenue: totalRevenuePrev, adspend: totalAdspendPrev, orders: totalOrdersPrev, roas: combinedRoasPrev, spendshare: combinedSpendsharePrev }
        };
    }, [allTableRows, allDailyChartData, enabledProperties]);

    // Metric cards config - conditionally show either ROAS or Spendshare
    const metricCards = [
        {
            label: "Combined Revenue",
            value: metrics.revenue.toLocaleString("da-DK", { style: "currency", currency: "DKK" }),
            change: percentChange(metrics.revenue, metricsPrev.revenue) !== null ? Math.abs(percentChange(metrics.revenue, metricsPrev.revenue)).toFixed(1) : undefined,
            changeType: percentChange(metrics.revenue, metricsPrev.revenue) > 0 ? "up" : percentChange(metrics.revenue, metricsPrev.revenue) < 0 ? "down" : undefined,
            icon: <FiDollarSign />,
        },
        {
            label: "Total Adspend",
            value: metrics.adspend.toLocaleString("da-DK", { style: "currency", currency: "DKK" }),
            change: percentChange(metrics.adspend, metricsPrev.adspend) !== null ? Math.abs(percentChange(metrics.adspend, metricsPrev.adspend)).toFixed(1) : undefined,
            changeType: percentChange(metrics.adspend, metricsPrev.adspend) > 0 ? "up" : percentChange(metrics.adspend, metricsPrev.adspend) < 0 ? "down" : undefined,
            icon: <FiTrendingUp />,
        },
        {
            label: "Total Orders",
            value: metrics.orders.toLocaleString(),
            change: percentChange(metrics.orders, metricsPrev.orders) !== null ? Math.abs(percentChange(metrics.orders, metricsPrev.orders)).toFixed(1) : undefined,
            changeType: percentChange(metrics.orders, metricsPrev.orders) > 0 ? "up" : percentChange(metrics.orders, metricsPrev.orders) < 0 ? "down" : undefined,
            icon: <FiShoppingCart />,
        },
    ];

    // Add either Combined ROAS or Spendshare based on predominant preference
    if (predominantMetricPreference === 'Spendshare') {
        metricCards.push({
            label: "Combined Spendshare",
            value: metrics.spendshare !== null ? (metrics.spendshare * 100).toFixed(2) + "%" : "-",
            change: percentChange(metrics.spendshare, metricsPrev.spendshare) !== null ? Math.abs(percentChange(metrics.spendshare, metricsPrev.spendshare)).toFixed(1) : undefined,
            changeType: percentChange(metrics.spendshare, metricsPrev.spendshare) > 0 ? "up" : percentChange(metrics.spendshare, metricsPrev.spendshare) < 0 ? "down" : undefined,
            icon: <FiPercent />,
        });
    } else {
        metricCards.push({
            label: "Combined ROAS",
            value: metrics.roas !== null ? metrics.roas.toFixed(2) : "-",
            change: percentChange(metrics.roas, metricsPrev.roas) !== null ? Math.abs(percentChange(metrics.roas, metricsPrev.roas)).toFixed(1) : undefined,
            changeType: percentChange(metrics.roas, metricsPrev.roas) > 0 ? "up" : percentChange(metrics.roas, metricsPrev.roas) < 0 ? "down" : undefined,
            icon: <FiPercent />,
        });
    }

    return (
        <div className="w-full">
            <DashboardHeading
                title="Parent Property Overview"
                label={parentCustomer?.name || parentCustomerId}
                customerId={parentCustomerId}
                dateRange={appliedDateRange}
                loading={loading}
                dashboardType="parent-property"
                dataSnapshot={{ metrics, metricsPrev, tableRows: filteredTableRows, dailyChartData: filteredDailyData, predominantMetricPreference }}
                right={
                    <DateRangePicker
                        startDate={tempDateRange.startDate}
                        endDate={tempDateRange.endDate}
                        onStartDateChange={handleStartDateChange}
                        onEndDateChange={handleEndDateChange}
                        onApply={handleDateRangeApply}
                        loading={loading}
                        showComparisonMethodToggler={true}
                        comparisonMethod={tempComparisonMethod}
                        onComparisonMethodChange={setTempComparisonMethod}
                    />
                }
                comparisonMethod={comparisonMethod}
            />

            {/* Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 w-full mb-8">
                {metricCards.map((card, idx) => (
                    <MetricCard
                        key={idx}
                        label={card.label}
                        value={card.value}
                        icon={card.icon}
                        change={card.change}
                        changeType={card.changeType}
                        comparisonMethod={comparisonMethod}
                    />
                ))}
            </div>

            {/* Table Section with Property Toggles */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Child Properties</h3>
                </div>
                {loading ? (
                    <div className="flex justify-center items-center min-h-[120px]"><Spinner size={40} /></div>
                ) : error ? (
                    <div className="text-red-500 text-center">{error}</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-xs text-left border-collapse" style={{ fontSize: '13px' }}>
                            <thead>
                                <tr className="bg-gray-50">
                                    <th className="px-3 py-1.5 font-semibold text-gray-700">Property Name</th>
                                    <th className="px-3 py-1.5 font-semibold text-gray-700">Revenue</th>
                                    <th className="px-3 py-1.5 font-semibold text-gray-700">Orders</th>
                                    <th className="px-3 py-1.5 font-semibold text-gray-700">Ad Spend</th>
                                    <th className="px-3 py-1.5 font-semibold text-gray-700">
                                        {predominantMetricPreference === 'Spendshare' ? 'Spendshare' : 'ROAS'}
                                    </th>
                                    <th className="px-3 py-1.5 font-semibold text-gray-700">AOV</th>
                                    <th className="px-3 py-1.5 font-semibold text-gray-700">Actions</th>
                                    <th className="px-3 py-1.5 font-semibold text-gray-700">Filter</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allTableRows.length === 0 ? (
                                    <tr><td colSpan={8} className="text-center py-8 text-gray-400">No child properties found.</td></tr>
                                ) : allTableRows.map((row, idx) => {
                                    const isEnabled = enabledProperties[row._id];
                                    return (
                                        <tr 
                                            key={row._id} 
                                            className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} ${!isEnabled ? 'opacity-40' : ''} transition-opacity`}
                                        >
                                            <td className="px-3 py-2 whitespace-nowrap">{row.customerName}</td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                {row.revenue.toLocaleString("da-DK", { style: "currency", currency: "DKK" })}
                                                {row.revenueType === 'net_sales' && (
                                                    <span className="ml-1 text-xs text-gray-400">(net sales)</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">{row.orders.toLocaleString()}</td>
                                            <td className="px-3 py-2 whitespace-nowrap">{row.adspend.toLocaleString("da-DK", { style: "currency", currency: "DKK" })}</td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                {row.metricPreference === 'Spendshare' ? (
                                                    row.spendshare !== null ? `${(row.spendshare * 100).toFixed(2)}%` : "-"
                                                ) : (
                                                    row.roas !== null ? row.roas.toFixed(2) : "-"
                                                )}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">{row.aov ? row.aov.toLocaleString("da-DK", { style: "currency", currency: "DKK" }) : "-"}</td>
                                            <td className="px-3 py-2 whitespace-nowrap flex gap-2">
                                                <Link href={`/dashboard/${row._id}/performance-dashboard`}>
                                                    <FormButton buttonSize="small" borderType="outline">View Dashboard</FormButton>
                                                </Link>
                                                <Link href={`/dashboard/${row._id}/config`}>
                                                    <FormButton buttonSize="small" borderType="outline">Config</FormButton>
                                                </Link>
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                <div className="flex border border-gray-200 bg-gray-100 rounded-lg overflow-hidden w-fit">
                                                    <button
                                                        className={`px-3 py-1 text-xs font-medium focus:outline-none transition-colors duration-150 ${!isEnabled ? 'bg-white text-[var(--color-primary-searchmind)] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                                        onClick={() => toggleProperty(row._id, false)}
                                                    >
                                                        Off
                                                    </button>
                                                    <button
                                                        className={`px-3 py-1 text-xs font-medium focus:outline-none transition-colors duration-150 ${isEnabled ? 'bg-white text-[var(--color-primary-searchmind)] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                                        onClick={() => toggleProperty(row._id, true)}
                                                    >
                                                        On
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full mb-8">
                <ParentRevenueOrdersChart dailyData={filteredDailyData} loading={chartLoading} />
                <ParenteAdspendChart dailyData={filteredDailyData} loading={chartLoading} />
                <ParentROASChart
                    dailyData={filteredDailyData}
                    loading={chartLoading}
                    metricPreference={predominantMetricPreference}
                />
            </div>
        </div>
    );
}