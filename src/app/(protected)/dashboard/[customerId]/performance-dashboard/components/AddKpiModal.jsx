"use client";

import React, { useState, useEffect, useMemo } from "react";
import { FiX, FiPlus, FiTrash2 } from "react-icons/fi";
import {
    FiDollarSign,
    FiTrendingUp,
    FiShoppingCart,
    FiCreditCard,
    FiBarChart2,
    FiPieChart,
    FiShoppingBag,
    FiUserCheck,
} from "react-icons/fi";
import {
    SHOPIFY_REVENUE_FORMULA_METRIC_DEFS,
    CUSTOM_KPI_OTHER_METRIC_DEFS,
} from "@/lib/performanceDashboard/performanceDashboardConstants";

const METRIC_ICONS = {
    net_sales: FiDollarSign,
    revenue: FiDollarSign,
    total_sales: FiDollarSign,
    gross_sales: FiDollarSign,
    discounts: FiDollarSign,
    returns: FiTrendingUp,
    shipping_revenue: FiDollarSign,
    duties: FiDollarSign,
    additional_fees: FiDollarSign,
    tax: FiDollarSign,
    gross_profit: FiDollarSign,
    orders: FiShoppingCart,
    shipping_cost: FiCreditCard,
    transaction_fee: FiDollarSign,
    cogs: FiDollarSign,
    cost: FiCreditCard,
    meta_spend: FiCreditCard,
    google_spend: FiCreditCard,
    pinterest_spend: FiCreditCard,
    snapchat_spend: FiCreditCard,
    bing_spend: FiCreditCard,
    reddit_spend: FiCreditCard,
    roas: FiBarChart2,
    poas: FiPieChart,
    aov: FiShoppingBag,
    cac: FiUserCheck,
    spendshare: FiBarChart2,
};

export const AVAILABLE_METRICS = [
    ...SHOPIFY_REVENUE_FORMULA_METRIC_DEFS.map((m) => ({
        ...m,
        icon: METRIC_ICONS[m.key] || FiDollarSign,
    })),
    ...CUSTOM_KPI_OTHER_METRIC_DEFS.map((m) => ({
        ...m,
        icon: METRIC_ICONS[m.key] || FiDollarSign,
    })),
];

const PER_CHANNEL_SPEND_METRIC_KEYS = new Set(
    AVAILABLE_METRICS.filter((m) => m.key.endsWith("_spend")).map((m) => m.key)
);

const OPERATORS = [
    { key: "/", label: "÷" },
    { key: "*", label: "×" },
    { key: "+", label: "+" },
    { key: "-", label: "−" },
];

// Normalize KPI to parts format (supports single metric, formula, or legacy)
function toPartsForm(kpi) {
    if (kpi.parts && Array.isArray(kpi.parts) && kpi.parts.length >= 1) {
        return kpi.parts;
    }
    if (kpi.metricA && kpi.metricB && kpi.operator) {
        return [
            { type: "metric", value: kpi.metricA },
            { type: "operator", value: kpi.operator },
            { type: "metric", value: kpi.metricB },
        ];
    }
    if (kpi.metricA) {
        return [{ type: "metric", value: kpi.metricA }];
    }
    return [{ type: "metric", value: "" }];
}

