/** Client-safe helpers (no Mongo/Mongoose). */

/** Store inventory cache TTL (2 hours). */
export const SHOPIFY_ECOM_CACHE_TTL_MS = 2 * 60 * 60 * 1000;

export const SHOPIFY_ECOM_CACHE_KEYS = {
    inventoryTotals: 'inventoryTotals',
    productInventoryById: 'productInventoryById',
};

function roundMoney(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
}

/**
 * @param {object|null|undefined} periodSummary
 * @param {string} startDate
 * @param {string} endDate
 */
export function buildSalesFingerprint(periodSummary, startDate, endDate) {
    if (!periodSummary || !startDate || !endDate) return null;
    return {
        startDate,
        endDate,
        totalSalesExVat: roundMoney(periodSummary.totalSalesExVat),
        netSales: roundMoney(periodSummary.netSales),
        orders: parseInt(periodSummary.orders, 10) || 0,
        netItemsSold: parseInt(periodSummary.netItemsSold, 10) || 0,
    };
}

/**
 * @param {object|null|undefined} cached
 * @param {object|null|undefined} fresh
 */
export function salesFingerprintsMatch(cached, fresh) {
    if (!cached || !fresh) return false;
    if (cached.startDate !== fresh.startDate || cached.endDate !== fresh.endDate) return false;
    if (cached.orders !== fresh.orders || cached.netItemsSold !== fresh.netItemsSold) return false;
    const epsilon = 1;
    return (
        Math.abs(cached.totalSalesExVat - fresh.totalSalesExVat) <= epsilon &&
        Math.abs(cached.netSales - fresh.netSales) <= epsilon
    );
}
