/**
 * Incoming inventory (GraphQL quantities + optional transfers/shipments).
 * Uses the same Admin API version as {@link shopifyAdminGraphqlPost} (default 2026-04).
 *
 * Scopes:
 * - read_products + read_inventory — variant levels and quantities(names: …)
 * - read_inventory_transfers — inventoryTransfers (2026-04+)
 * - read_inventory_shipments — shipment line items + tracking.arrivesAt (2026-04+)
 */
import {
    getShopifyAdminApiVersion,
    normalizeShopifyShopDomain,
} from "./shopifyShopDomain.js";
import {
    shopifyAdminGraphqlPostWithRetry,
    shopifyGraphqlTopLevelErrors,
} from "./shopifyAdminClient.js";

/** @see https://shopify.dev/docs/api/admin-graphql/2026-04/objects/InventoryLevel */
export const INVENTORY_LEVEL_QUANTITY_NAMES = [
    "available",
    "on_hand",
    "committed",
    "incoming",
];

export const SHOPIFY_INCOMING_INVENTORY_SCOPES = {
    /** Required for InventoryLevel.quantities and inventory item levels */
    base: ["read_inventory", "read_products"],
    /** inventoryTransfers query (Admin GraphQL 2026-04) */
    transfers: "read_inventory_transfers",
    /** inventoryShipments + InventoryShipment.tracking (Admin GraphQL 2026-04) */
    shipments: "read_inventory_shipments",
};

const OPEN_TRANSFER_STATUS_QUERY = "status:IN_PROGRESS OR status:READY_TO_SHIP";
const OPEN_SHIPMENT_STATUS_QUERY =
    "status:IN_TRANSIT OR status:DRAFT OR status:PARTIALLY_RECEIVED";

const VARIANTS_PAGE_SIZE = 100;
const INVENTORY_LEVELS_PAGE_SIZE = 50;
const PRODUCT_ID_BATCH_SIZE = 40;
const TRANSFERS_PAGE_SIZE = 25;
const LINE_ITEMS_PAGE_SIZE = 50;

/**
 * @param {{ name?: string, quantity?: number }[]} quantities
 * @returns {{ available: number, onHand: number, committed: number, incoming: number }}
 */
export function parseInventoryLevelQuantities(quantities) {
    const out = { available: 0, onHand: 0, committed: 0, incoming: 0 };
    for (const q of quantities || []) {
        const name = String(q?.name ?? "");
        const qty = Number(q?.quantity) || 0;
        if (name === "available") out.available = qty;
        else if (name === "on_hand") out.onHand = qty;
        else if (name === "committed") out.committed = qty;
        else if (name === "incoming") out.incoming = qty;
    }
    return out;
}

/**
 * @param {string} shopUrl
 * @param {string} accessToken
 * @returns {Promise<{ handles: string[], source: 'rest'|'graphql'|'none', error?: string }>}
 */
export async function fetchShopifyGrantedAccessScopes(shopUrl, accessToken) {
    const domain = normalizeShopifyShopDomain(shopUrl);
    if (!domain || !accessToken) {
        return { handles: [], source: "none", error: "Missing shop or token" };
    }

    try {
        const res = await fetch(`https://${domain}/admin/oauth/access_scopes.json`, {
            headers: { "X-Shopify-Access-Token": accessToken },
        });
        if (res.ok) {
            const json = await res.json().catch(() => ({}));
            const handles = (json?.access_scopes || [])
                .map((s) => s?.handle)
                .filter(Boolean);
            return { handles, source: "rest" };
        }
    } catch {
        // fall through to GraphQL
    }

    const query = `query AccessScopeList {
        currentAppInstallation {
            accessScopes { handle }
        }
    }`;
    const { res, json } = await shopifyAdminGraphqlPostWithRetry(domain, accessToken, { query });
    if (!res.ok) {
        return {
            handles: [],
            source: "none",
            error: `Could not read scopes (HTTP ${res.status}). Custom Admin tokens: configure scopes in Shopify Admin → Apps.`,
        };
    }
    const handles =
        json?.data?.currentAppInstallation?.accessScopes?.map((s) => s.handle).filter(Boolean) ||
        [];
    if (!handles.length && shopifyGraphqlTopLevelErrors(json).length) {
        return {
            handles: [],
            source: "graphql",
            error: shopifyGraphqlTopLevelErrors(json).map((e) => e.message).join("; "),
        };
    }
    return { handles, source: "graphql" };
}

