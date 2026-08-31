"use client";

import React, { useState, useEffect, useMemo } from "react";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import DailyMetricsTable from "@/app/(protected)/dashboard/[customerId]/daily-overview/DailyMetricsTable";
import LastYearPeriodTable from "@/app/(protected)/dashboard/[customerId]/daily-overview/LastYearPeriodTable";
import MetricToggleBar from "@/app/(protected)/dashboard/[customerId]/daily-overview/MetricToggleBar";
import { DEFAULT_VISIBLE_METRICS, mapMetricColumnsForRevenueBasis } from "@/app/(protected)/dashboard/[customerId]/daily-overview/metricConfig";
import GraphCard from "@/components/dashboard/GraphCard";
import { getCobaltChartBaseOptions } from "@/lib/charts/cobaltChartTheme";
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
        dateRangePickerProps,
        loading,
        pageBusy,
        predominantMetricPreference,
        shopifyRevenueField = "net_sales",
        parentAggregatedQueryExtras = "",
    } = sharedData || {};

    const metricColumnsParent = useMemo(
        () => mapMetricColumnsForRevenueBasis(shopifyRevenueField),
        [shopifyRevenueField]
    );

    const rows = useMemo(() => filteredDailyRows || [], [filteredDailyRows]);
    const rowsPrev = filteredDailyRowsPrev || [];

    const [rowsLastYear, setRowsLastYear] = useState([]);
    const [loadingLastYear, setLoadingLastYear] = useState(false);
    const [visibleMetrics, setVisibleMetrics] = useState(DEFAULT_VISIBLE_METRICS);
    const [showTrendChart, setShowTrendChart] = useState(false);
    const [showLastYearTable, setShowLastYearTable] = useState(false);

    const handleMetricToggle = (key) => {
        setVisibleMetrics((prev) => {
            const next = { ...prev, [key]: !prev[key] };
            const count = Object.values(next).filter(Boolean).length;
            if (count === 0) return prev;
            return next;
        });
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
                    `${baseUrl}/api/parent-customers/${parentCustomerId}/aggregated?startDate=${lastYearStart}&endDate=${lastYearEnd}&comparisonMethod=Last%20Year${parentAggregatedQueryExtras}`
                );
                if (!res.ok) throw new Error("Failed to fetch last year data");
                const data = await res.json();
                const dailyDataList = (data.dailyData || []).filter(
                    (r) => enabledProperties[String(r._id)] !== false
                );
                const lastYearRows = buildParentDailyRows(dailyDataList, data.parent?.customers || childCustomers, {
                    usePrev: false,
                    shopifyRevenueField,
                });
                setRowsLastYear(lastYearRows);
            } catch (err) {
                console.error("Error fetching last year data:", err);
                setRowsLastYear([]);
            } finally {
                setLoadingLastYear(false);
            }
        })();
    }, [
        parentCustomerId,
        appliedDateRange?.startDate,
        childCustomers,
        enabledProperties,
        shopifyRevenueField,
        parentAggregatedQueryExtras,
    ]);

    const revenueTrendLabel =
        shopifyRevenueField === "gross_sales" ? "Gross sales" : "Net revenue";

    const trendChartSeries = useMemo(() => {
        if (!rows?.length) return [];
        return [
            { name: revenueTrendLabel, data: rows.map((r) => Math.round(r.netRevenue || 0)) },
            { name: "Spend", data: rows.map((r) => Math.round((r.ppcCost || 0) + (r.psCost || 0))) },
            { name: "Net Profit", data: rows.map((r) => Math.round(r.netProfit ?? 0)) },
        ];
    }, [rows, revenueTrendLabel]);

    const trendChartOptions = useMemo(
        () =>
            getCobaltChartBaseOptions({
                chart: { id: "parent-daily-trend", toolbar: { show: false } },
                xaxis: {
                    categories: rows?.map((r) => r.date) || [],
                    labels: { rotate: -45 },
                },
                stroke: { curve: "smooth", width: 2 },
                legend: { show: true, position: "top" },
                tooltip: { shared: true },
                dataLabels: { enabled: false },
            }),
        [rows]
    );

    return (
        <div id="ParentDailyView" className="apex-perf w-full apex-parent-stack">
            <DashboardHeading
                variant="cobalt"
                showRunAudit={false}
                title="Daily Overview"
                label={parentCustomer?.name || "Parent Property"}
                customerId={parentCustomerId}
                dateRange={appliedDateRange}
                loading={pageBusy ?? loading}
                dashboardType="parent-property"
                dataSnapshot={{
                    dailyRows: rows,
                    previousPeriodRows: rowsPrev,
                    lastYearRows: rowsLastYear,
                    metricPreference: predominantMetricPreference,
                }}
                right={
                    <DateRangePicker
                        variant="cobalt"
                        {...dateRangePickerProps}
                        loading={pageBusy ?? loading}
                    />
                }
            />

            <div className="apex-parent-panel">
                <div className="apex-parent-panel__head">
                    <div>
                        <MetricToggleBar
                            variant="cobalt"
                            visibleMetrics={visibleMetrics}
                            onToggle={handleMetricToggle}
                            showTrendChart={showTrendChart}
                            onTrendChartToggle={() => setShowTrendChart((v) => !v)}
                            showLastYearTable={showLastYearTable}
                            onLastYearTableToggle={() => setShowLastYearTable((v) => !v)}
                            metricColumns={metricColumnsParent}
                        />
                        <h3 className="apex-parent-panel__title">Daily metrics</h3>
                    </div>
                </div>

                {showTrendChart && rows?.length > 0 ? (
                    <div className="mb-6">
                        <GraphCard
                            variant="cobalt"
                            title={`${revenueTrendLabel}, Spend & Net Profit Over Time`}
                            chartOptions={trendChartOptions}
                            chartSeries={trendChartSeries}
                            chartType="line"
                            height={320}
                        />
                    </div>
                ) : null}

                <DailyMetricsTable
                    variant="cobalt"
                    rows={rows}
                    rowsPrev={rowsPrev}
                    rowsLastYear={rowsLastYear}
                    loading={loading}
                    error={null}
                    visibleMetrics={visibleMetrics}
                    metricColumns={metricColumnsParent}
                />
            </div>

            {showLastYearTable ? (
                <div className="apex-parent-panel">
                    <h3 className="apex-parent-panel__title mb-5">Last year period</h3>
                    <p className="apex-daily-panel__subtitle">Full month — raw daily data</p>
                    <LastYearPeriodTable
                        variant="cobalt"
                        rowsLastYear={rowsLastYear}
                        rows={rows}
                        loading={loadingLastYear}
                        visibleMetrics={visibleMetrics}
                        metricColumns={metricColumnsParent}
                    />
                </div>
            ) : null}
        </div>
    );
}
