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
                <h2 className="apex-perf-modal__title">COGS settings</h2>
                <p className="apex-perf-modal__lede">
                    Same options as customer config. Use Shopify cost of goods sold from
                    your store, or a manual percentage of net revenue.
                </p>
                <label className="flex items-center gap-2 mb-4 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={fetchFromStore}
                        onChange={(e) => setFetchFromStore(e.target.checked)}
                        className="rounded border-[var(--color-rule)]"
                    />
                    <span className="text-sm font-medium text-[var(--color-ink-2)]">
                        Fetch COGS from store (Shopify)
                    </span>
                </label>
                <div className="mb-4">
                    <label className="apex-perf-modal__field-label">COGS % (manual)</label>
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            min={0}
                            max={1}
                            step={0.01}
                            disabled={fetchFromStore}
                            value={cogsPercent}
                            onChange={(e) => setCogsPercent(e.target.value)}
                            className="apex-perf-modal__input disabled:opacity-50"
                        />
                        <span className="text-sm text-[var(--color-muted)] shrink-0 tabular-nums">
                            ≈ {displayPct.toFixed(1)}%
                        </span>
                    </div>
                    <p className="text-xs text-[var(--color-muted)] mt-1">
                        Enter as decimal: 0.1 = 10% of net revenue (when not using store
                        COGS).
                    </p>
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
                        {saving ? "Saving…" : "Save & refresh"}
                    </button>
                </div>
            </div>
        </div>
    );
}
