/**
 * Compute and store the Indeks for ALL customers (writes to MongoDB), repeating the manual route
 * until nothing is left. Does not touch the deployed cron/schedule.
 *
 * Usage (needs a running Apex server, e.g. `npx next dev -p 3100`):
 *   node scripts/run-indeks-all.mjs                       # only stale/missing snapshots
 *   node scripts/run-indeks-all.mjs --force               # recompute everything
 *   BASE_URL=https://<deployment> node scripts/run-indeks-all.mjs
 * CRON_SECRET is read from the environment / .env.
 */
import "dotenv/config";

const BASE_URL = (process.env.BASE_URL || "http://localhost:3100").replace(/\/$/, "");
const SECRET = (process.env.CRON_SECRET || "").trim();
const force = process.argv.includes("--force");

if (!SECRET) {
	console.error("CRON_SECRET is not set.");
	process.exit(1);
}

let round = 0;
let totals = { processed: 0, ok: 0, no_data: 0, insufficient_history: 0, errors: 0 };
let forceThisRound = force;

while (true) {
	round += 1;
	const url = `${BASE_URL}/api/cron/indeks/manual?all=true&force=${forceThisRound}`;
	const res = await fetch(url, { headers: { Authorization: `Bearer ${SECRET}` } });
	const body = await res.json().catch(() => ({}));
	if (!res.ok && res.status !== 207) {
		console.error(`Round ${round} failed (${res.status}):`, body);
		process.exit(1);
	}
	for (const k of Object.keys(totals)) totals[k] += body[k] || 0;
	console.log(
		`Round ${round}: processed ${body.processed}, ok ${body.ok}, no_data ${body.no_data}, ` +
			`insufficient_history ${body.insufficient_history}, errors ${body.errors}, remaining ${body.remaining} ` +
			`(${Math.round((body.durationMs || 0) / 1000)}s)`
	);
	for (const e of body.errors_detail || []) console.log(`   error ${e.customerClickupId}: ${e.error}`);

	// After a forced first round everything is fresh, so continue with only what is left.
	forceThisRound = false;
	if (!body.remaining || !body.processed) break;
}

console.log("Done.", totals);
