"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { FiSearch, FiX } from "react-icons/fi";
import CobaltLoader from "@/components/ui/CobaltLoader";
import {
    APEX_RADAR_CHANNEL_FACEBOOK,
    APEX_RADAR_CHANNEL_GOOGLE_ADS,
    APEX_RADAR_CHANNEL_META,
    apexRadarOverviewHref,
    apexRadarPerformanceInvestigatorHref,
} from "@/lib/apexRadarChannels";
import { useCustomers } from "@/hooks/useCustomers";
import { useUser } from "@/contexts/UserContext";
import { getDemoCustomerIds } from "@/lib/demoCustomerId";

export default function ApexRadarPerformanceInvestigatorCustomerModal({ open, onClose, channel }) {
    const router = useRouter();
    const { customers, loading } = useCustomers();
    const user = useUser();
    const [customerSearch, setCustomerSearch] = useState("");
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

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

    useEffect(() => {
        if (!open) setCustomerSearch("");
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e) => {
            if (e.key === "Escape") onClose?.();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    if (!open || !mounted) return null;

    const pickCustomer = (customerId) => {
        if (!channel) return;
        const href = apexRadarPerformanceInvestigatorHref(channel, customerId);
        if (!href) return;
        onClose?.();
        router.push(href);
    };

    const modal = (
        <div className="cobalt-perf" data-theme="cobalt">
            <div
                className="apex-radar-modal-backdrop"
                role="dialog"
                aria-modal="true"
                aria-labelledby="apex-pi-customer-title"
                data-apex-radar-performance-modal="true"
                onMouseDown={(e) => {
                    if (e.target === e.currentTarget) onClose?.();
                }}
            >
            <div className="apex-radar-modal apex-radar-modal--lg max-h-[85vh]">
                <div className="apex-radar-modal__head">
                    <div>
                        <h2 id="apex-pi-customer-title" className="apex-radar-modal__title">
                            Performance Investigator
                        </h2>
                        {!channel ? (
                            <p className="apex-radar-modal__subtitle">
                                Choose Facebook (PS) or Google Ads using the platform switcher at the bottom of the
                                sidebar, then open Performance Investigator again to pick a property.
                            </p>
                        ) : (
                            <p className="apex-radar-modal__subtitle">
                                The investigator is tied to one property. Select a customer to continue —{" "}
                                <strong>{APEX_RADAR_CHANNEL_META[channel]?.label || channel}</strong>.
                            </p>
                        )}
                    </div>
                    <button type="button" onClick={onClose} className="apex-radar-modal__close" aria-label="Close">
                        <FiX className="h-5 w-5" />
                    </button>
                </div>

                {!channel ? (
                    <div className="apex-radar-modal__body space-y-3">
                        <p className="apex-radar-section__subtitle">Or jump to an overview first:</p>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    onClose?.();
                                    router.push(apexRadarOverviewHref(APEX_RADAR_CHANNEL_FACEBOOK));
                                }}
                                className="apex-perf-btn apex-perf-btn--secondary flex-1"
                            >
                                {APEX_RADAR_CHANNEL_META[APEX_RADAR_CHANNEL_FACEBOOK].shortLabel} overview
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    onClose?.();
                                    router.push(apexRadarOverviewHref(APEX_RADAR_CHANNEL_GOOGLE_ADS));
                                }}
                                className="apex-perf-btn apex-perf-btn--secondary flex-1"
                            >
                                {APEX_RADAR_CHANNEL_META[APEX_RADAR_CHANNEL_GOOGLE_ADS].shortLabel} overview
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 min-h-0 flex flex-col px-3 pb-3 pt-0">
                        {!loading && accessibleCustomers.length > 0 ? (
                            <div className="shrink-0 mb-2 apex-radar-search-wrap">
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
                        <div className="flex-1 min-h-0 overflow-y-auto">
                            {loading ? (
                                <CobaltLoader variant="block" title="Loading properties" />
                            ) : accessibleCustomers.length === 0 ? (
                                <p className="apex-radar-empty py-4">No properties available.</p>
                            ) : filteredCustomers.length === 0 ? (
                                <p className="apex-radar-empty py-4">No properties match your search.</p>
                            ) : (
                                <ul className="space-y-1">
                                    {filteredCustomers.map((c) => (
                                        <li key={String(c._id)}>
                                            <button
                                                type="button"
                                                onClick={() => pickCustomer(c._id)}
                                                className="w-full text-left rounded-lg border border-transparent px-3 py-2 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-paper-3)] hover:border-[var(--color-rule)] transition-colors"
                                            >
                                                {c.customerName || "Untitled"}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
        </div>
    );

    return createPortal(modal, document.body);
}
