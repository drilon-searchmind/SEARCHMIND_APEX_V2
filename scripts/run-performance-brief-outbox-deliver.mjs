/**
 * Trigger Performance Brief outbox DELIVER (CRON B).
 *
 * Usage:
 *   node scripts/run-performance-brief-outbox-deliver.mjs
 *     Respects dry-run unless --send is passed.
 *   node scripts/run-performance-brief-outbox-deliver.mjs --send
 *     Post to Slack (#apex-test-cron when PERFORMANCE_BRIEF_TEST_MODE=true).
 *   node scripts/run-performance-brief-outbox-deliver.mjs --send --test-customer <id>
 *
 * Env: CRON_SECRET, APEX_RADAR_CRON_URL (default http://localhost:3000)
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

const params = new URLSearchParams();

if (args.includes("--force")) {
    params.set("force", "1");
}

if (!args.includes("--send")) {
    params.set("dryRun", "1");
    console.log("Dry-run mode (no Slack). Pass --send to post.");
}

const testCustomerIdx = args.indexOf("--test-customer");
if (testCustomerIdx >= 0) {
    const testCustomerId = args[testCustomerIdx + 1];
    if (!testCustomerId) {
        console.error("Missing customer id after --test-customer");
        process.exit(1);
    }
    params.set("testCustomerId", testCustomerId);
}

const testMode = (process.env.PERFORMANCE_BRIEF_TEST_MODE || "false").trim().toLowerCase();
console.log(`PERFORMANCE_BRIEF_TEST_MODE=${testMode}`);

const url = `${baseUrl}/api/cron/performance-brief/deliver?${params.toString()}`;

const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${secret}` },
});

const data = await res.json().catch(() => ({}));

if (!res.ok) {
    console.error(`HTTP ${res.status}`, data);
    process.exit(1);
}

console.log(JSON.stringify(data, null, 2));
