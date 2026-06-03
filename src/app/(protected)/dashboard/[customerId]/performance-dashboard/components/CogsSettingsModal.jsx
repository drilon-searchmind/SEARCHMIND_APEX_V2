"use client";

import React, { useState, useEffect } from "react";
import { FiX } from "react-icons/fi";

export default function CogsSettingsModal({
    open,
    onClose,
    initialFetchCogsFromStore = false,
    initialCogsPercentage = 0,
    onSave,
    saving = false,
}) {
    const [fetchFromStore, setFetchFromStore] = useState(initialFetchCogsFromStore);
    const [cogsPercent, setCogsPercent] = useState(String(initialCogsPercentage ?? 0));

    useEffect(() => {
        if (open) {
            setFetchFromStore(initialFetchCogsFromStore);
            setCogsPercent(String(initialCogsPercentage ?? 0));
        }
    }, [open, initialFetchCogsFromStore, initialCogsPercentage]);

    if (!open) return null;

    const handleSave = () => {
        const n = Number(cogsPercent);
        const pct = Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
        onSave({ fetchCogsFromStore: fetchFromStore, cogsPercentage: pct });
    };

    const displayPct = (Number(cogsPercent) || 0) * 100;

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
                    <h2 className="text-lg font-semibold text-gray-900 mb-1">COGS settings</h2>
                    <p className="text-sm text-gray-500 mb-4">
                        Same options as customer config. Use Shopify cost of goods sold from
                        your store, or a manual percentage of net revenue.
                    </p>
                    <label className="flex items-center gap-2 mb-4 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={fetchFromStore}
                            onChange={(e) => setFetchFromStore(e.target.checked)}
                            className="rounded border-gray-300"
                        />
                        <span className="text-sm font-medium text-gray-700">
                            Fetch COGS from store (Shopify)
                        </span>
                    </label>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            COGS % (manual)
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min={0}
                                max={1}
                                step={0.01}
                                disabled={fetchFromStore}
                                value={cogsPercent}
                                onChange={(e) => setCogsPercent(e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400"
                            />
                            <span className="text-sm text-gray-500 shrink-0 tabular-nums">
                                ≈ {displayPct.toFixed(1)}%
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            Enter as decimal: 0.1 = 10% of net revenue (when not using store
                            COGS).
                        </p>
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
                            {saving ? "Saving…" : "Save & refresh"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
