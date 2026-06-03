"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import { FiBarChart2, FiLayers } from "react-icons/fi";
import { pushDashboardDateRangeApplied } from "@root/lib/gtmFunctions";
import { useDashboardDateRange } from "@/hooks/useDashboardDateRange";
import SeoDefaultTab from "./components/SeoDefaultTab";
import SeoInsightsTab from "./components/SeoInsightsTab";

const TABS = [
    { id: "default", label: "Default", icon: FiBarChart2 },
    { id: "insights", label: "Organic insights", icon: FiLayers },
];

const TAB_IDS = [...TABS.map((t) => t.id), "volume-potential"];

function normalizeTab(tab) {
    if (tab === "volume-potential") return "insights";
    return TAB_IDS.includes(tab) ? tab : "default";
}

export default function SEODashboardPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const rangeStartQ = searchParams.get("startDate");
    const rangeEndQ = searchParams.get("endDate");
    const tabFromUrl = searchParams.get("tab");
    const customerId = params.customerId;

    const [activeTab, setActiveTabState] = useState(() => normalizeTab(tabFromUrl));
    const [siteUrl, setSiteUrl] = useState("");
    const [defaultLoading, setDefaultLoading] = useState(false);

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
                page: "service_dashboard_seo",
                customerId,
                startDate,
                endDate,
                comparisonMethod: appliedComparison,
            });
        },
    });

    const setActiveTab = (tab) => {
        const normalized = normalizeTab(tab);
        setActiveTabState(normalized);
        const url = new URL(window.location.href);
        url.searchParams.set("tab", normalized);
        router.replace(url.pathname + url.search, { scroll: false });
    };

    useEffect(() => {
        const t = searchParams.get("tab");
        if (t) setActiveTabState(normalizeTab(t));
    }, [searchParams]);

    useEffect(() => {
        if (rangeStartQ && rangeEndQ) {
            setTempRange({ startDate: rangeStartQ, endDate: rangeEndQ });
            setAppliedRange({ startDate: rangeStartQ, endDate: rangeEndQ });
        }
    }, [rangeStartQ, rangeEndQ, setTempRange, setAppliedRange]);

    useEffect(() => {
        async function fetchCustomer() {
            if (!customerId) return;
            try {
                const res = await fetch(`/api/customers/${customerId}`);
                if (!res.ok) throw new Error("Failed to fetch customer");
                const customer = await res.json();
                setSiteUrl(customer?.CustomerSettings?.googleSearchConsoleProperty || "");
            } catch {
                setSiteUrl("");
            }
        }
        fetchCustomer();
    }, [customerId]);

    const handleDefaultLoadingChange = useCallback((loading) => {
        setDefaultLoading(loading);
    }, []);

    const headingLoading = activeTab === "default" && defaultLoading;

    return (
        <div className="mx-auto w-full">
            <DashboardHeading
                title="SEO Dashboard"
                label={siteUrl || "No property set"}
                customerId={customerId}
                dateRange={appliedRange}
                comparisonMethod={comparisonMethod}
                loading={headingLoading}
                dashboardType="seo-dashboard"
                dataSnapshot={{ siteUrl, activeTab }}
                right={<DateRangePicker {...dateRangePickerProps} loading={headingLoading} />}
            />

            <div className="bg-white rounded-lg border border-gray-200 mb-6">
                <div className="flex gap-8 px-6">
                    {TABS.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                                    activeTab === tab.id
                                        ? "border-[var(--color-primary-searchmind)] text-[var(--color-primary-searchmind)]"
                                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                                }`}
                            >
                                <Icon className="text-base" aria-hidden />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {activeTab === "default" && (
                <SeoDefaultTab
                    active
                    siteUrl={siteUrl}
                    customerId={customerId}
                    appliedRange={appliedRange}
                    appliedCompareRange={appliedCompareRange}
                    comparisonMethod={comparisonMethod}
                    comparisonLabel={comparisonLabel}
                    onLoadingChange={handleDefaultLoadingChange}
                />
            )}

            {activeTab === "insights" && (
                <SeoInsightsTab
                    siteUrl={siteUrl}
                    customerId={customerId}
                    startDate={appliedRange.startDate}
                    endDate={appliedRange.endDate}
                    appliedCompareRange={appliedCompareRange}
                    comparisonMethod={comparisonMethod}
                />
            )}
        </div>
    );
}
