/**
 * Live test: Meta ad creative full_image_url resolution (SHARE / asset feed / etc.)
 *
 *   node scripts/test/test-meta-creative-full-image.mjs
 *   node scripts/test/test-meta-creative-full-image.mjs --name="Pompdelux"
 *   node scripts/test/test-meta-creative-full-image.mjs --limit=50
 */
import "dotenv/config";

import connectToDatabase from "../../lib/mongodb.js";
import Customer from "../../src/models/Customer.js";
import { metaGraphGet } from "../../lib/mcpMetaGraph.js";
import {
	collectCreativeImageHashes,
	enrichAdsWithFullCreativeImages,
} from "../../lib/mcpMetaCreativeImageResolve.js";

function parseArgs() {
	const opts = { name: "Pompdelux", limit: 30 };
	for (const arg of process.argv.slice(2)) {
		if (arg.startsWith("--name=")) opts.name = arg.slice("--name=".length);
		if (arg.startsWith("--limit=")) opts.limit = Number(arg.slice("--limit=".length)) || 30;
	}
	return opts;
}

function normalizeActId(raw) {
	const id = String(raw || "").trim();
	return id.startsWith("act_") ? id : `act_${id}`;
}

const opts = parseArgs();
await connectToDatabase();

const nameRegex = new RegExp(opts.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
const customer = await Customer.findOne({ customerName: nameRegex }).lean();
if (!customer) {
	console.error(`Customer not found: ${opts.name}`);
	process.exit(1);
}

const token = process.env.FACEBOOK_APP_TOKEN;
const actId = normalizeActId(customer?.CustomerSettings?.facebookAdAccountId);
if (!actId || !token) {
	console.error("Missing facebookAdAccountId or FACEBOOK_APP_TOKEN");
	process.exit(1);
}

const creativeFields = [
	"id",
	"name",
	"status",
	"effective_status",
	"creative{id,name,thumbnail_url,image_url,object_type,effective_object_story_id,video_id,object_story_spec{link_data{image_hash},video_data{image_hash,video_id}},asset_feed_spec{images{hash},videos{video_id,thumbnail_hash,thumbnail_url}}}",
].join(",");

console.log(`Customer: ${customer.customerName} (${customer._id})`);
console.log(`Ad account: ${actId}, limit: ${opts.limit}`);

const json = await metaGraphGet(`${actId}/ads`, token, {
	fields: creativeFields,
	filtering: JSON.stringify([
		{ field: "effective_status", operator: "IN", value: ["ACTIVE"] },
	]),
	limit: String(opts.limit),
});

const rawRows = (json.data || []).map((ad) => ({
	creative: ad?.creative && typeof ad.creative === "object" ? { ...ad.creative } : {},
}));

const hashSet = new Set();
for (const row of rawRows) collectCreativeImageHashes(row.creative, hashSet);
console.log(`Unique image hashes collected: ${hashSet.size}`);

await enrichAdsWithFullCreativeImages(rawRows, actId, token);

let withFull = 0;
let shareWithoutImageUrl = 0;
let shareWithFull = 0;

for (const [index, ad] of (json.data || []).entries()) {
	const creative = rawRows[index]?.creative || {};
	const merged = { ...ad, creative };
	const row = {
		id: merged.id,
		name: merged.name,
		object_type: creative.object_type,
		image_url: Boolean(creative.image_url),
		full_image_url: creative.full_image_url ? "yes" : "no",
		source: creative.full_image_source || null,
		width: creative.full_image_width,
		height: creative.full_image_height,
	};
	if (creative.full_image_url) withFull += 1;
	if (creative.object_type === "SHARE" && !creative.image_url) {
		shareWithoutImageUrl += 1;
		if (creative.full_image_url) shareWithFull += 1;
	}
	console.log(JSON.stringify(row));
}

console.log(
	`\nSUMMARY: ${withFull}/${rawRows.length} ads with full_image_url; SHARE without image_url: ${shareWithFull}/${shareWithoutImageUrl} resolved`
);

const ok = withFull > 0;
process.exit(ok ? 0 : 1);
