/**
 * Campaign filter presets for Aura custom dashboards (shared by UI + MCP).
 * Shape matches Data inputs → Campaign filter.
 */

export const EMPTY_FILTER = {
    enabled: false,
    google: { include: "", exclude: "", excludeExact: [] },
    meta: { include: "", exclude: "", excludeExact: [] },
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
        google: { include: "ladeboks, SM - V: Branding", exclude: "", excludeExact: [] },
        meta: { include: "Emob, Permission, Ladebok", exclude: "", excludeExact: [] },
    },
    {
        id: "el",
        label: "EL (shared Google + Meta accounts)",
        google: { include: "EL", exclude: "Emob, Fiber, ladeboks, Ladebok", excludeExact: [] },
        meta: { include: "EL", exclude: "Emob, Fiber", excludeExact: [] },
    },
    {
        id: "fiber",
        label: "Fiber (dedicated Google Ads account; Meta name filter)",
        google: { include: "", exclude: "", excludeExact: [] },
        meta: { include: "Fiber", exclude: "Emob, EL", excludeExact: [] },
    },
];
