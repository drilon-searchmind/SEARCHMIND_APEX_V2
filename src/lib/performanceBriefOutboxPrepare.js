import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import connectToDatabase from "@root/lib/mongodb";
import PerformanceBriefOutbox from "@/models/PerformanceBriefOutbox";
import { listPerformanceBriefCronCustomers } from "@/lib/performanceBriefBulk";
import { generatePerformanceBrief } from "@/lib/performanceBriefMetrics";
import { formatPerformanceBriefSlack } from "@/lib/performanceBriefSlackPreview";
import { getPerformanceBriefWeekKey } from "@/lib/performanceBriefCronJob";
import { normalizeScheduleDayOfWeek, scheduleSendHour } from "@/lib/performanceBriefSchedule";
import {
    getCustomerDeliverySlot,
    getDeliveryContext,
    isPrepareWindowAllowed,
} from "@/lib/performanceBriefOutboxSchedule";
import { isPerformanceBriefTestMode } from "@/lib/performanceBriefOutboxConfig";

dayjs.extend(utc);
dayjs.extend(timezone);

const DEFAULT_TIME_BUDGET_MS = 230_000;
const BATCH_SAFETY_MARGIN_MS = 25_000;
const OUTBOX_TTL_DAYS = 14;
const DEFAULT_PREPARE_CONCURRENCY = 2;

function parseCronNumberEnv(name, fallback) {
    const raw = process.env[name];
    if (raw == null || raw === "") return fallback;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

function getTimeBudgetMs() {
    return parseCronNumberEnv("PERFORMANCE_BRIEF_CRON_TIME_BUDGET_MS", DEFAULT_TIME_BUDGET_MS);
}

function getPrepareConcurrency() {
    return parseCronNumberEnv("PERFORMANCE_BRIEF_PREPARE_CONCURRENCY", DEFAULT_PREPARE_CONCURRENCY);
}

function buildNextStep(phase, remaining, manual) {
    if (remaining <= 0) {
        return manual
            ? "Complete. Run deliver/manual when ready."
            : "Complete for this batch.";
    }
    return manual
        ? `${remaining} remaining — click Run again on prepare/manual, or wait for the every-10-min resume cron.`
        : `${remaining} remaining — next hourly prepare cron will resume automatically.`;
}

async function listCustomersForPrepare(ctx, options = {}) {
    let customers = await listPerformanceBriefCronCustomers();

    const testCustomerId = String(options.testCustomerId || "").trim();
    if (testCustomerId) {
        customers = customers.filter((c) => c.customerId === testCustomerId);
    }

    customers = customers.filter((c) => String(c.slackChannelId || "").trim());

    if (ctx.forceAllToday || ctx.testMode || ctx.manual || (options.force && options.skipSchedule)) {
        return customers;
    }

    const now = dayjs();
    return customers.flatMap((customer) => {
        const slot = getCustomerDeliverySlot(customer, now, ctx.timezone);
        if (!slot) return [];
        return [{ ...customer, ...slot }];
    });
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
    const scheduleDayOfWeek = normalizeScheduleDayOfWeek(customer.scheduleDayOfWeek);
    const scheduleHour = scheduleSendHour(customer.scheduleHour);
    const deliverDate = customer.deliverDate || ctx.deliveryDate;
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
                deliverDate,
                scheduleDayOfWeek,
                scheduleHour,
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

async function recordPrepareFailure(customer, { weekKey, ctx, message }) {
    await PerformanceBriefOutbox.findOneAndUpdate(
        { customerId: customer.customerId, weekKey },
        {
            $set: {
                customerId: customer.customerId,
                customerName: customer.customerName || "",
                weekKey,
                deliverDate: customer.deliverDate || ctx.deliveryDate,
                scheduleDayOfWeek: normalizeScheduleDayOfWeek(customer.scheduleDayOfWeek),
                scheduleHour: scheduleSendHour(customer.scheduleHour),
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

/**
 * Process customers in parallel until the time budget is exhausted.
 */
async function prepareCustomerBatch(todo, { weekKey, ctx, budget, startedAt }) {
    const concurrency = Math.min(getPrepareConcurrency(), todo.length);
    let cursor = 0;
    let prepared = 0;
    let failed = 0;
    const errors = [];

    const timeRemaining = () => Date.now() - startedAt < budget - BATCH_SAFETY_MARGIN_MS;

    async function worker() {
        while (timeRemaining()) {
            const index = cursor++;
            if (index >= todo.length) break;

            const customer = todo[index];
            try {
                await prepareOneCustomer(customer, { weekKey, ctx });
                prepared += 1;
            } catch (err) {
                failed += 1;
                const message = err?.message || String(err);
                errors.push({ customerId: customer.customerId, error: message });
                await recordPrepareFailure(customer, { weekKey, ctx, message });
            }
        }
    }

    await Promise.all(Array.from({ length: concurrency }, () => worker()));

    return { prepared, failed, errors };
}

/**
 * CRON A — generate briefs for customers due on the delivery day; store in outbox (no Slack).
 * Does NOT self-call — Vercel blocks same-deployment HTTP loops. Resume via hourly crons or re-run manual.
 */
export async function runPerformanceBriefPrepare(options = {}) {
    await connectToDatabase();

    const now = dayjs();
    const ctx = getDeliveryContext(now, { manual: options.manual });
    const weekKey = getPerformanceBriefWeekKey();
    const dueCustomers = await listCustomersForPrepare(ctx, options);
    const preparedIds = await listPreparedCustomerIds(weekKey);
    const todo = options.reprepare
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
            nextStep: buildNextStep("prepare", 0, options.manual),
        };
    }

    const budget = getTimeBudgetMs();
    const startedAt = Date.now();
    const { prepared, failed, errors } = await prepareCustomerBatch(todo, {
        weekKey,
        ctx,
        budget,
        startedAt,
    });

    const remaining = todo.length - prepared - failed;
    const timedOut = remaining > 0;

    console.info("[performance-brief/prepare]", {
        weekKey,
        testMode: isPerformanceBriefTestMode(),
        manual: options.manual,
        deliveryDate: ctx.deliveryDate,
        prepared,
        failed,
        remaining,
        timedOut,
        concurrency: getPrepareConcurrency(),
    });

    return {
        success: failed === 0,
        phase: "prepare",
        weekKey,
        deliveryContext: ctx,
        nextStep: buildNextStep("prepare", remaining, options.manual),
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
