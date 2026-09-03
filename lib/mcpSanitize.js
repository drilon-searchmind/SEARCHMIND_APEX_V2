/** Field names always stripped from MCP responses (never returned). */
import { redactAccessTokenFromString } from "./mcpMetaGraph.js";

export const MCP_SECRET_FIELD_NAMES = new Set([
    "shopifyApiPassword",
    "wooCommerceApiKey",
    "wooCommerceApiSecret",
    "magentoAccessToken",
    "magentoConsumerKey",
    "magentoConsumerSecret",
    "magentoAccessTokenSecret",
    "klaviyoPrivateApiKey",
    "password",
    "clientSecret",
    "accessToken",
    "refreshToken",
    "conversionsApiToken",
    "appSecret",
]);

/** Substrings that indicate a field should not be exposed via MCP. */
const MCP_SECRET_KEY_PATTERN =
    /password|secret|token|apikey|api_key|privatekey|private_key|refresh/i;

/**
 * Recursively remove secret fields from objects returned via MCP.
 * @param {unknown} value
 * @returns {unknown}
 */
export function sanitizeForMcp(value) {
    if (value == null) return value;
    if (typeof value === "string") {
        return redactAccessTokenFromString(value);
    }
    if (Array.isArray(value)) {
        return value.map((item) => sanitizeForMcp(item));
    }
    if (value instanceof Date) return value;
    if (typeof value !== "object") return value;

    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [key, child] of Object.entries(value)) {
        if (MCP_SECRET_FIELD_NAMES.has(key) || MCP_SECRET_KEY_PATTERN.test(key)) {
            continue;
        }
        out[key] = sanitizeForMcp(child);
    }
    return out;
}

/**
 * @param {Record<string, unknown>} customer
 */
export function serializeCustomerDetailForMcp(customer) {
    const c = customer?.toObject ? customer.toObject() : customer || {};
    const base = sanitizeForMcp({
        id: String(c._id),
        customerName: c.customerName || "",
        customerType: c.customerType || "Shopify",
        isArchived: Boolean(c.isArchived),
        parentCustomer: c.parentCustomer ? String(c.parentCustomer) : null,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        CustomerSettings: c.CustomerSettings || {},
        CustomerStaticExpenses: c.CustomerStaticExpenses || {},
        CustomerPropertyObjectives: c.CustomerPropertyObjectives || {},
        CustomerMarketPropertyObjectives: c.CustomerMarketPropertyObjectives || {},
        customerApexRadarSettings: c.customerApexRadarSettings || {},
        customerTeam: c.customerTeam || null,
    });

    return {
        readOnly: true,
        ...base,
    };
}
