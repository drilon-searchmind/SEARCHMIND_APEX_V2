"use client";

import React from "react";
import ParentRevenueOrdersChart from "./ParentRevenueOrdersChart";
import ParentAdspendChart from "./ParentAdspendChart";
import ParentROASChart from "./ParentROASChart";

export default function ParentHomeCharts({
    dailyData,
    loading,
    shopifyRevenueField,
    visibleAdSpendChannels,
    metricPreference,
}) {
    return (
        <section className="apex-parent-charts-section" aria-labelledby="parent-home-charts-title">
            <div className="apex-parent-charts-section__intro">
                <h3 id="parent-home-charts-title" className="apex-parent-panel__title">
                    Group trends
                </h3>
                <p className="apex-parent-panel__subtitle">
                    Daily performance across enabled child properties for the selected range.
                </p>
            </div>

            <div className="apex-parent-charts-layout">
                <div className="apex-parent-charts-layout__featured">
                    <ParentRevenueOrdersChart
                        dailyData={dailyData}
                        loading={loading}
                        shopifyRevenueField={shopifyRevenueField}
                    />
                </div>

                <div className="apex-parent-charts-layout__pair">
                    <ParentAdspendChart
                        dailyData={dailyData}
                        loading={loading}
                        visibleAdSpendChannels={visibleAdSpendChannels}
                    />
                    <ParentROASChart
                        dailyData={dailyData}
                        loading={loading}
                        metricPreference={metricPreference}
                    />
                </div>
            </div>
        </section>
    );
}
