/**
 * Live test: high-limit meta-ad-creatives must not 500 when DPA ads + no catalog access.
 *
 *   node scripts/test/test-meta-ad-creatives-pomp-limit.mjs
 */
import "dotenv/config";

import connectToDatabase from "../../lib/mongodb.js";
import Customer from "../../src/models/Customer.js";
import { enrichAdsWithFullCreativeImages } from "../../lib/mcpMetaCreativeImageResolve.js";
import { metaGraphGet } from "../../lib/mcpMetaGraph.js";

function isDynamicCatalogCreative(creative) {
	if (!creative || typeof creative !== "object") return false;
	if (creative.product_set_id) return true;
	const name = String(creative.name || "");
	return /\{\{\s*product\./i.test(name) || /\{\{[^}]+\}\}/.test(name);
}

const CUSTOMER_IDS = [
	"694a93d4daaf0d971e9001d4",
	"6aa1599dc72fb354d97e4267",
];
const LIMITS = [3, 50, 200];
const EXPECTED_ACT = "192117647848133";

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

const AD_FIELDS = [
	"id",
	"name",
	"status",
	"effective_status",
	"adset_id",
	"campaign_id",
	`creative{${CREATIVE_SUBFIELDS}}`,
].join(",");

function normalizeActId(adAccountId) {
	const raw = String(adAccountId || "").trim();
	if (!raw) return "";
	return raw.startsWith("act_") ? raw : `act_${raw}`;
}

function clampLimit(value, fallback = 100, max = 250) {
	const n = Number.parseInt(String(value ?? ""), 10);
	if (!Number.isFinite(n) || n <= 0) return fallback;
	return Math.min(n, max);
}

/** Mirrors fetchMcpMetaAdCreatives post-fix (no auto catalog fetch). */
async function fetchMetaAdCreativesLikeMcp(customerId, actId, accessToken, params) {
	const activeOnly = String(params.activeOnly ?? "true").trim().toLowerCase() !== "false";
	const limit = clampLimit(params.limit, 100, 250);
	const includeCatalogProducts =
		String(params.includeCatalogProducts ?? "false").trim().toLowerCase() === "true";

	const query = {
		fields: AD_FIELDS,
		limit: String(limit),
	};
	if (activeOnly) {
		query.filtering = JSON.stringify([
			{ field: "effective_status", operator: "IN", value: ["ACTIVE"] },
		]);
	}

	const json = await metaGraphGet(`${actId}/ads`, accessToken, query);
	const rawRows = (json.data || []).map((ad) => ({
		creative: ad?.creative && typeof ad.creative === "object" ? { ...ad.creative } : {},
	}));

	try {
		await enrichAdsWithFullCreativeImages(rawRows, actId, accessToken);
	} catch (err) {
		console.warn("    [warn] image enrichment partial failure:", err?.message || err);
	}

	const ads = (json.data || []).map((ad, index) => {
		const creative = rawRows[index]?.creative || ad.creative || {};
		const fullImageUrl = creative.full_image_url ? String(creative.full_image_url) : null;
		const isDynamic = isDynamicCatalogCreative(creative);
		const hasVisual =
			Boolean(creative.thumbnail_url) || Boolean(creative.image_url) || Boolean(fullImageUrl);
		return {
			id: String(ad?.id ?? ""),
			name: String(ad?.name ?? ""),
			creative: {
				is_dynamic_catalog_ad: isDynamic,
				full_image_url: fullImageUrl,
				product_set_id: creative.product_set_id ? String(creative.product_set_id) : null,
			},
			has_visual: hasVisual,
		};
	});

	let dynamicCatalogAds = 0;
	for (const ad of ads) {
		if (ad.creative.is_dynamic_catalog_ad) dynamicCatalogAds += 1;
	}

	const payload = {
		ads,
		summary: { total: ads.length, dynamicCatalogAds },
	};

	if (dynamicCatalogAds > 0) {
		payload.dynamicCatalogHint = `${dynamicCatalogAds} DPA ad(s) — catalog embed is opt-in only.`;
	}

	if (includeCatalogProducts) {
		try {
			await metaGraphGet(`${actId}/product_catalogs`, accessToken, {
				fields: "id,name",
				limit: "5",
			});
			payload.catalogProducts = true;
		} catch (err) {
			payload.catalogProductsUnavailable = err?.message || String(err);
		}
	}

	return payload;
}

await connectToDatabase();

const token = process.env.FACEBOOK_APP_TOKEN;
if (!token) {
	console.error("FACEBOOK_APP_TOKEN missing");
	process.exit(1);
}

let failed = 0;

for (const customerId of CUSTOMER_IDS) {
	const customer = await Customer.findById(customerId).lean();
	if (!customer) {
		console.error(`Customer not found: ${customerId}`);
		failed += 1;
		continue;
	}

	const actRaw = customer?.CustomerSettings?.facebookAdAccountId || "";
	const actId = normalizeActId(actRaw);
	const actDigits = actId.replace(/^act_/, "");

	console.log(`\n=== ${customer.customerName} (${customerId}) act=${actDigits} ===`);

	if (actDigits !== EXPECTED_ACT) {
		console.warn(`  WARN: expected ad account ${EXPECTED_ACT}, got ${actDigits}`);
	}

	for (const limit of LIMITS) {
		try {
			const t0 = Date.now();
			const result = await fetchMetaAdCreativesLikeMcp(customerId, actId, token, {
				limit: String(limit),
				activeOnly: "true",
			});
			const ms = Date.now() - t0;
			const dynamic = result.summary.dynamicCatalogAds;
			console.log(
				`  limit=${limit} OK ${ms}ms ads=${result.summary.total} dynamicCatalog=${dynamic} hint=${Boolean(result.dynamicCatalogHint)}`
			);
			if (limit >= 50 && dynamic === 0) {
				console.warn("  WARN: expected at least one DPA ad at high limit (regression signal weak)");
			}
		} catch (err) {
			console.error(`  limit=${limit} FAIL:`, err.message || err);
			failed += 1;
		}
	}

	try {
		const withCatalog = await fetchMetaAdCreativesLikeMcp(customerId, actId, token, {
			limit: "10",
			includeCatalogProducts: "true",
		});
		if (withCatalog.catalogProducts) {
			console.log("  includeCatalogProducts=true → catalog embedded");
		} else if (withCatalog.catalogProductsUnavailable) {
			console.log(
				"  includeCatalogProducts=true → graceful (no 500):",
				String(withCatalog.catalogProductsUnavailable).slice(0, 120)
			);
		} else {
			console.log("  includeCatalogProducts=true → no catalog block");
		}
	} catch (err) {
		console.error("  includeCatalogProducts FAIL (should not throw):", err.message);
		failed += 1;
	}
}

console.log(failed === 0 ? "\nPASS — all limits returned ads without catalog 500." : `\nFAIL (${failed})`);
process.exit(failed === 0 ? 0 : 1);
