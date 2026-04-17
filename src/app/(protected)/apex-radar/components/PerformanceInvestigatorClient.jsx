"use client";

import React, { useEffect, useMemo, useState } from "react";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import { APEX_RADAR_CHANNEL_FACEBOOK, APEX_RADAR_CHANNEL_META } from "@/lib/apexRadarChannels";
import { buildPiFunnelFromAggregates } from "@/lib/apexRadarPerformanceInvestigatorFacebook";
import { useCustomers } from "@/hooks/useCustomers";
import PerformanceInvestigatorMonthlyTables from "./PerformanceInvestigatorMonthlyTables";
import PerformanceInvestigatorFunnel from "./PerformanceInvestigatorFunnel";

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
    const isFacebook = channel === APEX_RADAR_CHANNEL_FACEBOOK;

    const customer = useMemo(
        () => (customerId ? customers.find((c) => String(c._id) === String(customerId)) : null),
        [customers, customerId]
    );

    const yyyy = new Date().getUTCFullYear();
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const isFirstOfMonth = today.getDate() === 1;
    const defaultStart = `${yyyy}-${mm}-01`;
    const defaultEnd = isFirstOfMonth
        ? `${yyyy}-${mm}-01`
        : `${yyyy}-${mm}-${String(today.getDate() - 1).padStart(2, "0")}`;

    const [tempDateRange, setTempDateRange] = useState({
        startDate: defaultStart,
        endDate: defaultEnd,
    });
    const [appliedDateRange, setAppliedDateRange] = useState({
        startDate: defaultStart,
        endDate: defaultEnd,
    });

    const [piPayload, setPiPayload] = useState(null);
    const [piLoading, setPiLoading] = useState(false);
    const [piError, setPiError] = useState(null);

    useEffect(() => {
        if (!isFacebook || !customerId) return undefined;

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
                const res = await fetch(`/api/apex-radar/facebook/performance-investigator?${params.toString()}`);
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
    }, [isFacebook, customerId, yyyy, appliedDateRange.startDate, appliedDateRange.endDate]);

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
        <div id="ApexRadarPerformanceInvestigatorPage" className="w-full max-w-[1920px] mx-auto">
            <DashboardHeading
                title="Performance Investigator"
                label={headingLabel}
                showAnalyzeWithAi={false}
                showPdfExport={false}
                dateRange={appliedDateRange}
                loading={isFacebook && piLoading}
                right={
                    <DateRangePicker
                        onApply={({ startDate, endDate }) =>
                            setAppliedDateRange({ startDate, endDate })
                        }
                        startDate={tempDateRange.startDate}
                        endDate={tempDateRange.endDate}
                        onStartDateChange={(v) => setTempDateRange((d) => ({ ...d, startDate: v }))}
                        onEndDateChange={(v) => setTempDateRange((d) => ({ ...d, endDate: v }))}
                    />
                }
            />

            <div className="space-y-10">
                {!isFacebook ? (
                    <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-600">
                        Performance investigator API is only available for Facebook (PS) today. Google Ads support will
                        mirror this view when data is wired.
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
