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
import PpcOverviewTab from "../ppc/components/PpcOverviewTab";
import PpcCampaignsTab from "../ppc/components/PpcCampaignsTab";
import PpcTermsTab from "../ppc/components/PpcTermsTab";
import { useBingDashboardData } from "./components/useBingDashboardData";
import BingSegments from "./components/BingSegments";
import "./bing-dashboard.css";

const TABS = [
    { id: "overview", label: "Overview", icon: FiBarChart2 },
    { id: "campaigns", label: "Campaigns", icon: FiLayers },
    { id: "terms", label: "Search terms", icon: FiSearch },
];

function normalizeTab(tab) {
    return TABS.some((t) => t.id === tab) ? tab : "overview";
}

export default function BingAdsServiceDashboardPage() {
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
                page: "service_dashboard_bing",
                customerId: params.customerId,
                startDate,
                endDate,
                comparisonMethod: appliedComparison,
            });
        },
    });

    const data = useBingDashboardData({ customer, appliedRange, appliedCompareRange, comparisonMethod });
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

    const hasData = data.metrics.length > 0;
    const hasSpend = data.metrics.some((r) => r.ad_spend > 0);
    const tabProps = { data, appliedRange, comparisonMethod, comparisonLabel, onLedeChange: setLede };
    const warning = (part) => data.warnings.find((w) => w.part === part)?.message;

    return (
        <div id="BingDashboardPage" className="apex-perf w-full">
            <DashboardHeading
                variant="cobalt"
                showRunAudit={false}
                title="Microsoft Ads"
                subtitle={loading || error || notConnected ? null : lede}
                label={customer ? customer.customerName : ""}
                customerId={params.customerId}
                dateRange={appliedRange}
                comparisonMethod={comparisonMethod}
                loading={loading}
                dashboardType="bing-dashboard"
                dataSnapshot={{ metricsByDate: data.metrics, topCampaigns: data.campaigns, searchTerms: data.searchTerms, activeTab }}
                right={<DateRangePicker {...dateRangePickerProps} variant="cobalt" loading={loading} />}
            />

            {notConnected ? null : <ServiceTabs tabs={TABS} active={activeTab} onChange={setActiveTab} label="Microsoft Ads views" />}

            <div className="apex-bing-panel">
                {loading ? (
                    <div className="apex-perf-loading">
                        <CobaltLoader variant="block" title="Loading Microsoft Ads metrics" request="GET /api/bing-dashboard" />
                    </div>
                ) : notConnected ? (
                    <div className="apex-sx-alert">
                        Microsoft Ads is not connected for this property. Add the Microsoft Advertising Account ID and Customer ID in <a href={`/dashboard/${params.customerId}/config`}>Property Settings</a> to see results here.
                    </div>
                ) : error ? (
                    <div className="apex-sx-error">{error}</div>
                ) : !hasData || !hasSpend ? (
                    <div className="apex-sx-alert">No Microsoft Ads spend in this period.</div>
                ) : (
                    <>
                        {activeTab === "overview" && (
                            <PpcOverviewTab
                                {...tabProps}
                                platform="Microsoft Ads"
                                impressionShare={data.impressionShare}
                                extra={<BingSegments deviceSplit={data.deviceSplit} networkSplit={data.networkSplit} />}
                                onGoTo={setActiveTab}
                            />
                        )}
                        {activeTab === "campaigns" && <PpcCampaignsTab {...tabProps} />}
                        {activeTab === "terms" &&
                            (data.searchTerms.length > 0 ? (
                                <PpcTermsTab {...tabProps} />
                            ) : (
                                <div className="apex-sx-alert">
                                    Microsoft Advertising returned no search query data for this period.
                                    {warning("search_terms") ? ` The search query report failed: ${warning("search_terms")}` : ""}
                                </div>
                            ))}
                    </>
                )}
            </div>
        </div>
    );
}
