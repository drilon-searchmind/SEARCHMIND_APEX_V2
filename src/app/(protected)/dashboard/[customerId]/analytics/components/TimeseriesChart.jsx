"use client";

import React from "react";
import GraphCard from "@/components/dashboard/GraphCard";
import { METRICS } from "./MetricCards";

export default function TimeseriesChart({ rows = [], selectedKeys = [] }) {
    const categories = rows.map((r) => r.date);

    const chartSeries = selectedKeys.map(key => {
        const data = rows.map((r) => {
            const v = r[key];
            if (key === "bounceRate") return Number(v) || 0; // already percent
            if (key === "averageSessionDuration") return Number((v ?? 0).toFixed ? v.toFixed(2) : v) || 0;
            return Number(v) || 0;
        });

        const meta = METRICS.find((m) => m.key === key) || { label: "Metric" };
        return {
            name: meta.label,
            data,
        };
    });

    const chartOptions = {
        chart: { toolbar: { show: false }, fontFamily: "Outfit, sans-serif" },
        xaxis: { categories, labels: { rotate: -45 }, axisBorder: { show: true }, axisTicks: { show: true } },
        colors: ["#406969", "#1E2B2B", "#4F46E5", "#06B6D4"], // Multiple colors for different metrics
        stroke: { curve: "smooth", width: 2 },
        dataLabels: { enabled: false },
        grid: { borderColor: "#e5e7eb", xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
        tooltip: { shared: true },
        legend: { show: true, position: 'top' },
    };

    const title = selectedKeys.length === 1
        ? `${METRICS.find((m) => m.key === selectedKeys[0])?.label || "Metric"} Over Time`
        : "Multiple Metrics Over Time";

    return (
        <GraphCard title={title} chartOptions={chartOptions} chartSeries={chartSeries} />
    );
}
