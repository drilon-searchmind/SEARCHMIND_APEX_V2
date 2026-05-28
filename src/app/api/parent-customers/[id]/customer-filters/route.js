import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectToDatabase from "@root/lib/mongodb";
import { getParentCustomerById } from "../../../../../../lib/parentCustomerOperations";
import {
    getCustomerFiltersByParentId,
    googleAdsFiltersDocToClientState,
    saveGoogleAdsChildCampaignExclusions,
    setGoogleAdsFilterEnabled,
} from "@/lib/customerFiltersDb";
import { normalizeMongoId } from "@/lib/parentPropertyGoogleAdsCampaignOverrides";
import { normalizeGoogleAdsCampaignId } from "@/lib/googleAdsCampaignIdUtils";

function parentChildIdSet(parent) {
    const ids = new Set();
    for (const c of parent?.customers || []) {
        const id = normalizeMongoId(c?._id ?? c);
        if (id) ids.add(id);
    }
    return ids;
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
        const googleAds = googleAdsFiltersDocToClientState(doc);

        return NextResponse.json({
            parentCustomerId: parentId,
            googleAds: {
                filterEnabled: googleAds.filterEnabled,
                excludedByChildId: googleAds.excludedByChildId,
            },
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
 * Body: { googleAds: { filterEnabled?, childCustomerId?, excludedCampaignIds? } }
 * — childCustomerId is the child Customer._id; exclusions apply only to that property's Google spend.
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
        if (!googleAdsBody || typeof googleAdsBody !== "object") {
            return NextResponse.json({ error: "Missing googleAds payload" }, { status: 400 });
        }

        await connectToDatabase();
        const parent = await getParentCustomerById(parentId);
        if (!parent) {
            return NextResponse.json({ error: "Parent not found" }, { status: 404 });
        }

        const allowedChildIds = parentChildIdSet(parent);
        const filterEnabled = googleAdsBody.filterEnabled === true;

        const childCustomerId = normalizeMongoId(googleAdsBody.childCustomerId);
        const hasChildUpdate =
            childCustomerId &&
            Array.isArray(googleAdsBody.excludedCampaignIds);

        let doc;

        if (hasChildUpdate) {
            if (!allowedChildIds.has(childCustomerId)) {
                return NextResponse.json(
                    { error: "Child customer is not part of this parent property" },
                    { status: 400 }
                );
            }
            const excludedCampaignIds = googleAdsBody.excludedCampaignIds
                .map((id) => normalizeGoogleAdsCampaignId(id))
                .filter(Boolean);

            const existing = await getCustomerFiltersByParentId(parentId);
            const enabled =
                googleAdsBody.filterEnabled !== undefined
                    ? filterEnabled
                    : existing?.googleAds?.filterEnabled === true || excludedCampaignIds.length > 0;

            doc = await saveGoogleAdsChildCampaignExclusions(
                parentId,
                childCustomerId,
                excludedCampaignIds,
                enabled
            );
        } else if (googleAdsBody.filterEnabled !== undefined) {
            doc = await setGoogleAdsFilterEnabled(parentId, filterEnabled);
        } else {
            return NextResponse.json(
                { error: "Provide childCustomerId + excludedCampaignIds, or filterEnabled" },
                { status: 400 }
            );
        }

        const googleAds = googleAdsFiltersDocToClientState(doc);

        return NextResponse.json({
            parentCustomerId: parentId,
            googleAds: {
                filterEnabled: googleAds.filterEnabled,
                excludedByChildId: googleAds.excludedByChildId,
            },
        });
    } catch (e) {
        console.error("[customer-filters] PUT:", e);
        return NextResponse.json(
            { error: e.message || "Failed to save customer filters" },
            { status: 500 }
        );
    }
}