/**
 * @param {string[]} grantedHandles
 * @returns {{ ok: boolean, missing: string[], granted: string[] }}
 */
export function checkShopifyIncomingInventoryScopes(grantedHandles) {
    const granted = new Set(grantedHandles || []);
    const required = [
        ...SHOPIFY_INCOMING_INVENTORY_SCOPES.base,
        SHOPIFY_INCOMING_INVENTORY_SCOPES.transfers,
        SHOPIFY_INCOMING_INVENTORY_SCOPES.shipments,
    ];
    const missing = required.filter((s) => !granted.has(s));
    return {
        ok: missing.length === 0,
        missing,
        granted: required.filter((s) => granted.has(s)),
    };
}

/**
 * @param {string|null|undefined} a
 * @param {string|null|undefined} b
 * @returns {string|null}
 */
function earliestIsoDate(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    return a <= b ? a : b;
}

/**
 * Optional: open transfers/shipments → earliest expected arrival per inventory item.
 * Field names match Admin GraphQL 2026-04: InventoryShipment.tracking.arrivesAt, etc.
 *
 * @returns {Promise<Map<string, string>>} inventoryItem GID → ISO 8601 date/time
 */
export async function fetchOpenInventoryIncomingArrivals(shopUrl, accessToken) {
    const arrivalByItem = new Map();
    const apiVersion = getShopifyAdminApiVersion();

    const scopeResult = await fetchShopifyGrantedAccessScopes(shopUrl, accessToken);
    const scopeCheck = checkShopifyIncomingInventoryScopes(scopeResult.handles);
    if (!scopeResult.handles.length) {
        console.warn(
            `[Shopify inventory] Could not verify access scopes${scopeResult.error ? `: ${scopeResult.error}` : ""}. ` +
                `Arrival dates need ${SHOPIFY_INCOMING_INVENTORY_SCOPES.transfers} and ${SHOPIFY_INCOMING_INVENTORY_SCOPES.shipments}.`
        );
    } else if (
        !scopeResult.handles.includes(SHOPIFY_INCOMING_INVENTORY_SCOPES.transfers) ||
        !scopeResult.handles.includes(SHOPIFY_INCOMING_INVENTORY_SCOPES.shipments)
    ) {
        console.warn(
            `[Shopify inventory] Token missing scope(s): ${scopeCheck.missing.join(", ") || "unknown"}. ` +
                "expectedArrivalDate will stay null unless scopes are added in Shopify Admin."
        );
        return arrivalByItem;
    }

    await paginateOpenInventoryTransfers(shopUrl, accessToken, arrivalByItem);
    await paginateOpenInventoryShipments(shopUrl, accessToken, arrivalByItem);

    if (arrivalByItem.size === 0) {
        console.info(
            `[Shopify inventory] No open transfer/shipment arrival dates (API ${apiVersion}). ` +
                "Dates appear when in-progress transfers or in-transit shipments exist in Shopify Admin."
        );
    }

    return arrivalByItem;
}

/**
 * @param {Map<string, string>} arrivalByItem
 */
