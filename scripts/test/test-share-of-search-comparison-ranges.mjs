import {
	getShareOfSearchLastYearRange,
	getShareOfSearchPreviousPeriodRange,
	shareOfSearchSamePlannerMonths,
} from "../../src/lib/shareOfSearchComparisonRanges.js";

// ~12 month window like Sofie Sønderby (Nov → Oct)
const main = { start: "2025-11-01", end: "2026-10-04" };
const prev = getShareOfSearchPreviousPeriodRange(main.start, main.end);
const ly = getShareOfSearchLastYearRange(main.start, main.end);

if (prev.definition !== "sequential_prior_year") {
	console.error("Expected sequential prior year for ~12mo window", prev);
	process.exit(1);
}

if (shareOfSearchSamePlannerMonths(prev, ly)) {
	console.error("Prior and YoY should not share same planner months", prev, ly);
	process.exit(1);
}

const q1 = { start: "2025-01-01", end: "2025-03-31" };
const prevQ = getShareOfSearchPreviousPeriodRange(q1.start, q1.end);
const lyQ = getShareOfSearchLastYearRange(q1.start, q1.end);
if (shareOfSearchSamePlannerMonths(prevQ, lyQ)) {
	console.error("Q1 prior and YoY should differ", prevQ, lyQ);
	process.exit(1);
}

console.log("PASS", { main, prev, ly, prevQ, lyQ });
