import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import connectToDatabase from "@root/lib/mongodb";
import PerformanceBriefCronRun from "@/models/PerformanceBriefCronRun";
import PerformanceBriefSlackDelivery from "@/models/PerformanceBriefSlackDelivery";
import { listPerformanceBriefCronCustomers } from "@/lib/performanceBriefBulk";
import { generatePerformanceBrief } from "@/lib/performanceBriefMetrics";
import { formatPerformanceBriefSlack } from "@/lib/performanceBriefSlackPreview";
import { sendPerformanceBriefToSlack, listPerformanceBriefSlackChannels } from "@/lib/performanceBriefSlack";
import { buildPerformanceBriefWindows } from "@/lib/performanceBriefDates";
import { isCustomerScheduleDue } from "@/lib/performanceBriefSchedule";
import {
    tryClaimWeeklySlackDelivery,
    markWeeklySlackDeliverySent,
    markWeeklySlackDeliveryFailed,
} from "@/lib/performanceBriefSlackDelivery";

dayjs.extend(utc);
dayjs.extend(timezone);

const DEFAULT_TIME_BUDGET_MS = 240_000;
const CUSTOMER_STATUS = {
    pending: "pending",
    running: "running",
    success: "success",
    error: "error",
    skipped: "skipped",
};
const BATCH_LOCK_MS = 280_000;
const RUN_STATUS = {
    pending: "pending",
    running: "running",
    completed: "completed",
    failed: "failed",
};