async function paginateOpenInventoryTransfers(shopUrl, accessToken, arrivalByItem) {
    let cursor = null;
    let hasNext = true;

    const query = `query OpenInventoryTransfers($first: Int!, $after: String, $query: String) {
        inventoryTransfers(first: $first, after: $after, query: $query) {
            nodes {
                id
                status
            }
            pageInfo { hasNextPage endCursor }
        }
    }`;

    while (hasNext) {
        const { res, json } = await shopifyAdminGraphqlPostWithRetry(shopUrl, accessToken, {
            query,
            variables: {
                first: TRANSFERS_PAGE_SIZE,
                after: cursor,
                query: OPEN_TRANSFER_STATUS_QUERY,
            },
        });
        if (!res.ok || shopifyGraphqlTopLevelErrors(json).some((e) => /access denied|scope/i.test(e.message))) {
            console.warn(
                "[Shopify inventory] inventoryTransfers unavailable — requires read_inventory_transfers on API 2026-04+."
            );
            return;
        }

        const connection = json?.data?.inventoryTransfers;
        const nodes = connection?.nodes || [];
        for (const transfer of nodes) {
            await mergeTransferShipmentArrivals(shopUrl, accessToken, transfer.id, arrivalByItem);
        }

        hasNext = !!connection?.pageInfo?.hasNextPage;
        cursor = connection?.pageInfo?.endCursor || null;
    }
}

async function mergeTransferShipmentArrivals(shopUrl, accessToken, transferId, arrivalByItem) {
    let shipCursor = null;
    let shipHasNext = true;

    const shipmentsListQuery = `query TransferShipments($id: ID!, $first: Int!, $after: String) {
        inventoryTransfer(id: $id) {
            id
            shipments(first: $first, after: $after) {
                nodes { id }
                pageInfo { hasNextPage endCursor }
            }
        }
    }`;

    while (shipHasNext) {
        const { res, json } = await shopifyAdminGraphqlPostWithRetry(shopUrl, accessToken, {
            query: shipmentsListQuery,
            variables: { id: transferId, first: 10, after: shipCursor },
        });
        if (!res.ok || !json?.data?.inventoryTransfer) break;

        const shipConn = json.data.inventoryTransfer.shipments;
        for (const shipment of shipConn?.nodes || []) {
            await mergeShipmentArrivalLines(shopUrl, accessToken, shipment.id, arrivalByItem);
        }
        shipHasNext = !!shipConn?.pageInfo?.hasNextPage;
        shipCursor = shipConn?.pageInfo?.endCursor || null;
    }
}

async function mergeShipmentArrivalLines(shopUrl, accessToken, shipmentId, arrivalByItem) {
    const header = await fetchInventoryShipmentHeader(shopUrl, accessToken, shipmentId);
    const arrivesAt = header?.tracking?.arrivesAt || null;
    if (!arrivesAt) return;

    let lineCursor = null;
    let lineHasNext = true;

    while (lineHasNext) {
        const page = await fetchShipmentLineItemsPage(shopUrl, accessToken, shipmentId, lineCursor);
        if (!page) break;
        for (const line of page.nodes || []) {
            const itemId = line?.inventoryItem?.id;
            const unreceived = Number(line?.unreceivedQuantity) || 0;
            if (!itemId || unreceived <= 0 || !arrivesAt) continue;
            arrivalByItem.set(itemId, earliestIsoDate(arrivalByItem.get(itemId), arrivesAt));
        }
        lineHasNext = !!page.pageInfo?.hasNextPage;
        lineCursor = page.pageInfo?.endCursor || null;
    }
}

async function fetchInventoryShipmentHeader(shopUrl, accessToken, shipmentId) {
    const query = `query ShipmentHeader($id: ID!) {
        inventoryShipment(id: $id) {
            id
            tracking { arrivesAt }
        }
    }`;
    const { res, json } = await shopifyAdminGraphqlPostWithRetry(shopUrl, accessToken, {
        query,
        variables: { id: shipmentId },
    });
    if (!res.ok) return null;
    return json?.data?.inventoryShipment;
}

