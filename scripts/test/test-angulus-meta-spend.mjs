/**
 * Compare Meta spend: all-markets vs legacy customerMetaID filter (Angulus).
 * Requires MONGODB_URI, FACEBOOK_APP_TOKEN in .env.local
 *
 * Run: node scripts/test/test-angulus-meta-spend.mjs
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../../.env.local") });
dotenv.config({ path: path.join(__dirname, "../../.env") });

import connectToDatabase from "../../lib/mongodb.js";
import Customer from "../../src/models/Customer.js";
import { fetchMergedSources } from "../../src/lib/mergedSourcesApi.js";
import { resolveMetaCountryFilterForMergedSources } from "../../src/lib/shopifyMarketsAdSpendFilters.js";

const startDate = "2026-03-01";
const endDate = "2026-03-15";

function sumFacebookSpend(merged) {
    const rows = merged?.facebookDaily || [];
    return rows.reduce((s, r) => s + (parseFloat(r.spend) || 0), 0);
}

await connectToDatabase();

const doc = await Customer.findOne({
    customerName: /angulus/i,
    isArchived: { $ne: true },
}).lean();

if (!doc) {
    console.error("No customer matching /angulus/i");
    process.exit(1);
}

const settings = {
    customerName: doc.customerName,
    customerType: doc.customerType || "Shopify",
    ...(doc.CustomerSettings || {}),
    CustomerStaticExpenses: doc.CustomerStaticExpenses || {},
};

console.log("Customer:", doc.customerName, doc._id.toString());
console.log("shopifyMarketsEnabled:", settings.shopifyMarketsEnabled);
console.log("customerMetaID:", settings.customerMetaID);
console.log("facebookAdAccountId:", settings.facebookAdAccountId);

const resolved = resolveMetaCountryFilterForMergedSources(settings, null);
console.log("Resolved Meta include/exclude (all markets):", resolved);

const allMarkets = await fetchMergedSources(settings, startDate, endDate, {
    dailyBreakdown: true,
    shopifyMarketFilterAdSpend: false,
});
console.log("All-markets Meta spend total:", sumFacebookSpend(allMarkets).toFixed(2), "DKK");

if (resolved.include || resolved.exclude) {
    console.log("(Legacy path would still filter — unexpected for Shopify Markets customer)");
} else {
    console.log("OK: all-markets uses full ad account (no legacy Meta ID filter).");
}
