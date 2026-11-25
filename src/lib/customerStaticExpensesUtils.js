/**
 * Shared helpers for CustomerStaticExpenses (config + performance dashboard).
 *
 * Market binding:
 * - Global rates / line items (no marketId) apply store-wide and to every market.
 * - marketVariableCosts[] and line items with marketId only apply to that market
 *   (or when that market is included in a dashboard market filter).
 */

import dayjs from "dayjs";

export function filterCompleteLineItems(items) {
    if (!items || !Array.isArray(items)) return [];
    return items.filter((item) => item && item.name && String(item.name).trim() !== "");
}

/** Empty / missing marketId ⇒ global. */
export function lineItemMarketId(item) {
    const id = item?.marketId;
    if (id == null || id === "") return null;
    const s = String(id).trim();
    return s || null;
}

function numOr(value, fallback) {
    if (value === null || value === undefined || value === "") return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

/**
 * Resolve shipping / pick&pack per order for one market (or global when marketId is null).
 */
export function resolvePerOrderRates(staticExp = {}, marketId = null) {
    const globalShipping = Number(staticExp.shippingCostPerOrder) || 0;
    const globalPick = Number(staticExp.pickNPackCostPerOrder) || 0;
    if (!marketId) {
        return {
            shippingCostPerOrder: globalShipping,
            pickNPackCostPerOrder: globalPick,
        };
    }
    const hit = (staticExp.marketVariableCosts || []).find(
        (o) => String(o?.marketId || "").trim() === String(marketId)
    );
    if (!hit) {
        return {
            shippingCostPerOrder: globalShipping,
            pickNPackCostPerOrder: globalPick,
        };
    }
    return {
        shippingCostPerOrder: numOr(hit.shippingCostPerOrder, globalShipping),
        pickNPackCostPerOrder: numOr(hit.pickNPackCostPerOrder, globalPick),
    };
}

/**
 * Rates for a market selection (dashboard filter).
 * One market → that market's rates; several → simple average of resolved rates;
 * none / all → global.
 */
export function resolvePerOrderRatesForMarkets(staticExp = {}, marketIds = null) {
    const ids = Array.isArray(marketIds)
        ? [...new Set(marketIds.map((id) => String(id || "").trim()).filter(Boolean))]
        : [];
    if (ids.length === 0) return resolvePerOrderRates(staticExp, null);
    if (ids.length === 1) return resolvePerOrderRates(staticExp, ids[0]);
    let ship = 0;
    let pick = 0;
    for (const id of ids) {
        const r = resolvePerOrderRates(staticExp, id);
        ship += r.shippingCostPerOrder;
        pick += r.pickNPackCostPerOrder;
    }
    return {
        shippingCostPerOrder: ship / ids.length,
        pickNPackCostPerOrder: pick / ids.length,
    };
}

/**
 * Clone static expenses with resolved per-order rates (and optional fixed totals already baked in).
 */
export function withResolvedPerOrderRates(staticExp = {}, marketIdOrIds = null) {
    const rates = Array.isArray(marketIdOrIds)
        ? resolvePerOrderRatesForMarkets(staticExp, marketIdOrIds)
        : resolvePerOrderRates(staticExp, marketIdOrIds);
    return {
        ...staticExp,
        shippingCostPerOrder: rates.shippingCostPerOrder,
        pickNPackCostPerOrder: rates.pickNPackCostPerOrder,
    };
}

/**
 * Filter fixed line items by market scope.
 * @param {'all'|'global'|'market'|'selection'} mode
 * @param {{ marketId?: string|null, marketIds?: string[]|null }} opts
 */
export function filterFixedLineItemsByMarket(items, mode = "all", opts = {}) {
    const list = items || [];
    if (mode === "all") return list;
    if (mode === "global") return list.filter((item) => !lineItemMarketId(item));
    if (mode === "market") {
        const mid = opts.marketId ? String(opts.marketId) : null;
        if (!mid) return list.filter((item) => !lineItemMarketId(item));
        return list.filter((item) => {
            const id = lineItemMarketId(item);
            return !id || id === mid;
        });
    }
    if (mode === "selection") {
        const allowed = new Set(
            (opts.marketIds || []).map((id) => String(id || "").trim()).filter(Boolean)
        );
        return list.filter((item) => {
            const id = lineItemMarketId(item);
            if (!id) return true;
            return allowed.has(id);
        });
    }
    return list;
}

function monthlyTotalFromFilteredItems(staticExp, lineItemsKey, legacyKey, mode, opts) {
    if (usesLineItemFixedExpenses(staticExp)) {
        return sumLineItems(filterFixedLineItemsByMarket(staticExp[lineItemsKey], mode, opts));
    }
    // Legacy single monthly fields are always global
    if (mode === "market" || mode === "selection" || mode === "global" || mode === "all") {
        return Number(staticExp[legacyKey]) || 0;
    }
    return Number(staticExp[legacyKey]) || 0;
}

/**
 * Monthly fixed total with market scope.
 * - all: global + every market-tied item (store-wide)
 * - global: only unbound items
 * - market: global items (caller may split) + items for marketId — use with marketShare
 * - selection: global + items for selected marketIds
 */
export function getMonthlyFixedExpensesTotal(staticExp = {}, options = {}) {
    const mode = options.mode || "all";
    const opts = { marketId: options.marketId, marketIds: options.marketIds };
    const bureau = monthlyTotalFromFilteredItems(
        staticExp,
        "marketingBureauCostLineItems",
        "marketingBureauCost",
        mode === "market" ? "global" : mode,
        opts
    );
    const tooling = monthlyTotalFromFilteredItems(
        staticExp,
        "marketingToolingCostLineItems",
        "marketingToolingCost",
        mode === "market" ? "global" : mode,
        opts
    );
    const other = monthlyTotalFromFilteredItems(
        staticExp,
        "fixedExpensesLineItems",
        "fixedExpenses",
        mode === "market" ? "global" : mode,
        opts
    );
    let total = bureau + tooling + other;

    if (mode === "market") {
        const share = Math.max(Number(options.marketCount) || 1, 1);
        total = total / share;
        const marketOnly = { marketId: options.marketId };
        total +=
            sumLineItems(
                filterFixedLineItemsByMarket(staticExp.marketingBureauCostLineItems, "market", marketOnly).filter(
                    (i) => lineItemMarketId(i)
                )
            ) +
            sumLineItems(
                filterFixedLineItemsByMarket(staticExp.marketingToolingCostLineItems, "market", marketOnly).filter(
                    (i) => lineItemMarketId(i)
                )
            ) +
            sumLineItems(
                filterFixedLineItemsByMarket(staticExp.fixedExpensesLineItems, "market", marketOnly).filter((i) =>
                    lineItemMarketId(i)
                )
            );
    }

    return total;
}

/**
 * Normalize line items and recompute aggregate fields before save.
 * @param {Record<string, unknown>} expenses — CustomerStaticExpenses-shaped object
 */
function normalizeMarketIdOnItems(items) {
    return (items || []).map((item) => ({
        ...item,
        marketId: lineItemMarketId(item) || "",
    }));
}

export function prepareCustomerStaticExpensesForSave(expenses) {
    const updated = { ...expenses };

    updated.marketingBureauCostLineItems = normalizeMarketIdOnItems(
        filterCompleteLineItems(updated.marketingBureauCostLineItems || [])
    );
    updated.marketingBureauCost = updated.marketingBureauCostLineItems.reduce(
        (sum, item) => sum + (parseFloat(item.amount) || 0),
        0
    );

    updated.marketingToolingCostLineItems = normalizeMarketIdOnItems(
        filterCompleteLineItems(updated.marketingToolingCostLineItems || [])
    );
    updated.marketingToolingCost = updated.marketingToolingCostLineItems.reduce(
        (sum, item) => sum + (parseFloat(item.amount) || 0),
        0
    );

    updated.fixedExpensesLineItems = normalizeMarketIdOnItems(
        filterCompleteLineItems(updated.fixedExpensesLineItems || [])
    );
    updated.fixedExpenses = updated.fixedExpensesLineItems.reduce(
        (sum, item) => sum + (parseFloat(item.amount) || 0),
        0
    );

    updated.marketVariableCosts = (updated.marketVariableCosts || [])
        .filter((row) => row && String(row.marketId || "").trim())
        .map((row) => ({
            marketId: String(row.marketId).trim(),
            marketName: String(row.marketName || "").trim(),
            shippingCostPerOrder:
                row.shippingCostPerOrder === "" || row.shippingCostPerOrder == null
                    ? null
                    : Number(row.shippingCostPerOrder) || 0,
            pickNPackCostPerOrder:
                row.pickNPackCostPerOrder === "" || row.pickNPackCostPerOrder == null
                    ? null
                    : Number(row.pickNPackCostPerOrder) || 0,
        }));

    updated.shippingMethodCosts = (updated.shippingMethodCosts || [])
        .map((row) => ({
            name: String(row?.name || "").trim(),
            costPerOrder:
                row?.costPerOrder === "" || row?.costPerOrder == null
                    ? 0
                    : Number(row.costPerOrder) || 0,
        }))
        .filter((row) => row.name);

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

export function getMonthlyMarketingBureauTotal(staticExp = {}, options = {}) {
    const mode = options.mode || "all";
    return monthlyTotalFromFilteredItems(
        staticExp,
        "marketingBureauCostLineItems",
        "marketingBureauCost",
        mode,
        options
    );
}

export function getMonthlyMarketingToolingTotal(staticExp = {}, options = {}) {
    const mode = options.mode || "all";
    return monthlyTotalFromFilteredItems(
        staticExp,
        "marketingToolingCostLineItems",
        "marketingToolingCost",
        mode,
        options
    );
}

export function getMonthlyOtherFixedTotal(staticExp = {}, options = {}) {
    const mode = options.mode || "all";
    return monthlyTotalFromFilteredItems(
        staticExp,
        "fixedExpensesLineItems",
        "fixedExpenses",
        mode,
        options
    );
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

/**
 * Fixed costs for a date range (bureau + tooling + other), prorated per calendar day.
 * @param {object} [options] — same market scope as getMonthlyFixedExpensesTotal
 */
export function calcFixedCostsForDateRange(rangeStart, rangeEnd, staticExp = {}, options = {}) {
    return calcProratedMonthlyCostForDateRange(
        getMonthlyFixedExpensesTotal(staticExp, options),
        rangeStart,
        rangeEnd
    );
}

/** Fixed costs for a single calendar day. */
export function calcFixedCostForSingleDay(dateYmd, staticExp = {}, options = {}) {
    return getMonthlyFixedExpensesTotal(staticExp, options) / dayjs(dateYmd).daysInMonth();
}

/**
 * Flat list for performance dashboard fixed-expense breakdown rows.
 * @param {object} [options] — same market scope as getMonthlyFixedExpensesTotal
 *   (`mode: 'selection'|'market'|'all'|…`, `marketIds`, `marketId`)
 * @returns {{ key: string, metricKey: string, label: string, amount: number, marketId?: string|null }[]}
 */
export function getFixedExpensesBreakdownLineItems(staticExp = {}, options = {}) {
    const mode = options.mode || "all";
    const opts = { marketId: options.marketId, marketIds: options.marketIds };
    const rows = [];
    const pushGroup = (items, prefix) => {
        const filtered = filterFixedLineItemsByMarket(items, mode, opts);
        filtered.forEach((item, i) => {
            if (!item?.name?.trim()) return;
            rows.push({
                key: `${prefix}_${i}`,
                metricKey: `${prefix}_${i}`,
                label: String(item.name).trim(),
                amount: parseFloat(item.amount) || 0,
                marketId: lineItemMarketId(item),
            });
        });
    };
    pushGroup(staticExp.marketingBureauCostLineItems, "fixed_bureau");
    pushGroup(staticExp.marketingToolingCostLineItems, "fixed_tooling");
    pushGroup(staticExp.fixedExpensesLineItems, "fixed_other");
    return rows;
}
