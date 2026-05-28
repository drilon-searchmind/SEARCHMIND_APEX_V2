import mongoose from "mongoose";
import CustomerFilters from "@/models/CustomerFilters";
import { normalizeMongoId } from "@/lib/parentPropertyGoogleAdsCampaignOverrides";
import { normalizeGoogleAdsCampaignId } from "@/lib/googleAdsCampaignIdUtils";

/**
 * @param {unknown} doc — lean CustomerFilters document
 * @returns {{ filterEnabled: boolean, excludedByChildId: Record<string, Record<string, true>> }}
 */
export function googleAdsFiltersDocToClientState(doc) {
    /** @type {Record<string, Record<string, true>>} */
    const excludedByChildId = {};
    const children = doc?.googleAds?.children;
    if (Array.isArray(children)) {
        for (const row of children) {
            const cid = normalizeMongoId(row.customerId);
            if (!cid) continue;
            /** @type {Record<string, true>} */
            const map = {};
            for (const id of row.excludedCampaignIds || []) {
                const key = normalizeGoogleAdsCampaignId(id);
                if (key) map[key] = true;
            }
            if (Object.keys(map).length > 0) excludedByChildId[cid] = map;
        }
    }
    return {
        filterEnabled: doc?.googleAds?.filterEnabled === true,
        excludedByChildId,
    };
}

/**
 * @param {unknown} doc
 * @returns {Record<string, { exclude: string[] }>}
 */
export function googleAdsFiltersDocToAggregatedOverrides(doc) {
    /** @type {Record<string, { exclude: string[] }>} */
    const out = {};
    if (doc?.googleAds?.filterEnabled !== true) return out;

    for (const row of doc.googleAds?.children || []) {
        const cid = normalizeMongoId(row.customerId);
        if (!cid) continue;
        const exclude = (row.excludedCampaignIds || [])
            .map((id) => normalizeGoogleAdsCampaignId(id))
            .filter(Boolean);
        if (exclude.length > 0) out[cid] = { exclude };
    }
    return out;
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
 * @param {Array<{ customerId?: unknown, excludedCampaignIds?: string[] }>} children
 * @returns {Array<{ customerId: mongoose.Types.ObjectId, excludedCampaignIds: string[] }>}
 */
function normalizeChildrenForDb(children) {
    return (children || [])
        .map((row) => {
            const cid = normalizeMongoId(row.customerId);
            if (!cid || !mongoose.Types.ObjectId.isValid(cid)) return null;
            const excludedCampaignIds = (row.excludedCampaignIds || [])
                .map((id) => normalizeGoogleAdsCampaignId(id))
                .filter(Boolean);
            if (excludedCampaignIds.length === 0) return null;
            return {
                customerId: new mongoose.Types.ObjectId(cid),
                excludedCampaignIds,
            };
        })
        .filter(Boolean);
}

async function writeGoogleAdsFilters(parentId, googleAdsPayload) {
    return CustomerFilters.findOneAndUpdate(
        { parentCustomerId: new mongoose.Types.ObjectId(parentId) },
        {
            $set: {
                googleAds: googleAdsPayload,
                updatedAt: new Date(),
            },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
}

/**
 * Save excluded campaigns for one child property (Customer id), within a parent group.
 * @param {string} parentCustomerId
 * @param {string} childCustomerId — child Customer._id (not parent)
 * @param {string[]} excludedCampaignIds
 * @param {boolean} filterEnabled
 */
export async function saveGoogleAdsChildCampaignExclusions(
    parentCustomerId,
    childCustomerId,
    excludedCampaignIds,
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
        .map((id) => normalizeGoogleAdsCampaignId(id))
        .filter(Boolean);

    const existing = await getCustomerFiltersByParentId(parentId);
    /** @type {Map<string, string[]>} */
    const byChild = new Map();

    for (const row of existing?.googleAds?.children || []) {
        const cid = normalizeMongoId(row.customerId);
        if (!cid) continue;
        byChild.set(
            cid,
            (row.excludedCampaignIds || [])
                .map((id) => normalizeGoogleAdsCampaignId(id))
                .filter(Boolean)
        );
    }

    if (ids.length > 0) {
        byChild.set(childId, ids);
    } else {
        byChild.delete(childId);
    }

    const children = [...byChild.entries()].map(([customerId, excludedCampaignIds]) => ({
        customerId: new mongoose.Types.ObjectId(customerId),
        excludedCampaignIds,
    }));

    return writeGoogleAdsFilters(parentId, {
        filterEnabled: filterEnabled === true,
        children,
    });
}

/**
 * Update master toggle only; keeps per-child campaign exclusions.
 */
export async function setGoogleAdsFilterEnabled(parentCustomerId, filterEnabled) {
    const parentId = normalizeMongoId(parentCustomerId);
    if (!parentId || !mongoose.Types.ObjectId.isValid(parentId)) {
        throw new Error("Invalid parent customer id");
    }

    const existing = await getCustomerFiltersByParentId(parentId);
    const children = normalizeChildrenForDb(existing?.googleAds?.children || []);

    return writeGoogleAdsFilters(parentId, {
        filterEnabled: filterEnabled === true,
        children,
    });
}
