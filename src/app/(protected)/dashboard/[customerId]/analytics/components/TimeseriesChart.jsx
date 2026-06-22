"use client";

import React from "react";
import GraphCard from "@/components/dashboard/GraphCard";
import { METRICS } from "./MetricCards";

export default function TimeseriesChart({ rows = [], selectedKeys = [] }) {
    const categories = rows.map((r) => r.date);

    const chartSeries = selectedKeys.map((key) => {
        const data = rows.map((r) => {
            const v = r[key];
            if (key === "bounceRate") return Number(v) || 0;
            if (key === "averageSessionDuration") {
                return Number((v ?? 0).toFixed ? v.toFixed(2) : v) || 0;
            }
            return Number(v) || 0;
        });

        const meta = METRICS.find((m) => m.key === key) || { label: "Metric" };
        return {
            name: meta.label,
            data,
        };
    });

    const chartOptions = {
        xaxis: { categories, labels: { rotate: -45 } },
        tooltip: { shared: true },
        legend: { show: true, position: "top" },
    };

    const title =
        selectedKeys.length === 1
            ? `${METRICS.find((m) => m.key === selectedKeys[0])?.label || "Metric"} over time`
            : "Selected metrics over time";

    return (
        <GraphCard
            variant="cobalt"
            title={title}
            chartOptions={chartOptions}
            chartSeries={chartSeries}
            height={300}
        />
    );
}
