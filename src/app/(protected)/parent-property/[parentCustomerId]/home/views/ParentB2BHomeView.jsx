"use client";

import React, { useMemo } from "react";
import { FiActivity, FiTarget, FiBarChart2, FiCreditCard } from "react-icons/fi";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import MetricCard from "@/components/dashboard/MetricCard";
import { buildB2BMetricsArray } from "@/lib/b2bDashboard/b2bOverviewMetrics";
import ParentB2BChildTable from "../components/ParentB2BChildTable";
import ParentB2BCharts from "../components/ParentB2BCharts";

const KPI_KEYS = ["sessions", "conversions", "conversion_rate", "marketing_spend", "cost_per_lead"];
const KPI_ICONS = {
    sessions: FiActivity,
    conversions: FiTarget,
    conversion_rate: FiBarChart2,
    marketing_spend: FiCreditCard,
    cost_per_lead: FiTarget,
};

export default function ParentB2BHomeView({ sharedData }) {
    const {
        parentCustomer,
        parentCustomerId,
        b2bRows,
        b2bDailyRows,
        b2bMetricsData,
        b2bMetricsDataPrev,
        appliedDateRange,
        comparisonMethod,
        dateRangePickerProps,
        pageBusy,
        chartBusy,
        error,
    } = sharedData || {};

    const kpis = useMemo(
        () =>
            buildB2BMetricsArray({
                metricsData: b2bMetricsData,
                metricsDataPrev: b2bMetricsDataPrev,
                metricKeys: KPI_KEYS,
            }),
        [b2bMetricsData, b2bMetricsDataPrev]
    );

    return (
        <div id="ParentPropertyHome" className="apex-perf w-full apex-parent-stack">
            <DashboardHeading
                variant="cobalt"
                showRunAudit={false}
                title="Parent Property Overview"
                label={parentCustomer?.name || parentCustomerId}
                customerId={parentCustomerId}
                dateRange={appliedDateRange}
                loading={pageBusy}
                dashboardType="parent-property"
                dataSnapshot={{
                    businessCategory: "b2b",
                    metrics: b2bMetricsData,
                    metricsPrev: b2bMetricsDataPrev,
                    tableRows: b2bRows,
                    dailyRows: b2bDailyRows,
                }}
                right={<DateRangePicker variant="cobalt" {...dateRangePickerProps} loading={pageBusy} />}
                comparisonMethod={comparisonMethod}
            />

            <div className="apex-parent-kpi-grid">
                {kpis.map((m) => {
                    const Icon = KPI_ICONS[m.key];
                    return (
                        <MetricCard
                            key={m.key}
                            variant="cobalt"
                            label={m.label}
                            value={m.value}
                            icon={Icon ? <Icon /> : undefined}
                            change={m.change}
                            changeType={m.changeType}
                            changeAbsolute={m.changeAbsolute}
                            changePrevValue={m.changePrevValue}
                            comparisonMethod={comparisonMethod}
                        />
                    );
                })}
            </div>

            <ParentB2BChildTable rows={b2bRows} loading={pageBusy} error={error} />

            <ParentB2BCharts rows={b2bDailyRows} loading={chartBusy} />
        </div>
    );
}
