"use client"

import DashboardHeading from '@/components/dashboard/DashboardHeading'
import { useCustomers } from "@/hooks/useCustomers";
import { useParams } from "next/navigation";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import { useEffect, useState } from "react";
import React from 'react'
import Spinner from '@/components/ui/Spinner';
import dayjs from 'dayjs';

const DailyOverviewPage = () => {
    const params = useParams();
    const { customers } = useCustomers();
    const customer = customers.find(c => c._id === params.customerId);
    const [revenueTypeState, setRevenueTypeState] = useState("customer?.CustomerSettings?.customerRevenueType || 'total_sales'");
    const [customerMetricPreference, setCustomerMetricPreference] = useState('ROAS/POAS');

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

    // Table data state
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // State for last period (previous contiguous period)
    const [rowsPrev, setRowsPrev] = useState([]);
    
    // State for last year period
    const [rowsLastYear, setRowsLastYear] = useState([]);
    const [loadingLastYear, setLoadingLastYear] = useState(false);
    
    // Hover state for popovers
    const [hoveredRowIndex, setHoveredRowIndex] = useState(null);
    const [hoveredRowTable, setHoveredRowTable] = useState(null); // 'current' or 'lastYear'
    const [hoveredRowPosition, setHoveredRowPosition] = useState({ top: 0, left: 0 });
    const [tableWidth, setTableWidth] = useState(null);
    
    // View mode toggle (Simple/Advanced)
    const [viewMode, setViewMode] = useState('Simple');

    // Helper for fetching period data
    async function fetchPeriodData(customerId, startDate, endDate) {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const res = await fetch(`${baseUrl}/api/merged-sources/${customerId}?startDate=${startDate}&endDate=${endDate}`);
        if (!res.ok) throw new Error('Failed to fetch daily data');
        return await res.json();
    }

    useEffect(() => {
        if (!customer) return;
        
        // Set metric preference from customer settings
        const metricPref = customer?.CustomerSettings?.metricPreference || 'ROAS/POAS';
        setCustomerMetricPreference(metricPref);
        
        setLoading(true);
        setError(null);
        (async () => {
            try {
                // Always fetch current period data
                const merged = await fetchPeriodData(customer._id, appliedDateRange.startDate, appliedDateRange.endDate);
                const shopify = merged.shopifyDaily || [];
                const facebook = merged.facebookDaily || [];
                const google = merged.googleDaily || [];
                const fbMap = Object.fromEntries(facebook.map(d => [d.period, d.spend]));
                const googleMap = Object.fromEntries(google.map(d => [d.period, d.spend]));
                // Get cogsPercentage from customer - used when fetchCogsFromStore is false (COGS = revenueExTax * cogsPercentage)
                let cogsPercentage = 0;
                if (customer?.CustomerStaticExpenses && typeof customer.CustomerStaticExpenses.cogsPercentage === 'number') {
                    cogsPercentage = customer.CustomerStaticExpenses.cogsPercentage;
                }
                // Revenue type logic
                const revenueType = customer?.CustomerSettings?.customerRevenueType || 'total_sales';
                setRevenueTypeState(revenueType);
                
                // Store cogsPercentage for use in last year calculation
                const cogsPercentageValue = cogsPercentage;
                // Get shippingCostPerOrder and transactionCostPercentage for variable expense
                // Defaults: shippingCostPerOrder=35 if 0/empty, transactionCostPercentage=0.015 if empty
                const shippingCostPerOrder = (customer?.CustomerStaticExpenses?.shippingCostPerOrder ?? 0) || 35;
                const transactionCostPercentage = (customer?.CustomerStaticExpenses?.transactionCostPercentage ?? 0.015) || 0.015;
                // Check if fetchCogsFromStore is enabled
                const fetchCogs = customer?.CustomerSettings?.fetchCogsFromStore === true;
                const dailyRows = shopify.map(d => {
                    const date = d.period;
                    const orders = d.orders || 0;
                    const revenue = d[revenueType] || 0;
                    const revenueExTax = revenue / 1.25;
                    const ppcCost = googleMap[date] || 0;
                    const psCost = fbMap[date] || 0;
                    const cost = ppcCost + psCost;
                    const roas = cost > 0 ? revenue / cost : null;
                    const spendshare = revenue > 0 ? cost / revenue : null;
                    // Calculate COGS: use fetched cost_of_goods_sold if enabled, otherwise use revenue * cogsPercentage (from customer)
                    let cogs = 0;
                    if (fetchCogs) {
                        cogs = d.cost_of_goods_sold || 0;
                    } else {
                        cogs = revenue * cogsPercentage;
                    }
                    let poas = null;
                    if (cost > 0) {
                        const grossProfit = revenue - cogs;
                        poas = grossProfit / cost;
                    }
                    const cac = merged.CACTotalSales ?? null;
                    const aov = orders > 0 ? revenue / orders : null;
                    // Variable expense = marketing (ppc+ps) + (shipping per order * orders) + (transaction % * revenue)
                    const variableExpense = cost + (shippingCostPerOrder * orders) + (revenue * transactionCostPercentage);
                    return { date, orders, revenue, revenueExTax, ppcCost, psCost, roas, spendshare, poas, aov, cac, cogs, variableExpense };
                });
                setRows(dailyRows);

                // Always fetch previous period for summary rows
                const start = new Date(appliedDateRange.startDate);
                const end = new Date(appliedDateRange.endDate);
                const days = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
                const prevEnd = new Date(start.getTime() - 1000 * 60 * 60 * 24);
                const prevStart = new Date(prevEnd.getTime() - (days - 1) * 1000 * 60 * 60 * 24);
                const prevStartStr = prevStart.toISOString().slice(0, 10);
                const prevEndStr = prevEnd.toISOString().slice(0, 10);
                const mergedPrev = await fetchPeriodData(customer._id, prevStartStr, prevEndStr);
                const shopifyPrev = mergedPrev.shopifyDaily || [];
                const facebookPrev = mergedPrev.facebookDaily || [];
                const googlePrev = mergedPrev.googleDaily || [];
                const fbMapPrev = Object.fromEntries(facebookPrev.map(d => [d.period, d.spend]));
                const googleMapPrev = Object.fromEntries(googlePrev.map(d => [d.period, d.spend]));
                // Get cogsPercentage for previous period - use same customer value
                const cogsPercentagePrev = cogsPercentageValue;
                const dailyRowsPrev = shopifyPrev.map(d => {
                    const date = d.period;
                    const orders = d.orders || 0;
                    const revenue = d[revenueType] || 0;
                    const revenueExTax = revenue / 1.25;
                    const ppcCost = googleMapPrev[date] || 0;
                    const psCost = fbMapPrev[date] || 0;
                    const cost = ppcCost + psCost;
                    const roas = cost > 0 ? revenue / cost : null;
                    const spendshare = revenue > 0 ? cost / revenue : null;
                    // Calculate COGS: use fetched cost_of_goods_sold if enabled, otherwise use revenue * cogsPercentage (from customer)
                    let cogs = 0;
                    if (fetchCogs) {
                        cogs = d.cost_of_goods_sold || 0;
                    } else {
                        cogs = revenue * cogsPercentagePrev;
                    }
                    const poas = mergedPrev.POASTotalSales ?? null;
                    const cac = mergedPrev.CACTotalSales ?? null;
                    const aov = orders > 0 ? revenue / orders : null;
                    const variableExpense = cost + (shippingCostPerOrder * orders) + (revenue * transactionCostPercentage);
                    return { date, orders, revenue, revenueExTax, ppcCost, psCost, roas, spendshare, poas, aov, cac, cogs, variableExpense };
                });
                setRowsPrev(dailyRowsPrev);
                
                // Fetch last year period data
                setLoadingLastYear(true);
                try {
                    const start = new Date(appliedDateRange.startDate);
                    const end = new Date(appliedDateRange.endDate);
                    const lastYearStart = new Date(start.setFullYear(start.getFullYear() - 1)).toISOString().slice(0, 10);
                    const lastYearEnd = new Date(end.setFullYear(end.getFullYear() - 1)).toISOString().slice(0, 10);
                    const mergedLastYear = await fetchPeriodData(customer._id, lastYearStart, lastYearEnd);
                    const shopifyLastYear = mergedLastYear.shopifyDaily || [];
                    const facebookLastYear = mergedLastYear.facebookDaily || [];
                    const googleLastYear = mergedLastYear.googleDaily || [];
                    const fbMapLastYear = Object.fromEntries(facebookLastYear.map(d => [d.period, d.spend]));
                    const googleMapLastYear = Object.fromEntries(googleLastYear.map(d => [d.period, d.spend]));
                    // Get cogsPercentage for last year - use same customer value
                    const cogsPercentageLastYear = cogsPercentageValue;
                    const dailyRowsLastYear = shopifyLastYear.map(d => {
                        const date = d.period;
                        const orders = d.orders || 0;
                        const revenue = d[revenueType] || 0;
                        const revenueExTax = revenue / 1.25;
                        const ppcCost = googleMapLastYear[date] || 0;
                        const psCost = fbMapLastYear[date] || 0;
                        const cost = ppcCost + psCost;
                        const roas = cost > 0 ? revenue / cost : null;
                        const spendshare = revenue > 0 ? cost / revenue : null;
                        // Calculate COGS: use fetched cost_of_goods_sold if enabled, otherwise use revenue * cogsPercentage (from customer)
                        let cogs = 0;
                        if (fetchCogs) {
                            cogs = d.cost_of_goods_sold || 0;
                        } else {
                            cogs = revenue * cogsPercentageLastYear;
                        }
                        let poas = null;
                        if (cost > 0) {
                            const grossProfit = revenue - cogs;
                            poas = grossProfit / cost;
                        }
                        const cac = mergedLastYear.CACTotalSales ?? null;
                        const aov = orders > 0 ? revenue / orders : null;
                        const variableExpense = cost + (shippingCostPerOrder * orders) + (revenue * transactionCostPercentage);
                        return { date, orders, revenue, revenueExTax, ppcCost, psCost, roas, spendshare, poas, aov, cac, cogs, variableExpense };
                    });
                    setRowsLastYear(dailyRowsLastYear);
                } catch (err) {
                    console.error('Error fetching last year data:', err);
                    setRowsLastYear([]);
                } finally {
                    setLoadingLastYear(false);
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        })();
    }, [customer, appliedDateRange]);

    return (
        <div id='DailyOverviewPage' className="w-full">
            <DashboardHeading
                title="Daily Overview"
                label={customer ? customer.customerName : ""}
                customerId={params.customerId}
                dateRange={appliedDateRange}
                loading={loading}
                dashboardType="daily-overview"
                dataSnapshot={{
                    dailyRows: rows,
                    previousPeriodRows: rowsPrev,
                    lastYearRows: rowsLastYear,
                    metricPreference: customerMetricPreference,
                    revenueType: revenueTypeState
                }}
                right={
                    <DateRangePicker
                        onApply={handleDateRangeApply}
                        startDate={tempDateRange.startDate}
                        endDate={tempDateRange.endDate}
                        onStartDateChange={handleStartDateChange}
                        onEndDateChange={handleEndDateChange}
                    />
                }
            />
            <div className="mt-8 bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-semibold">Daily Metrics</h3>
                    <div className={`flex border border-gray-200 bg-gray-100 rounded-lg overflow-hidden ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <button
                            disabled={loading}
                            className={`px-4 py-1 text-sm font-medium focus:outline-none transition-colors duration-150 ${viewMode === 'Simple' ? 'bg-white text-[var(--color-primary-searchmind)] shadow-sm' : 'text-gray-500 hover:text-[var(--color-primary-searchmind)]'} ${loading ? 'cursor-not-allowed' : ''}`}
                            style={{ borderRadius: '8px 0 0 8px' }}
                            onClick={() => !loading && setViewMode('Simple')}
                        >
                            Simple
                        </button>
                        <button
                            disabled={loading}
                            className={`px-4 py-1 text-sm font-medium focus:outline-none transition-colors duration-150 ${viewMode === 'Advanced' ? 'bg-white text-[var(--color-primary-searchmind)] shadow-sm' : 'text-gray-500 hover:text-[var(--color-primary-searchmind)]'} ${loading ? 'cursor-not-allowed' : ''}`}
                            style={{ borderRadius: '0 8px 8px 0' }}
                            onClick={() => !loading && setViewMode('Advanced')}
                        >
                            Advanced
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center min-h-[200px]"><Spinner size={40} color="#406969" /></div>
                ) : error ? (
                    <div className="text-red-500 text-center">{error}</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-xs text-left border-collapse" style={{ fontSize: '12px' }}>
                            <thead>
                                <tr className="bg-gray-50">
                                    <th className="px-3 py-1.5 font-semibold text-gray-700">Date</th>
                                    <th className="px-3 py-1.5 font-semibold text-gray-700">Orders</th>
                                    <th className="px-3 py-1.5 font-semibold text-gray-700">Revenue {revenueTypeState === 'net_sales' ? `(${revenueTypeState})` : ''}</th>
                                    <th className="px-3 py-1.5 font-semibold text-gray-700">Revenue ex tax</th>
                                    <th className="px-3 py-1.5 font-semibold text-gray-700">PPC Cost</th>
                                    <th className="px-3 py-1.5 font-semibold text-gray-700">PS Cost</th>
                                    <th className="px-3 py-1.5 font-semibold text-gray-700">
                                        {customerMetricPreference === 'Spendshare' ? 'Spendshare' : 'ROAS'}
                                    </th>
                                    <th className="px-3 py-1.5 font-semibold text-gray-700">POAS</th>
                                    <th className="px-3 py-1.5 font-semibold text-gray-700">AOV</th>
                                    {viewMode === 'Advanced' && (
                                        <>
                                            <th className="px-3 py-1.5 font-semibold text-gray-700">COGS</th>
                                            <th className="px-3 py-1.5 font-semibold text-gray-700">Variable Expense</th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="text-[12px]">
                                {rows.length === 0 ? (
                                    <tr><td colSpan={viewMode === 'Advanced' ? 12 : 10} className="text-center py-8 text-gray-400">No data for selected range.</td></tr>
                                ) : rows.map((row, idx) => {
                                    // Heatmap logic: find max for each column
                                    const max = {
                                        orders: Math.max(...rows.map(r => r.orders)),
                                        revenue: Math.max(...rows.map(r => r.revenue)),
                                        revenueExTax: Math.max(...rows.map(r => r.revenueExTax)),
                                        ppcCost: Math.max(...rows.map(r => r.ppcCost)),
                                        psCost: Math.max(...rows.map(r => r.psCost)),
                                        roas: Math.max(...rows.map(r => r.roas ?? 0)),
                                        spendshare: Math.max(...rows.map(r => r.spendshare ?? 0)),
                                        poas: Math.max(...rows.map(r => r.poas ?? 0)),
                                        aov: Math.max(...rows.map(r => r.aov ?? 0)),
                                        cac: Math.max(...rows.map(r => r.cac ?? 0)),
                                    };
                                    // Helper for cell color
                                    function heat(val, maxVal) {
                                        if (!maxVal || maxVal === 0) return undefined;
                                        const base = 0.15 + 0.85 * (val / maxVal); // 0.15-1.0
                                        return `background-color: rgba(214,205,182,${base})`;
                                    }
                                    
                                    // Find corresponding row in last year period
                                    const lastYearDate = dayjs(row.date).subtract(1, 'year').format('YYYY-MM-DD');
                                    const correspondingLastYearRow = rowsLastYear.find(r => r.date === lastYearDate);
                                    
                                    return (
                                        <tr 
                                            key={idx} 
                                            className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                                            onMouseEnter={(e) => {
                                                if (correspondingLastYearRow) {
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    const table = e.currentTarget.closest('table');
                                                    const tableRect = table?.getBoundingClientRect();
                                                    setHoveredRowIndex(idx);
                                                    setHoveredRowTable('current');
                                                    setHoveredRowPosition({ top: rect.top + rect.height / 2, left: rect.left + rect.width / 2 });
                                                    setTableWidth(tableRect?.width || null);
                                                }
                                            }}
                                            onMouseLeave={() => {
                                                setHoveredRowIndex(null);
                                                setHoveredRowTable(null);
                                                setTableWidth(null);
                                            }}
                                        >
                                            <td className="px-3 py-2 whitespace-nowrap">{row.date}</td>
                                            <td className="px-3 py-2 whitespace-nowrap" style={{ ...((row.orders === max.orders) && { fontWeight: 600 }), ...(row.orders > 0 ? { backgroundColor: `rgba(214,205,182,${0.15 + 0.85 * (row.orders / max.orders)})` } : {}) }}>{row.orders}</td>
                                            <td className="px-3 py-2 whitespace-nowrap" style={{ ...((row.revenue === max.revenue) && { fontWeight: 600 }), ...(row.revenue > 0 ? { backgroundColor: `rgba(214,205,182,${0.15 + 0.85 * (row.revenue / max.revenue)})` } : {}) }}>{row.revenue.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                            <td className="px-3 py-2 whitespace-nowrap" style={{ ...((row.revenueExTax === max.revenueExTax) && { fontWeight: 600 }), ...(row.revenueExTax > 0 ? { backgroundColor: `rgba(214,205,182,${0.15 + 0.85 * (row.revenueExTax / max.revenueExTax)})` } : {}) }}>{row.revenueExTax.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                            <td className="px-3 py-2 whitespace-nowrap" style={{ ...((row.ppcCost === max.ppcCost) && { fontWeight: 600 }), ...(row.ppcCost > 0 ? { backgroundColor: `rgba(214,205,182,${0.15 + 0.85 * (row.ppcCost / max.ppcCost)})` } : {}) }}>{row.ppcCost.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                            <td className="px-3 py-2 whitespace-nowrap" style={{ ...((row.psCost === max.psCost) && { fontWeight: 600 }), ...(row.psCost > 0 ? { backgroundColor: `rgba(214,205,182,${0.15 + 0.85 * (row.psCost / max.psCost)})` } : {}) }}>{row.psCost.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                            <td className="px-3 py-2 whitespace-nowrap" style={{ 
                                                ...((customerMetricPreference === 'Spendshare' ? row.spendshare === max.spendshare : row.roas === max.roas) && { fontWeight: 600 }), 
                                                ...(customerMetricPreference === 'Spendshare' 
                                                    ? (row.spendshare > 0 ? { backgroundColor: `rgba(214,205,182,${0.15 + 0.85 * (row.spendshare / max.spendshare)})` } : {})
                                                    : (row.roas > 0 ? { backgroundColor: `rgba(214,205,182,${0.15 + 0.85 * (row.roas / max.roas)})` } : {})
                                                )
                                            }}>
                                                {customerMetricPreference === 'Spendshare' 
                                                    ? (row.spendshare !== null ? `${(row.spendshare * 100).toFixed(2)}%` : '-')
                                                    : (row.roas !== null ? row.roas.toFixed(2) : '-')
                                                }
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap" style={{ ...((row.poas === max.poas) && { fontWeight: 600 }), ...(row.poas > 0 ? { backgroundColor: `rgba(214,205,182,${0.15 + 0.85 * (row.poas / max.poas)})` } : {}) }}>{row.poas !== null ? row.poas.toFixed(2) : '-'}</td>
                                            <td className="px-3 py-2 whitespace-nowrap" style={{ ...((row.aov === max.aov) && { fontWeight: 600 }), ...(row.aov > 0 ? { backgroundColor: `rgba(214,205,182,${0.15 + 0.85 * (row.aov / max.aov)})` } : {}) }}>{row.aov !== null ? row.aov.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' }) : '-'}</td>
                                            {viewMode === 'Advanced' && (
                                                <>
                                                    <td className="px-3 py-2 whitespace-nowrap">{(row.cogs || 0).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                                    <td className="px-3 py-2 whitespace-nowrap">{(row.variableExpense || 0).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                                </>
                                            )}
                                        </tr>
                                    );
                                })}
                                {/* Totals row */}
                                {rows.length > 0 && (
                                    <tr className="bg-gray-100 font-semibold">
                                        <td className="px-3 py-2 whitespace-nowrap">Total</td>
                                        <td className="px-3 py-2 whitespace-nowrap">{rows.reduce((sum, r) => sum + r.orders, 0)}</td>
                                        <td className="px-3 py-2 whitespace-nowrap">{rows.reduce((sum, r) => sum + r.revenue, 0).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                        <td className="px-3 py-2 whitespace-nowrap">{rows.reduce((sum, r) => sum + r.revenueExTax, 0).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                        <td className="px-3 py-2 whitespace-nowrap">{rows.reduce((sum, r) => sum + r.ppcCost, 0).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                        <td className="px-3 py-2 whitespace-nowrap">{rows.reduce((sum, r) => sum + r.psCost, 0).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            {customerMetricPreference === 'Spendshare' 
                                                ? (() => { const c = rows.reduce((sum, r) => sum + (r.spendshare ?? 0), 0); return c > 0 ? `${((c / rows.length) * 100).toFixed(2)}%` : '-'; })()
                                                : (() => { const c = rows.reduce((sum, r) => sum + (r.roas ?? 0), 0); return c > 0 ? (c / rows.length).toFixed(2) : '-'; })()
                                            }
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">{(() => { const c = rows.reduce((sum, r) => sum + (r.poas ?? 0), 0); return c > 0 ? (c / rows.length).toFixed(2) : '-'; })()}</td>
                                        <td className="px-3 py-2 whitespace-nowrap">{(() => { const c = rows.reduce((sum, r) => sum + (r.aov ?? 0), 0); return c > 0 ? (c / rows.length).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' }) : '-'; })()}</td>
                                        {viewMode === 'Advanced' && (
                                            <>
                                                <td className="px-3 py-2 whitespace-nowrap">{rows.reduce((sum, r) => sum + (r.cogs || 0), 0).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                                <td className="px-3 py-2 whitespace-nowrap">{rows.reduce((sum, r) => sum + (r.variableExpense || 0), 0).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                            </>
                                        )}
                                    </tr>
                                )}
                                {/* Last period totals row */}
                                {rowsPrev.length > 0 && (
                                    <tr className="bg-gray-50 font-semibold">
                                        <td className="px-3 py-2 whitespace-nowrap">Last Period</td>
                                        <td className="px-3 py-2 whitespace-nowrap">{rowsPrev.reduce((sum, r) => sum + r.orders, 0)}</td>
                                        <td className="px-3 py-2 whitespace-nowrap">{rowsPrev.reduce((sum, r) => sum + r.revenue, 0).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                        <td className="px-3 py-2 whitespace-nowrap">{rowsPrev.reduce((sum, r) => sum + r.revenueExTax, 0).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                        <td className="px-3 py-2 whitespace-nowrap">{rowsPrev.reduce((sum, r) => sum + r.ppcCost, 0).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                        <td className="px-3 py-2 whitespace-nowrap">{rowsPrev.reduce((sum, r) => sum + r.psCost, 0).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            {customerMetricPreference === 'Spendshare' 
                                                ? (() => { const c = rowsPrev.reduce((sum, r) => sum + (r.spendshare ?? 0), 0); return c > 0 ? `${((c / rowsPrev.length) * 100).toFixed(2)}%` : '-'; })()
                                                : (() => { const c = rowsPrev.reduce((sum, r) => sum + (r.roas ?? 0), 0); return c > 0 ? (c / rowsPrev.length).toFixed(2) : '-'; })()
                                            }
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">{(() => { const c = rowsPrev.reduce((sum, r) => sum + (r.poas ?? 0), 0); return c > 0 ? (c / rowsPrev.length).toFixed(2) : '-'; })()}</td>
                                        <td className="px-3 py-2 whitespace-nowrap">{(() => { const c = rowsPrev.reduce((sum, r) => sum + (r.aov ?? 0), 0); return c > 0 ? (c / rowsPrev.length).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' }) : '-'; })()}</td>
                                        {viewMode === 'Advanced' && (
                                            <>
                                        <td className="px-3 py-2 whitespace-nowrap">{rowsPrev.reduce((sum, r) => sum + (r.cogs || 0), 0).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                        <td className="px-3 py-2 whitespace-nowrap">{rowsPrev.reduce((sum, r) => sum + (r.variableExpense || 0), 0).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                            </>
                                        )}
                                    </tr>
                                )}
                                {/* Difference row */}
                                {rows.length > 0 && rowsPrev.length > 0 && (
                                    <tr className="bg-gray-200 font-semibold">
                                        <td className="px-3 py-2 whitespace-nowrap">Difference</td>
                                        <td className="px-3 py-2 whitespace-nowrap">{rows.reduce((sum, r) => sum + r.orders, 0) - rowsPrev.reduce((sum, r) => sum + r.orders, 0)}</td>
                                        <td className="px-3 py-2 whitespace-nowrap">{(rows.reduce((sum, r) => sum + r.revenue, 0) - rowsPrev.reduce((sum, r) => sum + r.revenue, 0)).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                        <td className="px-3 py-2 whitespace-nowrap">{(rows.reduce((sum, r) => sum + r.revenueExTax, 0) - rowsPrev.reduce((sum, r) => sum + r.revenueExTax, 0)).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                        <td className="px-3 py-2 whitespace-nowrap">{(rows.reduce((sum, r) => sum + r.ppcCost, 0) - rowsPrev.reduce((sum, r) => sum + r.ppcCost, 0)).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                        <td className="px-3 py-2 whitespace-nowrap">{(rows.reduce((sum, r) => sum + r.psCost, 0) - rowsPrev.reduce((sum, r) => sum + r.psCost, 0)).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            {customerMetricPreference === 'Spendshare' 
                                                ? (() => { 
                                                    const curr = rows.reduce((sum, r) => sum + (r.spendshare ?? 0), 0) / rows.length;
                                                    const prev = rowsPrev.reduce((sum, r) => sum + (r.spendshare ?? 0), 0) / rowsPrev.length;
                                                    const diff = curr - prev;
                                                    return diff !== 0 ? `${(diff * 100).toFixed(2)}%` : '-';
                                                })()
                                                : (() => { 
                                                    const curr = rows.reduce((sum, r) => sum + (r.roas ?? 0), 0) / rows.length;
                                                    const prev = rowsPrev.reduce((sum, r) => sum + (r.roas ?? 0), 0) / rowsPrev.length;
                                                    const diff = curr - prev;
                                                    return diff !== 0 ? diff.toFixed(2) : '-';
                                                })()
                                            }
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">{(() => { const c = rows.reduce((sum, r) => sum + (r.poas ?? 0), 0) - rowsPrev.reduce((sum, r) => sum + (r.poas ?? 0), 0); return c !== 0 ? c.toFixed(2) : '-'; })()}</td>
                                        <td className="px-3 py-2 whitespace-nowrap">{(() => { const c = rows.reduce((sum, r) => sum + (r.aov ?? 0), 0) - rowsPrev.reduce((sum, r) => sum + (r.aov ?? 0), 0); return c !== 0 ? c.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' }) : '-'; })()}</td>
                                        {viewMode === 'Advanced' && (
                                            <>
                                                <td className="px-3 py-2 whitespace-nowrap">{(rows.reduce((sum, r) => sum + (r.cogs || 0), 0) - rowsPrev.reduce((sum, r) => sum + (r.cogs || 0), 0)).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                                <td className="px-3 py-2 whitespace-nowrap">{(rows.reduce((sum, r) => sum + (r.variableExpense || 0), 0) - rowsPrev.reduce((sum, r) => sum + (r.variableExpense || 0), 0)).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                            </>
                                        )}
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Popover for row comparison */}
            {hoveredRowIndex !== null && hoveredRowTable && (
                <div
                    className="fixed z-50 pointer-events-none"
                    style={{
                        top: `${hoveredRowPosition.top + 20}px`,
                        left: `${hoveredRowPosition.left}px`,
                        transform: 'translateX(-50%)',
                    }}
                >
                    <div 
                        className="bg-white border border-gray-300 rounded-lg shadow-xl p-4"
                        style={{
                            width: tableWidth ? `${tableWidth}px` : 'auto',
                            minWidth: tableWidth ? `${tableWidth}px` : '500px',
                        }}
                    >
                        {/* Arrow */}
                        <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-white"></div>
                        <div className="absolute -top-2.5 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-gray-300"></div>
                        
                        <div className="text-xs font-semibold text-gray-700 mb-2">
                            {hoveredRowTable === 'current' ? 'Last Year Period' : 'Current Period'}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-xs text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50">
                                        <th className="px-2 py-1 font-semibold text-gray-700">Date</th>
                                        <th className="px-2 py-1 font-semibold text-gray-700">Orders</th>
                                        <th className="px-2 py-1 font-semibold text-gray-700">Revenue</th>
                                        <th className="px-2 py-1 font-semibold text-gray-700">Revenue ex tax</th>
                                        <th className="px-2 py-1 font-semibold text-gray-700">PPC</th>
                                        <th className="px-2 py-1 font-semibold text-gray-700">PS</th>
                                        <th className="px-2 py-1 font-semibold text-gray-700">{customerMetricPreference === 'Spendshare' ? 'SS' : 'ROAS'}</th>
                                        <th className="px-2 py-1 font-semibold text-gray-700">POAS</th>
                                        <th className="px-2 py-1 font-semibold text-gray-700">AOV</th>
                                        {viewMode === 'Advanced' && (
                                            <>
                                                <th className="px-2 py-1 font-semibold text-gray-700">COGS</th>
                                                <th className="px-2 py-1 font-semibold text-gray-700">Variable Expense</th>
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {(() => {
                                        let comparisonRow = null;
                                        if (hoveredRowTable === 'current' && hoveredRowIndex !== null) {
                                            const currentRow = rows[hoveredRowIndex];
                                            const lastYearDate = dayjs(currentRow.date).subtract(1, 'year').format('YYYY-MM-DD');
                                            comparisonRow = rowsLastYear.find(r => r.date === lastYearDate);
                                        } else if (hoveredRowTable === 'lastYear' && hoveredRowIndex !== null) {
                                            const lastYearRow = rowsLastYear[hoveredRowIndex];
                                            const currentDate = dayjs(lastYearRow.date).add(1, 'year').format('YYYY-MM-DD');
                                            comparisonRow = rows.find(r => r.date === currentDate);
                                        }
                                        
                                        if (!comparisonRow) {
                                            return (
                                                <tr>
                                                    <td colSpan={viewMode === 'Advanced' ? 11 : 9} className="px-2 py-2 text-center text-gray-400">No corresponding data</td>
                                                </tr>
                                            );
                                        }
                                        
                                        return (
                                            <tr className="bg-white">
                                                <td className="px-2 py-2 whitespace-nowrap">{comparisonRow.date}</td>
                                                <td className="px-2 py-2 whitespace-nowrap">{comparisonRow.orders}</td>
                                                <td className="px-2 py-2 whitespace-nowrap">{comparisonRow.revenue.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                                <td className="px-2 py-2 whitespace-nowrap">{comparisonRow.revenueExTax.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                                <td className="px-2 py-2 whitespace-nowrap">{comparisonRow.ppcCost.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                                <td className="px-2 py-2 whitespace-nowrap">{comparisonRow.psCost.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                                <td className="px-2 py-2 whitespace-nowrap">
                                                    {customerMetricPreference === 'Spendshare' 
                                                        ? (comparisonRow.spendshare !== null ? `${(comparisonRow.spendshare * 100).toFixed(2)}%` : '-')
                                                        : (comparisonRow.roas !== null ? comparisonRow.roas.toFixed(2) : '-')
                                                    }
                                                </td>
                                                <td className="px-2 py-2 whitespace-nowrap">{comparisonRow.poas !== null ? comparisonRow.poas.toFixed(2) : '-'}</td>
                                                <td className="px-2 py-2 whitespace-nowrap">{comparisonRow.aov !== null ? comparisonRow.aov.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' }) : '-'}</td>
                                                {viewMode === 'Advanced' && (
                                                    <>
                                                        <td className="px-2 py-2 whitespace-nowrap">{(comparisonRow.cogs || 0).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                                        <td className="px-2 py-2 whitespace-nowrap">{(comparisonRow.variableExpense || 0).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                                    </>
                                                )}
                                            </tr>
                                        );
                                    })()}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Last Year Period Table */}
            <div className="mt-8 bg-gray-50 rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold mb-5">Last Year Period</h3>
                {loadingLastYear ? (
                    <div className="flex justify-center items-center min-h-[200px]"><Spinner size={40} color="#406969" /></div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-xs text-left border-collapse" style={{ fontSize: '12px' }}>
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="px-3 py-1.5 font-semibold text-gray-700">Date</th>
                                    <th className="px-3 py-1.5 font-semibold text-gray-700">Orders</th>
                                    <th className="px-3 py-1.5 font-semibold text-gray-700">Revenue {revenueTypeState === 'net_sales' ? `(${revenueTypeState})` : ''}</th>
                                    <th className="px-3 py-1.5 font-semibold text-gray-700">Revenue ex tax</th>
                                    <th className="px-3 py-1.5 font-semibold text-gray-700">PPC Cost</th>
                                    <th className="px-3 py-1.5 font-semibold text-gray-700">PS Cost</th>
                                    <th className="px-3 py-1.5 font-semibold text-gray-700">
                                        {customerMetricPreference === 'Spendshare' ? 'Spendshare' : 'ROAS'}
                                    </th>
                                    <th className="px-3 py-1.5 font-semibold text-gray-700">POAS</th>
                                    <th className="px-3 py-1.5 font-semibold text-gray-700">AOV</th>
                                    {viewMode === 'Advanced' && (
                                        <>
                                            <th className="px-3 py-1.5 font-semibold text-gray-700">COGS</th>
                                            <th className="px-3 py-1.5 font-semibold text-gray-700">Variable Expense</th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="text-[12px]">
                                {rowsLastYear.length === 0 ? (
                                    <tr><td colSpan={viewMode === 'Advanced' ? 11 : 9} className="text-center py-8 text-gray-400">No data for last year period.</td></tr>
                                ) : (
                                    <>
                                        {/* Totals row - moved to top */}
                                        <tr className="bg-gray-100 font-semibold">
                                            <td className="px-3 py-2 whitespace-nowrap">Total</td>
                                            <td className="px-3 py-2 whitespace-nowrap">{rowsLastYear.reduce((sum, r) => sum + r.orders, 0)}</td>
                                            <td className="px-3 py-2 whitespace-nowrap">{rowsLastYear.reduce((sum, r) => sum + r.revenue, 0).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                            <td className="px-3 py-2 whitespace-nowrap">{rowsLastYear.reduce((sum, r) => sum + r.revenueExTax, 0).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                            <td className="px-3 py-2 whitespace-nowrap">{rowsLastYear.reduce((sum, r) => sum + r.ppcCost, 0).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                            <td className="px-3 py-2 whitespace-nowrap">{rowsLastYear.reduce((sum, r) => sum + r.psCost, 0).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                {customerMetricPreference === 'Spendshare' 
                                                    ? (() => { const c = rowsLastYear.reduce((sum, r) => sum + (r.spendshare ?? 0), 0); return c > 0 ? `${((c / rowsLastYear.length) * 100).toFixed(2)}%` : '-'; })()
                                                    : (() => { const c = rowsLastYear.reduce((sum, r) => sum + (r.roas ?? 0), 0); return c > 0 ? (c / rowsLastYear.length).toFixed(2) : '-'; })()
                                                }
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">{(() => { const c = rowsLastYear.reduce((sum, r) => sum + (r.poas ?? 0), 0); return c > 0 ? (c / rowsLastYear.length).toFixed(2) : '-'; })()}</td>
                                            <td className="px-3 py-2 whitespace-nowrap">{(() => { const c = rowsLastYear.reduce((sum, r) => sum + (r.aov ?? 0), 0); return c > 0 ? (c / rowsLastYear.length).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' }) : '-'; })()}</td>
                                            {viewMode === 'Advanced' && (
                                                <>
                                                    <td className="px-3 py-2 whitespace-nowrap">{rowsLastYear.reduce((sum, r) => sum + (r.cogs || 0), 0).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                                    <td className="px-3 py-2 whitespace-nowrap">{rowsLastYear.reduce((sum, r) => sum + (r.variableExpense || 0), 0).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                                </>
                                            )}
                                        </tr>
                                        {rowsLastYear.map((row, idx) => {
                                    // Heatmap logic: find max for each column
                                    const max = {
                                        orders: Math.max(...rowsLastYear.map(r => r.orders)),
                                        revenue: Math.max(...rowsLastYear.map(r => r.revenue)),
                                        revenueExTax: Math.max(...rowsLastYear.map(r => r.revenueExTax)),
                                        ppcCost: Math.max(...rowsLastYear.map(r => r.ppcCost)),
                                        psCost: Math.max(...rowsLastYear.map(r => r.psCost)),
                                        roas: Math.max(...rowsLastYear.map(r => r.roas ?? 0)),
                                        spendshare: Math.max(...rowsLastYear.map(r => r.spendshare ?? 0)),
                                        poas: Math.max(...rowsLastYear.map(r => r.poas ?? 0)),
                                        aov: Math.max(...rowsLastYear.map(r => r.aov ?? 0)),
                                    };
                                    
                                    // Find corresponding row in current period
                                    const currentDate = dayjs(row.date).add(1, 'year').format('YYYY-MM-DD');
                                    const correspondingCurrentRow = rows.find(r => r.date === currentDate);
                                    
                                    return (
                                        <tr 
                                            key={idx} 
                                            className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                                            onMouseEnter={(e) => {
                                                if (correspondingCurrentRow) {
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    const table = e.currentTarget.closest('table');
                                                    const tableRect = table?.getBoundingClientRect();
                                                    setHoveredRowIndex(idx);
                                                    setHoveredRowTable('lastYear');
                                                    setHoveredRowPosition({ top: rect.top + rect.height / 2, left: rect.left + rect.width / 2 });
                                                    setTableWidth(tableRect?.width || null);
                                                }
                                            }}
                                            onMouseLeave={() => {
                                                setHoveredRowIndex(null);
                                                setHoveredRowTable(null);
                                                setTableWidth(null);
                                            }}
                                        >
                                            <td className="px-3 py-2 whitespace-nowrap">{row.date}</td>
                                            <td className="px-3 py-2 whitespace-nowrap" style={{ ...((row.orders === max.orders) && { fontWeight: 600 }), ...(row.orders > 0 ? { backgroundColor: `rgba(214,205,182,${0.15 + 0.85 * (row.orders / max.orders)})` } : {}) }}>{row.orders}</td>
                                            <td className="px-3 py-2 whitespace-nowrap" style={{ ...((row.revenue === max.revenue) && { fontWeight: 600 }), ...(row.revenue > 0 ? { backgroundColor: `rgba(214,205,182,${0.15 + 0.85 * (row.revenue / max.revenue)})` } : {}) }}>{row.revenue.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                            <td className="px-3 py-2 whitespace-nowrap" style={{ ...((row.revenueExTax === max.revenueExTax) && { fontWeight: 600 }), ...(row.revenueExTax > 0 ? { backgroundColor: `rgba(214,205,182,${0.15 + 0.85 * (row.revenueExTax / max.revenueExTax)})` } : {}) }}>{row.revenueExTax.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                            <td className="px-3 py-2 whitespace-nowrap" style={{ ...((row.ppcCost === max.ppcCost) && { fontWeight: 600 }), ...(row.ppcCost > 0 ? { backgroundColor: `rgba(214,205,182,${0.15 + 0.85 * (row.ppcCost / max.ppcCost)})` } : {}) }}>{row.ppcCost.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                            <td className="px-3 py-2 whitespace-nowrap" style={{ ...((row.psCost === max.psCost) && { fontWeight: 600 }), ...(row.psCost > 0 ? { backgroundColor: `rgba(214,205,182,${0.15 + 0.85 * (row.psCost / max.psCost)})` } : {}) }}>{row.psCost.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                            <td className="px-3 py-2 whitespace-nowrap" style={{ 
                                                ...((customerMetricPreference === 'Spendshare' ? row.spendshare === max.spendshare : row.roas === max.roas) && { fontWeight: 600 }), 
                                                ...(customerMetricPreference === 'Spendshare' 
                                                    ? (row.spendshare > 0 ? { backgroundColor: `rgba(214,205,182,${0.15 + 0.85 * (row.spendshare / max.spendshare)})` } : {})
                                                    : (row.roas > 0 ? { backgroundColor: `rgba(214,205,182,${0.15 + 0.85 * (row.roas / max.roas)})` } : {})
                                                )
                                            }}>
                                                {customerMetricPreference === 'Spendshare' 
                                                    ? (row.spendshare !== null ? `${(row.spendshare * 100).toFixed(2)}%` : '-')
                                                    : (row.roas !== null ? row.roas.toFixed(2) : '-')
                                                }
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap" style={{ ...((row.poas === max.poas) && { fontWeight: 600 }), ...(row.poas > 0 ? { backgroundColor: `rgba(214,205,182,${0.15 + 0.85 * (row.poas / max.poas)})` } : {}) }}>{row.poas !== null ? row.poas.toFixed(2) : '-'}</td>
                                            <td className="px-3 py-2 whitespace-nowrap" style={{ ...((row.aov === max.aov) && { fontWeight: 600 }), ...(row.aov > 0 ? { backgroundColor: `rgba(214,205,182,${0.15 + 0.85 * (row.aov / max.aov)})` } : {}) }}>{row.aov !== null ? row.aov.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' }) : '-'}</td>
                                            {viewMode === 'Advanced' && (
                                                <>
                                                    <td className="px-3 py-2 whitespace-nowrap">{(row.cogs || 0).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                                    <td className="px-3 py-2 whitespace-nowrap">{(row.variableExpense || 0).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                                </>
                                            )}
                                        </tr>
                                    );
                                })}
                                    </>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

export default DailyOverviewPage