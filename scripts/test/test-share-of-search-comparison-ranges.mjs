import {
	areShareComparisonRangesEqual,
	getShareOfSearchLastYearRange,
	getShareOfSearchPreviousPeriodRange,
} from "../../src/lib/shareOfSearchComparisonRanges.js";

const q1 = { start: "2025-01-01", end: "2025-03-31" };
const prevQ = getShareOfSearchPreviousPeriodRange(q1.start, q1.end);
const lyQ = getShareOfSearchLastYearRange(q1.start, q1.end);
if (areShareComparisonRangesEqual(prevQ, lyQ)) {
	console.error("Expected Q1 prev !== ly", prevQ, lyQ);
	process.exit(1);
}

console.log("PASS share-of-search comparison ranges", { prevQ, lyQ });
