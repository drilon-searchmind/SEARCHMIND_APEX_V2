import { parseMonthKey } from "./shareOfSearchBrandGroupsUtils.js";

/**
 * @typedef {{ id: string, name: string, brands: string[] }} ShareOfSearchBrandGroup
 */

/**
 * @param {unknown} groups
 * @returns {ShareOfSearchBrandGroup[]}
 */
export function normalizeBrandGroups(groups) {
    if (!Array.isArray(groups)) return [];
    /** @type {ShareOfSearchBrandGroup[]} */
    const out = [];
    const seenIds = new Set();
    for (const g of groups) {
        if (!g || typeof g !== "object") continue;
        const id = String(g.id || "").trim() || `g-${out.length + 1}`;
        if (seenIds.has(id)) continue;
        seenIds.add(id);
        const name = String(g.name || "").trim() || "Group";
        const brands = [...new Set(
            (Array.isArray(g.brands) ? g.brands : [])
                .map((b) => String(b).trim())
                .filter(Boolean)
        )];
        if (!brands.length) continue;
        out.push({ id, name, brands });
    }
    return out;
}

/**
 * Each brand may only belong to one group (first group wins).
 * @param {ShareOfSearchBrandGroup[]} groups
 */
export function brandToGroupIdMap(groups) {
    /** @type {Map<string, string>} */
    const map = new Map();
    for (const g of groups) {
        for (const b of g.brands) {
            if (!map.has(b)) map.set(b, g.id);
        }
    }
    return map;
}

function sumMonthlyVolumes(rows) {
    /** @type {Map<string, number>} */
    const byMonth = new Map();
    for (const row of rows) {
        const msv = row.monthlySearchVolumes || row.monthly_search_volumes || [];
        for (const m of msv) {
            const k = parseMonthKey(m);
            if (!k) continue;
            const v = Number(m.monthlySearches ?? m.monthly_searches ?? 0);
            byMonth.set(k, (byMonth.get(k) || 0) + v);
        }
    }
    return byMonth;
}

/**
 * Estimate prior-period volume from current volume + share % shift (same brand list).
 * @param {Record<string, unknown>} row
 * @param {"sharePctPreviousPeriod"|"sharePctLastYear"} shareField
 */
function estimateComparisonVolume(row, shareField) {
    const vol = Number(row.volumeInRange) || 0;
    const shareNow = Number(row.sharePct) || 0;
    const shareOther = Number(row[shareField]);
    if (vol <= 0 || shareNow <= 0 || shareOther == null || Number.isNaN(shareOther)) {
        return null;
    }
    return vol * (shareOther / shareNow);
}

/**
 * @param {Record<string, unknown>[]} memberRows
 * @param {Record<string, unknown>[]} allRawRows
 * @param {"sharePctPreviousPeriod"|"sharePctLastYear"} shareField
 */
function groupedComparisonSharePct(memberRows, allRawRows, shareField) {
    let groupVol = 0;
    let totalVol = 0;
    for (const r of allRawRows) {
        const est = estimateComparisonVolume(r, shareField);
        if (est == null) continue;
        totalVol += est;
        if (memberRows.some((m) => m.brand === r.brand)) groupVol += est;
    }
    if (totalVol <= 0) return null;
    return Math.round((groupVol / totalVol) * 10000) / 100;
}

/**
 * @param {Record<string, unknown>[]} rawRows
 * @param {ShareOfSearchBrandGroup[]} groups
 * @param {{ applyGroups?: boolean }} [opts]
 */
export function buildDisplayRowsFromBrandGroups(rawRows, groups, opts = {}) {
    const rows = Array.isArray(rawRows) ? rawRows : [];
    const normalized = normalizeBrandGroups(groups);
    const applyGroups = opts.applyGroups !== false && normalized.length > 0;

    if (!applyGroups || !rows.length) {
        return rows.map((r) => ({
            ...r,
            key: String(r.brand),
            label: String(r.brand),
            isGroup: false,
            memberBrands: [String(r.brand)],
        }));
    }

    const assigned = brandToGroupIdMap(normalized);
    const used = new Set();
    /** @type {Record<string, unknown>[]} */
    const display = [];

    for (const g of normalized) {
        const memberRows = rows.filter((r) => assigned.get(String(r.brand)) === g.id);
        if (!memberRows.length) continue;
        memberRows.forEach((r) => used.add(String(r.brand)));

        const volumeInRange = memberRows.reduce(
            (s, r) => s + (Number(r.volumeInRange) || 0),
            0
        );
        const avgMonthlySearches = memberRows.reduce(
            (s, r) => s + (Number(r.avgMonthlySearches) || 0),
            0
        );
        const monthlyMap = sumMonthlyVolumes(memberRows);
        const monthlySearchVolumes = [...monthlyMap.entries()].map(([ym, vol]) => {
            const [y, mo] = ym.split("-");
            return {
                year: Number(y),
                month: Number(mo),
                monthlySearches: vol,
            };
        });

        display.push({
            key: `group:${g.id}`,
            label: g.name,
            brand: g.name,
            isGroup: true,
            memberBrands: memberRows.map((r) => String(r.brand)),
            apiKeywordText: memberRows.map((r) => r.apiKeywordText || r.brand).join(" · "),
            volumeInRange,
            avgMonthlySearches,
            monthlySearchVolumes,
            sharePct: 0,
            sharePctPreviousPeriod: groupedComparisonSharePct(
                memberRows,
                rows,
                "sharePctPreviousPeriod"
            ),
            sharePctLastYear: groupedComparisonSharePct(
                memberRows,
                rows,
                "sharePctLastYear"
            ),
        });
    }

    for (const r of rows) {
        const b = String(r.brand);
        if (used.has(b)) continue;
        display.push({
            ...r,
            key: b,
            label: b,
            isGroup: false,
            memberBrands: [b],
        });
    }

    const totalVol = display.reduce((s, r) => s + (Number(r.volumeInRange) || 0), 0);
    return display.map((r) => ({
        ...r,
        sharePct:
            totalVol > 0
                ? Math.round(((Number(r.volumeInRange) || 0) / totalVol) * 10000) / 100
                : 0,
    }));
}

/**
 * Map chart/metric selection keys when toggling grouped view.
 * @param {string[]} selectedKeys
 * @param {Record<string, unknown>[]} rawRows
 * @param {ShareOfSearchBrandGroup[]} groups
 * @param {boolean} groupedView
 */
export function remapSelectedChartKeys(selectedKeys, rawRows, groups, groupedView) {
    if (!selectedKeys?.length) return selectedKeys;
    const rawBrands = new Set((rawRows || []).map((r) => String(r.brand)));
    const display = buildDisplayRowsFromBrandGroups(rawRows, groups, {
        applyGroups: groupedView,
    });
    const displayKeys = new Set(display.map((r) => String(r.key)));

    /** @type {string[]} */
    const out = [];
    for (const k of selectedKeys) {
        if (k === "__total__") {
            out.push(k);
            continue;
        }
        if (displayKeys.has(k)) {
            out.push(k);
            continue;
        }
        if (rawBrands.has(k)) {
            const row = display.find(
                (d) =>
                    d.memberBrands?.includes(k) ||
                    String(d.key) === k
            );
            if (row && !out.includes(String(row.key))) out.push(String(row.key));
        }
    }
    if (!out.length && display.length) return display.map((r) => String(r.key));
    return out.filter((k, i) => out.indexOf(k) === i);
}

export function newBrandGroupId() {
    return `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