async function fetchShipmentLineItemsPage(shopUrl, accessToken, shipmentId, after) {
    const query = `query ShipmentLineItems($id: ID!, $first: Int!, $after: String) {
        inventoryShipment(id: $id) {
            id
            tracking { arrivesAt }
            lineItems(first: $first, after: $after) {
                nodes {
                    unreceivedQuantity
                    inventoryItem { id }
                }
                pageInfo { hasNextPage endCursor }
            }
        }
    }`;
    const { res, json } = await shopifyAdminGraphqlPostWithRetry(shopUrl, accessToken, {
        query,
        variables: { id: shipmentId, first: LINE_ITEMS_PAGE_SIZE, after },
    });
    if (!res.ok) return null;
    return json?.data?.inventoryShipment?.lineItems;
}

async function paginateOpenInventoryShipments(shopUrl, accessToken, arrivalByItem) {
    let cursor = null;
    let hasNext = true;

    const query = `query OpenInventoryShipments($first: Int!, $after: String, $query: String) {
        inventoryShipments(first: $first, after: $after, query: $query) {
            nodes {
                id
                status
                tracking { arrivesAt }
                lineItems(first: ${LINE_ITEMS_PAGE_SIZE}) {
                    nodes {
                        unreceivedQuantity
                        inventoryItem { id }
                    }
                    pageInfo { hasNextPage endCursor }
                }
            }
            pageInfo { hasNextPage endCursor }
        }
    }`;

    while (hasNext) {
        const { res, json } = await shopifyAdminGraphqlPostWithRetry(shopUrl, accessToken, {
            query,
            variables: {
                first: TRANSFERS_PAGE_SIZE,
                after: cursor,
                query: OPEN_SHIPMENT_STATUS_QUERY,
            },
        });
        if (!res.ok || shopifyGraphqlTopLevelErrors(json).some((e) => /access denied|scope/i.test(e.message))) {
            console.warn(
                "[Shopify inventory] inventoryShipments unavailable — requires read_inventory_shipments on API 2026-04+."
            );
            return;
        }

        const connection = json?.data?.inventoryShipments;
        const nodes = connection?.nodes || [];
        for (const shipment of nodes) {
            await mergeShipmentArrivalLines(shopUrl, accessToken, shipment.id, arrivalByItem);
        }

        hasNext = !!connection?.pageInfo?.hasNextPage;
        cursor = connection?.pageInfo?.endCursor || null;
    }
}

const PRODUCT_INVENTORY_BATCH_QUERY = `query ProductInventoryBatch($ids: [ID!]!, $names: [String!]!, $variantFirst: Int!, $levelFirst: Int!) {
    nodes(ids: $ids) {
        ... on Product {
            id
            variants(first: $variantFirst) {
                nodes {
                    id
                    sku
                    sellableOnlineQuantity
                    inventoryItem {
                        id
                        unitCost { amount }
                        inventoryLevels(first: $levelFirst) {
                            nodes {
                                location { id name }
                                quantities(names: $names) {
                                    name
                                    quantity
                                }
                            }
                            pageInfo { hasNextPage endCursor }
                        }
                    }
                }
                pageInfo { hasNextPage endCursor }
            }
        }
    }
}`;

const PRODUCT_VARIANTS_PAGE_QUERY = `query ProductVariantsInventory($id: ID!, $first: Int!, $after: String, $names: [String!]!, $levelFirst: Int!) {
    product(id: $id) {
        id
        variants(first: $first, after: $after) {
            nodes {
                id
                sku
                sellableOnlineQuantity
                inventoryItem {
                    id
                    unitCost { amount }
                    inventoryLevels(first: $levelFirst) {
                        nodes {
                            location { id name }
                            quantities(names: $names) {
                                name
                                quantity
                            }
                        }
                        pageInfo { hasNextPage endCursor }
                    }
                }
            }
            pageInfo { hasNextPage endCursor }
        }
    }
}`;

