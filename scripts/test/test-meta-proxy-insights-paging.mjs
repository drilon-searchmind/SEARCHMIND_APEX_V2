/**
 * Verify Meta MCP proxy fixes: insights level/fields + paging token sanitization.
 *
 *   node scripts/test/test-meta-proxy-insights-paging.mjs
 *   node scripts/test/test-meta-proxy-insights-paging.mjs --name="Dimsstudio Markets"
 */
import "dotenv/config";

import connectToDatabase from "../../lib/mongodb.js";
import Customer from "../../src/models/Customer.js";
import { sanitizeForMcp } from "../../lib/mcpSanitize.js";
import {
	redactAccessTokenFromString,
	sanitizeMetaPaging,
} from "../../lib/mcpMetaGraph.js";

function parseArgs() {
	const opts = { name: "Dimsstudio Markets" };
	for (const arg of process.argv.slice(2)) {
		if (arg.startsWith("--name=")) opts.name = arg.slice("--name=".length);
	}
	return opts;
}

function assertNoAccessToken(value, label) {
	const json = JSON.stringify(value);
	if (/access_token/i.test(json)) {
		throw new Error(`${label}: response still contains access_token`);
	}
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

function testSanitizers() {
	const fakeToken = "EAABsbCS1iHgBO7ZCTestToken123";
	const paging = sanitizeMetaPaging({
		cursors: { after: "abc123", before: "xyz" },
		next: `https://graph.facebook.com/v21.0/act_123/ads?access_token=${fakeToken}&limit=100`,
		previous: `https://graph.facebook.com/v21.0/act_123/ads?access_token=${fakeToken}&limit=100`,
	});
	assertNoAccessToken(paging, "sanitizeMetaPaging");
	if (!paging?.hasNext) throw new Error("sanitizeMetaPaging: expected hasNext");
	if (paging.next) throw new Error("sanitizeMetaPaging: next URL must be omitted");

	const redacted = redactAccessTokenFromString(
		`https://graph.facebook.com/v21.0/act_1/ads?access_token=${fakeToken}`
	);
	if (redacted.includes(fakeToken)) {
		throw new Error("redactAccessTokenFromString: token not removed");
	}

	const wrapped = sanitizeForMcp({
		paging: {
			next: `https://graph.facebook.com/v21.0/act_1/ads?access_token=${fakeToken}`,
		},
	});
	assertNoAccessToken(wrapped, "sanitizeForMcp string redaction");
	console.log("PASS unit sanitizers");
}

const opts = parseArgs();
testSanitizers();

await connectToDatabase();

const nameRegex = new RegExp(opts.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
const customer = await Customer.findOne({ customerName: nameRegex }).lean();
if (!customer) {
	console.error(`Customer not found: ${opts.name}`);
	process.exit(1);
}

const token = process.env.FACEBOOK_APP_TOKEN;
const account = normalizeActId(customer?.CustomerSettings?.facebookAdAccountId);
const endDate = new Date().toISOString().slice(0, 10);
const startDate = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

if (!account || !token) {
	console.error("Missing facebookAdAccountId or FACEBOOK_APP_TOKEN");
	process.exit(1);
}

console.log(`\nCustomer: ${customer.customerName} (${customer._id})`);
console.log(`Ad account: ${account}`);
console.log(`Date range: ${startDate} → ${endDate}`);

console.log("\n=== Test: raw Meta ads paging contains token (expected) ===");
const rawAds = await graphGet(`${account}/ads`, token, {
	fields: "id,name,status",
	limit: "5",
});
if (!rawAds.ok) {
	console.error("Meta ads error:", rawAds.json?.error?.message || rawAds.status);
	process.exit(1);
}
const rawNext = rawAds.json?.paging?.next || "";
if (rawNext && !/access_token=/i.test(rawNext)) {
	console.warn("WARN: Meta did not embed access_token in paging.next (unusual)");
} else if (rawNext) {
	console.log("confirmed: raw paging.next includes access_token (this is what we sanitize)");
}

const safePaging = sanitizeMetaPaging(rawAds.json?.paging);
assertNoAccessToken(safePaging, "sanitized ads paging");
console.log("sanitized paging:", safePaging);
console.log("PASS ads paging sanitization");

console.log("\n=== Test: campaign insights with reach/frequency/revenue fields ===");
const fields =
	"campaign_id,campaign_name,spend,reach,frequency,action_values,purchase_roas,date_start,date_stop";
const rawInsights = await graphGet(`${account}/insights`, token, {
	level: "campaign",
	fields,
	time_range: JSON.stringify({ since: startDate, until: endDate }),
	limit: "10",
});
if (!rawInsights.ok) {
	console.error("Meta insights error:", rawInsights.json?.error?.message || rawInsights.status);
	process.exit(1);
}

const rows = rawInsights.json?.data || [];
console.log(`rows: ${rows.length}`);
if (rows.length > 0) {
	const sample = rows[0];
	console.log("sample keys:", Object.keys(sample).sort().join(", "));
	const expected = ["campaign_id", "spend", "reach", "frequency", "action_values"];
	const missing = expected.filter((key) => !(key in sample));
	if (missing.length > 0) {
		throw new Error(`insights row missing expected fields: ${missing.join(", ")}`);
	}
}

const safeInsights = sanitizeForMcp({
	level: "campaign",
	fields: fields.split(","),
	insights: {
		data: rows,
		paging: sanitizeMetaPaging(rawInsights.json?.paging),
	},
});
assertNoAccessToken(safeInsights, "sanitized insights response");
console.log("PASS insights level/fields");

console.log("\nAll Meta proxy checks passed.");
