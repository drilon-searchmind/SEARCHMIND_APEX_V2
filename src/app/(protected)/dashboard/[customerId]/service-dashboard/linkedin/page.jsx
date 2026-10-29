"use client";

import React, { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { FiBarChart2, FiImage, FiLayers, FiUsers } from "react-icons/fi";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import CobaltLoader from "@/components/ui/CobaltLoader";
import { ServiceTabs } from "@/components/dashboard/ServiceParts";
import { useCustomers } from "@/hooks/useCustomers";
import { pushDashboardDateRangeApplied } from "@root/lib/gtmFunctions";
import { useDashboardDateRange } from "@/hooks/useDashboardDateRange";
import { useLiDashboardData } from "./components/useLiDashboardData";
import LiOverviewTab from "./components/LiOverviewTab";
import LiAudienceTab from "./components/LiAudienceTab";
import LiCampaignsTab from "./components/LiCampaignsTab";
import LiCreativesTab from "./components/LiCreativesTab";
import "./linkedin-dashboard.css";

const TABS = [
    { id: "overview", label: "Overview", icon: FiBarChart2 },
    { id: "audience", label: "Audience", icon: FiUsers },
    { id: "campaigns", label: "Campaigns", icon: FiLayers },
    { id: "creatives", label: "Ads", icon: FiImage },
];

function normalizeTab(tab) {
    return TABS.some((t) => t.id === tab) ? tab : "overview";
}

export default function LinkedInServiceDashboardPage() {
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
                page: "service_dashboard_linkedin",
                customerId: params.customerId,
                startDate,
                endDate,
                comparisonMethod: appliedComparison,
            });
        },
    });

    const data = useLiDashboardData({ customer, appliedRange, appliedCompareRange, comparisonMethod });
    const { loading, error, notConnected } = data;

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

    const hasData = data.metrics.length > 0 && data.metrics.some((r) => r.ad_spend > 0);
    const tabProps = { data, appliedRange, comparisonMethod, comparisonLabel, onLedeChange: setLede };

    return (
        <div id="LinkedinDashboardPage" className="apex-perf w-full">
            <DashboardHeading
                variant="cobalt"
                showRunAudit={false}
                title="LinkedIn Ads"
                subtitle={loading || error || notConnected ? null : lede}
                label={customer ? customer.customerName : ""}
                customerId={params.customerId}
                dateRange={appliedRange}
                comparisonMethod={comparisonMethod}
                loading={loading}
                dashboardType="linkedin-dashboard"
                dataSnapshot={{ metricsByDate: data.metrics, topCampaigns: data.campaigns, topAds: data.ads, demographics: data.demographics, activeTab }}
                right={<DateRangePicker {...dateRangePickerProps} variant="cobalt" loading={loading} />}
            />

            {notConnected ? null : <ServiceTabs tabs={TABS} active={activeTab} onChange={setActiveTab} label="LinkedIn views" />}

            <div className="apex-li-panel">
                {loading ? (
                    <div className="apex-perf-loading">
                        <CobaltLoader variant="block" title="Loading LinkedIn metrics" request="GET /api/linkedin-dashboard" />
                    </div>
                ) : notConnected ? (
                    <div className="apex-sx-alert">
                        LinkedIn Ads is not connected for this property. Add the LinkedIn ad account ID in <a href={`/dashboard/${params.customerId}/config`}>Property Settings</a> to see results here.
                    </div>
                ) : error ? (
                    <div className="apex-sx-error">{error}</div>
                ) : !hasData ? (
                    <div className="apex-sx-alert">No LinkedIn Ads spend in this period.</div>
                ) : (
                    <>
                        {activeTab === "overview" && <LiOverviewTab {...tabProps} onGoTo={setActiveTab} />}
                        {activeTab === "audience" && <LiAudienceTab {...tabProps} />}
                        {activeTab === "campaigns" && <LiCampaignsTab {...tabProps} />}
                        {activeTab === "creatives" && <LiCreativesTab {...tabProps} />}
                    </>
                )}
            </div>
        </div>
    );
}
