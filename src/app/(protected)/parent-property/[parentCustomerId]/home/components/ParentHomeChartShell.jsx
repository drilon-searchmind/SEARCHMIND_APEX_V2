"use client";

import GraphCard from "@/components/dashboard/GraphCard";
import CobaltLoader from "@/components/ui/CobaltLoader";

/** Minimal chart overrides — GraphCard variant="cobalt" applies base theme. */
export function ParentHomeChartShell({ title, subtitle, loading, empty, children }) {
    if (loading) {
        return (
            <div className="apex-parent-chart">
                <div className="apex-parent-chart__head">
                    <h3 className="apex-parent-chart__title">{title}</h3>
                    {subtitle ? <p className="apex-parent-chart__subtitle">{subtitle}</p> : null}
                </div>
                <div className="apex-parent-chart__loader">
                    <CobaltLoader variant="block" title="Loading chart" />
                </div>
            </div>
        );
    }

    if (empty) {
        return (
            <div className="apex-parent-chart">
                <div className="apex-parent-chart__head">
                    <h3 className="apex-parent-chart__title">{title}</h3>
                    {subtitle ? <p className="apex-parent-chart__subtitle">{subtitle}</p> : null}
                </div>
                <p className="apex-parent-chart__empty">No data for the selected period.</p>
            </div>
        );
    }

    return (
        <div className="apex-parent-chart">
            <div className="apex-parent-chart__head">
                <h3 className="apex-parent-chart__title">{title}</h3>
                {subtitle ? <p className="apex-parent-chart__subtitle">{subtitle}</p> : null}
            </div>
            <div className="apex-parent-chart__body">{children}</div>
        </div>
    );
}

export function ParentHomeGraphCard({ title, subtitle, chartOptions, chartSeries, chartType = "line", height = 320 }) {
    return (
        <ParentHomeChartShell title={title} subtitle={subtitle}>
            <GraphCard
                variant="cobalt"
                title=""
                hideChartToggle
                chartOptions={chartOptions}
                chartSeries={chartSeries}
                chartType={chartType}
                height={height}
            />
        </ParentHomeChartShell>
    );
}
