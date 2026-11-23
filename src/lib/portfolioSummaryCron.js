/**
 * Batch sync for portfolio-summary snapshots (Black Days TV dashboards).
 *
 * Env (optional):
 *   PORTFOLIO_SUMMARY_CRON_ENABLED     default true
 *   PORTFOLIO_SUMMARY_BATCH_SIZE       default 25
 *   PORTFOLIO_SUMMARY_CONCURRENCY      default 4
 *   PORTFOLIO_SUMMARY_TIME_BUDGET_MS   default 270000
 *   PORTFOLIO_SUMMARY_CUSTOMER_TIMEOUT_MS default 150000
 *   PORTFOLIO_SUMMARY_MIN_AGE_MINUTES  default 4  (refresh cadence for the 5-min schedule)
 *   PORTFOLIO_SUMMARY_START_DATE / END_DATE / YEAR  window overrides
 *   PORTFOLIO_SUMMARY_SEASON_MONTH                  scheduled month (default 11 = November)
 *   Scheduled cron only runs in that month+year, 08:00–23:00 Copenhagen; /manual ignores those guards.
 *   PORTFOLIO_SUMMARY_DAY_START_HOUR / DAY_END_HOUR  daytime window (default 8 / 23 exclusive)
 */
import connectToDatabase from "@root/lib/mongodb";
import Customer from "@/models/Customer";
import ParentCustomer from "@/models/ParentCustomer";
import PortfolioSummarySnapshot from "@/models/PortfolioSummarySnapshot";
import { isDemoCustomerId } from "@/lib/demoCustomer";
import { computePortfolioSummaryRow } from "@/lib/portfolioSummaryCompute";
import {
    getDefaultPortfolioWindow,
    resolvePortfolioWindow,
} from "@/lib/portfolioSummaryWindows";

const SAFETY_MARGIN_MS = 25_000;

