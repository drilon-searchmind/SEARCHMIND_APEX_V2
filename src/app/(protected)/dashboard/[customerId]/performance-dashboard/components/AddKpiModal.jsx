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
        <div className="fixed inset-0 z-50 flex items-center justify-center glassmorphism2">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl relative max-h-[90vh] overflow-hidden flex flex-col">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label="Close modal"
                >
                    <FiX className="text-2xl" />
                </button>

                <div className="p-6 overflow-y-auto flex-1">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">
                        {editingKpi ? "Edit KPI" : "Add KPI"}
                    </h2>

                    {/* KPI Name */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            KPI Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Revenue per Order"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-searchmind)] focus:ring-opacity-20"
                        />
                    </div>

                    {/* Formula Section */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Formula
                        </label>
                        <p className="text-xs text-gray-500 mb-3">
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
                                                    className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-searchmind)] focus:ring-opacity-20 bg-gray-50"
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
                                                className="min-w-[140px] border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-searchmind)] focus:ring-opacity-20"
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
                                                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"
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
                                className="flex items-center gap-1.5 px-2 py-1.5 text-sm font-medium text-[var(--color-primary-searchmind)] hover:bg-gray-50 rounded-lg transition-colors border border-dashed border-gray-200"
                            >
                                <FiPlus className="text-sm" />
                                Add
                            </button>
                        </div>

                        {formulaPreview && (
                            <div className="mt-3 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
                                <p className="text-xs text-gray-500">Preview</p>
                                <p className="text-sm font-medium text-gray-900 font-mono">
                                    {formulaPreview}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions - sticky bottom */}
                <div className="p-4 pt-0 flex gap-2 justify-end border-t border-gray-100">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!isValid || saving}
                        className="px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary-searchmind)] rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? "Saving..." : "Save"}
                    </button>
                </div>
            </div>
        </div>
    );
}
