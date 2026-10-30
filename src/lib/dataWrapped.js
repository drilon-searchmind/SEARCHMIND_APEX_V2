import { AD_SPEND_CHANNELS } from "@/lib/mergeAdSpendDaily";

/**
 * Data Wrapped snapshot builder, shared by the API route and the demo preview.
 * Version 2 adds the daily series, best day, weekday pattern, every paid channel and a previous-month
 * comparison. Older saved snapshots (version 1) lack these fields, so the story skips slides it cannot fill.
 */

export const WRAPPED_DATA_VERSION = 2;

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

export function getPeriodLabel(period) {
    if (!period || !/^\d{4}-\d{2}$/.test(period)) return "";
    const [y, m] = period.split("-").map(Number);
    return `${MONTH_NAMES[m - 1]} ${y}`;
}

export function getMonthRange(period) {
    const [year, month] = period.split("-").map(Number);
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return { startDate, endDate };
}

export function previousPeriod(period) {
    const [year, month] = period.split("-").map(Number);
    const d = new Date(year, month - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function nextPeriodLabel(period) {
    const [year, month] = period.split("-").map(Number);
    const d = new Date(year, month, 1);
    return MONTH_NAMES[d.getMonth()];
}

const sum = (rows, key) => (rows || []).reduce((s, r) => s + (Number(r?.[key]) || 0), 0);

function ymd(row) {
    return String(row?.period || row?.date || row?.day || "").slice(0, 10);
}

/** Headline numbers only, used for the month-over-month comparison. */
export function summarizeMerged(merged) {
    const { shopifyDaily = [], grossProfitNetSales = 0 } = merged || {};
    const netRevenue = sum(shopifyDaily, "net_sales");
    const totalSales = sum(shopifyDaily, "total_sales");
    const orders = sum(shopifyDaily, "orders");
    const totalSpend = AD_SPEND_CHANNELS.reduce((s, c) => s + sum(merged?.[c.mergeKey], "spend"), 0);
    return {
        netRevenue,
        orders,
        netAov: orders > 0 ? netRevenue / orders : 0,
        totalSpend,
        roas: totalSpend > 0 ? totalSales / totalSpend : 0,
        poas: totalSpend > 0 ? grossProfitNetSales / totalSpend : 0,
    };
}

/**
 * @param {object} merged - merged sources for the month
 * @param {object} customer
 * @param {string} period - YYYY-MM
 * @param {(object & { period: string }) | null} [prev] - headline numbers of the previous month, when known
 */
export function buildWrappedData(merged, customer, period, prev = null) {
    const [year, month] = period.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const { shopifyDaily = [], grossProfitNetSales = 0 } = merged || {};

    const base = summarizeMerged(merged);
    const totalSales = sum(shopifyDaily, "total_sales");

    // Every paid channel, not just Meta and Google
    const channelRows = AD_SPEND_CHANNELS.map((c) => ({
        id: c.id,
        label: c.label.replace(" (Bing)", ""),
        spend: sum(merged?.[c.mergeKey], "spend"),
    })).filter((c) => c.spend > 0);
    channelRows.sort((a, b) => b.spend - a.spend);
    const spendByChannel = channelRows.map((c) => ({
        ...c,
        share: base.totalSpend > 0 ? c.spend / base.totalSpend : 0,
    }));
    const top = spendByChannel[0] || null;

    // Daily series for the chart, the best day and the weekday pattern
    const spendByDate = {};
    for (const c of AD_SPEND_CHANNELS) {
        for (const r of merged?.[c.mergeKey] || []) {
            const d = ymd(r);
            if (d) spendByDate[d] = (spendByDate[d] || 0) + (Number(r.spend) || 0);
        }
    }
    const daily = shopifyDaily
        .map((r) => ({
            date: ymd(r),
            netSales: Number(r.net_sales) || 0,
            orders: Number(r.orders) || 0,
            spend: spendByDate[ymd(r)] || 0,
        }))
        .filter((r) => r.date)
        .sort((a, b) => a.date.localeCompare(b.date));

    const bestDay = daily.length
        ? daily.reduce((best, r) => (r.netSales > best.netSales ? r : best), daily[0])
        : null;

    // Weekday averages, Monday first; an average avoids favouring weekdays that occur five times
    const weekdayTotals = Array.from({ length: 7 }, () => ({ total: 0, days: 0 }));
    for (const r of daily) {
        const [y, m, d] = r.date.split("-").map(Number);
        const idx = (new Date(y, m - 1, d).getDay() + 6) % 7;
        weekdayTotals[idx].total += r.netSales;
        weekdayTotals[idx].days += 1;
    }
    const weekdays = weekdayTotals.map((w) => (w.days > 0 ? w.total / w.days : 0));
    const weekdayMax = Math.max(...weekdays);
    const bestWeekday = daily.length && weekdayMax > 0 ? weekdays.indexOf(weekdayMax) : null;

    const settings = customer?.CustomerSettings || {};
    const services = [];
    if (settings.facebookAdAccountId) services.push("PS");
    if (settings.googleAdsCustomerId) services.push("PPC");
    if (settings.googleSearchConsoleProperty) services.push("SEO");
    if (settings.shopifyUrl || settings.wooCommerceApiUrl) services.push("EM");
    if (services.length === 0) services.push("Ecommerce");

    return {
        version: WRAPPED_DATA_VERSION,
        customerName: customer?.customerName || "Your Store",
        period,
        year,
        month,
        daysInMonth,
        netRevenue: base.netRevenue,
        totalSales,
        orders: base.orders,
        netAov: base.netAov,
        totalSpend: base.totalSpend,
        roas: base.roas,
        poas: base.poas,
        grossProfit: grossProfitNetSales,
        // Kept under the old names so version 1 consumers still work
        topChannel: top ? top.label : "",
        topChannelShare: top ? Math.round(top.share * 100) : 0,
        spendByChannel,
        daily,
        bestDay,
        weekdays,
        bestWeekday,
        minutesPerOrder: base.orders > 0 ? (daysInMonth * 24 * 60) / base.orders : null,
        services,
        prev: prev
            ? {
                  period: prev.period,
                  netRevenue: prev.netRevenue,
                  orders: prev.orders,
                  netAov: prev.netAov,
                  totalSpend: prev.totalSpend,
                  roas: prev.roas,
                  poas: prev.poas,
              }
            : null,
    };
}
