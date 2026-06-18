"use client";

import React, { useState, useEffect } from "react";
import { FiX, FiPlus } from "react-icons/fi";

const LINE_ITEM_GROUPS = [
    { field: "marketingBureauCostLineItems", label: "Marketing Bureau Cost" },
    { field: "marketingToolingCostLineItems", label: "Marketing Tooling Cost" },
    { field: "fixedExpensesLineItems", label: "Other Fixed Expenses" },
];

function emptyLineItemsState(initial) {
    return {
        marketingBureauCostLineItems: [...(initial?.marketingBureauCostLineItems || [])],
        marketingToolingCostLineItems: [...(initial?.marketingToolingCostLineItems || [])],
        fixedExpensesLineItems: [...(initial?.fixedExpensesLineItems || [])],
    };
}

function LineItemsSection({ field, label, items, onChange, disabled }) {
    const total = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

    const updateItem = (index, key, value) => {
        const next = items.map((item, i) =>
            i === index
                ? {
                      ...item,
                      [key]: key === "amount" ? parseFloat(value) || 0 : value,
                  }
                : item
        );
        onChange(field, next);
    };

    const addItem = () => {
        onChange(field, [...items, { name: "", amount: 0 }]);
    };

    const removeItem = (index) => {
        onChange(field, items.filter((_, i) => i !== index));
    };

    return (
        <div className="border border-[var(--color-rule)] rounded-[var(--radius-input)] p-3 mb-3 last:mb-0 bg-[var(--color-paper-2)]">
            <div className="flex justify-between items-center mb-2">
                <div>
                    <p className="text-sm font-medium text-[var(--color-ink)]">{label}</p>
                    <p className="text-xs text-[var(--color-muted)]">Per month</p>
                </div>
                <button
                    type="button"
                    onClick={addItem}
                    disabled={disabled}
                    className="flex items-center gap-1 text-sm text-[var(--color-accent)] hover:opacity-80 disabled:opacity-50"
                >
                    <FiPlus size={16} />
                    Add item
                </button>
            </div>
            {items.length === 0 ? (
                <p className="text-sm text-[var(--color-muted)]">No items yet.</p>
            ) : (
                <div className="space-y-2">
                    {items.map((item, index) => (
                        <div key={index} className="flex gap-2 items-center">
                            <input
                                type="text"
                                placeholder="Item name"
                                value={item.name || ""}
                                onChange={(e) => updateItem(index, "name", e.target.value)}
                                disabled={disabled}
                                className="apex-perf-modal__input flex-1"
                            />
                            <input
                                type="number"
                                placeholder="Amount"
                                min={0}
                                step={0.01}
                                value={item.amount ?? 0}
                                onChange={(e) => updateItem(index, "amount", e.target.value)}
                                disabled={disabled}
                                className="apex-perf-modal__input w-28"
                            />
                            <button
                                type="button"
                                onClick={() => removeItem(index)}
                                disabled={disabled}
                                className="text-[var(--color-error)] hover:opacity-80 p-1"
                                aria-label="Remove item"
                            >
                                <FiX size={18} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
            <div className="pt-2 mt-2 border-t border-[var(--color-rule)] flex justify-between text-sm">
                <span className="text-[var(--color-muted)]">Subtotal</span>
                <span className="font-semibold text-[var(--color-accent)] tabular-nums">
                    {total.toLocaleString("da-DK", {
                        style: "currency",
                        currency: "DKK",
                    })}
                </span>
            </div>
        </div>
    );
}

export default function FixedExpensesSettingsModal({
    open,
    onClose,
    initialStaticExpenses = {},
    onSave,
    saving = false,
}) {
    const [lineItems, setLineItems] = useState(() =>
        emptyLineItemsState(initialStaticExpenses)
    );

    useEffect(() => {
        if (open) {
            setLineItems(emptyLineItemsState(initialStaticExpenses));
        }
    }, [open, initialStaticExpenses]);

    if (!open) return null;

    const handleLineItemsChange = (field, value) => {
        setLineItems((prev) => ({ ...prev, [field]: value }));
    };

    const grandTotal = LINE_ITEM_GROUPS.reduce((sum, g) => {
        const items = lineItems[g.field] || [];
        return sum + items.reduce((s, item) => s + (parseFloat(item.amount) || 0), 0);
    }, 0);

    const handleSave = () => {
        onSave({
            ...initialStaticExpenses,
            ...lineItems,
        });
    };

    return (
        <div className="apex-perf-modal-scrim">
            <div className="apex-perf-modal apex-perf-modal--wide apex-perf-modal--scroll">
                <button
                    type="button"
                    onClick={onClose}
                    className="apex-perf-modal__close"
                    aria-label="Close"
                >
                    <FiX className="text-xl" />
                </button>
                <div className="shrink-0">
                    <h2 className="apex-perf-modal__title">Fixed expenses</h2>
                    <p className="apex-perf-modal__lede mb-0">
                        Monthly fixed costs (same as config). Prorated across the selected
                        date range on this dashboard.
                    </p>
                </div>
                <div className="apex-perf-modal__body mt-4">
                    {LINE_ITEM_GROUPS.map((g) => (
                        <LineItemsSection
                            key={g.field}
                            field={g.field}
                            label={g.label}
                            items={lineItems[g.field] || []}
                            onChange={handleLineItemsChange}
                            disabled={saving}
                        />
                    ))}
                </div>
                <div className="apex-perf-modal__footer">
                    <div className="flex justify-between items-center mb-4 text-sm">
                        <span className="font-semibold text-[var(--color-ink-2)]">Total per month</span>
                        <span className="font-semibold text-[var(--color-accent)] tabular-nums">
                            {grandTotal.toLocaleString("da-DK", {
                                style: "currency",
                                currency: "DKK",
                            })}
                        </span>
                    </div>
                    <div className="apex-perf-modal__actions mt-0">
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
        </div>
    );
}
