import demoBundle from "@/data/demo-customer-data.json";
import {
    getDemoCustomerId,
    getDemoCustomerIds,
    getDemoParentCustomerId,
    isDemoCustomerId,
    isDemoParentCustomerId,
} from "@/lib/demoCustomerId";

export {
    getDemoCustomerId,
    getDemoCustomerIds,
    getDemoParentCustomerId,
    isDemoCustomerId,
    isDemoParentCustomerId,
};

export function getDemoBundle() {
    return demoBundle;
}

/**
 * @param {string} key — top-level key in demo-customer-data.json
 * @returns {unknown}
 */
export function getDemoPayload(key) {
    const b = demoBundle;
    if (!b || typeof b !== "object") return undefined;
    return b[key];
}
