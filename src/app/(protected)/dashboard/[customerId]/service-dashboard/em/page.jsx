"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import MetricCard from "@/components/dashboard/MetricCard";
import GraphCard from "@/components/dashboard/GraphCard";
import { FiMail, FiMousePointer, FiTrendingUp, FiDollarSign, FiSend, FiUserX } from "react-icons/fi";
import { useCustomers } from "@/hooks/useCustomers";

// Email-specific metrics (placeholders - no data yet)
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
    const [comparisonMethod, setComparisonMethod] = useState("Last Period");
    const [tempComparisonMethod, setTempComparisonMethod] = useState("Last Period");
    const [selectedMetrics, setSelectedMetrics] = useState(["revenue"]);

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

    const loading = false;
    const error = null;

    const metrics = METRIC_OPTIONS.map(opt => ({
        label: opt.label,
        value: null,
        change: undefined,
        changeType: undefined,
    }));

    const chartCategories = [];
    const chartSeries = [];
    const chartOptions = {
        chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: 'Outfit, sans-serif' },
        xaxis: { categories: chartCategories },
        yaxis: {},
        colors: ["#406969", "#1E2B2B", "#4F46E5", "#06B6D4", "#C6ED62", "#D6CDB6", "#F59E0B", "#EF4444"],
        stroke: { width: 2, curve: 'smooth' },
        fill: { type: 'solid', opacity: 1 },
        grid: { borderColor: '#e5e7eb', strokeDashArray: 0, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
        dataLabels: { enabled: false },
        tooltip: { theme: 'light' },
        legend: { show: true, position: 'top' },
    };

    const topCampaigns = [];

    if (!customerId) return null;

    return (
        <div className="w-full">
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

            {/* Metrics Cards Section */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6 w-full mb-8">
                {metrics.map((metric, idx) => {
                    const Icon = METRIC_OPTIONS[idx]?.icon;
                    const isActive = selectedMetrics.includes(METRIC_OPTIONS[idx]?.key);
                    return (
                        <div
                            key={idx}
                            onClick={() => setSelectedMetrics(prev => {
                                const metricKey = METRIC_OPTIONS[idx]?.key;
                                if (prev.includes(metricKey)) {
                                    return prev.length > 1 ? prev.filter(m => m !== metricKey) : prev;
                                }
                                return [...prev, metricKey];
                            })}
                            style={{ cursor: 'pointer' }}
                        >
                            <MetricCard
                                label={metric.label}
                                value={metric.value !== null && metric.value !== undefined ? metric.value : "—"}
                                icon={Icon ? <Icon size={22} color={isActive ? '#fff' : undefined} /> : null}
                                isActive={isActive}
                                change={metric.change}
                                changeType={metric.changeType}
                                comparisonMethod={comparisonMethod}
                            />
                        </div>
                    );
                })}
            </div>

            {/* Graph Section */}
            <div className="mb-8">
                <div className="flex items-center gap-4 mb-2">
                    <span className="font-semibold">Metric:</span>
                    <div className="flex gap-2 flex-wrap">
                        {METRIC_OPTIONS.map(opt => (
                            <button
                                key={opt.key}
                                className={`px-3 py-1 rounded text-xs font-medium border transition-colors duration-150 ${selectedMetrics.includes(opt.key) ? 'bg-white text-[var(--color-primary-searchmind)] border-[var(--color-primary-searchmind)] shadow-sm' : 'text-gray-500 border-gray-200 hover:text-[var(--color-primary-searchmind)]'}`}
                                onClick={() => setSelectedMetrics(prev => {
                                    if (prev.includes(opt.key)) {
                                        return prev.length > 1 ? prev.filter(m => m !== opt.key) : prev;
                                    }
                                    return [...prev, opt.key];
                                })}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
                <GraphCard
                    title={
                        selectedMetrics.length === 1
                            ? `${METRIC_OPTIONS.find(opt => opt.key === selectedMetrics[0])?.label ?? "Metric"} vs ${comparisonMethod}`
                            : `Multiple Email Metrics vs ${comparisonMethod}`
                    }
                    chartOptions={chartOptions}
                    chartSeries={chartSeries}
                />
            </div>

            {/* Top Campaigns Table */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold mb-4">Top Email Campaigns</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-xs text-left border-collapse" style={{ fontSize: '12px' }}>
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
                            <tr>
                                <td colSpan={5} className="text-center py-8 text-gray-400">No email campaign data for selected range.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
