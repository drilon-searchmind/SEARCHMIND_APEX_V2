"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import CobaltLoader from "@/components/ui/CobaltLoader";
import { showToast } from "@/components/ui/ToastProvider";
import { normalizeGoogleAdsCampaignId } from "@/lib/googleAdsCampaignIdUtils";
import { normalizeCampaignNameKeywords } from "@/lib/adCampaignFilterUtils";
import CampaignExclusionKeywordEditor from "./CampaignExclusionKeywordEditor";
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
    excludedKeywords = [],
    onApply,
    fetchDisabled = false,
}) {
    const [loading, setLoading] = useState(false);
    const [campaigns, setCampaigns] = useState([]);
    const [search, setSearch] = useState("");
    /** Local checkbox state (source of truth until Apply). */
    const [localExcluded, setLocalExcluded] = useState({});
    const [localKeywords, setLocalKeywords] = useState([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setLocalExcluded({ ...(excludedCampaigns || {}) });
        setLocalKeywords(normalizeCampaignNameKeywords(excludedKeywords));
    }, [open, customerId, excludedCampaigns, excludedKeywords]);

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
    const keywordCount = normalizeCampaignNameKeywords(localKeywords).length;

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

    const handleApplyClick = async () => {
        if (saving || fetchDisabled) return;
        const excludedCampaignIds = buildExcludedIdList(localExcluded);
        const excludedCampaignNameKeywords = normalizeCampaignNameKeywords(localKeywords);
        setSaving(true);
        try {
            await onApply?.(excludedCampaignIds, excludedCampaignNameKeywords);
            onClose?.();
        } finally {
            setSaving(false);
        }
    };

    const controlsDisabled = fetchDisabled || saving;

    if (!open) return null;

    return (
        <div
            className="apex-perf-modal-scrim apex-perf"
            role="dialog"
            aria-modal="true"
            aria-labelledby="google-ads-campaigns-modal-title"
            onClick={controlsDisabled ? undefined : onClose}
        >
            <div
                className="apex-perf-modal apex-perf-modal--scroll w-full max-w-lg max-h-[85vh]"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    type="button"
                    className="apex-perf-modal__close"
                    onClick={onClose}
                    disabled={controlsDisabled}
                    aria-label="Close"
                >
                    <FiX className="text-xl" />
                </button>
                <h2 id="google-ads-campaigns-modal-title" className="apex-perf-modal__title">
                    Google Ads campaigns
                </h2>
                <p className="apex-perf-modal__lede">{propertyLabel}</p>
                <p className="apex-perf-modal__lede mb-0">
                    Check campaigns to exclude from Google ad spend for this property only.
                </p>

                {saving ? (
                    <div className="apex-parent-modal-saving">
                        <CobaltLoader variant="inline" title="Saving filters" />
                        Saving filters and updating ad spend…
                    </div>
                ) : null}

                <div className="apex-perf-modal__body">
                <div className="mb-4">
                    <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)] w-4 h-4" />
                        <input
                            type="search"
                            placeholder="Search by name or id…"
                            className="apex-perf-modal__input pl-9"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="apex-parent-modal-toolbar">
                        <div className="flex gap-2">
                            <button
                                type="button"
                                className="apex-parent-modal-link"
                                disabled={controlsDisabled || loading || filteredIds.length === 0}
                                onClick={handleSelectAll}
                            >
                                Select all
                            </button>
                            <span className="text-[var(--color-muted)]">|</span>
                            <button
                                type="button"
                                className="apex-parent-modal-link"
                                disabled={controlsDisabled || loading || filteredIds.length === 0}
                                onClick={handleDeselectAll}
                            >
                                Deselect all
                            </button>
                        </div>
                        {(excludedCount > 0 || keywordCount > 0) && (
                            <p className="apex-parent-modal-note">
                                {excludedCount > 0 ? `${excludedCount} campaign(s)` : ""}
                                {excludedCount > 0 && keywordCount > 0 ? " · " : ""}
                                {keywordCount > 0 ? `${keywordCount} keyword(s)` : ""} excluded
                            </p>
                        )}
                    </div>
                </div>

                <div className="min-h-[200px]">
                    {loading ? (
                        <div className="apex-parent-loader-panel min-h-[12rem]">
                            <CobaltLoader variant="block" title="Loading campaigns" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <p className="apex-parent-empty-note text-center py-8">
                            {campaigns.length === 0
                                ? "No campaigns found for this date range."
                                : "No campaigns match your search."}
                        </p>
                    ) : (
                        <ul className="apex-parent-modal-list">
                            {filtered.map((c) => {
                                const id = normalizeGoogleAdsCampaignId(c.id);
                                if (!id) return null;
                                const excluded = localExcluded[id] === true;
                                return (
                                    <li key={id}>
                                        <label>
                                            <input
                                                type="checkbox"
                                                className="apex-parent-checkbox mt-0.5"
                                                checked={excluded}
                                                disabled={controlsDisabled}
                                                onChange={() => handleToggle(id, !excluded)}
                                            />
                                            <span className="flex-1 min-w-0">
                                                <span className="apex-parent-modal-list__name">
                                                    {c.name || id}
                                                </span>
                                                <span className="apex-parent-modal-list__meta">
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

                <CampaignExclusionKeywordEditor
                    keywords={localKeywords}
                    onChange={setLocalKeywords}
                    disabled={controlsDisabled || loading}
                />
                </div>

                <div className="apex-perf-modal__footer apex-perf-modal__actions">
                    <button type="button" onClick={onClose} disabled={controlsDisabled} className="apex-perf-btn">
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="apex-perf-btn apex-perf-btn--primary"
                        disabled={controlsDisabled || loading}
                        onClick={handleApplyClick}
                    >
                        {saving ? "Applying…" : "Apply"}
                    </button>
                </div>
            </div>
        </div>
    );
}
