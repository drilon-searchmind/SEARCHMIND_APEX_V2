"use client";

import React, { useEffect, useState, useMemo } from "react";
import CobaltLoader from "@/components/ui/CobaltLoader";
import GraphCard from "@/components/dashboard/GraphCard";
import { formatComparisonPeriodDates, COMPARISON_METHOD } from "@/lib/dateRangeComparison";
import SeoInsightsTable from "./SeoInsightsTable";

const VOLUME_COLUMNS = [
    { key: "keyword", label: "Keyword", align: "left" },
    { key: "position", label: "Pos.", align: "right", format: "number", numDigits: 2 },
    { key: "volume", label: "Volume", align: "right", format: "number" },
    { key: "clicks_now", label: "Clicks now", align: "right", format: "number" },
    { key: "potential_clicks", label: "Potential", align: "right", format: "number" },
    { key: "uplift", label: "Uplift", align: "right", format: "uplift" },
    { key: "value_now", label: "Value now", align: "right", format: "money" },
    {
        key: "value_potential",
        label: "Value (potential)",
        align: "right",
        type: "valuePotential",
    },
    { key: "spend_saved", label: "Spend saved", align: "right", format: "money" },
];

const LANDING_COLUMNS = [
    { key: "url", label: "URL", align: "left" },
    { key: "clicks", label: "Clicks (vs YoY)", align: "right", format: "number", yoyKey: "clicks_yoy_pct" },
    {
        key: "impressions",
        label: "Impr. (vs YoY)",
        align: "right",
        format: "number",
        yoyKey: "impressions_yoy_pct",
    },
    { key: "ctr", label: "CTR (vs YoY)", align: "right", format: "percent", yoyKey: "ctr_yoy_pct", pctDigits: 2 },
    {
        key: "position",
        label: "Pos. (vs YoY)",
        align: "right",
        type: "positionWithYoY",
        yoyKey: "position_yoy",
    },
    { key: "value", label: "Value", align: "right", format: "money" },
    { key: "spend_saved", label: "Spend saved", align: "right", format: "money" },
];

const KEYWORD_COLUMNS = [
    { key: "keyword", label: "Keyword", align: "left" },
    { key: "volume", label: "Volume (vs YoY)", align: "right", format: "number", yoyKey: "volume_yoy_pct" },
    {
        key: "position",
        label: "Pos. (vs YoY)",
        align: "right",
        type: "positionWithYoY",
        yoyKey: "position_yoy",
    },
    { key: "clicks", label: "Clicks (vs YoY)", align: "right", format: "number", yoyKey: "clicks_yoy_pct" },
    {
        key: "ctr",
        label: "CTR (vs YoY)",
        align: "right",
        format: "percent",
        yoyKey: "ctr_yoy_pp",
        pctDigits: 1,
    },
    { key: "spend_saved", label: "Spend saved", align: "right", format: "money" },
];

const CANNIBAL_COLUMNS = [
    { key: "keyword", label: "Keyword", align: "left" },
    { key: "url_count", label: "URLs", align: "right", format: "number" },
    { key: "strongest_url", label: "Strongest URL", align: "left" },
    {
        key: "position_spread_label",
        label: "Position spread (pos 1 → 20)",
        align: "right",
        type: "positionSpread",
    },
    { key: "clicks", label: "Clicks", align: "right", format: "number" },
];

function formatChartDate(dateStr) {
    if (!dateStr) return "";
    const [, m, d] = dateStr.split("-");
    return `${Number(m)}/${Number(d)}`;
}

export default function SeoInsightsTab({
    siteUrl,
    customerId,
    startDate,
    endDate,
    appliedCompareRange,
    comparisonMethod,
}) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!siteUrl || !startDate || !endDate) {
            setData(null);
            setLoading(false);
            return;
        }

        const compDates = formatComparisonPeriodDates({
            comparisonMethod,
            startDate,
            endDate,
            compareStartDate: appliedCompareRange?.startDate,
            compareEndDate: appliedCompareRange?.endDate,
        });

        let cancelled = false;
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch("/api/seo-dashboard/insights", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        siteUrl,
                        startDate,
                        endDate,
                        customerId,
                        compareStartDate:
                            !compDates.skip && comparisonMethod !== COMPARISON_METHOD.NONE
                                ? compDates.startDate
                                : undefined,
                        compareEndDate:
                            !compDates.skip && comparisonMethod !== COMPARISON_METHOD.NONE
                                ? compDates.endDate
                                : undefined,
                    }),
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json.error || "Failed to load organic insights");
                if (!cancelled) setData(json);
            } catch (e) {
                if (!cancelled) {
                    setError(e.message);
                    setData(null);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [
        siteUrl,
        startDate,
        endDate,
        customerId,
        appliedCompareRange?.startDate,
        appliedCompareRange?.endDate,
        comparisonMethod,
    ]);

    const brandChart = useMemo(() => {
        const daily = data?.brandClicksDaily || [];
        const categories = daily.map((d) => formatChartDate(d.date));
        return {
            options: {
                chart: {
                    stacked: true,
                    stackType: "normal",
                    toolbar: { show: false },
                    fontFamily: "Outfit, sans-serif",
                },
                plotOptions: { bar: { borderRadius: 2, columnWidth: "70%" } },
                xaxis: { categories },
                yaxis: {
                    labels: {
                        formatter: (v) =>
                            Number(v).toLocaleString("en-US", { maximumFractionDigits: 0 }),
                    },
                },
                colors: ["#406969", "#C6ED62"],
                legend: { position: "bottom" },
                dataLabels: { enabled: false },
            },
            series: [
                { name: "Non-branded", data: daily.map((d) => d.nonBranded) },
                { name: "Branded", data: daily.map((d) => d.branded) },
            ],
        };
    }, [data?.brandClicksDaily]);

    if (!siteUrl) {
        return (
            <div className="apex-seo-alert">
                Add a Google Search Console property in Property Settings to load organic insights.
            </div>
        );
    }

    if (loading) {
        return (
            <div className="apex-perf-loading">
                <CobaltLoader variant="block" title="Loading organic insights" request="POST /api/seo-dashboard/insights" />
            </div>
        );
    }

    if (error) {
        return <div className="apex-seo-error">{error}</div>;
    }

    if (!data) return null;

    return (
        <div className="space-y-0">
            <SeoInsightsTable
                title="Volume potential"
                subtitle="Keywords in position 4–10 — reach top 3 for fast growth"
                columns={VOLUME_COLUMNS}
                rows={data.volumePotential || []}
                pageSize={10}
            />

            <div className="apex-seo-chart-block mb-6">
                <GraphCard
                    variant="cobalt"
                    title="Branded vs non-branded clicks"
                    chartOptions={brandChart.options}
                    chartSeries={brandChart.series}
                    chartType="bar"
                    hideChartToggle
                />
            </div>

            <SeoInsightsTable
                title="Top landing pages"
                columns={LANDING_COLUMNS}
                rows={data.topLandingPages || []}
                pageSize={10}
            />

            <SeoInsightsTable
                title="Keyword overview"
                columns={KEYWORD_COLUMNS}
                rows={data.keywordOverview || []}
                pageSize={10}
            />

            <SeoInsightsTable
                title="Keyword cannibalization"
                subtitle="Keywords where multiple URLs from your site compete with each other"
                columns={CANNIBAL_COLUMNS}
                rows={data.cannibalization || []}
                pageSize={10}
                expandable
                expandField="urls"
            />
        </div>
    );
}
