/**
 * Shared helpers for CustomerStaticExpenses (config + performance dashboard).
 */

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
    if (updated.marketingBureauCostLineItems.length > 0) {
        updated.marketingBureauCost = updated.marketingBureauCostLineItems.reduce(
            (sum, item) => sum + (parseFloat(item.amount) || 0),
            0
        );
    }

    updated.marketingToolingCostLineItems = filterCompleteLineItems(
        updated.marketingToolingCostLineItems || []
    );
    if (updated.marketingToolingCostLineItems.length > 0) {
        updated.marketingToolingCost = updated.marketingToolingCostLineItems.reduce(
            (sum, item) => sum + (parseFloat(item.amount) || 0),
            0
        );
    }

    updated.fixedExpensesLineItems = filterCompleteLineItems(
        updated.fixedExpensesLineItems || []
    );
    if (updated.fixedExpensesLineItems.length > 0) {
        updated.fixedExpenses = updated.fixedExpensesLineItems.reduce(
            (sum, item) => sum + (parseFloat(item.amount) || 0),
            0
        );
    }

    return updated;
}

/** Total monthly fixed costs (bureau + tooling + other fixed). */
export function getMonthlyFixedExpensesTotal(staticExp = {}) {
    const bureau = Number(staticExp.marketingBureauCost) || 0;
    const tooling = Number(staticExp.marketingToolingCost) || 0;
    const other = Number(staticExp.fixedExpenses) || 0;
    if (bureau + tooling + other > 0) return bureau + tooling + other;

    const sumLineItems = (items) =>
        (items || []).reduce((s, item) => s + (parseFloat(item.amount) || 0), 0);
    return (
        sumLineItems(staticExp.marketingBureauCostLineItems) +
        sumLineItems(staticExp.marketingToolingCostLineItems) +
        sumLineItems(staticExp.fixedExpensesLineItems)
    );
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
