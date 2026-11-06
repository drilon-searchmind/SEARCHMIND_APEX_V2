"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { SiGoogleads, SiMeta } from "react-icons/si";
import { FiLayout } from "react-icons/fi";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import CobaltLoader from "@/components/ui/CobaltLoader";
import { useCustomers } from "@/hooks/useCustomers";
import { useUser } from "@/contexts/UserContext";
import { useDashboardDateRange } from "@/hooks/useDashboardDateRange";
import { formatComparisonPeriodDates } from "@/lib/dateRangeComparison";
import { buildAuraSources, fetchJson } from "./auraApi";
import { mapReportToRows } from "@/lib/ga4ReportUtils";
import { cac, googleAdsBlock, metaBlock, totalCost } from "./auraSheetLogic";
import AuraTrendChart from "./AuraTrendChart";
import AuraSpendAllocationChart from "./AuraSpendAllocationChart";
import AuraSessionsChart from "./AuraSessionsChart";
import AuraGoogleAdsTab from "./AuraGoogleAdsTab";
import HeroKpi, { nf0, nf2, pctChange } from "./HeroKpi";
import DashboardTabs from "../components/DashboardTabs";
import { useAuraYearData } from "./useAuraYearData";
import CampaignFilterBar from "../components/CampaignFilterBar";
import { EMPTY_FILTER, FILTER_CHANNELS, FILTER_PRESETS, loadSavedFilter, saveFilter } from "./auraFilter";

const TABS = [
    { key: "overview", label: "Overview", icon: FiLayout },
    { key: "google", label: "Google Ads", icon: SiGoogleads },
    { key: "meta", label: "Meta", icon: SiMeta },
];

const sumValues = (rows) => (rows || []).reduce((sum, r) => sum + (Number(r?.value) || 0), 0);

