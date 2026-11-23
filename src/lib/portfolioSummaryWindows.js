import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

export const PORTFOLIO_TZ = "Europe/Copenhagen";
const DATE_FMT = "YYYY-MM-DD";

export function buildWindowKey(startDate, endDate, compareStartDate, compareEndDate) {
    return `${startDate}_${endDate}_${compareStartDate}_${compareEndDate}`;
}

/**
 * Scheduled cron only runs during Black Days season (default: November of PORTFOLIO_SUMMARY_YEAR / 2026).
 * Manual route bypasses this. Override with PORTFOLIO_SUMMARY_SEASON_MONTH (1-12) or YEAR.
 */
export function isWithinPortfolioSummarySeason(ref = dayjs()) {
    const now = dayjs(ref).tz(PORTFOLIO_TZ);
    const year = Number(process.env.PORTFOLIO_SUMMARY_YEAR) || 2026;
    const month = Number(process.env.PORTFOLIO_SUMMARY_SEASON_MONTH) || 11; // November
    return now.year() === year && now.month() + 1 === month;
}

/**
 * Daytime window for the scheduled cron (Copenhagen). Default 08:00–23:00 (hour < 23).
 * Override with PORTFOLIO_SUMMARY_DAY_START_HOUR / PORTFOLIO_SUMMARY_DAY_END_HOUR.
 */
export function isWithinPortfolioSummaryDayHours(ref = dayjs()) {
    const now = dayjs(ref).tz(PORTFOLIO_TZ);
    const start = Number(process.env.PORTFOLIO_SUMMARY_DAY_START_HOUR);
    const end = Number(process.env.PORTFOLIO_SUMMARY_DAY_END_HOUR);
    const startHour = Number.isFinite(start) ? start : 8;
    const endHour = Number.isFinite(end) ? end : 23; // exclusive
    const hour = now.hour();
    return hour >= startHour && hour < endHour;
}

/**
 * Default Black Days window: Nov 1 → min(yesterday, Nov 30), YoY compare.
 * Override with PORTFOLIO_SUMMARY_START_DATE / PORTFOLIO_SUMMARY_END_DATE.
 */
export function getDefaultPortfolioWindow(ref = dayjs()) {
    const now = dayjs(ref).tz(PORTFOLIO_TZ);
    const year = Number(process.env.PORTFOLIO_SUMMARY_YEAR) || now.year();
    const envStart = String(process.env.PORTFOLIO_SUMMARY_START_DATE || "").trim();
    const envEnd = String(process.env.PORTFOLIO_SUMMARY_END_DATE || "").trim();

    const start = envStart
        ? dayjs(envStart)
        : dayjs.tz(`${year}-11-01`, PORTFOLIO_TZ);
    const nov30 = dayjs.tz(`${year}-11-30`, PORTFOLIO_TZ);
    const yesterday = now.subtract(1, "day");
    const end = envEnd ? dayjs(envEnd) : yesterday.isBefore(nov30) ? yesterday : nov30;

    const startDate = start.format(DATE_FMT);
    const endDate = end.format(DATE_FMT);
    return {
        startDate,
        endDate,
        compareStartDate: start.subtract(1, "year").format(DATE_FMT),
        compareEndDate: end.subtract(1, "year").format(DATE_FMT),
        windowKey: buildWindowKey(
            startDate,
            endDate,
            start.subtract(1, "year").format(DATE_FMT),
            end.subtract(1, "year").format(DATE_FMT)
        ),
    };
}

export function resolvePortfolioWindow(params = {}) {
    const startDate = String(params.startDate || "").trim();
    const endDate = String(params.endDate || "").trim();
    if (!startDate || !endDate) {
        return getDefaultPortfolioWindow();
    }
    const start = dayjs(startDate);
    const end = dayjs(endDate);
    if (!start.isValid() || !end.isValid() || end.isBefore(start)) {
        throw new Error("Invalid startDate/endDate (YYYY-MM-DD, end >= start)");
    }
    const compareStartDate =
        String(params.compareStartDate || "").trim() ||
        start.subtract(1, "year").format(DATE_FMT);
    const compareEndDate =
        String(params.compareEndDate || "").trim() || end.subtract(1, "year").format(DATE_FMT);
    return {
        startDate: start.format(DATE_FMT),
        endDate: end.format(DATE_FMT),
        compareStartDate,
        compareEndDate,
        windowKey: buildWindowKey(
            start.format(DATE_FMT),
            end.format(DATE_FMT),
            compareStartDate,
            compareEndDate
        ),
    };
}
