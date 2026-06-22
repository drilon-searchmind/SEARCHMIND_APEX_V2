"use client";

import React, { useMemo } from "react";
import dynamic from "next/dynamic";
import { getCobaltChartBaseOptions, getCobaltChartTokens } from "@/lib/charts/cobaltChartTheme";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

export default function AcquisitionChannelsChart({
    title = "Acquisition channels",
    subtitle = "Sessions by channel group, stacked by month",
    categories = [],
    series = [],
}) {
    const { options, chartSeries } = useMemo(() => {
        const t = getCobaltChartTokens();
        const base = getCobaltChartBaseOptions();
        const palette = [t.ink, t.accentLight, t.neutral, t.rule2, t.muted];

        return {
            chartSeries: series,
            options: {
                ...base,
                chart: {
                    ...base.chart,
                    stacked: true,
                    toolbar: { show: false },
                },
                xaxis: {
                    ...base.xaxis,
                    categories,
                    labels: { ...base.xaxis?.labels, rotate: -45 },
                },
                yaxis: {
                    ...base.yaxis,
                    labels: {
                        ...base.yaxis?.labels,
                        formatter: (v) => Math.round(v).toLocaleString("da-DK"),
                    },
                },
                plotOptions: {
                    ...base.plotOptions,
                    bar: { ...base.plotOptions?.bar, columnWidth: "45%" },
                },
                legend: {
                    ...base.legend,
                    position: "top",
                    horizontalAlign: "left",
                },
                colors: palette,
            },
        };
    }, [categories, series]);

    return (
        <div className="apex-analytics-panel apex-analytics-chart-panel">
            <h3 className="apex-analytics-panel__title">{title}</h3>
            <p className="apex-analytics-panel__subtitle">{subtitle}</p>
            <ReactApexChart type="bar" height={320} series={chartSeries} options={options} />
        </div>
    );
}
