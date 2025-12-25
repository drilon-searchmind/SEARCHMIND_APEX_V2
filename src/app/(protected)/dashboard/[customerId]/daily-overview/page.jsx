"use client"

import DashboardHeading from '@/components/dashboard/DashboardHeading'
import { useCustomers } from "@/hooks/useCustomers";
import { useParams } from "next/navigation";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import { useEffect, useState } from "react";
import React from 'react'
import Spinner from '@/components/ui/Spinner';

const DailyOverviewPage = () => {
    const params = useParams();
    const { customers } = useCustomers();
    const customer = customers.find(c => c._id === params.customerId);
    const [toggle, setToggle] = useState("Current Period");

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

    // Table data state
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Helper for fetching period data
    async function fetchPeriodData(customerId, startDate, endDate) {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const res = await fetch(`${baseUrl}/api/merged-sources/${customerId}?startDate=${startDate}&endDate=${endDate}`);
        if (!res.ok) throw new Error('Failed to fetch daily data');
        return await res.json();
    }

    // State for last period
    const [rowsPrev, setRowsPrev] = useState([]);

    useEffect(() => {
        if (!customer) return;
        setLoading(true);
        setError(null);
        (async () => {
            try {
                let startDate = dateRange.startDate;
                let endDate = dateRange.endDate;
                if (toggle === 'Last Year Period') {
                    // Shift period to last year
                    const start = new Date(dateRange.startDate);
                    const end = new Date(dateRange.endDate);
                    startDate = new Date(start.setFullYear(start.getFullYear() - 1)).toISOString().slice(0, 10);
                    endDate = new Date(end.setFullYear(end.getFullYear() - 1)).toISOString().slice(0, 10);
                }
                // Fetch for selected period (current or last year)
                const merged = await fetchPeriodData(customer._id, startDate, endDate);
                const shopify = merged.shopifyDaily || [];
                const facebook = merged.facebookDaily || [];
                const google = merged.googleDaily || [];
                const fbMap = Object.fromEntries(facebook.map(d => [d.period, d.spend]));
                const googleMap = Object.fromEntries(google.map(d => [d.period, d.spend]));
                // Get cogsPercentage for daily POAS calculation
                let cogsPercentage = 1;
                if (merged.CustomerStaticExpenses && typeof merged.CustomerStaticExpenses.cogsPercentage === 'number') {
                    cogsPercentage = merged.CustomerStaticExpenses.cogsPercentage;
                }
                if (!cogsPercentage) {
                    console.warn('cogsPercentage missing or 0, using 1.0 as fallback');
                    cogsPercentage = 1;
                }
                const dailyRows = shopify.map(d => {
                    const date = d.period;
                    const orders = d.orders || 0;
                    const revenue = d.total_sales || 0;
                    const revenueExTax = revenue / 1.25;
                    const ppcCost = googleMap[date] || 0;
                    const psCost = fbMap[date] || 0;
                    const cost = ppcCost + psCost;
                    const roas = cost > 0 ? revenue / cost : null;
                    let poas = null;
                    if (cost > 0) {
                        const grossProfit = (revenue * cogsPercentage) - cost;
                        poas = grossProfit / cost;
                    }
                    const cac = merged.CACTotalSales ?? null;
                    const aov = orders > 0 ? revenue / orders : null;
                    return { date, orders, revenue, revenueExTax, ppcCost, psCost, roas, poas, aov, cac };
                });
                setRows(dailyRows);

                // Always fetch previous period for summary rows
                const start = new Date(dateRange.startDate);
                const end = new Date(dateRange.endDate);
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
                const dailyRowsPrev = shopifyPrev.map(d => {
                    const date = d.period;
                    const orders = d.orders || 0;
                    const revenue = d.total_sales || 0;
                    const revenueExTax = revenue / 1.25;
                    const ppcCost = googleMapPrev[date] || 0;
                    const psCost = fbMapPrev[date] || 0;
                    const cost = ppcCost + psCost;
                    const roas = cost > 0 ? revenue / cost : null;
                    const poas = mergedPrev.POASTotalSales ?? null;
                    const cac = mergedPrev.CACTotalSales ?? null;
                    const aov = orders > 0 ? revenue / orders : null;
                    return { date, orders, revenue, revenueExTax, ppcCost, psCost, roas, poas, aov, cac };
                });
                setRowsPrev(dailyRowsPrev);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        })();
    }, [customer, dateRange, toggle]);

    return (
        <div id='DailyOverviewPage' className="w-full">
            <DashboardHeading
                title="Daily Overview"
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
            <div className="mt-8 bg-white rounded-xl border border-gray-200 p-6">
                <span className='flex items-center justify-between mb-5'>
                    <h3 className="text-lg font-semibold">Daily Metrics</h3>
                    <div id="chartToggler">
                        <div className="flex border border-gray-200 bg-gray-100 rounded-lg overflow-hidden">
                            <button
                                className={`px-4 py-1 text-sm font-medium focus:outline-none transition-colors duration-150 ${toggle === 'Last Year Period' ? 'bg-white text-[var(--color-primary-searchmind)] shadow-sm' : 'text-gray-500 hover:text-[var(--color-primary-searchmind)]'}`}
                                style={{ borderRadius: '8px 0 0 8px' }}
                                onClick={() => setToggle('Last Year Period')}
                            >
                                Last Year Period
                            </button>
                            <button
                                className={`px-4 py-1 text-sm font-medium focus:outline-none transition-colors duration-150 ${toggle === 'Current Period' ? 'bg-white text-[var(--color-primary-searchmind)] shadow-sm' : 'text-gray-500 hover:text-[var(--color-primary-searchmind)]'}`}
                                style={{ borderRadius: '0 8px 8px 0' }}
                                onClick={() => setToggle('Current Period')}
                            >
                                Current Period
                            </button>
                        </div>
                    </div>
                </span>

                {loading ? (
                    <div className="flex justify-center items-center min-h-[200px]"><Spinner size={40} color="#406969" /></div>
                ) : error ? (
                    <div className="text-red-500 text-center">{error}</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-xs text-left border-collapse" style={{ fontSize: '14px' }}>
                            <thead>
                                <tr className="bg-gray-50">
                                    <th className="px-3 py-1.5 font-semibold text-gray-700">Date</th>
                                    <th className="px-3 py-1.5 font-semibold text-gray-700">Orders</th>
                                    <th className="px-3 py-1.5 font-semibold text-gray-700">Revenue</th>
                                    <th className="px-3 py-1.5 font-semibold text-gray-700">Revenue ex tax</th>
                                    <th className="px-3 py-1.5 font-semibold text-gray-700">PPC Cost</th>
                                    <th className="px-3 py-1.5 font-semibold text-gray-700">PS Cost</th>
                                    <th className="px-3 py-1.5 font-semibold text-gray-700">ROAS</th>
                                    <th className="px-3 py-1.5 font-semibold text-gray-700">POAS</th>
                                    <th className="px-3 py-1.5 font-semibold text-gray-700">AOV</th>
                                </tr>
                            </thead>
                            <tbody className="text-[12px]">
                                {rows.length === 0 ? (
                                    <tr><td colSpan={10} className="text-center py-8 text-gray-400">No data for selected range.</td></tr>
                                ) : rows.map((row, idx) => {
                                    // Heatmap logic: find max for each column
                                    const max = {
                                        orders: Math.max(...rows.map(r => r.orders)),
                                        revenue: Math.max(...rows.map(r => r.revenue)),
                                        revenueExTax: Math.max(...rows.map(r => r.revenueExTax)),
                                        ppcCost: Math.max(...rows.map(r => r.ppcCost)),
                                        psCost: Math.max(...rows.map(r => r.psCost)),
                                        roas: Math.max(...rows.map(r => r.roas ?? 0)),
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
                                    return (
                                        <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                            <td className="px-3 py-1.5 whitespace-nowrap">{row.date}</td>
                                            <td className="px-3 py-1.5 whitespace-nowrap" style={{ ...((row.orders === max.orders) && { fontWeight: 600 }), ...(row.orders > 0 ? { backgroundColor: `rgba(214,205,182,${0.15 + 0.85 * (row.orders / max.orders)})` } : {}) }}>{row.orders}</td>
                                            <td className="px-3 py-1.5 whitespace-nowrap" style={{ ...((row.revenue === max.revenue) && { fontWeight: 600 }), ...(row.revenue > 0 ? { backgroundColor: `rgba(214,205,182,${0.15 + 0.85 * (row.revenue / max.revenue)})` } : {}) }}>{row.revenue.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                            <td className="px-3 py-1.5 whitespace-nowrap" style={{ ...((row.revenueExTax === max.revenueExTax) && { fontWeight: 600 }), ...(row.revenueExTax > 0 ? { backgroundColor: `rgba(214,205,182,${0.15 + 0.85 * (row.revenueExTax / max.revenueExTax)})` } : {}) }}>{row.revenueExTax.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                            <td className="px-3 py-1.5 whitespace-nowrap" style={{ ...((row.ppcCost === max.ppcCost) && { fontWeight: 600 }), ...(row.ppcCost > 0 ? { backgroundColor: `rgba(214,205,182,${0.15 + 0.85 * (row.ppcCost / max.ppcCost)})` } : {}) }}>{row.ppcCost.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                            <td className="px-3 py-1.5 whitespace-nowrap" style={{ ...((row.psCost === max.psCost) && { fontWeight: 600 }), ...(row.psCost > 0 ? { backgroundColor: `rgba(214,205,182,${0.15 + 0.85 * (row.psCost / max.psCost)})` } : {}) }}>{row.psCost.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                            <td className="px-3 py-1.5 whitespace-nowrap" style={{ ...((row.roas === max.roas) && { fontWeight: 600 }), ...(row.roas > 0 ? { backgroundColor: `rgba(214,205,182,${0.15 + 0.85 * (row.roas / max.roas)})` } : {}) }}>{row.roas !== null ? row.roas.toFixed(2) : '-'}</td>
                                            <td className="px-3 py-1.5 whitespace-nowrap" style={{ ...((row.poas === max.poas) && { fontWeight: 600 }), ...(row.poas > 0 ? { backgroundColor: `rgba(214,205,182,${0.15 + 0.85 * (row.poas / max.poas)})` } : {}) }}>{row.poas !== null ? row.poas.toFixed(2) : '-'}</td>
                                            <td className="px-3 py-1.5 whitespace-nowrap" style={{ ...((row.aov === max.aov) && { fontWeight: 600 }), ...(row.aov > 0 ? { backgroundColor: `rgba(214,205,182,${0.15 + 0.85 * (row.aov / max.aov)})` } : {}) }}>{row.aov !== null ? row.aov.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' }) : '-'}</td>
                                        </tr>
                                    );
                                })}
                                {/* Totals row */}
                                {rows.length > 0 && (
                                    <tr className="bg-gray-100 font-semibold">
                                        <td className="px-3 py-1.5 whitespace-nowrap">Total</td>
                                        <td className="px-3 py-1.5 whitespace-nowrap">{rows.reduce((sum, r) => sum + r.orders, 0)}</td>
                                        <td className="px-3 py-1.5 whitespace-nowrap">{rows.reduce((sum, r) => sum + r.revenue, 0).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                        <td className="px-3 py-1.5 whitespace-nowrap">{rows.reduce((sum, r) => sum + r.revenueExTax, 0).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                        <td className="px-3 py-1.5 whitespace-nowrap">{rows.reduce((sum, r) => sum + r.ppcCost, 0).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                        <td className="px-3 py-1.5 whitespace-nowrap">{rows.reduce((sum, r) => sum + r.psCost, 0).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                        <td className="px-3 py-1.5 whitespace-nowrap">{(() => { const c = rows.reduce((sum, r) => sum + (r.roas ?? 0), 0); return c > 0 ? (c / rows.length).toFixed(2) : '-'; })()}</td>
                                        <td className="px-3 py-1.5 whitespace-nowrap">{(() => { const c = rows.reduce((sum, r) => sum + (r.poas ?? 0), 0); return c > 0 ? (c / rows.length).toFixed(2) : '-'; })()}</td>
                                        <td className="px-3 py-1.5 whitespace-nowrap">{(() => { const c = rows.reduce((sum, r) => sum + (r.aov ?? 0), 0); return c > 0 ? (c / rows.length).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' }) : '-'; })()}</td>
                                    </tr>
                                )}
                                {/* Last period totals row */}
                                {rowsPrev.length > 0 && (
                                    <tr className="bg-gray-50 font-semibold">
                                        <td className="px-3 py-1.5 whitespace-nowrap">Last Period</td>
                                        <td className="px-3 py-1.5 whitespace-nowrap">{rowsPrev.reduce((sum, r) => sum + r.orders, 0)}</td>
                                        <td className="px-3 py-1.5 whitespace-nowrap">{rowsPrev.reduce((sum, r) => sum + r.revenue, 0).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                        <td className="px-3 py-1.5 whitespace-nowrap">{rowsPrev.reduce((sum, r) => sum + r.revenueExTax, 0).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                        <td className="px-3 py-1.5 whitespace-nowrap">{rowsPrev.reduce((sum, r) => sum + r.ppcCost, 0).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                        <td className="px-3 py-1.5 whitespace-nowrap">{rowsPrev.reduce((sum, r) => sum + r.psCost, 0).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                        <td className="px-3 py-1.5 whitespace-nowrap">{(() => { const c = rowsPrev.reduce((sum, r) => sum + (r.roas ?? 0), 0); return c > 0 ? (c / rowsPrev.length).toFixed(2) : '-'; })()}</td>
                                        <td className="px-3 py-1.5 whitespace-nowrap">{(() => { const c = rowsPrev.reduce((sum, r) => sum + (r.poas ?? 0), 0); return c > 0 ? (c / rowsPrev.length).toFixed(2) : '-'; })()}</td>
                                        <td className="px-3 py-1.5 whitespace-nowrap">{(() => { const c = rowsPrev.reduce((sum, r) => sum + (r.aov ?? 0), 0); return c > 0 ? (c / rowsPrev.length).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' }) : '-'; })()}</td>
                                    </tr>
                                )}
                                {/* Difference row */}
                                {rows.length > 0 && rowsPrev.length > 0 && (
                                    <tr className="bg-gray-200 font-semibold">
                                        <td className="px-3 py-1.5 whitespace-nowrap">Difference</td>
                                        <td className="px-3 py-1.5 whitespace-nowrap">{rows.reduce((sum, r) => sum + r.orders, 0) - rowsPrev.reduce((sum, r) => sum + r.orders, 0)}</td>
                                        <td className="px-3 py-1.5 whitespace-nowrap">{(rows.reduce((sum, r) => sum + r.revenue, 0) - rowsPrev.reduce((sum, r) => sum + r.revenue, 0)).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                        <td className="px-3 py-1.5 whitespace-nowrap">{(rows.reduce((sum, r) => sum + r.revenueExTax, 0) - rowsPrev.reduce((sum, r) => sum + r.revenueExTax, 0)).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                        <td className="px-3 py-1.5 whitespace-nowrap">{(rows.reduce((sum, r) => sum + r.ppcCost, 0) - rowsPrev.reduce((sum, r) => sum + r.ppcCost, 0)).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                        <td className="px-3 py-1.5 whitespace-nowrap">{(rows.reduce((sum, r) => sum + r.psCost, 0) - rowsPrev.reduce((sum, r) => sum + r.psCost, 0)).toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</td>
                                        <td className="px-3 py-1.5 whitespace-nowrap">{(() => { const c = rows.reduce((sum, r) => sum + (r.roas ?? 0), 0) - rowsPrev.reduce((sum, r) => sum + (r.roas ?? 0), 0); return c !== 0 ? c.toFixed(2) : '-'; })()}</td>
                                        <td className="px-3 py-1.5 whitespace-nowrap">{(() => { const c = rows.reduce((sum, r) => sum + (r.poas ?? 0), 0) - rowsPrev.reduce((sum, r) => sum + (r.poas ?? 0), 0); return c !== 0 ? c.toFixed(2) : '-'; })()}</td>
                                        <td className="px-3 py-1.5 whitespace-nowrap">{(() => { const c = rows.reduce((sum, r) => sum + (r.aov ?? 0), 0) - rowsPrev.reduce((sum, r) => sum + (r.aov ?? 0), 0); return c !== 0 ? c.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' }) : '-'; })()}</td>
                                    </tr>
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