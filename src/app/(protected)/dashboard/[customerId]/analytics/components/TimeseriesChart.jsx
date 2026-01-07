"use client";

import React from "react";
import GraphCard from "@/components/dashboard/GraphCard";
import { METRICS } from "./MetricCards";

export default function TimeseriesChart({ rows = [], selectedKey }) {
    const categories = rows.map((r) => r.date);
    const data = rows.map((r) => {
        const v = r[selectedKey];
        if (selectedKey === "bounceRate") return Number(v) || 0; // already percent
        if (selectedKey === "averageSessionDuration") return Number((v ?? 0).toFixed ? v.toFixed(2) : v) || 0;
        return Number(v) || 0;
    });

    const meta = METRICS.find((m) => m.key === selectedKey) || { label: "Metric" };

    const chartSeries = [
        {
            name: meta.label,
            data,
        },
    ];

    const chartOptions = {
        chart: { toolbar: { show: false }, fontFamily: "Outfit, sans-serif" },
        xaxis: { categories, labels: { rotate: -45 }, axisBorder: { show: true }, axisTicks: { show: true } },
        colors: ["#406969"],
        stroke: { curve: "smooth", width: 2 },
        dataLabels: { enabled: false },
        grid: { borderColor: "#e5e7eb", xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
        tooltip: { shared: true },
    };

    return (
        <GraphCard title={`${meta.label} Over Time`} chartOptions={chartOptions} chartSeries={chartSeries} />
    );
}
