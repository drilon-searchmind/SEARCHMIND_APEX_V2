"use client";

import React, { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { FiBarChart2, FiLayers, FiSearch } from "react-icons/fi";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import CobaltLoader from "@/components/ui/CobaltLoader";
import { ServiceTabs } from "@/components/dashboard/ServiceParts";
import { useCustomers } from "@/hooks/useCustomers";
import { pushDashboardDateRangeApplied } from "@root/lib/gtmFunctions";
import { useDashboardDateRange } from "@/hooks/useDashboardDateRange";
import { usePpcDashboardData } from "./components/usePpcDashboardData";
import PpcOverviewTab from "./components/PpcOverviewTab";
import PpcCampaignsTab from "./components/PpcCampaignsTab";
import PpcTermsTab from "./components/PpcTermsTab";
import "./ppc-dashboard.css";

const TABS = [
    { id: "overview", label: "Overview", icon: FiBarChart2 },
    { id: "campaigns", label: "Campaigns", icon: FiLayers },
    { id: "terms", label: "Search terms", icon: FiSearch },
];

function normalizeTab(tab) {
    return TABS.some((t) => t.id === tab) ? tab : "overview";
}

export default function GoogleAdsPPCPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const rangeStartQ = searchParams.get("startDate");
    const rangeEndQ = searchParams.get("endDate");
    const { customers } = useCustomers();
    const customer = customers.find((c) => c._id === params.customerId);

    const activeTab = normalizeTab(searchParams.get("tab"));
    const [lede, setLede] = useState(null);

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

    const data = usePpcDashboardData({ customer, appliedRange, appliedCompareRange, comparisonMethod });
    const { loading, error } = data;

    const setActiveTab = (tab) => {
        const normalized = normalizeTab(tab);
        setLede(null);
        const url = new URL(window.location.href);
        url.searchParams.set("tab", normalized);
        router.replace(url.pathname + url.search, { scroll: false });
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    useEffect(() => {
        if (rangeStartQ && rangeEndQ) {
            setTempRange({ startDate: rangeStartQ, endDate: rangeEndQ });
            setAppliedRange({ startDate: rangeStartQ, endDate: rangeEndQ });
        }
    }, [rangeStartQ, rangeEndQ, setTempRange, setAppliedRange]);

    const hasData = data.metrics.length > 0;
    const tabProps = {
        data,
        appliedRange,
        comparisonMethod,
        comparisonLabel,
        onLedeChange: setLede,
    };

    return (
        <div id="PpcDashboardPage" className="apex-perf w-full">
            <DashboardHeading
                variant="cobalt"
                showRunAudit={false}
                title="Paid Search"
                subtitle={loading || error ? null : lede}
                label={customer ? customer.customerName : ""}
                customerId={params.customerId}
                dateRange={appliedRange}
                comparisonMethod={comparisonMethod}
                loading={loading}
                dashboardType="ppc-dashboard"
                dataSnapshot={{
                    metricsByDate: data.metrics,
                    campaignsPerformance: data.campaigns,
                    searchTerms: data.searchTerms,
                    activeTab,
                }}
                right={<DateRangePicker {...dateRangePickerProps} variant="cobalt" loading={loading} />}
            />

            <ServiceTabs tabs={TABS} active={activeTab} onChange={setActiveTab} label="Paid search views" />

            <div className="apex-px-panel">
                {loading ? (
                    <div className="apex-perf-loading">
                        <CobaltLoader variant="block" title="Loading PPC metrics" request="GET /api/google-ppc-dashboard" />
                    </div>
                ) : error ? (
                    <div className="apex-sx-error">{error}</div>
                ) : !hasData ? (
                    <div className="apex-sx-alert">No Google Ads data for this period.</div>
                ) : (
                    <>
                        {activeTab === "overview" && <PpcOverviewTab {...tabProps} onGoTo={setActiveTab} />}
                        {activeTab === "campaigns" && <PpcCampaignsTab {...tabProps} />}
                        {activeTab === "terms" && <PpcTermsTab {...tabProps} />}
                    </>
                )}
            </div>
        </div>
    );
}
