/**
 * Customer-scoped GA4 conversion event configuration (B2B).
 */

export function getGa4ConversionEventNames(customerSettings) {
    const raw = customerSettings?.ga4ConversionEventNames;
    if (!Array.isArray(raw)) return [];
    return raw.map((n) => String(n || "").trim()).filter(Boolean);
}

export function hasCustomGa4ConversionEvents(customerSettings) {
    return getGa4ConversionEventNames(customerSettings).length > 0;
}

/** GA4 Data API dimensionFilter for eventName IN list. */
export function buildEventNameDimensionFilter(eventNames) {
    const values = (eventNames || []).map((n) => String(n || "").trim()).filter(Boolean);
    if (!values.length) return undefined;
    return {
        filter: {
            fieldName: "eventName",
            inListFilter: { values },
        },
    };
}
