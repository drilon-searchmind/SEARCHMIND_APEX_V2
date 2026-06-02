/**
 * Shared helpers for parent-group ad campaign exclusions (by id and by name keyword).
 */

/** @param {unknown} keywords */
export function normalizeCampaignNameKeywords(keywords) {
    if (!Array.isArray(keywords)) return [];
    const seen = new Set();
    const out = [];
    for (const raw of keywords) {
        const k = String(raw ?? "").trim();
        if (!k) continue;
        const key = k.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(k);
    }
    return out;
}

/**
 * @param {string} [name]
 * @param {string[]} [keywords]
 */
export function campaignNameMatchesKeywords(name, keywords) {
    const list = normalizeCampaignNameKeywords(keywords);
    if (!list.length) return false;
    const n = String(name ?? "").toLowerCase();
    return list.some((kw) => n.includes(kw.toLowerCase()));
}

/**
 * @param {{ id?: unknown, name?: unknown }} campaign
 * @param {{ excludedIds?: string[], excludedNameKeywords?: string[] }} filters
 * @param {(id: unknown) => string} normalizeId
 */
export function shouldExcludeAdCampaign(
    campaign,
    { excludedIds = [], excludedNameKeywords = [] } = {},
    normalizeId = (id) => String(id ?? "").trim()
) {
    const ids = (excludedIds || []).map(normalizeId).filter(Boolean);
    if (ids.length > 0) {
        const key = normalizeId(campaign?.id);
        if (key && ids.includes(key)) return true;
    }
    return campaignNameMatchesKeywords(campaign?.name, excludedNameKeywords);
}

/**
 * @param {boolean | undefined} hasIdExclusions
 * @param {string[] | undefined} keywords
 */
export function adCampaignFilterActive(hasIdExclusions, keywords) {
    const idActive = Boolean(hasIdExclusions);
    const kwActive = normalizeCampaignNameKeywords(keywords).length > 0;
    return idActive || kwActive;
}
