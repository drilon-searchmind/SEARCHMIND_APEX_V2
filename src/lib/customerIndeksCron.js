/**
 * Nightly Indeks runner: processes customers oldest-snapshot-first in time-budgeted batches.
 * Does NOT self-call (Vercel blocks same-deployment loops) — a frequent cron inside the night
 * window resumes where the previous run stopped (customers with a fresh snapshot are skipped).
 *
 * Env vars (all optional):
 *   CUSTOMER_INDEKS_CRON_ENABLED        default true
 *   CUSTOMER_INDEKS_BATCH_SIZE          customers per run, default 25
 *   CUSTOMER_INDEKS_CONCURRENCY         parallel customers, default 2
 *   CUSTOMER_INDEKS_TIME_BUDGET_MS      per-run budget, default 230000
 *   CUSTOMER_INDEKS_CUSTOMER_TIMEOUT_MS per-customer timeout, default 90000
 *   CUSTOMER_INDEKS_MIN_AGE_HOURS       skip snapshots newer than this, default 20
 *   CUSTOMER_INDEKS_ERROR_RETRY_MINUTES retry errored snapshots after this, default 120
 *   CUSTOMER_INDEKS_WINDOW_START_HOUR   Copenhagen hour the cron may start, default 1
 *   CUSTOMER_INDEKS_WINDOW_END_HOUR     Copenhagen hour (exclusive) it stops, default 6
 */
import dayjs from "dayjs";
import connectToDatabase from "@root/lib/mongodb";
import Customer from "@/models/Customer";
import CustomerIndeksSnapshot from "@/models/CustomerIndeksSnapshot";
import { isDemoCustomerId } from "@/lib/demoCustomer";
import {
    INDEKS_TIMEZONE,
    computeCustomerIndeks,
    getCustomerClickupId,
    todayKey,
} from "@/lib/customerIndeksCompute";

const SAFETY_MARGIN_MS = 25_000;
const HISTORY_MAX = 90;

