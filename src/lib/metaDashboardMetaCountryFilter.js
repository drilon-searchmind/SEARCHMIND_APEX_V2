import { getCustomerById } from "@root/lib/customerOperations";
import { resolveMetaCountryFilterForMergedSources } from "@/lib/shopifyMarketsAdSpendFilters";

/**
 * Meta country include/exclude for dashboard APIs (PS, merged-sources, ad performance).
 * Shopify Markets customers use full ad account unless market ad-spend filters are passed.
 *
 * @param {Record<string, unknown>} settings - CustomerSettings (+ shopifyMarketsEnabled)
 * @param {{ metaCountryCodes?: string[] } | null | undefined} [marketAdSpendFilters]
 */
export function resolveMetaCountryFiltersForSettings(settings, marketAdSpendFilters = null) {
    return resolveMetaCountryFilterForMergedSources(settings, marketAdSpendFilters);
}

/**
 * @param {string} customerId
 * @param {{ metaCountryCodes?: string[] } | null | undefined} [marketAdSpendFilters]
 */
export async function resolveMetaCountryFiltersForCustomerId(
    customerId,
    marketAdSpendFilters = null
) {
    const id = String(customerId || "").trim();
    if (!id) return { include: "", exclude: "" };

    const doc = await getCustomerById(id);
    if (!doc) return { include: "", exclude: "" };

    const cs = doc.CustomerSettings || {};
    return resolveMetaCountryFiltersForSettings(
        {
            shopifyMarketsEnabled: cs.shopifyMarketsEnabled,
            customerMetaID: cs.customerMetaID,
            customerMetaIDExclude: cs.customerMetaIDExclude,
        },
        marketAdSpendFilters
    );
}
