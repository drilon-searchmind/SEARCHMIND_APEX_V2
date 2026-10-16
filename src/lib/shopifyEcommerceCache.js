import 'server-only';

import connectToDatabase from '@root/lib/mongodb';
import ShopifyEcommerceCache from '@/models/ShopifyEcommerceCache';
import {
    SHOPIFY_ECOM_CACHE_KEYS,
    SHOPIFY_ECOM_CACHE_TTL_MS,
    salesFingerprintsMatch,
} from './shopifyEcommerceCacheShared';

export { SHOPIFY_ECOM_CACHE_KEYS, SHOPIFY_ECOM_CACHE_TTL_MS } from './shopifyEcommerceCacheShared';
export { buildSalesFingerprint, salesFingerprintsMatch } from './shopifyEcommerceCacheShared';

const MEMORY = globalThis.__shopifyEcommerceMemoryCache ?? new Map();
globalThis.__shopifyEcommerceMemoryCache = MEMORY;

function memoryKey(customerId, cacheKey) {
    return `${String(customerId)}:${cacheKey}`;
}

function isMemoryEntryValid(entry, salesFingerprint) {
    if (!entry || !entry.expiresAt || entry.expiresAt <= Date.now()) return false;
    if (salesFingerprint && !salesFingerprintsMatch(entry.salesFingerprint, salesFingerprint)) {
        return false;
    }
    return true;
}

/**
 * @param {string} customerId
 * @param {string} cacheKey
 * @param {{ salesFingerprint?: object|null, allowExpiredFingerprint?: boolean }} [options]
 */
export async function readShopifyEcommerceCache(customerId, cacheKey, options = {}) {
    const { salesFingerprint = null } = options;
    const mem = MEMORY.get(memoryKey(customerId, cacheKey));
    if (isMemoryEntryValid(mem, salesFingerprint)) {
        return { payload: mem.payload, fromCache: true, layer: 'memory' };
    }

    try {
        await connectToDatabase();
        const doc = await ShopifyEcommerceCache.findOne({ customerId, cacheKey }).lean();
        if (!doc || !doc.expiresAt || new Date(doc.expiresAt).getTime() <= Date.now()) {
            return null;
        }
        if (salesFingerprint && !salesFingerprintsMatch(doc.salesFingerprint, salesFingerprint)) {
            return null;
        }
        const entry = {
            payload: doc.payload,
            salesFingerprint: doc.salesFingerprint,
            expiresAt: new Date(doc.expiresAt).getTime(),
        };
        MEMORY.set(memoryKey(customerId, cacheKey), entry);
        return { payload: doc.payload, fromCache: true, layer: 'mongo' };
    } catch (err) {
        console.warn('[Shopify ecommerce cache] read failed:', err?.message || err);
        return null;
    }
}

/**
 * @param {string} customerId
 * @param {string} cacheKey
 * @param {object} payload
 * @param {object|null} salesFingerprint
 */
export async function writeShopifyEcommerceCache(customerId, cacheKey, payload, salesFingerprint) {
    const expiresAt = new Date(Date.now() + SHOPIFY_ECOM_CACHE_TTL_MS);
    const entry = {
        payload,
        salesFingerprint: salesFingerprint || null,
        expiresAt: expiresAt.getTime(),
    };
    MEMORY.set(memoryKey(customerId, cacheKey), entry);

    try {
        await connectToDatabase();
        await ShopifyEcommerceCache.findOneAndUpdate(
            { customerId, cacheKey },
            {
                customerId,
                cacheKey,
                payload,
                salesFingerprint: salesFingerprint || null,
                expiresAt,
            },
            { upsert: true, new: true }
        );
    } catch (err) {
        console.warn('[Shopify ecommerce cache] write failed:', err?.message || err);
    }
}

/**
 * @param {string} customerId
 * @param {string[]} productIds
 * @param {object|null} salesFingerprint
 * @returns {Promise<{ hits: Record<string, object>, misses: string[] }>}
 */
export async function readProductInventoryCache(customerId, productIds, salesFingerprint) {
    const cached = await readShopifyEcommerceCache(
        customerId,
        SHOPIFY_ECOM_CACHE_KEYS.productInventoryById,
        { salesFingerprint }
    );
    /** @type {Record<string, object>} */
    const hits = {};
    const misses = [];
    const map = cached?.payload && typeof cached.payload === 'object' ? cached.payload : {};
    for (const id of productIds) {
        if (map[id]) hits[id] = map[id];
        else misses.push(id);
    }
    return { hits, misses };
}

/**
 * Merge product inventory rows into cache (same sales fingerprint / TTL bucket).
 * @param {string} customerId
 * @param {Record<string, object>} rows
 * @param {object|null} salesFingerprint
 */
export async function mergeProductInventoryCache(customerId, rows, salesFingerprint) {
    if (!rows || !Object.keys(rows).length) return;
    const existing = await readShopifyEcommerceCache(
        customerId,
        SHOPIFY_ECOM_CACHE_KEYS.productInventoryById,
        { salesFingerprint }
    );
    const merged = {
        ...(existing?.payload && typeof existing.payload === 'object' ? existing.payload : {}),
        ...rows,
    };
    await writeShopifyEcommerceCache(
        customerId,
        SHOPIFY_ECOM_CACHE_KEYS.productInventoryById,
        merged,
        salesFingerprint
    );
}
