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

/**
 * Demo Mongo docs often initialize numeric static expense fields as 0. Spreading DB over the demo
 * template then hides all demo defaults. Use this merge so non-zero values from the DB win, and
 * 0 / null / empty fall back to the demo template.
 */
export function mergeDemoStaticExpenses(demo = {}, db = {}) {
    const keys = new Set([...Object.keys(demo), ...Object.keys(db)]);
    const out = {};
    for (const key of keys) {
        const dVal = demo[key];
        const bVal = db[key];

        if (Array.isArray(dVal) || Array.isArray(bVal)) {
            const bArr = Array.isArray(bVal) ? bVal : [];
            const dArr = Array.isArray(dVal) ? dVal : [];
            out[key] = bArr.length > 0 ? bArr : dArr;
            continue;
        }

        if (bVal === null || bVal === undefined) {
            out[key] = dVal !== undefined ? dVal : bVal;
            continue;
        }

        if (typeof bVal === "number") {
            out[key] = bVal !== 0 ? bVal : (dVal !== undefined ? dVal : bVal);
            continue;
        }

        if (typeof bVal === "string") {
            out[key] = bVal.trim() !== "" ? bVal : (dVal !== undefined ? dVal : bVal);
            continue;
        }

        out[key] = bVal;
    }
    return out;
}

/**
 * Full customer shape for demo IDs: template + DB identity fields, with static expenses merged so
 * zeros in Mongo do not wipe demo defaults (used by GET /api/customers and parent aggregated).
 */
export function mergeDemoCustomerDocument(plain) {
    const demoTemplate = getDemoPayload("customer");
    if (!plain || !demoTemplate || typeof demoTemplate !== "object") return plain;
    return {
        ...demoTemplate,
        ...plain,
        CustomerSettings: {
            ...(demoTemplate.CustomerSettings || {}),
            ...(plain.CustomerSettings || {}),
        },
        CustomerStaticExpenses: mergeDemoStaticExpenses(
            demoTemplate.CustomerStaticExpenses || {},
            plain.CustomerStaticExpenses || {}
        ),
        customerName: plain.customerName ?? demoTemplate.customerName,
    };
}
