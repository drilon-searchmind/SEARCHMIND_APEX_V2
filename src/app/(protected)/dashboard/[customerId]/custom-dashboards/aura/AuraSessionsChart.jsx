"use client";

import React from "react";
import GraphCard from "@/components/dashboard/GraphCard";

const nf0 = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 });

function buildChart(channels) {
    return {
        options: {
            chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: "Outfit, sans-serif" },
            colors: ["#131313"],
            plotOptions: { bar: { borderRadius: 4, columnWidth: "55%", dataLabels: { position: "top" } } },
            fill: { type: "solid", opacity: 1 },
            dataLabels: {
                enabled: true,
                formatter: (v) => nf0.format(v),
                offsetY: -18,
                style: { fontSize: "11px", fontWeight: 600, colors: ["#131313"] },
            },
            xaxis: { categories: channels.map((c) => c.channel), labels: { rotate: -45, trim: true } },
            yaxis: { min: 0, labels: { formatter: (v) => nf0.format(v) } },
            grid: { borderColor: "#e5e7eb", xaxis: { lines: { show: false } } },
            legend: { show: false },
            tooltip: { theme: "light", y: { formatter: (v) => `${nf0.format(v)} sessions` } },
        },
        series: [{ name: "Sessions", data: channels.map((c) => c.sessions) }],
    };
}

/**
 * Sessions per channel group (GA4 default channel grouping) for the selected date range, most sessions first.
 * `channels` is [{ channel, sessions }], or null when GA4 could not be loaded.
 */
export default function AuraSessionsChart({ channels, ga4Configured }) {
    let body;
    if (!ga4Configured) {
        body = <p className="apex-ppc-chart-note">GA4 is not set up for this customer. Add the GA4 property ID in Config to see sessions per channel group.</p>;
    } else if (channels === null) {
        body = <p className="apex-ppc-chart-note">Sessions per channel group could not be loaded right now.</p>;
    } else if (channels.length === 0) {
        body = <p className="apex-ppc-chart-note">No GA4 sessions in the selected period.</p>;
    } else {
        const chart = buildChart(channels);
        const total = channels.reduce((s, c) => s + c.sessions, 0);
        body = (
            <>
                <GraphCard
                    variant="cobalt"
                    title="Sessions per channel group"
                    chartOptions={chart.options}
                    chartSeries={chart.series}
                    chartType="bar"
                    height={340}
                    hideChartToggle
                />
                <p className="apex-ppc-chart-note">
                    GA4 sessions by default channel group for the selected period, {nf0.format(total)} in total.
                </p>
            </>
        );
    }
    return (
        <section className="aura-chart" aria-label="Sessions per channel group">
            {body}
        </section>
    );
}
