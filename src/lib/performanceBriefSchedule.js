import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

/** Monday 10:00 Europe/Copenhagen */
export const DEFAULT_SCHEDULE_DAY_OF_WEEK = 1;
export const DEFAULT_SCHEDULE_HOUR = 10;
export const SCHEDULE_WINDOW_MINUTES = 15;

export const SCHEDULE_DAY_OPTIONS = [
    { value: 1, label: "Monday" },
    { value: 2, label: "Tuesday" },
    { value: 3, label: "Wednesday" },
    { value: 4, label: "Thursday" },
    { value: 5, label: "Friday" },
    { value: 6, label: "Saturday" },
    { value: 0, label: "Sunday" },
];

export const SCHEDULE_HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => ({
    value: hour,
    label: `${String(hour).padStart(2, "0")}:00`,
}));

export function normalizeScheduleDayOfWeek(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return DEFAULT_SCHEDULE_DAY_OF_WEEK;
    const day = Math.trunc(n);
    if (day < 0 || day > 6) return DEFAULT_SCHEDULE_DAY_OF_WEEK;
    return day;
}

export function normalizeScheduleHour(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return DEFAULT_SCHEDULE_HOUR;
    const hour = Math.trunc(n);
    if (hour < 0 || hour > 23) return DEFAULT_SCHEDULE_HOUR;
    return hour;
}

export function normalizePerformanceBriefSchedule(raw = {}) {
    return {
        scheduleDayOfWeek: normalizeScheduleDayOfWeek(raw.scheduleDayOfWeek),
        scheduleHour: normalizeScheduleHour(raw.scheduleHour),
    };
}

export function formatPerformanceBriefScheduleLabel(schedule = {}) {
    const normalized = normalizePerformanceBriefSchedule(schedule);
    const day =
        SCHEDULE_DAY_OPTIONS.find((opt) => opt.value === normalized.scheduleDayOfWeek)?.label ||
        "Monday";
    const hour = `${String(normalized.scheduleHour).padStart(2, "0")}:00`;
    return `${day} ${hour}`;
}

/**
 * Whether a customer's brief should run in the current hourly cron tick.
 * @param {{ scheduleDayOfWeek?: number, scheduleHour?: number }} customer
 * @param {import("dayjs").Dayjs} [now]
 * @param {string} [timezoneName]
 */
export function isCustomerScheduleDue(
    customer,
    now = dayjs(),
    timezoneName = "Europe/Copenhagen"
) {
    const schedule = normalizePerformanceBriefSchedule(customer);
    const local = now.tz(timezoneName);
    if (local.day() !== schedule.scheduleDayOfWeek) return false;
    if (local.hour() !== schedule.scheduleHour) return false;
    return local.minute() < SCHEDULE_WINDOW_MINUTES;
}
