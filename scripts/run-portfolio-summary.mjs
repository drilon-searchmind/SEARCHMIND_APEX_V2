/**
 * Seed / refresh portfolio-summary snapshots via the manual cron route.
 *
 * Prefer running against PRODUCTION (Vercel) so Shopify traffic comes from Vercel, not your office IP.
 *
 * Usage:
 *   # needs a running server
 *   node scripts/run-portfolio-summary.mjs --limit 3 --dry-run
 *   node scripts/run-portfolio-summary.mjs --all
 *   BASE_URL=https://apex.searchmind.tech node scripts/run-portfolio-summary.mjs --all
 *
 * Optional: --start 2026-11-01 --end 2026-11-22
 */
import "dotenv/config";

const BASE_URL = (process.env.BASE_URL || "http://localhost:3100").replace(/\/$/, "");
const SECRET = (process.env.CRON_SECRET || "").trim();
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const all = args.includes("--all");
const force = !args.includes("--no-force");

function argValue(flag) {
	const i = args.indexOf(flag);
	return i >= 0 ? args[i + 1] : undefined;
}

if (!SECRET) {
	console.error("CRON_SECRET is not set.");
	process.exit(1);
}

const params = new URLSearchParams();
if (all) params.set("all", "true");
else params.set("limit", argValue("--limit") || "20");
if (dryRun) params.set("dryRun", "true");
if (force) params.set("force", "true");
for (const [flag, key] of [
	["--start", "startDate"],
	["--end", "endDate"],
	["--compare-start", "compareStartDate"],
	["--compare-end", "compareEndDate"],
	["--customer", "customerId"],
]) {
	const v = argValue(flag);
	if (v) params.set(key, v);
}

let round = 0;
let totals = { processed: 0, ok: 0, partial: 0, no_data: 0, errors: 0 };
let forceThisRound = force;

while (true) {
	round += 1;
	if (!forceThisRound) params.set("force", "false");
	const url = `${BASE_URL}/api/cron/portfolio-summary/manual?${params}`;
	const res = await fetch(url, { headers: { Authorization: `Bearer ${SECRET}` } });
	const body = await res.json().catch(() => ({}));
	if (!res.ok && res.status !== 207) {
		console.error(`Round ${round} failed (${res.status}):`, body);
		process.exit(1);
	}
	for (const k of Object.keys(totals)) totals[k] += body[k] || 0;
	console.log(
		`Round ${round}: processed ${body.processed}, ok ${body.ok}, partial ${body.partial}, ` +
			`no_data ${body.no_data}, errors ${body.errors}, remaining ${body.remaining} ` +
			`(${Math.round((body.durationMs || 0) / 1000)}s) window=${body.window?.startDate}→${body.window?.endDate}`
	);
	for (const e of body.errors_detail || []) {
		console.log(`   error ${e.customerName || e.customerId}: ${e.error}`);
	}
	forceThisRound = false;
	params.set("force", "false");
	if (dryRun || !body.remaining || !body.processed) break;
	if (!all && !argValue("--limit")) break;
	if (!all) break;
}

console.log("Done.", totals);
