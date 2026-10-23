"use client";

import React, { useEffect, useMemo } from "react";
import dayjs from "dayjs";
import CobaltLoader from "@/components/ui/CobaltLoader";
import GraphCard from "@/components/dashboard/GraphCard";
import SeoAppliedFilterBadges from "@/components/seo/SeoAppliedFilterBadges";
import { COMMERCE_CHART_CHROME } from "@/components/dashboard/chartColors";
import SeoInsightsTable from "./SeoInsightsTable";
import { useSeoInsightsData } from "./useSeoInsightsData";
import { SEO_COLORS, compact, fmtInt, fmtShare } from "./SeoParts";

const LANDING_COLUMNS = [
    { key: "url", label: "URL", align: "left" },
    { key: "clicks", label: "Clicks", align: "right", format: "number", yoyKey: "clicks_yoy_pct" },
    { key: "impressions", label: "Impressions", align: "right", format: "number", yoyKey: "impressions_yoy_pct" },
    { key: "ctr", label: "CTR", align: "right", format: "percent", yoyKey: "ctr_yoy_pct", pctDigits: 2 },
    { key: "position", label: "Position", align: "right", type: "positionWithYoY", yoyKey: "position_yoy" },
    { key: "value", label: "Value", align: "right", format: "money" },
    { key: "spend_saved", label: "Spend saved", align: "right", format: "money" },
];

const KEYWORD_COLUMNS = [
    { key: "keyword", label: "Keyword", align: "left" },
    { key: "volume", label: "Volume", align: "right", format: "number", yoyKey: "volume_yoy_pct" },
    { key: "position", label: "Position", align: "right", type: "positionWithYoY", yoyKey: "position_yoy" },
    { key: "clicks", label: "Clicks", align: "right", format: "number", yoyKey: "clicks_yoy_pct" },
    { key: "ctr", label: "CTR", align: "right", format: "percent", yoyKey: "ctr_yoy_pp", pctDigits: 1 },
    { key: "spend_saved", label: "Spend saved", align: "right", format: "money" },
];

export default function SeoInsightsTab({
    siteUrl,
    customerId,
    startDate,
    endDate,
    appliedCompareRange,
    comparisonMethod,
    keywordSettingsVersion = 0,
    onLedeChange,
}) {
    const { data, loading, error } = useSeoInsightsData({
        siteUrl,
        customerId,
        startDate,
        endDate,
        appliedCompareRange,
        comparisonMethod,
        keywordSettingsVersion,
    });

    const brand = useMemo(() => {
        const daily = data?.brandClicksDaily || [];
        const categories = daily.map((d) => d.date);
        const branded = daily.reduce((s, d) => s + (d.branded || 0), 0);
        const nonBranded = daily.reduce((s, d) => s + (d.nonBranded || 0), 0);
        const colors = [SEO_COLORS.nonBrand, SEO_COLORS.brand];
        return {
            share: branded + nonBranded > 0 ? branded / (branded + nonBranded) : null,
            options: {
                chart: { stacked: true, toolbar: { show: false }, zoom: { enabled: false }, fontFamily: COMMERCE_CHART_CHROME.fontFamily },
                colors,
                plotOptions: { bar: { columnWidth: "62%", borderRadius: 2, borderRadiusApplication: "end", borderRadiusWhenStacked: "last" } },
                stroke: { width: 0 },
                fill: { opacity: 1 },
                states: { hover: { filter: { type: "none" } } },
                xaxis: {
                    categories,
                    tickAmount: 8,
                    labels: {
                        rotate: 0,
                        hideOverlappingLabels: true,
                        style: { colors: COMMERCE_CHART_CHROME.axisLabel },
                        formatter: (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? dayjs(v).format("D MMM") : v),
                    },
                    axisTicks: { show: false },
                    tooltip: { enabled: false },
                },
                yaxis: { min: 0, tickAmount: 4, forceNiceScale: true, labels: { formatter: (v) => compact(v) } },
                grid: { borderColor: COMMERCE_CHART_CHROME.grid, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
                dataLabels: { enabled: false },
                legend: { show: true, position: "top", horizontalAlign: "left" },
                tooltip: {
                    theme: "dark",
                    shared: true,
                    intersect: false,
                    x: { formatter: (v, o) => (categories[o?.dataPointIndex] ? dayjs(categories[o.dataPointIndex]).format("ddd, D MMM") : v) },
                    y: { formatter: (v) => `${fmtInt(v)} clicks` },
                },
            },
            series: [
                { name: "Non-branded", data: daily.map((d) => d.nonBranded) },
                { name: "Branded", data: daily.map((d) => d.branded) },
            ],
        };
    }, [data?.brandClicksDaily]);

    useEffect(() => {
        if (!data) {
            onLedeChange?.(null);
            return;
        }
        const pages = data.topLandingPages?.length || 0;
        const kws = data.keywordOverview?.length || 0;
        onLedeChange?.(
            `${fmtInt(kws)} keywords and ${fmtInt(pages)} landing pages with clicks${
                brand.share != null && brand.share > 0 ? `, ${fmtShare(brand.share)} of clicks from branded searches` : ""
            }.`
        );
    }, [data, brand.share, onLedeChange]);

    if (!siteUrl) {
        return <div className="apex-seo-alert">Add a Google Search Console property in Property Settings to load organic insights.</div>;
    }
    if (loading) {
        return (
            <div className="apex-perf-loading">
                <CobaltLoader variant="block" title="Loading organic insights" request="POST /api/seo-dashboard/insights" />
            </div>
        );
    }
    if (error) return <div className="apex-seo-error">{error}</div>;
    if (!data) return null;

    const appliedFilters = data.appliedFilters || [];

    return (
        <div className="apex-sx-stack">
            <section className="apex-ov-card">
                <div className="apex-ov-card__head">
                    <h3>Branded vs non-branded clicks</h3>
                    {brand.share != null && brand.share > 0 ? <span className="apex-ov-sub">{fmtShare(brand.share)} branded</span> : <span className="apex-ov-sub">Add brand terms in the keyword settings below to split the two</span>}
                </div>
                <SeoAppliedFilterBadges sectionId="brand-chart" appliedFilters={appliedFilters} />
                <GraphCard
                    variant="cobalt"
                    hideChartToggle
                    title=""
                    chartType="bar"
                    height={280}
                    chartOptions={brand.options}
                    chartSeries={brand.series}
                />
            </section>

            <SeoInsightsTable
                title="Top landing pages"
                subtitle="The change next to each value is against the comparison period you selected."
                columns={LANDING_COLUMNS}
                rows={data.topLandingPages || []}
                pageSize={10}
                filterSectionId="top-landing-pages"
                defaultSortKey="clicks"
                appliedFilters={appliedFilters}
            />

            <SeoInsightsTable
                title="Keyword overview"
                subtitle="The change next to each value is against the comparison period you selected. For position it shows places gained or lost."
                columns={KEYWORD_COLUMNS}
                rows={data.keywordOverview || []}
                pageSize={10}
                filterSectionId="keyword-overview"
                defaultSortKey="clicks"
                appliedFilters={appliedFilters}
            />
        </div>
    );
}
