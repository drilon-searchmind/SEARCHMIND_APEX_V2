import { isDemoCustomerId } from "@/lib/demoCustomer";
import { loadMetaAdAccountForMcp } from "@root/lib/mcpMetaAccount";
import { metaGraphGet } from "@root/lib/mcpMetaGraph";

export { metaGraphGet } from "@root/lib/mcpMetaGraph";
import { enrichAdsWithFullCreativeImages } from "@root/lib/mcpMetaCreativeImageResolve";
import {
	fetchMcpMetaCatalogProducts,
	isDynamicCatalogCreative,
} from "@root/lib/mcpMetaCatalog";

const CREATIVE_SUBFIELDS = [
	"id",
	"name",
	"thumbnail_url",
	"image_url",
	"object_type",
	"product_set_id",
	"effective_object_story_id",
	"video_id",
	"object_story_spec{link_data{image_hash},video_data{image_hash,video_id}}",
	"asset_feed_spec{images{hash},videos{video_id,thumbnail_hash,thumbnail_url}}",
].join(",");

const DEFAULT_AD_CREATIVE_FIELDS = [
	"id",
	"name",
	"status",
	"effective_status",
	"adset_id",
	"campaign_id",
	`creative{${CREATIVE_SUBFIELDS}}`,
].join(",");

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
function clampLimit(value, fallback = 100, max = 250) {
	const n = Number.parseInt(String(value ?? ""), 10);
	if (!Number.isFinite(n) || n <= 0) return fallback;
	return Math.min(n, max);
}

/**
 * @param {Record<string, unknown>} ad
 */
function serializeAdCreativeRow(ad) {
	const creative = ad?.creative && typeof ad.creative === "object" ? ad.creative : {};
	const fullImageUrl = creative.full_image_url ? String(creative.full_image_url) : null;
	const isDynamicCatalog = isDynamicCatalogCreative(creative);
	return {
		id: String(ad?.id ?? ""),
		name: String(ad?.name ?? ""),
		status: String(ad?.status ?? ""),
		effective_status: String(ad?.effective_status ?? ""),
		adset_id: String(ad?.adset_id ?? ""),
		campaign_id: String(ad?.campaign_id ?? ""),
		creative: {
			id: String(creative.id ?? ""),
			name: String(creative.name ?? ""),
			object_type: String(creative.object_type ?? ""),
			thumbnail_url: creative.thumbnail_url ? String(creative.thumbnail_url) : null,
			image_url: creative.image_url ? String(creative.image_url) : null,
			effective_object_story_id: creative.effective_object_story_id
				? String(creative.effective_object_story_id)
				: null,
			full_image_url: fullImageUrl,
			full_image_permalink_url: creative.full_image_permalink_url
				? String(creative.full_image_permalink_url)
				: null,
			full_image_width:
				creative.full_image_width != null ? Number(creative.full_image_width) : null,
			full_image_height:
				creative.full_image_height != null ? Number(creative.full_image_height) : null,
			full_image_source: creative.full_image_source
				? String(creative.full_image_source)
				: null,
			product_set_id: creative.product_set_id ? String(creative.product_set_id) : null,
			is_dynamic_catalog_ad: isDynamicCatalog,
		},
		has_visual:
			Boolean(creative.thumbnail_url) ||
			Boolean(creative.image_url) ||
			Boolean(fullImageUrl),
	};
}

function demoMetaAdCreatives() {
	return {
		activeOnly: true,
		ads: [
			{
				id: "120244576686490024",
				name: "Citron og appelsintallerkener",
				status: "ACTIVE",
				effective_status: "ACTIVE",
				adset_id: "120244576686480024",
				campaign_id: "120244576686470024",
				creative: {
					id: "2255082805260036",
					name: "Demo creative",
					object_type: "SHARE",
					thumbnail_url: "https://scontent.example/fbcdn.net/demo-thumbnail.jpg",
					image_url: null,
					effective_object_story_id: null,
					full_image_url: "https://scontent.example/fbcdn.net/demo-full-share.jpg",
					full_image_permalink_url: "https://www.facebook.com/ads/image/demo-permalink",
					full_image_width: 1080,
					full_image_height: 1080,
					full_image_source: "asset_feed_spec",
				},
				has_visual: true,
			},
			{
				id: "120250428072930024",
				name: "Vægophæng",
				status: "ACTIVE",
				effective_status: "ACTIVE",
				adset_id: "120250428072920024",
				campaign_id: "120250428072910024",
				creative: {
					id: "1039277538706624",
					name: "Demo video creative",
					object_type: "VIDEO",
					thumbnail_url: "https://scontent.example/fbcdn.net/demo-video-thumb.jpg",
					image_url: null,
					effective_object_story_id: null,
					full_image_url: "https://scontent.example/fbcdn.net/demo-video-frame.jpg",
					full_image_permalink_url: null,
					full_image_width: 1280,
					full_image_height: 720,
					full_image_source: "video_thumbnail",
				},
				has_visual: true,
			},
		],
		paging: null,
		summary: {
			total: 2,
			withThumbnailOrImage: 2,
			withFullImage: 2,
			byObjectType: { SHARE: 1, VIDEO: 1 },
			byFullImageSource: { asset_feed_spec: 1, video_thumbnail: 1 },
		},
	};
}

/**
 * @param {Array<ReturnType<typeof serializeAdCreativeRow>>} ads
 */
