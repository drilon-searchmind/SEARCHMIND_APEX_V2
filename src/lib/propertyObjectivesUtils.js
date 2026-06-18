/**
 * Property objectives helpers — global and per-Shopify-market.
 */

export const PROPERTY_OBJECTIVES_MODE_GLOBAL = "global";
export const PROPERTY_OBJECTIVES_MODE_PER_MARKET = "per_market";

export const PROPERTY_OBJECTIVE_MONTHS = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
];

/** @returns {Record<string, { period: string, revenueTarget: number, marketingBudget: number }>} */
export function createEmptyMonthlyObjectives() {
    return Object.fromEntries(
        PROPERTY_OBJECTIVE_MONTHS.map((month) => [
            month,
            { period: month, revenueTarget: 0, marketingBudget: 0 },
        ])
    );
}

/** Normalize Mongoose Map or plain object from API. */
export function normalizeMarketPropertyObjectives(raw) {
    if (!raw) return {};
    if (raw instanceof Map) return Object.fromEntries(raw.entries());
    if (typeof raw === "object") return { ...raw };
    return {};
}

/** @param {Record<string, unknown> | null | undefined} customer */
export function customerMarketPropertyObjectivesHasData(customer) {
    const marketObjectives = normalizeMarketPropertyObjectives(
        customer?.CustomerMarketPropertyObjectives
    );
    return Object.values(marketObjectives).some(marketObjectivesHasData);
}

/**
 * Resolve which objectives mode is active for a Shopify Markets customer.
 * Legacy customers without an explicit mode infer from existing per-market data.
 * @param {Record<string, unknown> | null | undefined} customer
 */
export function resolvePropertyObjectivesMode(customer) {
    const stored = customer?.CustomerSettings?.propertyObjectivesMode;
    if (
        stored === PROPERTY_OBJECTIVES_MODE_GLOBAL ||
        stored === PROPERTY_OBJECTIVES_MODE_PER_MARKET
    ) {
        return stored;
    }

    return customerMarketPropertyObjectivesHasData(customer)
        ? PROPERTY_OBJECTIVES_MODE_PER_MARKET
        : PROPERTY_OBJECTIVES_MODE_GLOBAL;
}

/** @param {Record<string, unknown> | null | undefined} objectives */
export function marketObjectivesHasData(objectives) {
    if (!objectives || typeof objectives !== "object") return false;
    return PROPERTY_OBJECTIVE_MONTHS.some((month) => {
        const row = objectives[month];
        if (!row || typeof row !== "object") return false;
        const revenue = Number(row.revenueTarget);
        const budget = Number(row.marketingBudget);
        return (Number.isFinite(revenue) && revenue > 0) || (Number.isFinite(budget) && budget > 0);
    });
}

/**
 * Sum monthly revenue targets and marketing budgets across multiple objective sets.
 * @param {Array<Record<string, { revenueTarget?: number, marketingBudget?: number }>>} objectivesList
 */
export function mergePropertyObjectives(objectivesList) {
    const merged = createEmptyMonthlyObjectives();
    for (const objectives of objectivesList || []) {
        if (!objectives || typeof objectives !== "object") continue;
        for (const month of PROPERTY_OBJECTIVE_MONTHS) {
            const row = objectives[month];
            if (!row || typeof row !== "object") continue;
            const revenue = Number(row.revenueTarget);
            const budget = Number(row.marketingBudget);
            if (Number.isFinite(revenue)) merged[month].revenueTarget += revenue;
            if (Number.isFinite(budget)) merged[month].marketingBudget += budget;
        }
    }
    return merged;
}

/**
 * Resolve objectives for dashboard views based on Shopify Markets filter.
 * - Non-markets customers: CustomerPropertyObjectives
 * - Markets + global mode: CustomerPropertyObjectives (same for all market filters)
 * - Markets + per_market mode: sum per-market rows for enabled markets
 * - No markets selected (per_market): zero targets
 */
export function resolvePropertyObjectives({
    customer,
    shopifyMarketsFeatureOn = false,
    shopifyMarkets = [],
    appliedExcludedMarkets = {},
}) {
    const global = customer?.CustomerPropertyObjectives || {};

    if (!shopifyMarketsFeatureOn || !Array.isArray(shopifyMarkets) || shopifyMarkets.length === 0) {
        return global;
    }

    if (resolvePropertyObjectivesMode(customer) === PROPERTY_OBJECTIVES_MODE_GLOBAL) {
        return global;
    }

    const marketObjectives = normalizeMarketPropertyObjectives(
        customer?.CustomerMarketPropertyObjectives
    );

    const enabledMarkets = shopifyMarkets.filter(
        (m) => appliedExcludedMarkets[m.shopifyqlMarketId] !== true
    );

    if (enabledMarkets.length === 0) {
        return createEmptyMonthlyObjectives();
    }

    const listsToMerge = enabledMarkets.map(
        (m) => marketObjectives[String(m.shopifyqlMarketId)] || {}
    );

    return mergePropertyObjectives(listsToMerge);
}

/** Human-readable label for which markets drive the current objective totals. */
export function getObjectivesScopeLabel({
    customer = null,
    shopifyMarketsFeatureOn = false,
    shopifyMarkets = [],
    appliedExcludedMarkets = {},
}) {
    if (!shopifyMarketsFeatureOn || !shopifyMarkets.length) return null;

    if (resolvePropertyObjectivesMode(customer) === PROPERTY_OBJECTIVES_MODE_GLOBAL) {
        return "Global";
    }

    const enabled = shopifyMarkets.filter(
        (m) => appliedExcludedMarkets[m.shopifyqlMarketId] !== true
    );

    if (enabled.length === 0) return "No markets selected";
    if (enabled.length === shopifyMarkets.length) return "All markets";
    if (enabled.length === 1) {
        const m = enabled[0];
        return m.name || m.handle || "1 market";
    }
    return `${enabled.length} markets`;
}
