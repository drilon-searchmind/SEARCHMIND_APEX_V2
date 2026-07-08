"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FiSearch, FiX } from "react-icons/fi";
import { getFacebookApexRadarSettings } from "@/lib/apexRadarCustomerSettings";
import { formatActionTypeLabel } from "@/lib/apexRadarFacebookConversionEvents";
import { isDemoCustomerId } from "@/lib/demoCustomer";

export default function ApexRadarFacebookSettingsModal({ row, onClose, onSaved }) {
    const initial = row ? getFacebookApexRadarSettings(row) : getFacebookApexRadarSettings({});

    const [targetBudget, setTargetBudget] = useState(
        initial.targetBudget != null ? String(initial.targetBudget) : ""
    );
    const [targetMetricType, setTargetMetricType] = useState(initial.targetMetricType);
    const [targetValue, setTargetValue] = useState(
        initial.targetValue != null ? String(initial.targetValue) : ""
    );
    const [budgetMode, setBudgetMode] = useState(initial.budgetMode);
    const [trackingAlertsEnabled, setTrackingAlertsEnabled] = useState(initial.trackingAlertsEnabled);
    const [selectedActionTypes, setSelectedActionTypes] = useState(
        () => new Set(initial.trackingConversionActionTypes || [])
    );
    const [events, setEvents] = useState([]);
    const [eventsLoading, setEventsLoading] = useState(false);
    const [eventsError, setEventsError] = useState(null);
    const [lookbackDays, setLookbackDays] = useState(90);
    const [eventSearch, setEventSearch] = useState("");
    const [missingAdAccount, setMissingAdAccount] = useState(false);
    const [configUrl, setConfigUrl] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const isDemo = row?.id && isDemoCustomerId(row.id);
    const usesDefaultPurchases = selectedActionTypes.size === 0;

    useEffect(() => {
        if (!row) return;
        const v = getFacebookApexRadarSettings(row);
        setTargetBudget(v.targetBudget != null ? String(v.targetBudget) : "");
        setTargetMetricType(v.targetMetricType);
        setTargetValue(v.targetValue != null ? String(v.targetValue) : "");
        setBudgetMode(v.budgetMode);
        setTrackingAlertsEnabled(v.trackingAlertsEnabled);
        setSelectedActionTypes(new Set(v.trackingConversionActionTypes || []));
        setEventSearch("");
        setMissingAdAccount(false);
        setConfigUrl(null);
        setError(null);
        setEventsError(null);
    }, [row]);

    useEffect(() => {
        if (!row?.id) return;
        let cancelled = false;
        setEventsLoading(true);
        setEventsError(null);
        fetch(`/api/apex-radar/facebook/conversion-events/${row.id}`)
            .then(async (res) => {
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || "Could not load events");
                return data;
            })
            .then((data) => {
                if (cancelled) return;
                setEvents(Array.isArray(data.events) ? data.events : []);
                setLookbackDays(data.lookbackDays || 90);
                setMissingAdAccount(Boolean(data.missingAdAccount));
                setConfigUrl(data.configUrl || null);
            })
            .catch((e) => {
                if (cancelled) return;
                setEvents([]);
                setEventsError(e?.message || "Failed to load events");
            })
            .finally(() => {
                if (!cancelled) setEventsLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [row?.id]);

    const eventByType = useMemo(() => new Map(events.map((e) => [e.actionType, e])), [events]);

    const sortedEvents = useMemo(() => {
        return [...events].sort((a, b) => b.count - a.count || a.actionType.localeCompare(b.actionType));
    }, [events]);

    const filteredEvents = useMemo(() => {
        const q = eventSearch.trim().toLowerCase();
        if (!q) return sortedEvents;
        return sortedEvents.filter((ev) => {
            const label = (ev.label || formatActionTypeLabel(ev.actionType)).toLowerCase();
            return label.includes(q) || ev.actionType.toLowerCase().includes(q);
        });
    }, [sortedEvents, eventSearch]);

    const selectedEventsList = useMemo(() => {
        return [...selectedActionTypes].map((actionType) => {
            const ev = eventByType.get(actionType);
            return (
                ev || {
                    actionType,
                    count: 0,
                    label: formatActionTypeLabel(actionType),
                    savedOnly: true,
                }
            );
        });
    }, [selectedActionTypes, eventByType]);

    if (!row) return null;

    const toggleActionType = (actionType) => {
        setSelectedActionTypes((prev) => {
            const next = new Set(prev);
            if (next.has(actionType)) next.delete(actionType);
            else next.add(actionType);
            return next;
        });
    };

    const handleUseDefaultPurchases = () => {
        setSelectedActionTypes(new Set());
    };

    const handleSave = async () => {
        if (isDemo) return;
        setSaving(true);
        setError(null);
        try {
            const trackingConversionActionTypes =
                selectedActionTypes.size > 0 ? [...selectedActionTypes] : null;
            const res = await fetch(`/api/apex-radar/facebook/customer-settings/${row.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    targetBudget: targetBudget.trim() === "" ? null : Number(targetBudget),
                    targetMetricType,
                    targetValue: targetValue.trim() === "" ? null : Number(targetValue),
                    budgetMode,
                    trackingAlertsEnabled,
                    trackingConversionActionTypes,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error || "Could not save");
            }
            onSaved?.(data);
            onClose();
        } catch (e) {
            setError(e?.message || "Save failed");
        } finally {
            setSaving(false);
        }
    };

    const renderEventRow = (ev) => {
        const checked = selectedActionTypes.has(ev.actionType);
        const label = ev.label || formatActionTypeLabel(ev.actionType);
        return (
            <li key={ev.actionType}>
                <label className={checked ? "is-selected" : undefined}>
                    <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleActionType(ev.actionType)}
                    />
                    <span className="flex-1 min-w-0">
                        <span className="block">{label}</span>
                        <span className="block text-[0.62rem] text-[var(--color-muted)] font-mono truncate">
                            {ev.actionType}
                        </span>
                    </span>
                    <span className="shrink-0 text-[0.65rem] tabular-nums text-[var(--color-muted)]">
                        {ev.count > 0 ? ev.count : "0"} / {lookbackDays}d
                    </span>
                </label>
            </li>
        );
    };

    return (
        <div className="apex-radar-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="apex-fb-settings-title">
            <div className="apex-radar-modal apex-radar-modal--lg">
                <div className="apex-radar-modal__head">
                    <div>
                        <h2 id="apex-fb-settings-title" className="apex-radar-modal__title">
                            Apex Radar — Facebook
                        </h2>
                        <p className="apex-radar-modal__subtitle">{row.entity}</p>
                    </div>
                    <button type="button" onClick={onClose} className="apex-radar-modal__close" aria-label="Close">
                        <FiX className="h-5 w-5" />
                    </button>
                </div>

                <div className="apex-radar-modal__body apex-radar-form space-y-4">
                    {isDemo ? (
                        <p className="apex-radar-section__subtitle">Demo properties cannot be edited.</p>
                    ) : (
                        <>
                            <div>
                                <label className="apex-radar-field-label" htmlFor="apex-fb-budget">
                                    Budget (mål)
                                </label>
                                <input
                                    id="apex-fb-budget"
                                    type="number"
                                    min={0}
                                    step="any"
                                    value={targetBudget}
                                    onChange={(e) => setTargetBudget(e.target.value)}
                                    placeholder="Fx. månedligt budget"
                                />
                            </div>
                            <div>
                                <label className="apex-radar-field-label" htmlFor="apex-fb-metric">
                                    Target type
                                </label>
                                <select
                                    id="apex-fb-metric"
                                    value={targetMetricType}
                                    onChange={(e) => setTargetMetricType(e.target.value)}
                                >
                                    <option value="ROAS">ROAS</option>
                                    <option value="CPA">CPA</option>
                                </select>
                            </div>
                            <div>
                                <label className="apex-radar-field-label" htmlFor="apex-fb-target-val">
                                    Target {targetMetricType === "CPA" ? "(CPA)" : "(ROAS)"}
                                </label>
                                <input
                                    id="apex-fb-target-val"
                                    type="number"
                                    min={0}
                                    step="any"
                                    value={targetValue}
                                    onChange={(e) => setTargetValue(e.target.value)}
                                    placeholder={targetMetricType === "CPA" ? "Fx. 250" : "Fx. 5"}
                                />
                            </div>
                            <div>
                                <label className="apex-radar-field-label" htmlFor="apex-fb-budget-mode">
                                    Budget type
                                </label>
                                <select
                                    id="apex-fb-budget-mode"
                                    value={budgetMode}
                                    onChange={(e) => setBudgetMode(e.target.value)}
                                >
                                    <option value="DYNAMIC">Dynamisk</option>
                                    <option value="STATIC">Statisk</option>
                                </select>
                            </div>
                            <div className="flex items-start gap-2 pt-1">
                                <input
                                    id="apex-fb-tracking-alerts"
                                    type="checkbox"
                                    checked={trackingAlertsEnabled}
                                    onChange={(e) => setTrackingAlertsEnabled(e.target.checked)}
                                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-accent)]"
                                />
                                <div>
                                    <label
                                        htmlFor="apex-fb-tracking-alerts"
                                        className="apex-radar-field-label !mb-0 normal-case !text-[0.72rem]"
                                    >
                                        Conversion tracking alerts
                                    </label>
                                    <p className="apex-radar-field-hint !mt-1">
                                        Turn off to only monitor spend (no conversion streak alerts).
                                    </p>
                                </div>
                            </div>

                            <div className="pt-2 border-t border-[var(--color-rule)]">
                                <div className="flex items-baseline justify-between gap-2 mb-2">
                                    <h3 className="apex-radar-field-label mb-0">Conversion events</h3>
                                    <button
                                        type="button"
                                        onClick={handleUseDefaultPurchases}
                                        className="apex-radar-link-btn text-[0.65rem]"
                                    >
                                        Use default (purchases)
                                    </button>
                                </div>
                                <p className="apex-radar-section__subtitle mb-3">
                                    Ad-attributed events from the Meta ad account (last {lookbackDays} days). Only
                                    events with ad-attributed volume in insights are listed — not full Events Manager
                                    totals.
                                    {usesDefaultPurchases
                                        ? " Using default purchase events."
                                        : ` ${selectedActionTypes.size} selected.`}
                                </p>

                                {eventsLoading ? (
                                    <p className="apex-radar-section__subtitle py-2">Loading ad account events…</p>
                                ) : eventsError ? (
                                    <p className="text-sm text-[var(--color-error,oklch(50%_0.15_25))]">{eventsError}</p>
                                ) : missingAdAccount ? (
                                    <p className="apex-radar-modal-callout">
                                        Missing Facebook ad account.{" "}
                                        {configUrl ? (
                                            <Link href={configUrl} className="apex-radar-link-btn inline">
                                                Add in customer config →
                                            </Link>
                                        ) : null}
                                    </p>
                                ) : (
                                    <>
                                        {selectedEventsList.length > 0 ? (
                                            <div className="mb-4">
                                                <p className="apex-radar-field-label mb-2">
                                                    Selected ({selectedEventsList.length})
                                                </p>
                                                <ul className="apex-radar-modal-list apex-radar-modal-list--selected">
                                                    {selectedEventsList.map((ev) => renderEventRow(ev))}
                                                </ul>
                                            </div>
                                        ) : null}

                                        {sortedEvents.length > 0 ? (
                                            <>
                                                <div className="apex-radar-search-wrap mb-3">
                                                    <FiSearch className="h-4 w-4" aria-hidden />
                                                    <input
                                                        id="apex-fb-event-search"
                                                        type="search"
                                                        value={eventSearch}
                                                        onChange={(e) => setEventSearch(e.target.value)}
                                                        placeholder="Search ad account events…"
                                                        autoComplete="off"
                                                    />
                                                </div>
                                                <p className="apex-radar-field-label mb-2">
                                                    All events ({filteredEvents.length}
                                                    {eventSearch.trim() ? ` of ${sortedEvents.length}` : ""})
                                                </p>
                                                {filteredEvents.length === 0 ? (
                                                    <p className="apex-radar-empty py-2">
                                                        No events match &ldquo;{eventSearch.trim()}&rdquo;.
                                                    </p>
                                                ) : (
                                                    <ul className="apex-radar-modal-list max-h-[20rem] overflow-y-auto">
                                                        {filteredEvents.map((ev) => renderEventRow(ev))}
                                                    </ul>
                                                )}
                                            </>
                                        ) : (
                                            <p className="apex-radar-empty py-2">
                                                No ad-attributed conversion events in the last {lookbackDays} days.
                                            </p>
                                        )}
                                    </>
                                )}
                            </div>

                            {error ? (
                                <p className="text-sm text-[var(--color-error,oklch(50%_0.15_25))]">{error}</p>
                            ) : null}
                        </>
                    )}
                </div>

                <div className="apex-radar-modal__foot">
                    <button type="button" onClick={onClose} className="apex-perf-btn apex-perf-btn--secondary">
                        Cancel
                    </button>
                    <button
                        type="button"
                        disabled={saving || isDemo}
                        onClick={handleSave}
                        className="apex-perf-btn apex-perf-btn--primary"
                    >
                        {saving ? "Saving…" : "Save"}
                    </button>
                </div>
            </div>
        </div>
    );
}
