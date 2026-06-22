"use client";

import React, { useMemo } from "react";
import { parentDailySpendKey } from "@/lib/parentPropertyAdSpend";
import { ParentHomeGraphCard, ParentHomeChartShell } from "./ParentHomeChartShell";

const CHANNEL_COLORS = ["#213b34", "#3d6b5e", "#5c756a", "#7a9489", "#a8bdb6"];

export default function ParentAdspendChart({ dailyData, loading, visibleAdSpendChannels = [] }) {
    const channels = useMemo(() => {
        if (visibleAdSpendChannels.length > 0) return visibleAdSpendChannels;
        return [
            { id: "facebook", label: "Meta" },
            { id: "google", label: "Google Ads" },
        ];
    }, [visibleAdSpendChannels]);

    const title = "Ad spend by channel";
    const subtitle =
        channels.length <= 2
            ? "Meta and Google daily spend"
            : `Daily spend · ${channels.map((c) => c.label).join(", ")}`;

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
    const chartSeries = channels.map((ch, i) => ({
        name: ch.label,
        data: dailyData.map((d) => Math.round(Number(d[parentDailySpendKey(ch.id)] || 0))),
        color: CHANNEL_COLORS[i % CHANNEL_COLORS.length],
    }));

    const chartOptions = {
        chart: { id: "parent-home-adspend", stacked: true },
        stroke: { width: 0 },
        plotOptions: {
            bar: {
                borderRadius: 4,
                columnWidth: "68%",
            },
        },
        xaxis: {
            categories,
            labels: { rotate: -35, hideOverlappingLabels: true },
        },
        yaxis: {
            title: { text: "DKK" },
            labels: {
                formatter: (val) =>
                    val != null ? Number(val).toLocaleString("da-DK") : val,
            },
        },
        legend: { show: true, position: "top", horizontalAlign: "left" },
        tooltip: {
            shared: true,
            intersect: false,
            y: {
                formatter: (val) => `${Number(val).toLocaleString("da-DK")} kr`,
            },
        },
        fill: { opacity: 1 },
    };

    return (
        <ParentHomeGraphCard
            title={title}
            subtitle={subtitle}
            chartOptions={chartOptions}
            chartSeries={chartSeries}
            chartType="bar"
            height={300}
        />
    );
}
