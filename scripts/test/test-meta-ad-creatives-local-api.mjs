/**
 * End-to-end local test: temp MCP key → GET /api/mcp/data/meta-ad-creatives
 *
 *   node scripts/test/test-meta-ad-creatives-local-api.mjs
 */
import "dotenv/config";

import connectToDatabase from "../../lib/mongodb.js";
import User from "../../models/User.js";
import { createMcpApiKey } from "../../lib/mcpApiKeyService.js";

const customerId = "6967915ca72471ae8549eb34";
const baseUrl = process.env.APEX_LOCAL_URL || "http://localhost:3001";

await connectToDatabase();

const user = await User.findOne({}).lean();
if (!user?._id) {
	console.error("No user in DB to create temp MCP key");
	process.exit(1);
}

const { plaintext, key } = await createMcpApiKey({
	name: "temp meta-ad-creatives test",
	createdByUserId: String(user._id),
});

const url = new URL("/api/mcp/data/meta-ad-creatives", baseUrl);
url.searchParams.set("customerId", customerId);
url.searchParams.set("limit", "5");
url.searchParams.set("activeOnly", "true");

console.log("Testing:", url.toString());

const res = await fetch(url, {
	headers: {
		Authorization: `Bearer ${plaintext}`,
		Accept: "application/json",
	},
});
const text = await res.text();
console.log("HTTP", res.status, res.headers.get("content-type"));

let parsed;
try {
	parsed = JSON.parse(text);
	console.log(JSON.stringify(parsed, null, 2).slice(0, 3000));
} catch {
	console.log(text.slice(0, 1500));
}

// Revoke temp key
const McpApiKey = (await import("../../models/McpApiKey.js")).default;
await McpApiKey.findByIdAndUpdate(key.id, { revokedAt: new Date() });

const ok =
	res.ok &&
	parsed &&
	Array.isArray(parsed.ads) &&
	parsed.ads.length > 0 &&
	parsed.ads.some((ad) => ad.creative?.thumbnail_url);

console.log(ok ? "\nPASS — local MCP route returns ad creatives." : "\nFAIL — see response above.");
process.exit(ok ? 0 : 1);
