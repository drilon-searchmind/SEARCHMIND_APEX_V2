/** Campaign filter defaults and presets for the Aura dashboard (UI lives in ../components/CampaignFilterBar). */

export const EMPTY_FILTER = {
    enabled: false,
    google: { include: "", exclude: "" },
    meta: { include: "", exclude: "" },
};

export const FILTER_CHANNELS = [
    { key: "google", label: "Google Ads" },
    { key: "meta", label: "Meta" },
];

/**
 * "Emob" reproduces the old Google Sheet: its monthly PPC and PS cost equals the campaigns named like this
 * (inferred from the numbers, see SHEET_LOGIC.md section 6).
 */
export const FILTER_PRESETS = [
    {
        id: "emob",
        label: "Emob (as in the old sheet)",
        google: { include: "ladeboks, SM - V: Branding", exclude: "" },
        meta: { include: "Emob, Permission", exclude: "" },
    },
];

const storageKey = (customerId) => `aura-campaign-filter-${customerId}`;

/** Per viewer convenience only: storage can be unavailable, so every access is guarded. */
export function loadSavedFilter(customerId) {
    try {
        const raw = window.localStorage.getItem(storageKey(customerId));
        if (!raw) return EMPTY_FILTER;
        const parsed = JSON.parse(raw);
        return {
            enabled: parsed.enabled === true,
            google: { ...EMPTY_FILTER.google, ...parsed.google },
            meta: { ...EMPTY_FILTER.meta, ...parsed.meta },
        };
    } catch {
        return EMPTY_FILTER;
    }
}

export function saveFilter(customerId, filter) {
    try {
        window.localStorage.setItem(storageKey(customerId), JSON.stringify(filter));
    } catch {
        // Storage unavailable, the filter simply is not remembered.
    }
}
