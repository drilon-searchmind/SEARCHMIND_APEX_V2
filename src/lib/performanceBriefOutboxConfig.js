/**
 * Single switch for Performance Brief outbox crons (prepare + deliver).
 *
 * PERFORMANCE_BRIEF_TEST_MODE=true  → scheduled crons: all customers, delivery day = tomorrow, #apex-test-cron
 * PERFORMANCE_BRIEF_TEST_MODE=false → production: per-customer schedule + real channels
 *
 * PERFORMANCE_BRIEF_FORCE_ALL_TODAY=true → one-day override on the scheduled crons:
 *   all Slack customers, delivery day = today, ignore 4-hour slots, real customer channels.
 *   Turn it off the same day. Each customer is still sent only once per week.
 *
 * Manual run (?manual=1&force=1): all customers, delivery day = today, #apex-test-cron — no env change needed
 */
export const TEST_SLACK_CHANNEL_NAME = "apex-test-cron";

/** How many hours before a customer's send time prepare may start. */
export const DEFAULT_PREPARE_LEAD_HOURS = 4;

/** CRON A (Prepare): 04:00 Europe/Copenhagen on delivery day */
export const PREPARE_HOUR_COPENHAGEN = 4;

export function getPrepareLeadHours() {
    const raw = process.env.PERFORMANCE_BRIEF_PREPARE_LEAD_HOURS;
    if (raw == null || raw === "") return DEFAULT_PREPARE_LEAD_HOURS;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return DEFAULT_PREPARE_LEAD_HOURS;
    return Math.trunc(n);
}

export const OUTBOX_CRON_TZ = "Europe/Copenhagen";

function isEnvFlagOn(name) {
    const flag = (process.env[name] || "false").trim().toLowerCase();
    return flag === "true" || flag === "1" || flag === "yes" || flag === "on";
}

export function isPerformanceBriefTestMode() {
    return isEnvFlagOn("PERFORMANCE_BRIEF_TEST_MODE");
}

/** Scheduled crons: everyone today, real Slack channels. Does not repeat a sent brief. */
export function isPerformanceBriefForceAllToday() {
    return isEnvFlagOn("PERFORMANCE_BRIEF_FORCE_ALL_TODAY");
}

export function isPerformanceBriefOutboxDryRun() {
    return isEnvFlagOn("PERFORMANCE_BRIEF_CRON_DRY_RUN");
}
