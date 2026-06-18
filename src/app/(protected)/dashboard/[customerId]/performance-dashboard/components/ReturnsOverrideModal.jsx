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
                <h2 className="apex-perf-modal__title">Returns override</h2>
                <p className="apex-perf-modal__lede">
                    Use a fixed return rate (% of gross sales) instead of Shopify
                    returns. Net revenue and COGS (when using COGS %) will use this
                    adjusted net revenue.
                </p>
                <label className="flex items-center gap-2 mb-4 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => setEnabled(e.target.checked)}
                        className="rounded border-[var(--color-rule)]"
                    />
                    <span className="text-sm font-medium text-[var(--color-ink-2)]">
                        Enable static returns %
                    </span>
                </label>
                <div className="mb-4">
                    <label className="apex-perf-modal__field-label">
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
                        className="apex-perf-modal__input disabled:opacity-50"
                    />
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
