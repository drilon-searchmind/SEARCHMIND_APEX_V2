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
    /** 'extra' = badge shows +N optional columns (admin). 'none' = hide badge. */
    selectionBadge = "extra",
    /** When set, Reset uses these ids instead of []. */
    getResetIds,
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
        const resetIds = getResetIds ? getResetIds() : [];
        setDraft(resetIds);
        onChange(resetIds);
        setOpen(false);
    };

    return (
        <div className="apex-admin-column-picker" ref={panelRef}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="apex-admin-column-picker__trigger"
            >
                <FiColumns size={16} />
                Columns
                {selectionBadge === "extra" && selectedIds.length > 0 ? (
                    <span className="apex-admin-column-picker__count">
                        +{selectedIds.length}
                    </span>
                ) : null}
            </button>

            {open ? (
                <div className="apex-admin-column-picker__panel">
                    <div className="apex-admin-column-picker__head">
                        <div>
                            <p className="apex-admin-column-picker__title">Table columns</p>
                            <p className="apex-admin-column-picker__desc">{description}</p>
                        </div>
                        <button
                            type="button"
                            className="apex-admin-link-btn apex-admin-link-btn--muted"
                            onClick={() => setOpen(false)}
                            aria-label="Close"
                        >
                            <FiX size={18} />
                        </button>
                    </div>
                    <div className="apex-admin-column-picker__body">
                        {Object.entries(grouped).map(([group, cols]) => (
                            <div key={group} className="apex-admin-column-picker__group">
                                <p className="apex-admin-column-picker__group-label">{group}</p>
                                {cols.map((col) => (
                                    <label key={col.id} className="apex-admin-column-picker__option">
                                        <input
                                            type="checkbox"
                                            checked={col._selected}
                                            onChange={() => toggle(col.id)}
                                        />
                                        <span>{col.label}</span>
                                    </label>
                                ))}
                            </div>
                        ))}
                    </div>
                    <div className="apex-admin-column-picker__foot">
                        <button type="button" className="apex-admin-link-btn" onClick={reset}>
                            {resetLabel}
                        </button>
                        <button
                            type="button"
                            className="apex-perf-btn apex-perf-btn--primary"
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
