import {
    SHOPIFY_ECOM_CACHE_TTL_MS,
    salesFingerprintsMatch,
} from '@/lib/shopifyEcommerceCacheShared';

const STORAGE_PREFIX = 'apex-ecom-cache:v1';

export function isBrowserHardReload() {
    if (typeof window === 'undefined') return false;
    try {
        const nav = performance.getEntriesByType('navigation')[0];
        return nav?.type === 'reload';
    } catch {
        return false;
    }
}

function storageKey(customerId, suffix) {
    return `${STORAGE_PREFIX}:${customerId}:${suffix}`;
}

function readJson(key) {
    if (typeof window === 'undefined') return null;
    try {
        const raw = sessionStorage.getItem(key);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function writeJson(key, value) {
    if (typeof window === 'undefined') return;
    try {
        sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Quota or private mode — ignore
    }
}

/**
 * @param {string} customerId
 * @param {string} startDate
 * @param {string} endDate
 * @param {object|null} salesFingerprint
 */
export function readClientInventoryTotalsCache(customerId, startDate, endDate, salesFingerprint) {
    if (isBrowserHardReload()) return null;
    const entry = readJson(storageKey(customerId, 'inventoryTotals'));
    if (!entry?.totals || !entry.expiresAt || entry.expiresAt <= Date.now()) return null;
    if (entry.startDate !== startDate || entry.endDate !== endDate) return null;
    if (salesFingerprint && !salesFingerprintsMatch(entry.salesFingerprint, salesFingerprint)) {
        return null;
    }
    return entry.totals;
}

export function writeClientInventoryTotalsCache(
    customerId,
    startDate,
    endDate,
    salesFingerprint,
    totals
) {
    writeJson(storageKey(customerId, 'inventoryTotals'), {
        totals,
        startDate,
        endDate,
        salesFingerprint,
        expiresAt: Date.now() + SHOPIFY_ECOM_CACHE_TTL_MS,
    });
}

/**
 * @param {string} customerId
 * @param {string} startDate
 * @param {string} endDate
 * @param {object|null} salesFingerprint
 * @param {string[]} productIds
 */
export function readClientProductInventoryCache(
    customerId,
    startDate,
    endDate,
    salesFingerprint,
    productIds
) {
    if (isBrowserHardReload()) return { hits: {}, misses: productIds };
    const entry = readJson(storageKey(customerId, 'productInventory'));
    if (!entry?.rows || !entry.expiresAt || entry.expiresAt <= Date.now()) {
        return { hits: {}, misses: productIds };
    }
    if (entry.startDate !== startDate || entry.endDate !== endDate) {
        return { hits: {}, misses: productIds };
    }
    if (salesFingerprint && !salesFingerprintsMatch(entry.salesFingerprint, salesFingerprint)) {
        return { hits: {}, misses: productIds };
    }
    /** @type {Record<string, object>} */
    const hits = {};
    const misses = [];
    for (const id of productIds) {
        if (entry.rows[id]) hits[id] = entry.rows[id];
        else misses.push(id);
    }
    return { hits, misses };
}

export function mergeClientProductInventoryCache(
    customerId,
    startDate,
    endDate,
    salesFingerprint,
    rows
) {
    const key = storageKey(customerId, 'productInventory');
    const existing = readJson(key);
    const baseRows =
        existing?.rows &&
        existing.startDate === startDate &&
        existing.endDate === endDate &&
        (!salesFingerprint || salesFingerprintsMatch(existing.salesFingerprint, salesFingerprint))
            ? existing.rows
            : {};
    writeJson(key, {
        rows: { ...baseRows, ...rows },
        startDate,
        endDate,
        salesFingerprint,
        expiresAt: Date.now() + SHOPIFY_ECOM_CACHE_TTL_MS,
    });
}
