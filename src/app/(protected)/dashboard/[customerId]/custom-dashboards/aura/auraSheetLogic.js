/**
 * Calculations copied 1:1 from the Aura Google Sheet (see SHEET_LOGIC.md).
 * Inputs the sheet keeps in its Config tab are constants here.
 */

/** Config!C7. Applied to revenue / conversion value as (1 - VAT). */
export const AURA_VAT = 0.25;

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

/**
 * One year of the "Conversions" / "CAC" monthly chart (p calc rows 59 to 71).
 * Month totals: conversions = sum of daily Emob conversions, cost = Google Ads + Meta + Other.
 * Like the sheet, a month with no conversions is blank (null), and so is its CAC.
 * `spendKnown` false (Google Ads or Meta failed to load) leaves CAC null instead of showing a wrong number.
 */
export function monthlyTrend({ googleRows, metaRows, conversions, otherCost, spendKnown = true }) {
    const months = Array.from({ length: 12 }, () => ({ conversions: 0, cost: 0 }));
    const add = (rows, field, valueOf) => {
        for (const r of rows || []) {
            const m = Number(String(r.date).slice(5, 7)) - 1;
            if (m >= 0 && m < 12) months[m][field] += valueOf(r);
        }
    };
    add(conversions, "conversions", (r) => Number(r.value) || 0);
    add(otherCost, "cost", (r) => Number(r.value) || 0);
    add(googleRows, "cost", (r) => Number(r.ad_spend) || 0);
    add(metaRows, "cost", (r) => Number(r.ad_spend) || 0);
    return months.map((m) => ({
        conversions: m.conversions > 0 ? m.conversions : null,
        cac: spendKnown && m.conversions > 0 ? m.cost / m.conversions : null,
    }));
}

export const MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

/**
 * Monthly spend allocation (p calc rows 76 to 88): PPC = Google Ads, PS = Meta, Other = campaign budgets.
 * `total` is the sum of the three; the chart labels are each channel's share of it (the sheet's "Label" columns).
 */
export function monthlyAllocation({ googleRows, metaRows, otherCost }) {
    const months = Array.from({ length: 12 }, () => ({ ppc: 0, ps: 0, other: 0 }));
    const add = (rows, field, valueOf) => {
        for (const r of rows || []) {
            const m = Number(String(r.date).slice(5, 7)) - 1;
            if (m >= 0 && m < 12) months[m][field] += valueOf(r);
        }
    };
    add(googleRows, "ppc", (r) => Number(r.ad_spend) || 0);
    add(metaRows, "ps", (r) => Number(r.ad_spend) || 0);
    add(otherCost, "other", (r) => Number(r.value) || 0);
    return months.map((m) => ({ ...m, total: m.ppc + m.ps + m.other }));
}

/**
 * Monthly Google Ads metrics for one year (p calc rows 207 to 219): sums of spend, clicks, impressions and
 * conversions per month, with the ratios worked out from those sums. Months without data are null.
 * CAC = spend / conversions, CTR = clicks / impressions, CPC = spend / clicks, Conv. Rate = conversions / clicks.
 */
export function monthlyGoogleMetrics(rows) {
    const months = Array.from({ length: 12 }, () => ({ adSpend: 0, clicks: 0, impressions: 0, conversions: 0 }));
    for (const r of rows || []) {
        const m = Number(String(r.date).slice(5, 7)) - 1;
        if (m < 0 || m > 11) continue;
        months[m].adSpend += Number(r.ad_spend) || 0;
        months[m].clicks += Number(r.clicks) || 0;
        months[m].impressions += Number(r.impressions) || 0;
        months[m].conversions += Number(r.conversions) || 0;
    }
    const ratio = (a, b) => (b > 0 ? a / b : null);
    return months.map((m) =>
        m.adSpend > 0 || m.impressions > 0
            ? {
                  ...m,
                  ctr: ratio(m.clicks, m.impressions),
                  cpc: ratio(m.adSpend, m.clicks),
                  convRate: ratio(m.conversions, m.clicks),
                  cac: ratio(m.adSpend, m.conversions),
              }
            : null
    );
}

/**
 * Meta block for the Meta tab. The sheet's monthly Meta figures use Meta link clicks as "Clicks"
 * (so CTR = link clicks / impressions and CPC = spend / link clicks) and unadjusted conversions.
 */
export function metaTabBlock(rows) {
    const spend = sum(rows, "ad_spend");
    const impressions = sum(rows, "impressions");
    const clicks = sum(rows, "link_clicks");
    const conversions = sum(rows, "conversions");
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

/** Monthly Meta metrics for one year (p calc rows 336 to 348), same rules as monthlyGoogleMetrics. */
export function monthlyMetaMetrics(rows) {
    const months = Array.from({ length: 12 }, () => ({ adSpend: 0, clicks: 0, impressions: 0, conversions: 0 }));
    for (const r of rows || []) {
        const m = Number(String(r.date).slice(5, 7)) - 1;
        if (m < 0 || m > 11) continue;
        months[m].adSpend += Number(r.ad_spend) || 0;
        months[m].clicks += Number(r.link_clicks) || 0;
        months[m].impressions += Number(r.impressions) || 0;
        months[m].conversions += Number(r.conversions) || 0;
    }
    const ratio = (a, b) => (b > 0 ? a / b : null);
    return months.map((m) =>
        m.adSpend > 0 || m.impressions > 0
            ? {
                  ...m,
                  ctr: ratio(m.clicks, m.impressions),
                  cpc: ratio(m.adSpend, m.clicks),
                  cpm: m.impressions > 0 ? (m.adSpend / m.impressions) * 1000 : null,
                  cac: ratio(m.adSpend, m.conversions),
              }
            : null
    );
}
