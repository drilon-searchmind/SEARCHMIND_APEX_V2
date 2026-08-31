/**
 * Live smoke test: Shopify agentic attribution for a customer (default Rains US).
 *
 *   node scripts/test/test-agentic-rains-us.mjs
 *   node scripts/test/test-agentic-rains-us.mjs --name="Rains INT"
 *   node scripts/test/test-agentic-rains-us.mjs --start=2026-06-03 --end=2026-08-31
 */
import "dotenv/config";

import connectToDatabase from "../../lib/mongodb.js";
import Customer from "../../src/models/Customer.js";
import { fetchAllAgenticShopifyqlReports } from "../../src/lib/shopifyAgenticShopifyql.js";

function parseArgs() {
	const opts = {
		name: "Rains US",
		start: "2026-06-03",
		end: "2026-08-31",
	};
	for (const arg of process.argv.slice(2)) {
		if (arg.startsWith("--name=")) opts.name = arg.slice("--name=".length);
		if (arg.startsWith("--start=")) opts.start = arg.slice("--start=".length);
		if (arg.startsWith("--end=")) opts.end = arg.slice("--end=".length);
	}
	return opts;
}

function summarizeTable(label, block) {
	const rows = block?.tableData?.rows || [];
	console.log(`\n=== ${label} ===`);
	console.log(`  apiVersion: ${block?.apiVersion ?? "n/a"}`);
	console.log(`  fallback:   ${block?.fallback ?? "null"}`);
	if (block?.note) console.log(`  note:       ${block.note}`);
	if (block?.parseErrors?.length) console.log(`  parseErrors:`, block.parseErrors);
	console.log(`  rows (${rows.length}):`);
	for (const row of rows.slice(0, 12)) {
		console.log(`    ${JSON.stringify(row)}`);
	}
	if (rows.length > 12) console.log(`    … +${rows.length - 12} more`);
}

const opts = parseArgs();

await connectToDatabase();

const nameRegex = new RegExp(opts.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
const customer = await Customer.findOne({ customerName: nameRegex }).lean();

if (!customer) {
	console.error(`No customer matched name: ${opts.name}`);
	process.exit(1);
}

const shopUrl = customer?.CustomerSettings?.shopifyUrl;
const accessToken = customer?.CustomerSettings?.shopifyApiPassword;

if (!shopUrl || !accessToken) {
	console.error(`Shopify not configured for ${customer.customerName}`);
	process.exit(1);
}

console.log(`Customer: ${customer.customerName} (${customer._id})`);
console.log(`Shop:     ${shopUrl}`);
console.log(`Period:   ${opts.start} → ${opts.end}`);

const reports = await fetchAllAgenticShopifyqlReports(
	shopUrl,
	accessToken,
	opts.start,
	opts.end
);

console.log(`\nshopifyqlApiVersion: ${reports.shopifyqlApiVersion}`);

summarizeTable("shopChannelSales (Shop channel proxy)", reports.shopChannelSales);
summarizeTable("trafficByAgenticUtmSource", reports.trafficByAgenticUtmSource);
summarizeTable("salesByAgenticSalesChannel", reports.salesByAgenticSalesChannel);
summarizeTable("salesByAgenticReferringChannel", reports.salesByAgenticReferringChannel);

const utmRows = reports.trafficByAgenticUtmSource?.tableData?.rows || [];
const shopRows = reports.shopChannelSales?.tableData?.rows || [];
const ok =
	shopRows.length > 0 ||
	utmRows.length > 0 ||
	(reports.salesByAgenticSalesChannel?.tableData?.rows || []).length > 0;

console.log(
	ok
		? "\nPASS — agentic/Shop data present for this customer/period."
		: "\nWARN — no Shop sales or agentic UTM rows (may be period/adoption, or deploy not live)."
);

process.exit(0);
