"use client";

import React, { useState, useEffect } from "react";
import { FiX } from "react-icons/fi";
import { REPLACEABLE_STANDARD_METRICS } from "@/lib/performanceDashboard/performanceDashboardConstants";

export default function ReplaceStandardMetricModal({
    open,
    onClose,
    kpiName = "",
    currentReplacementKey = null,
    takenKeys = [],
    onSave,
    saving = false,
    replaceableMetrics = REPLACEABLE_STANDARD_METRICS,
}) {
    const [selectedKey, setSelectedKey] = useState(currentReplacementKey || "");

    useEffect(() => {
        if (open) setSelectedKey(currentReplacementKey || "");
    }, [open, currentReplacementKey]);

    if (!open) return null;

    const handleSave = () => {
        onSave(selectedKey || null);
    };

    return (
        <div className="apex-perf-modal-scrim">
            <div className="apex-perf-modal">
                <button
                    type="button"
                    onClick={onClose}
                    className="apex-perf-modal__close"
                    aria-label="Close"
                >
                    <FiX className="text-xl" />
                </button>
                <h2 className="apex-perf-modal__title">Replace standard metric</h2>
                <p className="apex-perf-modal__lede">
                    Choose which standard overview row{" "}
                    <span className="font-medium text-[var(--color-ink)]">{kpiName}</span>{" "}
                    should replace in the Standard view. The custom value is used in
                    net profit calculations when it affects net revenue or costs.
                </p>
                <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                    <label className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-input)] border border-[var(--color-rule)] cursor-pointer hover:bg-[var(--color-paper-2)]">
                        <input
                            type="radio"
                            name="replace-metric"
                            value=""
                            checked={!selectedKey}
                            onChange={() => setSelectedKey("")}
                        />
                        <span className="text-sm text-[var(--color-ink-2)]">
                            None (custom only)
                        </span>
                    </label>
                    {replaceableMetrics.map((m) => {
                        const taken =
                            takenKeys.includes(m.key) &&
                            m.key !== currentReplacementKey;
                        return (
                            <label
                                key={m.key}
                                className={`flex items-center gap-2 px-3 py-2 rounded-[var(--radius-input)] border cursor-pointer ${
                                    taken
                                        ? "border-[var(--color-rule)] bg-[var(--color-paper-2)] opacity-50 cursor-not-allowed"
                                        : "border-[var(--color-rule)] hover:bg-[var(--color-paper-2)]"
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="replace-metric"
                                    value={m.key}
                                    checked={selectedKey === m.key}
                                    disabled={taken}
                                    onChange={() => setSelectedKey(m.key)}
                                />
                                <span className="text-sm text-[var(--color-ink-2)]">
                                    {m.label}
                                    {taken ? " (assigned to another KPI)" : ""}
                                </span>
                            </label>
                        );
                    })}
                </div>
                <div className="apex-perf-modal__actions">
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
    );
}
