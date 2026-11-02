/** List parent groups that contain B2B children (for manual testing Market Overview). */
import "dotenv/config";
import mongoose from "mongoose";
import connectToDatabase from "../../lib/mongodb.js";

await connectToDatabase();
const db = mongoose.connection.db;
const C = db.collection("customers");
const P = db.collection("parentcustomers");

const parents = await P.find({}).toArray();
let found = 0;
for (const p of parents) {
	const kids = await C.find({
		isArchived: { $ne: true },
		$or: [{ _id: { $in: p.customers || [] } }, { parentCustomer: p._id }],
	})
		.project({ businessCategory: 1, customerName: 1, "CustomerSettings.ga4PropertyId": 1 })
		.toArray();
	if (!kids.some((k) => k.businessCategory === "b2b")) continue;
	found += 1;
	console.log(`PARENT ${p._id} "${p.name}"`);
	for (const k of kids) {
		console.log(
			`   - ${k._id} ${k.customerName} [${k.businessCategory || "ecommerce"}] ga4=${k.CustomerSettings?.ga4PropertyId || "-"}`
		);
	}
}
console.log(found ? `\n${found} group(s) with B2B children` : "No groups with B2B children found");
process.exit(0);
