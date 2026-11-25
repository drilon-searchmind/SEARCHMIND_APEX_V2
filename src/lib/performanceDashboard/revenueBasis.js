/**
 * Daily Overview revenue basis: net after returns vs net without returns deduction.
 */

import { shopifyDeductionMagnitudes } from "./computePerformanceMetrics";
import { applyVatDisplayToShopifyDayRow } from "@/lib/revenueVatDisplay";
import { getReturnsOverrideSettings } from "./performanceDashboardConstants";

export const REVENUE_BASIS_AFTER_RETURNS = "after_returns";
export const REVENUE_BASIS_BEFORE_RETURNS = "before_returns";

export const REVENUE_BASIS_OPTIONS = [
    { value: REVENUE_BASIS_AFTER_RETURNS, label: "Net revenue" },
    { value: REVENUE_BASIS_BEFORE_RETURNS, label: "Net revenue uden retur" },
];

/**
 * Positive returns amount for a Shopify day (store or returns-% override).
 */
export function returnsAmountForShopifyDay(shopifyDay, customerSettings = {}, returnsOverride = null) {
    const day = applyVatDisplayToShopifyDayRow(shopifyDay, customerSettings);
    const override = returnsOverride ?? getReturnsOverrideSettings(customerSettings);
    const gross = Number(day.gross_sales) || 0;
    if (override?.enabled) {
        return gross * ((override.percent ?? 0) / 100);
    }
    const { returnDeduction } = shopifyDeductionMagnitudes(day.discounts, day.returns);
    return returnDeduction;
}

/**
 * Net revenue before returns deduction = after-returns revenue + returns magnitude.
 * (When after-returns already excludes returns, adding them back yields “uden retur”.)
 */
export function netRevenueBeforeReturns(netRevenueAfterReturns, returnsAmount) {
    return (Number(netRevenueAfterReturns) || 0) + (Number(returnsAmount) || 0);
}

export function isBeforeReturnsBasis(basis) {
    return basis === REVENUE_BASIS_BEFORE_RETURNS;
}

export function revenueBasisLabel(basis) {
    return isBeforeReturnsBasis(basis) ? "Net revenue uden retur" : "Net Revenue";
}
