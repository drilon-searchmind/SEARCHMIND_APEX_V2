import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import connectToDatabase from "@root/lib/mongodb";
import PerformanceBriefOutbox from "@/models/PerformanceBriefOutbox";
import { getPerformanceBriefWeekKey } from "@/lib/performanceBriefCronJob";
import {
    sendPerformanceBriefToSlack,
    listPerformanceBriefSlackChannels,
} from "@/lib/performanceBriefSlack";
import {
    tryClaimWeeklySlackDelivery,
    markWeeklySlackDeliverySent,
    markWeeklySlackDeliveryFailed,
} from "@/lib/performanceBriefSlackDelivery";
import {
    getDeliveryContext,
    isCustomerInDeliverySlot,
    isDeliverWindowAllowed,
} from "@/lib/performanceBriefOutboxSchedule";
import {
    isPerformanceBriefTestMode,
    isPerformanceBriefOutboxDryRun,
    TEST_SLACK_CHANNEL_NAME,
} from "@/lib/performanceBriefOutboxConfig";

dayjs.extend(utc);
dayjs.extend(timezone);

const DEFAULT_TIME_BUDGET_MS = 230_000;
const BATCH_SAFETY_MARGIN_MS = 10_000;

function parseCronNumberEnv(name, fallback) {
    const raw = process.env[name];
    if (raw == null || raw === "") return fallback;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

function getTimeBudgetMs() {
    return parseCronNumberEnv("PERFORMANCE_BRIEF_CRON_TIME_BUDGET_MS", DEFAULT_TIME_BUDGET_MS);
}

async function resolveSlackChannelByName(channelName) {
    const target = String(channelName || "")
        .trim()
        .replace(/^#/, "")
        .toLowerCase();
    if (!target) return null;
    const channels = await listPerformanceBriefSlackChannels();
    return (
        channels.find((c) => String(c.name || "").toLowerCase() === target) ||
        channels.find((c) => String(c.name || "").toLowerCase().includes(target)) ||
        null
    );
}

let cachedTestChannel = null;

async function getTestSlackChannel() {
    if (cachedTestChannel) return cachedTestChannel;
    const resolved = await resolveSlackChannelByName(TEST_SLACK_CHANNEL_NAME);
    if (!resolved) {
        throw new Error(`Test Slack channel not found: #${TEST_SLACK_CHANNEL_NAME}`);
    }
    cachedTestChannel = resolved;
    return resolved;
}

function filterItemsForCurrentSlot(items, now, ctx, options = {}) {
    if (ctx.forceAllToday || ctx.testMode || ctx.manual || options.skipSchedule) {
        return items;
    }

    const local = now.tz(ctx.timezone);
    if (local.format("YYYY-MM-DD") !== ctx.deliveryDate) return [];

    const hour = local.hour();
    return items.filter((item) => {
        if (options.force) {
            return hour >= Number(item.scheduleHour || 0);
        }
        return isCustomerInDeliverySlot({ scheduleHour: item.scheduleHour }, now, ctx);
    });
}

/**
 * CRON B — post ready outbox items to Slack for the current 4-hour slot (fast; no generation).
 */
export async function runPerformanceBriefDeliver(options = {}) {
    await connectToDatabase();

    const now = dayjs();
    const ctx = getDeliveryContext(now, { manual: options.manual });
    const weekKey = getPerformanceBriefWeekKey();
    const dryRun = options.dryRun ?? isPerformanceBriefOutboxDryRun();

    if (!isDeliverWindowAllowed(now, { force: options.force })) {
        return {
            skipped: true,
            phase: "deliver",
            reason: "outside_deliver_window",
            weekKey,
            deliveryContext: ctx,
        };
    }

    const testCustomerId = String(options.testCustomerId || "").trim();
    const query = {
        weekKey,
        deliverDate: ctx.deliveryDate,
        status: "ready",
    };
    if (testCustomerId) {
        query.customerId = testCustomerId;
    }

    let items = await PerformanceBriefOutbox.find(query).sort({ scheduleHour: 1 }).lean();
    items = filterItemsForCurrentSlot(items, now, ctx, options);

    if (!items.length) {
        return {
            skipped: true,
            phase: "deliver",
            reason: "no_ready_items",
            weekKey,
            deliveryContext: ctx,
        };
    }

    const testChannel = ctx.useTestChannel ? await getTestSlackChannel() : null;
    const skipDedup = Boolean(options.manual && options.force);
    const budget = getTimeBudgetMs();
    const startedAt = Date.now();
    let sent = 0;
    let skipped = 0;
    let failed = 0;
    const results = [];

    for (const item of items) {
        if (Date.now() - startedAt > budget - BATCH_SAFETY_MARGIN_MS) {
            break;
        }

        const channelId = testChannel ? testChannel.id : item.slackChannelId;
        const channelName = testChannel ? testChannel.name : item.slackChannelName;

        if (!channelId) {
            failed += 1;
            results.push({
                customerId: item.customerId,
                success: false,
                error: "No Slack channel assigned.",
            });
            continue;
        }

        if (dryRun) {
            sent += 1;
            results.push({
                customerId: item.customerId,
                success: true,
                dryRun: true,
                channelName,
            });
            continue;
        }

        let deliveryId = null;

        if (!skipDedup) {
            const claim = await tryClaimWeeklySlackDelivery({
                weekKey,
                customerId: item.customerId,
                slackChannelId: channelId,
                slackChannelName: channelName,
            });

            if (!claim.claim) {
                skipped += 1;
                if (claim.reason === "already_sent") {
                    await PerformanceBriefOutbox.updateOne(
                        { _id: item._id },
                        {
                            $set: {
                                status: "sent",
                                sentAt: new Date(),
                                messageTs: claim.messageTs || "",
                            },
                        }
                    );
                }
                results.push({
                    customerId: item.customerId,
                    success: true,
                    skipped: true,
                    reason: claim.reason,
                });
                continue;
            }
            deliveryId = claim.deliveryId;
        }

        try {
            const result = await sendPerformanceBriefToSlack({
                payload: item.slackPayload,
                channelId,
                channelName,
            });

            if (!result.success) {
                failed += 1;
                if (deliveryId) {
                    await markWeeklySlackDeliveryFailed(deliveryId, result.error);
                }
                await PerformanceBriefOutbox.updateOne(
                    { _id: item._id },
                    { $set: { status: "failed", error: result.error || "Slack send failed" } }
                );
                results.push({
                    customerId: item.customerId,
                    success: false,
                    error: result.error,
                });
                continue;
            }

            if (deliveryId) {
                await markWeeklySlackDeliverySent(deliveryId, {
                    messageTs: result.messageTs,
                    channelName: result.channelName,
                });
            }
            await PerformanceBriefOutbox.updateOne(
                { _id: item._id },
                {
                    $set: {
                        status: "sent",
                        sentAt: new Date(),
                        messageTs: result.messageTs || "",
                        error: "",
                    },
                }
            );
            sent += 1;
            results.push({
                customerId: item.customerId,
                success: true,
                channelName: result.channelName,
                messageTs: result.messageTs,
            });
        } catch (err) {
            failed += 1;
            const message = err?.message || String(err);
            if (deliveryId) {
                await markWeeklySlackDeliveryFailed(deliveryId, message);
            }
            await PerformanceBriefOutbox.updateOne(
                { _id: item._id },
                { $set: { status: "failed", error: message } }
            );
            results.push({ customerId: item.customerId, success: false, error: message });
        }
    }

    const remaining = items.length - sent - skipped - failed;
    const timedOut = remaining > 0;
    const nextStep =
        remaining <= 0
            ? options.manual
                ? "Deliver complete."
                : "Deliver complete for this batch."
            : options.manual
              ? `${remaining} remaining — click Run again on deliver/manual, or wait for the every-10-min resume cron.`
              : `${remaining} remaining — next deliver cron will resume.`;

    console.info("[performance-brief/deliver]", {
        weekKey,
        testMode: isPerformanceBriefTestMode(),
        manual: options.manual,
        deliveryDate: ctx.deliveryDate,
        dryRun,
        sent,
        skipped,
        failed,
        remaining,
        timedOut,
        testChannel: testChannel?.name || null,
    });

    return {
        success: failed === 0,
        phase: "deliver",
        weekKey,
        deliveryContext: ctx,
        dryRun,
        nextStep,
        testChannel: testChannel ? `#${testChannel.name}` : null,
        stats: {
            ready: items.length,
            sent,
            skipped,
            failed,
            remaining,
            timedOut,
        },
        results: results.slice(0, 20),
    };
}