function parseCronNumberEnv(name, fallback) {
    const raw = process.env[name];
    if (raw == null || raw === "") return fallback;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

function getTimeBudgetMs() {
    return parseCronNumberEnv("PERFORMANCE_BRIEF_CRON_TIME_BUDGET_MS", DEFAULT_TIME_BUDGET_MS);
}

function getCronTimezone() {
    return (process.env.PERFORMANCE_BRIEF_CRON_TZ || "Europe/Copenhagen").trim();
}

export function getPerformanceBriefWeekKey() {
    const windows = buildPerformanceBriefWindows();
    const week = String(windows.isoWeek).padStart(2, "0");
    return `${windows.isoWeekYear}-W${week}`;
}

async function listCustomersForCronTick(options = {}) {
    let customers = await listPerformanceBriefCronCustomers();
    customers = await applyTestOverrides(customers, options);

    if (options.testCustomerId) {
        return customers;
    }

    if (options.force || options.skipSchedule) {
        return customers;
    }

    const tz = getCronTimezone();
    const now = dayjs();
    return customers.filter((customer) => isCustomerScheduleDue(customer, now, tz));
}

function buildCronTickDiagnostics(customers, now = dayjs()) {
    const tz = getCronTimezone();
    const local = now.tz(tz);
    const dueCustomers = customers.filter((customer) => isCustomerScheduleDue(customer, now, tz));

    return {
        timezone: tz,
        localTime: local.format("YYYY-MM-DD HH:mm:ss"),
        localDay: local.day(),
        localHour: local.hour(),
        queueSize: customers.length,
        dueCount: dueCustomers.length,
        dueCustomers: dueCustomers.slice(0, 10).map((customer) => ({
            customerId: customer.customerId,
            customerName: customer.customerName,
            scheduleDayOfWeek: customer.scheduleDayOfWeek,
            scheduleHour: customer.scheduleHour,
            slackChannelName: customer.slackChannelName,
        })),
        sample: customers.slice(0, 5).map((customer) => ({
            customerId: customer.customerId,
            customerName: customer.customerName,
            scheduleDayOfWeek: customer.scheduleDayOfWeek,
            scheduleHour: customer.scheduleHour,
            due: isCustomerScheduleDue(customer, now, tz),
        })),
    };
}

function mergeDueCustomersIntoRun(run, dueCustomers) {
    const existingById = new Map(run.customers.map((c) => [c.customerId, c]));
    let changed = false;

    for (const customer of dueCustomers) {
        const existing = existingById.get(customer.customerId);
        if (!existing) {
            run.customers.push({
                customerId: customer.customerId,
                customerName: customer.customerName,
                slackChannelId: customer.slackChannelId,
                slackChannelName: customer.slackChannelName,
                status: CUSTOMER_STATUS.pending,
                error: "",
            });
            changed = true;
            continue;
        }

        existing.customerName = customer.customerName;
        existing.slackChannelId = customer.slackChannelId;
        existing.slackChannelName = customer.slackChannelName;
        if (
            existing.status === CUSTOMER_STATUS.success ||
            existing.status === CUSTOMER_STATUS.skipped ||
            existing.status === CUSTOMER_STATUS.error
        ) {
            existing.status = CUSTOMER_STATUS.pending;
            existing.error = "";
            existing.finishedAt = undefined;
            changed = true;
        }
    }

    if (changed) {
        run.stats = recomputeStats(run.customers);
    }

    return changed;
}

function getCronBaseUrl() {
    if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`;
    }
    return (process.env.APEX_RADAR_CRON_URL || "http://localhost:3000").replace(/\/$/, "");
}

function parseEnvBool(name) {
    const raw = (process.env[name] || "").trim().toLowerCase();
    return raw === "true" || raw === "1" || raw === "yes" || raw === "on";
}

/** Production cron sends; manual skipSchedule calls require explicit send=1 unless continuing a run. */
export function shouldSendSlackForCron(options = {}) {
    if (parseEnvBool("PERFORMANCE_BRIEF_CRON_DRY_RUN")) return false;
    if (options.dryRun) return false;
    if (options.skipSchedule && !options.send && !options.continue) return false;
    return true;
}

function recomputeStats(customers) {
    const total = customers.length;
    const success = customers.filter((c) => c.status === CUSTOMER_STATUS.success).length;
    const failed = customers.filter((c) => c.status === CUSTOMER_STATUS.error).length;
    const skipped = customers.filter((c) => c.status === CUSTOMER_STATUS.skipped).length;
    const pending = customers.filter(
        (c) => c.status === CUSTOMER_STATUS.pending || c.status === CUSTOMER_STATUS.running
    ).length;
    return { total, success, failed, skipped, pending };
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

async function applyTestOverrides(customers, options = {}) {
    let rows = [...customers];
    const testCustomerId = String(options.testCustomerId || "").trim();
    if (testCustomerId) {
        rows = rows.filter((c) => c.customerId === testCustomerId);
    }

    const testChannelName =
        String(options.testChannelName || process.env.PERFORMANCE_BRIEF_CRON_TEST_CHANNEL || "")
            .trim()
            .replace(/^#/, "");
    const testChannelId = String(options.testChannelId || "").trim();

    if (testChannelName || testChannelId) {
        let channelId = testChannelId;
        let channelName = testChannelName;
        if (!channelId && testChannelName) {
            const resolved = await resolveSlackChannelByName(testChannelName);
            if (!resolved) {
                throw new Error(`Test Slack channel not found: #${testChannelName}`);
            }
            channelId = resolved.id;
            channelName = resolved.name;
        }
        if (process.env.VERCEL && !options.testChannelName && !options.testChannelId) {
            console.warn(
                "[performance-brief/cron] PERFORMANCE_BRIEF_CRON_TEST_CHANNEL is set — all Slack posts will go to",
                channelName || channelId
            );
        }
        rows = rows.map((c) => ({
            ...c,
            slackChannelId: channelId,
            slackChannelName: channelName,
        }));
    }

    return rows;
}

async function tryAcquireRunBatchLock(runId) {
    const until = new Date(Date.now() + BATCH_LOCK_MS);
    const run = await PerformanceBriefCronRun.findOneAndUpdate(
        {
            _id: runId,
            $or: [
                { batchLockUntil: { $exists: false } },
                { batchLockUntil: null },
                { batchLockUntil: { $lte: new Date() } },
            ],
        },
        { $set: { batchLockUntil: until } },
        { new: true }
    );
    return run;
}

async function releaseRunBatchLock(runId) {
    await PerformanceBriefCronRun.updateOne({ _id: runId }, { $set: { batchLockUntil: null } });
}

