import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import connectToDatabase from "@root/lib/mongodb";
import PerformanceBriefOutbox from "@/models/PerformanceBriefOutbox";
import { listPerformanceBriefCronCustomers } from "@/lib/performanceBriefBulk";
import { generatePerformanceBrief } from "@/lib/performanceBriefMetrics";
import { formatPerformanceBriefSlack } from "@/lib/performanceBriefSlackPreview";
import { getPerformanceBriefWeekKey } from "@/lib/performanceBriefCronJob";
import { normalizePerformanceBriefSchedule } from "@/lib/performanceBriefSchedule";
import {
    getDeliveryContext,
    isCustomerScheduledForDeliveryDay,
    isPrepareWindowAllowed,
} from "@/lib/performanceBriefOutboxSchedule";
import { isPerformanceBriefTestMode } from "@/lib/performanceBriefOutboxConfig";
import { dispatchOutboxContinuation } from "@/lib/performanceBriefOutboxContinuation";

dayjs.extend(utc);
dayjs.extend(timezone);

const DEFAULT_TIME_BUDGET_MS = 230_000;
const BATCH_SAFETY_MARGIN_MS = 25_000;
const OUTBOX_TTL_DAYS = 14;

function parseCronNumberEnv(name, fallback) {
    const raw = process.env[name];
    if (raw == null || raw === "") return fallback;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

function getTimeBudgetMs() {
    return parseCronNumberEnv("PERFORMANCE_BRIEF_CRON_TIME_BUDGET_MS", DEFAULT_TIME_BUDGET_MS);
}

async function listCustomersForPrepare(ctx, options = {}) {
    let customers = await listPerformanceBriefCronCustomers();

    const testCustomerId = String(options.testCustomerId || "").trim();
    if (testCustomerId) {
        customers = customers.filter((c) => c.customerId === testCustomerId);
    }

    customers = customers.filter((c) => String(c.slackChannelId || "").trim());

    if (ctx.testMode || ctx.manual || (options.force && options.skipSchedule)) {
        return customers;
    }

    return customers.filter((c) => isCustomerScheduledForDeliveryDay(c, ctx));
}

async function listPreparedCustomerIds(weekKey) {
    const rows = await PerformanceBriefOutbox.find({
        weekKey,
        status: { $in: ["ready", "sent"] },
    })
        .select("customerId")
        .lean();
    return new Set(rows.map((row) => row.customerId));
}

async function prepareOneCustomer(customer, { weekKey, ctx }) {
    const schedule = normalizePerformanceBriefSchedule(customer);
    const brief = await generatePerformanceBrief(customer.customerId);
    const slackPayload = formatPerformanceBriefSlack({
        compact: {
            customer: brief.customer,
            windows: brief.windows,
            meta: brief.meta,
            google: brief.google,
            accountIntent: brief.accountIntent,
        },
        narrative: brief.narrative,
        channelName: customer.slackChannelName || "",
        customerId: customer.customerId,
    });

    await PerformanceBriefOutbox.findOneAndUpdate(
        { customerId: customer.customerId, weekKey },
        {
            $set: {
                customerId: customer.customerId,
                customerName: customer.customerName || "",
                weekKey,
                deliverDate: ctx.deliveryDate,
                scheduleDayOfWeek: schedule.scheduleDayOfWeek,
                scheduleHour: schedule.scheduleHour,
                slackChannelId: customer.slackChannelId,
                slackChannelName: customer.slackChannelName || "",
                slackPayload,
                status: "ready",
                testMode: ctx.useTestChannel,
                preparedAt: new Date(),
                sentAt: null,
                messageTs: "",
                error: "",
                expiresAt: dayjs().add(OUTBOX_TTL_DAYS, "day").toDate(),
            },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return { success: true, customerId: customer.customerId };
}

/**
 * CRON A — generate briefs for customers due on the delivery day; store in outbox (no Slack).
 */
export async function runPerformanceBriefPrepare(options = {}) {
    await connectToDatabase();

    const now = dayjs();
    const ctx = getDeliveryContext(now, { manual: options.manual });
    const weekKey = getPerformanceBriefWeekKey();
    const dueCustomers = await listCustomersForPrepare(ctx, options);
    const preparedIds = await listPreparedCustomerIds(weekKey);
    const chainDepth = Number(options.chainDepth || 0);
    // First manual batch may refresh all; continuations must skip already-prepared rows.
    const reprepareAll = Boolean(options.manual && options.force && chainDepth === 0);
    const todo = reprepareAll
        ? dueCustomers
        : dueCustomers.filter((c) => !preparedIds.has(c.customerId));
    const hasBacklog = todo.length > 0;

    if (!isPrepareWindowAllowed(now, { force: options.force, manual: options.manual, hasBacklog })) {
        return {
            skipped: true,
            phase: "prepare",
            reason: "outside_prepare_window",
            weekKey,
            deliveryContext: ctx,
            queueSize: dueCustomers.length,
            backlog: todo.length,
        };
    }

    if (!todo.length) {
        return {
            skipped: true,
            phase: "prepare",
            reason: dueCustomers.length ? "all_prepared" : "no_due_customers",
            weekKey,
            deliveryContext: ctx,
            queueSize: dueCustomers.length,
            preparedCount: preparedIds.size,
        };
    }

    const budget = getTimeBudgetMs();
    const startedAt = Date.now();
    let prepared = 0;
    let failed = 0;
    const errors = [];

    for (const customer of todo) {
        if (Date.now() - startedAt > budget - BATCH_SAFETY_MARGIN_MS) {
            break;
        }

        try {
            await prepareOneCustomer(customer, { weekKey, ctx });
            prepared += 1;
        } catch (err) {
            failed += 1;
            const message = err?.message || String(err);
            errors.push({ customerId: customer.customerId, error: message });
            await PerformanceBriefOutbox.findOneAndUpdate(
                { customerId: customer.customerId, weekKey },
                {
                    $set: {
                        customerId: customer.customerId,
                        customerName: customer.customerName || "",
                        weekKey,
                        deliverDate: ctx.deliveryDate,
                        scheduleDayOfWeek: customer.scheduleDayOfWeek,
                        scheduleHour: customer.scheduleHour,
                        slackChannelId: customer.slackChannelId,
                        slackChannelName: customer.slackChannelName || "",
                        status: "prepare_failed",
                        testMode: ctx.useTestChannel,
                        error: message,
                        expiresAt: dayjs().add(OUTBOX_TTL_DAYS, "day").toDate(),
                    },
                },
                { upsert: true }
            );
        }
    }

    const remaining = todo.length - prepared - failed;
    const timedOut = remaining > 0;

    let continued = false;
    if (timedOut && remaining > 0) {
        continued = dispatchOutboxContinuation("prepare", {
            manual: options.manual,
            chainDepth,
        });
    }

    console.info("[performance-brief/prepare]", {
        weekKey,
        testMode: isPerformanceBriefTestMode(),
        manual: options.manual,
        deliveryDate: ctx.deliveryDate,
        prepared,
        failed,
        remaining,
        timedOut,
        continued,
        chainDepth: options.chainDepth || 0,
    });

    return {
        success: failed === 0,
        phase: "prepare",
        weekKey,
        deliveryContext: ctx,
        continued,
        chainDepth: options.chainDepth || 0,
        stats: {
            queueSize: dueCustomers.length,
            todo: todo.length,
            prepared,
            failed,
            remaining,
            timedOut,
        },
        errors: errors.slice(0, 10),
    };
}
