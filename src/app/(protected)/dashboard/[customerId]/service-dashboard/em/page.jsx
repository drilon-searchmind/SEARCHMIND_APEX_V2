"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import MetricCard from "@/components/dashboard/MetricCard";
import Spinner from "@/components/ui/Spinner";
import { FiMail, FiMousePointer, FiTrendingUp, FiDollarSign, FiSend, FiUserX } from "react-icons/fi";
import { useCustomers } from "@/hooks/useCustomers";
import dayjs from "dayjs";

const METRIC_OPTIONS = [
    { key: "revenue", label: "Revenue", icon: FiDollarSign },
    { key: "emails_sent", label: "Emails sent", icon: FiSend },
    { key: "open_rate", label: "Open rate", icon: FiMail },
    { key: "click_rate", label: "Click rate", icon: FiMousePointer },
    { key: "conversions", label: "Conversions", icon: FiTrendingUp },
    { key: "unsubscribes", label: "Unsubscribes", icon: FiUserX },
    { key: "clicks", label: "Clicks", icon: FiMousePointer },
    { key: "opens", label: "Opens", icon: FiMail },
];

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

export default function EmailDashboardPage() {
    const params = useParams();
    const { customers } = useCustomers();
    const customer = customers.find((c) => c._id === params.customerId);
    const customerId = params?.customerId;

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const isFirstOfMonth = today.getDate() === 1;
    const defaultStart = `${yyyy}-${mm}-01`;
    const defaultEnd = isFirstOfMonth ? `${yyyy}-${mm}-01` : `${yyyy}-${mm}-${String(today.getDate() - 1).padStart(2, '0')}`;
    const defaultRangeValue = { startDate: defaultStart, endDate: defaultEnd };

    const [tempRange, setTempRange] = useState(defaultRangeValue);
    const [appliedRange, setAppliedRange] = useState(defaultRangeValue);
    const [comparisonMethod, setComparisonMethod] = useState("Last Year");
    const [tempComparisonMethod, setTempComparisonMethod] = useState("Last Year");
    const [selectedMetrics, setSelectedMetrics] = useState(["revenue"]);
    const [metricsByDate, setMetricsByDate] = useState([]);
    const [metricsByDatePrev, setMetricsByDatePrev] = useState([]);
    const [topCampaigns, setTopCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (selectedMetrics.length === 0) setSelectedMetrics(["revenue"]);
    }, [selectedMetrics]);

    const handleDateRangeApply = ({ startDate, endDate, comparisonMethod: appliedComparison }) => {
        setAppliedRange({ startDate, endDate });
        if (appliedComparison) setComparisonMethod(appliedComparison);
    };
    const handleStartDateChange = (newStart) => {
        setTempRange((dr) => ({ ...dr, startDate: newStart }));
    };
    const handleEndDateChange = (newEnd) => {
        setTempRange((dr) => ({ ...dr, endDate: newEnd }));
    };

    const hasKlaviyoCredentials = !!customer?.CustomerSettings?.klaviyoPrivateApiKey;

    useEffect(() => {
        if (!customer || !hasKlaviyoCredentials || !customerId) {
            setLoading(false);
            return;
        }
        const abortController = new AbortController();
        const signal = abortController.signal;

        const start = dayjs(appliedRange.startDate);
        const end = dayjs(appliedRange.endDate);
        const days = end.diff(start, 'day') + 1;
        let prevStart, prevEnd;
        if (comparisonMethod === "Last Year") {
            prevStart = start.subtract(1, 'year');
            prevEnd = end.subtract(1, 'year');
        } else {
            prevEnd = start.subtract(1, 'day');
            prevStart = prevEnd.subtract(days - 1, 'day');
        }

        (async () => {
            setLoading(true);
            setError(null);
            let aborted = false;
            try {
                // 1. Fetch current period only (fast ~5–10s) – show immediately
                const currentParams = new URLSearchParams({
                    startDate: appliedRange.startDate,
                    endDate: appliedRange.endDate,
                });
                const res = await fetch(`/api/klaviyo-dashboard/${customerId}?${currentParams}`, { signal });
                if (signal.aborted) { aborted = true; return; }
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error || `Klaviyo API error: ${res.status}`);
                }
                const data = await res.json();
                setMetricsByDate(data.metrics_by_date || []);
                setTopCampaigns(data.top_campaigns || []);
                setLoading(false);

                // 2. Fetch previous period in background after 65s (Klaviyo campaign-values-reports: 2/min)
                await new Promise((r) => setTimeout(r, 65000));
                if (signal.aborted) { aborted = true; return; }
                const prevParams = new URLSearchParams({
                    startDate: prevStart.format('YYYY-MM-DD'),
                    endDate: prevEnd.format('YYYY-MM-DD'),
                });
                const resPrev = await fetch(`/api/klaviyo-dashboard/${customerId}?${prevParams}`, { signal });
                if (resPrev.ok && !signal.aborted) {
                    const dataPrev = await resPrev.json();
                    setMetricsByDatePrev(dataPrev.metrics_by_date || []);
                }
            } catch (err) {
                if (err.name === 'AbortError') {
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
    }, [customer, customerId, hasKlaviyoCredentials, appliedRange, comparisonMethod]);

    const percentChange = (current, prev) => {
        if (prev === 0 || prev === null || prev === undefined) return null;
        return ((current - prev) / Math.abs(prev)) * 100;
    };
    const changeType = (val) => {
        if (val === null) return undefined;
        return val > 0 ? "up" : val < 0 ? "down" : undefined;
    };

    const formatValue = (val, key) => {
        if (val === null || val === undefined) return "—";
        if (key === "revenue") return `${Number(val).toLocaleString("da-DK", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kr.`;
        if (key === "open_rate" || key === "click_rate") return `${(Number(val) * 100).toFixed(1)}%`;
        return Number(val).toLocaleString("da-DK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    };

    const metrics = useMemo(() => {
        const currentValues = METRIC_OPTIONS.map((opt) => agg(opt.key, metricsByDate));
        const prevValues = METRIC_OPTIONS.map((opt) => agg(opt.key, metricsByDatePrev));
        return METRIC_OPTIONS.map((opt, i) => {
            const current = currentValues[i];
            const prev = prevValues[i];
            const change = percentChange(current, prev);
            const changeAbs = current != null && prev != null ? current - prev : null;
        let changeAbsoluteStr = null;
        if (changeAbs != null && opt.key === "revenue") changeAbsoluteStr = `${changeAbs >= 0 ? "+" : ""}${changeAbs.toLocaleString("da-DK", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kr.`;
        else if (changeAbs != null && (opt.key === "open_rate" || opt.key === "click_rate")) changeAbsoluteStr = `${changeAbs >= 0 ? "+" : ""}${(changeAbs * 100).toFixed(1)}%`;
        else if (changeAbs != null) changeAbsoluteStr = `${changeAbs >= 0 ? "+" : ""}${changeAbs.toLocaleString("da-DK", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
        return {
                label: opt.label,
                value: formatValue(current, opt.key),
                change: change !== null ? Math.abs(change).toFixed(1) : undefined,
                changeType: changeType(change),
                changePrevValue: prev != null ? formatValue(prev, opt.key) : null,
                changeAbsolute: changeAbsoluteStr,
            };
        });
    }, [metricsByDate, metricsByDatePrev]);

    if (!customerId) return null;

    return (
        <div className="w-full">
            {!hasKlaviyoCredentials && (
                <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                    Configure your Klaviyo Private API Key in{" "}
                    <a href={`/dashboard/${customerId}/config`} className="font-semibold underline hover:text-amber-900">
                        Property Settings → Email (Klaviyo)
                    </a>{" "}
                    to enable email metrics.
                </div>
            )}
            {error && (
                <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
                    {error}
                </div>
            )}
            <DashboardHeading
                title="Email Dashboard"
                label={customer ? customer.customerName : ""}
                customerId={customerId}
                dateRange={appliedRange}
                comparisonMethod={comparisonMethod}
                loading={loading}
                dashboardType="em-dashboard"
                dataSnapshot={{ selectedMetrics, METRIC_OPTIONS }}
                right={
                    <DateRangePicker
                        onApply={handleDateRangeApply}
                        startDate={tempRange.startDate}
                        endDate={tempRange.endDate}
                        onStartDateChange={handleStartDateChange}
                        onEndDateChange={handleEndDateChange}
                        loading={loading}
                        showComparisonMethodToggler={true}
                        comparisonMethod={tempComparisonMethod}
                        onComparisonMethodChange={setTempComparisonMethod}
                    />
                }
            />

            {loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <Spinner />
                    <p className="text-sm text-gray-500">Fetching email data…</p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6 w-full mb-8">
                        {metrics.map((metric, idx) => {
                            const Icon = METRIC_OPTIONS[idx]?.icon;
                            const isActive = selectedMetrics.includes(METRIC_OPTIONS[idx]?.key);
                            return (
                                <div
                                    key={idx}
                                    onClick={() =>
                                        setSelectedMetrics((prev) => {
                                            const metricKey = METRIC_OPTIONS[idx]?.key;
                                            if (prev.includes(metricKey)) {
                                                return prev.length > 1 ? prev.filter((m) => m !== metricKey) : prev;
                                            }
                                            return [...prev, metricKey];
                                        })
                                    }
                                    style={{ cursor: "pointer" }}
                                >
                                    <MetricCard
                                        label={metric.label}
                                        value={metric.value ?? "—"}
                                        icon={Icon ? <Icon size={22} color={isActive ? "#fff" : undefined} /> : null}
                                        isActive={isActive}
                                        change={metric.change}
                                        changeType={metric.changeType}
                                        changePrevValue={metric.changePrevValue}
                                        changeAbsolute={metric.changeAbsolute}
                                        comparisonMethod={comparisonMethod}
                                    />
                                </div>
                            );
                        })}
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                        <h3 className="text-lg font-semibold mb-4">Top Email Campaigns</h3>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-xs text-left border-collapse" style={{ fontSize: "12px" }}>
                                <thead>
                                    <tr className="bg-gray-50">
                                        <th className="px-3 py-1.5 font-semibold text-gray-700">Campaign</th>
                                        <th className="px-3 py-1.5 font-semibold text-gray-700">Opens</th>
                                        <th className="px-3 py-1.5 font-semibold text-gray-700">Clicks</th>
                                        <th className="px-3 py-1.5 font-semibold text-gray-700">Open rate</th>
                                        <th className="px-3 py-1.5 font-semibold text-gray-700">Click rate</th>
                                    </tr>
                                </thead>
                                <tbody className="text-[12px]">
                                    {topCampaigns.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="text-center py-8 text-gray-400">
                                                No email campaign data for selected range.
                                            </td>
                                        </tr>
                                    ) : (
                                        topCampaigns.map((c, i) => (
                                            <tr key={i} className="border-b border-gray-100">
                                                <td className="px-3 py-2 font-medium">{c.campaign_name}</td>
                                                <td className="px-3 py-2">{c.opens?.toLocaleString() ?? "—"}</td>
                                                <td className="px-3 py-2">{c.clicks?.toLocaleString() ?? "—"}</td>
                                                <td className="px-3 py-2">
                                                    {c.open_rate != null ? `${(c.open_rate * 100).toFixed(1)}%` : "—"}
                                                </td>
                                                <td className="px-3 py-2">
                                                    {c.click_rate != null ? `${(c.click_rate * 100).toFixed(1)}%` : "—"}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