export default function AddKpiModal({
    onClose,
    onSave,
    editingKpi = null,
    saving = false,
    visibleSpendMetricKeys,
    availableMetrics = AVAILABLE_METRICS,
    formulaHelpText,
}) {
    const [name, setName] = useState("");
    const [parts, setParts] = useState([]);

    useEffect(() => {
        if (editingKpi) {
            setName(editingKpi.name || "");
            setParts(toPartsForm(editingKpi));
        } else {
            setParts([{ type: "metric", value: "" }]);
        }
    }, [editingKpi]);

    const modalMetricOptions = useMemo(() => {
        const allow =
            visibleSpendMetricKeys != null
                ? new Set(visibleSpendMetricKeys)
                : null;
        const selectedKeys = new Set(
            parts
                .filter((p) => p.type === "metric")
                .map((p) => p.value)
                .filter(Boolean)
        );
        return availableMetrics.filter((m) => {
            if (!PER_CHANNEL_SPEND_METRIC_KEYS.has(m.key)) return true;
            if (selectedKeys.has(m.key)) return true;
            if (!allow) return true;
            return allow.has(m.key);
        });
    }, [parts, visibleSpendMetricKeys]);

    const setPart = (idx, field, val) => {
        setParts((p) => {
            const next = [...p];
            if (!next[idx]) next[idx] = { type: parts[idx].type, value: "" };
            next[idx] = { ...next[idx], [field]: val };
            return next;
        });
    };

    const addOperation = () => {
        setParts((p) => [
            ...p,
            { type: "operator", value: "+" },
            { type: "metric", value: "" },
        ]);
    };

    const removeOperation = (opIdx) => {
        // opIdx is the index of the operator before the metric to remove - remove operator and metric
        if (opIdx < 1 || opIdx >= parts.length - 1) return;
        setParts((p) => p.filter((_, i) => i !== opIdx && i !== opIdx + 1));
    };

    const metricIndices = parts
        .map((p, i) => (p.type === "metric" ? i : -1))
        .filter((i) => i >= 0);
    const lastMetricIdx = metricIndices[metricIndices.length - 1];

    const handleSave = () => {
        if (!name.trim()) return;
        const metrics = parts.filter((pt) => pt.type === "metric");
        const operators = parts.filter((pt) => pt.type === "operator");
        if (metrics.length < 1 || metrics.some((m) => !m.value)) return;
        if (operators.length !== 0 && operators.length !== metrics.length - 1) return;

        onSave({
            id: editingKpi?.id || `kpi_${Date.now()}`,
            name: name.trim(),
            parts,
        });
        onClose();
    };

    const formulaPreview = parts
        .map((p) => {
            if (p.type === "metric") {
                const m = availableMetrics.find((x) => x.key === p.value);
                return m ? m.label : p.value || "?";
            }
            return OPERATORS.find((o) => o.key === p.value)?.label ?? p.value;
        })
        .join(" ");

    const metricCount = parts.filter((p) => p.type === "metric").length;
    const allMetricsFilled = parts
        .filter((p) => p.type === "metric")
        .every((p) => p.value);
    const isValid = name.trim() && metricCount >= 1 && allMetricsFilled;

    return (
        <div className="apex-perf-modal-scrim">
            <div className="apex-perf-modal apex-perf-modal--wide apex-perf-modal--scroll">
                <button
                    onClick={onClose}
                    className="apex-perf-modal__close"
                    aria-label="Close modal"
                >
                    <FiX className="text-xl" />
                </button>

                <div className="apex-perf-modal__body">
                    <h2 className="apex-perf-modal__title">
                        {editingKpi ? "Edit KPI" : "Add KPI"}
                    </h2>

                    <div className="mb-4">
                        <label className="apex-perf-modal__field-label">KPI Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Revenue per Order"
                            className="apex-perf-modal__input"
                        />
                    </div>

                    <div className="mb-4">
                        <label className="apex-perf-modal__field-label">Formula</label>
                        <p className="text-xs text-[var(--color-muted)] mb-3">
                            {formulaHelpText ||
                                "Select a single metric (e.g. Orders) or build a formula with multiple metrics and operators. Calculations run left to right (e.g. Revenue ÷ Orders × 100). Shopify revenue metrics use store data only (returns % override does not apply here)."}
                        </p>

                        <div className="flex flex-wrap items-center gap-2">
                            {parts.map((part, idx) => {
                                if (part.type === "metric") {
                                    const isFirstMetric = parts.findIndex((p) => p.type === "metric") === idx;
                                    return (
                                        <React.Fragment key={idx}>
                                            {!isFirstMetric && (
                                                <select
                                                    value={parts[idx - 1]?.value || "+"}
                                                    onChange={(e) => setPart(idx - 1, "value", e.target.value)}
                                                    className="apex-perf-modal__input w-16 font-medium bg-[var(--color-paper-2)]"
                                                >
                                                    {OPERATORS.map((op) => (
                                                        <option key={op.key} value={op.key}>
                                                            {op.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            )}
                                            <select
                                                value={part.value}
                                                onChange={(e) => setPart(idx, "value", e.target.value)}
                                                className="apex-perf-modal__input min-w-[140px]"
                                            >
                                                <option value="">Select metric</option>
                                                {modalMetricOptions.map((m) => (
                                                    <option key={m.key} value={m.key}>
                                                        {m.label}
                                                    </option>
                                                ))}
                                            </select>
                                            {!isFirstMetric && idx === lastMetricIdx && parts.length > 4 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeOperation(idx - 1)}
                                                    className="apex-perf-icon-btn hover:text-[var(--color-error)]"
                                                    aria-label="Remove last operation"
                                                >
                                                    <FiTrash2 className="text-sm" />
                                                </button>
                                            )}
                                        </React.Fragment>
                                    );
                                }
                                return null;
                            })}

                            <button
                                type="button"
                                onClick={addOperation}
                                className="flex items-center gap-1.5 px-2 py-1.5 text-sm font-medium text-[var(--color-accent)] hover:bg-[var(--color-paper-2)] rounded-[var(--radius-input)] transition-colors border border-dashed border-[var(--color-rule)]"
                            >
                                <FiPlus className="text-sm" />
                                Add
                            </button>
                        </div>

                        {formulaPreview && (
                            <div className="mt-3 px-3 py-2 apex-perf-calc">
                                <p className="text-xs text-[var(--color-muted)]">Preview</p>
                                <p className="text-sm font-medium text-[var(--color-ink)] font-mono">
                                    {formulaPreview}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="apex-perf-modal__footer">
                    <div className="apex-perf-modal__actions mt-0">
                        <button
                            onClick={onClose}
                            className="apex-perf-btn"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!isValid || saving}
                            className="apex-perf-btn apex-perf-btn--primary"
                        >
                            {saving ? "Saving..." : "Save"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
