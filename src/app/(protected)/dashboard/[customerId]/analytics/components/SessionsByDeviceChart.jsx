"use client";

import React, { useMemo } from "react";
import dynamic from "next/dynamic";
import { getCobaltChartBaseOptions } from "@/lib/charts/cobaltChartTheme";
import { getChartSeriesPalette } from "@/lib/charts/chartSeriesColors";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

export default function SessionsByDeviceChart({
    title = "Sessions by device",
    subtitle = "Share of sessions in the selected period",
    data = [],
}) {
    const labels = data.map((d) => d.label);
    const series = data.map((d) => d.value);

    const options = useMemo(() => {
        const base = getCobaltChartBaseOptions();
        const palette = getChartSeriesPalette(Math.max(3, labels.length));

        return {
            ...base,
            chart: {
                ...base.chart,
                type: "donut",
                toolbar: { show: false },
            },
            labels,
            colors: palette,
            legend: {
                ...base.legend,
                position: "bottom",
                horizontalAlign: "center",
            },
            dataLabels: {
                enabled: true,
                formatter: (val) => `${val.toFixed(0)}%`,
                style: {
                    fontSize: "10px",
                    fontFamily: "AcidGrotesk, ui-sans-serif, system-ui, sans-serif",
                    fontWeight: 600,
                },
            },
            stroke: { width: 0 },
            plotOptions: {
                pie: {
                    donut: { size: "68%", labels: { show: false } },
                },
            },
            tooltip: {
                ...base.tooltip,
                y: {
                    formatter: (value) => Number(value).toLocaleString("da-DK"),
                },
            },
        };
    }, [labels]);

    return (
        <div className="apex-analytics-panel apex-analytics-chart-panel">
            <h3 className="apex-analytics-panel__title">{title}</h3>
            <p className="apex-analytics-panel__subtitle">{subtitle}</p>
            <ReactApexChart type="donut" height={320} series={series} options={options} />
            {labels.length > 0 ? (
                <p className="apex-analytics-panel__subtitle mb-0 text-center">
                    {labels.join(" · ")}
                </p>
            ) : null}
        </div>
    );
}
