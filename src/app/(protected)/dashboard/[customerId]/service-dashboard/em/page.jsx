"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import MetricCard from "@/components/dashboard/MetricCard";
import CobaltLoader from "@/components/ui/CobaltLoader";
import { useCustomers } from "@/hooks/useCustomers";
import { isDemoCustomerId } from "@/lib/demoCustomer";
import { pushDashboardDateRangeApplied } from "@root/lib/gtmFunctions";
import { useDashboardDateRange } from "@/hooks/useDashboardDateRange";
import { formatComparisonPeriodDates } from "@/lib/dateRangeComparison";
import PsSortableMetricsTable from "../ps/components/PsSortableMetricsTable";
import {
    KPI_ROW1,
    KPI_ROW2,
    METRIC_OPTIONS,
    CAMPAIGN_TABLE_COLUMNS,
} from "./components/emDashboardConfig";
import "./em-dashboard.css";

function rowToMetric(row, key) {
    if (key === "revenue") return row?.conversion_value ?? 0;
    if (key === "emails_sent") return row?.recipients ?? 0;
    if (key === "open_rate") return row?.open_rate ?? null;
    if (key === "click_rate") return row?.click_rate ?? null;
    if (key === "conversions") return row?.conversions ?? 0;
    if (key === "unsubscribes") return row?.unsubscribes ?? 0;
    if (key === "clicks") return row?.clicks ?? 0;
    if (key === "opens") return row?.opens ?? 0;
    return row?.[key] ?? 0;
}

function agg(key, data) {
    if (!data?.length) return null;
    if (key === "open_rate" || key === "click_rate") {
        const totalRecipients = data.reduce((s, r) => s + (r.recipients ?? 0), 0);
        if (totalRecipients === 0) return null;
        if (key === "open_rate") {
            const totalOpens = data.reduce((s, r) => s + (r.opens ?? 0), 0);
            return totalOpens / totalRecipients;
        }
        const totalClicks = data.reduce((s, r) => s + (r.clicks ?? 0), 0);
        return totalClicks / totalRecipients;
    }
    return data.reduce((s, r) => s + (rowToMetric(r, key) ?? 0), 0);
}

