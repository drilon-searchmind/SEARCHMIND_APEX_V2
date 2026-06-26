/**
 * Merge persisted Apex Radar channel targets (Mongo `apex_radar_channel_settings`) into plain customer
 * objects before overview / helpers read `customerApexRadarSettings.facebook`.
 * If there is no doc for a customer, embedded `Customer.customerApexRadarSettings.facebook` is unchanged.
 */

/**
 * @param {object[]} customers — plain customer docs
 * @param {object[]} docs — lean ApexRadarChannelSettings docs for this channel
 * @returns {object[]}
 */
export function mergeFacebookChannelSettingsIntoCustomers(customers, docs) {
    const map = new Map();
    for (const d of docs) {
        map.set(String(d.customerId), d);
    }
    return customers.map((c) => {
        const id = String(c._id);
        const doc = map.get(id);
        if (!doc) return c;
        const prev =
            c.customerApexRadarSettings && typeof c.customerApexRadarSettings === "object"
                ? c.customerApexRadarSettings
                : {};
        return {
            ...c,
            customerApexRadarSettings: {
                ...prev,
                facebook: {
                    targetBudget: doc.targetBudget ?? null,
                    targetMetricType: doc.targetMetricType === "CPA" ? "CPA" : "ROAS",
                    targetValue: doc.targetValue ?? null,
                    budgetMode: doc.budgetMode === "STATIC" ? "STATIC" : "DYNAMIC",
                },
            },
        };
    });
}

/**
 * @param {object[]} customers — plain customer docs
 * @param {object[]} docs — lean ApexRadarChannelSettings docs for `google-ads`
 * @returns {object[]}
 */
export function mergeGoogleChannelSettingsIntoCustomers(customers, docs) {
    const map = new Map();
    for (const d of docs) {
        map.set(String(d.customerId), d);
    }
    return customers.map((c) => {
        const id = String(c._id);
        const doc = map.get(id);
        if (!doc) return c;
        const prev =
            c.customerApexRadarSettings && typeof c.customerApexRadarSettings === "object"
                ? c.customerApexRadarSettings
                : {};
        return {
            ...c,
            customerApexRadarSettings: {
                ...prev,
                google: {
                    targetBudget: doc.targetBudget ?? null,
                    targetMetricType: doc.targetMetricType === "CPA" ? "CPA" : "ROAS",
                    targetValue: doc.targetValue ?? null,
                    budgetMode: doc.budgetMode === "STATIC" ? "STATIC" : "DYNAMIC",
                    trackingAlertsEnabled: doc.trackingAlertsEnabled !== false,
                },
            },
        };
    });
}
