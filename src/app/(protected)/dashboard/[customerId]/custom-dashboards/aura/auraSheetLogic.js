/**
 * Calculations copied 1:1 from the Aura Google Sheet (see SHEET_LOGIC.md).
 * Inputs the sheet keeps in its Config tab are constants here.
 */

/** Config!C7. Applied to revenue / conversion value as (1 - VAT). */
export const AURA_VAT = 0.25;

/** Config tab, "Budget" and "Kundeindtag" columns (identical for every month in the sheet). */
export const AURA_MONTHLY_BUDGET = 178667;
export const AURA_MONTHLY_CUSTOMER_GOAL = 250;

const sum = (rows, key) => (rows || []).reduce((s, r) => s + (Number(r?.[key]) || 0), 0);
const div = (a, b) => (b > 0 ? a / b : null);

/** Google Ads block (p calc rows 133 to 194). */
export function googleAdsBlock(rows) {
    const conversions = sum(rows, "conversions");
    const convValue = sum(rows, "conversions_value") * (1 - AURA_VAT);
    const spend = sum(rows, "ad_spend");
    const impressions = sum(rows, "impressions");
    const clicks = sum(rows, "clicks");
    return {
        conversions,
        convValue,
        spend,
        roas: div(convValue, spend),
        aov: div(convValue, conversions),
        impressions,
        clicks,
        ctr: div(clicks, impressions),
        cpc: div(spend, clicks),
        convRate: div(conversions, clicks),
        cpa: div(spend, conversions),
    };
}

/**
 * Meta block (p calc rows 243 to 297). The sheet multiplies the conversion count by (1 - VAT);
 * kept here so numbers match, flagged in SHEET_LOGIC.md.
 */
export function metaBlock(rows) {
    const spend = sum(rows, "ad_spend");
    const impressions = sum(rows, "impressions");
    const clicks = sum(rows, "clicks");
    const conversions = sum(rows, "conversions") * (1 - AURA_VAT);
    return {
        spend,
        impressions,
        clicks,
        conversions,
        ctr: div(clicks, impressions),
        cpc: div(spend, clicks),
        cpm: impressions > 0 ? (spend / impressions) * 1000 : null,
        cpa: div(spend, conversions),
    };
}

/** Cost = Google Ads + Meta + Other. "Other" is not available in Apex (null) so the total is partial. */
export function totalCost({ googleSpend, metaSpend, otherCost = 0 }) {
    return googleSpend + metaSpend + (otherCost || 0);
}

/** CAC = Cost / Orders (p calc C46). Orders are not available in Apex, returns null without them. */
export function cac(cost, orders) {
    return orders > 0 ? cost / orders : null;
}

/** Pace tab G4: month-to-date cost / (budget / days in month * (DAY(today) - 1)). */
export function budgetPace({ costToDate, budget, daysInMonth, today }) {
    const elapsed = today.getDate() - 1;
    if (elapsed <= 0 || !(budget > 0)) return null;
    return costToDate / ((budget / daysInMonth) * elapsed);
}

/** Pace tab G3: suggested daily adjustment, formula copied as is (including its double counting). */
export function suggestedDailyAdjustment({ costToDate, budget, daysInMonth, today }) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1).getDate();
    if (day <= 0 || daysInMonth - day <= 0) return null;
    const daily = budget / daysInMonth;
    return -(costToDate - daily * day) / (daysInMonth - day) + (daily - costToDate / day);
}

/** Daily rows joined on date (Overview Day / month tabs): PPC cost, PS cost, total (Other missing). */
export function dailyCostRows(googleRows, metaRows) {
    const byDate = new Map();
    for (const r of googleRows || []) byDate.set(r.date, { date: r.date, ppc: r.ad_spend || 0, ps: 0 });
    for (const r of metaRows || []) {
        const row = byDate.get(r.date) || { date: r.date, ppc: 0, ps: 0 };
        row.ps = r.ad_spend || 0;
        byDate.set(r.date, row);
    }
    return [...byDate.values()]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((r) => ({ ...r, total: r.ppc + r.ps }));
}

/** Month buckets (YYYY-MM) for the monthly cost split chart. */
export function monthlyCost(googleRows, metaRows) {
    const months = new Map();
    const add = (rows, field) => {
        for (const r of rows || []) {
            const key = String(r.date).slice(0, 7);
            const m = months.get(key) || { month: key, ppc: 0, ps: 0 };
            m[field] += r.ad_spend || 0;
            months.set(key, m);
        }
    };
    add(googleRows, "ppc");
    add(metaRows, "ps");
    return [...months.values()].sort((a, b) => a.month.localeCompare(b.month));
}