const INVENTORY_ITEM_LEVELS_QUERY = `query InventoryItemLevels($id: ID!, $first: Int!, $after: String, $names: [String!]!) {
    inventoryItem(id: $id) {
        id
        inventoryLevels(first: $first, after: $after) {
            nodes {
                id
                location { id name }
                quantities(names: $names) {
                    name
                    quantity
                }
            }
            pageInfo { hasNextPage endCursor }
        }
    }
}`;

function createEmptyProductInventoryDetail() {
    return {
        inventoryStock: 0,
        inventoryValue: 0,
        availableQuantity: 0,
        incomingQuantity: 0,
        expectedArrivalDate: null,
        variants: [],
        inventoryItemIds: [],
        fetched: false,
    };
}

const STOCK_VALUE_BATCH_QUERY = `query ProductStockValueBatch($ids: [ID!]!, $variantFirst: Int!) {
    nodes(ids: $ids) {
        ... on Product {
            id
            variants(first: $variantFirst) {
                nodes {
                    sellableOnlineQuantity
                    inventoryItem {
                        unitCost { amount }
                    }
                }
                pageInfo { hasNextPage endCursor }
            }
        }
    }
}`;

const STOCK_VALUE_VARIANTS_PAGE_QUERY = `query ProductStockValueVariantsPage($id: ID!, $first: Int!, $after: String) {
    product(id: $id) {
        id
        variants(first: $first, after: $after) {
            nodes {
                sellableOnlineQuantity
                inventoryItem {
                    unitCost { amount }
                }
            }
            pageInfo { hasNextPage endCursor }
        }
    }
}`;

/**
 * Stock + value from sellableOnlineQuantity (same proven query as pre-incoming inventory).
 * @returns {Promise<Map<string, { inventoryStock: number, inventoryValue: number, fetched: boolean }>>}
 */
export async function fetchProductsStockValueDetails(shopUrl, accessToken, productIds) {
    /** @type {Map<string, { inventoryStock: number, inventoryValue: number, fetched: boolean }>} */
    const detailMap = new Map();
    /** @type {{ productId: string, after: string }[]} */
    const pendingVariants = [];

    const absorbStockVariants = (productId, variantNodes) => {
        if (!detailMap.has(productId)) {
            detailMap.set(productId, { inventoryStock: 0, inventoryValue: 0, fetched: false });
        }
        const detail = detailMap.get(productId);
        detail.fetched = true;
        for (const variant of variantNodes) {
            const qty = parseInt(variant.sellableOnlineQuantity, 10) || 0;
            const unitCost = parseFloat(variant.inventoryItem?.unitCost?.amount) || 0;
            detail.inventoryStock += qty;
            detail.inventoryValue += qty * unitCost;
        }
    };

    for (let i = 0; i < productIds.length; i += PRODUCT_ID_BATCH_SIZE) {
        const batchIds = productIds.slice(i, i + PRODUCT_ID_BATCH_SIZE);
        const { res, json } = await shopifyAdminGraphqlPostWithRetry(shopUrl, accessToken, {
            query: STOCK_VALUE_BATCH_QUERY,
            variables: { ids: batchIds, variantFirst: VARIANTS_PAGE_SIZE },
        });
        if (!res.ok) {
            console.warn(`[Shopify inventory] stock batch HTTP ${res.status}`);
            continue;
        }
        const gqlErrors = shopifyGraphqlTopLevelErrors(json);
        if (gqlErrors.length) {
            console.warn('[Shopify inventory] stock batch GraphQL:', gqlErrors.map((e) => e.message).join('; '));
        }

        for (const node of json?.data?.nodes || []) {
            if (!node?.id) continue;
            const variantConn = node.variants;
            absorbStockVariants(node.id, variantConn?.nodes || []);
            if (variantConn?.pageInfo?.hasNextPage) {
                pendingVariants.push({ productId: node.id, after: variantConn.pageInfo.endCursor });
            }
        }
    }

    while (pendingVariants.length) {
        const { productId, after } = pendingVariants.shift();
        const { res, json } = await shopifyAdminGraphqlPostWithRetry(shopUrl, accessToken, {
            query: STOCK_VALUE_VARIANTS_PAGE_QUERY,
            variables: { id: productId, first: VARIANTS_PAGE_SIZE, after },
        });
        if (!res.ok || !json?.data?.product) continue;
        const variantConn = json.data.product.variants;
        absorbStockVariants(productId, variantConn?.nodes || []);
        if (variantConn?.pageInfo?.hasNextPage) {
            pendingVariants.push({ productId, after: variantConn.pageInfo.endCursor });
        }
    }

    return detailMap;
}

