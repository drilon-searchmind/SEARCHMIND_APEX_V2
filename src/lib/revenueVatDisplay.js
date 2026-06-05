/** Danish standard VAT rate (25%). Store revenue from Shopify/WooCommerce is excl. VAT by default. */
export const DK_VAT_RATE = 0.25;

/** @typedef {'incl' | 'excl'} RevenueDisplayVatMode */

/**
 * @param {Record<string, unknown>} [customerSettings]
 * @returns {RevenueDisplayVatMode}
 */
export function getRevenueDisplayVatMode(customerSettings = {}) {
    return customerSettings?.revenueDisplayVat === "incl" ? "incl" : "excl";
}

/**
 * Store data is excl. VAT; multiply by 1.25 only when dashboard display is incl. VAT.
 * @param {Record<string, unknown>} [customerSettings]
 * @returns {number}
 */
export function revenueVatDisplayFactor(customerSettings = {}) {
    if (getRevenueDisplayVatMode(customerSettings) === "incl") {
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
    return getRevenueDisplayVatMode(customerSettings) === "incl" ? " (incl. VAT)" : " (excl. VAT)";
}

/**
 * @param {Record<string, unknown>} [customerSettings]
 * @returns {string}
 */
export function totalSalesVatLabel(customerSettings = {}) {
    return getRevenueDisplayVatMode(customerSettings) === "incl"
        ? "Total sales incl. VAT"
        : "Total sales excl. VAT";
}

/**
 * @param {Record<string, unknown>} [customerSettings]
 * @returns {string}
 */
export function grossProfitVatLabel(customerSettings = {}) {
    return getRevenueDisplayVatMode(customerSettings) === "incl"
        ? "Gross Profit incl. VAT"
        : "Gross Profit excl. VAT";
}

/**
 * @param {Record<string, unknown>} [customerSettings]
 * @returns {"incl. VAT"|"excl. VAT"}
 */
export function revenueVatShortLabel(customerSettings = {}) {
    return getRevenueDisplayVatMode(customerSettings) === "incl" ? "incl. VAT" : "excl. VAT";
}