function formatValue(val, key) {
    if (val === null || val === undefined) return "—";
    if (key === "revenue") {
        return `${Number(val).toLocaleString("da-DK", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kr.`;
    }
    if (key === "open_rate" || key === "click_rate") {
        return `${(Number(val) * 100).toFixed(1)}%`;
    }
    return Number(val).toLocaleString("da-DK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function EmailDashboardPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const rangeStartQ = searchParams.get("startDate");
    const rangeEndQ = searchParams.get("endDate");
    const { customers } = useCustomers();
    const customer = customers.find((c) => c._id === params.customerId);
    const customerId = params?.customerId;

    const {
        setTempDateRange: setTempRange,
        appliedDateRange: appliedRange,
        setAppliedDateRange: setAppliedRange,
        appliedCompareRange,
        comparisonMethod,
        dateRangePickerProps,
    } = useDashboardDateRange({
        onApply: ({ startDate, endDate, comparisonMethod: appliedComparison }) => {
            pushDashboardDateRangeApplied({
                page: "service_dashboard_em",
                customerId,
                startDate,
                endDate,
                comparisonMethod: appliedComparison,
            });
        },
    });

    const [selectedMetrics, setSelectedMetrics] = useState(["revenue"]);
    const [metricsByDate, setMetricsByDate] = useState([]);
    const [metricsByDatePrev, setMetricsByDatePrev] = useState([]);
    const [topCampaigns, setTopCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (selectedMetrics.length === 0) setSelectedMetrics(["revenue"]);
    }, [selectedMetrics]);

    useEffect(() => {
        if (rangeStartQ && rangeEndQ) {
            setTempRange({ startDate: rangeStartQ, endDate: rangeEndQ });
            setAppliedRange({ startDate: rangeStartQ, endDate: rangeEndQ });
        }
    }, [rangeStartQ, rangeEndQ, setTempRange, setAppliedRange]);

    const hasKlaviyoCredentials =
        !!customer?.CustomerSettings?.klaviyoPrivateApiKey || isDemoCustomerId(customerId);

    useEffect(() => {
        if (!customer || !hasKlaviyoCredentials || !customerId) {
            setLoading(false);
            return;
        }
        const abortController = new AbortController();
        const signal = abortController.signal;

        const compDates = formatComparisonPeriodDates({
            comparisonMethod,
            startDate: appliedRange.startDate,
            endDate: appliedRange.endDate,
            compareStartDate: appliedCompareRange.startDate,
            compareEndDate: appliedCompareRange.endDate,
        });

        const isDemo = isDemoCustomerId(String(customerId));

        (async () => {
            setLoading(true);
            setError(null);
            let aborted = false;
            try {
                const currentParams = new URLSearchParams({
                    startDate: appliedRange.startDate,
                    endDate: appliedRange.endDate,
                });

                if (isDemo && !compDates.skip && compDates.startDate && compDates.endDate) {
                    currentParams.set("prevStartDate", compDates.startDate);
                    currentParams.set("prevEndDate", compDates.endDate);
                }

                const res = await fetch(`/api/klaviyo-dashboard/${customerId}?${currentParams}`, { signal });
                if (signal.aborted) {
                    aborted = true;
                    return;
                }
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error || `Klaviyo API error: ${res.status}`);
                }
                const data = await res.json();
                setMetricsByDate(data.metrics_by_date || []);
                setTopCampaigns(data.top_campaigns || []);

                if (isDemo) {
                    setMetricsByDatePrev(data.metrics_by_date_prev || []);
                    setLoading(false);
                    return;
                }

                setMetricsByDatePrev([]);
                setLoading(false);

                if (!compDates.skip && compDates.startDate && compDates.endDate) {
                    await new Promise((r) => setTimeout(r, 65000));
                    if (signal.aborted) {
                        aborted = true;
                        return;
                    }
                    const prevParams = new URLSearchParams({
                        startDate: compDates.startDate,
                        endDate: compDates.endDate,
                    });
                    const resPrev = await fetch(`/api/klaviyo-dashboard/${customerId}?${prevParams}`, { signal });
                    if (resPrev.ok && !signal.aborted) {
                        const dataPrev = await resPrev.json();
                        setMetricsByDatePrev(dataPrev.metrics_by_date || []);
                    }
                }
            } catch (err) {
                if (err.name === "AbortError") {
                    aborted = true;
                    return;
                }
                setError(err.message);
                setMetricsByDate([]);
                setMetricsByDatePrev([]);
                setTopCampaigns([]);
            } finally {
                if (!aborted) setLoading(false);
            }
        })();

        return () => abortController.abort();
    }, [customer, customerId, hasKlaviyoCredentials, appliedRange, appliedCompareRange, comparisonMethod]);

    const percentChange = (current, prev) => {
        if (prev === 0 || prev === null || prev === undefined) return null;
        return ((current - prev) / Math.abs(prev)) * 100;
    };
    const changeType = (val) => {
        if (val === null) return undefined;
        return val > 0 ? "up" : val < 0 ? "down" : undefined;
    };

    const buildMetricCard = (opt) => {
        const current = agg(opt.key, metricsByDate);
        const prev = metricsByDatePrev.length > 0 ? agg(opt.key, metricsByDatePrev) : null;
        const change = percentChange(current, prev);
        const changeAbs = current != null && prev != null ? current - prev : null;
        let changeAbsoluteStr = null;
        if (changeAbs != null && opt.key === "revenue") {
            changeAbsoluteStr = `${changeAbs >= 0 ? "+" : ""}${changeAbs.toLocaleString("da-DK", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kr.`;
        } else if (changeAbs != null && (opt.key === "open_rate" || opt.key === "click_rate")) {
            changeAbsoluteStr = `${changeAbs >= 0 ? "+" : ""}${(changeAbs * 100).toFixed(1)}%`;
        } else if (changeAbs != null) {
            changeAbsoluteStr = `${changeAbs >= 0 ? "+" : ""}${changeAbs.toLocaleString("da-DK", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
        }

        const isActive = selectedMetrics.includes(opt.key);
        const Icon = opt.icon;

        return (
            <div
                key={opt.key}
                className="apex-em-kpi-card"
                onClick={() =>
                    setSelectedMetrics((prev) => {
                        if (prev.includes(opt.key)) {
                            return prev.length > 1 ? prev.filter((m) => m !== opt.key) : prev;
                        }
                        return [...prev, opt.key];
                    })
                }
            >
                <MetricCard
                    variant="cobalt"
                    label={opt.label}
                    value={formatValue(current, opt.key)}
                    icon={Icon ? <Icon className="w-4 h-4 shrink-0" /> : null}
                    isActive={isActive}
                    change={change !== null ? Math.abs(change).toFixed(1) : undefined}
                    changeType={changeType(change)}
                    changePrevValue={prev != null ? formatValue(prev, opt.key) : null}
                    changeAbsolute={changeAbsoluteStr}
                    comparisonMethod={comparisonMethod}
                />
            </div>
        );
    };

    const campaignRows = useMemo(
        () =>
            topCampaigns.map((r, i) => ({
                ...r,
                id: r.campaign_id || r.campaign_name || i,
            })),
        [topCampaigns]
    );

    if (!customerId) return null;

    return (
        <div id="EmDashboardPage" className="cobalt-perf w-full" data-theme="cobalt">
            {!hasKlaviyoCredentials && (
                <div className="apex-em-alert">
                    Configure your Klaviyo Private API Key in{" "}
                    <a href={`/dashboard/${customerId}/config`}>Property Settings → Email (Klaviyo)</a>{" "}
                    to enable email metrics.
                </div>
            )}

            <DashboardHeading
                variant="cobalt"
                showRunAudit={false}
                title="Email Dashboard"
                label={customer ? customer.customerName : ""}
                customerId={customerId}
                dateRange={appliedRange}
                comparisonMethod={comparisonMethod}
                loading={loading}
                dashboardType="em-dashboard"
                dataSnapshot={{ selectedMetrics, METRIC_OPTIONS }}
                right={
                    <DateRangePicker {...dateRangePickerProps} variant="cobalt" loading={loading} />
                }
            />

            {error ? <div className="apex-em-error">{error}</div> : null}

            {!hasKlaviyoCredentials ? null : loading ? (
                <div className="apex-perf-loading">
                    <CobaltLoader
                        variant="block"
                        title="Loading email metrics"
                        request="GET /api/klaviyo-dashboard"
                    />
                </div>
            ) : (
                <div className="apex-em-panel">
                    <section className="apex-em-section">
                        <h3 className="apex-em-section__label">Revenue & delivery</h3>
                        <div className="apex-em-kpi-grid apex-em-kpi-grid--4">
                            {KPI_ROW1.map((opt) => buildMetricCard(opt))}
                        </div>
                    </section>

                    <section className="apex-em-section">
                        <h3 className="apex-em-section__label">Engagement & list health</h3>
                        <div className="apex-em-kpi-grid apex-em-kpi-grid--4">
                            {KPI_ROW2.map((opt) => buildMetricCard(opt))}
                        </div>
                    </section>

                    <PsSortableMetricsTable
                        variant="cobalt"
                        cobaltScope="em"
                        title="Top email campaigns"
                        subtitle="Sorted by opens — heatmap highlights relative performance within the table."
                        columns={CAMPAIGN_TABLE_COLUMNS}
                        rows={campaignRows}
                        rowKeyField="id"
                    />
                </div>
            )}
        </div>
    );
}
