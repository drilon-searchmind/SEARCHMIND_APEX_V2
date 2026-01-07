"use client";

import React from "react";
import dynamic from "next/dynamic";
import { getChartColors } from "@/components/dashboard/chartColors";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

export default function SessionsByDeviceChart({ title = "Sessions By Device", data = [] }) {
  const colors = getChartColors();
  const palette = [colors.primaryLighter || "#406969", "#7ea6a6", "#cfe0e0"]; // Desktop, Mobile, Tablet

  const labels = data.map((d) => d.label);
  const series = data.map((d) => d.value);

  const options = {
    chart: { type: "donut", toolbar: { show: false }, fontFamily: "Outfit, sans-serif" },
    labels,
    colors: palette,
    legend: { position: "bottom", horizontalAlign: "center", fontSize: "12px" },
    dataLabels: { enabled: true, formatter: (val) => `${val.toFixed(0)}%` },
    stroke: { width: 0 },
    plotOptions: {
      pie: {
        donut: { size: "70%", labels: { show: false } },
      },
    },
    tooltip: {
      y: {
        formatter: (value) => Number(value).toLocaleString("da-DK"),
      },
    },
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <ReactApexChart type="donut" height={320} series={series} options={options} />
      {labels.length > 0 && (
        <div className="mt-2 text-center text-xs text-gray-500">
          {labels.join(" • ")}
        </div>
      )}
    </div>
  );
}
