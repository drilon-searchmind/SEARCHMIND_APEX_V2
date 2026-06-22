"use client";

import React from "react";
import { ParentHomeGraphCard, ParentHomeChartShell } from "./ParentHomeChartShell";

export default function ParentRevenueOrdersChart({ dailyData, loading, shopifyRevenueField = "net_sales" }) {
    const title =
        shopifyRevenueField === "gross_sales"
            ? "Gross sales & orders"
            : "Revenue & orders";
    const subtitle = "Dual-axis daily trend · DKK and order count";
    const revenueLabel =
        shopifyRevenueField === "gross_sales" ? "Gross sales (DKK)" : "Revenue (DKK)";

    if (loading || !dailyData?.length) {
        return (
            <ParentHomeChartShell
                title={title}
                subtitle={subtitle}
                loading={loading}
                empty={!loading && !dailyData?.length}
            />
        );
    }

    const categories = dailyData.map((d) => d.period);
    const chartSeries = [
        { name: revenueLabel, data: dailyData.map((d) => Number((d.revenue || 0).toFixed(0))) },
        { name: "Orders", data: dailyData.map((d) => d.orders || 0) },
    ];

    const chartOptions = {
        chart: { id: "parent-home-revenue-orders" },
        stroke: { width: [2.5, 2], curve: "smooth" },
        xaxis: {
            categories,
            labels: { rotate: -35, hideOverlappingLabels: true },
        },
        yaxis: [
            {
                seriesName: revenueLabel,
                title: { text: "DKK" },
                labels: {
                    formatter: (val) =>
                        val != null ? Number(val).toLocaleString("da-DK") : val,
                },
            },
            {
                seriesName: "Orders",
                opposite: true,
                title: { text: "Orders" },
                labels: {
                    formatter: (val) =>
                        val != null ? Number(val).toLocaleString("da-DK") : val,
                },
            },
        ],
        legend: { show: true, position: "top", horizontalAlign: "left" },
        tooltip: {
            shared: true,
            intersect: false,
            y: {
                formatter: (val, { seriesIndex }) =>
                    seriesIndex === 0
                        ? `${Number(val).toLocaleString("da-DK")} kr`
                        : Number(val).toLocaleString("da-DK"),
            },
        },
    };

    return (
        <ParentHomeGraphCard
            title={title}
            subtitle={subtitle}
            chartOptions={chartOptions}
            chartSeries={chartSeries}
            chartType="line"
            height={340}
        />
    );
}
