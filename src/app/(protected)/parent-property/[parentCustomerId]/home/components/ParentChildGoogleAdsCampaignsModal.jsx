"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import FormButton from "@/components/form/FormButton";
import Spinner from "@/components/ui/Spinner";
import { showToast } from "@/components/ui/ToastProvider";
import { normalizeGoogleAdsCampaignId } from "@/lib/googleAdsCampaignIdUtils";
import { FiSearch, FiX } from "react-icons/fi";

function buildExcludedIdList(excludedMap) {
    return Object.entries(excludedMap || {})
        .filter(([, v]) => v === true)
        .map(([k]) => normalizeGoogleAdsCampaignId(k))
        .filter(Boolean);
}

/**
 * Modal to pick Google Ads campaigns to exclude from spend for one child property.
 */
export default function ParentChildGoogleAdsCampaignsModal({
    open,
    onClose,
    customerId,
    propertyLabel = "Property",
    startDate,
    endDate,
    /** Initial exclusions when modal opens: campaign id → true */
    excludedCampaigns = {},
    onApply,
    fetchDisabled = false,
}) {
    const [loading, setLoading] = useState(false);
    const [campaigns, setCampaigns] = useState([]);
    const [search, setSearch] = useState("");
    /** Local checkbox state (source of truth until Apply). */
    const [localExcluded, setLocalExcluded] = useState({});

    useEffect(() => {
        if (!open) return;
        setLocalExcluded({ ...(excludedCampaigns || {}) });
    }, [open, customerId, excludedCampaigns]);

    const loadCampaigns = useCallback(async () => {
        if (!customerId || !startDate || !endDate) return;
        setLoading(true);
        try {
            const qs = new URLSearchParams({ startDate, endDate });
            const res = await fetch(
                `/api/google-ads-campaigns/${customerId}?${qs.toString()}`,
                { credentials: "same-origin" }
            );
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || `Campaigns (${res.status})`);
            if (body.notConfigured) {
                showToast({
                    message: `${propertyLabel}: Google Ads is not configured.`,
                    type: "warning",
                    position: "top-center",
                });
                setCampaigns([]);
                return;
            }
            setCampaigns(Array.isArray(body.campaigns) ? body.campaigns : []);
        } catch (e) {
            showToast({
                message: e?.message || "Could not load Google Ads campaigns",
                type: "error",
                position: "top-center",
            });
            setCampaigns([]);
        } finally {
            setLoading(false);
        }
    }, [customerId, startDate, endDate, propertyLabel]);

    useEffect(() => {
        if (!open) return undefined;
        setSearch("");
        loadCampaigns();
        return undefined;
    }, [open, loadCampaigns]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return campaigns;
        return campaigns.filter(
            (c) =>
                String(c.name || "")
                    .toLowerCase()
                    .includes(q) || String(c.id || "").includes(q)
        );
    }, [campaigns, search]);

    const filteredIds = useMemo(
        () => filtered.map((c) => normalizeGoogleAdsCampaignId(c.id)).filter(Boolean),
        [filtered]
    );

    const excludedCount = buildExcludedIdList(localExcluded).length;

    const handleSelectAll = () => {
        if (filteredIds.length === 0) return;
        setLocalExcluded((prev) => {
            const next = { ...prev };
            for (const id of filteredIds) next[id] = true;
            return next;
        });
    };

    const handleDeselectAll = () => {
        if (filteredIds.length === 0) return;
        setLocalExcluded((prev) => {
            const next = { ...prev };
            for (const id of filteredIds) delete next[id];
            return next;
        });
    };

    const handleToggle = (campaignId, exclude) => {
        const id = normalizeGoogleAdsCampaignId(campaignId);
        if (!id) return;
        setLocalExcluded((prev) => {
            const next = { ...prev };
            if (exclude) next[id] = true;
            else delete next[id];
            return next;
        });
    };

    const handleApplyClick = () => {
        const excludedCampaignIds = buildExcludedIdList(localExcluded);
        onApply?.(excludedCampaignIds);
        onClose?.();
    };

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/40"
            role="dialog"
            aria-modal="true"
            aria-labelledby="google-ads-campaigns-modal-title"
        >
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
                <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200">
                    <div>
                        <h2
                            id="google-ads-campaigns-modal-title"
                            className="text-lg font-semibold text-gray-900"
                        >
                            Google Ads campaigns
                        </h2>
                        <p className="text-sm text-gray-500 mt-0.5">{propertyLabel}</p>
                        <p className="text-xs text-gray-400 mt-1">
                            Check campaigns to <strong>exclude</strong> from Google Adspend for this
                            property only.
                        </p>
                    </div>
                    <button
                        type="button"
                        className="p-1 rounded hover:bg-gray-100 text-gray-500"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        <FiX className="w-5 h-5" />
                    </button>
                </div>

                <div className="px-5 py-3 border-b border-gray-100">
                    <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="search"
                            placeholder="Search by name or id…"
                            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-searchmind)]"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
                        <div className="flex gap-2">
                            <button
                                type="button"
                                className="text-xs font-medium text-[var(--color-primary-searchmind)] hover:underline disabled:opacity-50 disabled:no-underline"
                                disabled={fetchDisabled || loading || filteredIds.length === 0}
                                onClick={handleSelectAll}
                            >
                                Select all
                            </button>
                            <span className="text-xs text-gray-300">|</span>
                            <button
                                type="button"
                                className="text-xs font-medium text-[var(--color-primary-searchmind)] hover:underline disabled:opacity-50 disabled:no-underline"
                                disabled={fetchDisabled || loading || filteredIds.length === 0}
                                onClick={handleDeselectAll}
                            >
                                Deselect all
                            </button>
                        </div>
                        {excludedCount > 0 && (
                            <p className="text-xs text-amber-700">
                                {excludedCount} excluded
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-3 min-h-[200px]">
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <Spinner size={36} />
                        </div>
                    ) : filtered.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-8">
                            {campaigns.length === 0
                                ? "No campaigns found for this date range."
                                : "No campaigns match your search."}
                        </p>
                    ) : (
                        <ul className="space-y-1">
                            {filtered.map((c) => {
                                const id = normalizeGoogleAdsCampaignId(c.id);
                                if (!id) return null;
                                const excluded = localExcluded[id] === true;
                                return (
                                    <li key={id}>
                                        <label className="flex items-start gap-3 py-2 px-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="mt-0.5 rounded border-gray-300"
                                                checked={excluded}
                                                disabled={fetchDisabled}
                                                onChange={() => handleToggle(id, !excluded)}
                                            />
                                            <span className="flex-1 min-w-0">
                                                <span className="block text-sm font-medium text-gray-800 truncate">
                                                    {c.name || id}
                                                </span>
                                                <span className="block text-xs text-gray-400">
                                                    ID {id}
                                                    {c.status ? ` · ${c.status}` : ""}
                                                </span>
                                            </span>
                                        </label>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200">
                    <FormButton
                        type="button"
                        borderType="outline"
                        buttonSize="small"
                        onClick={onClose}
                    >
                        Cancel
                    </FormButton>
                    <FormButton
                        type="button"
                        buttonSize="small"
                        disabled={fetchDisabled || loading}
                        onClick={handleApplyClick}
                    >
                        Apply
                    </FormButton>
                </div>
            </div>
        </div>
    );
}
