/**
 * SEO keyword filter config — brand, exact groups, partial groups.
 * Only enabled filters take effect on dashboard data.
 */

function normalizeKeyword(value) {
    return String(value || "").trim().toLowerCase();
}

/**
 * @param {{ brandDoc?: object|null, exactGroups?: object[], partialGroups?: object[] }} input
 */
export function buildSeoKeywordFilterConfig({ brandDoc, exactGroups = [], partialGroups = [] }) {
    const brandKeywords = Array.isArray(brandDoc?.keywords) ? brandDoc.keywords : [];
    return {
        brand: {
            keywords: brandKeywords,
            enabled: brandDoc?.isActive === true && brandKeywords.length > 0,
        },
        exactGroups: (exactGroups || []).map((g) => ({
            id: String(g._id || g.id || ""),
            name: String(g.name || "Exact group"),
            keywords: Array.isArray(g.keywords) ? g.keywords : [],
            enabled: g.isActive === true,
        })),
        partialGroups: (partialGroups || []).map((g) => ({
            id: String(g._id || g.id || ""),
            name: String(g.name || "Partial group"),
            keywords: Array.isArray(g.keywords) ? g.keywords : [],
            enabled: g.isActive === true,
        })),
    };
}

/** @param {ReturnType<typeof buildSeoKeywordFilterConfig>} config */
export function getEnabledBrandTerms(config) {
    return config?.brand?.enabled ? config.brand.keywords : [];
}

/** @param {ReturnType<typeof buildSeoKeywordFilterConfig>} config */
export function hasActiveKeywordGroupFilters(config) {
    return (
        (config?.exactGroups || []).some((g) => g.enabled && g.keywords.length > 0) ||
        (config?.partialGroups || []).some((g) => g.enabled && g.keywords.length > 0)
    );
}

/**
 * @param {string} query
 * @param {ReturnType<typeof buildSeoKeywordFilterConfig>} config
 */
export function queryMatchesKeywordGroupFilters(query, config) {
    if (!hasActiveKeywordGroupFilters(config)) return true;

    const q = normalizeKeyword(query);
    if (!q) return false;

    for (const group of config.exactGroups || []) {
        if (!group.enabled || !group.keywords.length) continue;
        if (group.keywords.some((term) => q === normalizeKeyword(term))) return true;
    }

    for (const group of config.partialGroups || []) {
        if (!group.enabled || !group.keywords.length) continue;
        if (group.keywords.some((term) => q.includes(normalizeKeyword(term)))) return true;
    }

    return false;
}

/**
 * @param {Array<{ keys?: string[], clicks?: number, impressions?: number, ctr?: number, position?: number }>} rows
 * @param {ReturnType<typeof buildSeoKeywordFilterConfig>} config
 */
export function filterGscQueryRows(rows, config) {
    if (!hasActiveKeywordGroupFilters(config)) return rows || [];
    return (rows || []).filter((row) => queryMatchesKeywordGroupFilters(row.keys?.[0], config));
}

/**
 * @param {Array<{ keys?: string[], clicks?: number, impressions?: number, position?: number }>} rows
 */
export function aggregateGscQueryRowsToDaily(rows) {
    /** @type {Record<string, { clicks: number, impressions: number, posSum: number, impForPos: number }>} */
    const byDate = {};

    for (const row of rows || []) {
        const date = row.keys?.[0];
        if (!date) continue;
        if (!byDate[date]) {
            byDate[date] = { clicks: 0, impressions: 0, posSum: 0, impForPos: 0 };
        }
        const bucket = byDate[date];
        const clicks = row.clicks || 0;
        const impressions = row.impressions || 0;
        bucket.clicks += clicks;
        bucket.impressions += impressions;
        bucket.posSum += (row.position || 0) * impressions;
        bucket.impForPos += impressions;
    }

    return Object.keys(byDate)
        .sort()
        .map((date) => {
            const b = byDate[date];
            const ctr = b.impressions > 0 ? b.clicks / b.impressions : 0;
            const position = b.impForPos > 0 ? b.posSum / b.impForPos : 0;
            return {
                keys: [date],
                clicks: b.clicks,
                impressions: b.impressions,
                ctr,
                position,
            };
        });
}

/**
 * Filter query+page rows by keyword groups, then aggregate by page URL.
 * @param {Array<{ keys?: string[] }>} queryPageRows GSC rows with dimensions [query, page]
 * @param {ReturnType<typeof import('./seoKeywordFilters').buildSeoKeywordFilterConfig>} config
 */
export function filterAndAggregateGscPagesFromQueryPage(queryPageRows, config) {
    /** @type {Record<string, { clicks: number, impressions: number, posSum: number, impForPos: number }>} */
    const byPage = {};

    for (const row of queryPageRows || []) {
        const query = row.keys?.[0];
        const page = row.keys?.[1];
        if (!query || !page) continue;
        if (!queryMatchesKeywordGroupFilters(query, config)) continue;

        if (!byPage[page]) {
            byPage[page] = { clicks: 0, impressions: 0, posSum: 0, impForPos: 0 };
        }
        const bucket = byPage[page];
        const clicks = row.clicks || 0;
        const impressions = row.impressions || 0;
        bucket.clicks += clicks;
        bucket.impressions += impressions;
        bucket.posSum += (row.position || 0) * impressions;
        bucket.impForPos += impressions;
    }

    return Object.keys(byPage)
        .map((page) => {
            const b = byPage[page];
            const ctr = b.impressions > 0 ? b.clicks / b.impressions : 0;
            const position = b.impForPos > 0 ? b.posSum / b.impForPos : 0;
            return {
                keys: [page],
                clicks: b.clicks,
                impressions: b.impressions,
                ctr,
                position,
            };
        })
        .sort((a, b) => (b.clicks || 0) - (a.clicks || 0));
}

/**
 * @param {ReturnType<typeof buildSeoKeywordFilterConfig>} config
 */
export function buildAppliedFilterDescriptors(config) {
    /** @type {Array<{ type: string, id: string, name: string }>} */
    const descriptors = [];

    if (config?.brand?.enabled) {
        descriptors.push({
            type: "brand",
            id: "brand",
            name: "Brand keywords",
        });
    }

    for (const group of config?.exactGroups || []) {
        if (!group.enabled || !group.keywords.length) continue;
        descriptors.push({
            type: "exact",
            id: group.id,
            name: group.name,
        });
    }

    for (const group of config?.partialGroups || []) {
        if (!group.enabled || !group.keywords.length) continue;
        descriptors.push({
            type: "partial",
            id: group.id,
            name: group.name,
        });
    }

    return descriptors;
}

/**
 * Which filters apply to a dashboard section (for badge display).
 * @param {string} sectionId
 * @param {ReturnType<typeof buildAppliedFilterDescriptors>} appliedFilters
 */
export function appliedFiltersForSection(sectionId, appliedFilters) {
    const list = appliedFilters || [];
    if (!list.length) return [];

    if (sectionId === "brand-chart") {
        return list.filter((f) => f.type === "brand");
    }

    const keywordScoped = new Set([
        "default-kpis",
        "default-chart",
        "volume-potential",
        "keyword-overview",
        "cannibalization",
    ]);
    const pageScoped = new Set(["top-landing-pages"]);

    if (keywordScoped.has(sectionId)) {
        return list.filter((f) => f.type === "exact" || f.type === "partial" || f.type === "brand");
    }
    if (pageScoped.has(sectionId)) {
        return list.filter((f) => f.type === "exact" || f.type === "partial");
    }
    return list;
}