function numEnv(name, fallback) {
    const raw = process.env[name];
    if (raw == null || raw === "") return fallback;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function isCustomerIndeksCronEnabled() {
    const flag = (process.env.CUSTOMER_INDEKS_CRON_ENABLED || "true").trim().toLowerCase();
    return flag !== "false" && flag !== "0" && flag !== "off";
}

/** Copenhagen night window guard for the scheduled cron (manual route bypasses it). */
export function isWithinIndeksWindow(now = dayjs()) {
    const start = numEnv("CUSTOMER_INDEKS_WINDOW_START_HOUR", 1);
    const end = numEnv("CUSTOMER_INDEKS_WINDOW_END_HOUR", 6);
    const hour = Number(dayjs(now).tz(INDEKS_TIMEZONE).format("H"));
    return hour >= start && hour < end;
}

async function listIndeksCustomers({ customerIds, clickupIds } = {}) {
    const filter = {
        isArchived: { $ne: true },
        "CustomerSettings.customerClickupID": { $nin: ["", null] },
    };
    if (customerIds?.length) filter._id = { $in: customerIds };
    if (clickupIds?.length) filter["CustomerSettings.customerClickupID"] = { $in: clickupIds };

    const docs = await Customer.find(filter).lean();
    return docs.filter(
        (c) => !isDemoCustomerId(String(c._id)) && getCustomerClickupId(c) !== ""
    );
}

function isDue(snapshot, now, { minAgeMs, errorRetryMs }) {
    if (!snapshot?.computedAt) return true;
    const age = now - new Date(snapshot.computedAt).getTime();
    return age >= (snapshot.status === "error" ? errorRetryMs : minAgeMs);
}

function withTimeout(promise, ms, label) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function buildHistory(existing, indeks) {
    const today = todayKey();
    const rest = (existing?.history || []).filter((h) => h.date !== today);
    rest.push({ date: today, indeks: indeks ?? null });
    return rest.slice(-HISTORY_MAX);
}

async function persistSnapshot(result, existing) {
    const now = new Date();
    const { customerId, ...fields } = result;
    await CustomerIndeksSnapshot.findOneAndUpdate(
        { customerId },
        {
            $set: {
                ...fields,
                customerId,
                computedAt: now,
                history: buildHistory(existing, result.indeks),
            },
        },
        { upsert: true, setDefaultsOnInsert: true }
    );
}

/**
 * @param {{
 *   customerIds?: string[],
 *   clickupIds?: string[],
 *   force?: boolean,        // ignore freshness
 *   all?: boolean,          // ignore batch size (still bounded by time budget)
 *   limit?: number,         // override batch size
 *   dryRun?: boolean,       // compute only, no DB writes
 * }} [options]
 */
export async function runCustomerIndeks(options = {}) {
    const startedAt = Date.now();
    await connectToDatabase();

    const budget = numEnv("CUSTOMER_INDEKS_TIME_BUDGET_MS", 230_000);
    const concurrency = numEnv("CUSTOMER_INDEKS_CONCURRENCY", 2);
    const customerTimeout = numEnv("CUSTOMER_INDEKS_CUSTOMER_TIMEOUT_MS", 90_000);
    const batchSize = options.limit > 0 ? options.limit : numEnv("CUSTOMER_INDEKS_BATCH_SIZE", 25);
    const thresholds = {
        minAgeMs: numEnv("CUSTOMER_INDEKS_MIN_AGE_HOURS", 20) * 3_600_000,
        errorRetryMs: numEnv("CUSTOMER_INDEKS_ERROR_RETRY_MINUTES", 120) * 60_000,
    };

    const customers = await listIndeksCustomers(options);
    const snapshots = await CustomerIndeksSnapshot.find({
        customerId: { $in: customers.map((c) => String(c._id)) },
    })
        .select("customerId computedAt status history")
        .lean();
    const snapshotById = new Map(snapshots.map((s) => [s.customerId, s]));

    const now = Date.now();
    const due = customers
        .filter((c) => options.force || isDue(snapshotById.get(String(c._id)), now, thresholds))
        .sort((a, b) => {
            const ta = snapshotById.get(String(a._id))?.computedAt;
            const tb = snapshotById.get(String(b._id))?.computedAt;
            return (ta ? new Date(ta).getTime() : 0) - (tb ? new Date(tb).getTime() : 0);
        });

    const todo = options.all ? due : due.slice(0, batchSize);
    const stats = { processed: 0, ok: 0, no_data: 0, insufficient_history: 0, errors: 0 };
    /** @type {object[]} */
    const results = [];
    let cursor = 0;

    const hasTime = () => Date.now() - startedAt < budget - SAFETY_MARGIN_MS;

    async function worker() {
        while (hasTime()) {
            const idx = cursor++;
            if (idx >= todo.length) break;
            const customer = todo[idx];
            const id = String(customer._id);
            let result;
            try {
                result = await withTimeout(
                    computeCustomerIndeks(customer),
                    customerTimeout,
                    `Indeks for ${customer.customerName || id}`
                );
            } catch (err) {
                result = {
                    customerId: id,
                    customerClickupId: getCustomerClickupId(customer),
                    customerName: customer.customerName || "",
                    businessCategory: customer.businessCategory === "b2b" ? "b2b" : "ecommerce",
                    indeks: null,
                    status: "error",
                    lastError: err?.message || String(err),
                    perChannel: [],
                };
            }

            try {
                if (!options.dryRun) await persistSnapshot(result, snapshotById.get(id));
            } catch (err) {
                result = { ...result, status: "error", lastError: `Persist failed: ${err?.message || err}` };
            }

            stats.processed += 1;
            if (result.status === "ok") stats.ok += 1;
            else if (result.status === "no_data") stats.no_data += 1;
            else if (result.status === "insufficient_history") stats.insufficient_history += 1;
            else stats.errors += 1;
            results.push(result);
        }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, todo.length) || 0 }, () => worker()));

    const summary = {
        success: stats.errors === 0,
        dryRun: Boolean(options.dryRun),
        totalCustomers: customers.length,
        due: due.length,
        remaining: Math.max(0, due.length - stats.processed),
        ...stats,
        durationMs: Date.now() - startedAt,
        concurrency,
        batchSize: options.all ? "all" : batchSize,
    };

    console.info("[customer-indeks]", summary);

    return {
        ...summary,
        errors_detail: results
            .filter((r) => r.status === "error")
            .slice(0, 10)
            .map((r) => ({ customerClickupId: r.customerClickupId, error: r.lastError })),
        // Dry-run (or small manual runs) return the computed values for inspection.
        results: options.dryRun || results.length <= 5 ? results : undefined,
    };
}
