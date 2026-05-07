"use client";

import React, { useState } from "react";
import FormButton from "@/components/form/FormButton";
import { FiX } from "react-icons/fi";

export default function ParentPropertyGroupSettingsModal({ onClose, draft, onApply }) {
    const [rev, setRev] = useState(draft.shopifyRevenueField);
    const [metric, setMetric] = useState(draft.groupMetricPreference);

    const handleSubmit = (e) => {
        e.preventDefault();
        onApply({ shopifyRevenueField: rev, groupMetricPreference: metric });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div
                role="dialog"
                aria-labelledby="parent-group-settings-title"
                className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-md overflow-hidden"
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <h2 id="parent-group-settings-title" className="text-base font-semibold text-gray-900">
                        Group view settings
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                        aria-label="Close"
                    >
                        <FiX className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="px-5 py-5 space-y-6">
                    <div>
                        <p className="text-sm font-medium text-gray-800 mb-2">Shopify revenue basis</p>
                        <div className="flex flex-col gap-2">
                            <label className="flex items-center gap-2 cursor-pointer text-sm">
                                <input
                                    type="radio"
                                    name="revenueBasis"
                                    checked={rev === "net_sales"}
                                    onChange={() => setRev("net_sales")}
                                    className="rounded-full border-gray-300 text-[var(--color-primary-searchmind)] focus:ring-[var(--color-primary-searchmind)]"
                                />
                                <span>Net sales</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer text-sm">
                                <input
                                    type="radio"
                                    name="revenueBasis"
                                    checked={rev === "gross_sales"}
                                    onChange={() => setRev("gross_sales")}
                                    className="rounded-full border-gray-300 text-[var(--color-primary-searchmind)] focus:ring-[var(--color-primary-searchmind)]"
                                />
                                <span>Gross sales</span>
                            </label>
                        </div>
                    </div>

                    <div>
                        <p className="text-sm font-medium text-gray-800 mb-2">Primary efficiency metric</p>
                        <div className="flex flex-col gap-2">
                            <label className="flex items-center gap-2 cursor-pointer text-sm">
                                <input
                                    type="radio"
                                    name="groupMetric"
                                    checked={metric === "ROAS/POAS"}
                                    onChange={() => setMetric("ROAS/POAS")}
                                    className="rounded-full border-gray-300 text-[var(--color-primary-searchmind)] focus:ring-[var(--color-primary-searchmind)]"
                                />
                                <span>ROAS</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer text-sm">
                                <input
                                    type="radio"
                                    name="groupMetric"
                                    checked={metric === "Spendshare"}
                                    onChange={() => setMetric("Spendshare")}
                                    className="rounded-full border-gray-300 text-[var(--color-primary-searchmind)] focus:ring-[var(--color-primary-searchmind)]"
                                />
                                <span>Spendshare</span>
                            </label>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                        <FormButton type="button" borderType="outline" buttonSize="small" onClick={onClose}>
                            Cancel
                        </FormButton>
                        <FormButton type="submit" borderType="" buttonSize="small">
                            Apply
                        </FormButton>
                    </div>
                </form>
            </div>
        </div>
    );
}
