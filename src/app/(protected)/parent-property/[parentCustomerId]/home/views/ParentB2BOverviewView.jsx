"use client";

import React, { useMemo } from "react";
import {
    FiUsers,
    FiActivity,
    FiTarget,
    FiCreditCard,
    FiTrendingUp,
    FiBarChart2,
    FiClock,
    FiEye,
    FiZap,
    FiPercent,
} from "react-icons/fi";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import MetricCard from "@/components/dashboard/MetricCard";
import { buildB2BMetricsArray } from "@/lib/b2bDashboard/b2bOverviewMetrics";
import ParentB2BCharts from "../components/ParentB2BCharts";

const ICONS = {
    sessions: FiActivity,
    totalUsers: FiUsers,
    newUsers: FiTrendingUp,
    engagedSessions: FiZap,
    engagement_rate: FiBarChart2,
    averageSessionDuration: FiClock,
    bounce_rate: FiPercent,
    screenPageViews: FiEye,
    eventCount: FiZap,
    conversions: FiTarget,
    conversion_rate: FiBarChart2,
    marketing_spend: FiCreditCard,
    cost_per_lead: FiTarget,
    cost_per_session: FiCreditCard,
    leads_per_1k_spend: FiTrendingUp,
    sessions_per_conversion: FiActivity,
};

const SECTIONS = [
    {
        title: "Traffic",
        keys: ["sessions", "totalUsers", "newUsers", "screenPageViews", "eventCount"],
    },
    {
        title: "Engagement",
        keys: ["engagedSessions", "engagement_rate", "averageSessionDuration", "bounce_rate"],
    },
    {
        title: "Leads & efficiency",
        keys: [
            "conversions",
            "conversion_rate",
            "cost_per_lead",
            "cost_per_session",
            "leads_per_1k_spend",
            "sessions_per_conversion",
        ],
    },
];

export default function ParentB2BOverviewView({ sharedData }) {
    const {
        parentCustomer,
        parentCustomerId,
        b2bDailyRows,
        b2bMetricsData,
        b2bMetricsDataPrev,
        b2bVisibleChannels = [],
        appliedDateRange,
        comparisonMethod,
        dateRangePickerProps,
        pageBusy,
        chartBusy,
    } = sharedData || {};

    const spendKeys = useMemo(() => b2bVisibleChannels.map((c) => c.metricsDataKey), [b2bVisibleChannels]);

    const sections = useMemo(
        () => [
            ...SECTIONS,
            {
                title: "Ad spend",
                keys: ["marketing_spend", ...spendKeys],
            },
        ],
        [spendKeys]
    );

    const allKeys = useMemo(() => sections.flatMap((s) => s.keys), [sections]);

    const metricsByKey = useMemo(() => {
        const arr = buildB2BMetricsArray({
            metricsData: b2bMetricsData,
            metricsDataPrev: b2bMetricsDataPrev,
            metricKeys: allKeys,
        });
        return new Map(arr.map((m) => [m.key, m]));
    }, [b2bMetricsData, b2bMetricsDataPrev, allKeys]);

    return (
        <div id="ParentB2BOverviewView" className="apex-perf w-full apex-parent-stack">
            <DashboardHeading
                variant="cobalt"
                showRunAudit={false}
                title="Overview"
                label={parentCustomer?.name || "Parent Property"}
                customerId={parentCustomerId}
                dateRange={appliedDateRange}
                loading={pageBusy}
                dashboardType="parent-property"
                dataSnapshot={{
                    businessCategory: "b2b",
                    metrics: b2bMetricsData,
                    metricsPrev: b2bMetricsDataPrev,
                }}
                right={<DateRangePicker variant="cobalt" {...dateRangePickerProps} loading={pageBusy} />}
                comparisonMethod={comparisonMethod}
            />

            {sections.map((section) => (
                <div key={section.title} className="apex-parent-panel">
                    <h3 className="apex-parent-panel__title mb-4">{section.title}</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {section.keys
                            .map((k) => metricsByKey.get(k))
                            .filter(Boolean)
                            .map((m) => {
                                const Icon = ICONS[m.key] || FiCreditCard;
                                return (
                                    <MetricCard
                                        key={m.key}
                                        variant="cobalt"
                                        label={m.label}
                                        value={m.value}
                                        icon={<Icon />}
                                        change={m.change}
                                        changeType={m.changeType}
                                        changeAbsolute={m.changeAbsolute}
                                        changePrevValue={m.changePrevValue}
                                        comparisonMethod={comparisonMethod}
                                        className="min-w-0"
                                    />
                                );
                            })}
                    </div>
                </div>
            ))}

            <ParentB2BCharts rows={b2bDailyRows} loading={chartBusy} />
        </div>
    );
}