/**
 * @param {object} detail
 * @param {object} variant
 * @param {boolean} includeVariantDetails
 * @param {{ productId: string, inventoryItemId: string, after: string, variantRef?: object }[]} pendingLevels
 */
function absorbProductVariantNode(detail, variant, includeVariantDetails, pendingLevels) {
    const sellable = parseInt(variant.sellableOnlineQuantity, 10) || 0;
    const unitCost = parseFloat(variant.inventoryItem?.unitCost?.amount) || 0;
    detail.inventoryStock += sellable;
    detail.inventoryValue += sellable * unitCost;

    const inventoryItemId = variant.inventoryItem?.id;
    /** @type {object|null} */
    let variantRef = null;
    if (includeVariantDetails) {
        variantRef = {
            variantId: variant.id,
            sku: variant.sku ?? null,
            inventoryItemId: inventoryItemId || null,
            locations: [],
        };
        detail.variants.push(variantRef);
    }

    if (inventoryItemId) {
        detail.inventoryItemIds.push(inventoryItemId);
        const levelConn = variant.inventoryItem?.inventoryLevels;
        absorbInventoryLevelNodes(detail, variantRef, levelConn?.nodes || []);
        if (levelConn?.pageInfo?.hasNextPage) {
            pendingLevels.push({
                inventoryItemId,
                after: levelConn.pageInfo.endCursor,
                variantRef,
            });
        }
    }
}

/**
 * @param {object} detail
 * @param {object|null} variantRef
 * @param {object[]} levelNodes
 */
function absorbInventoryLevelNodes(detail, variantRef, levelNodes) {
    for (const level of levelNodes) {
        const q = parseInventoryLevelQuantities(level.quantities);
        detail.availableQuantity += q.available;
        detail.incomingQuantity += q.incoming;
        if (variantRef) {
            variantRef.locations.push({
                locationId: level.location?.id || "",
                locationName: level.location?.name || "",
                available: q.available,
                onHand: q.onHand,
                committed: q.committed,
                incoming: q.incoming,
            });
        }
    }
}

/**
 * Batched inventory fetch (variants + nested levels, with pagination follow-ups).
 *
 * @param {string} shopUrl
 * @param {string} accessToken
 * @param {string[]} productIds
 * @param {{ includeVariantDetails?: boolean }} [options]
 * @returns {Promise<Map<string, object>>}
 */
