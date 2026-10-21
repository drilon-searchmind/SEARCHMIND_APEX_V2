/**
 * One-off: remove bogus MCP route access request (wrong route with query string).
 * Usage: node scripts/temp/dismiss-route-access-request.mjs [requestId]
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../../.env.local") });
dotenv.config({ path: path.join(__dirname, "../../.env") });

import connectToDatabase from "../../lib/mongodb.js";
import RouteAccessRequest from "../../models/RouteAccessRequest.js";

const id = process.argv[2] || "6ad87944ae045ac7548e3e1e";

await connectToDatabase();
const doc = await RouteAccessRequest.findById(id);
if (!doc) {
    console.log("Not found:", id);
    process.exit(0);
}
console.log("Before:", { route: doc.route, status: doc.status, customerId: doc.customerId });
await RouteAccessRequest.deleteOne({ _id: id });
console.log("Deleted:", id);
