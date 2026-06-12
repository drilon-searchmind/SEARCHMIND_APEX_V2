"use client";

import React, { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import B2BDailyMetricsTable from "./B2BDailyMetricsTable";
import MetricToggleBar from "./MetricToggleBar";
import GraphCard from "@/components/dashboard/GraphCard";
import { useB2BDailyOverviewData } from "./useB2BDailyOverviewData";
import {
    B2B_METRIC_COLUMNS,
    DEFAULT_B2B_VISIBLE_METRICS,
} from "./b2bMetricConfig";
import { pushDashboardDateRangeApplied } from "@root/lib/gtmFunctions";
import { FiGlobe } from "react-icons/fi";

export default function B2BDailyOverview({ customer }) {
    const params = useParams();
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const isFirstOfMonth = today.getDate() === 1;
    const defaultStart = `${yyyy}-${mm}-01`;
    const defaultEnd = isFirstOfMonth
        ? `${yyyy}-${mm}-01`
        : `${yyyy}-${mm}-${String(today.getDate() - 1).padStart(2, "0")}`;

    const [tempDateRange, setTempDateRange] = useState({
        startDate: defaultStart,
        endDate: defaultEnd,
    });
    const [appliedDateRange, setAppliedDateRange] = useState({
        startDate: defaultStart,
        endDate: defaultEnd,
    });
    const [visibleMetricKeys, setVisibleMetricKeys] = useState(DEFAULT_B2B_VISIBLE_METRICS);

    const handleDateRangeApply = ({ startDate, endDate }) => {
        pushDashboardDateRangeApplied({
            page: "b2b_daily_overview",
            customerId: params.customerId,
            startDate,
            endDate,
        });
        setAppliedDateRange({ startDate, endDate });
    };

    const { rows, rowsPrev, loading, error, visibleColumnKeys } = useB2BDailyOverviewData(
        customer,
        appliedDateRange
    );

    const metricColumns = useMemo(
        () =>
            B2B_METRIC_COLUMNS.filter(
                (col) =>
                    !["ppcCost", "psCost", "pinterestCost", "snapchatCost", "bingCost", "redditCost"].includes(
                        col.key
                    ) || visibleColumnKeys.includes(col.key)
            ),
        [visibleColumnKeys]
    );

    const visibleMetrics = useMemo(() => {
        const map = {};
        for (const col of metricColumns) {
            map[col.key] = visibleMetricKeys.includes(col.key);
        }
        return map;
    }, [metricColumns, visibleMetricKeys]);

    const chartSeries = useMemo(
        () => [
            {
                name: "Sessions",
                data: (rows || []).map((r) => r.sessions || 0),
                color: "#406969",
            },
            {
                name: "Ad Spend",
                data: (rows || []).map((r) => Math.round(r.totalMarketingSpend || 0)),
                color: "#D6CDB6",
            },
        ],
        [rows]
    );

    const chartOptions = useMemo(
        () => ({
            chart: {
                id: "b2b-daily-trend",
                toolbar: { show: false },
                fontFamily: "Outfit, sans-serif",
            },
            xaxis: {
                categories: (rows || []).map((r) => r.date),
                labels: { rotate: -45 },
            },
            stroke: { curve: "smooth", width: 2 },
            legend: { show: true, position: "top" },
            tooltip: { shared: true },
        }),
        [rows]
    );

    const ga4PropertyId = customer?.CustomerSettings?.ga4PropertyId?.trim?.();

    return (
        <div className="w-full">
            <DashboardHeading
                title="Daily"
                subtitle="B2B daily traffic, engagement & marketing spend"
                right={
                    <DateRangePicker
                        onApply={handleDateRangeApply}
                        startDate={tempDateRange.startDate}
                        endDate={tempDateRange.endDate}
                        onStartDateChange={(v) => setTempDateRange((d) => ({ ...d, startDate: v }))}
                        onEndDateChange={(v) => setTempDateRange((d) => ({ ...d, endDate: v }))}
                        loading={loading}
                    />
                }
            />

            {!ga4PropertyId && !loading && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-6 py-8 text-center mb-8">
                    <FiGlobe className="mx-auto mb-3 text-3xl text-amber-600" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Connect GA4 to get started</h3>
                    <p className="text-gray-600 max-w-md mx-auto">
                        Add a GA4 Property ID in Property Configuration to load daily traffic metrics.
                    </p>
                </div>
            )}

            <div className="mt-8 bg-white rounded-xl border border-gray-200 p-6">
                <div className="mb-5">
                    <MetricToggleBar
                        metricColumns={metricColumns}
                        visibleMetrics={visibleMetrics}
                        onToggle={(key) =>
                            setVisibleMetricKeys((prev) =>
                                prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
                            )
                        }
                    />
                    <h3 className="text-lg font-semibold text-gray-900">Daily Metrics</h3>
                </div>

                <B2BDailyMetricsTable
                    rows={rows}
                    rowsPrev={rowsPrev}
                    loading={loading}
                    error={error}
                    visibleMetrics={visibleMetrics}
                    metricColumns={metricColumns}
                />

                {rows?.length > 0 && (
                    <div className="mt-8">
                        <GraphCard
                            title="Sessions & Ad Spend"
                            chartOptions={chartOptions}
                            chartSeries={chartSeries}
                            height={280}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
