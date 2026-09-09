import { addDaysIso, getUtcCalendarSpendDodRange } from "@/lib/apexRadarFacebookOverview";

/**
 * ISO week number for a YYYY-MM-DD date (UTC).
 * @param {string} iso
 * @returns {{ week: number, year: number }}
 */
export function isoWeekFromDate(iso) {
    const [y, m, d] = String(iso || "")
        .split("-")
        .map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    const dayNr = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - dayNr + 3);
    const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
    const week =
        1 +
        Math.round(
            ((date.getTime() - firstThursday.getTime()) / 86400000 -
                3 +
                ((firstThursday.getUTCDay() + 6) % 7)) /
                7
        );
    return { week, year: date.getUTCFullYear() };
}

/**
 * All brief windows end yesterday (never today).
 * @param {string} [endDate]
 */
export function buildPerformanceBriefWindows(endDate = null) {
    const yesterday = endDate || getUtcCalendarSpendDodRange().calendarYesterday;
    const last7 = { start: addDaysIso(yesterday, -6), end: yesterday };
    const prev7 = { start: addDaysIso(last7.start, -7), end: addDaysIso(last7.start, -1) };
    const last90 = { start: addDaysIso(yesterday, -89), end: yesterday };
    const { week, year } = isoWeekFromDate(yesterday);

    return {
        yesterday,
        isoWeek: week,
        isoWeekYear: year,
        last7,
        prev7,
        last90,
    };
}

export function pctChange(current, previous) {
    const now = Number(current);
    const prev = Number(previous);
    if (!Number.isFinite(now) || !Number.isFinite(prev) || prev === 0) return null;
    return ((now - prev) / prev) * 100;
}

export function safeDiv(num, den) {
    const n = Number(num);
    const d = Number(den);
    if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return 0;
    return n / d;
}

export function roundN(value, digits = 2) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    const f = 10 ** digits;
    return Math.round(n * f) / f;
}
