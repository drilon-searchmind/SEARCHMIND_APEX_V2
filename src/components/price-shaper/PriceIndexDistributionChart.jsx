"use client";

import React, { useMemo } from "react";
import dynamic from "next/dynamic";
import { getCobaltChartBaseOptions } from "@/lib/charts/cobaltChartTheme";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

const SEGMENT_COLORS = ["#6a8f4d", "#c6ed62", "#ee6251"];

export default function PriceIndexDistributionChart({ cheaperPct, similarPct, expensivePct }) {
    const series = useMemo(
        () => [cheaperPct ?? 0, similarPct ?? 0, expensivePct ?? 0],
        [cheaperPct, similarPct, expensivePct]
    );
    const labels = useMemo(() => ["Cheaper", "Similar", "More expensive"], []);

    const options = useMemo(() => {
        const base = getCobaltChartBaseOptions();
        return {
            ...base,
            chart: {
                ...base.chart,
                type: "donut",
                toolbar: { show: false },
            },
            labels,
            colors: SEGMENT_COLORS,
            legend: {
                ...base.legend,
                position: "bottom",
                horizontalAlign: "center",
            },
            dataLabels: {
                enabled: true,
                formatter: (val) => `${Number(val).toFixed(1)}%`,
                style: {
                    fontSize: "11px",
                    fontFamily: "AcidGrotesk, ui-sans-serif, system-ui, sans-serif",
                    fontWeight: 600,
                },
            },
            stroke: { width: 0 },
            plotOptions: {
                pie: {
                    donut: { size: "62%", labels: { show: false } },
                },
            },
            tooltip: {
                ...base.tooltip,
                y: {
                    formatter: (value) => `${Number(value).toFixed(1)}%`,
                },
            },
        };
    }, [labels]);

    const total = series.reduce((sum, value) => sum + value, 0);
    if (total <= 0) {
        return <p className="apex-ps-empty-cell">No benchmark distribution data available.</p>;
    }

    return (
        <div className="apex-ps-pie-wrap">
            <ReactApexChart type="donut" height={260} series={series} options={options} />
        </div>
    );
}
