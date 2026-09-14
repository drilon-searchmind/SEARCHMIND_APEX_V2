/**
 * Run prepare batches until backlog is cleared or max rounds reached.
 *
 * Usage:
 *   node scripts/run-performance-brief-outbox-prepare-loop.mjs
 *   node scripts/run-performance-brief-outbox-prepare-loop.mjs --max-rounds 20
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const secret = (process.env.CRON_SECRET || "").trim();
const baseUrl = (process.env.APEX_RADAR_CRON_URL || "http://localhost:3000").replace(/\/$/, "");
const args = process.argv.slice(2);

if (!secret) {
    console.error("Missing CRON_SECRET in .env");
    process.exit(1);
}

let maxRounds = 30;
const maxIdx = args.indexOf("--max-rounds");
if (maxIdx >= 0) {
    maxRounds = Number(args[maxIdx + 1]) || maxRounds;
}

for (let round = 1; round <= maxRounds; round += 1) {
    const params = new URLSearchParams({ force: "1" });
    console.log(`\n--- Prepare round ${round}/${maxRounds} ---`);

    const started = Date.now();
    const res = await fetch(`${baseUrl}/api/cron/performance-brief/prepare?${params.toString()}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${secret}` },
    });
    const data = await res.json().catch(() => ({}));
    const elapsed = Math.round((Date.now() - started) / 1000);

    if (!res.ok) {
        console.error(`HTTP ${res.status} after ${elapsed}s`, JSON.stringify(data, null, 2));
        process.exit(1);
    }

    console.log(JSON.stringify({ round, elapsedSec: elapsed, ...data }, null, 2));

    if (data.skipped && (data.reason === "all_prepared" || data.reason === "no_due_customers")) {
        break;
    }

    const remaining = data.stats?.remaining ?? 0;
    const timedOut = data.stats?.timedOut ?? false;
    if (!timedOut || remaining <= 0) {
        break;
    }
}
