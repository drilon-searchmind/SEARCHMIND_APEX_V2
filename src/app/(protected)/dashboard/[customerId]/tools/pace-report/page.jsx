"use client"

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useCustomers } from "@/hooks/useCustomers";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import dayjs from "dayjs";
import GraphCard from "@/components/dashboard/GraphCard";
import Spinner from "@/components/ui/Spinner";
import dynamic from "next/dynamic";
import { FiSettings, FiX } from "react-icons/fi";
import PropertyObjectivesTable from "@/app/(protected)/dashboard/[customerId]/config/components/PropertyObjectivesTable";
import ToastProvider, { showToast } from "@/components/ui/ToastProvider";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

export default function PaceReportPage() {
    const params = useParams();
    const { customers, fetchCustomers } = useCustomers();
    const customer = customers.find(c => c._id === params.customerId);
    const [updatedObjectives, setUpdatedObjectives] = useState(null);
    const objectives = updatedObjectives || customer?.CustomerPropertyObjectives || {};

    // Date range state
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const defaultEnd = `${yyyy}-${mm}-${dd}`;
    const defaultStart = `${yyyy}-${mm}-01`;
    
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

    // Metrics state
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [costData, setCostData] = useState([]);
    const [budget, setBudget] = useState(0);
    const [paceAnalysis, setPaceAnalysis] = useState(null);
    const [conversionValueData, setConversionValueData] = useState([]);
    const [conversionBudget, setConversionBudget] = useState(0);
    const [conversionPaceAnalysis, setConversionPaceAnalysis] = useState(null);
    
    // Sidebar state
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [localObjectives, setLocalObjectives] = useState({});
    const [savingObjectives, setSavingObjectives] = useState(false);

    useEffect(() => {
        if (!customer) return;
        setLoading(true);
        setError(null);
        (async () => {
            try {
                const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
                const res = await fetch(`${baseUrl}/api/merged-sources/${customer._id}?startDate=${appliedDateRange.startDate}&endDate=${appliedDateRange.endDate}`);
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
                const startDateObj = dayjs(appliedDateRange.startDate);
                const endDateObj = dayjs(appliedDateRange.endDate);
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
                
                // Calculate antal dage (number of days) - this should be the total days in the month(s), not the selected period
                // Sum up the days in each month that the period spans
                let antalDage = 0;
                let monthCursor = startDateObj.startOf('month');
                while (monthCursor.isBefore(endDateObj) || monthCursor.isSame(endDateObj, 'month')) {
                    antalDage += monthCursor.daysInMonth();
                    monthCursor = monthCursor.add(1, 'month');
                }
                
                const dailyTarget = budgetValue / antalDage;
                // Aggregate budget for each day (cumulative)
                let budgetCumulative = 0;
                const budgetDaily = costDaily.map((d, idx) => {
                    budgetCumulative += dailyTarget;
                    return { period: d.period, budget: Number(budgetCumulative.toFixed(2)) };
                });
                
                // Calculate pace according to formula: Pace = a / (b * c)
                // a = Cost til sidste dag (Cost until last day, excluding today)
                // b = Total budget for perioden / Antal dage i perioden (dailyTarget)
                // c = Today - 1 (Days passed excluding today)
                
                const todayObj = dayjs();
                const todayStr = todayObj.format('YYYY-MM-DD');
                
                // a = Cost til sidste dag (cost until last day - INCLUDING today)
                // This is the actual cumulative cost up to and including today
                let a = 0; // cost til sidste dag
                if (costDaily.length > 0) {
                    // Use the last entry which is the cumulative cost including today
                    a = costDaily[costDaily.length - 1].spend;
                }
                const costUntilLastDay = a; // Keep for compatibility
                
                // Calculate c = Today - 1
                // "Today" refers to the day number within the period (1-indexed)
                // Example: If period is Feb 1-28 and today is Feb 2nd, then today = day 2, so c = 2 - 1 = 1
                // We calculate the day number from startDate to today (inclusive), then subtract 1
                let todayDayNumber;
                if (todayObj.isBefore(startDateObj)) {
                    // Today is before the period starts
                    todayDayNumber = 0;
                } else if (todayObj.isAfter(endDateObj)) {
                    // Today is after the period ends - use totalDays as the day number
                    todayDayNumber = totalDays;
                } else {
                    // Today is within the period
                    // Calculate days from startDate to today (inclusive): diff + 1 gives 1-indexed day number
                    todayDayNumber = todayObj.diff(startDateObj, 'day') + 1;
                }
                const c = Math.max(0, todayDayNumber - 1); // Today - 1
                
                // Calculate ideal spend to date according to formula: b * c
                // b = (Total budget for perioden) / (Antal dage i perioden) = dailyTarget
                // c = Today - 1
                // b * c = dailyTarget * c
                const idealSpendToDate = dailyTarget * c;
                
                // Calculate pace: a / (b * c)
                // a = cost til sidste dag (already calculated above)
                // b = total budget / antal dage = dailyTarget
                // c = today - 1 (already calculated above)
                // Pace = a / (b * c)
                const b = dailyTarget;
                const bcForPace = idealSpendToDate; // b * c
                const pace = bcForPace > 0 ? a / bcForPace : 0;
                
                console.log('Pace Calculation:', {
                    'a (cost til sidste dag)': a,
                    'b (total budget / antal dage)': b,
                    'c (today - 1)': c,
                    'b × c': bcForPace,
                    'Pace = a / (b × c)': pace,
                    'todayDayNumber': todayDayNumber,
                    'todayStr': todayStr,
                    'costDaily entries': costDaily.length,
                    'costDaily[0]': costDaily[0],
                    'costDaily[1]': costDaily[1],
                    'lastEntry period': costDaily.length > 0 ? costDaily[costDaily.length - 1].period : 'none',
                    'isLastEntryToday': costDaily.length > 0 ? dayjs(costDaily[costDaily.length - 1].period).isSame(todayObj, 'day') : false
                });
                
                // For display purposes, also calculate actual spend including today
                const actualSpendToDate = costDaily.length > 0 ? costDaily[costDaily.length - 1].spend : 0;

                // Suggested daily adjustment formula: −((b × c) − a) / d + (b − e)
                // Where:
                // a = cost til sidste dag (already calculated)
                // b = total budget / antal dage = dailyTarget (already calculated)
                // c = today − 1 (already calculated)
                // d = antal dage i perioden − 1 = antalDage − 1
                // e = a / c
                const d = antalDage - 1; // antal dage i perioden − 1
                const e = c > 0 ? a / c : 0; // a / c
                const bcForAdjustment = dailyTarget * c; // b × c
                const bcMinusA = bcForAdjustment - a; // (b × c) − a
                const firstPart = -(bcMinusA / d); // −((b × c) − a) / d
                const secondPart = dailyTarget - e; // b − e
                const suggestedDailyAdjustment = firstPart + secondPart;

                setPaceAnalysis({
                    budget: budgetValue,
                    totalDays,
                    dailyTarget,
                    idealSpendToDate,
                    actualSpendToDate,
                    costUntilLastDay, // Cost until last day (excluding today) - a
                    daysPassedExcludingToday: c, // c = Today - 1
                    pace,
                    suggestedDailyAdjustment,
                    budgetDaily,
                });

                // Aggregate revenue per day from Shopify/WooCommerce
                // Use customerRevenueType setting (defaults to 'total_sales')
                const revenueType = customer?.CustomerSettings?.customerRevenueType || 'total_sales';
                const revenueMap = {};
                (merged.shopifyDaily || []).forEach(d => {
                    if (!revenueMap[d.period]) revenueMap[d.period] = 0;
                    revenueMap[d.period] += Number(d[revenueType] || 0);
                });
                // Sort by date
                const sortedRevenuePeriods = Object.keys(revenueMap).sort();
                let revenueCumulative = 0;
                const revenueDaily = sortedRevenuePeriods.map(period => {
                    revenueCumulative += revenueMap[period];
                    return { period, revenue: Number(revenueCumulative.toFixed(2)) };
                });
                setConversionValueData(revenueDaily);

                // Sum revenueTarget (used as conversion budget) for all months in range
                let conversionBudgetValue = monthsInRange.reduce((sum, month) => {
                    const obj = objectives[month] || {};
                    return sum + (typeof obj.revenueTarget === 'number' ? obj.revenueTarget : 0);
                }, 0);
                // If no budget found, default to 1 to avoid divide-by-zero
                if (!conversionBudgetValue || conversionBudgetValue === 0) conversionBudgetValue = 1;
                setConversionBudget(conversionBudgetValue);
                // Use the same antalDage (total days in month(s)) for conversion budget calculation
                const conversionDailyTarget = conversionBudgetValue / antalDage;
                // Aggregate conversion budget for each day (cumulative) - use same periods as costDaily for alignment
                let conversionBudgetCumulative = 0;
                const conversionBudgetDaily = costDaily.map((d, idx) => {
                    conversionBudgetCumulative += conversionDailyTarget;
                    return { period: d.period, budget: Number(conversionBudgetCumulative.toFixed(2)) };
                });
                
                // Calculate conversion pace analysis (same formula as cost)
                // a = Revenue til sidste dag (revenue until last day - INCLUDING today)
                // This is the actual cumulative revenue up to and including today
                let revenueUntilLastDay = 0;
                if (revenueDaily.length > 0) {
                    // Use the last entry which is the cumulative revenue including today
                    revenueUntilLastDay = revenueDaily[revenueDaily.length - 1].revenue;
                }
                
                // Calculate ideal revenue to date according to formula: b * c
                // b = (Revenue Target for perioden) / (Antal dage i perioden) = conversionDailyTarget
                // c = Today - 1 (same c as used for cost pace)
                // b * c = conversionDailyTarget * c
                const idealRevenueToDate = conversionDailyTarget * c;
                
                // Calculate conversion pace: a / (b * c)
                const conversionPace = idealRevenueToDate > 0 ? revenueUntilLastDay / idealRevenueToDate : 0;
                
                // Actual revenue including today
                const actualRevenueToDate = revenueDaily.length > 0 ? revenueDaily[revenueDaily.length - 1].revenue : 0;

                // Suggested daily adjustment for conversions: −((b × c) − a) / d + (b − e)
                // Where:
                // a = revenue til sidste dag (already calculated as revenueUntilLastDay)
                // b = conversion budget / antal dage = conversionDailyTarget (already calculated)
                // c = today − 1 (same c as used for cost pace)
                // d = antal dage i perioden − 1 = antalDage − 1
                // e = a / c
                const conversionD = antalDage - 1; // antal dage i perioden − 1
                const conversionE = c > 0 ? revenueUntilLastDay / c : 0; // a / c
                const conversionBc = conversionDailyTarget * c; // b × c
                const conversionBcMinusA = conversionBc - revenueUntilLastDay; // (b × c) − a
                const conversionFirstPart = -(conversionBcMinusA / conversionD); // −((b × c) − a) / d
                const conversionSecondPart = conversionDailyTarget - conversionE; // b − e
                const suggestedConversionDailyAdjustment = conversionFirstPart + conversionSecondPart;

                setConversionPaceAnalysis({
                    budget: conversionBudgetValue,
                    totalDays,
                    dailyTarget: conversionDailyTarget,
                    idealValueToDate: idealRevenueToDate,
                    actualValueToDate: actualRevenueToDate,
                    valueUntilLastDay: revenueUntilLastDay, // Revenue until last day (excluding today) - a
                    daysPassedExcludingToday: c, // c = Today - 1
                    pace: conversionPace,
                    suggestedDailyAdjustment: suggestedConversionDailyAdjustment,
                    budgetDaily: conversionBudgetDaily,
                });
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        })();
    }, [customer, objectives, appliedDateRange]);

    // Initialize local objectives when sidebar opens
    useEffect(() => {
        if (sidebarOpen && customer) {
            setLocalObjectives(customer.CustomerPropertyObjectives || {});
        }
    }, [sidebarOpen, customer]);

    // Handle objectives change
    const handleObjectivesChange = (updated) => {
        setLocalObjectives(updated);
    };

    // Save objectives
    const handleSaveObjectives = async () => {
        if (!customer) return;
        setSavingObjectives(true);
        try {
            const res = await fetch(`/api/customers/${customer._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    CustomerPropertyObjectives: localObjectives,
                }),
            });
            if (!res.ok) throw new Error('Failed to update objectives');
            
            // Update local objectives state immediately
            setUpdatedObjectives(localObjectives);
            
            // Refetch customers to update the hook's state
            await fetchCustomers();
            
            showToast({ message: 'Property objectives updated successfully!', type: 'success', position: 'top-center' });
            setSidebarOpen(false);
        } catch (err) {
            showToast({ message: err.message || 'Failed to update objectives', type: 'error', position: 'top-center' });
        } finally {
            setSavingObjectives(false);
        }
    };

    // Prepare chart data for cost vs budget
    // Ensure both series start from 0
    const chartCategories = costData.map(d => d.period);
    // Add a starting point at 0 before the first date
    const chartStartDate = costData.length > 0 ? costData[0].period : appliedDateRange.startDate;
    const chartStartDateObj = dayjs(chartStartDate);
    const dayBeforeStart = chartStartDateObj.subtract(1, 'day').format('YYYY-MM-DD');
    
    const costSeriesData = costData.length > 0 
        ? ['0', ...costData.map(d => Number(d.spend).toFixed(2))]
        : ['0'];
    const budgetSeriesData = (paceAnalysis?.budgetDaily || []).length > 0
        ? ['0', ...(paceAnalysis.budgetDaily.map(d => Number(d.budget).toFixed(2)))]
        : ['0'];
    const chartCategoriesWithStart = costData.length > 0 
        ? [dayBeforeStart, ...chartCategories]
        : [dayBeforeStart];
    const costSeries = [{ name: "Cost", data: costSeriesData }];
    const budgetSeries = [{ name: "Budget", data: budgetSeriesData }];
    const chartSeries = [...costSeries, ...budgetSeries];
    const chartOptions = {
        chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: 'Outfit, sans-serif' },
        xaxis: { 
            categories: chartCategoriesWithStart, 
            labels: { 
                style: { colors: '#406969' },
                formatter: (value, index) => {
                    // Hide the first label (day before start) but keep the data point
                    if (index === 0) return '';
                    return value;
                }
            }, 
            axisTicks: { show: true }, 
            axisBorder: { show: true } 
        },
        yaxis: { labels: { style: { colors: '#1E2B2B' }, formatter: val => Number(val).toFixed(2) } },
        colors: ['#213834', '#C6ED62'],
        stroke: { width: 2, curve: 'smooth' },
        fill: { type: 'solid', opacity: 1 },
        grid: { borderColor: '#e5e7eb', strokeDashArray: 0, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
        dataLabels: { enabled: false },
        tooltip: { theme: 'light', y: { formatter: val => Number(val).toFixed(2) } },
        legend: { show: true, position: 'top', labels: { colors: '#1E2B2B' } },
    };

    // Prepare chart data for revenue vs conversion budget
    // Use costData periods to ensure alignment (same dates as cost vs budget chart)
    // Ensure both series start from 0
    const conversionChartCategories = costData.map(d => d.period);
    // Create a map for quick lookup of revenue by period
    const revenueMap = {};
    conversionValueData.forEach(d => {
        revenueMap[d.period] = d.revenue;
    });
    // Map revenue to match costData periods (fill with 0 if no data for that period)
    const revenueSeriesData = conversionChartCategories.length > 0
        ? ['0', ...conversionChartCategories.map(period => Number((revenueMap[period] || 0).toFixed(2)))]
        : ['0'];
    const conversionBudgetSeriesData = (conversionPaceAnalysis?.budgetDaily || []).length > 0
        ? ['0', ...(conversionPaceAnalysis.budgetDaily.map(d => Number(d.budget).toFixed(2)))]
        : ['0'];
    // Use the same dayBeforeStart as the cost chart for consistency
    const conversionChartCategoriesWithStart = conversionChartCategories.length > 0
        ? [dayBeforeStart, ...conversionChartCategories]
        : [dayBeforeStart];
    const revenueSeries = [{ 
        name: "Revenue", 
        data: revenueSeriesData
    }];
    const conversionBudgetSeries = [{ name: "Revenue Target", data: conversionBudgetSeriesData }];
    const conversionChartSeries = [...revenueSeries, ...conversionBudgetSeries];
    const conversionChartOptions = {
        chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: 'Outfit, sans-serif' },
        xaxis: { 
            categories: conversionChartCategoriesWithStart, 
            labels: { 
                style: { colors: '#406969' },
                formatter: (value, index) => {
                    // Hide the first label (day before start) but keep the data point
                    if (index === 0) return '';
                    return value;
                }
            }, 
            axisTicks: { show: true }, 
            axisBorder: { show: true } 
        },
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
            <ToastProvider />
            {/* Sidebar Overlay */}
            {sidebarOpen && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-end glassmorphism2"
                    onClick={() => setSidebarOpen(false)}
                >
                    {/* Sidebar */}
                    <div 
                        className="bg-white h-full w-full max-w-2xl shadow-2xl flex flex-col relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="bg-[var(--color-primary-searchmind)] text-white px-8 py-6 flex items-center justify-between border-b border-gray-200">
                            <div className="flex-1">
                                <h2 className="text-2xl font-bold mb-1">Property Objectives</h2>
                                <p className="text-sm text-white/80">Adjust marketing budgets for each month</p>
                            </div>
                            <button
                                className="text-white/80 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
                                onClick={() => setSidebarOpen(false)}
                                aria-label="Close"
                            >
                                <FiX size={24} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="overflow-y-auto flex-1 p-8">
                            <PropertyObjectivesTable 
                                objectives={localObjectives} 
                                onObjectivesChange={handleObjectivesChange} 
                            />
                        </div>

                        {/* Footer */}
                        <div className="border-t border-gray-200 px-8 py-6 bg-gray-50 flex justify-end gap-3">
                            <button
                                className="px-6 py-2 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
                                onClick={() => setSidebarOpen(false)}
                                disabled={savingObjectives}
                            >
                                Cancel
                            </button>
                            <button
                                className="px-6 py-2 bg-[var(--color-primary-searchmind)] text-white rounded-lg font-semibold shadow-sm hover:bg-[var(--color-primary-searchmind-lighter)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={handleSaveObjectives}
                                disabled={savingObjectives}
                            >
                                {savingObjectives ? 'Saving...' : 'Save Objectives'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <DashboardHeading
                title="Marketing Pace Report"
                label={customer ? customer.customerName : ""}
                customerId={params.customerId}
                dateRange={appliedDateRange}
                loading={loading}
                dashboardType="pace-report"
                dataSnapshot={{
                    paceAnalysis: paceAnalysis,
                    costData: costData,
                    budget: budget
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
                            <button
                                onClick={() => setSidebarOpen(true)}
                                className="mt-4 text-sm underline hover:text-[var(--color-primary-searchmind-lighter)] text-center flex items-center justify-center gap-1 text-blue-500 w-full"
                            >
                                <span className="text-gray-500 flex items-center gap-1">
                                    <FiSettings /> Adjust your property budgets here.
                                </span>
                            </button>
                        </>
                    ) : (
                        <div className="text-gray-400">No analysis available.</div>
                    )}
                </div>
            </div>
            {/* Revenue vs Revenue Target Section */}
            <div className="flex flex-col md:flex-row gap-8 mt-8">
                <div className="flex-1">
                    {loading ? (
                        <div className="flex items-center justify-center h-64"><Spinner size={40} color="#406969" /></div>
                    ) : (
                        <GraphCard
                            title="Revenue vs Revenue Target"
                            chartOptions={conversionChartOptions}
                            chartSeries={conversionChartSeries}
                            chartType="line"
                        />
                    )}
                </div>
                <div className="w-full md:w-1/3 bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-4">
                    <h6 className="text-[var(--color-primary-searchmind)] mb-2 font-bold">Revenue Pace Analysis</h6>
                    {loading ? (
                        <Spinner size={40} color="#406969" />
                    ) : error ? (
                        <div className="text-red-500">{error}</div>
                    ) : conversionPaceAnalysis ? (
                        <>
                            {/* Semicircular progress bar for conversion budget vs actual conversion value */}
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
                                    series={[Number(((conversionPaceAnalysis.actualValueToDate / conversionPaceAnalysis.budget) * 100).toFixed(2))]}
                                    type="radialBar"
                                    height={300}
                                    width={250}
                                />
                            </div>
                            <div className="flex flex-col gap-2 mt-2">
                                <div className="flex justify-between text-base font-bold border-b border-gray-200 pb-1">
                                    <span>Pace:</span>
                                    <span>{conversionPaceAnalysis.pace.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span>Revenue Target (Conversion Budget):</span>
                                    <span>{conversionPaceAnalysis.budget.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span>Actual Revenue to Date:</span>
                                    <span>{conversionPaceAnalysis.actualValueToDate.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span>Total Days:</span>
                                    <span>{conversionPaceAnalysis.totalDays}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => setSidebarOpen(true)}
                                className="mt-4 text-sm underline hover:text-[var(--color-primary-searchmind-lighter)] text-center flex items-center justify-center gap-1 text-blue-500 w-full"
                            >
                                <span className="text-gray-500 flex items-center gap-1">
                                    <FiSettings /> Adjust your revenue targets here.
                                </span>
                            </button>
                        </>
                    ) : (
                        <div className="text-gray-400">No analysis available.</div>
                    )}
                </div>
            </div>
        </div>
    );
}