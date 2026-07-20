"use client";

import React, { useState } from "react";
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
        <div className="apex-perf-modal-scrim apex-perf">
            <div className="apex-perf-modal" role="dialog" aria-labelledby="parent-group-settings-title">
                <button
                    type="button"
                    onClick={onClose}
                    className="apex-perf-modal__close"
                    aria-label="Close"
                >
                    <FiX className="text-xl" />
                </button>
                <h2 id="parent-group-settings-title" className="apex-perf-modal__title">
                    Group view settings
                </h2>
                <p className="apex-perf-modal__lede">
                    Choose revenue basis and primary efficiency metric for the group dashboard.
                </p>

                <form onSubmit={handleSubmit}>
                    <div className="mb-5">
                        <p className="apex-perf-modal__field-label mb-2">Shopify revenue basis</p>
                        <div className="flex flex-col gap-2">
                            <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--color-ink-2)]">
                                <input
                                    type="radio"
                                    name="revenueBasis"
                                    checked={rev === "net_sales"}
                                    onChange={() => setRev("net_sales")}
                                    className="apex-parent-checkbox rounded-full"
                                />
                                <span>Net sales</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--color-ink-2)]">
                                <input
                                    type="radio"
                                    name="revenueBasis"
                                    checked={rev === "gross_sales"}
                                    onChange={() => setRev("gross_sales")}
                                    className="apex-parent-checkbox rounded-full"
                                />
                                <span>Gross sales</span>
                            </label>
                        </div>
                    </div>

                    <div className="mb-5">
                        <p className="apex-perf-modal__field-label mb-2">Primary efficiency metric</p>
                        <div className="flex flex-col gap-2">
                            <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--color-ink-2)]">
                                <input
                                    type="radio"
                                    name="groupMetric"
                                    checked={metric === "ROAS/POAS"}
                                    onChange={() => setMetric("ROAS/POAS")}
                                    className="apex-parent-checkbox rounded-full"
                                />
                                <span>ROAS</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--color-ink-2)]">
                                <input
                                    type="radio"
                                    name="groupMetric"
                                    checked={metric === "Spendshare"}
                                    onChange={() => setMetric("Spendshare")}
                                    className="apex-parent-checkbox rounded-full"
                                />
                                <span>Spendshare</span>
                            </label>
                        </div>
                    </div>

                    <div className="apex-perf-modal__actions">
                        <button type="button" onClick={onClose} className="apex-perf-btn">
                            Cancel
                        </button>
                        <button type="submit" className="apex-perf-btn apex-perf-btn--primary">
                            Apply
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
