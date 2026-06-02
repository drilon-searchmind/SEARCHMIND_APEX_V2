import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectToDatabase from "@root/lib/mongodb";
import { getParentCustomerById } from "../../../../../../lib/parentCustomerOperations";
import {
    getCustomerFiltersByParentId,
    googleAdsFiltersDocToClientState,
    metaAdsFiltersDocToClientState,
    saveGoogleAdsChildCampaignExclusions,
    saveMetaAdsChildCampaignExclusions,
    setGoogleAdsFilterEnabled,
    setMetaAdsFilterEnabled,
} from "@/lib/customerFiltersDb";
import { normalizeMongoId } from "@/lib/parentPropertyGoogleAdsCampaignOverrides";
import { normalizeGoogleAdsCampaignId } from "@/lib/googleAdsCampaignIdUtils";
import { normalizeMetaAdsCampaignId } from "@/lib/metaAdsCampaignIdUtils";
import { normalizeCampaignNameKeywords } from "@/lib/adCampaignFilterUtils";

function parentChildIdSet(parent) {
    const ids = new Set();
    for (const c of parent?.customers || []) {
        const id = normalizeMongoId(c?._id ?? c);
        if (id) ids.add(id);
    }
    return ids;
}

function clientPayload(doc) {
    const googleAds = googleAdsFiltersDocToClientState(doc);
    const metaAds = metaAdsFiltersDocToClientState(doc);
    return {
        googleAds: {
            filterEnabled: googleAds.filterEnabled,
            excludedByChildId: googleAds.excludedByChildId,
            excludedKeywordsByChildId: googleAds.excludedKeywordsByChildId,
        },
        metaAds: {
            filterEnabled: metaAds.filterEnabled,
            excludedByChildId: metaAds.excludedByChildId,
            excludedKeywordsByChildId: metaAds.excludedKeywordsByChildId,
        },
    };
}

/** GET /api/parent-customers/[id]/customer-filters */
export async function GET(_request, { params }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const resolved = await params;
        const parentId = normalizeMongoId(resolved.id);
        if (!parentId) {
            return NextResponse.json({ error: "Invalid parent id" }, { status: 400 });
        }

        await connectToDatabase();
        const parent = await getParentCustomerById(parentId);
        if (!parent) {
            return NextResponse.json({ error: "Parent not found" }, { status: 404 });
        }

        const doc = await getCustomerFiltersByParentId(parentId);

        return NextResponse.json({
            parentCustomerId: parentId,
            ...clientPayload(doc),
        });
    } catch (e) {
        console.error("[customer-filters] GET:", e);
        return NextResponse.json(
            { error: e.message || "Failed to load customer filters" },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/parent-customers/[id]/customer-filters
 * Body: { googleAds?: {...}, metaAds?: {...} }
 * Each platform: { filterEnabled?, childCustomerId?, excludedCampaignIds?, excludedCampaignNameKeywords? }
 */
export async function PUT(request, { params }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const resolved = await params;
        const parentId = normalizeMongoId(resolved.id);
        if (!parentId) {
            return NextResponse.json({ error: "Invalid parent id" }, { status: 400 });
        }

        const body = await request.json().catch(() => ({}));
        const googleAdsBody = body?.googleAds;
        const metaAdsBody = body?.metaAds;
        if (
            (!googleAdsBody || typeof googleAdsBody !== "object") &&
            (!metaAdsBody || typeof metaAdsBody !== "object")
        ) {
            return NextResponse.json(
                { error: "Missing googleAds or metaAds payload" },
                { status: 400 }
            );
        }

        await connectToDatabase();
        const parent = await getParentCustomerById(parentId);
        if (!parent) {
            return NextResponse.json({ error: "Parent not found" }, { status: 404 });
        }

        const allowedChildIds = parentChildIdSet(parent);
        let doc = await getCustomerFiltersByParentId(parentId);

        const processPlatform = async (platformKey, platformBody, normalizeId, saveChild, setEnabled) => {
            if (!platformBody || typeof platformBody !== "object") return;

            const filterEnabled = platformBody.filterEnabled === true;
            const childCustomerId = normalizeMongoId(platformBody.childCustomerId);
            const hasChildUpdate =
                childCustomerId &&
                (Array.isArray(platformBody.excludedCampaignIds) ||
                    Array.isArray(platformBody.excludedCampaignNameKeywords));

            if (hasChildUpdate) {
                if (!allowedChildIds.has(childCustomerId)) {
                    throw new Error("Child customer is not part of this parent property");
                }
                const excludedCampaignIds = (
                    Array.isArray(platformBody.excludedCampaignIds)
                        ? platformBody.excludedCampaignIds
                        : []
                )
                    .map((id) => normalizeId(id))
                    .filter(Boolean);
                const excludedCampaignNameKeywords = normalizeCampaignNameKeywords(
                    platformBody.excludedCampaignNameKeywords
                );

                const existing = doc || (await getCustomerFiltersByParentId(parentId));
                const enabled =
                    platformBody.filterEnabled !== undefined
                        ? filterEnabled
                        : existing?.[platformKey]?.filterEnabled === true ||
                          excludedCampaignIds.length > 0 ||
                          excludedCampaignNameKeywords.length > 0;

                doc = await saveChild(
                    parentId,
                    childCustomerId,
                    excludedCampaignIds,
                    enabled,
                    excludedCampaignNameKeywords
                );
            } else if (platformBody.filterEnabled !== undefined) {
                doc = await setEnabled(parentId, filterEnabled);
            } else {
                throw new Error(
                    `Provide ${platformKey} childCustomerId + excludedCampaignIds, or filterEnabled`
                );
            }
        };

        try {
            await processPlatform(
                "googleAds",
                googleAdsBody,
                normalizeGoogleAdsCampaignId,
                saveGoogleAdsChildCampaignExclusions,
                setGoogleAdsFilterEnabled
            );
            await processPlatform(
                "metaAds",
                metaAdsBody,
                normalizeMetaAdsCampaignId,
                saveMetaAdsChildCampaignExclusions,
                setMetaAdsFilterEnabled
            );
        } catch (err) {
            const msg = err?.message || "Invalid filter payload";
            const status = msg.includes("not part of this parent") ? 400 : 400;
            return NextResponse.json({ error: msg }, { status });
        }

        if (!doc) {
            doc = await getCustomerFiltersByParentId(parentId);
        }

        return NextResponse.json({
            parentCustomerId: parentId,
            ...clientPayload(doc),
        });
    } catch (e) {
        console.error("[customer-filters] PUT:", e);
        return NextResponse.json(
            { error: e.message || "Failed to save customer filters" },
            { status: 500 }
        );
    }
}
