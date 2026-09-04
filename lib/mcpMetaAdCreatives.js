import { isDemoCustomerId } from "@/lib/demoCustomer";
import { loadMetaAdAccountForMcp } from "@root/lib/mcpMetaAccount";
import { metaGraphGet } from "@root/lib/mcpMetaGraph";

export { metaGraphGet } from "@root/lib/mcpMetaGraph";
const DEFAULT_AD_CREATIVE_FIELDS = [
	"id",
	"name",
	"status",
	"effective_status",
	"adset_id",
	"campaign_id",
	"creative{id,name,thumbnail_url,image_url,object_type,effective_object_story_id}",
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
		},
		has_visual:
			Boolean(creative.thumbnail_url) ||
			Boolean(creative.image_url),
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
				},
				has_visual: true,
			},
		],
		paging: null,
		summary: {
			total: 2,
			withThumbnailOrImage: 2,
			byObjectType: { SHARE: 1, VIDEO: 1 },
		},
	};
}

/**
 * @param {Array<ReturnType<typeof serializeAdCreativeRow>>} ads
 */
function summarizeAdCreatives(ads) {
	/** @type {Record<string, number>} */
	const byObjectType = {};
	let withThumbnailOrImage = 0;
	for (const ad of ads) {
		if (ad.has_visual) withThumbnailOrImage += 1;
		const type = ad.creative.object_type || "UNKNOWN";
		byObjectType[type] = (byObjectType[type] || 0) + 1;
	}
	return {
		total: ads.length,
		withThumbnailOrImage,
		byObjectType,
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
	const ads = (json.data || []).map(serializeAdCreativeRow);

	return {
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
		"ads[].creative.thumbnail_url — use for quick image/video thumbnail grid of live ads.",
		"Video ads often have thumbnail_url but image_url=null (expected).",
		"Set activeOnly=false to include paused/archived ads.",
		"For full feed preview HTML use meta_ads_read endpoint ad-preview with adId.",
	];
}
