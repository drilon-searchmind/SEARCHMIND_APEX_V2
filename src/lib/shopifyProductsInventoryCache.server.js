import 'server-only';

import {
    SHOPIFY_ECOM_CACHE_KEYS,
    buildSalesFingerprint,
} from './shopifyEcommerceCacheShared';
import {
    mergeProductInventoryCache,
    readProductInventoryCache,
    readShopifyEcommerceCache,
    writeShopifyEcommerceCache,
} from './shopifyEcommerceCache';
import {
    fetchProductInventoryOnly,
    fetchShopifySalesPeriodSummary,
    fetchStoreInventoryTotals,
} from './shopifyProductsApi';

const SHORT_FP_TTL_MS = 5 * 60 * 1000;
const shortSalesFingerprintMap = globalThis.__shopifyShortSalesFingerprint ?? new Map();
globalThis.__shopifyShortSalesFingerprint = shortSalesFingerprintMap;

function shortFingerprintKey(customerId, startDate, endDate) {
    return `${String(customerId)}|${startDate}|${endDate}`;
}

function readShortSalesFingerprint(customerId, startDate, endDate) {
    const hit = shortSalesFingerprintMap.get(shortFingerprintKey(customerId, startDate, endDate));
    if (!hit || hit.expiresAt <= Date.now()) return null;
    return hit.fingerprint;
}

function writeShortSalesFingerprint(customerId, startDate, endDate, fingerprint) {
    if (!fingerprint) return;
    shortSalesFingerprintMap.set(shortFingerprintKey(customerId, startDate, endDate), {
        fingerprint,
        expiresAt: Date.now() + SHORT_FP_TTL_MS,
    });
}

async function resolveSalesFingerprintForCache(
    settings,
    customerId,
    startDate,
    endDate,
    customerType,
    provided
) {
    if (provided) return provided;
    if (customerId && startDate && endDate) {
        const short = readShortSalesFingerprint(customerId, startDate, endDate);
        if (short) return short;
    }
    if (!startDate || !endDate) return null;
    const periodSummary = await fetchShopifySalesPeriodSummary(
        settings,
        startDate,
        endDate,
        customerType
    );
    const fingerprint = buildSalesFingerprint(periodSummary, startDate, endDate);
    if (customerId && fingerprint) {
        writeShortSalesFingerprint(customerId, startDate, endDate, fingerprint);
    }
    return fingerprint;
}

/**
 * Store-wide inventory totals with Mongo/memory cache (TTL + sales fingerprint).
 */
export async function fetchStoreInventoryTotalsCached(
    settings,
    customerId,
    { startDate, endDate, customerType = 'Shopify' } = {}
) {
    const periodSummary =
        startDate && endDate
            ? await fetchShopifySalesPeriodSummary(settings, startDate, endDate, customerType)
            : null;
    const salesFingerprint = buildSalesFingerprint(periodSummary, startDate, endDate);
    if (customerId && salesFingerprint) {
        writeShortSalesFingerprint(customerId, startDate, endDate, salesFingerprint);
    }

    if (customerId && salesFingerprint) {
        const cached = await readShopifyEcommerceCache(
            customerId,
            SHOPIFY_ECOM_CACHE_KEYS.inventoryTotals,
            { salesFingerprint }
        );
        if (cached?.payload) {
            return {
                totals: cached.payload,
                fromCache: true,
                cacheLayer: cached.layer,
                periodSummary,
                salesFingerprint,
            };
        }
    }

    const totals = await fetchStoreInventoryTotals(settings);
    if (customerId && salesFingerprint) {
        await writeShopifyEcommerceCache(
            customerId,
            SHOPIFY_ECOM_CACHE_KEYS.inventoryTotals,
            totals,
            salesFingerprint
        );
    }
    return {
        totals,
        fromCache: false,
        cacheLayer: null,
        periodSummary,
        salesFingerprint,
    };
}

/**
 * Per-product inventory with cache (skips Shopify for cache hits).
 */
export async function fetchProductInventoryOnlyCached(
    settings,
    customerId,
    productIds,
    options = {}
) {
    const ids = (productIds || []).filter(Boolean);
    if (!ids.length) return { inventory: {}, fromCache: true, fetchedCount: 0 };

    if (options.arrivalsOnly) {
        const inventory = await fetchProductInventoryOnly(settings, ids, options);
        return {
            inventory,
            fromCache: false,
            fetchedCount: ids.length,
            salesFingerprint: options.salesFingerprint || null,
        };
    }

    const { startDate, endDate, customerType = 'Shopify' } = options;
    const salesFingerprint = await resolveSalesFingerprintForCache(
        settings,
        customerId,
        startDate,
        endDate,
        customerType,
        options.salesFingerprint || null
    );

    if (customerId && salesFingerprint) {
        const { hits, misses } = await readProductInventoryCache(
            customerId,
            ids,
            salesFingerprint
        );
        let fetched = {};
        if (misses.length) {
            fetched = await fetchProductInventoryOnly(settings, misses, options);
            if (Object.keys(fetched).length) {
                await mergeProductInventoryCache(customerId, fetched, salesFingerprint);
            }
        }
        return {
            inventory: { ...hits, ...fetched },
            fromCache: misses.length === 0,
            fetchedCount: misses.length,
            salesFingerprint: salesFingerprint || null,
        };
    }

    const inventory = await fetchProductInventoryOnly(settings, ids, options);
    return {
        inventory,
        fromCache: false,
        fetchedCount: ids.length,
        salesFingerprint: salesFingerprint || null,
    };
}
