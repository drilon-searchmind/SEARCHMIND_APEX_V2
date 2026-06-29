"use client";

import React, { useState, useEffect } from "react";
import { FiX } from "react-icons/fi";
import { VARIABLE_COST_SETTINGS } from "./variableCostSettingsConfig";

export default function VariableCostSettingsModal({
    open,
    fieldKey,
    onClose,
    initialValue = 0,
    onSave,
    saving = false,
}) {
    const config = fieldKey ? VARIABLE_COST_SETTINGS[fieldKey] : null;
    const [value, setValue] = useState(String(initialValue ?? 0));

    useEffect(() => {
        if (open && fieldKey) {
            setValue(String(initialValue ?? 0));
        }
    }, [open, fieldKey, initialValue]);

    if (!open || !config) return null;

    const handleSave = () => {
        const n = Number(value);
        const clampedMin = config.min ?? 0;
        const clampedMax = config.max ?? Number.POSITIVE_INFINITY;
        const next = Number.isFinite(n)
            ? Math.min(clampedMax, Math.max(clampedMin, n))
            : 0;
        onSave(fieldKey, next);
    };

    const displayPct =
        config.inputMode === "percent" ? (Number(value) || 0) * 100 : null;

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
                <h2 className="apex-perf-modal__title">{config.title}</h2>
                <p className="apex-perf-modal__lede">{config.lede}</p>
                <div className="mb-4">
                    <label className="apex-perf-modal__field-label">{config.fieldLabel}</label>
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            min={config.min}
                            max={config.max}
                            step={config.step}
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            className="apex-perf-modal__input"
                        />
                        <span className="text-sm text-[var(--color-muted)] shrink-0 tabular-nums">
                            {config.inputMode === "percent" && displayPct != null
                                ? `≈ ${displayPct.toFixed(2)}%`
                                : config.unit}
                        </span>
                    </div>
                    {config.hint ? (
                        <p className="text-xs text-[var(--color-muted)] mt-1">{config.hint}</p>
                    ) : null}
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
