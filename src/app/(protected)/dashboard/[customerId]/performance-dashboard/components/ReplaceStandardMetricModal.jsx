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
        <div className="fixed inset-0 z-50 flex items-center justify-center glassmorphism2">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md relative">
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                    aria-label="Close"
                >
                    <FiX className="text-2xl" />
                </button>
                <div className="p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-1">
                        Replace standard metric
                    </h2>
                    <p className="text-sm text-gray-500 mb-4">
                        Choose which standard overview row{" "}
                        <span className="font-medium text-gray-700">{kpiName}</span>{" "}
                        should replace in the Standard view. The custom value is used in
                        net profit calculations when it affects net revenue or costs.
                    </p>
                    <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                        <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                            <input
                                type="radio"
                                name="replace-metric"
                                value=""
                                checked={!selectedKey}
                                onChange={() => setSelectedKey("")}
                            />
                            <span className="text-sm text-gray-700">
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
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer ${
                                        taken
                                            ? "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
                                            : "border-gray-200 hover:bg-gray-50"
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
                                    <span className="text-sm text-gray-700">
                                        {m.label}
                                        {taken ? " (assigned to another KPI)" : ""}
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary-searchmind)] rounded-lg disabled:opacity-50"
                        >
                            {saving ? "Saving…" : "Save"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
