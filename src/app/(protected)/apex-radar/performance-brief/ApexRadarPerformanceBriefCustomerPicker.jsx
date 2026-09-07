"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { FiAlertTriangle, FiSearch } from "react-icons/fi";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import CobaltLoader from "@/components/ui/CobaltLoader";
import { useCustomers } from "@/hooks/useCustomers";
import { useUser } from "@/contexts/UserContext";
import { getDemoCustomerIds } from "@/lib/demoCustomerId";
import { apexRadarPerformanceBriefHref } from "@/lib/apexRadarChannels";
import {
    PERFORMANCE_BRIEF_CONFIG_WARNING_TITLE,
    PERFORMANCE_BRIEF_PLATFORM_LABELS,
    PERFORMANCE_BRIEF_PLATFORM_WARNING_KEYS,
    PERFORMANCE_BRIEF_PLATFORMS,
} from "@/lib/performanceBriefConstants";
import { getServiceDashboardConfigWarnings } from "@/lib/customerServiceIntegrations";

const PICKER_SHORT_LABELS = {
    meta: "Meta",
    "google-ads": "GAds",
};

export default function ApexRadarPerformanceBriefCustomerPicker() {
    const { customers, loading } = useCustomers();
    const user = useUser();
    const [customerSearch, setCustomerSearch] = useState("");

    const accessibleCustomers = useMemo(() => {
        let list = customers;
        if (user?.isExternal) {
            const sharedCustomerIds = (user.sharedCustomers || []).map((id) =>
                typeof id === "object" && id.$oid ? id.$oid : String(id)
            );
            list = customers.filter((c) => sharedCustomerIds.includes(String(c._id)));
            const demoIds = getDemoCustomerIds();
            for (const demoId of demoIds) {
                const demoRow = customers.find((c) => String(c._id) === demoId);
                if (demoRow && !list.some((c) => String(c._id) === demoId)) {
                    list = [...list, demoRow];
                }
            }
        }
        return [...list].sort((a, b) =>
            String(a.customerName || "").localeCompare(String(b.customerName || ""), undefined, {
                sensitivity: "base",
            })
        );
    }, [customers, user]);

    const filteredCustomers = useMemo(() => {
        const q = customerSearch.trim().toLowerCase();
        if (!q) return accessibleCustomers;
        return accessibleCustomers.filter((c) =>
            String(c.customerName || "")
                .toLowerCase()
                .includes(q)
        );
    }, [accessibleCustomers, customerSearch]);

    return (
        <div className="apex-radar-stack">
            <DashboardHeading
                variant="cobalt"
                showRunAudit={false}
                title="Performance Brief"
                label="Select a customer"
                showAnalyzeWithAi={false}
                showPdfExport={false}
            />

            <section className="apex-radar-panel apex-radar-panel--padded apex-radar-cs-picker">
                <h1 className="apex-radar-section__title">Choose a property</h1>
                <p className="apex-radar-section__subtitle">
                    Weekly Meta + Google Ads brief, analyzed by Claude and ready to post to a Slack
                    channel. A warning triangle means that platform is not configured.
                </p>

                {!loading && accessibleCustomers.length > 0 ? (
                    <div className="apex-radar-search-wrap mt-4">
                        <FiSearch className="h-4 w-4" aria-hidden />
                        <input
                            type="search"
                            value={customerSearch}
                            onChange={(e) => setCustomerSearch(e.target.value)}
                            placeholder="Search properties…"
                            autoComplete="off"
                            aria-label="Search properties"
                        />
                    </div>
                ) : null}

                {loading ? (
                    <CobaltLoader variant="block" title="Loading properties" />
                ) : accessibleCustomers.length === 0 ? (
                    <p className="apex-radar-empty py-4">No properties available.</p>
                ) : filteredCustomers.length === 0 ? (
                    <p className="apex-radar-empty py-4">No properties match your search.</p>
                ) : (
                    <ul className="apex-radar-cs-picker__list">
                        {filteredCustomers.map((c) => {
                            const warnings = getServiceDashboardConfigWarnings(c.CustomerSettings);
                            return (
                                <li key={String(c._id)}>
                                    <Link
                                        href={apexRadarPerformanceBriefHref(c._id)}
                                        className="apex-radar-cs-picker__row"
                                    >
                                        <span className="apex-radar-cs-picker__name">
                                            {c.customerName || "Untitled"}
                                        </span>
                                        <span className="apex-radar-cs-picker__services">
                                            {PERFORMANCE_BRIEF_PLATFORMS.map((platformKey) => {
                                                const warningKey =
                                                    PERFORMANCE_BRIEF_PLATFORM_WARNING_KEYS[platformKey];
                                                const missing = Boolean(warnings?.[warningKey]);
                                                const label =
                                                    PICKER_SHORT_LABELS[platformKey] ||
                                                    PERFORMANCE_BRIEF_PLATFORM_LABELS[platformKey];
                                                return (
                                                    <span
                                                        key={platformKey}
                                                        className={`apex-radar-cs-picker__chip${
                                                            missing ? " is-missing" : ""
                                                        }`}
                                                        title={
                                                            missing
                                                                ? `${PERFORMANCE_BRIEF_PLATFORM_LABELS[platformKey]} — ${PERFORMANCE_BRIEF_CONFIG_WARNING_TITLE}`
                                                                : PERFORMANCE_BRIEF_PLATFORM_LABELS[platformKey]
                                                        }
                                                    >
                                                        {missing ? (
                                                            <FiAlertTriangle
                                                                className="apex-radar-cs-picker__warn"
                                                                aria-hidden
                                                            />
                                                        ) : null}
                                                        {label}
                                                    </span>
                                                );
                                            })}
                                        </span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>
        </div>
    );
}
