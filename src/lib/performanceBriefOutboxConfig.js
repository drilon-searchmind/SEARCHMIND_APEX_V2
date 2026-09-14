/**
 * Single switch for Performance Brief outbox crons (prepare + deliver).
 *
 * PERFORMANCE_BRIEF_TEST_MODE=true  → all Slack-assigned customers run (ignore per-customer schedule day);
 *                                     delivery day = tomorrow; all Slack → #apex-test-cron
 * PERFORMANCE_BRIEF_TEST_MODE=false → production: same-day prepare + deliver; real channels
 */
export const TEST_SLACK_CHANNEL_NAME = "apex-test-cron";

/** CRON A (Prepare): 04:00 Europe/Copenhagen on delivery day */
export const PREPARE_HOUR_COPENHAGEN = 4;

export const OUTBOX_CRON_TZ = "Europe/Copenhagen";

export function isPerformanceBriefTestMode() {
    const flag = (process.env.PERFORMANCE_BRIEF_TEST_MODE || "false").trim().toLowerCase();
    return flag === "true" || flag === "1" || flag === "yes" || flag === "on";
}

export function isPerformanceBriefOutboxDryRun() {
    const flag = (process.env.PERFORMANCE_BRIEF_CRON_DRY_RUN || "false").trim().toLowerCase();
    return flag === "true" || flag === "1" || flag === "yes" || flag === "on";
}
