"use client";

import { useEffect, useState } from "react";
import { EMPTY_FILTER } from "./auraFilter";
import { fetchJson } from "./auraApi";

/**
 * The account wide campaign filter, read from the saved Aura settings (Data inputs, Campaign filter).
 * `loaded` becomes true once it is known, also when it could not be read (then the filter is off).
 */
export function useAuraFilter(customerId) {
    const [state, setState] = useState({ customerId: null, filter: EMPTY_FILTER });

    useEffect(() => {
        if (!customerId) return;
        let cancelled = false;
        fetchJson(`/api/custom-dashboards/aura/filter?customerId=${customerId}`)
            .then((json) => !cancelled && setState({ customerId, filter: json.filter || EMPTY_FILTER }))
            .catch(() => !cancelled && setState({ customerId, filter: EMPTY_FILTER }));
        return () => {
            cancelled = true;
        };
    }, [customerId]);

    const ready = state.customerId === customerId;
    return { filter: ready ? state.filter : EMPTY_FILTER, loaded: Boolean(customerId) && ready };
}
