import { notFound } from "next/navigation";
import { getDemoPayload, isDemoCustomerId } from "@/lib/demoCustomer";
import { getDemoMergedSourcesForRange } from "@/lib/demoMergedSources";
import { buildWrappedData, getMonthRange, previousPeriod, summarizeMerged } from "@/lib/dataWrapped";
import WrappedPreviewClient from "./WrappedPreviewClient";

/**
 * Demo preview of the Data Wrapped story. The snapshot is built on the server from the seeded demo
 * data with the same builder the API uses, so the preview needs no login. `?period=YYYY-MM` picks the month.
 */
function lastMonthPeriod() {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function PreviewDataWrappedPage({ params, searchParams }) {
    const { customerId } = await params;
    if (!isDemoCustomerId(String(customerId))) notFound();
    const sp = (await searchParams) || {};
    const period = /^\d{4}-\d{2}$/.test(String(sp.period || "")) ? String(sp.period) : lastMonthPeriod();

    const customer = getDemoPayload("customer");
    const range = getMonthRange(period);
    const merged = getDemoMergedSourcesForRange(range.startDate, range.endDate, customer);
    const prevPeriod = previousPeriod(period);
    const prevRange = getMonthRange(prevPeriod);
    const prevSummary = summarizeMerged(getDemoMergedSourcesForRange(prevRange.startDate, prevRange.endDate, customer));
    const prev = prevSummary.netRevenue > 0 ? { period: prevPeriod, ...prevSummary } : null;
    let data = buildWrappedData(merged, customer, period, prev);

    // ?legacy=1 shows how a saved version 1 report opens: only the original fields exist
    if (sp.legacy === "1") {
        const { customerName, netRevenue, orders, roas, poas, totalSpend, netAov, topChannel, topChannelShare, services, year, month } = data;
        data = { customerName, period, year, month, netRevenue, orders, roas, poas, totalSpend, netAov, topChannel, topChannelShare, services };
    }

    return <WrappedPreviewClient data={data} period={period} customerName={customer?.customerName || "Demo Account"} />;
}
