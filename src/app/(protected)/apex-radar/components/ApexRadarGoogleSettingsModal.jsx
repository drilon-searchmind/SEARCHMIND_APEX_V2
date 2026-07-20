"use client";

import React, { useEffect, useState } from "react";
import { FiX } from "react-icons/fi";
import { getGoogleApexRadarSettings } from "@/lib/apexRadarCustomerSettings";
import { isDemoCustomerId } from "@/lib/demoCustomer";

export default function ApexRadarGoogleSettingsModal({ row, onClose, onSaved }) {
    const initial = row ? getGoogleApexRadarSettings(row) : getGoogleApexRadarSettings({});

    const [targetBudget, setTargetBudget] = useState(
        initial.targetBudget != null ? String(initial.targetBudget) : ""
    );
    const [targetMetricType, setTargetMetricType] = useState(initial.targetMetricType);
    const [targetValue, setTargetValue] = useState(
        initial.targetValue != null ? String(initial.targetValue) : ""
    );
    const [budgetMode, setBudgetMode] = useState(initial.budgetMode);
    const [trackingAlertsEnabled, setTrackingAlertsEnabled] = useState(initial.trackingAlertsEnabled);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const isDemo = row?.id && isDemoCustomerId(row.id);

    useEffect(() => {
        if (!row) return;
        const v = getGoogleApexRadarSettings(row);
        setTargetBudget(v.targetBudget != null ? String(v.targetBudget) : "");
        setTargetMetricType(v.targetMetricType);
        setTargetValue(v.targetValue != null ? String(v.targetValue) : "");
        setBudgetMode(v.budgetMode);
        setTrackingAlertsEnabled(v.trackingAlertsEnabled);
        setError(null);
    }, [row]);

    if (!row) return null;

    const handleSave = async () => {
        if (isDemo) return;
        setSaving(true);
        setError(null);
        try {
            const res = await fetch(`/api/apex-radar/google-ads/customer-settings/${row.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    targetBudget: targetBudget.trim() === "" ? null : Number(targetBudget),
                    targetMetricType,
                    targetValue: targetValue.trim() === "" ? null : Number(targetValue),
                    budgetMode,
                    trackingAlertsEnabled,
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

    return (
        <div className="apex-radar-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="apex-google-settings-title">
            <div className="apex-radar-modal apex-radar-modal--md">
                <div className="apex-radar-modal__head">
                    <div>
                        <h2 id="apex-google-settings-title" className="apex-radar-modal__title">
                            Apex Radar — Google Ads
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
                                <label className="apex-radar-field-label" htmlFor="apex-google-budget">
                                    Budget (mål)
                                </label>
                                <input
                                    id="apex-google-budget"
                                    type="number"
                                    min={0}
                                    step="any"
                                    value={targetBudget}
                                    onChange={(e) => setTargetBudget(e.target.value)}
                                    placeholder="Fx. månedligt budget"
                                />
                            </div>
                            <div>
                                <label className="apex-radar-field-label" htmlFor="apex-google-metric">
                                    Target type
                                </label>
                                <select
                                    id="apex-google-metric"
                                    value={targetMetricType}
                                    onChange={(e) => setTargetMetricType(e.target.value)}
                                >
                                    <option value="ROAS">ROAS</option>
                                    <option value="CPA">CPA</option>
                                </select>
                            </div>
                            <div>
                                <label className="apex-radar-field-label" htmlFor="apex-google-target-val">
                                    Target {targetMetricType === "CPA" ? "(CPA)" : "(ROAS)"}
                                </label>
                                <input
                                    id="apex-google-target-val"
                                    type="number"
                                    min={0}
                                    step="any"
                                    value={targetValue}
                                    onChange={(e) => setTargetValue(e.target.value)}
                                    placeholder={targetMetricType === "CPA" ? "Fx. 250" : "Fx. 5"}
                                />
                            </div>
                            <div>
                                <label className="apex-radar-field-label" htmlFor="apex-google-budget-mode">
                                    Budget type
                                </label>
                                <select
                                    id="apex-google-budget-mode"
                                    value={budgetMode}
                                    onChange={(e) => setBudgetMode(e.target.value)}
                                >
                                    <option value="DYNAMIC">Dynamisk</option>
                                    <option value="STATIC">Statisk</option>
                                </select>
                            </div>
                            <div className="flex items-start gap-2 pt-1">
                                <input
                                    id="apex-google-tracking-alerts"
                                    type="checkbox"
                                    checked={trackingAlertsEnabled}
                                    onChange={(e) => setTrackingAlertsEnabled(e.target.checked)}
                                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-ink)]"
                                />
                                <div>
                                    <label
                                        htmlFor="apex-google-tracking-alerts"
                                        className="apex-radar-field-label !mb-0 normal-case !text-[0.72rem]"
                                    >
                                        Conversion tracking alerts
                                    </label>
                                    <p className="apex-radar-field-hint !mt-1">
                                        Turn off for accounts with unreliable conversion tracking.
                                    </p>
                                </div>
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
