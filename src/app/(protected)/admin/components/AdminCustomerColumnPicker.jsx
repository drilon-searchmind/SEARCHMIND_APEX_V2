"use client";

import React, { useEffect, useRef, useState } from "react";
import { FiColumns, FiX } from "react-icons/fi";
import {
    ADMIN_CUSTOMER_ALL_TOGGLEABLE_COLUMNS,
    ADMIN_CUSTOMERS_COLUMNS_STORAGE_KEY,
} from "@root/lib/adminCustomerTableColumns";
import {
    ADMIN_MISSING_CUSTOMER_OPTIONAL_COLUMNS,
    ADMIN_MISSING_CUSTOMERS_COLUMNS_STORAGE_KEY,
} from "@root/lib/adminMissingCustomerTableColumns";

function loadStoredColumnIds(storageKey, validIds) {
    if (typeof window === "undefined") return [];
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        const valid = new Set(validIds);
        return parsed.filter((id) => valid.has(id));
    } catch {
        return [];
    }
}

export function useAdminCustomerOptionalColumns() {
    const [optionalColumnIds, setOptionalColumnIds] = useState([]);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        setOptionalColumnIds(
            loadStoredColumnIds(
                ADMIN_CUSTOMERS_COLUMNS_STORAGE_KEY,
                ADMIN_CUSTOMER_ALL_TOGGLEABLE_COLUMNS.map((c) => c.id)
            )
        );
        setHydrated(true);
    }, []);

    const persist = (ids) => {
        setOptionalColumnIds(ids);
        try {
            localStorage.setItem(ADMIN_CUSTOMERS_COLUMNS_STORAGE_KEY, JSON.stringify(ids));
        } catch {
            /* ignore quota */
        }
    };

    return { optionalColumnIds, setOptionalColumnIds: persist, hydrated };
}

export function useAdminMissingCustomerOptionalColumns() {
    const [optionalColumnIds, setOptionalColumnIds] = useState([]);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        setOptionalColumnIds(
            loadStoredColumnIds(
                ADMIN_MISSING_CUSTOMERS_COLUMNS_STORAGE_KEY,
                ADMIN_MISSING_CUSTOMER_OPTIONAL_COLUMNS.map((c) => c.id)
            )
        );
        setHydrated(true);
    }, []);

    const persist = (ids) => {
        setOptionalColumnIds(ids);
        try {
            localStorage.setItem(ADMIN_MISSING_CUSTOMERS_COLUMNS_STORAGE_KEY, JSON.stringify(ids));
        } catch {
            /* ignore quota */
        }
    };

    return { optionalColumnIds, setOptionalColumnIds: persist, hydrated };
}

export default function AdminCustomerColumnPicker({
    selectedIds,
    onChange,
    columns = ADMIN_CUSTOMER_ALL_TOGGLEABLE_COLUMNS,
    resetLabel = "Reset to default",
    description = "Default view unchanged. Add IDs and extra integration checks.",
}) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState(selectedIds);
    const panelRef = useRef(null);

    useEffect(() => {
        if (open) setDraft(selectedIds);
    }, [open, selectedIds]);

    useEffect(() => {
        if (!open) return undefined;
        const onDoc = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", onDoc);
        return () => document.removeEventListener("mousedown", onDoc);
    }, [open]);

    const grouped = React.useMemo(() => {
        const draftSet = new Set(draft);
        /** @type {Record<string, typeof columns>} */
        const map = {};
        for (const col of columns) {
            const g = col.group || "Other";
            if (!map[g]) map[g] = [];
            map[g].push({ ...col, _selected: draftSet.has(col.id) });
        }
        return map;
    }, [draft, columns]);

    const toggle = (id) => {
        setDraft((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    const apply = () => {
        onChange(draft);
        setOpen(false);
    };

    const reset = () => {
        setDraft([]);
        onChange([]);
        setOpen(false);
    };

    return (
        <div className="relative" ref={panelRef}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="inline-flex items-center gap-2 h-11 px-4 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
                <FiColumns size={16} />
                Columns
                {selectedIds.length > 0 ? (
                    <span className="text-xs bg-[var(--color-primary-searchmind)] text-white rounded-full px-2 py-0.5">
                        +{selectedIds.length}
                    </span>
                ) : null}
            </button>

            {open ? (
                <div className="absolute right-0 top-full mt-2 z-50 w-[min(420px,calc(100vw-2rem))] bg-white border border-gray-200 rounded-xl shadow-xl">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                        <div>
                            <p className="text-sm font-semibold text-gray-900">Table columns</p>
                            <p className="text-xs text-gray-500 mt-0.5">{description}</p>
                        </div>
                        <button
                            type="button"
                            className="p-1 text-gray-400 hover:text-gray-600"
                            onClick={() => setOpen(false)}
                            aria-label="Close"
                        >
                            <FiX size={18} />
                        </button>
                    </div>
                    <div className="max-h-[min(420px,60vh)] overflow-y-auto p-4 space-y-4">
                        {Object.entries(grouped).map(([group, cols]) => (
                            <div key={group}>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                    {group}
                                </p>
                                <div className="space-y-1">
                                    {cols.map((col) => (
                                        <label
                                            key={col.id}
                                            className="flex items-start gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                                        >
                                            <input
                                                type="checkbox"
                                                className="mt-0.5 rounded border-gray-300"
                                                checked={col._selected}
                                                onChange={() => toggle(col.id)}
                                            />
                                            <span className="text-sm text-gray-800">{col.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl">
                        <button
                            type="button"
                            className="text-xs text-gray-600 hover:text-gray-900 underline"
                            onClick={reset}
                        >
                            {resetLabel}
                        </button>
                        <button
                            type="button"
                            className="px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--color-primary-searchmind)] text-white hover:opacity-90"
                            onClick={apply}
                        >
                            Apply columns
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
