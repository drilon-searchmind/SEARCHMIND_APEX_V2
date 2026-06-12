/** Blended POAS break-even: Gross Profit / Ad Spend = 1.0 */
export const POAS_BREAK_EVEN = 1.0;

/**
 * Blended POAS = Gross Profit / Ad Spend (not net profit, not GP minus spend).
 * @param {number | null | undefined} grossProfit
 * @param {number | null | undefined} adSpend
 * @returns {number | null}
 */
export function calcBlendedPoas(grossProfit, adSpend) {
    const gp = Number(grossProfit);
    const spend = Number(adSpend);
    if (!Number.isFinite(gp) || !Number.isFinite(spend) || spend <= 0) return null;
    return gp / spend;
}

/**
 * @param {number | null | undefined} grossProfit
 * @param {number | null | undefined} adSpend
 * @returns {number}
 */
export function calcBlendedPoasOrZero(grossProfit, adSpend) {
    return calcBlendedPoas(grossProfit, adSpend) ?? 0;
}