export async function fetchProductsInventoryDetails(shopUrl, accessToken, productIds, options = {}) {
    const { includeVariantDetails = true } = options;
    /** @type {Map<string, object>} */
    const detailMap = new Map();
    for (const id of productIds) {
        detailMap.set(id, createEmptyProductInventoryDetail());
    }

    /** @type {{ productId: string, after: string }[]} */
    const pendingVariants = [];
    /** @type {{ inventoryItemId: string, after: string, variantRef?: object }[]} */
    const pendingLevels = [];

    for (let i = 0; i < productIds.length; i += PRODUCT_ID_BATCH_SIZE) {
        const batchIds = productIds.slice(i, i + PRODUCT_ID_BATCH_SIZE);
        const { res, json } = await shopifyAdminGraphqlPostWithRetry(shopUrl, accessToken, {
            query: PRODUCT_INVENTORY_BATCH_QUERY,
            variables: {
                ids: batchIds,
                names: INVENTORY_LEVEL_QUANTITY_NAMES,
                variantFirst: VARIANTS_PAGE_SIZE,
                levelFirst: INVENTORY_LEVELS_PAGE_SIZE,
            },
        });
        if (!res.ok) continue;

        for (const node of json?.data?.nodes || []) {
            if (!node?.id) continue;
            if (!detailMap.has(node.id)) {
                detailMap.set(node.id, createEmptyProductInventoryDetail());
            }
            const detail = detailMap.get(node.id);
            detail.fetched = true;
            const variantConn = node.variants;
            for (const variant of variantConn?.nodes || []) {
                absorbProductVariantNode(detail, variant, includeVariantDetails, pendingLevels);
            }
            if (variantConn?.pageInfo?.hasNextPage) {
                pendingVariants.push({
                    productId: node.id,
                    after: variantConn.pageInfo.endCursor,
                });
            }
        }
    }

    while (pendingVariants.length) {
        const { productId, after } = pendingVariants.shift();
        const detail = detailMap.get(productId);
        if (!detail) continue;

        const { res, json } = await shopifyAdminGraphqlPostWithRetry(shopUrl, accessToken, {
            query: PRODUCT_VARIANTS_PAGE_QUERY,
            variables: {
                id: productId,
                first: VARIANTS_PAGE_SIZE,
                after,
                names: INVENTORY_LEVEL_QUANTITY_NAMES,
                levelFirst: INVENTORY_LEVELS_PAGE_SIZE,
            },
        });
        if (!res.ok || !json?.data?.product) continue;

        const variantConn = json.data.product.variants;
        for (const variant of variantConn?.nodes || []) {
            absorbProductVariantNode(detail, variant, includeVariantDetails, pendingLevels);
        }
        if (variantConn?.pageInfo?.hasNextPage) {
            pendingVariants.push({ productId, after: variantConn.pageInfo.endCursor });
        }
    }

    while (pendingLevels.length) {
        const { inventoryItemId, after, variantRef } = pendingLevels.shift();
        const { res, json } = await shopifyAdminGraphqlPostWithRetry(shopUrl, accessToken, {
            query: INVENTORY_ITEM_LEVELS_QUERY,
            variables: {
                id: inventoryItemId,
                first: INVENTORY_LEVELS_PAGE_SIZE,
                after,
                names: INVENTORY_LEVEL_QUANTITY_NAMES,
            },
        });
        if (!res.ok) continue;
        const levelConn = json?.data?.inventoryItem?.inventoryLevels;
        const productDetail = findDetailByInventoryItemId(detailMap, inventoryItemId);
        if (productDetail) {
            absorbInventoryLevelNodes(productDetail, variantRef, levelConn?.nodes || []);
        }
        if (levelConn?.pageInfo?.hasNextPage) {
            pendingLevels.push({
                inventoryItemId,
                after: levelConn.pageInfo.endCursor,
                variantRef,
            });
        }
    }

    return detailMap;
}

/** @param {Map<string, object>} detailMap @param {string} inventoryItemId */
function findDetailByInventoryItemId(detailMap, inventoryItemId) {
    for (const detail of detailMap.values()) {
        if (detail.inventoryItemIds?.includes(inventoryItemId)) return detail;
    }
    return null;
}

const PRODUCT_VARIANT_ITEM_IDS_QUERY = `query ProductVariantItemIds($ids: [ID!]!, $first: Int!) {
    nodes(ids: $ids) {
        ... on Product {
            id
            variants(first: $first) {
                nodes {
                    inventoryItem { id }
                }
                pageInfo { hasNextPage endCursor }
            }
        }
    }
}`;

const PRODUCT_VARIANT_ITEM_IDS_PAGE_QUERY = `query ProductVariantItemIdsPage($id: ID!, $first: Int!, $after: String) {
    product(id: $id) {
        id
        variants(first: $first, after: $after) {
            nodes {
                inventoryItem { id }
            }
            pageInfo { hasNextPage endCursor }
        }
    }
}`;

