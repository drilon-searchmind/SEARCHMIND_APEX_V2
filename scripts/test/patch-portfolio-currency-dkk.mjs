import "dotenv/config";
import mongoose from "mongoose";
import connectToDatabase from "../../lib/mongodb.js";

await connectToDatabase();
const c = mongoose.connection.db.collection("portfolio_summary_snapshots");
const docs = await c.find({}).project({ customerName: 1, currency: 1, customerId: 1 }).toArray();
const wrong = docs.filter((d) => d.currency && d.currency !== "DKK");
console.log(
	"non-DKK labels:",
	wrong.map((d) => `${d.customerName}:${d.currency}`)
);

const ids = [...new Set(docs.map((d) => d.customerId).filter(Boolean))];
const objectIds = ids
	.map((id) => {
		try {
			return new mongoose.Types.ObjectId(id);
		} catch {
			return null;
		}
	})
	.filter(Boolean);
const custs = await mongoose.connection.db
	.collection("customers")
	.find({ _id: { $in: objectIds } })
	.project({ _id: 1, "CustomerSettings.customerStoreValutaCode": 1 })
	.toArray();
const storeById = Object.fromEntries(
	custs.map((x) => [String(x._id), x.CustomerSettings?.customerStoreValutaCode || "DKK"])
);

let n = 0;
for (const d of docs) {
	const store = storeById[d.customerId] || d.currency || "DKK";
	await c.updateOne({ _id: d._id }, { $set: { currency: "DKK", storeCurrency: store } });
	n += 1;
}
console.log("patched", n, "snapshots to currency=DKK");
process.exit(0);
