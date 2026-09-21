import { isDemoCustomerId } from "@/lib/demoCustomer";
import { loadMetaAdAccountForMcp } from "@root/lib/mcpMetaAccount";
import { metaGraphGet, metaGraphGetAll } from "./mcpMetaGraph.js";

export { parseMetaInsightsProductId } from "./mcpMetaProductParse.js";

const CATALOG_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const DEFAULT_MAX_PRODUCTS = 5000;

/** @type {Map<string, { expiresAt: number, payload: unknown }>} */
const catalogCache = new Map();

/**
 * @param {string} adAccountId
 */
function normalizeActId(adAccountId) {
	const raw = String(adAccountId || "").trim();
	if (!raw) return "";
	return raw.startsWith("act_") ? raw : `act_${raw}`;
}

/**
 * @param {number|string|undefined} value
 * @param {number} fallback
 * @param {number} max
 */
function clampInt(value, fallback, max) {
	const n = Number.parseInt(String(value ?? ""), 10);
	if (!Number.isFinite(n) || n <= 0) return fallback;
	return Math.min(n, max);
}

/**
 * @param {string|undefined} raw
 */
function parseIdList(raw) {
	if (!raw || !String(raw).trim()) return [];
	const text = String(raw).trim();
	if (text.startsWith("[")) {
		try {
			const parsed = JSON.parse(text);
			if (Array.isArray(parsed)) {
				return parsed.map((id) => String(id).trim()).filter(Boolean);
			}
		} catch {
			// fall through
		}
	}
	return text
		.split(",")
		.map((id) => id.trim())
		.filter(Boolean);
}

/**
 * @param {unknown} creative
 */
