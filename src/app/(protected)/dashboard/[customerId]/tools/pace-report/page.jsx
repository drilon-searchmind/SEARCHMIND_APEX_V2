"use client"

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useCustomers } from "@/hooks/useCustomers";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import dayjs from "dayjs";
import GraphCard from "@/components/dashboard/GraphCard";
import Spinner from "@/components/ui/Spinner";
import dynamic from "next/dynamic";
import Link from "next/link";
import { FiSettings } from "react-icons/fi";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

export default function PaceReportPage() {
    const params = useParams();
    const { customers } = useCustomers();
    const customer = customers.find(c => c._id === params.customerId);
    const objectives = customer?.CustomerPropertyObjectives || {};

    // Date range state
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const defaultEnd = `${yyyy}-${mm}-${dd}`;
    const defaultStart = `${yyyy}-${mm}-01`;
    const [dateRange, setDateRange] = useState({ startDate: defaultStart, endDate: defaultEnd });

    // Handlers for DateRangePicker (controlled)
    const handleStartDateChange = (newStart) => {
        setDateRange(dr => ({ ...dr, startDate: newStart }));
    };
    const handleEndDateChange = (newEnd) => {
        setDateRange(dr => ({ ...dr, endDate: newEnd }));
    };

    // Metrics state
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [costData, setCostData] = useState([]);
    const [budget, setBudget] = useState(0);
    const [paceAnalysis, setPaceAnalysis] = useState(null);

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
                // Aggregate cost per day
                const costMap = {};
                [...(merged.facebookDaily || []), ...(merged.googleDaily || [])].forEach(d => {
                    if (!costMap[d.period]) costMap[d.period] = 0;
                    costMap[d.period] += Number(d.spend || 0);
                });
                // Sort by date
                const sortedPeriods = Object.keys(costMap).sort();
                let cumulative = 0;
                const costDaily = sortedPeriods.map(period => {
                    cumulative += costMap[period];
                    return { period, spend: Number(cumulative.toFixed(2)) };
                });
                setCostData(costDaily);

                // Aggregate objectives for all months in the selected range
                const startDateObj = dayjs(dateRange.startDate);
                const endDateObj = dayjs(dateRange.endDate);
                const totalDays = endDateObj.diff(startDateObj, 'day') + 1;
                // Find all months in the selected range
                let monthsInRange = [];
                let cursor = startDateObj.startOf('month');
                while (cursor.isBefore(endDateObj) || cursor.isSame(endDateObj, 'month')) {
                    monthsInRange.push(cursor.format('MMMM').toLowerCase());
                    cursor = cursor.add(1, 'month');
                }
                // Sum marketingBudget for all months in range
                let budgetValue = monthsInRange.reduce((sum, month) => {
                    const obj = objectives[month] || {};
                    return sum + (typeof obj.marketingBudget === 'number' ? obj.marketingBudget : 0);
                }, 0);
                // If no budget found, default to 1 to avoid divide-by-zero
                if (!budgetValue || budgetValue === 0) budgetValue = 1;
                setBudget(budgetValue);
                const dailyTarget = budgetValue / totalDays;
                // Aggregate budget for each day (cumulative)
                let budgetCumulative = 0;
                const budgetDaily = costDaily.map((d, idx) => {
                    budgetCumulative += dailyTarget;
                    return { period: d.period, budget: Number(budgetCumulative.toFixed(2)) };
                });
                const idealSpendToDate = dailyTarget * totalDays;
                const actualSpendToDate = costDaily.length > 0 ? costDaily[costDaily.length - 1].spend : 0;
                const pace = idealSpendToDate > 0 ? actualSpendToDate / idealSpendToDate : 0;

                // Suggested daily adjustment: (Remaining Budget) / (Days left in the month after the selected period)
                // daysLeft = totalDaysInCurrentMonth - totalDays
                const totalDaysInCurrentMonth = endDateObj.daysInMonth();
                const remainingBudget = budgetValue - actualSpendToDate;
                let daysLeft = totalDaysInCurrentMonth - totalDays;
                if (daysLeft < 0) daysLeft = 0;
                let suggestedDailyAdjustment = 0;
                if (daysLeft > 0) {
                    suggestedDailyAdjustment = remainingBudget / daysLeft;
                } else if (daysLeft === 0 && remainingBudget > 0) {
                    // If only one day left, adjustment is just the remaining budget
                    suggestedDailyAdjustment = remainingBudget;
                } else {
                    // If over budget or past the period, show 0
                    suggestedDailyAdjustment = 0;
                }

                setPaceAnalysis({
                    budget: budgetValue,
                    totalDays,
                    dailyTarget,
                    idealSpendToDate,
                    actualSpendToDate,
                    pace,
                    suggestedDailyAdjustment,
                    budgetDaily,
                });
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        })();
    }, [customer, objectives, dateRange]);

    // Prepare chart data for cost vs budget
    const chartCategories = costData.map(d => d.period);
    const costSeries = [{ name: "Cost", data: costData.map(d => Number(d.spend).toFixed(2)) }];
    const budgetSeries = [{ name: "Budget", data: (paceAnalysis?.budgetDaily || []).map(d => Number(d.budget).toFixed(2)) }];
    const chartSeries = [...costSeries, ...budgetSeries];
    const chartOptions = {
        chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: 'Outfit, sans-serif' },
        xaxis: { categories: chartCategories, labels: { style: { colors: '#406969' } }, axisTicks: { show: true }, axisBorder: { show: true } },
        yaxis: { labels: { style: { colors: '#1E2B2B' }, formatter: val => Number(val).toFixed(2) } },
        colors: ['#213834', '#C6ED62'],
        stroke: { width: 2, curve: 'smooth' },
        fill: { type: 'solid', opacity: 1 },
        grid: { borderColor: '#e5e7eb', strokeDashArray: 0, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
        dataLabels: { enabled: false },
        tooltip: { theme: 'light', y: { formatter: val => Number(val).toFixed(2) } },
        legend: { show: true, position: 'top', labels: { colors: '#1E2B2B' } },
    };

    return (
        <div className="w-full">
            <DashboardHeading
                title="Marketing Pace Report"
                label={customer ? customer.customerName : ""}
                right={
                    <div className="flex gap-2 items-center">
                        <input
                            type="date"
                            value={dateRange.startDate}
                            onChange={e => handleStartDateChange(e.target.value)}
                            className="border rounded px-2 py-1 text-xs"
                        />
                        <span className="mx-1">to</span>
                        <input
                            type="date"
                            value={dateRange.endDate}
                            onChange={e => handleEndDateChange(e.target.value)}
                            className="border rounded px-2 py-1 text-xs"
                        />
                    </div>
                }
            />
            <div className="flex flex-col md:flex-row gap-8 mt-4">
                <div className="flex-1">
                    {loading ? (
                        <div className="flex items-center justify-center h-64"><Spinner size={40} color="#406969" /></div>
                    ) : (
                        <GraphCard
                            title="Cost vs Budget"
                            chartOptions={chartOptions}
                            chartSeries={chartSeries}
                            chartType="line"
                        />
                    )}
                </div>
                <div className="w-full md:w-1/3 bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-4">
                    <h6 className="text-[var(--color-primary-searchmind)] mb-2 font-bold">Pace Analysis</h6>
                    {loading ? (
                        <Spinner size={40} color="#406969" />
                    ) : error ? (
                        <div className="text-red-500">{error}</div>
                    ) : paceAnalysis ? (
                        <>
                            {/* Highlighted pace at top */}
                            <div className="flex flex-col items-center mb-2 hidden">
                                <div className="text-4xl font-extrabold text-[var(--color-primary-searchmind)] mb-1">{(paceAnalysis.pace * 100).toFixed(2)}%</div>
                                <div className={`text-xs font-semibold mt-1 ${paceAnalysis.pace >= 1 ? 'text-green-600' : 'text-red-500'}`}>{paceAnalysis.pace >= 1 ? '+ On Pace' : '- Under Pace'}</div>
                            </div>
                            {/* Semicircular progress bar for budget vs actual spend */}
                            <div className="flex flex-col items-center mb-2">
                                <ReactApexChart
                                    options={{
                                        chart: { type: 'radialBar', sparkline: { enabled: true } },
                                        plotOptions: {
                                            radialBar: {
                                                startAngle: -100,
                                                endAngle: 100,
                                                hollow: { size: '75%' },
                                                track: { background: '#e5e7eb', strokeWidth: '100%' },
                                                dataLabels: {
                                                    name: { show: false },
                                                    value: {
                                                        offsetY: 15,
                                                        fontSize: '30px',
                                                        fontWeight: 700,
                                                        color: '#213834',
                                                        formatter: val => `${val}%`,
                                                    },
                                                },
                                            },
                                        },
                                        stroke: { lineCap: 'round' },
                                        fill: { colors: ['#406969'] },
                                        labels: ['Progress'],
                                    }}
                                    series={[Number(((paceAnalysis.actualSpendToDate / paceAnalysis.budget) * 100).toFixed(2))]}
                                    type="radialBar"
                                    height={300}
                                    width={250}
                                />
                            </div>
                            <div className="flex flex-col gap-2 mt-2">
                                <div className="flex justify-between text-base font-bold border-b border-gray-200 pb-1">
                                    <span>Pace:</span>
                                    <span>{paceAnalysis.pace.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span>Budget:</span>
                                    <span>{paceAnalysis.budget.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span>Actual Spend to Date:</span>
                                    <span>{paceAnalysis.actualSpendToDate.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span>Ideal Spend to Date:</span>
                                    <span>{paceAnalysis.idealSpendToDate.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span>Suggested Daily Adjustment:</span>
                                    <span>{paceAnalysis.suggestedDailyAdjustment.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span>Total Days:</span>
                                    <span>{paceAnalysis.totalDays}</span>
                                </div>
                            </div>
                            <Link href={`/dashboard/${customer._id}/config`} className="mt-4 text-sm underline hover:text-[var(--color-primary-searchmind-lighter)] text-center flex items-center justify-center gap-1 text-blue-500">
                                <span className="text-gray-500 flex items-center gap-1">
                                    <FiSettings /> Adjust your property budgets here.
                                </span>
                            </Link>
                        </>
                    ) : (
                        <div className="text-gray-400">No analysis available.</div>
                    )}
                </div>
            </div>
        </div>
    );
}