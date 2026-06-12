"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiSearch, FiX } from "react-icons/fi";
import Spinner from "@/components/ui/Spinner";

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
        <div className="fixed inset-0 z-50 flex items-center justify-center glassmorphism2">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg relative max-h-[90vh] flex flex-col">
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10"
                    aria-label="Close"
                >
                    <FiX className="text-2xl" />
                </button>

                <div className="p-6 pb-4 border-b border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-900 mb-1">
                        GA4 conversion events
                    </h2>
                    <p className="text-sm text-gray-500">
                        Choose which GA4 events count as conversions for this customer. When none
                        are selected, the GA4 default key events metric is used.
                    </p>
                </div>

                <div className="px-6 py-3 border-b border-gray-100">
                    <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search events…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm"
                        />
                    </div>
                    {selected.length > 0 && (
                        <p className="mt-2 text-xs text-[var(--color-primary-searchmind)]">
                            {selected.length} event{selected.length !== 1 ? "s" : ""} selected
                        </p>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-3 min-h-[200px]">
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <Spinner size={32} color="#406969" />
                        </div>
                    ) : loadError ? (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {loadError}
                        </div>
                    ) : filteredEvents.length === 0 ? (
                        <p className="text-sm text-gray-500 py-8 text-center">
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
                                        <label className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => toggleEvent(event.name)}
                                                className="rounded border-gray-300"
                                            />
                                            <span className="flex-1 text-sm text-gray-800 truncate">
                                                {event.name}
                                            </span>
                                            <span className="text-xs text-gray-400 tabular-nums shrink-0">
                                                {event.count.toLocaleString("da-DK")}
                                            </span>
                                        </label>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                <div className="p-6 pt-4 border-t border-gray-100 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--color-primary-searchmind)] text-white hover:opacity-90 disabled:opacity-50"
                    >
                        {saving ? "Saving…" : "Save"}
                    </button>
                </div>
            </div>
        </div>
    );
}
