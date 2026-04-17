"use client";

import React, { useEffect, useState } from "react";
import { FiX } from "react-icons/fi";
import { getFacebookApexRadarSettings } from "@/lib/apexRadarCustomerSettings";
import { isDemoCustomerId } from "@/lib/demoCustomer";

export default function ApexRadarFacebookSettingsModal({ row, onClose, onSaved }) {
    const initial = row ? getFacebookApexRadarSettings(row) : getFacebookApexRadarSettings({});

    const [targetBudget, setTargetBudget] = useState(
        initial.targetBudget != null ? String(initial.targetBudget) : ""
    );
    const [targetMetricType, setTargetMetricType] = useState(initial.targetMetricType);
    const [targetValue, setTargetValue] = useState(
        initial.targetValue != null ? String(initial.targetValue) : ""
    );
    const [budgetMode, setBudgetMode] = useState(initial.budgetMode);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const isDemo = row?.id && isDemoCustomerId(row.id);

    useEffect(() => {
        if (!row) return;
        const v = getFacebookApexRadarSettings(row);
        setTargetBudget(v.targetBudget != null ? String(v.targetBudget) : "");
        setTargetMetricType(v.targetMetricType);
        setTargetValue(v.targetValue != null ? String(v.targetValue) : "");
        setBudgetMode(v.budgetMode);
        setError(null);
    }, [row]);

    if (!row) return null;

    const handleSave = async () => {
        if (isDemo) return;
        setSaving(true);
        setError(null);
        try {
            const res = await fetch(`/api/apex-radar/facebook/customer-settings/${row.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    targetBudget: targetBudget.trim() === "" ? null : Number(targetBudget),
                    targetMetricType,
                    targetValue: targetValue.trim() === "" ? null : Number(targetValue),
                    budgetMode,
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

    const labelCls = "block text-xs font-semibold text-gray-500 mb-1.5";
    const inputCls =
        "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-searchmind)]";

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/45"
            role="dialog"
            aria-modal="true"
            aria-labelledby="apex-fb-settings-title"
        >
            <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white overflow-hidden shadow-lg">
                <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100">
                    <div>
                        <h2 id="apex-fb-settings-title" className="text-lg font-semibold text-gray-900">
                            Apex Radar — Facebook
                        </h2>
                        <p className="text-xs text-gray-500 mt-1">{row.entity}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                        aria-label="Close"
                    >
                        <FiX className="h-5 w-5" />
                    </button>
                </div>

                <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
                    {isDemo ? (
                        <p className="text-sm text-gray-500">Demo properties cannot be edited.</p>
                    ) : (
                        <>
                            <div>
                                <label className={labelCls} htmlFor="apex-fb-budget">
                                    Budget (mål)
                                </label>
                                <input
                                    id="apex-fb-budget"
                                    type="number"
                                    min={0}
                                    step="any"
                                    className={inputCls}
                                    value={targetBudget}
                                    onChange={(e) => setTargetBudget(e.target.value)}
                                    placeholder="Fx. månedligt budget"
                                />
                            </div>
                            <div>
                                <label className={labelCls} htmlFor="apex-fb-metric">
                                    Target type
                                </label>
                                <select
                                    id="apex-fb-metric"
                                    className={inputCls}
                                    value={targetMetricType}
                                    onChange={(e) => setTargetMetricType(e.target.value)}
                                >
                                    <option value="ROAS">ROAS</option>
                                    <option value="CPA">CPA</option>
                                </select>
                            </div>
                            <div>
                                <label className={labelCls} htmlFor="apex-fb-target-val">
                                    Target {targetMetricType === "CPA" ? "(CPA)" : "(ROAS)"}
                                </label>
                                <input
                                    id="apex-fb-target-val"
                                    type="number"
                                    min={0}
                                    step="any"
                                    className={inputCls}
                                    value={targetValue}
                                    onChange={(e) => setTargetValue(e.target.value)}
                                    placeholder={targetMetricType === "CPA" ? "Fx. 250" : "Fx. 5"}
                                />
                            </div>
                            <div>
                                <label className={labelCls} htmlFor="apex-fb-budget-mode">
                                    Budget type
                                </label>
                                <select
                                    id="apex-fb-budget-mode"
                                    className={inputCls}
                                    value={budgetMode}
                                    onChange={(e) => setBudgetMode(e.target.value)}
                                >
                                    <option value="DYNAMIC">Dynamisk</option>
                                    <option value="STATIC">Statisk</option>
                                </select>
                            </div>
                            {error ? <p className="text-sm text-red-600">{error}</p> : null}
                        </>
                    )}
                </div>

                <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50">
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-xs font-semibold text-gray-700 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        disabled={saving || isDemo}
                        onClick={handleSave}
                        className="text-xs font-semibold text-white px-3 py-2 rounded-lg bg-[var(--color-primary-searchmind)] hover:bg-[var(--color-primary-searchmind-hover)] transition-colors disabled:opacity-50"
                    >
                        {saving ? "Saving…" : "Save"}
                    </button>
                </div>
            </div>
        </div>
    );
}
