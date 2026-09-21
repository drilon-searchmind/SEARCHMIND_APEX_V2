/**
 * Live test: Meta catalog products for DPA image join.
 *
 *   node scripts/test/test-meta-catalog-products.mjs
 *   node scripts/test/test-meta-catalog-products.mjs --name=Pompdelux
 */
import "dotenv/config";

import connectToDatabase from "../../lib/mongodb.js";
import Customer from "../../src/models/Customer.js";
import { metaGraphGet, metaGraphGetAll } from "../../lib/mcpMetaGraph.js";

function parseArgs() {
	const opts = { name: "Pompdelux", maxProducts: 200 };
	for (const arg of process.argv.slice(2)) {
		if (arg.startsWith("--name=")) opts.name = arg.slice("--name=".length);
		if (arg.startsWith("--max=")) opts.maxProducts = Number(arg.slice("--max=".length)) || 200;
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
if (!token || !actId) {
	console.error("Missing token or ad account");
	process.exit(1);
}

console.log(`Customer: ${customer.customerName} (${customer._id})`);
console.log(`Ad account: ${actId}`);

const catalogsJson = await metaGraphGet(`${actId}/product_catalogs`, token, {
	fields: "id,name,product_count",
	limit: "20",
});
const catalogs = catalogsJson.data || [];
console.log("catalogs:", catalogs.map((c) => ({ id: c.id, name: c.name, product_count: c.product_count })));

/** @type {unknown[]} */
const products = [];
for (const catalog of catalogs) {
	const rows = await metaGraphGetAll(
		`${catalog.id}/products`,
		token,
		{ fields: "id,retailer_id,image_url,name", limit: "500" },
		{ maxPages: Math.ceil(opts.maxProducts / 500) + 1 }
	);
	products.push(...rows);
	if (products.length >= opts.maxProducts) break;
}

const slice = products.slice(0, opts.maxProducts);
console.log(`products fetched: ${slice.length}, with image_url: ${slice.filter((p) => p.image_url).length}`);

for (const product of slice.slice(0, 5)) {
	console.log(
		JSON.stringify({
			id: product.id,
			retailer_id: product.retailer_id,
			name: String(product.name || "").slice(0, 48),
			has_image: Boolean(product.image_url),
		})
	);
}

const endDate = new Date().toISOString().slice(0, 10);
const startDate = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

console.log("\n=== insights product_id breakdown (sample) ===");
const insights = await metaGraphGet(`${actId}/insights`, token, {
	level: "ad",
	fields: "ad_id,spend,impressions,product_id,product_name",
	breakdowns: JSON.stringify(["product_id"]),
	time_range: JSON.stringify({ since: startDate, until: endDate }),
	limit: "5",
});

for (const row of insights.data || []) {
	const match = slice.find((p) => String(p.id) === String(row.product_id));
	console.log(
		JSON.stringify({
			product_id: row.product_id,
			product_name: row.product_name,
			spend: row.spend,
			catalog_image: match?.image_url ? "yes" : "no",
		})
	);
}

const ok = slice.length > 0 && slice.some((p) => p.image_url);
console.log(ok ? "\nPASS" : "\nFAIL");
process.exit(ok ? 0 : 1);
