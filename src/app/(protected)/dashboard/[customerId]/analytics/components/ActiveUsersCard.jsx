"use client";

import React, { useMemo } from "react";
import dynamic from "next/dynamic";
import { getCobaltChartBaseOptions, getCobaltChartTokens } from "@/lib/charts/cobaltChartTheme";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

export default function ActiveUsersCard({ rows = [] }) {
    const categories = rows.map((r) => r.date);
    const data = rows.map((r) => Number(r.totalUsers) || 0);
    const total = data.reduce((a, b) => a + b, 0);
    const days = data.length || 1;
    const avgDaily = total / days;
    const avgWeekly = total / Math.max(1, days / 7);
    const avgMonthly = total / Math.max(1, days / 30);
    const latest = data[data.length - 1] ?? 0;

    const { options, series } = useMemo(() => {
        const t = getCobaltChartTokens();
        const base = getCobaltChartBaseOptions();
        return {
            series: [{ name: "Active users", data }],
            options: {
                ...base,
                chart: {
                    ...base.chart,
                    sparkline: { enabled: true },
                    toolbar: { show: false },
                },
                colors: [t.accentLight],
                stroke: { ...base.stroke, width: 2 },
                tooltip: { enabled: true },
                xaxis: { ...base.xaxis, categories },
            },
        };
    }, [categories, data]);

    return (
        <div className="apex-analytics-panel apex-analytics-active h-full">
            <div className="apex-analytics-active__head">
                <div>
                    <div className="apex-analytics-active__label">Active users</div>
                    <div className="apex-analytics-active__value">{latest.toLocaleString("da-DK")}</div>
                    <div className="apex-analytics-active__caption">Latest day in range</div>
                </div>
            </div>
            <div className="apex-analytics-active__chart">
                <ReactApexChart type="line" height={120} options={options} series={series} />
            </div>
            <div className="apex-analytics-active__stats">
                <div>
                    <div className="apex-analytics-active__stat-label">Avg daily</div>
                    <div className="apex-analytics-active__stat-value">{avgDaily.toFixed(0)}</div>
                </div>
                <div>
                    <div className="apex-analytics-active__stat-label">Avg weekly</div>
                    <div className="apex-analytics-active__stat-value">{avgWeekly.toFixed(0)}</div>
                </div>
                <div>
                    <div className="apex-analytics-active__stat-label">Avg monthly</div>
                    <div className="apex-analytics-active__stat-value">{avgMonthly.toFixed(0)}</div>
                </div>
            </div>
        </div>
    );
}
