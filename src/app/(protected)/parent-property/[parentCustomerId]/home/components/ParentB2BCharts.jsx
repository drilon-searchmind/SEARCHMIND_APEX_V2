"use client";

import React, { useMemo } from "react";
import GraphCard from "@/components/dashboard/GraphCard";
import CobaltLoader from "@/components/ui/CobaltLoader";
import { getCobaltChartBaseOptions, applyCobaltSeriesStyle } from "@/lib/charts/cobaltChartTheme";

function buildChart(rows, id, seriesDefs) {
    const options = getCobaltChartBaseOptions();
    options.chart = { ...options.chart, id, toolbar: { show: false } };
    options.xaxis = {
        ...options.xaxis,
        categories: rows.map((r) => r.date),
        labels: { ...options.xaxis?.labels, rotate: -45 },
    };
    const series = applyCobaltSeriesStyle(
        seriesDefs.map((d) => ({ name: d.name, data: rows.map((r) => Math.round(d.get(r) || 0)) })),
        options
    );
    return { options, series };
}

export default function ParentB2BCharts({ rows, loading }) {
    const traffic = useMemo(
        () =>
            rows?.length
                ? buildChart(rows, "parent-b2b-traffic", [
                      { name: "Sessions", get: (r) => r.sessions },
                      { name: "Ad Spend", get: (r) => r.totalMarketingSpend },
                  ])
                : null,
        [rows]
    );
    const leads = useMemo(
        () =>
            rows?.length
                ? buildChart(rows, "parent-b2b-leads", [
                      { name: "Conversions", get: (r) => r.conversions },
                      { name: "Cost / Conversion", get: (r) => r.costPerConversion },
                  ])
                : null,
        [rows]
    );

    return (
        <section className="apex-parent-charts-section" aria-labelledby="parent-b2b-charts-title">
            <div className="apex-parent-charts-section__intro">
                <h3 id="parent-b2b-charts-title" className="apex-parent-panel__title">
                    Group trends
                </h3>
                <p className="apex-parent-panel__subtitle">
                    Daily traffic, conversions and spend across enabled child properties.
                </p>
            </div>

            {loading ? (
                <div className="apex-parent-loader-panel min-h-[8rem]">
                    <CobaltLoader variant="block" title="Loading trends" request="GET /api/parent-customers" />
                </div>
            ) : !traffic ? (
                <p className="apex-parent-panel__subtitle">No GA4 data for the selected range.</p>
            ) : (
                <div className="apex-parent-charts-layout__pair">
                    <GraphCard
                        variant="cobalt"
                        hideChartToggle
                        title="Sessions & Ad Spend"
                        chartOptions={traffic.options}
                        chartSeries={traffic.series}
                        height={280}
                    />
                    <GraphCard
                        variant="cobalt"
                        hideChartToggle
                        title="Conversions & Cost per Conversion"
                        chartOptions={leads.options}
                        chartSeries={leads.series}
                        height={280}
                    />
                </div>
            )}
        </section>
    );
}
