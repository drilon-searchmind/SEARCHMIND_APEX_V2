"use client";

import React from "react";
import dynamic from "next/dynamic";
import { getChartColors } from "@/components/dashboard/chartColors";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

export default function AcquisitionChannelsChart({ title = "Acquisition Channels", categories = [], series = [] }) {
    const colors = getChartColors();
    const palette = [colors.primaryLighter || "#406969", "#7ea6a6", "#a9c7c7", "#cfe0e0", "#e5eeee"]; // subtle stack

    const options = {
        chart: { stacked: true, toolbar: { show: false }, fontFamily: "Outfit, sans-serif" },
        xaxis: { categories, labels: { rotate: -45 } },
        yaxis: { labels: { formatter: (v) => Math.round(v).toLocaleString("da-DK") } },
        plotOptions: { bar: { columnWidth: "45%", borderRadius: 6 } },
        grid: { borderColor: "#e5e7eb" },
        legend: { position: "top", horizontalAlign: "left", fontSize: "12px" },
        colors: palette,
        dataLabels: { enabled: false },
    };

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-2">{title}</h3>
            <ReactApexChart type="bar" height={320} series={series} options={options} />
        </div>
    );
}
