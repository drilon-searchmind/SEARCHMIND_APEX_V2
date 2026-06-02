import mongoose from "mongoose";
import CustomerFilters from "@/models/CustomerFilters";
import { normalizeMongoId } from "@/lib/parentPropertyGoogleAdsCampaignOverrides";
import { normalizeGoogleAdsCampaignId } from "@/lib/googleAdsCampaignIdUtils";
import { normalizeMetaAdsCampaignId } from "@/lib/metaAdsCampaignIdUtils";
import { normalizeCampaignNameKeywords } from "@/lib/adCampaignFilterUtils";

/**
 * @param {unknown} row
 * @param {(id: unknown) => string} normalizeCampaignId
 */
function childRowToClientMaps(row, normalizeCampaignId) {
    const cid = normalizeMongoId(row?.customerId);
    if (!cid) return null;

    /** @type {Record<string, true>} */
    const excludedMap = {};
    for (const id of row.excludedCampaignIds || []) {
        const key = normalizeCampaignId(id);
        if (key) excludedMap[key] = true;
    }

    const keywords = normalizeCampaignNameKeywords(row.excludedCampaignNameKeywords);

    if (Object.keys(excludedMap).length === 0 && keywords.length === 0) return null;

    return { childId: cid, excludedMap, keywords };
}

/**
 * @param {unknown} doc
 * @param {'googleAds'|'metaAds'} platformKey
 * @param {(id: unknown) => string} normalizeCampaignId
 */
function adPlatformFiltersDocToClientState(doc, platformKey, normalizeCampaignId) {
    /** @type {Record<string, Record<string, true>>} */
    const excludedByChildId = {};
    /** @type {Record<string, string[]>} */
    const excludedKeywordsByChildId = {};

    for (const row of doc?.[platformKey]?.children || []) {
        const parsed = childRowToClientMaps(row, normalizeCampaignId);
        if (!parsed) continue;
        if (Object.keys(parsed.excludedMap).length > 0) {
            excludedByChildId[parsed.childId] = parsed.excludedMap;
        }
        if (parsed.keywords.length > 0) {
            excludedKeywordsByChildId[parsed.childId] = parsed.keywords;
        }
    }

    return {
        filterEnabled: doc?.[platformKey]?.filterEnabled === true,
        excludedByChildId,
        excludedKeywordsByChildId,
    };
}

export function googleAdsFiltersDocToClientState(doc) {
    return adPlatformFiltersDocToClientState(doc, "googleAds", normalizeGoogleAdsCampaignId);
}

export function metaAdsFiltersDocToClientState(doc) {
    return adPlatformFiltersDocToClientState(doc, "metaAds", normalizeMetaAdsCampaignId);
}

/**
 * @param {unknown} doc
 * @param {'googleAds'|'metaAds'} platformKey
 * @param {(id: unknown) => string} normalizeCampaignId
 */
function adPlatformFiltersDocToAggregatedOverrides(doc, platformKey, normalizeCampaignId) {
    /** @type {Record<string, { exclude: string[], excludeNameKeywords: string[] }>} */
    const out = {};
    if (doc?.[platformKey]?.filterEnabled !== true) return out;

    for (const row of doc[platformKey]?.children || []) {
        const cid = normalizeMongoId(row.customerId);
        if (!cid) continue;
        const exclude = (row.excludedCampaignIds || [])
            .map((id) => normalizeCampaignId(id))
            .filter(Boolean);
        const excludeNameKeywords = normalizeCampaignNameKeywords(
            row.excludedCampaignNameKeywords
        );
        if (exclude.length > 0 || excludeNameKeywords.length > 0) {
            out[cid] = { exclude, excludeNameKeywords };
        }
    }
    return out;
}

export function googleAdsFiltersDocToAggregatedOverrides(doc) {
    return adPlatformFiltersDocToAggregatedOverrides(
        doc,
        "googleAds",
        normalizeGoogleAdsCampaignId
    );
}

export function metaAdsFiltersDocToAggregatedOverrides(doc) {
    return adPlatformFiltersDocToAggregatedOverrides(doc, "metaAds", normalizeMetaAdsCampaignId);
}

/**
 * @param {string} parentCustomerId
 * @returns {Promise<import('mongoose').FlattenMaps<unknown> | null>}
 */
export async function getCustomerFiltersByParentId(parentCustomerId) {
    const parentId = normalizeMongoId(parentCustomerId);
    if (!parentId || !mongoose.Types.ObjectId.isValid(parentId)) return null;
    return CustomerFilters.findOne({
        parentCustomerId: new mongoose.Types.ObjectId(parentId),
    }).lean();
}

/**
 * @param {Array<{ customerId?: unknown, excludedCampaignIds?: string[], excludedCampaignNameKeywords?: string[] }>} children
 * @param {(id: unknown) => string} normalizeCampaignId
 */
