"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import MetricCard from "@/components/dashboard/MetricCard";
import GraphCard from "@/components/dashboard/GraphCard";
import CobaltLoader from "@/components/ui/CobaltLoader";
import { useCustomers } from "@/hooks/useCustomers";
import { useDashboardDateRange } from "@/hooks/useDashboardDateRange";
import { formatComparisonPeriodDates } from "@/lib/dateRangeComparison";
import { mapReportToRows } from "@/lib/ga4ReportUtils";
import { getChartSeriesPalette } from "@/lib/charts/chartSeriesColors";
import PsSortableMetricsTable from "../../service-dashboard/ps/components/PsSortableMetricsTable";
import "../../service-dashboard/ppc/ppc-dashboard.css";
import {
    AURA_MONTHLY_BUDGET,
    AURA_MONTHLY_CUSTOMER_GOAL,
    budgetPace,
    dailyCostRows,
    googleAdsBlock,
    metaBlock,
    monthlyCost,
    suggestedDailyAdjustment,
    totalCost,
} from "./auraSheetLogic";

const NOT_CONNECTED = "Not connected";

const dkk = (v, digits) =>
    v == null || Number.isNaN(v)
        ? "N/A"
        : Number(v).toLocaleString("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: digits });
const fmt = {
    money: (v) => dkk(v, 0),
    money2: (v) => dkk(v, 2),
    num: (v) => (v == null || Number.isNaN(v) ? "N/A" : Number(v).toLocaleString("da-DK", { maximumFractionDigits: 0 })),
    num1: (v) => (v == null || Number.isNaN(v) ? "N/A" : Number(v).toLocaleString("da-DK", { maximumFractionDigits: 1 })),
    pct: (v) =>
        v == null || Number.isNaN(v) ? "N/A" : `${(Number(v) * 100).toLocaleString("da-DK", { maximumFractionDigits: 2 })}%`,
    ratio: (v) => (v == null || Number.isNaN(v) ? "N/A" : Number(v).toFixed(2)),
};

const isoDate = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function pctChange(current, prev) {
    if (current == null || prev == null || prev === 0) return null;
    return ((current - prev) / Math.abs(prev)) * 100;
}

function Kpi({ label, value, current, prev, comparisonMethod }) {
    const change = pctChange(current, prev);
    return (
        <MetricCard
            variant="cobalt"
            label={label}
            value={value}
            change={change !== null ? Math.abs(change).toFixed(1) : undefined}
            changeType={change === null ? undefined : change > 0 ? "up" : change < 0 ? "down" : undefined}
            comparisonMethod={comparisonMethod}
        />
    );
}

const DAILY_COLUMNS = [
    { key: "date", label: "Date", align: "left", format: "text" },
    { key: "ppc", label: "PPC cost", align: "right", format: "money", heatmap: true },
    { key: "ps", label: "PS cost", align: "right", format: "money", heatmap: true },
    { key: "total", label: "Spend total (Google + Meta)", align: "right", format: "money", heatmap: true },
];

export default function AuraPerformanceDashboard() {
    const params = useParams();
    const { customers } = useCustomers();
    const customer = customers.find((c) => c._id === params.customerId);

    const { appliedDateRange: appliedRange, appliedCompareRange, comparisonMethod, dateRangePickerProps } =
        useDashboardDateRange();

    const [state, setState] = useState({
        google: [],
        googlePrev: [],
        meta: [],
        metaPrev: [],
        googleYtd: [],
        metaYtd: [],
        channels: [],
        notes: [],
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchJson = useCallback(async (url) => {
        const res = await fetch(url);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
        return json;
    }, []);

    useEffect(() => {
        if (!customer) return;
        let cancelled = false;
        setLoading(true);
        setError(null);
        (async () => {
            try {
                const settings = (await fetchJson(`/api/customers/${customer._id}`)).CustomerSettings || {};
                const { googleAdsCustomerId, googleAdsCountryFilter, googleAdsCountryExclude, facebookAdAccountId } =
                    settings;
                const notes = [];

                const googleUrl = (range) => {
                    const p = new URLSearchParams({
                        customerId: googleAdsCustomerId,
                        startDate: range.startDate,
                        endDate: range.endDate,
                        dashboardCustomerId: String(customer._id),
                    });
                    if (googleAdsCountryFilter) p.set("countryFilter", googleAdsCountryFilter);
                    if (googleAdsCountryExclude) p.set("countryExclude", googleAdsCountryExclude);
                    return `/api/google-ppc-dashboard?${p.toString()}`;
                };
                const metaUrl = (range) => {
                    const p = new URLSearchParams({
                        adAccountId: facebookAdAccountId.startsWith("act_")
                            ? facebookAdAccountId
                            : `act_${facebookAdAccountId}`,
                        since: range.startDate,
                        until: range.endDate,
                        dashboardCustomerId: String(customer._id),
                    });
                    if (settings.customerMetaID) p.set("customerMetaID", settings.customerMetaID);
                    if (settings.customerMetaIDExclude) p.set("customerMetaIDExclude", settings.customerMetaIDExclude);
                    return `/api/facebook-campaign-insights?${p.toString()}`;
                };

                const comp = formatComparisonPeriodDates({
                    comparisonMethod,
                    startDate: appliedRange.startDate,
                    endDate: appliedRange.endDate,
                    compareStartDate: appliedCompareRange.startDate,
                    compareEndDate: appliedCompareRange.endDate,
                });
                const hasComp = !comp.skip && comp.startDate && comp.endDate;
                const today = new Date();
                const ytd = { startDate: `${today.getFullYear()}-01-01`, endDate: isoDate(today) };

                const safe = async (fn, label) => {
                    try {
                        return await fn();
                    } catch (e) {
                        notes.push(`${label}: ${e.message}`);
                        return null;
                    }
                };
                const googleOk = Boolean(googleAdsCustomerId);
                const metaOk = Boolean(facebookAdAccountId);
                if (!googleOk) notes.push("Google Ads: missing customer ID in Config");
                if (!metaOk) notes.push("Meta: missing ad account ID in Config");

                const ga4Url = settings.ga4PropertyId
                    ? `/api/ga4?${new URLSearchParams({
                          startDate: appliedRange.startDate,
                          endDate: appliedRange.endDate,
                          metrics: "sessions",
                          dimensions: "sessionDefaultChannelGroup",
                          limit: "20",
                          propertyId: settings.ga4PropertyId,
                          customerId: String(customer._id),
                      }).toString()}`
                    : null;
                if (!ga4Url) notes.push("GA4: missing property ID in Config");

                const [g, gp, m, mp, gy, my, ga] = await Promise.all([
                    googleOk ? safe(() => fetchJson(googleUrl(appliedRange)), "Google Ads") : null,
                    googleOk && hasComp ? safe(() => fetchJson(googleUrl(comp)), "Google Ads (comparison)") : null,
                    metaOk ? safe(() => fetchJson(metaUrl(appliedRange)), "Meta") : null,
                    metaOk && hasComp ? safe(() => fetchJson(metaUrl(comp)), "Meta (comparison)") : null,
                    googleOk ? safe(() => fetchJson(googleUrl(ytd)), "Google Ads (year to date)") : null,
                    metaOk ? safe(() => fetchJson(metaUrl(ytd)), "Meta (year to date)") : null,
                    ga4Url ? safe(() => fetchJson(ga4Url), "GA4") : null,
                ]);
                if (cancelled) return;
                setState({
                    google: g?.metrics_by_date || [],
                    googlePrev: gp?.metrics_by_date || [],
                    meta: m?.metrics_by_date || [],
                    metaPrev: mp?.metrics_by_date || [],
                    googleYtd: gy?.metrics_by_date || [],
                    metaYtd: my?.metrics_by_date || [],
                    channels: ga
                        ? mapReportToRows(ga)
                              .map((r) => ({
                                  channel: r.sessionDefaultChannelGroup || "(not set)",
                                  sessions: Number(r.sessions) || 0,
                              }))
                              .sort((a, b) => b.sessions - a.sessions)
                        : [],
                    notes,
                });
            } catch (e) {
                if (!cancelled) setError(e.message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [customer, appliedRange, appliedCompareRange, comparisonMethod, fetchJson]);

    const google = useMemo(() => googleAdsBlock(state.google), [state.google]);
    const googlePrev = useMemo(
        () => (state.googlePrev.length ? googleAdsBlock(state.googlePrev) : null),
        [state.googlePrev]
    );
    const meta = useMemo(() => metaBlock(state.meta), [state.meta]);
    const metaPrev = useMemo(() => (state.metaPrev.length ? metaBlock(state.metaPrev) : null), [state.metaPrev]);

    const cost = totalCost({ googleSpend: google.spend, metaSpend: meta.spend });
    const costPrev =
        googlePrev && metaPrev ? totalCost({ googleSpend: googlePrev.spend, metaSpend: metaPrev.spend }) : null;
    const spendBase = google.spend + meta.spend;

    const dailyRows = useMemo(
        () => dailyCostRows(state.google, state.meta).map((r) => ({ ...r, id: r.date })),
        [state.google, state.meta]
    );
    const monthly = useMemo(() => monthlyCost(state.googleYtd, state.metaYtd), [state.googleYtd, state.metaYtd]);

    const pace = useMemo(() => {
        const today = new Date();
        const month = monthly.find((m) => m.month === isoDate(today).slice(0, 7));
        const costToDate = month ? month.ppc + month.ps : 0;
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        const args = { costToDate, budget: AURA_MONTHLY_BUDGET, daysInMonth, today };
        return { costToDate, pace: budgetPace(args), adjustment: suggestedDailyAdjustment(args) };
    }, [monthly]);

    const baseChart = {
        chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: "Outfit, sans-serif" },
        colors: getChartSeriesPalette(3),
        dataLabels: { enabled: false },
        legend: { position: "top" },
        grid: { borderColor: "#e5e7eb", xaxis: { lines: { show: false } } },
        yaxis: { labels: { formatter: (v) => fmt.money(v) } },
        tooltip: { theme: "light", y: { formatter: (v) => fmt.money(v) } },
    };
    const stackedChart = (categories, rowsA, rowsB, rotate) => ({
        options: {
            ...baseChart,
            chart: { ...baseChart.chart, stacked: true },
            xaxis: { categories, labels: rotate ? { rotate: -45 } : {} },
        },
        series: [
            { name: "PPC cost (Google Ads)", data: rowsA.map(Math.round) },
            { name: "PS cost (Meta)", data: rowsB.map(Math.round) },
        ],
    });
    const dailyChart = stackedChart(
        dailyRows.map((r) => r.date),
        dailyRows.map((r) => r.ppc),
        dailyRows.map((r) => r.ps),
        true
    );
    const monthlyChart = stackedChart(
        monthly.map((m) => m.month),
        monthly.map((m) => m.ppc),
        monthly.map((m) => m.ps),
        false
    );
    const channelChart = {
        options: {
            ...baseChart,
            plotOptions: { bar: { horizontal: true } },
            xaxis: { categories: state.channels.map((c) => c.channel) },
            yaxis: { labels: { formatter: (v) => v } },
            tooltip: { theme: "light", y: { formatter: (v) => fmt.num(v) } },
        },
        series: [{ name: "Sessions", data: state.channels.map((c) => c.sessions) }],
    };

    const kpi = (label, value, cur, prv) => (
        <Kpi label={label} value={value} current={cur} prev={prv} comparisonMethod={comparisonMethod} />
    );
    const notConnected = (label, caption) => (
        <MetricCard variant="cobalt" label={label} value={NOT_CONNECTED} subCaption={caption} />
    );

    return (
        <div id="AuraPerformanceDashboard" className="apex-perf w-full">
            <DashboardHeading
                variant="cobalt"
                showRunAudit={false}
                title="Aura Performance"
                label={customer ? customer.customerName : ""}
                customerId={params.customerId}
                dateRange={appliedRange}
                comparisonMethod={comparisonMethod}
                loading={loading}
                dashboardType="custom-aura-performance"
                dataSnapshot={{ google, meta, dailyRows }}
                right={<DateRangePicker {...dateRangePickerProps} variant="cobalt" loading={loading} />}
            />

            {loading ? (
                <div className="apex-perf-loading">
                    <CobaltLoader variant="block" title="Loading Aura metrics" request="GET /api/google-ppc-dashboard" />
                </div>
            ) : error ? (
                <div className="apex-ppc-error">{error}</div>
            ) : (
                <div className="apex-ppc-panel">
                    {state.notes.length > 0 && (
                        <p className="apex-ppc-chart-note">Some sources could not be loaded: {state.notes.join("; ")}</p>
                    )}
                    <p className="apex-ppc-chart-note">
                        Rebuilt from the Supermetrics Google Sheet. Customers (orders), CAC and the &quot;Other&quot; cost
                        come from a private sheet that is not connected yet, so total spend here is Google Ads + Meta only.
                        See custom-dashboards/aura/SHEET_LOGIC.md.
                    </p>

                    <section className="apex-ppc-section">
                        <h3 className="apex-ppc-section__label">General</h3>
                        <div className="apex-ppc-kpi-grid apex-ppc-kpi-grid--4">
                            {kpi("Spend (Google Ads + Meta)", fmt.money(cost), cost, costPrev)}
                            {kpi("Google Ads share", spendBase > 0 ? fmt.pct(google.spend / spendBase) : "N/A")}
                            {kpi("Meta share", spendBase > 0 ? fmt.pct(meta.spend / spendBase) : "N/A")}
                            {notConnected("Other cost", "Campaigns Cost sheet")}
                            {notConnected("Customers (orders)", "Conversions data sheet")}
                            {notConnected("CAC", "Needs customers and other cost")}
                        </div>
                    </section>

                    <section className="apex-ppc-section">
                        <h3 className="apex-ppc-section__label">Budget pace (current month, Google Ads + Meta only)</h3>
                        <div className="apex-ppc-kpi-grid apex-ppc-kpi-grid--3">
                            {kpi("Month to date spend", fmt.money(pace.costToDate))}
                            {kpi("Pace vs budget", fmt.ratio(pace.pace))}
                            {kpi("Suggested daily adjustment", fmt.money(pace.adjustment))}
                        </div>
                        <p className="apex-ppc-chart-note">
                            Estimate. Pace = month to date spend / (monthly budget / days in month x elapsed days), as in the
                            sheet. It understates the real pace because the &quot;Other&quot; cost is missing.
                        </p>
                    </section>

                    <section className="apex-ppc-section">
                        <h3 className="apex-ppc-section__label">PPC (Google Ads)</h3>
                        <div className="apex-ppc-kpi-grid apex-ppc-kpi-grid--4">
                            {kpi("Ad spend", fmt.money(google.spend), google.spend, googlePrev?.spend)}
                            {kpi("Conversions", fmt.num1(google.conversions), google.conversions, googlePrev?.conversions)}
                            {kpi("Conv. value (excl. VAT)", fmt.money(google.convValue), google.convValue, googlePrev?.convValue)}
                            {kpi("ROAS", fmt.ratio(google.roas), google.roas, googlePrev?.roas)}
                            {kpi("AOV", fmt.money(google.aov), google.aov, googlePrev?.aov)}
                            {kpi("Impressions", fmt.num(google.impressions), google.impressions, googlePrev?.impressions)}
                            {kpi("Clicks", fmt.num(google.clicks), google.clicks, googlePrev?.clicks)}
                            {kpi("CTR", fmt.pct(google.ctr), google.ctr, googlePrev?.ctr)}
                            {kpi("CPC", fmt.money2(google.cpc), google.cpc, googlePrev?.cpc)}
                            {kpi("Conv. rate", fmt.pct(google.convRate), google.convRate, googlePrev?.convRate)}
                            {kpi("CPA", fmt.money(google.cpa), google.cpa, googlePrev?.cpa)}
                        </div>
                    </section>

                    <section className="apex-ppc-section">
                        <h3 className="apex-ppc-section__label">PS (Meta)</h3>
                        <div className="apex-ppc-kpi-grid apex-ppc-kpi-grid--4">
                            {kpi("Ad spend", fmt.money(meta.spend), meta.spend, metaPrev?.spend)}
                            {kpi("Impressions", fmt.num(meta.impressions), meta.impressions, metaPrev?.impressions)}
                            {kpi("Clicks", fmt.num(meta.clicks), meta.clicks, metaPrev?.clicks)}
                            {kpi("Conversions (x 0.75, as in sheet)", fmt.num1(meta.conversions), meta.conversions, metaPrev?.conversions)}
                            {kpi("CTR", fmt.pct(meta.ctr), meta.ctr, metaPrev?.ctr)}
                            {kpi("CPC", fmt.money2(meta.cpc), meta.cpc, metaPrev?.cpc)}
                            {kpi("CPM", fmt.money2(meta.cpm), meta.cpm, metaPrev?.cpm)}
                            {kpi("CPA", fmt.money(meta.cpa), meta.cpa, metaPrev?.cpa)}
                        </div>
                    </section>

                    <div className="apex-ppc-chart-block">
                        <GraphCard
                            variant="cobalt"
                            title="Daily spend split"
                            chartOptions={dailyChart.options}
                            chartSeries={dailyChart.series}
                            chartType="bar"
                            hideChartToggle
                        />
                    </div>

                    <div className="apex-ppc-chart-block">
                        <GraphCard
                            variant="cobalt"
                            title="Monthly spend split (year to date)"
                            chartOptions={monthlyChart.options}
                            chartSeries={monthlyChart.series}
                            chartType="bar"
                            hideChartToggle
                        />
                    </div>

                    <div className="apex-ppc-chart-block">
                        <GraphCard
                            variant="cobalt"
                            title="Sessions per channel group (GA4)"
                            chartOptions={channelChart.options}
                            chartSeries={channelChart.series}
                            chartType="bar"
                            hideChartToggle
                        />
                    </div>

                    <PsSortableMetricsTable
                        variant="cobalt"
                        title="Daily cost (Overview Day)"
                        subtitle={`Customers, other cost and CAC columns from the sheet are not connected. Monthly customer goal in the sheet: ${AURA_MONTHLY_CUSTOMER_GOAL}.`}
                        columns={DAILY_COLUMNS}
                        rows={dailyRows}
                        rowKeyField="id"
                    />
                </div>
            )}
        </div>
    );
}
