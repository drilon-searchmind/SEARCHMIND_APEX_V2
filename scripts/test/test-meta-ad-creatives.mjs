/**
 * Live probe: Meta Graph API ad creatives / previews for a customer.
 *
 *   node scripts/test/test-meta-ad-creatives.mjs
 *   node scripts/test/test-meta-ad-creatives.mjs --name="Dimsstudio Markets"
 */
import "dotenv/config";

import connectToDatabase from "../../lib/mongodb.js";
import Customer from "../../src/models/Customer.js";

function parseArgs() {
	const opts = { name: "Dimsstudio Markets" };
	for (const arg of process.argv.slice(2)) {
		if (arg.startsWith("--name=")) opts.name = arg.slice("--name=".length);
	}
	return opts;
}

async function graphGet(path, token, params = {}) {
	const url = new URL(`https://graph.facebook.com/v21.0/${path}`);
	url.searchParams.set("access_token", token);
	for (const [key, value] of Object.entries(params)) {
		if (value != null && String(value).trim() !== "") {
			url.searchParams.set(key, String(value));
		}
	}
	const res = await fetch(url);
	const json = await res.json().catch(() => ({}));
	return { ok: res.ok, status: res.status, json };
}

function normalizeActId(raw) {
	const id = String(raw || "").trim();
	return id.startsWith("act_") ? id : `act_${id}`;
}

function truncate(value, max = 96) {
	const text = String(value ?? "");
	if (!text) return null;
	return text.length > max ? `${text.slice(0, max)}...` : text;
}

const opts = parseArgs();

await connectToDatabase();

const nameRegex = new RegExp(opts.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
const customer = await Customer.findOne({ customerName: nameRegex }).lean();

if (!customer) {
	console.error(`Customer not found: ${opts.name}`);
	process.exit(1);
}

const adAccountRaw = customer?.CustomerSettings?.facebookAdAccountId;
const token = process.env.FACEBOOK_APP_TOKEN;

console.log(`Customer: ${customer.customerName} (${customer._id})`);
console.log(`Ad account: ${adAccountRaw || "(missing)"}`);
console.log(`FACEBOOK_APP_TOKEN configured: ${Boolean(token)}`);

if (!adAccountRaw || !token) {
	console.error("Missing facebookAdAccountId or FACEBOOK_APP_TOKEN");
	process.exit(1);
}

const account = normalizeActId(adAccountRaw);

console.log("\n=== Test 1: current MCP ads fields ===");
const current = await graphGet(`${account}/ads`, token, {
	fields: "id,name,status,adset_id,campaign_id",
	limit: "5",
});
console.log(`HTTP ${current.status}`, current.json?.error?.message || "ok");
console.log(
	"sample:",
	(current.json?.data || []).map((ad) => ({ id: ad.id, name: ad.name, status: ad.status }))
);

console.log("\n=== Test 2: ACTIVE ads + creative thumbnail/image ===");
const creativeFields = [
	"id",
	"name",
	"status",
	"effective_status",
	"adset_id",
	"campaign_id",
	"creative{id,name,thumbnail_url,image_url,object_type,effective_object_story_id}",
].join(",");
const activeFiltering = JSON.stringify([
	{ field: "effective_status", operator: "IN", value: ["ACTIVE"] },
]);
const withCreative = await graphGet(`${account}/ads`, token, {
	fields: creativeFields,
	filtering: activeFiltering,
	limit: "10",
});
console.log(`HTTP ${withCreative.status}`, withCreative.json?.error?.message || "ok");
const activeAds = withCreative.json?.data || [];
console.log(`active ads returned: ${activeAds.length}`);

for (const ad of activeAds.slice(0, 6)) {
	const creative = ad.creative || {};
	console.log(
		JSON.stringify({
			id: ad.id,
			name: ad.name,
			effective_status: ad.effective_status,
			creative_id: creative.id,
			object_type: creative.object_type,
			thumbnail_url: truncate(creative.thumbnail_url),
			image_url: truncate(creative.image_url),
		})
	);
}

const firstCreativeId = activeAds.find((ad) => ad?.creative?.id)?.creative?.id;
if (firstCreativeId) {
	console.log("\n=== Test 3: direct creative fetch ===");
	const creativeDetail = await graphGet(firstCreativeId, token, {
		fields:
			"id,name,thumbnail_url,image_url,object_type,asset_feed_spec,object_story_spec",
	});
	console.log(`HTTP ${creativeDetail.status}`, creativeDetail.json?.error?.message || "ok");
	const creative = creativeDetail.json || {};
	console.log(
		JSON.stringify(
			{
				id: creative.id,
				name: creative.name,
				object_type: creative.object_type,
				has_thumbnail: Boolean(creative.thumbnail_url),
				has_image_url: Boolean(creative.image_url),
				has_object_story_spec: Boolean(creative.object_story_spec),
				has_asset_feed_spec: Boolean(creative.asset_feed_spec),
				thumbnail_url: truncate(creative.thumbnail_url),
				image_url: truncate(creative.image_url),
			},
			null,
			2
		)
	);
}

const firstActiveAdId = activeAds[0]?.id;
if (firstActiveAdId) {
	console.log("\n=== Test 4: ad preview iframe/html ===");
	const preview = await graphGet(`${firstActiveAdId}/previews`, token, {
		ad_format: "DESKTOP_FEED_STANDARD",
	});
	console.log(`HTTP ${preview.status}`, preview.json?.error?.message || "ok");
	const body = preview.json?.data?.[0]?.body || "";
	console.log(`preview body length: ${body.length}`);
	console.log(`preview sample: ${truncate(body.replace(/\s+/g, " "), 140)}`);
}

const withImages = activeAds.filter(
	(ad) => ad?.creative?.thumbnail_url || ad?.creative?.image_url
).length;
console.log(
	`\nRESULT: ${withImages}/${activeAds.length} active ads returned thumbnail_url or image_url`
);
console.log(withImages > 0 ? "PASS — Meta creative images look reachable." : "WARN — no image URLs on active ads.");

process.exit(0);
