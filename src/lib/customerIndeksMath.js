/**
 * current / previous * 100 — null (never 100) when previous is 0 or data is missing.
 * @returns {{ indeks: number|null, status: "ok"|"no_data"|"insufficient_history" }}
 */
export function calcIndeks(current, previous) {
    // Net revenue can dip below 0 (refunds only) — an Indeks is never negative.
    const cur = Math.max(0, Number(current));
    const prev = Number(previous);
    if (!Number.isFinite(cur) || !Number.isFinite(prev)) {
        return { indeks: null, status: "no_data" };
    }
    if (prev > 0) {
        return { indeks: Math.round((cur / prev) * 1000) / 10, status: "ok" };
    }
    if (cur > 0) return { indeks: null, status: "insufficient_history" };
    return { indeks: null, status: "no_data" };
}

export function round2(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
}
