import "dotenv/config";
import mongoose from "mongoose";
import connectToDatabase from "../../lib/mongodb.js";

await connectToDatabase();
const db = mongoose.connection.db;
const names = /Organic Basics|Argon Audio|Bareen DK|Aarhus Bad/i;

const docs = await db
	.collection("customers")
	.find({ customerName: names, isArchived: { $ne: true } })
	.project({
		customerName: 1,
		"CustomerSettings.customerStoreValutaCode": 1,
		"CustomerSettings.changeCurrency": 1,
	})
	.toArray();

console.log(
	"customers:",
	docs.map((d) => ({
		name: d.customerName,
		storeValuta: d.CustomerSettings?.customerStoreValutaCode,
		changeCurrency: d.CustomerSettings?.changeCurrency,
	}))
);

const snaps = await db
	.collection("portfolio_summary_snapshots")
	.find({ customerName: names })
	.project({ customerName: 1, currency: 1, revenue: 1, spendTotal: 1, revenueGoogle: 1, revenueMeta: 1 })
	.toArray();

console.log("snapshots:", snaps);
process.exit(0);
