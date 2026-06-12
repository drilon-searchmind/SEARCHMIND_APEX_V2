import { isB2BCustomer } from "@/lib/customerBusinessCategory";

/**
 * Human-readable platform label for customer list / tables.
 * Shopify + Markets mode uses a distinct label from plain Shopify.
 *
 * @param {Record<string, unknown> | null | undefined} customer
 * @returns {string}
 */
export function getCustomerPlatformLabel(customer) {
    if (!customer) return "";
    if (isB2BCustomer(customer)) return "B2B";
    const type = customer.customerType || "";
    if (type === "Shopify" && customer.CustomerSettings?.shopifyMarketsEnabled === true) {
        return "Shopify Markets";
    }
    return type;
}

/** @param {Record<string, unknown> | null | undefined} customer */
export function isShopifyMarketsCustomer(customer) {
    return (
        customer?.customerType === "Shopify" &&
        customer.CustomerSettings?.shopifyMarketsEnabled === true
    );
}
