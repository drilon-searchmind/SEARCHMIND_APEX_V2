/**
 * Aura custom-dashboard customers (Emob, EL, Fiber) — matched by `customerName`.
 * Legacy name "Aura DK" is treated as Emob until renamed to "Aura - EMOB".
 */

export const AURA_CUSTOMER_NAMES = [
    "Aura DK",
    "Aura - EMOB",
    "Aura - EL",
    "Aura - Fiber",
];

function normalizeName(name) {
    return String(name || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
}

export function isAuraCustomerName(customerName) {
    const n = normalizeName(customerName);
    return AURA_CUSTOMER_NAMES.some((allowed) => normalizeName(allowed) === n);
}

/** "Other" cost channel in hand-entered campaign budgets (`auraInputs.otherCostSeries`). */
export function auraCostChannelForCustomerName(customerName) {
    const n = normalizeName(customerName);
    if (n === "aura - el") return "EL";
    if (n === "aura - fiber") return "Fiber";
    return "Emob";
}

/** Short label for dashboard headings. */
export function auraHeadingLabel(customerName) {
    const n = normalizeName(customerName);
    if (n === "aura - emob" || n === "aura dk") return "Aura EMOB";
    if (n === "aura - el") return "Aura EL";
    if (n === "aura - fiber") return "Aura Fiber";
    return String(customerName || "Aura").trim() || "Aura";
}