function summarizeAdCreatives(ads) {
	/** @type {Record<string, number>} */
	const byObjectType = {};
	/** @type {Record<string, number>} */
	const byFullImageSource = {};
	let withThumbnailOrImage = 0;
	let withFullImage = 0;
	let dynamicCatalogAds = 0;
	for (const ad of ads) {
		if (ad.has_visual) withThumbnailOrImage += 1;
		if (ad.creative?.is_dynamic_catalog_ad) dynamicCatalogAds += 1;
		if (ad.creative?.full_image_url) {
			withFullImage += 1;
			const src = ad.creative.full_image_source || "unknown";
			byFullImageSource[src] = (byFullImageSource[src] || 0) + 1;
		}
		const type = ad.creative.object_type || "UNKNOWN";
		byObjectType[type] = (byObjectType[type] || 0) + 1;
	}
	return {
		total: ads.length,
		withThumbnailOrImage,
		withFullImage,
		dynamicCatalogAds,
		byObjectType,
		byFullImageSource,
	};
}

/**
 * Live Meta ads with creative thumbnails for quick visual review in MCP.
 * @param {string} customerId
 * @param {Record<string, string>} [params]
 */
export async function fetchMcpMetaAdCreatives(customerId, params = {}) {
	const meta = await loadMetaAdAccountForMcp(customerId);
	const actId = normalizeActId(meta.adAccountId);
	const activeOnly = String(params.activeOnly ?? "true").trim().toLowerCase() !== "false";
	const limit = clampLimit(params.limit, 100, 250);
	const includeCatalogProducts =
		String(params.includeCatalogProducts ?? "false").trim().toLowerCase() === "true";

	if (meta.isDemo || isDemoCustomerId(customerId)) {
		const demo = demoMetaAdCreatives();
		return {
			customerId,
			kind: "meta-ad-creatives",
			adAccountId: "demo",
			demo: true,
			activeOnly,
			limit,
			...demo,
			notes: metaAdCreativesNotes(),
		};
	}

	/** @type {Record<string, string>} */
	const query = {
		fields: DEFAULT_AD_CREATIVE_FIELDS,
		limit: String(limit),
	};
	if (activeOnly) {
		query.filtering = JSON.stringify([
			{ field: "effective_status", operator: "IN", value: ["ACTIVE"] },
		]);
	}

	const json = await metaGraphGet(`${actId}/ads`, meta.accessToken, query);
	/** @type {Array<{ creative: Record<string, unknown> }>} */
	const rawRows = (json.data || []).map((ad) => ({
		creative:
			ad?.creative && typeof ad.creative === "object"
				? { ...ad.creative }
				: {},
	}));
	await enrichAdsWithFullCreativeImages(rawRows, actId, meta.accessToken);
	const ads = (json.data || []).map((ad, index) => {
		const merged = {
			...ad,
			creative: rawRows[index]?.creative || ad.creative,
		};
		return serializeAdCreativeRow(merged);
	});

	/** @type {Record<string, unknown>} */
	const payload = {
		customerId,
		kind: "meta-ad-creatives",
		adAccountId: actId.replace(/^act_/, ""),
		activeOnly,
		limit,
		ads,
		paging: json.paging || null,
		summary: summarizeAdCreatives(ads),
		notes: metaAdCreativesNotes(),
	};

	if (includeCatalogProducts || (payload.summary?.dynamicCatalogAds ?? 0) > 0) {
		const catalog = await fetchMcpMetaCatalogProducts(customerId, {
			maxProducts: params.catalogMaxProducts,
		});
		if (includeCatalogProducts) {
			payload.catalogProducts = catalog;
		} else {
			payload.catalogProductsSummary = catalog.summary;
			payload.catalogIds = (catalog.catalogs || []).map((c) => c.id);
		}
	}

	return payload;
}

/**
 * Meta ad preview iframe/html for one ad id.
 * @param {string} customerId
 * @param {Record<string, string>} params
 */
export async function fetchMcpMetaAdPreview(customerId, params = {}) {
	const adId = String(params.adId || "").trim();
	if (!adId) throw new Error("adId is required");

	const adFormat = String(params.adFormat || "DESKTOP_FEED_STANDARD").trim();
	const meta = await loadMetaAdAccountForMcp(customerId);

	if (meta.isDemo || isDemoCustomerId(customerId)) {
		return {
			customerId,
			kind: "meta-ad-preview",
			adId,
			adFormat,
			demo: true,
			previewHtml:
				'<iframe src="https://business.facebook.com/ads/api/preview_iframe.php?d=demo"></iframe>',
		};
	}

	const json = await metaGraphGet(`${adId}/previews`, meta.accessToken, {
		ad_format: adFormat,
	});
	const previewHtml = json?.data?.[0]?.body ? String(json.data[0].body) : "";

	return {
		customerId,
		kind: "meta-ad-preview",
		adId,
		adFormat,
		previewHtml,
		previewHtmlLength: previewHtml.length,
	};
}

function metaAdCreativesNotes() {
	return [
		"ads[].creative.thumbnail_url — 64×64 preview; use creative.full_image_url for report-quality images.",
		"full_image_url resolution order: image_url → object_story_spec hashes → asset_feed_spec image/video hashes → page post full_picture → video thumbnail.",
		"full_image_permalink_url (when from adimages) is more stable than full_image_url; CDN urls expire.",
		"full_image_width / full_image_height — filter e.g. min 200px without downloading the file.",
		"Page-post creatives need pages_read_engagement (or page access on the System User); may stay null otherwise.",
		"Set activeOnly=false to include paused/archived ads.",
		"For feed preview HTML use meta_ads_read endpoint ad-preview with adId.",
		"DPA / catalog ads (is_dynamic_catalog_ad): use /api/meta-catalog-products + insights breakdown product_id for images.",
	];
}
