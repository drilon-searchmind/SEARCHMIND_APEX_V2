"use client";

import React, { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { FiBarChart2, FiRepeat, FiSend } from "react-icons/fi";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import CobaltLoader from "@/components/ui/CobaltLoader";
import { ServiceTabs } from "@/components/dashboard/ServiceParts";
import { useCustomers } from "@/hooks/useCustomers";
import { isDemoCustomerId } from "@/lib/demoCustomer";
import { pushDashboardDateRangeApplied } from "@root/lib/gtmFunctions";
import { useDashboardDateRange } from "@/hooks/useDashboardDateRange";
import { useEmDashboardData } from "./components/useEmDashboardData";
import EmOverviewTab from "./components/EmOverviewTab";
import EmCampaignsTab from "./components/EmCampaignsTab";
import EmFlowsTab from "./components/EmFlowsTab";
import "./em-dashboard.css";

const TABS = [
    { id: "overview", label: "Overview", icon: FiBarChart2 },
    { id: "campaigns", label: "Campaigns", icon: FiSend },
    { id: "flows", label: "Flows", icon: FiRepeat },
];

function normalizeTab(tab) {
    return TABS.some((t) => t.id === tab) ? tab : "overview";
}

export default function EmailDashboardPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const rangeStartQ = searchParams.get("startDate");
    const rangeEndQ = searchParams.get("endDate");
    const { customers } = useCustomers();
    const customerId = params?.customerId;
    const customer = customers.find((c) => c._id === customerId);

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
                page: "service_dashboard_em",
                customerId,
                startDate,
                endDate,
                comparisonMethod: appliedComparison,
            });
        },
    });

    const hasKlaviyoCredentials = !!customer?.CustomerSettings?.klaviyoPrivateApiKey || isDemoCustomerId(String(customerId));

    const data = useEmDashboardData({
        customerId: customer ? customerId : null,
        enabled: hasKlaviyoCredentials,
        appliedRange,
        appliedCompareRange,
        comparisonMethod,
    });
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

    if (!customerId) return null;

    const tabProps = { data, appliedRange, comparisonMethod, comparisonLabel, onLedeChange: setLede };
    const headingLoading = loading || data.flowsLoading || data.dailyLoading || data.prevLoading;

    return (
        <div id="EmDashboardPage" className="apex-perf w-full">
            {!hasKlaviyoCredentials && customer ? (
                <div className="apex-sx-alert">
                    Configure your Klaviyo Private API Key in <a href={`/dashboard/${customerId}/config`}>Property Settings → Email (Klaviyo)</a> to enable email metrics.
                </div>
            ) : null}

            <DashboardHeading
                variant="cobalt"
                showRunAudit={false}
                title="Email"
                subtitle={loading || error ? null : lede}
                label={customer ? customer.customerName : ""}
                customerId={customerId}
                dateRange={appliedRange}
                comparisonMethod={comparisonMethod}
                loading={headingLoading}
                dashboardType="em-dashboard"
                dataSnapshot={{
                    campaignTotals: data.campaignTotals,
                    flowTotals: data.flowTotals,
                    topCampaigns: data.topCampaigns,
                    topFlows: data.topFlows,
                    activeTab,
                }}
                right={<DateRangePicker {...dateRangePickerProps} variant="cobalt" loading={headingLoading} />}
            />

            <ServiceTabs tabs={TABS} active={activeTab} onChange={setActiveTab} label="Email views" />

            <div className="apex-em-panel">
                {!hasKlaviyoCredentials ? null : loading ? (
                    <div className="apex-perf-loading">
                        <CobaltLoader variant="block" title="Loading email metrics" request="GET /api/klaviyo-dashboard?part=summary" />
                    </div>
                ) : error ? (
                    <div className="apex-sx-error">{error}</div>
                ) : (
                    <>
                        {activeTab === "overview" && <EmOverviewTab {...tabProps} onGoTo={setActiveTab} />}
                        {activeTab === "campaigns" && <EmCampaignsTab {...tabProps} />}
                        {activeTab === "flows" && <EmFlowsTab {...tabProps} />}
                    </>
                )}
            </div>
        </div>
    );
}
