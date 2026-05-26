"use client";

import React, { useState, useEffect } from "react";
import { FiX } from "react-icons/fi";

export default function ReturnsOverrideModal({
    open,
    onClose,
    initialEnabled = false,
    initialPercent = 45,
    onSave,
    saving = false,
}) {
    const [enabled, setEnabled] = useState(initialEnabled);
    const [percent, setPercent] = useState(String(initialPercent));

    useEffect(() => {
        if (open) {
            setEnabled(initialEnabled);
            setPercent(String(initialPercent));
        }
    }, [open, initialEnabled, initialPercent]);

    if (!open) return null;

    const handleSave = () => {
        const n = Number(percent);
        const clamped = Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
        onSave({ enabled, percent: clamped });
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
                        Returns override
                    </h2>
                    <p className="text-sm text-gray-500 mb-4">
                        Use a fixed return rate (% of gross sales) instead of Shopify
                        returns. Net revenue and COGS (when using COGS %) will use this
                        adjusted net revenue.
                    </p>
                    <label className="flex items-center gap-2 mb-4 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={enabled}
                            onChange={(e) => setEnabled(e.target.checked)}
                            className="rounded border-gray-300"
                        />
                        <span className="text-sm font-medium text-gray-700">
                            Enable static returns %
                        </span>
                    </label>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Returns % of gross sales (0–100)
                        </label>
                        <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            disabled={!enabled}
                            value={percent}
                            onChange={(e) => setPercent(e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400"
                        />
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
