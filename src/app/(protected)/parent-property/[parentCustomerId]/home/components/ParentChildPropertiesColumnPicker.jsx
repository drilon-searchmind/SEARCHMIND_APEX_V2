"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiColumns, FiX } from "react-icons/fi";
import {
    defaultParentChildVisibleColumnIds,
    parentChildAllToggleableColumns,
    parentChildTableColumnsLegacyStorageKey,
    parentChildTableColumnsStorageKey,
    resolveParentChildVisibleColumnIds,
} from "@root/lib/parentChildPropertiesTableColumns";

function readRawStoredColumnIds(storageKey, legacyStorageKey) {
    if (typeof window === "undefined") return null;
    try {
        let raw = localStorage.getItem(storageKey);
        if (!raw && legacyStorageKey) {
            raw = localStorage.getItem(legacyStorageKey);
            if (raw) {
                try {
                    localStorage.removeItem(legacyStorageKey);
                } catch {
                    /* ignore */
                }
            }
        }
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

export function useParentChildPropertiesTableColumns(parentCustomerId, visibleAdSpendChannels = []) {
    const allColumns = useMemo(
        () => parentChildAllToggleableColumns(visibleAdSpendChannels),
        [visibleAdSpendChannels]
    );
    const storageKey = parentChildTableColumnsStorageKey(parentCustomerId);
    const legacyStorageKey = parentChildTableColumnsLegacyStorageKey(parentCustomerId);

    const [storedColumnIds, setStoredColumnIds] = useState(null);
    const [hydrated, setHydrated] = useState(false);

    const channelIdsKey = (visibleAdSpendChannels || []).map((c) => c.id).join(",");

    useEffect(() => {
        const raw = readRawStoredColumnIds(storageKey, legacyStorageKey);
        setStoredColumnIds(raw);
        setHydrated(true);
    }, [storageKey, legacyStorageKey, channelIdsKey]);

    const visibleColumnIds = useMemo(
        () => resolveParentChildVisibleColumnIds(storedColumnIds ?? [], allColumns),
        [storedColumnIds, allColumns]
    );

    const persist = (ids) => {
        const next = Array.isArray(ids) ? ids : [];
        setStoredColumnIds(next);
        try {
            localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
            /* ignore quota */
        }
    };

    return { visibleColumnIds, setVisibleColumnIds: persist, hydrated, allColumns };
}

export default function ParentChildPropertiesColumnPicker({
    visibleAdSpendChannels = [],
    selectedIds,
    onChange,
}) {
    const columns = parentChildAllToggleableColumns(visibleAdSpendChannels);
    const defaultIds = defaultParentChildVisibleColumnIds(columns);
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

    const grouped = useMemo(() => {
        const draftSet = new Set(draft);
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
        onChange(draft.length > 0 ? draft : defaultIds);
        setOpen(false);
    };

    const reset = () => {
        setDraft(defaultIds);
        onChange(defaultIds);
        setOpen(false);
    };

    const visibleCount = selectedIds.length;

    return (
        <div className="apex-parent-column-picker" ref={panelRef}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="apex-parent-column-picker__trigger"
                aria-expanded={open}
            >
                <FiColumns size={15} aria-hidden />
                Columns
                <span className="apex-parent-column-picker__count">{visibleCount}</span>
            </button>

            {open ? (
                <div className="apex-parent-column-picker__panel">
                    <div className="apex-parent-column-picker__head">
                        <div>
                            <p className="apex-parent-column-picker__title">Table columns</p>
                            <p className="apex-parent-column-picker__desc">
                                Choose which metrics appear in the child properties table.
                            </p>
                        </div>
                        <button
                            type="button"
                            className="apex-parent-column-picker__close"
                            onClick={() => setOpen(false)}
                            aria-label="Close"
                        >
                            <FiX size={18} />
                        </button>
                    </div>

                    <div className="apex-parent-column-picker__body">
                        {Object.entries(grouped).map(([group, cols]) => (
                            <div key={group} className="apex-parent-column-picker__group">
                                <p className="apex-parent-column-picker__group-label">{group}</p>
                                {cols.map((col) => (
                                    <label key={col.id} className="apex-parent-column-picker__option">
                                        <input
                                            type="checkbox"
                                            className="apex-parent-checkbox"
                                            checked={col._selected}
                                            onChange={() => toggle(col.id)}
                                        />
                                        <span>{col.label}</span>
                                    </label>
                                ))}
                            </div>
                        ))}
                    </div>

                    <div className="apex-parent-column-picker__foot">
                        <button type="button" className="apex-parent-column-picker__link" onClick={reset}>
                            Reset to default
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
