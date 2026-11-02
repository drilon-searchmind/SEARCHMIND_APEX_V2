/**
 * DAY stats window must land on account-local midnight in UTC (Snapchat E1008).
 * Run: node scripts/test/test-snapchat-stats-window.mjs
 */
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);

function statsWindowUtcIso(startDateYmd, endDateYmd, accountIanaTz) {
    const tz = accountIanaTz;
    const startLocal = dayjs.tz(String(startDateYmd).trim(), tz).startOf("day");
    const endExclusiveLocal = dayjs
        .tz(String(endDateYmd).trim(), tz)
        .startOf("day")
        .add(1, "day")
        .startOf("day");
    return {
        start_time: startLocal.toDate().toISOString(),
        end_time: endExclusiveLocal.toDate().toISOString(),
    };
}

const tz = "America/Los_Angeles";
const { start_time, end_time } = statsWindowUtcIso("2026-11-01", "2026-11-01", tz);

if (start_time !== "2026-11-01T07:00:00.000Z") {
    console.error("unexpected start_time", start_time);
    process.exit(1);
}
if (end_time !== "2026-11-02T08:00:00.000Z") {
    console.error("expected end on PST midnight (post-DST), got", end_time);
    process.exit(1);
}

const endLocal = dayjs(end_time).tz(tz);
if (endLocal.hour() !== 0 || endLocal.minute() !== 0) {
    console.error("end_time not start of day in account TZ", endLocal.format());
    process.exit(1);
}

function splitInclusiveDateRange(startDateYmd, endDateYmd, maxInclusiveDays = 31) {
    const start = dayjs(String(startDateYmd).trim());
    const end = dayjs(String(endDateYmd).trim());
    const chunks = [];
    let cursor = start.startOf("day");
    const last = end.startOf("day");
    while (cursor.isBefore(last, "day") || cursor.isSame(last, "day")) {
        const chunkStart = cursor.format("YYYY-MM-DD");
        const chunkEndDay = cursor.add(maxInclusiveDays - 1, "day");
        const chunkEnd = chunkEndDay.isAfter(last, "day") ? last.format("YYYY-MM-DD") : chunkEndDay.format("YYYY-MM-DD");
        chunks.push({ startDate: chunkStart, endDate: chunkEnd });
        cursor = dayjs(chunkEnd).add(1, "day").startOf("day");
    }
    return chunks;
}

const sixty = splitInclusiveDateRange("2026-01-01", "2026-03-01");
if (sixty.length < 2) {
    console.error("expected multiple chunks for 60d range", sixty);
    process.exit(1);
}
for (const c of sixty) {
    const days =
        dayjs(c.endDate).diff(dayjs(c.startDate), "day") + 1;
    if (days > 31) {
        console.error("chunk exceeds 31 inclusive days", c, days);
        process.exit(1);
    }
}

console.log("OK snapchat stats window (LA, DST boundary Nov 2026)");
console.log("OK snapchat DAY chunk split (" + sixty.length + " chunks for Jan–Mar 2026)");
