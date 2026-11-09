"use client";

import { useMemo, useState } from "react";
import { EMPTY_FILTER, loadSavedFilter, saveFilter } from "./auraFilter";

/**
 * Campaign filter state shared by the Aura dashboards: off by default, remembered per viewer once applied.
 * The dashboards are client only (next/dynamic, ssr: false), so localStorage can be read while rendering.
 */
export function useAuraFilter(customerId) {
    const saved = useMemo(() => (customerId ? loadSavedFilter(customerId) : null), [customerId]);
    const [applied, setApplied] = useState(null);

    const current = applied && applied.customerId === customerId ? applied.filter : saved;
    const apply = (next) => {
        setApplied({ customerId, filter: next });
        saveFilter(customerId, next);
    };
    return { filter: current || EMPTY_FILTER, loaded: Boolean(current), apply };
}
