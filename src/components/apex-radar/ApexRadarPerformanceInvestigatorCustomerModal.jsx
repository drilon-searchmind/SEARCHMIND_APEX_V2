"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { FiSearch, FiX } from "react-icons/fi";
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

/**
 * Shown when opening Performance Investigator without a scoped customer, or from /apex-radar without a channel.
 */
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
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/45 text-gray-900"
            role="dialog"
            aria-modal="true"
            aria-labelledby="apex-pi-customer-title"
            data-apex-radar-performance-modal="true"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose?.();
            }}
        >
            <div className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-xl border border-gray-200 bg-white overflow-hidden shadow-lg text-gray-900">
                <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
                    <div>
                        <h2 id="apex-pi-customer-title" className="text-lg font-semibold text-gray-900">
                            Performance Investigator
                        </h2>
                        {!channel ? (
                            <p className="text-xs text-gray-500 mt-1">
                                Choose Facebook (PS) or Google Ads using the platform switcher at the bottom of the
                                sidebar, then open Performance Investigator again to pick a property.
                            </p>
                        ) : (
                            <p className="text-xs text-gray-500 mt-1">
                                The investigator is tied to one property. Select a customer to continue —{" "}
                                <span className="font-medium text-gray-700">
                                    {APEX_RADAR_CHANNEL_META[channel]?.label || channel}
                                </span>
                                .
                            </p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                        aria-label="Close"
                    >
                        <FiX className="h-5 w-5" />
                    </button>
                </div>

                {!channel ? (
                    <div className="p-5 space-y-3 shrink-0">
                        <p className="text-sm text-gray-600">Or jump to an overview first:</p>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    onClose?.();
                                    router.push(apexRadarOverviewHref(APEX_RADAR_CHANNEL_FACEBOOK));
                                }}
                                className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                            >
                                {APEX_RADAR_CHANNEL_META[APEX_RADAR_CHANNEL_FACEBOOK].shortLabel} overview
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    onClose?.();
                                    router.push(apexRadarOverviewHref(APEX_RADAR_CHANNEL_GOOGLE_ADS));
                                }}
                                className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                            >
                                {APEX_RADAR_CHANNEL_META[APEX_RADAR_CHANNEL_GOOGLE_ADS].shortLabel} overview
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 min-h-0 flex flex-col px-3 pb-3 pt-0">
                        {!loading && accessibleCustomers.length > 0 ? (
                            <div className="shrink-0 mb-2 relative">
                                <FiSearch
                                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                                    aria-hidden
                                />
                                <input
                                    type="search"
                                    value={customerSearch}
                                    onChange={(e) => setCustomerSearch(e.target.value)}
                                    placeholder="Search properties…"
                                    autoComplete="off"
                                    className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[var(--color-primary-searchmind-lighter)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-searchmind-lighter)]/30"
                                    aria-label="Search properties"
                                />
                            </div>
                        ) : null}
                        <div className="flex-1 min-h-0 overflow-y-auto -mx-0.5 px-0.5">
                            {loading ? (
                                <p className="text-sm text-gray-500 px-2 py-4 text-center">Loading properties…</p>
                            ) : accessibleCustomers.length === 0 ? (
                                <p className="text-sm text-gray-500 px-2 py-4 text-center">No properties available.</p>
                            ) : filteredCustomers.length === 0 ? (
                                <p className="text-sm text-gray-500 px-2 py-4 text-center">No properties match your search.</p>
                            ) : (
                                <ul className="space-y-1">
                                    {filteredCustomers.map((c) => (
                                        <li key={String(c._id)}>
                                            <button
                                                type="button"
                                                onClick={() => pickCustomer(c._id)}
                                                className="w-full text-left rounded-lg border border-transparent px-3 py-2.5 text-sm font-medium text-gray-900 hover:bg-[var(--color-primary-searchmind-lighter)]/15 hover:border-gray-200 transition-colors"
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
    );

    return createPortal(modal, document.body);
}