export default function AuraPerformanceDashboard() {
    const params = useParams();
    const { customers } = useCustomers();
    const user = useUser();
    const isAdmin = user?.isAdmin === true;
    const customer = customers.find((c) => c._id === params.customerId);
    const customerId = customer?._id;

    const { appliedDateRange: appliedRange, appliedCompareRange, comparisonMethod, dateRangePickerProps } =
        useDashboardDateRange();

    const [settings, setSettings] = useState(null);
    // Campaign filter: off by default, remembered per viewer (localStorage) once applied.
    const [filter, setFilter] = useState(EMPTY_FILTER);
    const [filterLoaded, setFilterLoaded] = useState(false);
    const [tab, setTab] = useState("overview");
    const [data, setData] = useState({
        google: [],
        googlePrev: [],
        meta: [],
        metaPrev: [],
        sheet: null,
        sheetPrev: null,
        channels: null,
        ga4Configured: true,
        googleConfigured: true,
        notes: [],
        failed: false,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!customerId) return;
        setFilter(loadSavedFilter(customerId));
        setFilterLoaded(true);
    }, [customerId]);

    const filterKey = JSON.stringify(filter);
    const handleApplyFilter = (next) => {
        setFilter(next);
        saveFilter(customerId, next);
    };

    // One shared fetch of this year and last year for both monthly charts.
    const yearData = useAuraYearData({ customerId, settings, filter });

    // Primitive keys: the range objects from the hook are new objects on every render.
    const startDate = appliedRange.startDate;
    const endDate = appliedRange.endDate;
    const compareStart = appliedCompareRange.startDate;
    const compareEnd = appliedCompareRange.endDate;

    useEffect(() => {
        if (!customerId || !filterLoaded) return;
        let cancelled = false;
        setLoading(true);
        setError(null);
        (async () => {
            try {
                const loaded = (await fetchJson(`/api/customers/${customerId}`)).CustomerSettings || {};
                if (cancelled) return;
                // Keep the same object when nothing changed so the trend chart does not refetch on every date change.
                setSettings((prev) => (JSON.stringify(prev) === JSON.stringify(loaded) ? prev : loaded));
                const sources = buildAuraSources(customerId, loaded, JSON.parse(filterKey));
                const notes = [];
                let failed = false;

                const comp = formatComparisonPeriodDates({
                    comparisonMethod,
                    startDate,
                    endDate,
                    compareStartDate: compareStart,
                    compareEndDate: compareEnd,
                });
                const hasComp = !comp.skip && comp.startDate && comp.endDate;

                const safe = async (fn, label) => {
                    try {
                        return await fn();
                    } catch (e) {
                        failed = true;
                        notes.push(`${label}: ${e.message}`);
                        return null;
                    }
                };
                if (!sources.google) notes.push("Google Ads: no valid customer ID in Config");
                if (!sources.meta) notes.push("Meta: no valid ad account ID in Config");

                const [g, gp, m, mp, sh, shp, ga] = await Promise.all([
                    sources.google ? safe(() => fetchJson(sources.google({ startDate, endDate })), "Google Ads") : null,
                    sources.google && hasComp ? safe(() => fetchJson(sources.google(comp)), "Google Ads (comparison)") : null,
                    sources.meta ? safe(() => fetchJson(sources.meta({ startDate, endDate })), "Meta") : null,
                    sources.meta && hasComp ? safe(() => fetchJson(sources.meta(comp)), "Meta (comparison)") : null,
                    safe(() => fetchJson(sources.sheet({ startDate, endDate })), "Aura inputs"),
                    hasComp ? safe(() => fetchJson(sources.sheet(comp)), "Aura inputs (comparison)") : null,
                    sources.ga4 ? safe(() => fetchJson(sources.ga4({ startDate, endDate })), "GA4") : null,
                ]);
                if (cancelled) return;
                setData({
                    google: g?.metrics_by_date || [],
                    googlePrev: gp?.metrics_by_date || [],
                    meta: m?.metrics_by_date || [],
                    metaPrev: mp?.metrics_by_date || [],
                    sheet: sh,
                    sheetPrev: shp,
                    ga4Configured: Boolean(sources.ga4),
                    googleConfigured: Boolean(sources.google),
                    channels: ga
                        ? mapReportToRows(ga)
                              .map((r) => ({ channel: r.sessionDefaultChannelGroup || "(not set)", sessions: Number(r.sessions) || 0 }))
                              .sort((a, b) => b.sessions - a.sessions)
                        : null,
                    notes,
                    failed,
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
    }, [customerId, filterLoaded, filterKey, startDate, endDate, compareStart, compareEnd, comparisonMethod]);

    const kpis = useMemo(() => {
        const g = googleAdsBlock(data.google);
        const m = metaBlock(data.meta);
        // Cost = Google Ads + Meta + "Other" (campaign budgets saved under Data inputs), as in the old dashboard.
        const cost = totalCost({ googleSpend: g.spend, metaSpend: m.spend, otherCost: sumValues(data.sheet?.otherCost) });
        const hasPrev = data.googlePrev.length > 0 || data.metaPrev.length > 0;
        const gp = googleAdsBlock(data.googlePrev);
        const mp = metaBlock(data.metaPrev);
        const costPrev = hasPrev
            ? totalCost({ googleSpend: gp.spend, metaSpend: mp.spend, otherCost: sumValues(data.sheetPrev?.otherCost) })
            : null;
        const customersNow = data.sheet ? sumValues(data.sheet.conversions) : null;
        const customersPrev = data.sheetPrev ? sumValues(data.sheetPrev.conversions) : null;
        const cacNow = cac(cost, customersNow);
        const cacPrev = costPrev != null ? cac(costPrev, customersPrev) : null;
        // A failed source makes the two periods incomparable, so no change is shown.
        const comparable = !data.failed;
        return {
            cost,
            costChange: comparable ? pctChange(cost, costPrev) : null,
            customers: customersNow,
            customersChange: comparable ? pctChange(customersNow, customersPrev) : null,
            cac: cacNow,
            cacChange: comparable ? pctChange(cacNow, cacPrev) : null,
        };
    }, [data]);

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
                dataSnapshot={{ cost: kpis.cost }}
                right={<DateRangePicker {...dateRangePickerProps} variant="cobalt" loading={loading} />}
            />

            {filterLoaded ? (
                <CampaignFilterBar
                    key={customerId}
                    value={filter}
                    onApply={handleApplyFilter}
                    channels={FILTER_CHANNELS}
                    presets={FILTER_PRESETS}
                />
            ) : null}

            <DashboardTabs tabs={TABS} value={tab} onChange={setTab} label="Dashboard sections" />

            {loading ? (
                <div className="apex-perf-loading">
                    <CobaltLoader variant="block" title="Loading Aura metrics" request="GET /api/google-ppc-dashboard" />
                </div>
            ) : error ? (
                isAdmin ? <div className="apex-ppc-error">{error}</div> : null
            ) : (
                <>
                    {isAdmin && data.notes.length > 0 ? (
                        <p className="apex-ppc-chart-note aura-admin-note">
                            Admin only. Some sources could not be loaded: {data.notes.join("; ")}
                        </p>
                    ) : null}
                    {tab === "overview" ? (
                        <>
                        {!filter.enabled ? (
                            <p className="apex-ppc-chart-note">
                                Cost and CAC include every campaign on the connected ad accounts. The old sheet only counted the
                                Emob campaigns: switch on the campaign filter and choose the Emob preset to match it.
                            </p>
                        ) : null}
                        <section className="aura-hero" aria-label="Key figures">
                            <HeroKpi
                                label="Conversions"
                                value={kpis.customers == null ? null : nf0.format(kpis.customers)}
                                change={kpis.customersChange}
                                note="Saved conversions could not be loaded"
                            />
                            <HeroKpi label="Cost" value={nf0.format(kpis.cost)} change={kpis.costChange} lowerIsBetter />
                            <HeroKpi
                                label="CAC"
                                value={kpis.cac == null ? null : nf2.format(kpis.cac)}
                                change={kpis.cacChange}
                                lowerIsBetter
                                note="Needs conversions"
                            />
                        </section>
                        <AuraTrendChart sheets={yearData.sheets} spend={yearData.spend} />
                        <AuraSpendAllocationChart sheets={yearData.sheets} spend={yearData.spend} />
                        <AuraSessionsChart channels={data.channels} ga4Configured={data.ga4Configured} />
                        </>
                    ) : null}
                    {tab === "google" ? (
                        <AuraGoogleAdsTab
                            google={data.google}
                            googlePrev={data.googlePrev}
                            comparable={!data.failed}
                            configured={data.googleConfigured}
                            spend={yearData.spend}
                        />
                    ) : null}
                    {tab === "meta" ? (
                        <p className="apex-ppc-chart-note">The Meta section is coming next.</p>
                    ) : null}
                    {isAdmin && yearData.errors.length > 0 ? (
                        <p className="apex-ppc-chart-note aura-admin-note">Admin only. {yearData.errors.join("; ")}</p>
                    ) : null}
                </>
            )}
        </div>
    );
}
