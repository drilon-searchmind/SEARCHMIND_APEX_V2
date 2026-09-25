import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import {
    getPrepareLeadHours,
    isPerformanceBriefForceAllToday,
    isPerformanceBriefTestMode,
    PREPARE_HOUR_COPENHAGEN,
    OUTBOX_CRON_TZ,
} from "@/lib/performanceBriefOutboxConfig";
import {
    normalizeScheduleDayOfWeek,
    scheduleSendHour,
    SCHEDULE_SLOT_HOURS,
} from "@/lib/performanceBriefSchedule";

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * @typedef {Object} DeliveryContext
 * @property {boolean} testMode
 * @property {boolean} forceAllToday
 * @property {boolean} manual
 * @property {boolean} useTestChannel post to #apex-test-cron
 * @property {string} timezone
 * @property {string} nowLocal
 * @property {string} deliveryDate YYYY-MM-DD (Copenhagen)
 * @property {number} deliveryDayOfWeek 0–6
 */

/**
 * Production: delivery day = today (prepare at 04:00, deliver in 4-hour slots same day).
 * Test mode (env): delivery day = tomorrow; all Slack customers; #apex-test-cron.
 * Force all today (env): delivery day = today; all Slack customers; real channels.
 * Manual (?manual=1): delivery day = today; all Slack customers; #apex-test-cron; run now.
 * @param {import("dayjs").Dayjs} [now]
 * @param {{ manual?: boolean }} [options]
 * @returns {DeliveryContext}
 */
export function getDeliveryContext(now = dayjs(), options = {}) {
    const manual = Boolean(options.manual);
    const testMode = isPerformanceBriefTestMode();
    const forceAllToday = isPerformanceBriefForceAllToday();
    const timezoneName = OUTBOX_CRON_TZ;
    const local = now.tz(timezoneName);

    let deliveryLocal = local;
    if (manual || forceAllToday) {
        deliveryLocal = local;
    } else if (testMode) {
        deliveryLocal = local.add(1, "day");
    }

    return {
        testMode,
        forceAllToday,
        manual,
        useTestChannel: (manual || testMode) && !forceAllToday,
        timezone: timezoneName,
        nowLocal: local.format("YYYY-MM-DD HH:mm:ss"),
        deliveryDate: deliveryLocal.format("YYYY-MM-DD"),
        deliveryDayOfWeek: deliveryLocal.day(),
    };
}

export function isCustomerScheduledForDeliveryDay(customer, ctx) {
    return normalizeScheduleDayOfWeek(customer.scheduleDayOfWeek) === ctx.deliveryDayOfWeek;
}

/**
 * Active when now is inside [send time − lead hours, send time + slot length).
 * Monday 10:00 with a 4-hour lead prepares from Monday 06:00 until 14:00.
 * @returns {{ deliverDate: string, scheduleDayOfWeek: number, scheduleHour: number } | null}
 */
export function getCustomerDeliverySlot(customer, now = dayjs(), timezoneName = OUTBOX_CRON_TZ) {
    const scheduleDayOfWeek = normalizeScheduleDayOfWeek(customer.scheduleDayOfWeek);
    const scheduleHour = scheduleSendHour(customer.scheduleHour);
    const leadHours = getPrepareLeadHours();
    const local = now.tz(timezoneName);
    const thisWeek = local
        .clone()
        .day(scheduleDayOfWeek)
        .hour(scheduleHour)
        .minute(0)
        .second(0)
        .millisecond(0);
    const candidates = [
        thisWeek.clone().subtract(7, "day"),
        thisWeek.clone(),
        thisWeek.clone().add(7, "day"),
    ];

    for (const slotStart of candidates) {
        const windowStart = slotStart.clone().subtract(leadHours, "hour");
        const windowEnd = slotStart.clone().add(SCHEDULE_SLOT_HOURS, "hour");
        const started = local.isAfter(windowStart) || local.isSame(windowStart);
        if (started && local.isBefore(windowEnd)) {
            return {
                deliverDate: slotStart.format("YYYY-MM-DD"),
                scheduleDayOfWeek,
                scheduleHour,
            };
        }
    }

    return null;
}

/**
 * Whether the current clock falls in this customer's 4-hour delivery slot on the delivery date.
 * @param {{ scheduleHour?: number }} customer
 * @param {import("dayjs").Dayjs} [now]
 * @param {DeliveryContext} ctx
 */
export function isCustomerInDeliverySlot(customer, now = dayjs(), ctx) {
    const scheduleHour = scheduleSendHour(customer.scheduleHour);
    const local = now.tz(ctx.timezone);
    if (local.format("YYYY-MM-DD") !== ctx.deliveryDate) return false;

    const hour = local.hour();
    return hour >= scheduleHour && hour < scheduleHour + SCHEDULE_SLOT_HOURS;
}

/**
 * CRON A window: 04:00 Copenhagen on delivery day. Test mode + force bypass the hour check.
 * @param {import("dayjs").Dayjs} [now]
 * @param {{ force?: boolean, hasBacklog?: boolean }} [options]
 */
export function isPrepareWindowAllowed(now = dayjs(), options = {}) {
    if (options.force) return true;
    if (options.manual) return true;
    if (isPerformanceBriefTestMode()) return true;

    const local = now.tz(OUTBOX_CRON_TZ);
    if (local.hour() === PREPARE_HOUR_COPENHAGEN) return true;

    const ctx = getDeliveryContext(now);
    // Hourly resume crons (02–06 UTC ≈ 04:00–08:00 Copenhagen) drain prepare backlog.
    if (
        options.hasBacklog &&
        local.format("YYYY-MM-DD") === ctx.deliveryDate &&
        local.hour() >= PREPARE_HOUR_COPENHAGEN &&
        local.hour() <= PREPARE_HOUR_COPENHAGEN + 6
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
