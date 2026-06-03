"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import MetricCard from "@/components/dashboard/MetricCard";
import GraphCard from "@/components/dashboard/GraphCard";
import Spinner from "@/components/ui/Spinner";
import { useCustomers } from "@/hooks/useCustomers";
import { pushDashboardDateRangeApplied } from "@root/lib/gtmFunctions";
import { useDashboardDateRange } from "@/hooks/useDashboardDateRange";
import {
    formatComparisonPeriodDates,
    resolveDailyComparisonDate,
    COMPARISON_METHOD,
} from "@/lib/dateRangeComparison";
import {
    aggregatePpcPeriodFromDaily,
    getPpcDailyMetricValue,
    normalizeSeriesValues,
    pickTermWinnersLosers,
    PPC_CHART_METRIC_LABELS,
} from "@/lib/googlePpcDashboardUtils";
import PsSortableMetricsTable from "../ps/components/PsSortableMetricsTable";
import {
    CHART_TOGGLE_METRICS,
    DISPLAY_ONLY_METRICS,
    IMPRESSION_SHARE_METRICS,
    TERM_TABLE_COLUMNS,
    CAMPAIGN_TABLE_COLUMNS,
} from "./components/ppcDashboardConfig";

function formatKpiValue(key, value, opt = {}) {
    if (value === null || value === undefined || Number.isNaN(value)) return "—";
    if (
        opt.isPercent ||
        key === "conv_rate" ||
        key === "impression_share" ||
        key === "is_lost_budget" ||
        key === "is_lost_rank"
    ) {
        const pctVal =
            (key === "conv_rate" || key === "impression_share" || key === "is_lost_budget" || key === "is_lost_rank") &&
            value <= 1
                ? value * 100
                : value;
        return `${Number(pctVal).toLocaleString("da-DK", { maximumFractionDigits: 2 })}%`;
    }
    if (key === "roas") return Number(value).toFixed(2);
    if (key === "ad_spend" || key === "conversions_value" || key === "cpc" || key === "cpa") {
        return Number(value).toLocaleString("da-DK", {
            style: "currency",
            currency: "DKK",
            maximumFractionDigits: 0,
            minimumFractionDigits: 0,
        });
    }
    return Number(value).toLocaleString("da-DK", { maximumFractionDigits: 0 });
}

