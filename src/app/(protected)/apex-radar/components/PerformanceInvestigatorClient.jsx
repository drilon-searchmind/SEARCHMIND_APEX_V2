"use client";

import React, { useEffect, useMemo, useState } from "react";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import { getApexRadarLast30DaysRange } from "@/lib/apexRadarDateRange";
import { APEX_RADAR_CHANNEL_FACEBOOK, APEX_RADAR_CHANNEL_GOOGLE_ADS, APEX_RADAR_CHANNEL_META } from "@/lib/apexRadarChannels";
import { buildPiFunnelFromAggregates } from "@/lib/apexRadarPerformanceInvestigatorFacebook";
import { useCustomers } from "@/hooks/useCustomers";
import PerformanceInvestigatorMonthlyTables from "./PerformanceInvestigatorMonthlyTables";
import PerformanceInvestigatorFunnel from "./PerformanceInvestigatorFunnel";
import PerformanceInvestigatorCopyToSlides from "./PerformanceInvestigatorCopyToSlides";

const ZERO_METRICS = {
    impr: 0,
    clicks: 0,
    cost: 0,
    conv: 0,
    convValue: 0,
    ctr: 0,
    convRate: 0,
    avgCpc: 0,
    freq: 0,
    aov: 0,
};

export default function PerformanceInvestigatorClient({ channel, customerId }) {
    const { customers } = useCustomers();
    const meta = APEX_RADAR_CHANNEL_META[channel];
    const supportsPerformanceInvestigator =
        channel === APEX_RADAR_CHANNEL_FACEBOOK || channel === APEX_RADAR_CHANNEL_GOOGLE_ADS;

    const customer = useMemo(
        () => (customerId ? customers.find((c) => String(c._id) === String(customerId)) : null),
        [customers, customerId]
    );

    const yyyy = new Date().getUTCFullYear();
    const appliedDateRange = useMemo(() => getApexRadarLast30DaysRange(), []);

    const [piPayload, setPiPayload] = useState(null);
    const [piLoading, setPiLoading] = useState(false);
    const [piError, setPiError] = useState(null);

    useEffect(() => {
        if (!supportsPerformanceInvestigator || !customerId) return undefined;

        const apiBase =
            channel === APEX_RADAR_CHANNEL_FACEBOOK
                ? "/api/apex-radar/facebook/performance-investigator"
                : "/api/apex-radar/google-ads/performance-investigator";

        let cancelled = false;
        (async () => {
            setPiLoading(true);
            setPiError(null);
            try {
                const params = new URLSearchParams({
                    customerId: String(customerId),
                    currentYear: String(yyyy),
                    funnelStartDate: appliedDateRange.startDate,
                    funnelEndDate: appliedDateRange.endDate,
                });
                const res = await fetch(`${apiBase}?${params.toString()}`);
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    throw new Error(data.error || "Failed to load performance investigator");
                }
                if (!cancelled) setPiPayload(data);
            } catch (e) {
                if (!cancelled) {
                    setPiError(e?.message || "Failed to load");
                    setPiPayload(null);
                }
            } finally {
                if (!cancelled) setPiLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [supportsPerformanceInvestigator, channel, customerId, yyyy, appliedDateRange.startDate, appliedDateRange.endDate]);

    const headingLabel = useMemo(() => {
        if (!meta) return "Portfolio";
        if (customerId && customer?.customerName) {
            return `${meta.label}, ${customer.customerName}`;
        }
        if (customerId && !customer) {
            return `${meta.label}, Property`;
        }
        return meta.label;
    }, [meta, customerId, customer]);

    const compareHint = useMemo(() => {
        const fr = piPayload?.funnelRange;
        if (!fr?.compareStart || !fr?.compareEnd) return null;
        return `Selected ${fr.startDate}–${fr.endDate} vs ${fr.compareStart}–${fr.compareEnd}.`;
    }, [piPayload?.funnelRange]);

    const funnelForUi = useMemo(() => {
        if (piError) return buildPiFunnelFromAggregates(ZERO_METRICS, ZERO_METRICS);
        if (piPayload?.funnel) return piPayload.funnel;
        return null;
    }, [piError, piPayload?.funnel]);

    return (
        <div id="ApexRadarPerformanceInvestigatorPage" className="w-full max-w-[min(100%,1920px)] mx-auto px-2 sm:px-4 lg:px-6">
            <DashboardHeading
                title="Performance Investigator"
                label={headingLabel}
                showAnalyzeWithAi={false}
                showPdfExport={false}
                dateRange={appliedDateRange}
                loading={supportsPerformanceInvestigator && piLoading}
                right={
                    supportsPerformanceInvestigator ? (
                        <PerformanceInvestigatorCopyToSlides
                            disabled={piLoading || !!piError}
                            headingLabel={headingLabel}
                            currentYear={piPayload?.currentYear ?? yyyy}
                            previousYear={piPayload?.previousYear ?? yyyy - 1}
                            currentYearRows={piPayload?.currentYearRows ?? []}
                            previousYearRows={piPayload?.previousYearRows ?? []}
                            diffRows={piPayload?.diffRows}
                            funnel={funnelForUi}
                            funnelRange={piPayload?.funnelRange}
                            compareHint={compareHint}
                        />
                    ) : null
                }
            />

            <div className="space-y-10">
                {!supportsPerformanceInvestigator ? (
                    <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-600">
                        Performance investigator is only available for Facebook (PS) or Google Ads.
                    </div>
                ) : (
                    <>
                        <PerformanceInvestigatorMonthlyTables
                            currentYear={piPayload?.currentYear ?? yyyy}
                            previousYear={piPayload?.previousYear ?? yyyy - 1}
                            currentYearRows={piPayload?.currentYearRows ?? []}
                            previousYearRows={piPayload?.previousYearRows ?? []}
                            diffRows={piPayload?.diffRows}
                            loading={piLoading}
                            error={piError}
                        />
                        <PerformanceInvestigatorFunnel
                            funnel={funnelForUi}
                            loading={piLoading}
                            compareHint={compareHint}
                        />
                    </>
                )}
            </div>
        </div>
    );
}
