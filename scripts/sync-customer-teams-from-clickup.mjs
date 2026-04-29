/**
 * Bulk re-sync ClickUp team data into MongoDB `Customer.customerTeam`
 * for all customers that have CustomerSettings.customerClickupID set.
 *
 * Prerequisites: `.env` with MONGODB_URI and CLICKUP_API_TOKEN (same as the app API).
 *
 * Usage:
 *   node scripts/sync-customer-teams-from-clickup.mjs
 *   node scripts/sync-customer-teams-from-clickup.mjs --dry-run
 *   node scripts/sync-customer-teams-from-clickup.mjs --limit=5
 *   node scripts/sync-customer-teams-from-clickup.mjs --delay=500
 *   node scripts/sync-customer-teams-from-clickup.mjs --include-archived
 *
 * Safe to run repeatedly (`customerTeam` overwritten). Existing customer fields besides
 * `customerTeam` (+ `updatedAt` on success) are not modified — take a DB snapshot/backup first if you prefer.
 *
 * Does not replace live `/api/clickup-team-members/[customerId]` usage on dashboards.
 */
import "dotenv/config";

import { syncAllCustomersClickupTeams } from "../src/lib/customerTeamSync.js";

function parseArgs() {
    const argv = process.argv.slice(2);
    const opts = {
        dryRun: false,
        limit: undefined,
        delayBetweenMs: 250,
        includeArchived: false,
    };
    for (const arg of argv) {
        if (arg === "--dry-run") opts.dryRun = true;
        else if (arg === "--include-archived") opts.includeArchived = true;
        else if (arg.startsWith("--limit="))
            opts.limit = Number(arg.slice("--limit=".length));
        else if (arg.startsWith("--delay="))
            opts.delayBetweenMs = Number(arg.slice("--delay=".length));
    }
    return opts;
}

async function main() {
    const options = parseArgs();
    console.log("Starting ClickUp → customerTeam sync", options);

    const { results, summary } = await syncAllCustomersClickupTeams(options);

    console.log("\nSummary:", summary);
    const failed = results.filter((r) => r.ok === false);
    if (failed.length) {
        console.log(
            "\nFailures:",
            failed.map((r) => ({ customerId: r.customerId, error: r.error }))
        );
        process.exitCode = 1;
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
