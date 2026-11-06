"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { FiArrowDown, FiArrowUp } from "react-icons/fi";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import CobaltLoader from "@/components/ui/CobaltLoader";
import { useCustomers } from "@/hooks/useCustomers";
import { useUser } from "@/contexts/UserContext";
import { useDashboardDateRange } from "@/hooks/useDashboardDateRange";
import { formatComparisonPeriodDates } from "@/lib/dateRangeComparison";
import { isValidIntegrationId } from "@/lib/customerServiceIntegrations";
import { cac, googleAdsBlock, metaBlock, totalCost } from "./auraSheetLogic";
import "../../service-dashboard/ppc/ppc-dashboard.css";
import "./aura-dashboard.css";

const sumValues = (rows) => (rows || []).reduce((sum, r) => sum + (Number(r?.value) || 0), 0);

const nf0 = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat("da-DK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Percent change vs the comparison period, null when it cannot be computed. */
function pctChange(current, prev) {
    if (current == null || prev == null || prev === 0) return null;
    return ((current - prev) / Math.abs(prev)) * 100;
}

/**
 * One KPI in the hero. `lowerIsBetter` flips the colour (cost and CAC falling is good).
 * `value === null` renders the "Not connected" state.
 */
function HeroKpi({ label, value, change, lowerIsBetter = false, note }) {
    const hasChange = change != null && Number.isFinite(change);
    const good = hasChange && (lowerIsBetter ? change < 0 : change > 0);
    const bad = hasChange && (lowerIsBetter ? change > 0 : change < 0);
    return (
        <div className="aura-hero__kpi">
            <span className="aura-hero__label">{label}</span>
            {value == null ? (
                <>
                    <span className="aura-hero__value aura-hero__value--empty">Not connected</span>
                    {note ? <span className="aura-hero__note">{note}</span> : null}
                </>
            ) : (
                <>
                    <span className="aura-hero__value">{value}</span>
                    {hasChange ? (
                        <span className={`aura-hero__change${good ? " is-good" : ""}${bad ? " is-bad" : ""}`}>
                            {change < 0 ? <FiArrowDown aria-hidden="true" /> : <FiArrowUp aria-hidden="true" />}
                            {`${nf2.format(change)}%`}
                        </span>
                    ) : (
                        <span className="aura-hero__change">No comparison</span>
                    )}
                </>
            )}
        </div>
    );
}

export default function AuraPerformanceDashboard() {
    const params = useParams();
    const { customers } = useCustomers();
    const user = useUser();
    const isAdmin = user?.isAdmin === true;
    const customer = customers.find((c) => c._id === params.customerId);

    const { appliedDateRange: appliedRange, appliedCompareRange, comparisonMethod, dateRangePickerProps } =
        useDashboardDateRange();

    const [data, setData] = useState({ google: [], googlePrev: [], meta: [], metaPrev: [], sheet: null, sheetPrev: null, notes: [], failed: false });
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
                let failed = false;

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

                const safe = async (fn, label) => {
                    try {
                        return await fn();
                    } catch (e) {
                        failed = true;
                        notes.push(`${label}: ${e.message}`);
                        return null;
                    }
                };
                const googleOk = isValidIntegrationId(googleAdsCustomerId);
                const metaOk = isValidIntegrationId(facebookAdAccountId);
                if (!googleOk) notes.push("Google Ads: no valid customer ID in Config");
                if (!metaOk) notes.push("Meta: no valid ad account ID in Config");

                const sheetUrl = (range) =>
                    `/api/custom-dashboards/aura/sheet-data?${new URLSearchParams({
                        customerId: String(customer._id),
                        startDate: range.startDate,
                        endDate: range.endDate,
                    }).toString()}`;

                const [g, gp, m, mp, sh, shp] = await Promise.all([
                    googleOk ? safe(() => fetchJson(googleUrl(appliedRange)), "Google Ads") : null,
                    googleOk && hasComp ? safe(() => fetchJson(googleUrl(comp)), "Google Ads (comparison)") : null,
                    metaOk ? safe(() => fetchJson(metaUrl(appliedRange)), "Meta") : null,
                    metaOk && hasComp ? safe(() => fetchJson(metaUrl(comp)), "Meta (comparison)") : null,
                    safe(() => fetchJson(sheetUrl(appliedRange)), "Aura sheet"),
                    hasComp ? safe(() => fetchJson(sheetUrl(comp)), "Aura sheet (comparison)") : null,
                ]);
                if (cancelled) return;
                setData({
                    google: g?.metrics_by_date || [],
                    googlePrev: gp?.metrics_by_date || [],
                    meta: m?.metrics_by_date || [],
                    metaPrev: mp?.metrics_by_date || [],
                    sheet: sh,
                    sheetPrev: shp,
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
    }, [customer, appliedRange, appliedCompareRange, comparisonMethod, fetchJson]);

    const kpis = useMemo(() => {
        const g = googleAdsBlock(data.google);
        const m = metaBlock(data.meta);
        // Cost = Google Ads + Meta + "Other" (campaign budgets in the Aura sheet), as in the old dashboard.
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
                    <section className="aura-hero" aria-label="Key figures">
                        <HeroKpi
                            label="Conversions"
                            value={kpis.customers == null ? null : nf0.format(kpis.customers)}
                            change={kpis.customersChange}
                            note="Aura sheet could not be read"
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
                </>
            )}
        </div>
    );
}
