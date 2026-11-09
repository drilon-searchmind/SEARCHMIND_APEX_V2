/**
 * Campaign filter for the Aura dashboards. It is one setting on the account (saved under Data inputs, Campaign filter)
 * and applies to every Aura dashboard, so it is configured once.
 *
 * Shape: { enabled, google: { include, exclude, excludeExact[] }, meta: { include, exclude, excludeExact[] } }
 * include / exclude are comma separated "name contains" terms, excludeExact holds exact campaign names.
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
];
