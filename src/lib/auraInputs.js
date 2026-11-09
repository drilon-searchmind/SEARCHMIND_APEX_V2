/**
 * Aura DK values that are typed in by hand (they used to live as static values in the Google Sheet) and the
 * pure helpers that turn them into the daily series the dashboard needs. Safe to import on server and client.
 *
 * Stored per customer under the dashboard "aura" in CustomDashboardInput:
 *  - conversions: [{ date, value, ejeNy, ejeEks, lejeNy, lejeEks }]  daily Emob conversions
 *  - campaigns:   [{ name, channel, budget, startDate, endDate }]    planned campaign budgets ("Other" cost)
 *  - goals:       [{ goal, budget }] x 12                            monthly customer goal and budget (Jan to Dec)
 *  - filter:      { enabled, google: {...}, meta: {...} }            account wide campaign name filter, see normalizeFilter
 */

export const AURA_INPUT_KEYS = ["conversions", "campaigns", "goals", "filter"];

/** "Kanal" in the sheet. Only Emob feeds the Aura dashboard, the others are kept for reference. */
export const AURA_CHANNELS = ["Emob", "EL", "Fiber"];
export const AURA_COST_CHANNEL = "Emob";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

/** Daily Emob conversions: the sum of the four breakdown columns when any is filled in, otherwise the stored total. */
export function conversionTotal(row) {
    const parts = [row?.ejeNy, row?.ejeEks, row?.lejeNy, row?.lejeEks];
    const hasBreakdown = parts.some((p) => p !== null && p !== undefined && p !== "");
    return hasBreakdown ? parts.reduce((s, p) => s + num(p), 0) : num(row?.value);
}

function eachDate(startDate, endDate, fn) {
    const d = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);
    for (; d <= end; d.setUTCDate(d.getUTCDate() + 1)) fn(d.toISOString().slice(0, 10));
}

/**
 * Daily "Other" cost between two dates: each campaign's budget spread evenly over its start..end days
 * (Dagsbudget = budget / number of days), summed for the campaigns that are active that day.
 */
export function otherCostSeries(campaigns, startDate, endDate, channel = AURA_COST_CHANNEL) {
    const active = (campaigns || [])
        .filter((c) => c.channel === channel && ISO.test(c.startDate) && ISO.test(c.endDate) && c.endDate >= c.startDate)
        .map((c) => {
            const days = Math.round((new Date(`${c.endDate}T00:00:00Z`) - new Date(`${c.startDate}T00:00:00Z`)) / 86400000) + 1;
            return { start: c.startDate, end: c.endDate, daily: num(c.budget) / days };
        });
    const out = [];
    eachDate(startDate, endDate, (date) => {
        let value = 0;
        for (const c of active) if (date >= c.start && date <= c.end) value += c.daily;
        out.push({ date, value });
    });
    return out;
}

/** Daily conversions between two dates (days without a row count as 0). */
export function conversionSeries(rows, startDate, endDate) {
    const byDate = new Map((rows || []).map((r) => [r.date, conversionTotal(r)]));
    const out = [];
    eachDate(startDate, endDate, (date) => out.push({ date, value: byDate.get(date) || 0 }));
    return out;
}

/** 12 monthly goals (Jan to Dec). Missing values are 0. */
export function normalizeGoals(goals) {
    return Array.from({ length: 12 }, (_, i) => ({ goal: num(goals?.[i]?.goal), budget: num(goals?.[i]?.budget) }));
}

const text = (v, max) => String(v ?? "").trim().slice(0, max);

/**
 * The account wide campaign filter. Per channel (google, meta): `include` and `exclude` are comma separated
 * "name contains" terms, `excludeExact` is a list of exact campaign names picked in the filter test tool.
 */
export function normalizeFilter(filter) {
    const channel = (c) => ({
        include: text(c?.include, 500),
        exclude: text(c?.exclude, 500),
        excludeExact: Array.isArray(c?.excludeExact)
            ? [...new Set(c.excludeExact.map((n) => text(n, 300)).filter(Boolean))].slice(0, 300)
            : [],
    });
    return { enabled: filter?.enabled === true, google: channel(filter?.google), meta: channel(filter?.meta) };
}

/** Validates and cleans what the editor sends. Throws with a readable message. */
export function sanitizeAuraInput(key, data) {
    if (!AURA_INPUT_KEYS.includes(key)) throw new Error(`Unknown input "${key}"`);
    if (key === "goals") return normalizeGoals(data);
    if (key === "filter") return normalizeFilter(data);
    if (!Array.isArray(data)) throw new Error("Expected a list");
    if (data.length > 5000) throw new Error("Too many rows");
    const optionalNumber = (v) => (v === "" || v === null || v === undefined ? null : num(v));
    if (key === "conversions") {
        const seen = new Set();
        return data
            .map((r) => ({
                date: String(r.date || ""),
                value: num(r.value),
                ejeNy: optionalNumber(r.ejeNy),
                ejeEks: optionalNumber(r.ejeEks),
                lejeNy: optionalNumber(r.lejeNy),
                lejeEks: optionalNumber(r.lejeEks),
            }))
            .filter((r) => {
                if (!ISO.test(r.date)) throw new Error(`Invalid date "${r.date}"`);
                if (seen.has(r.date)) throw new Error(`Duplicate date ${r.date}`);
                seen.add(r.date);
                return true;
            })
            .sort((a, b) => a.date.localeCompare(b.date));
    }
    return data.map((c) => {
        const row = {
            name: String(c.name || "").trim().slice(0, 200),
            channel: AURA_CHANNELS.includes(c.channel) ? c.channel : AURA_COST_CHANNEL,
            budget: num(c.budget),
            startDate: String(c.startDate || ""),
            endDate: String(c.endDate || ""),
        };
        if (!row.name) throw new Error("Every campaign needs a name");
        if (!ISO.test(row.startDate) || !ISO.test(row.endDate)) throw new Error(`"${row.name}" needs a start and end date`);
        if (row.endDate < row.startDate) throw new Error(`"${row.name}" ends before it starts`);
        return row;
    });
}
