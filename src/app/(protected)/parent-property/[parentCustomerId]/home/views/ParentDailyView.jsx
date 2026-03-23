"use client";

import React, { useState, useEffect, useMemo } from "react";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import DailyMetricsTable from "@/app/(protected)/dashboard/[customerId]/daily-overview/DailyMetricsTable";
import RowComparisonPopover from "@/app/(protected)/dashboard/[customerId]/daily-overview/RowComparisonPopover";
import LastYearPeriodTable from "@/app/(protected)/dashboard/[customerId]/daily-overview/LastYearPeriodTable";
import MetricToggleBar from "@/app/(protected)/dashboard/[customerId]/daily-overview/MetricToggleBar";
import { DEFAULT_VISIBLE_METRICS } from "@/app/(protected)/dashboard/[customerId]/daily-overview/metricConfig";
import GraphCard from "@/components/dashboard/GraphCard";
import { buildParentDailyRows } from "../utils/buildParentDailyRows";
import dayjs from "dayjs";

export default function ParentDailyView({ sharedData }) {
    const {
        parentCustomer,
        parentCustomerId,
        filteredDailyRows,
        filteredDailyRowsPrev,
        childCustomers,
        enabledProperties,
        appliedDateRange,
        tempDateRange,
        loading,
        handleDateRangeApply,
        handleStartDateChange,
        handleEndDateChange,
        predominantMetricPreference,
    } = sharedData || {};

    const rows = filteredDailyRows || [];
    const rowsPrev = filteredDailyRowsPrev || [];

    const [rowsLastYear, setRowsLastYear] = useState([]);
    const [loadingLastYear, setLoadingLastYear] = useState(false);
    const [hoveredRowIndex, setHoveredRowIndex] = useState(null);
    const [hoveredRowTable, setHoveredRowTable] = useState(null);
    const [hoveredRowPosition, setHoveredRowPosition] = useState({ top: 0, left: 0 });
    const [tableWidth, setTableWidth] = useState(null);
    const [visibleMetrics, setVisibleMetrics] = useState(DEFAULT_VISIBLE_METRICS);
    const [showTrendChart, setShowTrendChart] = useState(false);

    const handleMetricToggle = (key) => {
        setVisibleMetrics((prev) => {
            const next = { ...prev, [key]: !prev[key] };
            const count = Object.values(next).filter(Boolean).length;
            if (count === 0) return prev;
            return next;
        });
    };

    const handleRowHover = ({ index, tableType, position, tableWidth: w }) => {
        setHoveredRowIndex(index);
        setHoveredRowTable(tableType);
        setHoveredRowPosition(position);
        setTableWidth(w);
    };
    const handleRowHoverLeave = () => {
        setHoveredRowIndex(null);
        setHoveredRowTable(null);
        setTableWidth(null);
    };

    useEffect(() => {
        if (!parentCustomerId || !appliedDateRange?.startDate || !childCustomers?.length) return;

        const startMonth = dayjs(appliedDateRange.startDate);
        const lastYearMonthStart = startMonth.subtract(1, "year").startOf("month");
        const lastYearMonthEnd = lastYearMonthStart.endOf("month");
        const lastYearStart = lastYearMonthStart.format("YYYY-MM-DD");
        const lastYearEnd = lastYearMonthEnd.format("YYYY-MM-DD");

        setLoadingLastYear(true);
        (async () => {
            try {
                const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
                const res = await fetch(
                    `${baseUrl}/api/parent-customers/${parentCustomerId}/aggregated?startDate=${lastYearStart}&endDate=${lastYearEnd}&comparisonMethod=Last%20Year`
                );
                if (!res.ok) throw new Error("Failed to fetch last year data");
                const data = await res.json();
                const dailyDataList = (data.dailyData || []).filter((r) => enabledProperties[r._id]);
                const lastYearRows = buildParentDailyRows(dailyDataList, data.parent?.customers || childCustomers, { usePrev: false });
                setRowsLastYear(lastYearRows);
            } catch (err) {
                console.error("Error fetching last year data:", err);
                setRowsLastYear([]);
            } finally {
                setLoadingLastYear(false);
            }
        })();
    }, [parentCustomerId, appliedDateRange?.startDate, childCustomers, enabledProperties]);

    const trendChartSeries = useMemo(() => {
        if (!rows?.length) return [];
        return [
            { name: "Net Revenue", data: rows.map((r) => Math.round(r.netRevenue || 0)), color: "#406969" },
            { name: "Spend", data: rows.map((r) => Math.round((r.ppcCost || 0) + (r.psCost || 0))), color: "#D6CDB6" },
            { name: "Net Profit", data: rows.map((r) => Math.round(r.netProfit ?? 0)), color: "#1E2B2B" },
        ];
    }, [rows]);

    const trendChartOptions = useMemo(
        () => ({
            chart: { id: "parent-daily-trend", toolbar: { show: false }, fontFamily: "Outfit, sans-serif" },
            xaxis: {
                categories: rows?.map((r) => r.date) || [],
                labels: { rotate: -45 },
                axisTicks: { show: true },
                axisBorder: { show: true },
            },
            stroke: { curve: "smooth", width: 2 },
            legend: { show: true, position: "top" },
            tooltip: { shared: true },
            grid: {
                borderColor: "#e5e7eb",
                strokeDashArray: 0,
                xaxis: { lines: { show: false } },
                yaxis: { lines: { show: true } },
            },
            dataLabels: { enabled: false },
        }),
        [rows]
    );

    return (
        <div id="ParentDailyView" className="w-full">
            <DashboardHeading
                title="Daily Overview"
                label={parentCustomer?.name || "Parent Property"}
                customerId={parentCustomerId}
                dateRange={appliedDateRange}
                loading={loading}
                dashboardType="parent-property"
                dataSnapshot={{
                    dailyRows: rows,
                    previousPeriodRows: rowsPrev,
                    lastYearRows: rowsLastYear,
                    metricPreference: predominantMetricPreference,
                }}
                right={
                    <DateRangePicker
                        onApply={handleDateRangeApply}
                        startDate={tempDateRange?.startDate}
                        endDate={tempDateRange?.endDate}
                        onStartDateChange={handleStartDateChange}
                        onEndDateChange={handleEndDateChange}
                        loading={loading}
                    />
                }
            />

            <div className="mt-8 bg-white rounded-xl border border-gray-200 p-6">
                <div className="mb-5">
                    <MetricToggleBar
                        visibleMetrics={visibleMetrics}
                        onToggle={handleMetricToggle}
                        showTrendChart={showTrendChart}
                        onTrendChartToggle={() => setShowTrendChart((v) => !v)}
                    />
                    <h3 className="text-lg font-semibold">Daily Metrics</h3>
                </div>
                {showTrendChart && rows?.length > 0 && (
                    <div className="mb-6">
                        <GraphCard
                            title="Net Revenue, Spend & Net Profit Over Time"
                            chartOptions={trendChartOptions}
                            chartSeries={trendChartSeries}
                            chartType="line"
                            height={320}
                        />
                    </div>
                )}
                <DailyMetricsTable
                    rows={rows}
                    rowsPrev={rowsPrev}
                    rowsLastYear={rowsLastYear}
                    loading={loading}
                    error={null}
                    visibleMetrics={visibleMetrics}
                    onRowHover={handleRowHover}
                    onRowHoverLeave={handleRowHoverLeave}
                />
            </div>

            <RowComparisonPopover
                visible={false}
                position={hoveredRowPosition}
                tableWidth={tableWidth}
                hoveredRowTable={hoveredRowTable}
                hoveredRowIndex={hoveredRowIndex}
                rows={rows}
                rowsLastYear={rowsLastYear}
                visibleMetrics={visibleMetrics}
            />

            <div className="mt-8 bg-gray-50 rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold mb-5">Last Year Period</h3>
                <LastYearPeriodTable
                    rowsLastYear={rowsLastYear}
                    rows={rows}
                    loading={loadingLastYear}
                    visibleMetrics={visibleMetrics}
                    onRowHover={handleRowHover}
                    onRowHoverLeave={handleRowHoverLeave}
                />
            </div>
        </div>
    );
}
