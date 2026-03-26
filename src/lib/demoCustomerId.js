const DEFAULT_DEMO_CUSTOMER_IDS = ["69c5097c84057563ba331cd2", "69c50a80b2df09b2da444b47"];

/** Parent customer used for demo multi-property views (optional). */
const DEFAULT_DEMO_PARENT_CUSTOMER_ID = "69c50a65b2df09b2da444ace";

/**
 * All Mongo customer ids that use demo/static API data.
 * Override with NEXT_PUBLIC_DEMO_CUSTOMER_IDS=comma,separated or a single NEXT_PUBLIC_DEMO_CUSTOMER_ID.
 */
export function getDemoCustomerIds() {
    if (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_DEMO_CUSTOMER_IDS) {
        const raw = String(process.env.NEXT_PUBLIC_DEMO_CUSTOMER_IDS).trim();
        const parts = raw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        if (parts.length) return parts;
    }
    if (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_DEMO_CUSTOMER_ID) {
        const v = String(process.env.NEXT_PUBLIC_DEMO_CUSTOMER_ID).trim();
        if (v) return [v];
    }
    return DEFAULT_DEMO_CUSTOMER_IDS;
}

/** First id (legacy helpers / single-select defaults). */
export function getDemoCustomerId() {
    return getDemoCustomerIds()[0];
}

export function isDemoCustomerId(id) {
    if (id == null || id === "") return false;
    return getDemoCustomerIds().includes(String(id).trim());
}

export function getDemoParentCustomerId() {
    if (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_DEMO_PARENT_CUSTOMER_ID) {
        const v = String(process.env.NEXT_PUBLIC_DEMO_PARENT_CUSTOMER_ID).trim();
        if (v) return v;
    }
    return DEFAULT_DEMO_PARENT_CUSTOMER_ID;
}

export function isDemoParentCustomerId(id) {
    if (id == null || id === "") return false;
    return String(id).trim() === getDemoParentCustomerId();
}
