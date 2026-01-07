"use client";

import React from "react";
import dynamic from "next/dynamic";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

export default function ActiveUsersCard({ rows = [] }) {
    const categories = rows.map((r) => r.date);
    const data = rows.map((r) => Number(r.totalUsers) || 0);
    const total = data.reduce((a, b) => a + b, 0);
    const days = data.length || 1;
    const avgDaily = total / days;
    const avgWeekly = total / Math.max(1, days / 7);
    const avgMonthly = total / Math.max(1, days / 30);

    const series = [{ name: "Active Users", data }];
    const options = {
        chart: { toolbar: { show: false }, sparkline: { enabled: true }, fontFamily: "Outfit, sans-serif" },
        colors: ["#406969"],
        stroke: { width: 2, curve: "smooth" },
        tooltip: { enabled: true },
        xaxis: { categories },
    };

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <div className="text-sm text-gray-500">Active Users</div>
                    <div className="text-2xl font-semibold text-gray-900">{(data[data.length - 1] ?? 0).toLocaleString("da-DK")}</div>
                    <div className="text-[11px] text-gray-400">Live visitors</div>
                </div>
            </div>
            <div className="mt-2">
                <ReactApexChart type="line" height={120} options={options} series={series} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                <div>
                    <div className="text-xs text-gray-400">Avg, Daily</div>
                    <div className="text-sm font-medium">{avgDaily.toFixed(0)}</div>
                </div>
                <div>
                    <div className="text-xs text-gray-400">Avg, Weekly</div>
                    <div className="text-sm font-medium">{avgWeekly.toFixed(0)}</div>
                </div>
                <div>
                    <div className="text-xs text-gray-400">Avg, Monthly</div>
                    <div className="text-sm font-medium">{avgMonthly.toFixed(0)}</div>
                </div>
            </div>
        </div>
    );
}
