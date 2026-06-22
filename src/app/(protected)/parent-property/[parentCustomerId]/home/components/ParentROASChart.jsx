"use client";

import React from "react";
import { parentTotalSpendFromDailyRow } from "@/lib/parentPropertyAdSpend";
import { ParentHomeGraphCard, ParentHomeChartShell } from "./ParentHomeChartShell";

export default function ParentROASChart({ dailyData, loading, metricPreference = "ROAS/POAS" }) {
    const isSpendshare = metricPreference === "Spendshare";
    const title = isSpendshare ? "Spendshare" : "Blended ROAS";
    const subtitle = isSpendshare
        ? "Ad spend as share of revenue (%)"
        : "Revenue divided by total ad spend";

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
    const metricData = dailyData.map((d) => {
        const totalSpend = parentTotalSpendFromDailyRow(d);
        const revenue = d.revenue || 0;
        if (isSpendshare) {
            return revenue > 0 ? Number(((totalSpend / revenue) * 100).toFixed(2)) : 0;
        }
        return totalSpend > 0 ? Number((revenue / totalSpend).toFixed(2)) : 0;
    });

    const chartSeries = [{ name: title, data: metricData }];
    const chartOptions = {
        chart: { id: "parent-home-roas" },
        stroke: { width: 2.5, curve: "smooth" },
        markers: {
            size: 0,
            hover: { size: 5 },
        },
        xaxis: {
            categories,
            labels: { rotate: -35, hideOverlappingLabels: true },
        },
        yaxis: {
            title: { text: isSpendshare ? "%" : "ROAS" },
            labels: {
                formatter: (val) =>
                    isSpendshare
                        ? `${Number(val).toFixed(1)}%`
                        : Number(val).toFixed(2),
            },
        },
        tooltip: {
            y: {
                formatter: (val) =>
                    isSpendshare
                        ? `${Number(val).toFixed(2)}%`
                        : Number(val).toFixed(2),
            },
        },
        annotations: !isSpendshare
            ? {
                  yaxis: [
                      {
                          y: 1,
                          borderColor: "var(--color-rule-2)",
                          strokeDashArray: 4,
                          label: {
                              text: "Break-even",
                              style: {
                                  fontSize: "10px",
                                  fontFamily: "JetBrains Mono, monospace",
                                  color: "var(--color-muted)",
                                  background: "var(--perf-canvas)",
                              },
                          },
                      },
                  ],
              }
            : undefined,
    };

    return (
        <ParentHomeGraphCard
            title={title}
            subtitle={subtitle}
            chartOptions={chartOptions}
            chartSeries={chartSeries}
            chartType="line"
            height={300}
        />
    );
}
