"use client";

import React, { useMemo, useState } from "react";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import { APEX_RADAR_CHANNEL_META } from "@/lib/apexRadarChannels";
import { useCustomers } from "@/hooks/useCustomers";
import PerformanceInvestigatorMonthlyTables from "./PerformanceInvestigatorMonthlyTables";
import PerformanceInvestigatorFunnel from "./PerformanceInvestigatorFunnel";

export default function PerformanceInvestigatorClient({ channel, customerId }) {
    const { customers } = useCustomers();
    const meta = APEX_RADAR_CHANNEL_META[channel];

    const customer = useMemo(
        () => (customerId ? customers.find((c) => String(c._id) === String(customerId)) : null),
        [customers, customerId]
    );

    const today = new Date();
    const yyyy = today.getFullYear();
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

    return (
        <div id="ApexRadarPerformanceInvestigatorPage" className="w-full max-w-[1920px] mx-auto">
            <DashboardHeading
                title="Performance Investigator"
                label={headingLabel}
                showAnalyzeWithAi={false}
                showPdfExport={false}
                dateRange={appliedDateRange}
                loading={false}
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
                <PerformanceInvestigatorMonthlyTables currentYear={yyyy} previousYear={yyyy - 1} />
                <PerformanceInvestigatorFunnel />
            </div>
        </div>
    );
}
