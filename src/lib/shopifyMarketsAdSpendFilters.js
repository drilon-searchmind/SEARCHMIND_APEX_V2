/**
 * Meta / Google country filters for merged-sources ad spend when Shopify Markets is enabled.
 *
 * Legacy `customerMetaID` / `googleAdsCountryFilter` apply to non–Shopify Markets customers.
 * With Shopify Markets, country-scoped spend comes only from market selection + "filter ad spend"
 * (resolved into `marketAdSpendFilters`). All-markets rollup uses full ad account spend.
 */

/**
 * @param {Record<string, unknown>} settings - CustomerSettings (+ shopifyMarketsEnabled)
 * @param {{ metaCountryCodes?: string[] } | null | undefined} marketAdSpendFilters
 * @returns {{ include: string, exclude: string }}
 */
export function resolveMetaCountryFilterForMergedSources(settings, marketAdSpendFilters) {
    const codes = marketAdSpendFilters?.metaCountryCodes;
    if (Array.isArray(codes) && codes.length > 0) {
        return {
            include: codes.map((c) => String(c).trim().toUpperCase()).filter(Boolean).join(","),
            exclude: "",
        };
    }

    if (settings?.shopifyMarketsEnabled === true) {
        return { include: "", exclude: "" };
    }

    return {
        include: String(settings?.customerMetaID || "").trim(),
        exclude: String(settings?.customerMetaIDExclude || "").trim(),
    };
}

/**
 * @param {Record<string, unknown>} settings
 * @param {{ metaCountryCodes?: string[], googleCountryNames?: string[] } | null | undefined} marketAdSpendFilters
 * @returns {{ include: string | undefined, exclude: string | undefined }}
 */
export function resolveGoogleCountryFilterForMergedSources(settings, marketAdSpendFilters) {
    if (marketAdSpendFilters?.metaCountryCodes?.length) {
        return {
            include: marketAdSpendFilters.metaCountryCodes.join(","),
            exclude: undefined,
        };
    }
    if (marketAdSpendFilters?.googleCountryNames?.length) {
        return {
            include: marketAdSpendFilters.googleCountryNames.join(","),
            exclude: undefined,
        };
    }

    if (settings?.shopifyMarketsEnabled === true) {
        return { include: undefined, exclude: undefined };
    }

    const include = settings?.googleAdsCountryFilter;
    const exclude = settings?.googleAdsCountryExclude;
    return {
        include: include != null && String(include).trim() !== "" ? String(include).trim() : undefined,
        exclude:
            exclude != null && String(exclude).trim() !== "" ? String(exclude).trim() : undefined,
    };
}