export function isDynamicCatalogCreative(creative) {
	if (!creative || typeof creative !== "object") return false;
	if (creative.product_set_id) return true;
	const name = String(creative.name || "");
	return /\{\{\s*product\./i.test(name) || /\{\{[^}]+\}\}/.test(name);
}

/**
 * @param {unknown} row
 */
function mapCatalogRow(row) {
	return {
		id: String(row.id ?? ""),
		name: String(row.name ?? ""),
		product_count: Number(row.product_count) || null,
		vertical: row.vertical ? String(row.vertical) : null,
	};
}

/**
 * @param {string} actId
 * @param {string} accessToken
 */
async function discoverCatalogsFromProductSets(actId, accessToken) {
	const ads = await metaGraphGetAll(
		`${actId}/ads`,
		accessToken,
		{ fields: "creative{product_set_id}", limit: "200" },
		{ maxPages: 8 }
	);
	const setIds = new Set();
	for (const ad of ads) {
		if (ad?.creative?.product_set_id) setIds.add(String(ad.creative.product_set_id));
	}

	/** @type {Map<string, ReturnType<typeof mapCatalogRow>>} */
	const catalogs = new Map();
	for (const setId of setIds) {
		try {
			const set = await metaGraphGet(setId, accessToken, {
				fields: "product_catalog{id,name,product_count,vertical}",
			});
			const cat = set?.product_catalog;
			if (cat?.id) catalogs.set(String(cat.id), mapCatalogRow(cat));
		} catch {
			// missing catalog_management on token — skip
		}
	}
	return [...catalogs.values()];
}

/**
 * @param {string} actId
 * @param {string} accessToken
 */
async function listProductCatalogs(actId, accessToken) {
	try {
		const json = await metaGraphGet(`${actId}/product_catalogs`, accessToken, {
			fields: "id,name,product_count,vertical",
			limit: "50",
		});
		if ((json.data || []).length > 0) {
			return (json.data || []).map(mapCatalogRow);
		}
	} catch {
		// edge unavailable on some API versions / tokens
	}

	try {
		const actMeta = await metaGraphGet(actId, accessToken, { fields: "business{id,name}" });
		const businessId = actMeta?.business?.id ? String(actMeta.business.id) : "";
		if (businessId) {
			for (const edge of ["owned_product_catalogs", "client_product_catalogs"]) {
				try {
					const json = await metaGraphGet(`${businessId}/${edge}`, accessToken, {
						fields: "id,name,product_count,vertical",
						limit: "50",
					});
					if ((json.data || []).length > 0) {
						return (json.data || []).map(mapCatalogRow);
					}
				} catch {
					// try next edge
				}
			}
		}
	} catch {
		// fall through
	}

	return discoverCatalogsFromProductSets(actId, accessToken);
}

/**
 * @param {string} catalogId
 * @param {string} accessToken
 * @param {number} maxProducts
 */
async function fetchCatalogProducts(catalogId, accessToken, maxProducts) {
	const rows = await metaGraphGetAll(
		`${catalogId}/products`,
		accessToken,
		{
			fields: "id,retailer_id,image_url,name",
			limit: "500",
		},
		{ maxPages: Math.ceil(maxProducts / 500) + 1, pageLimit: "500" }
	);

	return rows.slice(0, maxProducts).map((row) => ({
		id: String(row.id ?? ""),
		retailer_id: row.retailer_id != null ? String(row.retailer_id) : "",
		name: String(row.name ?? ""),
		image_url: row.image_url ? String(row.image_url) : null,
		catalog_id: catalogId,
	}));
}

/**
 * @param {string} cacheKey
 * @param {() => Promise<unknown>} loader
 */
async function withCatalogCache(cacheKey, loader) {
	const now = Date.now();
	const hit = catalogCache.get(cacheKey);
	if (hit && hit.expiresAt > now) {
		return { .../** @type {Record<string, unknown>} */ (hit.payload), cache: { hit: true, ttlSeconds: Math.round((hit.expiresAt - now) / 1000) } };
	}
	const payload = await loader();
	catalogCache.set(cacheKey, { expiresAt: now + CATALOG_CACHE_TTL_MS, payload });
	return { .../** @type {Record<string, unknown>} */ (payload), cache: { hit: false, ttlSeconds: Math.round(CATALOG_CACHE_TTL_MS / 1000) } };
}

export function demoCatalogPayload() {
	return {
		kind: "meta-catalog-products",
		adAccountId: "demo",
		demo: true,
		catalogs: [{ id: "9001", name: "Demo product catalog", product_count: 2, vertical: "commerce" }],
		products: [
			{
				id: "meta-prod-1001",
				retailer_id: "SKU-DEMO-1",
				name: "Demo catalog product A",
				image_url: "https://scontent.example/fbcdn.net/demo-catalog-a.jpg",
				catalog_id: "9001",
			},
			{
				id: "meta-prod-1002",
				retailer_id: "SKU-DEMO-2",
				name: "Demo catalog product B",
				image_url: "https://scontent.example/fbcdn.net/demo-catalog-b.jpg",
				catalog_id: "9001",
			},
		],
		summary: {
			catalogCount: 1,
			productCount: 2,
			withImageUrl: 2,
		},
		lookup: {
			byMetaProductId: {
				"meta-prod-1001": "SKU-DEMO-1",
				"meta-prod-1002": "SKU-DEMO-2",
			},
			notes: [
				"Join insights breakdown product_id to products[].id (Meta catalog product id).",
				"retailer_id is the merchant / feed sku when present.",
			],
		},
	};
}

/**
 * Meta product catalog images for DPA (dynamic ads) — not Shopify packshots.
 * @param {string} customerId
 * @param {Record<string, string>} [params]
 */
export async function fetchMcpMetaCatalogProducts(customerId, params = {}) {
	const meta = await loadMetaAdAccountForMcp(customerId);
	const actId = normalizeActId(meta.adAccountId);
	const catalogIdParam = String(params.catalogId || "").trim();
	const maxProducts = clampInt(params.maxProducts, DEFAULT_MAX_PRODUCTS, DEFAULT_MAX_PRODUCTS);
	const filterProductIds = parseIdList(params.productIds);
	const filterRetailerIds = parseIdList(params.retailerIds);

	if (meta.isDemo || isDemoCustomerId(customerId)) {
		return {
			customerId,
			...demoCatalogPayload(),
			notes: metaCatalogNotes(),
		};
	}

	const cacheKey = `${actId}:catalog-products:${catalogIdParam || "all"}:max${maxProducts}`;

	const loaded = await withCatalogCache(cacheKey, async () => {
		const catalogs = await listProductCatalogs(actId, meta.accessToken);
		let targetCatalogs = catalogIdParam
			? catalogs.filter((c) => c.id === catalogIdParam)
			: catalogs;

		if (catalogIdParam && targetCatalogs.length === 0) {
			targetCatalogs = [
				{
					id: catalogIdParam,
					name: "",
					product_count: null,
					vertical: null,
				},
			];
		}
		if (targetCatalogs.length === 0) {
			throw new Error(
				"No Meta product catalogs accessible for this ad account. Assign catalog_management to the System User and grant Business Manager access to owned_product_catalogs (or pass catalogId if known)."
			);
		}

		/** @type {Array<{ id: string, retailer_id: string, name: string, image_url: string | null, catalog_id: string }>} */
		const products = [];
		for (const catalog of targetCatalogs) {
			const chunk = await fetchCatalogProducts(catalog.id, meta.accessToken, maxProducts);
			products.push(...chunk);
			if (products.length >= maxProducts) break;
		}

		let filtered = products.slice(0, maxProducts);
		if (filterProductIds.length > 0) {
			const wanted = new Set(filterProductIds);
			filtered = filtered.filter((p) => wanted.has(p.id));
		}
		if (filterRetailerIds.length > 0) {
			const wanted = new Set(filterRetailerIds);
			filtered = filtered.filter((p) => wanted.has(p.retailer_id));
		}

		/** @type {Record<string, string>} */
		const byMetaProductId = {};
		for (const product of filtered) {
			if (product.id) byMetaProductId[product.id] = product.retailer_id || product.id;
		}

		return {
			kind: "meta-catalog-products",
			adAccountId: actId.replace(/^act_/, ""),
			catalogs: targetCatalogs.length > 0 ? targetCatalogs : catalogs,
			products: filtered,
			summary: {
				catalogCount: (targetCatalogs.length > 0 ? targetCatalogs : catalogs).length,
				productCount: filtered.length,
				withImageUrl: filtered.filter((p) => p.image_url).length,
			},
			lookup: {
				byMetaProductId,
				notes: [
					"Use meta_ads_read insights with breakdowns=[\"product_id\"] for per-product spend/impressions.",
					"Join breakdown product_id to products[].id, then use image_url (Meta catalog render, incl. overlays).",
				],
			},
		};
	});

	return {
		customerId,
		...loaded,
		notes: metaCatalogNotes(),
	};
}

export function metaCatalogNotes() {
	return [
		"Meta Commerce catalog products — image_url is what Meta shows in DPA (not raw Shopify packshots).",
		"Response is cached server-side (~6h) per ad account / catalog.",
		"Dynamic catalog ads ({{product.name}} creatives) have no fixed full_image_url; join insights product_id to this list.",
		"Optional filters: catalogId, productIds, retailerIds (comma-separated or JSON array).",
	];
}
