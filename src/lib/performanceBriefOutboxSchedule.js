import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import {
    isPerformanceBriefTestMode,
    PREPARE_HOUR_COPENHAGEN,
    OUTBOX_CRON_TZ,
} from "@/lib/performanceBriefOutboxConfig";
import {
    normalizePerformanceBriefSchedule,
    SCHEDULE_SLOT_HOURS,
} from "@/lib/performanceBriefSchedule";

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * @typedef {Object} DeliveryContext
 * @property {boolean} testMode
 * @property {string} timezone
 * @property {string} nowLocal
 * @property {string} deliveryDate YYYY-MM-DD (Copenhagen)
 * @property {number} deliveryDayOfWeek 0–6
 */

/**
 * Production: delivery day = today (prepare at 04:00, deliver in 4-hour slots same day).
 * Test mode: delivery day = tomorrow; prepare includes all Slack-assigned customers (ignores schedule day).
 * @param {import("dayjs").Dayjs} [now]
 * @returns {DeliveryContext}
 */
export function getDeliveryContext(now = dayjs()) {
    const testMode = isPerformanceBriefTestMode();
    const timezoneName = OUTBOX_CRON_TZ;
    const local = now.tz(timezoneName);
    const deliveryLocal = testMode ? local.add(1, "day") : local;

    return {
        testMode,
        timezone: timezoneName,
        nowLocal: local.format("YYYY-MM-DD HH:mm:ss"),
        deliveryDate: deliveryLocal.format("YYYY-MM-DD"),
        deliveryDayOfWeek: deliveryLocal.day(),
    };
}

export function isCustomerScheduledForDeliveryDay(customer, ctx) {
    const schedule = normalizePerformanceBriefSchedule(customer);
    return schedule.scheduleDayOfWeek === ctx.deliveryDayOfWeek;
}

/**
 * Whether the current clock falls in this customer's 4-hour delivery slot on the delivery date.
 * @param {{ scheduleHour?: number }} customer
 * @param {import("dayjs").Dayjs} [now]
 * @param {DeliveryContext} ctx
 */
export function isCustomerInDeliverySlot(customer, now = dayjs(), ctx) {
    const schedule = normalizePerformanceBriefSchedule(customer);
    const local = now.tz(ctx.timezone);
    if (local.format("YYYY-MM-DD") !== ctx.deliveryDate) return false;

    const hour = local.hour();
    return hour >= schedule.scheduleHour && hour < schedule.scheduleHour + SCHEDULE_SLOT_HOURS;
}

/**
 * CRON A window: 04:00 Copenhagen on delivery day. Test mode + force bypass the hour check.
 * @param {import("dayjs").Dayjs} [now]
 * @param {{ force?: boolean, hasBacklog?: boolean }} [options]
 */
export function isPrepareWindowAllowed(now = dayjs(), options = {}) {
    if (options.force) return true;
    if (isPerformanceBriefTestMode()) return true;

    const local = now.tz(OUTBOX_CRON_TZ);
    if (local.hour() === PREPARE_HOUR_COPENHAGEN) return true;

    const ctx = getDeliveryContext(now);
    if (
        options.hasBacklog &&
        local.format("YYYY-MM-DD") === ctx.deliveryDate &&
        local.hour() >= PREPARE_HOUR_COPENHAGEN &&
        local.hour() < PREPARE_HOUR_COPENHAGEN + 4
    ) {
        return true;
    }

    return false;
}

/**
 * CRON B: deliver items in the current 4-hour slot. Test mode delivers all ready items for tomorrow.
 * @param {import("dayjs").Dayjs} [now]
 * @param {{ force?: boolean }} [options]
 */
export function isDeliverWindowAllowed(now = dayjs(), options = {}) {
    if (options.force) return true;
    if (isPerformanceBriefTestMode()) return true;
    return true;
}
