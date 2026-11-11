/** Print non-secret revenue-related settings for customers matching a name (debug helper). */
import "dotenv/config";
import mongoose from "mongoose";
import connectToDatabase from "../../lib/mongodb.js";

const needle = process.argv[2] || "Rains";
await connectToDatabase();
const docs = await mongoose.connection.db
	.collection("customers")
	.find({ customerName: { $regex: needle, $options: "i" }, isArchived: { $ne: true } })
	.toArray();
for (const c of docs) {
	const s = c.CustomerSettings || {};
	console.log({
		id: String(c._id),
		name: c.customerName,
		type: c.customerType,
		category: c.businessCategory,
		shopifyUrl: s.shopifyUrl,
		hasPassword: Boolean(s.shopifyApiPassword),
		markets: s.shopifyMarketsEnabled,
		onlineStoreOnly: s.shopifyOnlineStoreOnly,
		changeCurrency: s.changeCurrency,
		billingInclude: s.changeCurrencyShopifyBillingCountryName,
		billingExclude: s.changeCurrencyShopifyBillingCountryExclude,
		revenueType: s.customerRevenueType,
	});
}
process.exit(0);