function normalizeChildrenForDb(children, normalizeCampaignId) {
    return (children || [])
        .map((row) => {
            const cid = normalizeMongoId(row.customerId);
            if (!cid || !mongoose.Types.ObjectId.isValid(cid)) return null;
            const excludedCampaignIds = (row.excludedCampaignIds || [])
                .map((id) => normalizeCampaignId(id))
                .filter(Boolean);
            const excludedCampaignNameKeywords = normalizeCampaignNameKeywords(
                row.excludedCampaignNameKeywords
            );
            if (
                excludedCampaignIds.length === 0 &&
                excludedCampaignNameKeywords.length === 0
            ) {
                return null;
            }
            return {
                customerId: new mongoose.Types.ObjectId(cid),
                excludedCampaignIds,
                excludedCampaignNameKeywords,
            };
        })
        .filter(Boolean);
}

async function writePlatformFilters(parentId, platformKey, platformPayload) {
    return CustomerFilters.findOneAndUpdate(
        { parentCustomerId: new mongoose.Types.ObjectId(parentId) },
        {
            $set: {
                [platformKey]: platformPayload,
                updatedAt: new Date(),
            },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
}

/**
 * @param {'googleAds'|'metaAds'} platformKey
 * @param {(id: unknown) => string} normalizeCampaignId
 */
async function saveChildCampaignExclusions(
    platformKey,
    normalizeCampaignId,
    parentCustomerId,
    childCustomerId,
    excludedCampaignIds,
    excludedCampaignNameKeywords,
    filterEnabled
) {
    const parentId = normalizeMongoId(parentCustomerId);
    const childId = normalizeMongoId(childCustomerId);
    if (!parentId || !mongoose.Types.ObjectId.isValid(parentId)) {
        throw new Error("Invalid parent customer id");
    }
    if (!childId || !mongoose.Types.ObjectId.isValid(childId)) {
        throw new Error("Invalid child customer id");
    }

    const ids = (excludedCampaignIds || [])
        .map((id) => normalizeCampaignId(id))
        .filter(Boolean);
    const keywords = normalizeCampaignNameKeywords(excludedCampaignNameKeywords);

    const existing = await getCustomerFiltersByParentId(parentId);
    /** @type {Map<string, { ids: string[], keywords: string[] }>} */
    const byChild = new Map();

    for (const row of existing?.[platformKey]?.children || []) {
        const cid = normalizeMongoId(row.customerId);
        if (!cid) continue;
        byChild.set(cid, {
            ids: (row.excludedCampaignIds || [])
                .map((id) => normalizeCampaignId(id))
                .filter(Boolean),
            keywords: normalizeCampaignNameKeywords(row.excludedCampaignNameKeywords),
        });
    }

    if (ids.length > 0 || keywords.length > 0) {
        byChild.set(childId, { ids, keywords });
    } else {
        byChild.delete(childId);
    }

    const children = [...byChild.entries()].map(([customerId, v]) => ({
        customerId: new mongoose.Types.ObjectId(customerId),
        excludedCampaignIds: v.ids,
        excludedCampaignNameKeywords: v.keywords,
    }));

    return writePlatformFilters(parentId, platformKey, {
        filterEnabled: filterEnabled === true,
        children,
    });
}

export async function saveGoogleAdsChildCampaignExclusions(
    parentCustomerId,
    childCustomerId,
    excludedCampaignIds,
    filterEnabled,
    excludedCampaignNameKeywords = []
) {
    return saveChildCampaignExclusions(
        "googleAds",
        normalizeGoogleAdsCampaignId,
        parentCustomerId,
        childCustomerId,
        excludedCampaignIds,
        excludedCampaignNameKeywords,
        filterEnabled
    );
}

export async function saveMetaAdsChildCampaignExclusions(
    parentCustomerId,
    childCustomerId,
    excludedCampaignIds,
    filterEnabled,
    excludedCampaignNameKeywords = []
) {
    return saveChildCampaignExclusions(
        "metaAds",
        normalizeMetaAdsCampaignId,
        parentCustomerId,
        childCustomerId,
        excludedCampaignIds,
        excludedCampaignNameKeywords,
        filterEnabled
    );
}

async function setPlatformFilterEnabled(parentCustomerId, platformKey, filterEnabled) {
    const parentId = normalizeMongoId(parentCustomerId);
    if (!parentId || !mongoose.Types.ObjectId.isValid(parentId)) {
        throw new Error("Invalid parent customer id");
    }

    const existing = await getCustomerFiltersByParentId(parentId);
    const normalizeId =
        platformKey === "googleAds"
            ? normalizeGoogleAdsCampaignId
            : normalizeMetaAdsCampaignId;
    const children = normalizeChildrenForDb(existing?.[platformKey]?.children || [], normalizeId);

    return writePlatformFilters(parentId, platformKey, {
        filterEnabled: filterEnabled === true,
        children,
    });
}

export async function setGoogleAdsFilterEnabled(parentCustomerId, filterEnabled) {
    return setPlatformFilterEnabled(parentCustomerId, "googleAds", filterEnabled);
}

export async function setMetaAdsFilterEnabled(parentCustomerId, filterEnabled) {
    return setPlatformFilterEnabled(parentCustomerId, "metaAds", filterEnabled);
}
