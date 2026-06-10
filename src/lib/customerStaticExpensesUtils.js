/**
 * Shared helpers for CustomerStaticExpenses (config + performance dashboard).
 */

import dayjs from "dayjs";

export function filterCompleteLineItems(items) {
    if (!items || !Array.isArray(items)) return [];
    return items.filter((item) => item && item.name && String(item.name).trim() !== "");
}

/**
 * Normalize line items and recompute aggregate fields before save.
 * @param {Record<string, unknown>} expenses — CustomerStaticExpenses-shaped object
 */
export function prepareCustomerStaticExpensesForSave(expenses) {
    const updated = { ...expenses };

    updated.marketingBureauCostLineItems = filterCompleteLineItems(
        updated.marketingBureauCostLineItems || []
    );
    updated.marketingBureauCost = updated.marketingBureauCostLineItems.reduce(
        (sum, item) => sum + (parseFloat(item.amount) || 0),
        0
    );

    updated.marketingToolingCostLineItems = filterCompleteLineItems(
        updated.marketingToolingCostLineItems || []
    );
    updated.marketingToolingCost = updated.marketingToolingCostLineItems.reduce(
        (sum, item) => sum + (parseFloat(item.amount) || 0),
        0
    );

    updated.fixedExpensesLineItems = filterCompleteLineItems(
        updated.fixedExpensesLineItems || []
    );
    updated.fixedExpenses = updated.fixedExpensesLineItems.reduce(
        (sum, item) => sum + (parseFloat(item.amount) || 0),
        0
    );

    return updated;
}

function sumLineItems(items) {
    return (items || []).reduce((s, item) => s + (parseFloat(item.amount) || 0), 0);
}

/** Customer uses per-line-item fixed costs (config / dashboard modal) vs legacy single monthly fields. */
function usesLineItemFixedExpenses(staticExp = {}) {
    return (
        Array.isArray(staticExp.marketingBureauCostLineItems) ||
        Array.isArray(staticExp.marketingToolingCostLineItems) ||
        Array.isArray(staticExp.fixedExpensesLineItems)
    );
}

function monthlyTotalFromLineItemsOrLegacy(staticExp, lineItemsKey, legacyKey) {
    if (usesLineItemFixedExpenses(staticExp)) {
        return sumLineItems(staticExp[lineItemsKey]);
    }
    return Number(staticExp[legacyKey]) || 0;
}

export function getMonthlyMarketingBureauTotal(staticExp = {}) {
    return monthlyTotalFromLineItemsOrLegacy(
        staticExp,
        "marketingBureauCostLineItems",
        "marketingBureauCost"
    );
}

export function getMonthlyMarketingToolingTotal(staticExp = {}) {
    return monthlyTotalFromLineItemsOrLegacy(
        staticExp,
        "marketingToolingCostLineItems",
        "marketingToolingCost"
    );
}

export function getMonthlyOtherFixedTotal(staticExp = {}) {
    return monthlyTotalFromLineItemsOrLegacy(
        staticExp,
        "fixedExpensesLineItems",
        "fixedExpenses"
    );
}

/** Total monthly fixed costs (bureau + tooling + other fixed). */
export function getMonthlyFixedExpensesTotal(staticExp = {}) {
    const bureau = getMonthlyMarketingBureauTotal(staticExp);
    const tooling = getMonthlyMarketingToolingTotal(staticExp);
    const other = getMonthlyOtherFixedTotal(staticExp);
    return bureau + tooling + other;
}

/**
 * Prorate a monthly amount across each calendar day in [rangeStart, rangeEnd].
 */
export function calcProratedMonthlyCostForDateRange(monthlyAmount, rangeStart, rangeEnd) {
    let total = 0;
    let d = dayjs(rangeStart);
    const endDay = dayjs(rangeEnd);
    while (!d.isAfter(endDay)) {
        total += (Number(monthlyAmount) || 0) / d.daysInMonth();
        d = d.add(1, "day");
    }
    return total;
}

/** Fixed costs for a date range (bureau + tooling + other), prorated per calendar day. */
export function calcFixedCostsForDateRange(rangeStart, rangeEnd, staticExp = {}) {
    return calcProratedMonthlyCostForDateRange(
        getMonthlyFixedExpensesTotal(staticExp),
        rangeStart,
        rangeEnd
    );
}

/** Fixed costs for a single calendar day. */
export function calcFixedCostForSingleDay(dateYmd, staticExp = {}) {
    return getMonthlyFixedExpensesTotal(staticExp) / dayjs(dateYmd).daysInMonth();
}

/**
 * Flat list for performance dashboard fixed-expense breakdown rows.
 * @returns {{ key: string, metricKey: string, label: string, amount: number }[]}
 */
export function getFixedExpensesBreakdownLineItems(staticExp = {}) {
    const rows = [];
    const pushGroup = (items, prefix) => {
        (items || []).forEach((item, i) => {
            if (!item?.name?.trim()) return;
            rows.push({
                key: `${prefix}_${i}`,
                metricKey: `${prefix}_${i}`,
                label: String(item.name).trim(),
                amount: parseFloat(item.amount) || 0,
            });
        });
    };
    pushGroup(staticExp.marketingBureauCostLineItems, "fixed_bureau");
    pushGroup(staticExp.marketingToolingCostLineItems, "fixed_tooling");
    pushGroup(staticExp.fixedExpensesLineItems, "fixed_other");
    return rows;
}
