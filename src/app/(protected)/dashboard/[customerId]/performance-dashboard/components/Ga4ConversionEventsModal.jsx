"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiSearch, FiX } from "react-icons/fi";
import CobaltLoader from "@/components/ui/CobaltLoader";

export default function Ga4ConversionEventsModal({
    open,
    onClose,
    customerId,
    initialEventNames = [],
    dateRange,
    onSave,
    saving = false,
}) {
    const [selected, setSelected] = useState([]);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState("");
    const [search, setSearch] = useState("");

    useEffect(() => {
        if (open) {
            setSelected(Array.isArray(initialEventNames) ? [...initialEventNames] : []);
            setSearch("");
        }
    }, [open, initialEventNames]);

    const fetchEvents = useCallback(async () => {
        if (!customerId) return;
        setLoading(true);
        setLoadError("");
        try {
            const qs = new URLSearchParams();
            if (dateRange?.startDate) qs.set("startDate", dateRange.startDate);
            if (dateRange?.endDate) qs.set("endDate", dateRange.endDate);
            const res = await fetch(
                `/api/b2b-dashboard/${customerId}/ga4-events?${qs.toString()}`
            );
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || "Failed to load GA4 events");
            setEvents(Array.isArray(json.events) ? json.events : []);
            if (Array.isArray(json.configured) && json.configured.length && !initialEventNames?.length) {
                setSelected(json.configured);
            }
        } catch (e) {
            setLoadError(e?.message || "Failed to load events");
            setEvents([]);
        } finally {
            setLoading(false);
        }
    }, [customerId, dateRange?.startDate, dateRange?.endDate, initialEventNames?.length]);

    useEffect(() => {
        if (open) fetchEvents();
    }, [open, fetchEvents]);

    const filteredEvents = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return events;
        return events.filter((e) => e.name.toLowerCase().includes(q));
    }, [events, search]);

    const toggleEvent = (name) => {
        setSelected((prev) =>
            prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
        );
    };

    if (!open) return null;

    const handleSave = () => {
        onSave?.(selected);
    };

    return (
        <div className="apex-perf-modal-scrim">
            <div className="apex-perf-modal apex-perf-modal--wide apex-perf-modal--scroll">
                <button
                    type="button"
                    onClick={onClose}
                    className="apex-perf-modal__close"
                    aria-label="Close"
                >
                    <FiX className="text-xl" />
                </button>

                <div className="shrink-0 pb-4 border-b border-[var(--color-rule)]">
                    <h2 className="apex-perf-modal__title">GA4 conversion events</h2>
                    <p className="apex-perf-modal__lede mb-0">
                        Choose which GA4 events count as conversions for this customer. When none
                        are selected, the GA4 default key events metric is used.
                    </p>
                </div>

                <div className="py-3 border-b border-[var(--color-rule)] shrink-0">
                    <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
                        <input
                            type="text"
                            placeholder="Search events…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="apex-perf-modal__input pl-9"
                        />
                    </div>
                    {selected.length > 0 && (
                        <p className="mt-2 text-xs text-[var(--color-accent)]">
                            {selected.length} event{selected.length !== 1 ? "s" : ""} selected
                        </p>
                    )}
                </div>

                <div className="apex-perf-modal__body py-3 min-h-[200px]">
                    {loading ? (
                        <div className="apex-perf-loading py-8">
                            <CobaltLoader
                                variant="inline"
                                request="GET /api/b2b-dashboard/ga4-events"
                                statusLabel="fetching"
                            />
                        </div>
                    ) : loadError ? (
                        <div className="apex-perf-alert apex-perf-alert--error">
                            {loadError}
                        </div>
                    ) : filteredEvents.length === 0 ? (
                        <p className="text-sm text-[var(--color-muted)] py-8 text-center">
                            {events.length === 0
                                ? "No events found for this period."
                                : "No events match your search."}
                        </p>
                    ) : (
                        <ul className="space-y-1">
                            {filteredEvents.map((event) => {
                                const checked = selected.includes(event.name);
                                return (
                                    <li key={event.name}>
                                        <label className="flex items-center gap-3 px-2 py-2 rounded-[var(--radius-input)] hover:bg-[var(--color-paper-2)] cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => toggleEvent(event.name)}
                                                className="rounded border-[var(--color-rule)]"
                                            />
                                            <span className="flex-1 text-sm text-[var(--color-ink)] truncate">
                                                {event.name}
                                            </span>
                                            <span className="text-xs text-[var(--color-muted)] tabular-nums shrink-0">
                                                {event.count.toLocaleString("da-DK")}
                                            </span>
                                        </label>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                <div className="apex-perf-modal__footer">
                    <div className="apex-perf-modal__actions mt-0">
                        <button type="button" onClick={onClose} className="apex-perf-btn">
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="apex-perf-btn apex-perf-btn--primary"
                        >
                            {saving ? "Saving…" : "Save"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
