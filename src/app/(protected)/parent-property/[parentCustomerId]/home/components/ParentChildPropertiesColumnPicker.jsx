"use client";

import { useEffect, useMemo, useState } from "react";
import AdminCustomerColumnPicker from "@/app/(protected)/admin/components/AdminCustomerColumnPicker";
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

    /** Raw selection from localStorage / user Apply (not merged for display). */
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

    return (
        <AdminCustomerColumnPicker
            selectedIds={selectedIds}
            onChange={onChange}
            columns={columns}
            selectionBadge="none"
            getResetIds={() => defaultIds}
            description="Choose which metrics appear in the child properties table. Checked columns are visible."
            resetLabel="Reset to default columns"
        />
    );
}
