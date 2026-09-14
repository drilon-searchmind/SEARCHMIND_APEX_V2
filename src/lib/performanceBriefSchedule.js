import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

/** Monday 10:00 Europe/Copenhagen */
export const DEFAULT_SCHEDULE_DAY_OF_WEEK = 1;
export const DEFAULT_SCHEDULE_HOUR = 10;

/** Cron + UI use 2-hour slots (08:00, 10:00, 12:00, …). */
export const SCHEDULE_SLOT_HOURS = 2;

export const SCHEDULE_DAY_OPTIONS = [
    { value: 1, label: "Monday" },
    { value: 2, label: "Tuesday" },
    { value: 3, label: "Wednesday" },
    { value: 4, label: "Thursday" },
    { value: 5, label: "Friday" },
    { value: 6, label: "Saturday" },
    { value: 0, label: "Sunday" },
];

export const SCHEDULE_HOUR_OPTIONS = Array.from(
    { length: 24 / SCHEDULE_SLOT_HOURS },
    (_, index) => {
        const hour = index * SCHEDULE_SLOT_HOURS;
        return {
            value: hour,
            label: `${String(hour).padStart(2, "0")}:00`,
        };
    }
);

export function normalizeScheduleDayOfWeek(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return DEFAULT_SCHEDULE_DAY_OF_WEEK;
    const day = Math.trunc(n);
    if (day < 0 || day > 6) return DEFAULT_SCHEDULE_DAY_OF_WEEK;
    return day;
}

/** Snap to nearest lower 2-hour slot (e.g. 11 → 10, 9 → 8). */
export function normalizeScheduleHour(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return DEFAULT_SCHEDULE_HOUR;
    const hour = Math.trunc(n);
    if (hour < 0 || hour > 23) return DEFAULT_SCHEDULE_HOUR;
    const snapped = hour - (hour % SCHEDULE_SLOT_HOURS);
    return snapped;
}

export function normalizePerformanceBriefSchedule(raw = {}) {
    return {
        scheduleDayOfWeek: normalizeScheduleDayOfWeek(raw.scheduleDayOfWeek),
        scheduleHour: normalizeScheduleHour(raw.scheduleHour),
    };
}

function formatHourLabel(hour) {
    return `${String(hour).padStart(2, "0")}:00`;
}

export function formatPerformanceBriefScheduleLabel(schedule = {}) {
    const normalized = normalizePerformanceBriefSchedule(schedule);
    const day =
        SCHEDULE_DAY_OPTIONS.find((opt) => opt.value === normalized.scheduleDayOfWeek)?.label ||
        "Monday";
    const start = formatHourLabel(normalized.scheduleHour);
    const end = formatHourLabel(normalized.scheduleHour + SCHEDULE_SLOT_HOURS);
    return `${day} ${start}–${end}`;
}

/**
 * Whether a customer's brief should run in the current cron tick.
 * Matches the full 2-hour slot (e.g. 10:00 schedule → 10:00–11:59 local).
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

    const hour = local.hour();
    return hour >= schedule.scheduleHour && hour < schedule.scheduleHour + SCHEDULE_SLOT_HOURS;
}
