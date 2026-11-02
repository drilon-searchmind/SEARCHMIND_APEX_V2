"use client";

import React, { useMemo, useState } from "react";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import B2BDailyMetricsTable from "@/app/(protected)/dashboard/[customerId]/daily-overview/B2BDailyMetricsTable";
import MetricToggleBar from "@/app/(protected)/dashboard/[customerId]/daily-overview/MetricToggleBar";
import {
    B2B_METRIC_COLUMNS,
    DEFAULT_B2B_VISIBLE_METRICS,
} from "@/app/(protected)/dashboard/[customerId]/daily-overview/b2bMetricConfig";

export default function ParentB2BDailyView({ sharedData }) {
    const {
        parentCustomer,
        parentCustomerId,
        b2bDailyRows,
        b2bDailyRowsPrev,
        b2bVisibleChannels = [],
        appliedDateRange,
        dateRangePickerProps,
        pageBusy,
        loading,
    } = sharedData || {};

    const [visibleMetricKeys, setVisibleMetricKeys] = useState(DEFAULT_B2B_VISIBLE_METRICS);

    const visibleChannelColumnKeys = useMemo(
        () => b2bVisibleChannels.map((c) => c.dailyOverviewColumnKey).filter(Boolean),
        [b2bVisibleChannels]
    );

    const channelColumnKeys = useMemo(
        () => ["ppcCost", "psCost", "pinterestCost", "snapchatCost", "bingCost", "redditCost"],
        []
    );

    const metricColumns = useMemo(
        () =>
            B2B_METRIC_COLUMNS.filter(
                (col) => !channelColumnKeys.includes(col.key) || visibleChannelColumnKeys.includes(col.key)
            ),
        [channelColumnKeys, visibleChannelColumnKeys]
    );

    const visibleMetrics = useMemo(() => {
        const map = {};
        for (const col of metricColumns) {
            map[col.key] =
                visibleMetricKeys.includes(col.key) ||
                // Show every visible channel's spend column by default.
                (channelColumnKeys.includes(col.key) && visibleChannelColumnKeys.includes(col.key));
        }
        return map;
    }, [metricColumns, visibleMetricKeys, channelColumnKeys, visibleChannelColumnKeys]);

    return (
        <div id="ParentB2BDailyView" className="apex-perf w-full apex-parent-stack">
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
                    businessCategory: "b2b",
                    dailyRows: b2bDailyRows,
                    previousPeriodRows: b2bDailyRowsPrev,
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
                            metricColumns={metricColumns}
                            visibleMetrics={visibleMetrics}
                            onToggle={(key) =>
                                setVisibleMetricKeys((prev) =>
                                    prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
                                )
                            }
                        />
                        <h3 className="apex-parent-panel__title">Daily metrics</h3>
                    </div>
                </div>

                <B2BDailyMetricsTable
                    variant="cobalt"
                    rows={b2bDailyRows || []}
                    rowsPrev={b2bDailyRowsPrev || []}
                    loading={pageBusy ?? loading}
                    error={null}
                    visibleMetrics={visibleMetrics}
                    metricColumns={metricColumns}
                />
            </div>
        </div>
    );
}
