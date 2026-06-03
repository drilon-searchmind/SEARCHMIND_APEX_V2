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
        <div className="border border-gray-200 rounded-lg p-3 mb-3 last:mb-0">
            <div className="flex justify-between items-center mb-2">
                <div>
                    <p className="text-sm font-medium text-gray-800">{label}</p>
                    <p className="text-xs text-gray-500">Per month</p>
                </div>
                <button
                    type="button"
                    onClick={addItem}
                    disabled={disabled}
                    className="flex items-center gap-1 text-sm text-[var(--color-primary-searchmind)] hover:opacity-80 disabled:opacity-50"
                >
                    <FiPlus size={16} />
                    Add item
                </button>
            </div>
            {items.length === 0 ? (
                <p className="text-sm text-gray-400">No items yet.</p>
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
                                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                            />
                            <input
                                type="number"
                                placeholder="Amount"
                                min={0}
                                step={0.01}
                                value={item.amount ?? 0}
                                onChange={(e) => updateItem(index, "amount", e.target.value)}
                                disabled={disabled}
                                className="w-28 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => removeItem(index)}
                                disabled={disabled}
                                className="text-red-500 hover:text-red-700 p-1"
                                aria-label="Remove item"
                            >
                                <FiX size={18} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
            <div className="pt-2 mt-2 border-t border-gray-100 flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-semibold text-[var(--color-primary-searchmind)] tabular-nums">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center glassmorphism2 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col relative">
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10"
                    aria-label="Close"
                >
                    <FiX className="text-2xl" />
                </button>
                <div className="p-6 pb-2 shrink-0">
                    <h2 className="text-lg font-semibold text-gray-900 mb-1">
                        Fixed expenses
                    </h2>
                    <p className="text-sm text-gray-500">
                        Monthly fixed costs (same as config). Prorated across the selected
                        date range on this dashboard.
                    </p>
                </div>
                <div className="px-6 overflow-y-auto flex-1">
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
                <div className="p-6 pt-3 shrink-0 border-t border-gray-100">
                    <div className="flex justify-between items-center mb-4 text-sm">
                        <span className="font-semibold text-gray-700">Total per month</span>
                        <span className="font-semibold text-[var(--color-primary-searchmind)] tabular-nums">
                            {grandTotal.toLocaleString("da-DK", {
                                style: "currency",
                                currency: "DKK",
                            })}
                        </span>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary-searchmind)] rounded-lg disabled:opacity-50"
                        >
                            {saving ? "Saving…" : "Save & refresh"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
