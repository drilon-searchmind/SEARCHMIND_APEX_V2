"use client";

import React from "react";
import GraphCard from "@/components/dashboard/GraphCard";
import CobaltLoader from "@/components/ui/CobaltLoader";
import { MONTH_NAMES, monthlyAllocation } from "./auraSheetLogic";

const nf0 = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 });

/** Stack order bottom to top, like the sheet: PPC, PS, Other. Distinct non-brand colours. */
const SERIES = [
    { key: "ppc", label: "PPC", color: "#131313", text: "#131313" },
    { key: "ps", label: "PS", color: "#16a34a", text: "#14532d" },
    { key: "other", label: "Other", color: "#e0867a", text: "#9a3b2e" },
];

function buildChart(months) {
    const share = (m, key) => (m.total > 0 ? m[key] / m.total : null);
    return {
        options: {
            chart: { toolbar: { show: false }, zoom: { enabled: false }, stacked: true, fontFamily: "Outfit, sans-serif" },
            colors: SERIES.map((s) => s.color),
            stroke: { width: 2, curve: "smooth" },
            fill: { type: "solid", opacity: 0.28 },
            xaxis: { categories: MONTH_NAMES, labels: { rotate: -45 } },
            yaxis: { min: 0, labels: { formatter: (v) => nf0.format(v) } },
            dataLabels: {
                enabled: true,
                // Labels are each channel's share of the month's spend (the sheet's "Label" columns).
                formatter: (_v, { seriesIndex, dataPointIndex }) => {
                    const s = share(months[dataPointIndex], SERIES[seriesIndex].key);
                    return s == null ? "" : `${Math.round(s * 100)}%`;
                },
                background: { enabled: false },
                style: { fontSize: "11px", fontWeight: 700, colors: SERIES.map((s) => s.text) },
                offsetY: -4,
            },
            legend: { show: true, position: "top" },
            grid: { borderColor: "#e5e7eb", xaxis: { lines: { show: false } } },
            tooltip: {
                theme: "light",
                shared: true,
                y: {
                    formatter: (v, { seriesIndex, dataPointIndex }) => {
                        const s = share(months[dataPointIndex], SERIES[seriesIndex].key);
                        return v == null ? "No data" : `${nf0.format(v)} kr.${s == null ? "" : ` (${Math.round(s * 100)}%)`}`;
                    },
                },
            },
        },
        series: SERIES.map((s) => ({ name: s.label, data: months.map((m) => (m.total > 0 ? Math.round(m[s.key]) : null)) })),
    };
}

/** Spend allocation per month this year: PPC (Google Ads), PS (Meta) and Other, stacked, with each share as label. */
export default function AuraSpendAllocationChart({ sheets, spend }) {
    const ready = Boolean(sheets) && Boolean(spend);
    const spendKnown = ready && spend.current.spendOk && sheets.current.sheetOk;
    const months = ready
        ? monthlyAllocation({
              googleRows: spend.current.google,
              metaRows: spend.current.meta,
              otherCost: sheets.current.sheet.otherCost,
          })
        : null;
    const chart = months && spendKnown ? buildChart(months) : null;

    return (
        <section className="aura-chart aura-chart--allocation" aria-label="Spend allocation per month">
            {!ready ? (
                <div className="apex-perf-loading">
                    <CobaltLoader variant="block" title="Loading spend allocation" request="GET /api/google-ppc-dashboard" />
                </div>
            ) : !chart ? (
                <p className="apex-ppc-chart-note">Spend allocation is not available right now because ad spend could not be loaded.</p>
            ) : (
                <>
                    <GraphCard
                        variant="cobalt"
                        title="Spend allocation"
                        chartOptions={chart.options}
                        chartSeries={chart.series}
                        chartType="area"
                        height={340}
                        hideChartToggle
                    />
                    <p className="apex-ppc-chart-note">
                        Monthly spend this year: PPC = Google Ads, PS = Meta, Other = campaign budgets saved under Data inputs. Labels show each
                        share of the month&apos;s total.
                    </p>
                </>
            )}
        </section>
    );
}
