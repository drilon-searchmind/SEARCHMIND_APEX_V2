/** @readonly */
export const MCP_MAX_DATE_RANGE_DAYS = 366;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @param {string} value
 * @returns {boolean}
 */
function isValidYmd(value) {
    if (!DATE_RE.test(value)) return false;
    const d = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/**
 * @param {string} startDate
 * @param {string} endDate
 * @returns {{ startDate: string, endDate: string, days: number }}
 */
export function parseMcpDateRange(startDate, endDate) {
    const start = String(startDate || "").trim();
    const end = String(endDate || "").trim();

    if (!start || !end) {
        throw new Error("startDate and endDate are required (YYYY-MM-DD)");
    }
    if (!isValidYmd(start) || !isValidYmd(end)) {
        throw new Error("Dates must be valid YYYY-MM-DD");
    }
    if (end < start) {
        throw new Error("endDate must be on or after startDate");
    }

    const startMs = new Date(`${start}T00:00:00Z`).getTime();
    const endMs = new Date(`${end}T00:00:00Z`).getTime();
    const days = Math.floor((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1;

    if (days > MCP_MAX_DATE_RANGE_DAYS) {
        throw new Error(`Date range cannot exceed ${MCP_MAX_DATE_RANGE_DAYS} days`);
    }

    return { startDate: start, endDate: end, days };
}

/**
 * @param {unknown} value
 */
function hasNonEmpty(value) {
    if (value === undefined || value === null || value === "") return false;
    if (value === "0" || value === 0) return false;
    return true;
}

/**
 * @param {Record<string, unknown>} customer
 */
export function serializeCustomerForMcp(customer) {
    const c = customer?.toObject ? customer.toObject() : customer || {};
    const cs = c.CustomerSettings || {};

    const type = c.customerType || "Shopify";
    let storeConfigured = false;
    if (type === "WooCommerce") {
        storeConfigured = hasNonEmpty(cs.wooCommerceApiKey);
    } else if (type === "Magento") {
        storeConfigured = hasNonEmpty(cs.magentoBaseUrl);
    } else if (type === "DanDomain") {
        storeConfigured =
            hasNonEmpty(cs.danDomain?.shopHost) &&
            (hasNonEmpty(cs.danDomain?.clientId) ||
                hasNonEmpty(cs.danDomain?.accessToken));
    } else {
        storeConfigured = hasNonEmpty(cs.shopifyUrl);
    }

    return {
        id: String(c._id),
        customerName: c.customerName || "",
        customerType: type,
        isArchived: Boolean(c.isArchived),
        currency: cs.customerStoreValutaCode || "DKK",
        revenueDisplayVat: cs.revenueDisplayVat === "incl" ? "incl" : "excl",
        clickupTaskId: cs.customerClickupID || "",
        parentCustomer: c.parentCustomer ? String(c.parentCustomer) : null,
        integrations: {
            store: storeConfigured,
            meta: hasNonEmpty(cs.customerMetaID) || hasNonEmpty(cs.facebookAdAccountId),
            googleAds: hasNonEmpty(cs.googleAdsCustomerId),
            pinterest: hasNonEmpty(cs.pinterestAdAccountId),
            snapchat: hasNonEmpty(cs.snapchat?.adAccountId),
            bing: hasNonEmpty(cs.bingAdsCustomerId) || hasNonEmpty(cs.bingAdsAccountId),
            reddit: hasNonEmpty(cs.reddit?.adAccountId),
            klaviyo: hasNonEmpty(cs.klaviyoPrivateApiKey),
            googleSearchConsole: hasNonEmpty(cs.googleSearchConsoleProperty),
            ga4: hasNonEmpty(cs.ga4PropertyId),
        },
    };
}