async function syncCustomersFromDeliveries(run) {
    const deliveries = await PerformanceBriefSlackDelivery.find({ weekKey: run.weekKey })
        .select("customerId slackChannelId status messageTs")
        .lean();
    const sentByKey = new Map(
        deliveries
            .filter((d) => d.status === "sent")
            .map((d) => [`${d.customerId}:${d.slackChannelId}`, d])
    );

    let changed = false;
    for (const row of run.customers) {
        const key = `${row.customerId}:${row.slackChannelId}`;
        const sent = sentByKey.get(key);
        if (!sent) continue;
        if (row.status === CUSTOMER_STATUS.success || row.status === CUSTOMER_STATUS.skipped) {
            continue;
        }
        row.status = CUSTOMER_STATUS.skipped;
        row.error = "";
        row.finishedAt = row.finishedAt || new Date();
        changed = true;
    }

    if (changed) {
        run.stats = recomputeStats(run.customers);
        await run.save();
    }
}

/**
 * Generate brief + post to Slack for one customer.
 */
export async function runPerformanceBriefForCustomer({
    customerId,
    slackChannelId,
    slackChannelName,
    weekKey,
    runId,
    sendSlack = true,
}) {
    const channelId = String(slackChannelId || "").trim();
    if (!channelId) {
        return { success: false, error: "No Slack channel assigned for this customer." };
    }

    let deliveryId = null;
    if (sendSlack && weekKey) {
        const claim = await tryClaimWeeklySlackDelivery({
            weekKey,
            customerId,
            slackChannelId: channelId,
            slackChannelName,
            runId,
        });
        if (!claim.claim) {
            if (claim.reason === "already_sent") {
                return {
                    success: true,
                    skipped: true,
                    reason: "already_sent",
                    channelName: slackChannelName,
                    messageTs: claim.messageTs || "",
                };
            }
            if (claim.reason === "in_progress") {
                return {
                    success: false,
                    skipped: true,
                    reason: "in_progress",
                    error: "Another batch is sending this brief.",
                };
            }
            return { success: false, error: claim.reason || "Could not claim delivery slot." };
        }
        deliveryId = claim.deliveryId;
    }

    try {
        const brief = await generatePerformanceBrief(customerId);
        const slackPreview = formatPerformanceBriefSlack({
            compact: {
                customer: brief.customer,
                windows: brief.windows,
                meta: brief.meta,
                google: brief.google,
                accountIntent: brief.accountIntent,
            },
            narrative: brief.narrative,
            channelName: slackChannelName || "",
            customerId,
        });

        if (!sendSlack) {
            return {
                success: true,
                dryRun: true,
                channelName: slackChannelName,
            };
        }

        const result = await sendPerformanceBriefToSlack({
            payload: slackPreview,
            channelId,
            channelName: slackChannelName,
        });

        if (!result.success) {
            await markWeeklySlackDeliveryFailed(deliveryId, result.error || "Slack send failed");
            return { success: false, error: result.error || "Slack send failed" };
        }

        await markWeeklySlackDeliverySent(deliveryId, {
            messageTs: result.messageTs,
            channelName: result.channelName || slackChannelName,
        });

        return {
            success: true,
            channelName: result.channelName || slackChannelName,
            messageTs: result.messageTs,
        };
    } catch (err) {
        if (deliveryId) {
            await markWeeklySlackDeliveryFailed(deliveryId, err?.message || "Failed");
        }
        throw err;
    }
}

