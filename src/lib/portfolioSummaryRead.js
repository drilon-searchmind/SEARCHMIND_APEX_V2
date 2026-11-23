import connectToDatabase from "@root/lib/mongodb";
import PortfolioSummarySnapshot from "@/models/PortfolioSummarySnapshot";
import { resolvePortfolioWindow } from "@/lib/portfolioSummaryWindows";

const PUBLIC_FIELDS = [
    "customerId",
    "customerName",
    "currency",
    "parentId",
    "parentName",
    "revenue",
    "revenuePrev",
    "orders",
    "ordersPrev",
    "spendTotal",
    "spendTotalPrev",
    "spendGoogle",
    "spendGooglePrev",
    "spendMeta",
    "spendMetaPrev",
    "spendOther",
    "spendOtherPrev",
    "revenueGoogle",
    "revenueGooglePrev",
    "revenueMeta",
    "revenueMetaPrev",
    "revenueEmail",
    "revenueEmailPrev",
    "grossProfit",
    "grossProfitPrev",
    "cogsConfigured",
    "lastSync",
    "dataGaps",
    "status",
    "computedAt",
];

function toPublicRow(snap) {
    const row = {};
    for (const key of PUBLIC_FIELDS) {
        if (key === "computedAt") {
            row.computedAt = snap.computedAt ? new Date(snap.computedAt).toISOString() : null;
        } else if (key === "lastSync") {
            row.lastSync = snap.lastSync || {};
        } else if (key === "dataGaps") {
            row.dataGaps = snap.dataGaps || [];
        } else {
            row[key] = snap[key] ?? null;
        }
    }
    return row;
}

/**
 * Fast MongoDB-only portfolio summary for the requested (or default) window.
 */
export async function readPortfolioSummary(params = {}) {
    await connectToDatabase();
    const window = resolvePortfolioWindow(params);

    let snaps = await PortfolioSummarySnapshot.find({ windowKey: window.windowKey })
        .select(PUBLIC_FIELDS.join(" ") + " windowKey startDate endDate compareStartDate compareEndDate")
        .sort({ customerName: 1 })
        .lean();

    // TV dashboards often ask for Nov 1–30 while sync stores MTD ending yesterday — fall back to
    // the newest synced window that shares the same startDate.
    let usedWindow = window;
    let fallback = false;
    if (!snaps.length && window.startDate) {
        const latest = await PortfolioSummarySnapshot.findOne({ startDate: window.startDate })
            .sort({ computedAt: -1 })
            .select("windowKey startDate endDate compareStartDate compareEndDate")
            .lean();
        if (latest?.windowKey) {
            snaps = await PortfolioSummarySnapshot.find({ windowKey: latest.windowKey })
                .select(PUBLIC_FIELDS.join(" ") + " windowKey startDate endDate compareStartDate compareEndDate")
                .sort({ customerName: 1 })
                .lean();
            usedWindow = {
                startDate: latest.startDate,
                endDate: latest.endDate,
                compareStartDate: latest.compareStartDate,
                compareEndDate: latest.compareEndDate,
                windowKey: latest.windowKey,
            };
            fallback = true;
        }
    }

    const customers = snaps.map(toPublicRow);
    const computedAts = customers
        .map((c) => (c.computedAt ? new Date(c.computedAt).getTime() : 0))
        .filter(Boolean);

    return {
        readOnly: true,
        generatedAt: new Date().toISOString(),
        cached: true,
        cacheMaxAgeSeconds: 300,
        window: {
            startDate: usedWindow.startDate,
            endDate: usedWindow.endDate,
            compareStartDate: usedWindow.compareStartDate,
            compareEndDate: usedWindow.compareEndDate,
            windowKey: usedWindow.windowKey,
            requestedEndDate: window.endDate,
            usedFallbackWindow: fallback,
        },
        count: customers.length,
        oldestComputedAt: computedAts.length
            ? new Date(Math.min(...computedAts)).toISOString()
            : null,
        newestComputedAt: computedAts.length
            ? new Date(Math.max(...computedAts)).toISOString()
            : null,
        customers,
    };
}
