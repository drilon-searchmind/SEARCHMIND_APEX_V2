/**
 * Run Performance Brief cron batches locally until pending=0 or max batches.
 * Usage: node scripts/run-performance-brief-cron-loop.mjs --send [--continue <runId>] [--max 20]
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

if (!args.includes("--send")) {
    console.error("Refusing to loop without --send (would not post to Slack).");
    process.exit(1);
}

const maxIdx = args.indexOf("--max");
const maxBatches = maxIdx >= 0 ? Number(args[maxIdx + 1]) || 20 : 20;

const continueIdx = args.indexOf("--continue");
const runId = continueIdx >= 0 ? String(args[continueIdx + 1] || "").trim() : "";

for (let batch = 1; batch <= maxBatches; batch++) {
    const params = new URLSearchParams({ skipSchedule: "1", send: "1" });
    if (runId) {
        params.set("runId", runId);
        params.set("continue", "1");
    }

    console.log(`\n=== Batch ${batch}/${maxBatches} ===`);
    const started = Date.now();
    const res = await fetch(`${baseUrl}/api/cron/performance-brief?${params.toString()}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${secret}` },
    });
    const data = await res.json().catch(() => ({}));
    const elapsed = Math.round((Date.now() - started) / 1000);

    if (!res.ok) {
        console.error(`HTTP ${res.status} after ${elapsed}s`, JSON.stringify(data, null, 2));
        process.exit(1);
    }

    const stats = data.stats || {};
    const processed = Array.isArray(data.processed) ? data.processed.length : 0;
    console.log(
        JSON.stringify(
            {
                batch,
                elapsedSec: elapsed,
                runId: data.runId,
                weekKey: data.weekKey,
                skipped: data.skipped,
                reason: data.reason,
                stats,
                processedThisBatch: processed,
            },
            null,
            2
        )
    );

    const pending = Number(stats.pending || 0);
    if (data.skipped && data.reason === "run_finished") {
        console.log("Run finished.");
        break;
    }
    if (pending === 0 && !data.skipped) {
        console.log("All customers processed.");
        break;
    }
    if (data.skipped && pending === 0) {
        console.log("Nothing left to do.");
        break;
    }
}
