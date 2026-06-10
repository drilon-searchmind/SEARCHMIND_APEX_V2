/** Danish standard VAT rate (25%). Store revenue from Shopify/WooCommerce is excl. VAT by default. */
export const DK_VAT_RATE = 0.25;

/** @typedef {'excl' | 'incl' | 'incl_shopify'} RevenueDisplayVatMode */

const VALID_VAT_MODES = new Set(["excl", "incl", "incl_shopify"]);

/**
 * @param {Record<string, unknown>} [customerSettings]
 * @returns {RevenueDisplayVatMode}
 */
export function getRevenueDisplayVatMode(customerSettings = {}) {
    const mode = customerSettings?.revenueDisplayVat;
    return VALID_VAT_MODES.has(mode) ? mode : "excl";
}

/** Dashboard shows revenue including VAT (static 25% or native store taxes). */
export function displaysInclVat(customerSettings = {}) {
    const mode = getRevenueDisplayVatMode(customerSettings);
    return mode === "incl" || mode === "incl_shopify";
}

/** Apply Danish 25% multiplier to store-reported excl. VAT amounts. */
export function usesStaticDkVatMultiplier(customerSettings = {}) {
    return getRevenueDisplayVatMode(customerSettings) === "incl";
}

/** Use store-reported tax fields (e.g. Shopify `total_sales`, `taxes`) without a flat 25% uplift. */
export function usesShopifyNativeInclVat(customerSettings = {}) {
    return getRevenueDisplayVatMode(customerSettings) === "incl_shopify";
}

/** Primary sales metric is shown as-is (no ex-VAT subtraction). */
export function displaysTotalSalesWithoutVatDeduction(customerSettings = {}) {
    return displaysInclVat(customerSettings);
}

/**
 * Store data is excl. VAT; multiply by 1.25 only when dashboard display is incl. VAT (25%).
 * @param {Record<string, unknown>} [customerSettings]
 * @returns {number}
 */
export function revenueVatDisplayFactor(customerSettings = {}) {
    if (usesStaticDkVatMultiplier(customerSettings)) {
        return 1 + DK_VAT_RATE;
    }
    return 1;
}

/**
 * @param {number|null|undefined} amount
 * @param {Record<string, unknown>} [customerSettings]
 */
export function applyRevenueVatDisplay(amount, customerSettings) {
    return (Number(amount) || 0) * revenueVatDisplayFactor(customerSettings);
}

/** Monetary Shopify / WooCommerce daily fields that represent sales turnover. */
export const SHOPIFY_VAT_MONETARY_FIELDS = [
    "gross_sales",
    "net_sales",
    "total_sales",
    "discounts",
    "returns",
    "shipping_charges",
    "duties",
    "additional_fees",
    "taxes",
    "cost_of_goods_sold",
    "custom_1",
];

/**
 * Incl. VAT amount for a single Shopify day using store-reported tax (no flat 25%).
 * @param {Record<string, unknown>} day — raw or VAT-adjusted row
 * @param {string} [revenueType]
 */
export function shopifyDayInclVatRevenue(day, revenueType = "net_sales") {
    const total = Number(day?.total_sales) || 0;
    const net = Number(day?.net_sales) || 0;
    const gross = Number(day?.gross_sales) || 0;
    const tax = Math.abs(Number(day?.taxes) || 0);
    const type = revenueType || "net_sales";

    if (type === "total_sales") {
        return total > 0 ? total : net + tax;
    }
    if (type === "gross_sales") {
        if (gross > 0 && tax > 0) return gross + tax;
        return total > 0 ? total : gross || net + tax;
    }
    return total > 0 ? total : net + tax;
}

/**
 * @param {Record<string, unknown>|null|undefined} day
 * @param {Record<string, unknown>} [customerSettings]
 */
export function applyVatDisplayToShopifyDayRow(day, customerSettings) {
    const factor = revenueVatDisplayFactor(customerSettings);
    if (factor === 1 || !day) return day;
    const out = { ...day };
    for (const field of SHOPIFY_VAT_MONETARY_FIELDS) {
        if (out[field] != null) {
            out[field] = (Number(out[field]) || 0) * factor;
        }
    }
    return out;
}

/**
 * @param {Array<Record<string, unknown>>|null|undefined} rows
 * @param {Record<string, unknown>} [customerSettings]
 */
export function applyVatDisplayToShopifyDailyRows(rows, customerSettings) {
    return (rows || []).map((d) => applyVatDisplayToShopifyDayRow(d, customerSettings));
}

/**
 * @param {Record<string, unknown>} [customerSettings]
 * @returns {string}
 */
export function revenueVatDisplayLabelSuffix(customerSettings = {}) {
    const mode = getRevenueDisplayVatMode(customerSettings);
    if (mode === "incl") return " (incl. VAT 25%)";
    if (mode === "incl_shopify") return " (incl. VAT)";
    return " (excl. VAT)";
}

/**
 * @param {Record<string, unknown>} [customerSettings]
 * @returns {string}
 */
export function totalSalesVatLabel(customerSettings = {}) {
    const mode = getRevenueDisplayVatMode(customerSettings);
    if (mode === "incl") return "Total sales incl. VAT (25%)";
    if (mode === "incl_shopify") return "Total sales incl. VAT";
    return "Total sales excl. VAT";
}

/**
 * @param {Record<string, unknown>} [customerSettings]
 * @returns {string}
 */
export function grossProfitVatLabel(customerSettings = {}) {
    const mode = getRevenueDisplayVatMode(customerSettings);
    if (mode === "incl") return "Gross Profit incl. VAT (25%)";
    if (mode === "incl_shopify") return "Gross Profit incl. VAT";
    return "Gross Profit excl. VAT";
}

/**
 * @param {Record<string, unknown>} [customerSettings]
 * @returns {string}
 */
export function revenueVatShortLabel(customerSettings = {}) {
    const mode = getRevenueDisplayVatMode(customerSettings);
    if (mode === "incl") return "incl. VAT (25%)";
    if (mode === "incl_shopify") return "incl. VAT (Shopify)";
    return "excl. VAT";
}

/**
 * @param {unknown} value
 * @returns {RevenueDisplayVatMode}
 */
export function normalizeRevenueDisplayVat(value) {
    return VALID_VAT_MODES.has(value) ? value : "excl";
}
