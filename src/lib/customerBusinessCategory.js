export const BUSINESS_CATEGORIES = ["ecommerce", "b2b"];

export const BUSINESS_CATEGORY_LABELS = {
    ecommerce: "Ecommerce",
    b2b: "B2B",
};

/**
 * @param {Record<string, unknown> | null | undefined} customer
 * @returns {"ecommerce" | "b2b"}
 */
export function getBusinessCategory(customer) {
    const value = customer?.businessCategory;
    return value === "b2b" ? "b2b" : "ecommerce";
}

/** @param {Record<string, unknown> | null | undefined} customer */
export function isB2BCustomer(customer) {
    return getBusinessCategory(customer) === "b2b";
}

/** @param {Record<string, unknown> | null | undefined} customer */
export function isEcommerceCustomer(customer) {
    return !isB2BCustomer(customer);
}

/** @param {Record<string, unknown> | null | undefined} customer */
export function getBusinessCategoryLabel(customer) {
    return BUSINESS_CATEGORY_LABELS[getBusinessCategory(customer)] || "Ecommerce";
}