async function triggerContinuation(runId) {
    const secret = (process.env.CRON_SECRET || "").trim();
    if (!secret) {
        console.error("[performance-brief/cron] CRON_SECRET missing; cannot chain continuation.");
        return;
    }

    const url = `${getCronBaseUrl()}/api/cron/performance-brief?runId=${encodeURIComponent(
        runId
    )}&continue=1&skipSchedule=1`;

    fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${secret}` },
    }).catch((err) => {
        console.error("[performance-brief/cron] continuation fetch failed:", err);
    });
}

async function loadRunById(runId) {
    if (!runId) return null;
    return PerformanceBriefCronRun.findById(runId);
}

async function loadRunByWeekKey(weekKey) {
    return PerformanceBriefCronRun.findOne({ weekKey });
}

async function createRunForWeek(weekKey, customers) {
    const rows = customers.map((c) => ({
        customerId: c.customerId,
        customerName: c.customerName,
        slackChannelId: c.slackChannelId,
        slackChannelName: c.slackChannelName,
        status: CUSTOMER_STATUS.pending,
        error: "",
    }));

    const stats = recomputeStats(rows);

    return PerformanceBriefCronRun.create({
        weekKey,
        status: RUN_STATUS.running,
        startedAt: new Date(),
        customers: rows,
        stats,
    });
}

async function resetRunForForce(run) {
    await PerformanceBriefSlackDelivery.deleteMany({ weekKey: run.weekKey });
    for (const row of run.customers) {
        row.status = CUSTOMER_STATUS.pending;
        row.error = "";
        row.finishedAt = undefined;
    }
    run.status = RUN_STATUS.running;
    run.startedAt = new Date();
    run.finishedAt = undefined;
    run.batchLockUntil = null;
    run.stats = recomputeStats(run.customers);
    await run.save();
    return run;
}

/** Re-run a single test customer without resetting the full weekly run. */
async function resetTestCustomerInRun(run, testCustomer) {
    await PerformanceBriefSlackDelivery.deleteMany({
        weekKey: run.weekKey,
        customerId: testCustomer.customerId,
        slackChannelId: testCustomer.slackChannelId,
    });

    const row = run.customers.find((c) => c.customerId === testCustomer.customerId);
    if (row) {
        row.customerName = testCustomer.customerName;
        row.slackChannelId = testCustomer.slackChannelId;
        row.slackChannelName = testCustomer.slackChannelName;
        row.status = CUSTOMER_STATUS.pending;
        row.error = "";
        row.finishedAt = undefined;
    } else {
        run.customers.push({
            customerId: testCustomer.customerId,
            customerName: testCustomer.customerName,
            slackChannelId: testCustomer.slackChannelId,
            slackChannelName: testCustomer.slackChannelName,
            status: CUSTOMER_STATUS.pending,
            error: "",
        });
    }

    run.status = RUN_STATUS.running;
    run.finishedAt = undefined;
    run.batchLockUntil = null;
    run.stats = recomputeStats(run.customers);
    await run.save();
    return run;
}

async function refreshRunCustomersFromQueue(run) {
    const queue = await listPerformanceBriefCronCustomers();
    const queueById = new Map(queue.map((c) => [c.customerId, c]));
    const existingById = new Map(run.customers.map((c) => [c.customerId, c]));

    const merged = queue.map((c) => {
        const existing = existingById.get(c.customerId);
        if (
            existing &&
            (existing.status === CUSTOMER_STATUS.success ||
                existing.status === CUSTOMER_STATUS.skipped)
        ) {
            return existing;
        }
        if (existing) {
            existing.customerName = c.customerName;
            existing.slackChannelId = c.slackChannelId;
            existing.slackChannelName = c.slackChannelName;
            if (existing.status !== CUSTOMER_STATUS.success) {
                existing.status = CUSTOMER_STATUS.pending;
                existing.error = "";
                existing.finishedAt = undefined;
            }
            return existing;
        }
        return {
            customerId: c.customerId,
            customerName: c.customerName,
            slackChannelId: c.slackChannelId,
            slackChannelName: c.slackChannelName,
            status: CUSTOMER_STATUS.pending,
            error: "",
        };
    });

    run.customers = merged;
    run.stats = recomputeStats(run.customers);
    await run.save();
    return run;
}

async function resolveRun({ weekKey, runId, force, tickOptions = {} }) {
    if (runId) {
        const byId = await loadRunById(runId);
        if (byId) return byId;
    }

    const queue = await listPerformanceBriefCronCustomers();
    const dueCustomers = await listCustomersForCronTick(tickOptions);
    if (!dueCustomers.length) {
        const diagnostics = buildCronTickDiagnostics(
            tickOptions.testCustomerId
                ? await applyTestOverrides(queue, tickOptions)
                : queue
        );
        const reason =
            diagnostics.queueSize === 0 ? "empty_queue" : "no_matching_schedule";
        const testChannelEnv = String(
            process.env.PERFORMANCE_BRIEF_CRON_TEST_CHANNEL || ""
        ).trim();
        console.info("[performance-brief/cron] no_due_customers", {
            reason,
            testChannelEnvOverride: testChannelEnv || null,
            ...diagnostics,
        });
        return { skipped: true, reason, weekKey, diagnostics };
    }

    let run = await loadRunByWeekKey(weekKey);

    if (!run) {
        run = await createRunForWeek(weekKey, dueCustomers);
        return run;
    }

    if (force && tickOptions.testCustomerId && dueCustomers.length) {
        return resetTestCustomerInRun(run, dueCustomers[0]);
    }

    if (run && force) {
        return resetRunForForce(run);
    }

    await syncCustomersFromDeliveries(run);
    mergeDueCustomersIntoRun(run, dueCustomers);

    const dueIds = new Set(dueCustomers.map((customer) => customer.customerId));
    const pendingRemain = run.customers.some(
        (customer) =>
            dueIds.has(customer.customerId) &&
            (customer.status === CUSTOMER_STATUS.pending ||
                customer.status === CUSTOMER_STATUS.running)
    );

    if (
        !pendingRemain &&
        !force &&
        (run.status === RUN_STATUS.completed || run.status === RUN_STATUS.failed)
    ) {
        const diagnostics = buildCronTickDiagnostics(queue);
        console.info("[performance-brief/cron] already_completed", {
            weekKey,
            dueCount: dueCustomers.length,
            diagnostics,
        });
        return {
            skipped: true,
            reason: "already_completed",
            weekKey,
            run,
            dueCount: dueCustomers.length,
            diagnostics,
        };
    }

    run.status = RUN_STATUS.running;
    run.stats = recomputeStats(run.customers);
    await run.save();
    return run;
}

async function processRunBatch(run, { timeBudgetMs = getTimeBudgetMs(), sendSlack = true } = {}) {
    const runId = String(run._id);
    const lockedRun = await tryAcquireRunBatchLock(runId);
    if (!lockedRun) {
        return {
            runId,
            weekKey: run.weekKey,
            status: run.status,
            stats: run.stats,
            processed: [],
            chained: false,
            skipped: true,
            reason: "batch_locked",
        };
    }

    const started = Date.now();
    const results = [];

    try {
        await syncCustomersFromDeliveries(lockedRun);
        lockedRun.status = RUN_STATUS.running;
        await lockedRun.save();

        while (Date.now() - started < timeBudgetMs) {
            const next = lockedRun.customers.find((c) => c.status === CUSTOMER_STATUS.pending);
            if (!next) break;

            next.status = CUSTOMER_STATUS.running;
            next.error = "";
            await lockedRun.save();

            const base = {
                customerId: next.customerId,
                customerName: next.customerName,
            };

            try {
                const outcome = await runPerformanceBriefForCustomer({
                    customerId: next.customerId,
                    slackChannelId: next.slackChannelId,
                    slackChannelName: next.slackChannelName,
                    weekKey: lockedRun.weekKey,
                    runId,
                    sendSlack,
                });

                if (outcome.skipped && outcome.reason === "in_progress") {
                    next.status = CUSTOMER_STATUS.pending;
                    next.error = "";
                    results.push({ ...base, success: false, skipped: true, reason: "in_progress" });
                    await lockedRun.save();
                    continue;
                }

                if (!outcome.success) {
                    next.status = CUSTOMER_STATUS.error;
                    next.error = outcome.error || "Failed";
                    results.push({ ...base, success: false, error: next.error });
                } else if (outcome.skipped && outcome.reason === "already_sent") {
                    next.status = CUSTOMER_STATUS.skipped;
                    next.error = "";
                    results.push({
                        ...base,
                        success: true,
                        skipped: true,
                        reason: "already_sent",
                        channelName: outcome.channelName,
                    });
                } else {
                    next.status = CUSTOMER_STATUS.success;
                    next.error = "";
                    results.push({
                        ...base,
                        success: true,
                        dryRun: Boolean(outcome.dryRun),
                        channelName: outcome.channelName,
                    });
                }
            } catch (err) {
                next.status = CUSTOMER_STATUS.error;
                next.error = err?.message || "Failed";
                results.push({ ...base, success: false, error: next.error });
            }

            next.finishedAt = new Date();
            lockedRun.stats = recomputeStats(lockedRun.customers);
            await lockedRun.save();
        }

        const pendingRemain = lockedRun.customers.some(
            (c) => c.status === CUSTOMER_STATUS.pending || c.status === CUSTOMER_STATUS.running
        );

        if (!pendingRemain) {
            lockedRun.status = lockedRun.stats.failed > 0 ? RUN_STATUS.failed : RUN_STATUS.completed;
            lockedRun.finishedAt = new Date();
            await lockedRun.save();
        } else {
            await triggerContinuation(runId);
        }

        return {
            runId,
            weekKey: lockedRun.weekKey,
            status: lockedRun.status,
            stats: lockedRun.stats,
            processed: results,
            chained: pendingRemain,
            dryRun: !sendSlack,
        };
    } finally {
        await releaseRunBatchLock(runId);
    }
}

/**
 * @param {{
 *   runId?: string,
 *   continue?: boolean,
 *   force?: boolean,
 *   skipSchedule?: boolean,
 *   send?: boolean,
 *   dryRun?: boolean,
 *   testCustomerId?: string,
 *   testChannelName?: string,
 *   testChannelId?: string,
 * }} [options]
 */
export async function runPerformanceBriefCron(options = {}) {
    await connectToDatabase();

    const weekKey = getPerformanceBriefWeekKey();
    const isContinue = Boolean(options.continue);
    const force = Boolean(options.force);
    const skipSchedule = Boolean(options.skipSchedule);
    const sendSlack = shouldSendSlackForCron(options);
    const tickOptions = {
        testCustomerId: options.testCustomerId,
        testChannelName: options.testChannelName,
        testChannelId: options.testChannelId,
        skipSchedule,
        force,
    };

    if (isContinue) {
        const run = await loadRunById(options.runId);
        if (!run) {
            return { success: false, error: "Run not found", runId: options.runId || null };
        }
        await syncCustomersFromDeliveries(run);
        if (run.status === RUN_STATUS.completed || run.status === RUN_STATUS.failed) {
            const pendingRemain = run.stats?.pending > 0;
            if (!pendingRemain) {
                return {
                    success: run.stats?.failed === 0,
                    skipped: true,
                    reason: "run_finished",
                    runId: String(run._id),
                    weekKey: run.weekKey,
                    stats: run.stats,
                };
            }
        }
        const batch = await processRunBatch(run, { sendSlack });
        if (batch.skipped) {
            return { success: true, ...batch };
        }
        return {
            success: batch.stats.failed === 0,
            ...batch,
        };
    }

    const resolved = await resolveRun({ weekKey, runId: options.runId, force, tickOptions });

    if (resolved?.skipped) {
        return {
            success: true,
            skipped: true,
            reason: resolved.reason,
            weekKey: resolved.weekKey,
            runId: resolved.run ? String(resolved.run._id) : null,
            stats: resolved.run?.stats || null,
            dryRun: !sendSlack,
            timezone: getCronTimezone(),
        };
    }

    if (force && resolved?.customers && !tickOptions.testCustomerId) {
        await refreshRunCustomersFromQueue(resolved);
    }

    const batch = await processRunBatch(resolved, { sendSlack });
    if (batch.skipped) {
        return { success: true, ...batch };
    }
    return {
        success: batch.stats.failed === 0,
        ...batch,
    };
}
