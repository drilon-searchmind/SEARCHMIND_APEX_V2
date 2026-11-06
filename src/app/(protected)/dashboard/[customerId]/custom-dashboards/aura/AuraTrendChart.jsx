"use client";

import React, { useState } from "react";
import GraphCard from "@/components/dashboard/GraphCard";
import CobaltLoader from "@/components/ui/CobaltLoader";
import { AURA_MONTHLY_CAC_GOAL, AURA_MONTHLY_CUSTOMER_GOAL, MONTH_NAMES, monthlyTrend } from "./auraSheetLogic";

const METRICS = {
    conversions: { label: "Conversions", goal: AURA_MONTHLY_CUSTOMER_GOAL },
    cac: { label: "CAC", goal: AURA_MONTHLY_CAC_GOAL },
};

const nf0 = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 });
const fmtValue = (v) => (v == null ? "" : nf0.format(v));

/** Distinct, non-brand series colours: this year (ink), last year (blue), goal (grey, dashed). */
const COLORS = ["#131313", "#2563eb", "#a8a29e"];

function buildTrend(sheet, spend) {
    return monthlyTrend({
        googleRows: spend?.google,
        metaRows: spend?.meta,
        conversions: sheet.sheet.conversions,
        otherCost: sheet.sheet.otherCost,
        spendKnown: Boolean(spend) && spend.spendOk && sheet.sheetOk,
    });
}

function buildChart(trends, metric, year) {
    const pick = (arr) => arr.map((m) => m[metric]);
    const previous = pick(trends.previous);
    const goal = METRICS[metric].goal;
    return {
        options: {
            chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: "Outfit, sans-serif" },
            colors: COLORS,
            stroke: { width: [3, 2, 2], curve: "smooth", dashArray: [0, 0, 6] },
            markers: { size: [4, 0, 0] },
            xaxis: { categories: MONTH_NAMES, labels: { rotate: -45 } },
            yaxis: { min: 0, labels: { formatter: (v) => nf0.format(v) } },
            dataLabels: {
                enabled: true,
                enabledOnSeries: [0, 1],
                formatter: (v) => fmtValue(v),
                background: { enabled: false },
                style: { fontSize: "11px", fontWeight: 600, colors: ["#131313", "#2563eb"] },
                offsetY: -6,
            },
            legend: { show: true, position: "top" },
            grid: { borderColor: "#e5e7eb", xaxis: { lines: { show: false } } },
            tooltip: { theme: "light", shared: true, y: { formatter: (v) => (v == null ? "No data" : fmtValue(v)) } },
        },
        series: [
            { name: String(year), data: pick(trends.current) },
            { name: String(year - 1), data: previous },
            // Like the sheet, the goal line is drawn for months that have a last-year value.
            { name: "Goal", data: previous.map((v) => (v == null ? null : goal)) },
        ],
    };
}

/** Conversions / CAC per month, this year against last year. Data comes from useAuraYearData. */
export default function AuraTrendChart({ sheets, spend }) {
    const [metric, setMetric] = useState("conversions");
    const year = new Date().getFullYear();

    // Conversions only need the sheet. CAC also waits for the (slow) ad spend.
    const ready = Boolean(sheets) && (metric === "conversions" || Boolean(spend));
    const trends = sheets
        ? {
              current: buildTrend(sheets.current, spend?.current),
              previous: buildTrend(sheets.previous, spend?.previous),
          }
        : null;
    const chart = ready && trends ? buildChart(trends, metric, year) : null;
    const cacUnavailable =
        metric === "cac" &&
        trends &&
        trends.current.every((m) => m.cac == null) &&
        trends.current.some((m) => m.conversions != null);

    return (
        <section className="aura-chart" aria-label="Conversions and CAC per month">
            <div className="aura-chart__toggle apex-perf-segment" role="group" aria-label="Metric">
                {Object.entries(METRICS).map(([key, m]) => (
                    <button
                        key={key}
                        type="button"
                        className={`apex-perf-segment__btn${metric === key ? " is-active" : ""}`}
                        aria-pressed={metric === key}
                        onClick={() => setMetric(key)}
                    >
                        {m.label}
                    </button>
                ))}
            </div>

            {!chart ? (
                <div className="apex-perf-loading">
                    <CobaltLoader
                        variant="block"
                        title={metric === "cac" ? "Loading ad spend for CAC" : "Loading monthly trend"}
                        request="GET /api/custom-dashboards/aura"
                    />
                </div>
            ) : (
                <>
                    <GraphCard
                        variant="cobalt"
                        title={METRICS[metric].label}
                        chartOptions={chart.options}
                        chartSeries={chart.series}
                        height={340}
                        hideChartToggle
                    />
                    {cacUnavailable ? (
                        <p className="apex-ppc-chart-note">CAC is not available right now because ad spend could not be loaded.</p>
                    ) : metric === "cac" ? (
                        <p className="apex-ppc-chart-note">CAC = (Google Ads + Meta + Other cost) / conversions per month.</p>
                    ) : null}
                </>
            )}
        </section>
    );
}
