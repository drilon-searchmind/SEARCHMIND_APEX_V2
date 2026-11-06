"use client";

import React, { useState } from "react";
import GraphCard from "@/components/dashboard/GraphCard";
import CobaltLoader from "@/components/ui/CobaltLoader";
import { nf0, nf2 } from "./HeroKpi";
import { MONTH_NAMES } from "./auraSheetLogic";

/** Display formats for the metric dropdowns. Ratios (CTR, conv. rate) are stored as 0..1 and shown as percent. */
const FORMATS = {
    number: (v) => nf0.format(v),
    decimal: (v) => nf2.format(v),
    percent: (v) => `${nf2.format(v * 100)}%`,
};

/** This year (ink) against last year (blue), like the sheet's two line charts. */
const COLORS = ["#131313", "#2563eb"];

function buildChart(metric, current, previous, year) {
    const fmt = FORMATS[metric.format];
    const pick = (months) => months.map((m) => (m ? m[metric.key] : null));
    const max = Math.max(0, ...pick(current).filter((v) => v != null), ...pick(previous).filter((v) => v != null));
    return {
        options: {
            chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: "Outfit, sans-serif" },
            colors: COLORS,
            stroke: { width: [3, 2], curve: "smooth" },
            markers: { size: [4, 0] },
            xaxis: { categories: MONTH_NAMES, labels: { rotate: -45 } },
            yaxis: { min: 0, max: max > 0 ? undefined : 1, labels: { formatter: (v) => fmt(v) } },
            dataLabels: {
                enabled: true,
                enabledOnSeries: [0],
                formatter: (v) => (v == null ? "" : fmt(v)),
                background: { enabled: false },
                style: { fontSize: "11px", fontWeight: 600, colors: ["#131313"] },
                offsetY: -6,
            },
            legend: { show: true, position: "bottom" },
            grid: { borderColor: "#e5e7eb", xaxis: { lines: { show: false } } },
            tooltip: { theme: "light", shared: true, y: { formatter: (v) => (v == null ? "No data" : fmt(v)) } },
        },
        series: [
            { name: `${metric.label} ${year}`, data: pick(current) },
            { name: `${metric.label} ${year - 1}`, data: pick(previous) },
        ],
    };
}

/**
 * Monthly line chart for one metric picked in a dropdown, this year against last year.
 * `current` / `previous`: 12 month objects (or null for months without data) keyed by metric.key.
 * `metrics`: [{ key, label, format: "number" | "decimal" | "percent" }].
 */
export default function AuraMonthlyMetricChart({ metrics, defaultKey, current, previous, ariaLabel }) {
    const [key, setKey] = useState(defaultKey);
    const year = new Date().getFullYear();
    const metric = metrics.find((m) => m.key === key) || metrics[0];
    const chart = current && previous ? buildChart(metric, current, previous, year) : null;

    return (
        <section className="aura-chart" aria-label={ariaLabel}>
            <label className="aura-chart__select">
                <span className="sr-only">Metric</span>
                <select value={key} onChange={(e) => setKey(e.target.value)}>
                    {metrics.map((m) => (
                        <option key={m.key} value={m.key}>
                            {m.label}
                        </option>
                    ))}
                </select>
            </label>
            {chart ? (
                <GraphCard
                    variant="cobalt"
                    title={metric.label}
                    chartOptions={chart.options}
                    chartSeries={chart.series}
                    height={340}
                    hideChartToggle
                />
            ) : (
                <div className="apex-perf-loading">
                    <CobaltLoader variant="block" title="Loading monthly data" request="GET /api/google-ppc-dashboard" />
                </div>
            )}
        </section>
    );
}
