/**
 * Delete all documents from performance_brief_outbox.
 *
 * Usage:
 *   node scripts/clear-performance-brief-outbox.mjs
 *   node scripts/clear-performance-brief-outbox.mjs --yes
 */
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config({ path: ".env.local" });
dotenv.config();

const uri = (process.env.MONGODB_URI || "").trim();
const args = process.argv.slice(2);
const confirmed = args.includes("--yes");

if (!uri) {
    console.error("Missing MONGODB_URI in .env");
    process.exit(1);
}

if (!confirmed) {
    console.log("This will delete ALL documents in performance_brief_outbox.");
    console.log("Re-run with --yes to confirm.");
    process.exit(0);
}

await mongoose.connect(uri);

const result = await mongoose.connection.db
    .collection("performance_brief_outbox")
    .deleteMany({});

console.log(`Deleted ${result.deletedCount} document(s) from performance_brief_outbox.`);

await mongoose.disconnect();
