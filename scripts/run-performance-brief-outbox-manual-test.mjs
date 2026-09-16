/**
 * Manual end-to-end test: prepare all customers today → deliver all to #apex-test-cron.
 * Simulates the Vercel crons but runs immediately with schedule/date overrides.
 *
 * Usage:
 *   node scripts/run-performance-brief-outbox-manual-test.mjs
 *     Dry-run deliver (prepare always runs; deliver lists targets only).
 *   node scripts/run-performance-brief-outbox-manual-test.mjs --send
 *     Prepare + post all briefs to #apex-test-cron on production.
 *
 * Env: CRON_SECRET, APEX_RADAR_CRON_URL (default https://apex.searchmind.tech)
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const secret = (process.env.CRON_SECRET || "").trim();
const baseUrl = (
    process.env.APEX_RADAR_CRON_URL || "https://apex.searchmind.tech"
).replace(/\/$/, "");
const args = process.argv.slice(2);
const sendSlack = args.includes("--send");

if (!secret) {
    console.error("Missing CRON_SECRET in .env");
    process.exit(1);
}

const maxRounds = 30;

async function callCron(phase, params) {
    const url = `${baseUrl}/api/cron/performance-brief/${phase}?${params.toString()}`;
    const started = Date.now();
    const res = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${secret}` },
    });
    const data = await res.json().catch(() => ({}));
    const elapsed = Math.round((Date.now() - started) / 1000);

    if (!res.ok) {
        throw new Error(`HTTP ${res.status} (${phase}, ${elapsed}s): ${JSON.stringify(data)}`);
    }

    return { phase, elapsedSec: elapsed, ...data };
}

console.log(`Target: ${baseUrl}`);
console.log(`Mode: manual=1 force=1 → all Slack customers today → #apex-test-cron`);
console.log(`Slack: ${sendSlack ? "SEND" : "dry-run (pass --send to post)"}\n`);

for (let round = 1; round <= maxRounds; round += 1) {
    console.log(`=== PREPARE round ${round}/${maxRounds} ===`);
    const prepare = await callCron("prepare", new URLSearchParams({ manual: "1", force: "1" }));
    console.log(JSON.stringify(prepare, null, 2));

    if (prepare.skipped && prepare.reason === "no_due_customers") {
        console.error("No customers with Slack channels in queue.");
        process.exit(1);
    }
    if (prepare.skipped && prepare.reason === "all_prepared") {
        console.log("Prepare complete.");
        break;
    }
    if (!prepare.stats?.timedOut) {
        break;
    }
}

for (let round = 1; round <= maxRounds; round += 1) {
    console.log(`\n=== DELIVER round ${round}/${maxRounds} ===`);
    const params = new URLSearchParams({ manual: "1", force: "1" });
    if (!sendSlack) {
        params.set("dryRun", "1");
    }
    const deliver = await callCron("deliver", params);
    console.log(JSON.stringify(deliver, null, 2));

    if (deliver.skipped && deliver.reason === "no_ready_items") {
        console.log("Nothing ready to deliver (run prepare first?).");
        break;
    }
    if (!deliver.stats?.remaining) {
        console.log("Deliver complete.");
        break;
    }
}

console.log("\nDone. Check #apex-test-cron and MongoDB collection performance_brief_outbox.");