/**
 * Minimal variant pagination — inventory item GIDs only (for shipment arrival mapping).
 * @returns {Promise<Map<string, string[]>>} product GID → inventory item GIDs
 */
export async function fetchInventoryItemIdsByProduct(shopUrl, accessToken, productIds) {
    /** @type {Map<string, string[]>} */
    const out = new Map();
    /** @type {{ productId: string, after: string }[]} */
    const pendingVariants = [];

    for (let i = 0; i < productIds.length; i += PRODUCT_ID_BATCH_SIZE) {
        const batchIds = productIds.slice(i, i + PRODUCT_ID_BATCH_SIZE);
        const { res, json } = await shopifyAdminGraphqlPostWithRetry(shopUrl, accessToken, {
            query: PRODUCT_VARIANT_ITEM_IDS_QUERY,
            variables: { ids: batchIds, first: VARIANTS_PAGE_SIZE },
        });
        if (!res.ok) continue;

        for (const node of json?.data?.nodes || []) {
            if (!node?.id) continue;
            const ids = collectInventoryItemIdsFromVariantNodes(node.variants?.nodes || []);
            out.set(node.id, ids);
            if (node.variants?.pageInfo?.hasNextPage) {
                pendingVariants.push({ productId: node.id, after: node.variants.pageInfo.endCursor });
            }
        }
    }

    while (pendingVariants.length) {
        const { productId, after } = pendingVariants.shift();
        const { res, json } = await shopifyAdminGraphqlPostWithRetry(shopUrl, accessToken, {
            query: PRODUCT_VARIANT_ITEM_IDS_PAGE_QUERY,
            variables: { id: productId, first: VARIANTS_PAGE_SIZE, after },
        });
        if (!res.ok || !json?.data?.product) continue;
        const variantConn = json.data.product.variants;
        const existing = out.get(productId) || [];
        existing.push(...collectInventoryItemIdsFromVariantNodes(variantConn?.nodes || []));
        out.set(productId, existing);
        if (variantConn?.pageInfo?.hasNextPage) {
            pendingVariants.push({ productId, after: variantConn.pageInfo.endCursor });
        }
    }

    return out;
}

/** @param {object[]} variantNodes */
function collectInventoryItemIdsFromVariantNodes(variantNodes) {
    const ids = [];
    for (const v of variantNodes) {
        const iid = v?.inventoryItem?.id;
        if (iid) ids.push(iid);
    }
    return ids;
}

/**
 * Expected arrival dates only (no stock re-fetch). Uses open transfers/shipments + variant→item map.
 * @returns {Promise<Record<string, { expectedArrivalDate: string|null }>>}
 */
export async function fetchExpectedArrivalByProduct(shopUrl, accessToken, productIds) {
    const out = {};
    if (!productIds.length) return out;

    const [arrivalByItem, itemIdsByProduct] = await Promise.all([
        fetchOpenInventoryIncomingArrivals(shopUrl, accessToken),
        fetchInventoryItemIdsByProduct(shopUrl, accessToken, productIds),
    ]);

    for (const productId of productIds) {
        let expectedArrivalDate = null;
        for (const itemId of itemIdsByProduct.get(productId) || []) {
            const at = arrivalByItem.get(itemId);
            if (at) expectedArrivalDate = earliestIsoDate(expectedArrivalDate, at);
        }
        out[productId] = { expectedArrivalDate };
    }
    return out;
}

/** @deprecated Use fetchProductsInventoryDetails */
export async function fetchSingleProductInventoryDetail(shopUrl, accessToken, productGid) {
    const map = await fetchProductsInventoryDetails(shopUrl, accessToken, [productGid], {
        includeVariantDetails: true,
    });
    return map.get(productGid) || null;
}