function numEnv(name, fallback) {
    const raw = process.env[name];
    if (raw == null || raw === "") return fallback;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function isPortfolioSummaryCronEnabled() {
    const flag = (process.env.PORTFOLIO_SUMMARY_CRON_ENABLED || "true").trim().toLowerCase();
    return flag !== "false" && flag !== "0" && flag !== "off";
}

async function loadParentNameById(customers) {
    const ids = [
        ...new Set(
            customers
                .map((c) => (c.parentCustomer ? String(c.parentCustomer) : ""))
                .filter(Boolean)
        ),
    ];
    const map = new Map();
    if (!ids.length) return map;
    const parents = await ParentCustomer.find({ _id: { $in: ids } })
        .select("_id name")
        .lean();
    for (const p of parents) map.set(String(p._id), p.name || "");
    return map;
}

async function listEcommerceCustomers({ customerIds } = {}) {
    const filter = {
        isArchived: { $ne: true },
        businessCategory: { $ne: "b2b" },
    };
    if (customerIds?.length) filter._id = { $in: customerIds };
    const docs = await Customer.find(filter).lean();
    return docs.filter((c) => !isDemoCustomerId(String(c._id)));
}

function withTimeout(promise, ms, label) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function persistRow(row) {
    const { customerId, windowKey, ...fields } = row;
    await PortfolioSummarySnapshot.findOneAndUpdate(
        { customerId, windowKey },
        {
            $set: {
                ...fields,
                customerId,
                windowKey,
                computedAt: new Date(),
            },
        },
        { upsert: true, setDefaultsOnInsert: true }
    );
}

/**
 * @param {{
 *   startDate?: string,
 *   endDate?: string,
 *   compareStartDate?: string,
 *   compareEndDate?: string,
 *   customerIds?: string[],
 *   force?: boolean,
 *   all?: boolean,
 *   limit?: number,
 *   dryRun?: boolean,
 * }} [options]
 */
export async function runPortfolioSummary(options = {}) {
    const startedAt = Date.now();
    await connectToDatabase();

    const window = options.startDate
        ? resolvePortfolioWindow(options)
        : getDefaultPortfolioWindow();

    const budget = numEnv("PORTFOLIO_SUMMARY_TIME_BUDGET_MS", 270_000);
    const concurrency = numEnv("PORTFOLIO_SUMMARY_CONCURRENCY", 4);
    const customerTimeout = numEnv("PORTFOLIO_SUMMARY_CUSTOMER_TIMEOUT_MS", 150_000);
    const batchSize = options.limit > 0 ? options.limit : numEnv("PORTFOLIO_SUMMARY_BATCH_SIZE", 25);
    const minAgeMs = numEnv("PORTFOLIO_SUMMARY_MIN_AGE_MINUTES", 4) * 60_000;

    const customers = await listEcommerceCustomers(options);
    const parentNameById = await loadParentNameById(customers);

    const existing = await PortfolioSummarySnapshot.find({
        windowKey: window.windowKey,
        customerId: { $in: customers.map((c) => String(c._id)) },
    })
        .select("customerId computedAt status")
        .lean();
    const byId = new Map(existing.map((s) => [s.customerId, s]));

    const now = Date.now();
    const due = customers
        .filter((c) => {
            if (options.force) return true;
            const snap = byId.get(String(c._id));
            if (!snap?.computedAt) return true;
            return now - new Date(snap.computedAt).getTime() >= minAgeMs;
        })
        .sort((a, b) => {
            const ta = byId.get(String(a._id))?.computedAt;
            const tb = byId.get(String(b._id))?.computedAt;
            return (ta ? new Date(ta).getTime() : 0) - (tb ? new Date(tb).getTime() : 0);
        });

    const todo = options.all ? due : due.slice(0, batchSize);
    const stats = { processed: 0, ok: 0, partial: 0, no_data: 0, errors: 0 };
    const results = [];
    let cursor = 0;
    const hasTime = () => Date.now() - startedAt < budget - SAFETY_MARGIN_MS;

    async function worker() {
        while (hasTime()) {
            const idx = cursor++;
            if (idx >= todo.length) break;
            const customer = todo[idx];
            const id = String(customer._id);
            let row;
            try {
                row = await withTimeout(
                    computePortfolioSummaryRow(customer, window, { parentNameById }),
                    customerTimeout,
                    `Portfolio summary ${customer.customerName || id}`
                );
            } catch (err) {
                row = {
                    customerId: id,
                    customerName: customer.customerName || "",
                    windowKey: window.windowKey,
                    startDate: window.startDate,
                    endDate: window.endDate,
                    compareStartDate: window.compareStartDate,
                    compareEndDate: window.compareEndDate,
                    status: "error",
                    lastError: err?.message || String(err),
                    dataGaps: [{ source: "runner", reason: "error", message: err?.message }],
                };
            }

            try {
                if (!options.dryRun) await persistRow(row);
            } catch (err) {
                row = {
                    ...row,
                    status: "error",
                    lastError: `Persist failed: ${err?.message || err}`,
                };
            }

            stats.processed += 1;
            if (row.status === "ok") stats.ok += 1;
            else if (row.status === "partial") stats.partial += 1;
            else if (row.status === "no_data") stats.no_data += 1;
            else stats.errors += 1;
            results.push({
                customerId: row.customerId,
                customerName: row.customerName,
                status: row.status,
                revenue: row.revenue,
                spendTotal: row.spendTotal,
                lastError: row.lastError || "",
            });
        }
    }

    await Promise.all(
        Array.from({ length: Math.min(concurrency, todo.length) || 0 }, () => worker())
    );

    const summary = {
        success: stats.errors === 0,
        dryRun: Boolean(options.dryRun),
        window,
        totalCustomers: customers.length,
        due: due.length,
        remaining: Math.max(0, due.length - stats.processed),
        ...stats,
        durationMs: Date.now() - startedAt,
        concurrency,
        batchSize: options.all ? "all" : batchSize,
    };
    console.info("[portfolio-summary]", summary);

    return {
        ...summary,
        errors_detail: results
            .filter((r) => r.status === "error")
            .slice(0, 10)
            .map((r) => ({ customerId: r.customerId, customerName: r.customerName, error: r.lastError })),
        results: options.dryRun || results.length <= 5 ? results : undefined,
    };
}
