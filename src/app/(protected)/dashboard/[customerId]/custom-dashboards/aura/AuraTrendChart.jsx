"use client";

import React, { useEffect, useState } from "react";
import GraphCard from "@/components/dashboard/GraphCard";
import CobaltLoader from "@/components/ui/CobaltLoader";
import { buildAuraSources, fetchJson, isoDate } from "./auraApi";
import { AURA_MONTHLY_CAC_GOAL, AURA_MONTHLY_CUSTOMER_GOAL, monthlyTrend } from "./auraSheetLogic";

const MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

const METRICS = {
    conversions: { label: "Conversions", goal: AURA_MONTHLY_CUSTOMER_GOAL },
    cac: { label: "CAC", goal: AURA_MONTHLY_CAC_GOAL },
};

const nf0 = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 });
const fmtValue = (v) => (v == null ? "" : nf0.format(v));

/** Distinct, non-brand series colours: this year (ink), last year (blue), goal (grey, dashed). */
const COLORS = ["#131313", "#2563eb", "#a8a29e"];

/** Date range for a calendar year. The current year ends yesterday, like the sheet. Null when empty. */
function yearRange(year, today) {
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    const end = year === today.getFullYear() ? yesterday : new Date(year, 11, 31);
    const start = new Date(year, 0, 1);
    return end < start ? null : { startDate: isoDate(start), endDate: isoDate(end) };
}

async function settle(fn, label, year, errors) {
    try {
        return await fn();
    } catch (e) {
        errors.push(`${label} ${year}: ${e.message}`);
        return null;
    }
}

/** Fast: daily conversions and other cost from the Aura sheet. */
async function loadSheet(sources, year, today) {
    const range = yearRange(year, today);
    const errors = [];
    const sheet = range ? await settle(() => fetchJson(sources.sheet(range)), "Aura sheet", year, errors) : null;
    return { sheet: sheet || { conversions: [], otherCost: [] }, sheetOk: !range || Boolean(sheet), errors };
}

/** Slow (a year of daily Google Ads and Meta rows). CAC is only trusted when every configured source loaded. */
async function loadSpend(sources, year, today) {
    const range = yearRange(year, today);
    const errors = [];
    if (!range) return { google: [], meta: [], spendOk: true, errors };
    const [g, m] = await Promise.all([
        sources.google ? settle(() => fetchJson(sources.google(range)), "Google Ads", year, errors) : null,
        sources.meta ? settle(() => fetchJson(sources.meta(range)), "Meta", year, errors) : null,
    ]);
    return {
        google: g?.metrics_by_date || [],
        meta: m?.metrics_by_date || [],
        spendOk: (!sources.google || Boolean(g)) && (!sources.meta || Boolean(m)),
        errors,
    };
}

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
            xaxis: { categories: MONTHS, labels: { rotate: -45 } },
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

export default function AuraTrendChart({ customerId, settings, isAdmin }) {
    const [metric, setMetric] = useState("conversions");
    const [sheets, setSheets] = useState(null);
    const [spend, setSpend] = useState(null);
    const year = new Date().getFullYear();

    useEffect(() => {
        if (!customerId || !settings) return;
        let cancelled = false;
        const sources = buildAuraSources(customerId, settings);
        const today = new Date();
        const years = [today.getFullYear(), today.getFullYear() - 1];
        Promise.all(years.map((y) => loadSheet(sources, y, today))).then(([current, previous]) => {
            if (!cancelled) setSheets({ current, previous });
        });
        Promise.all(years.map((y) => loadSpend(sources, y, today))).then(([current, previous]) => {
            if (!cancelled) setSpend({ current, previous });
        });
        return () => {
            cancelled = true;
        };
    }, [customerId, settings]);

    // Conversions only need the sheet. CAC also waits for the (slow) ad spend.
    const ready = Boolean(sheets) && (metric === "conversions" || Boolean(spend));
    const trends = sheets
        ? {
              current: buildTrend(sheets.current, spend?.current),
              previous: buildTrend(sheets.previous, spend?.previous),
          }
        : null;
    const chart = ready && trends ? buildChart(trends, metric, year) : null;
    const errors = [
        ...(sheets ? [...sheets.current.errors, ...sheets.previous.errors] : []),
        ...(spend ? [...spend.current.errors, ...spend.previous.errors] : []),
    ];
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
                    {isAdmin && errors.length > 0 ? (
                        <p className="apex-ppc-chart-note aura-admin-note">Admin only. {errors.join("; ")}</p>
                    ) : null}
                </>
            )}
        </section>
    );
}
