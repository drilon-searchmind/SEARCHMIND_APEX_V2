import {
    ADMIN_CUSTOMER_COLUMN_BY_ID,
    parseAdminCustomerColumnIds,
} from "./adminCustomerTableColumns";

/**
 * @param {unknown} value
 */
function hasConfiguredValue(value) {
    if (value === undefined || value === null || value === "") return false;
    if (value === "0" || value === 0) return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return true;
}

/**
 * @param {Record<string, unknown>} customer
 * @param {string} path
 */
export function getCustomerFieldByPath(customer, path) {
    const parts = String(path || "").split(".");
    let cur = customer;
    for (const part of parts) {
        if (cur == null || typeof cur !== "object") return undefined;
        cur = cur[part];
    }
    return cur;
}

/**
 * @param {Record<string, unknown>} customer
 */
export function computeAdminCustomerChecks(customer) {
    const cs = customer.CustomerSettings || {};
    const type = customer.customerType || "Shopify";

    let shopifyWoo = false;
    if (type === "WooCommerce") {
        shopifyWoo = hasConfiguredValue(cs.wooCommerceApiUrl);
    } else if (type === "Magento") {
        shopifyWoo = hasConfiguredValue(cs.magentoBaseUrl);
    } else if (type === "DanDomain") {
        shopifyWoo =
            hasConfiguredValue(cs.danDomain?.shopHost) &&
            (hasConfiguredValue(cs.danDomain?.clientId) ||
                hasConfiguredValue(cs.danDomain?.accessToken));
    } else {
        shopifyWoo = hasConfiguredValue(cs.shopifyUrl);
    }

    const snap = cs.snapchat || {};
    const reddit = cs.reddit || {};

    return {
        meta_id: hasConfiguredValue(cs.customerMetaID),
        shopify_woo: shopifyWoo,
        facebook: hasConfiguredValue(cs.facebookAdAccountId),
        google_ads: hasConfiguredValue(cs.googleAdsCustomerId),
        search_console: hasConfiguredValue(cs.googleSearchConsoleProperty),
        ga4: hasConfiguredValue(cs.ga4PropertyId),
        pinterest: hasConfiguredValue(cs.pinterestAdAccountId),
        snapchat:
            hasConfiguredValue(snap.adAccountId) || hasConfiguredValue(snap.organizationId),
        reddit: hasConfiguredValue(reddit.accountId) || hasConfiguredValue(reddit.appId),
        bing:
            hasConfiguredValue(cs.bingAdsAccountId) || hasConfiguredValue(cs.bingAdsCustomerId),
        klaviyo: hasConfiguredValue(cs.klaviyoPrivateApiKey),
        clickup: hasConfiguredValue(cs.customerClickupID),
    };
}

/**
 * @param {unknown} value
 */
function formatAdminColumnValue(value) {
    if (value == null || value === "") return "";
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "object") {
        if (Array.isArray(value)) {
            if (value.length === 0) return "";
            return JSON.stringify(value);
        }
        return JSON.stringify(value);
    }
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return String(value);
}

/**
 * @param {Record<string, unknown>} customer
 * @param {string[]} optionalColumnIds
 */
export function serializeAdminCustomerRow(customer, optionalColumnIds = []) {
    const plain =
        customer?.toObject && typeof customer.toObject === "function"
            ? customer.toObject()
            : { ...customer };

    const id = String(plain._id || "");
    const checks = computeAdminCustomerChecks(plain);

    /** @type {Record<string, string>} */
    const columns = {};

    for (const colId of optionalColumnIds) {
        const def = ADMIN_CUSTOMER_COLUMN_BY_ID[colId];
        if (!def || def.kind !== "value" || !def.path) continue;
        let raw = getCustomerFieldByPath(plain, def.path);
        if (def.path === "_id") raw = id;
        if (def.path === "parentCustomer" && raw) raw = String(raw);
        columns[colId] = formatAdminColumnValue(raw);
    }

    return {
        _id: id,
        customerName: plain.customerName || "",
        customerType: plain.customerType || "Shopify",
        isArchived: Boolean(plain.isArchived),
        checks,
        columns,
    };
}

/**
 * @param {Array<Record<string, unknown>>} customers
 * @param {string} [columnsParam]
 */
export function serializeAdminCustomerList(customers, columnsParam) {
    const optionalColumnIds = parseAdminCustomerColumnIds(columnsParam || "");
    const columnMeta = optionalColumnIds
        .map((id) => ADMIN_CUSTOMER_COLUMN_BY_ID[id])
        .filter(Boolean)
        .map(({ id, label, group, kind }) => ({ id, label, group, kind }));

    return {
        customers: (customers || []).map((c) =>
            serializeAdminCustomerRow(c, optionalColumnIds)
        ),
        optionalColumns: columnMeta,
    };
}
