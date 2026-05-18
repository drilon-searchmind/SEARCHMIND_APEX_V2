"use client";

import React, { useMemo } from "react";
import GraphCard from "@/components/dashboard/GraphCard";
import { parentDailySpendKey } from "@/lib/parentPropertyAdSpend";

const CHART_COLORS = ["#406969", "#C6ED62", "#f59e0b", "#ef4444", "#8b5cf6", "#0ea5e9"];

export default function ParentAdspendChart({ dailyData, loading, visibleAdSpendChannels = [] }) {
    const channels = useMemo(() => {
        if (visibleAdSpendChannels.length > 0) return visibleAdSpendChannels;
        return [
            { id: "facebook", label: "Meta" },
            { id: "google", label: "Google Ads" },
        ];
    }, [visibleAdSpendChannels]);

    const chartTitle = useMemo(() => {
        if (channels.length <= 2) {
            return "Ad Spend Allocation (Facebook & Google)";
        }
        const names = channels.map((c) => c.label).join(", ");
        return `Ad Spend Allocation (${names})`;
    }, [channels]);

    if (loading) {
        return (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="flex justify-center items-center h-80">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary-searchmind)]" />
                </div>
            </div>
        );
    }

    if (!dailyData || dailyData.length === 0) {
        return (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Ad Spend Allocation</h3>
                <div className="flex justify-center items-center h-80 text-gray-400">
                    No data available for the selected period
                </div>
            </div>
        );
    }

    const categories = dailyData.map((d) => d.period);
    const chartSeries = channels.map((ch) => ({
        name: ch.label,
        data: dailyData.map((d) => Number(d[parentDailySpendKey(ch.id)] || 0).toFixed(2)),
    }));

    const chartOptions = {
        chart: {
            id: "parent-adspend",
            toolbar: { show: false },
            fontFamily: "Outfit, sans-serif",
            zoom: { enabled: false },
        },
        stroke: { curve: "smooth", width: 2 },
        colors: CHART_COLORS.slice(0, channels.length),
        fill: {
            type: "gradient",
            gradient: {
                shade: "light",
                type: "vertical",
                shadeIntensity: 0.4,
                inverseColors: false,
                opacityFrom: 0.45,
                opacityTo: 0.1,
                stops: [5, 80, 100],
            },
        },
        xaxis: {
            type: "category",
            categories,
            labels: {
                rotate: -45,
                style: { colors: "#406969" },
            },
            axisTicks: { show: true },
            axisBorder: { show: true },
        },
        yaxis: {
            title: { text: "Ad Spend (DKK)", style: { color: "#1E2B2B" } },
            labels: {
                style: { colors: "#1E2B2B" },
                formatter: (val) => (val !== undefined ? Number(val).toLocaleString() : val),
            },
        },
        legend: {
            position: "top",
            labels: { colors: "#1E2B2B" },
        },
        tooltip: {
            shared: true,
            intersect: false,
            theme: "light",
            y: {
                formatter: (val) => `${Number(val).toLocaleString()} kr`,
            },
        },
        dataLabels: { enabled: false },
        grid: { borderColor: "#e5e7eb", strokeDashArray: 0 },
    };

    return (
        <GraphCard
            title={chartTitle}
            chartOptions={chartOptions}
            chartSeries={chartSeries}
            chartType="area"
            height={380}
        />
    );
}
