/**
 * Manually trigger Performance Brief weekly cron against local or production.
 *
 * Usage:
 *   node scripts/run-performance-brief-cron.mjs
 *     Dry-run by default (generates briefs, does NOT post to Slack).
 *   node scripts/run-performance-brief-cron.mjs --send
 *     Post to assigned Slack channels (use with care).
 *   node scripts/run-performance-brief-cron.mjs --send --test-customer <id> --test-channel 1337-crm
 *     Re-send one customer to a test channel (auto-forces that customer only).
 *   node scripts/run-performance-brief-cron.mjs --send --force
 *     Re-send all customers with Slack channels (use with extreme care).
 *   node scripts/run-performance-brief-cron.mjs --continue <runId>
 *
 * Env: CRON_SECRET (required), APEX_RADAR_CRON_URL (default http://localhost:3000)
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

const params = new URLSearchParams({ skipSchedule: "1" });

if (args.includes("--send")) {
    params.set("send", "1");
}

if (args.includes("--force")) {
    params.set("force", "1");
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

const testChannelIdx = args.indexOf("--test-channel");
if (testChannelIdx >= 0) {
    const testChannelName = args[testChannelIdx + 1];
    if (!testChannelName) {
        console.error("Missing channel name after --test-channel");
        process.exit(1);
    }
    params.set("testChannelName", testChannelName.replace(/^#/, ""));
}

const continueIdx = args.indexOf("--continue");
if (continueIdx >= 0) {
    const runId = args[continueIdx + 1];
    if (!runId) {
        console.error("Missing runId after --continue");
        process.exit(1);
    }
    params.set("runId", runId);
    params.set("continue", "1");
}

if (params.get("testCustomerId") && !params.get("force")) {
    params.set("force", "1");
    console.log("Test mode: auto-forcing re-run for test customer only.");
}

if (!params.get("send")) {
    console.log("Dry-run mode (no Slack). Pass --send to post to Slack.");
}

const url = `${baseUrl}/api/cron/performance-brief?${params.toString()}`;

const res = await fetch(url, {
    method: "GET",
    headers: {
        Authorization: `Bearer ${secret}`,
    },
});

const data = await res.json().catch(() => ({}));

if (!res.ok) {
    console.error(`HTTP ${res.status}`, data);
    process.exit(1);
}

console.log(JSON.stringify(data, null, 2));
