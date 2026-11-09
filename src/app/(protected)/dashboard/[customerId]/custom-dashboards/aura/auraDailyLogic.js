/**
 * Daily view of one month: the logic behind the Google Sheet tabs "Overview Day" and "Pace" (see SHEET_LOGIC.md).
 * Pure functions, no React.
 */

const pad2 = (n) => String(n).padStart(2, "0");

/** ISO dates of every day in a month (month is 0 based). */
export function monthDates(year, month) {
    const days = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: days }, (_, i) => `${year}-${pad2(month + 1)}-${pad2(i + 1)}`);
}

/** Days of the month that count as finished: the whole month in the past, up to yesterday this month, none in the future. */
export function elapsedDays(year, month, today) {
    const first = new Date(year, month, 1);
    const nextFirst = new Date(year, month + 1, 1);
    if (today >= nextFirst) return new Date(year, month + 1, 0).getDate();
    if (today < first) return 0;
    return today.getDate() - 1;
}

/**
 * One row per day of the month: conversions, PPC (Google Ads) cost, PS (Meta) cost, Other cost, total spend and CAC.
 * Days after `elapsed` are blank (empty: true), like in the sheet.
 */
export function monthDailyRows({ year, month, elapsed, googleRows, metaRows, conversions, otherCost }) {
    const index = (rows, valueOf) => {
        const map = new Map();
        for (const r of rows || []) map.set(r.date, (map.get(r.date) || 0) + valueOf(r));
        return map;
    };
    const g = index(googleRows, (r) => Number(r.ad_spend) || 0);
    const m = index(metaRows, (r) => Number(r.ad_spend) || 0);
    const c = index(conversions, (r) => Number(r.value) || 0);
    const o = index(otherCost, (r) => Number(r.value) || 0);
    return monthDates(year, month).map((date, i) => {
        const weekday = new Date(year, month, i + 1).getDay();
        const base = { date, weekend: weekday === 0 || weekday === 6 };
        if (i >= elapsed) return { ...base, empty: true };
        const conv = c.get(date) || 0;
        const ppc = g.get(date) || 0;
        const ps = m.get(date) || 0;
        const other = o.get(date) || 0;
        const total = ppc + ps + other;
        return { ...base, empty: false, conversions: conv, ppc, ps, other, total, cac: conv > 0 ? total / conv : null };
    });
}

/** Totals row of a daily table (finished days only). */
export function dailyTotals(rows) {
    const t = { conversions: 0, ppc: 0, ps: 0, other: 0, total: 0 };
    for (const r of rows) {
        if (r.empty) continue;
        for (const k of Object.keys(t)) t[k] += r[k];
    }
    return { ...t, cac: t.conversions > 0 ? t.total / t.conversions : null };
}

export const DAILY_KEYS = ["conversions", "ppc", "ps", "other", "total", "cac"];

/** "Index" (this period as % of last year) and "Dif" (this period minus last year) rows. */
export function compareTotals(now, last) {
    const index = {};
    const dif = {};
    for (const k of DAILY_KEYS) {
        index[k] = now[k] != null && last[k] > 0 ? (now[k] / last[k]) * 100 : null;
        dif[k] = now[k] != null && last[k] != null ? now[k] - last[k] : null;
    }
    return { index, dif };
}

/**
 * Pace report: budget pace, customer pace and the suggested daily adjustment, measured on the finished days
 * (the sheet uses DAY(today) - 1). Also the cumulative lines for the two charts.
 */
export function paceReport({ rows, budget, goal, elapsed }) {
    const days = rows.length;
    const costToDate = rows.reduce((s, r) => s + (r.empty ? 0 : r.total), 0);
    const customersToDate = rows.reduce((s, r) => s + (r.empty ? 0 : r.conversions), 0);
    const dailyBudget = budget > 0 ? budget / days : 0;
    const dailyGoal = goal > 0 ? goal / days : 0;
    let cost = 0;
    let customers = 0;
    const lines = rows.map((r, i) => {
        if (!r.empty) {
            cost += r.total;
            customers += r.conversions;
        }
        return {
            date: r.date,
            cost: r.empty ? null : cost,
            customers: r.empty ? null : customers,
            budget: dailyBudget * (i + 1),
            goal: dailyGoal * (i + 1),
        };
    });
    const costPace = elapsed > 0 && dailyBudget > 0 ? costToDate / (dailyBudget * elapsed) : null;
    const customerPace = elapsed > 0 && dailyGoal > 0 ? customersToDate / (dailyGoal * elapsed) : null;
    const adjustment =
        elapsed > 0 && days - elapsed > 0 && dailyBudget > 0
            ? -(costToDate - dailyBudget * elapsed) / (days - elapsed) + (dailyBudget - costToDate / elapsed)
            : null;
    return { costToDate, customersToDate, costPace, customerPace, adjustment, lines, budget, goal };
}