export default function GoogleAdsPPCPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const rangeStartQ = searchParams.get("startDate");
    const rangeEndQ = searchParams.get("endDate");
    const { customers } = useCustomers();
    const customer = customers.find((c) => c._id === params.customerId);

    const {
        setTempDateRange: setTempRange,
        appliedDateRange: appliedRange,
        setAppliedDateRange: setAppliedRange,
        appliedCompareRange,
        comparisonMethod,
        comparisonLabel,
        dateRangePickerProps,
    } = useDashboardDateRange({
        onApply: ({ startDate, endDate, comparisonMethod: appliedComparison }) => {
            pushDashboardDateRangeApplied({
                page: "service_dashboard_ppc",
                customerId: params.customerId,
                startDate,
                endDate,
                comparisonMethod: appliedComparison,
            });
        },
    });

    const [metricsByDate, setMetricsByDate] = useState([]);
    const [metricsByDatePrev, setMetricsByDatePrev] = useState([]);
    const [campaignsPerformance, setCampaignsPerformance] = useState([]);
    const [searchTerms, setSearchTerms] = useState([]);
    const [brandGenericSpendByDate, setBrandGenericSpendByDate] = useState([]);
    const [accountSummary, setAccountSummary] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedMetrics, setSelectedMetrics] = useState(["ad_spend"]);

    useEffect(() => {
        if (selectedMetrics.length === 0) setSelectedMetrics(["ad_spend"]);
    }, [selectedMetrics]);

    useEffect(() => {
        if (rangeStartQ && rangeEndQ) {
            setTempRange({ startDate: rangeStartQ, endDate: rangeEndQ });
            setAppliedRange({ startDate: rangeStartQ, endDate: rangeEndQ });
        }
    }, [rangeStartQ, rangeEndQ, setTempRange, setAppliedRange]);

    const buildPpcUrl = useCallback(
        (settings, range) => {
            const { googleAdsCustomerId, googleAdsCountryFilter, googleAdsCountryExclude } = settings;
            const countryParams = [
                googleAdsCountryFilter ? `countryFilter=${encodeURIComponent(googleAdsCountryFilter)}` : "",
                googleAdsCountryExclude ? `countryExclude=${encodeURIComponent(googleAdsCountryExclude)}` : "",
            ]
                .filter(Boolean)
                .join("&");
            const countryParam = countryParams ? `&${countryParams}` : "";
            const dash = `&dashboardCustomerId=${encodeURIComponent(String(customer._id))}`;
            return `/api/google-ppc-dashboard?customerId=${encodeURIComponent(googleAdsCustomerId)}&startDate=${encodeURIComponent(range.startDate)}&endDate=${encodeURIComponent(range.endDate)}${countryParam}${dash}`;
        },
        [customer]
    );

    useEffect(() => {
        if (!customer) return;
        setLoading(true);
        setError(null);
        (async () => {
            try {
                const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
                const res = await fetch(`${baseUrl}/api/customers/${customer._id}`);
                if (!res.ok) throw new Error("Failed to fetch customer settings");
                const settings = (await res.json()).CustomerSettings || {};
                const { googleAdsCustomerId } = settings;
                if (!googleAdsCustomerId) throw new Error("Missing Google Ads customer ID");

                const compDates = formatComparisonPeriodDates({
                    comparisonMethod,
                    startDate: appliedRange.startDate,
                    endDate: appliedRange.endDate,
                    compareStartDate: appliedCompareRange.startDate,
                    compareEndDate: appliedCompareRange.endDate,
                });

                const fetches = [fetch(buildPpcUrl(settings, appliedRange))];
                if (!compDates.skip && compDates.startDate && compDates.endDate) {
                    fetches.push(
                        fetch(
                            buildPpcUrl(settings, {
                                startDate: compDates.startDate,
                                endDate: compDates.endDate,
                            })
                        )
                    );
                }

                const [ppcRes, ppcResPrev] = await Promise.all(fetches);
                if (!ppcRes.ok) throw new Error("Failed to fetch Google Ads PPC dashboard metrics");
                const metrics = await ppcRes.json();
                setMetricsByDate(metrics.metrics_by_date || []);
                setCampaignsPerformance(metrics.campaigns_performance || metrics.top_campaigns || []);
                setSearchTerms(metrics.search_terms || []);
                setBrandGenericSpendByDate(metrics.brand_generic_spend_by_date || []);
                setAccountSummary(metrics.account_summary || {});

                if (ppcResPrev?.ok) {
                    const metricsPrev = await ppcResPrev.json();
                    setMetricsByDatePrev(metricsPrev.metrics_by_date || []);
                } else {
                    setMetricsByDatePrev([]);
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        })();
    }, [customer, appliedRange, appliedCompareRange, comparisonMethod, buildPpcUrl]);

    const percentChange = (current, prev) => {
        if (prev === 0 || prev === null || prev === undefined) return null;
        return ((current - prev) / Math.abs(prev)) * 100;
    };
    const changeType = (val) => {
        if (val === null) return undefined;
        return val > 0 ? "up" : val < 0 ? "down" : undefined;
    };

    const displayOnlyValues = useMemo(
        () => ({
            new_customer_ratio: accountSummary.new_customer_ratio ?? null,
            recurring_customer_ratio: accountSummary.recurring_customer_ratio ?? null,
        }),
        [accountSummary]
    );

    const impressionShareValues = useMemo(
        () => ({
            impression_share: aggregatePpcPeriodFromDaily(metricsByDate, "impression_share"),
            is_lost_budget: aggregatePpcPeriodFromDaily(metricsByDate, "is_lost_budget"),
            is_lost_rank: aggregatePpcPeriodFromDaily(metricsByDate, "is_lost_rank"),
        }),
        [metricsByDate]
    );

    const buildMetricCard = (opt, chartToggle) => {
        let currentValue;
        let prevValue = null;
        if (DISPLAY_ONLY_METRICS.some((d) => d.key === opt.key)) {
            currentValue = displayOnlyValues[opt.key];
        } else if (IMPRESSION_SHARE_METRICS.some((d) => d.key === opt.key)) {
            currentValue = impressionShareValues[opt.key];
        } else {
            currentValue = aggregatePpcPeriodFromDaily(metricsByDate, opt.key);
            prevValue =
                metricsByDatePrev.length > 0
                    ? aggregatePpcPeriodFromDaily(metricsByDatePrev, opt.key)
                    : null;
        }
        const change = percentChange(currentValue, prevValue);
        const isActive = chartToggle && selectedMetrics.includes(opt.key);
        const Icon = opt.icon;

        return (
            <div
                key={opt.key}
                onClick={
                    chartToggle
                        ? () =>
                              setSelectedMetrics((prev) => {
                                  if (prev.includes(opt.key)) {
                                      return prev.length > 1 ? prev.filter((m) => m !== opt.key) : prev;
                                  }
                                  return [...prev, opt.key];
                              })
                        : undefined
                }
                style={chartToggle ? { cursor: "pointer" } : undefined}
            >
                <MetricCard
                    label={opt.label}
                    value={formatKpiValue(opt.key, currentValue, opt)}
                    icon={Icon ? <Icon size={22} color={isActive ? "#fff" : undefined} /> : null}
                    isActive={isActive}
                    change={change !== null ? Math.abs(change).toFixed(1) : undefined}
                    changeType={changeType(change)}
                    comparisonMethod={chartToggle ? comparisonMethod : undefined}
                />
            </div>
        );
    };

    const chartCategories = metricsByDate.map((row) => row.date);
    const metricsByDatePrevMap = Object.fromEntries(metricsByDatePrev.map((row) => [row.date, row]));
    const sortedPrevDates = metricsByDatePrev.map((row) => row.date).sort();

    const rawSeriesByMetric = useMemo(() => {
        const out = {};
        for (const key of selectedMetrics) {
            out[key] = {
                current: chartCategories.map((date) =>
                    getPpcDailyMetricValue(metricsByDate.find((r) => r.date === date), key)
                ),
                prev: chartCategories.map((date) => {
                    const prevDate = resolveDailyComparisonDate({
                        comparisonMethod,
                        currentDate: date,
                        appliedStartDate: appliedRange.startDate,
                        appliedEndDate: appliedRange.endDate,
                        sortedPrevKeys: sortedPrevDates,
                    });
                    return getPpcDailyMetricValue(
                        prevDate ? metricsByDatePrevMap[prevDate] : null,
                        key
                    );
                }),
            };
        }
        return out;
    }, [
        selectedMetrics,
        chartCategories,
        metricsByDate,
        metricsByDatePrevMap,
        sortedPrevDates,
        comparisonMethod,
        appliedRange,
    ]);

    const chartSeries = useMemo(() => {
        const series = [];
        for (const key of selectedMetrics) {
            const label = PPC_CHART_METRIC_LABELS[key] || key;
            const raw = rawSeriesByMetric[key];
            if (!raw) continue;
            series.push({
                name: `${label} (Current)`,
                data: normalizeSeriesValues(raw.current),
                meta: { raw: raw.current, key },
            });
            if (comparisonMethod !== COMPARISON_METHOD.NONE) {
                series.push({
                    name: `${label} (${comparisonLabel})`,
                    data: normalizeSeriesValues(raw.prev),
                    meta: { raw: raw.prev, key },
                });
            }
        }
        return series;
    }, [selectedMetrics, rawSeriesByMetric, comparisonMethod, comparisonLabel]);

    const selectedMetricsCount = selectedMetrics.length;
    const compCount = comparisonMethod !== COMPARISON_METHOD.NONE ? selectedMetricsCount : 0;
    const strokeWidths = [...Array(selectedMetricsCount).fill(2), ...Array(compCount).fill(1)];
    const strokeDashArrays = [...Array(selectedMetricsCount).fill(0), ...Array(compCount).fill(5)];
    const fillOpacities = [...Array(selectedMetricsCount).fill(1), ...Array(compCount).fill(0.5)];

    const chartOptions = useMemo(
        () => ({
            chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: "Outfit, sans-serif" },
            xaxis: { categories: chartCategories },
            yaxis: {
                min: 0,
                max: 100,
                labels: { formatter: (v) => `${Math.round(v)}%` },
            },
            colors: [
                "#406969",
                "#1E2B2B",
                "#4F46E5",
                "#06B6D4",
                "#C6ED62",
                "#D6CDB6",
                "#F59E0B",
                "#EF4444",
                "#8B5CF6",
                "#EC4899",
                "#10B981",
            ],
            stroke: { width: strokeWidths, curve: "smooth", dashArray: strokeDashArrays },
            fill: { type: "solid", opacity: fillOpacities },
            grid: {
                borderColor: "#e5e7eb",
                strokeDashArray: 0,
                xaxis: { lines: { show: false } },
                yaxis: { lines: { show: true } },
            },
            dataLabels: { enabled: false },
            tooltip: {
                theme: "light",
                y: {
                    formatter: (_val, opts) => {
                        const s = chartSeries[opts?.seriesIndex];
                        const raw = s?.meta?.raw?.[opts?.dataPointIndex];
                        const key = s?.meta?.key;
                        if (raw == null) return "—";
                        if (key === "conv_rate" || key === "impression_share" || key === "is_lost_budget" || key === "is_lost_rank") {
                            return `${Number(raw).toFixed(2)}%`;
                        }
                        return formatKpiValue(key, raw);
                    },
                },
            },
            legend: { show: true, position: "top" },
        }),
        [chartCategories, strokeWidths, strokeDashArrays, fillOpacities, chartSeries]
    );

    const brandGenericChart = useMemo(() => {
        const dates = brandGenericSpendByDate.map((d) => d.date);
        return {
            options: {
                chart: {
                    stacked: true,
                    stackType: "normal",
                    toolbar: { show: false },
                    fontFamily: "Outfit, sans-serif",
                },
                plotOptions: { area: { stacking: "normal" } },
                xaxis: { categories: dates },
                yaxis: {
                    labels: {
                        formatter: (v) =>
                            `${Number(v).toLocaleString("da-DK", { maximumFractionDigits: 0 })} kr.`,
                    },
                },
                colors: ["#406969", "#C6ED62", "#94a3b8"],
                legend: { position: "top" },
                dataLabels: { enabled: false },
                stroke: { curve: "smooth", width: 1 },
                fill: { opacity: 0.85 },
            },
            series: [
                { name: "Brand", data: brandGenericSpendByDate.map((d) => Math.round(d.brand_spend || 0)) },
                { name: "Generic", data: brandGenericSpendByDate.map((d) => Math.round(d.generic_spend || 0)) },
                { name: "Other", data: brandGenericSpendByDate.map((d) => Math.round(d.other_spend || 0)) },
            ],
        };
    }, [brandGenericSpendByDate]);

    const { winners, losers } = useMemo(
        () => pickTermWinnersLosers(searchTerms, { minSpend: 50, limit: 5 }),
        [searchTerms]
    );

    const row1 = CHART_TOGGLE_METRICS.filter((m) => m.row === 1);
    const row2 = CHART_TOGGLE_METRICS.filter((m) => m.row === 2);

    return (
        <div className="w-full">
            <DashboardHeading
                title="Paid Search Dashboard"
                label={customer ? customer.customerName : ""}
                customerId={params.customerId}
                dateRange={appliedRange}
                comparisonMethod={comparisonMethod}
                loading={loading}
                dashboardType="ppc-dashboard"
                dataSnapshot={{ metricsByDate, campaignsPerformance, searchTerms, selectedMetrics }}
                right={<DateRangePicker {...dateRangePickerProps} loading={loading} />}
            />

            {loading ? (
                <div className="text-center py-12">
                    <Spinner size={40} color="#406969" />
                </div>
            ) : error ? (
                <div className="text-center text-red-500 py-8">{error}</div>
            ) : (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full mb-4">
                        {row1.map((opt) => buildMetricCard(opt, true))}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 w-full mb-4">
                        {row2.map((opt) => buildMetricCard(opt, true))}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-2 gap-4 w-full mb-8">
                        {DISPLAY_ONLY_METRICS.map((opt) => buildMetricCard(opt, false))}
                    </div>

                    <div className="mb-8">
                        <GraphCard
                            title="Spend over time"
                            chartOptions={chartOptions}
                            chartSeries={chartSeries}
                            hideChartToggle
                        />
                        <p className="text-[11px] text-gray-500 mt-2">
                            Values are normalized to 0–100% of each metric&apos;s maximum for comparable curves.
                            Hover for actual numbers. Click KPI cards above to show or hide metrics.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mb-8">
                        {IMPRESSION_SHARE_METRICS.map((opt) => buildMetricCard(opt, false))}
                    </div>

                    <PsSortableMetricsTable
                        title="Term winners"
                        subtitle="Search terms with strong ROAS — candidates for exact match, dedicated ad groups, or higher bids."
                        columns={TERM_TABLE_COLUMNS}
                        rows={winners.map((r, i) => ({ ...r, id: `${r.search_term}-${i}` }))}
                        rowKeyField="id"
                        highlightPositiveNegative
                    />
                    <PsSortableMetricsTable
                        title="Term losers"
                        subtitle="Search terms with weak ROAS — candidates for negatives, bid reductions, or query exclusions."
                        columns={TERM_TABLE_COLUMNS}
                        rows={losers.map((r, i) => ({ ...r, id: `l-${r.search_term}-${i}` }))}
                        rowKeyField="id"
                        highlightPositiveNegative
                    />

                    <PsSortableMetricsTable
                        title="Kampagne performance"
                        columns={CAMPAIGN_TABLE_COLUMNS}
                        rows={campaignsPerformance.map((r, i) => ({
                            ...r,
                            id: r.campaign_name || i,
                        }))}
                        rowKeyField="id"
                        highlightPositiveNegative
                    />

                    <div className="mb-8">
                        <GraphCard
                            title="Brand vs Generic spend"
                            chartOptions={brandGenericChart.options}
                            chartSeries={brandGenericChart.series}
                            chartType="area"
                            hideChartToggle
                        />
                    </div>
                </>
            )}
        </div>
    );
}
