/**
 * Keeps Apex Radar PS assignments in sync after customerTeam is refreshed:
 * merges internal users matched by User.clickupId to the Paid Social roster.
 */
import mongoose from "mongoose";
import connectToDatabase from "@root/lib/mongodb";
import Customer from "@/models/Customer";
import ApexRadarAccountAssignment from "@/models/ApexRadarAccountAssignment";
import User from "@root/models/User";
import { APEX_RADAR_CHANNEL_FACEBOOK } from "@/lib/apexRadarChannels";
import { isDemoCustomerId } from "@/lib/demoCustomer";
import {
    assignmentAssignedIdsUnchanged,
    listMatchedPaidSocialUserIds,
    mergeReconciledAssignedUserIds,
} from "@/lib/apexRadarPaidSocialAssignments";
import { resolvePaidSocialExcludedUserIdsFromDoc } from "@/lib/apexRadarAssignmentExcludedDb";

/**
 * @param {string|mongoose.Types.ObjectId} customerId
 * @param {string} channel — `facebook` or `google-ads`
 * @returns {{ ok: boolean, skipped?: boolean, reason?: string, updated?: boolean }}
 */
export async function reconcileApexAssignmentsAfterCustomerTeamSync(customerId, channel) {
    await connectToDatabase();
    const cidStr = String(customerId);
    if (!mongoose.Types.ObjectId.isValid(cidStr)) return { ok: false, skipped: true, reason: "invalid_id" };

    if (isDemoCustomerId(cidStr)) {
        return { ok: true, skipped: true, reason: "demo_customer" };
    }

    try {
        const customer = await Customer.findById(customerId).select("customerTeam").lean();
        if (!customer) return { ok: false, skipped: true, reason: "customer_not_found" };

        const internals = await User.find({
            isExternal: { $ne: true },
            isArchived: { $ne: true },
        })
            .select("_id clickupId")
            .lean();

        const matched = listMatchedPaidSocialUserIds(customer, internals, channel);
        const cid = new mongoose.Types.ObjectId(cidStr);

        const doc = await ApexRadarAccountAssignment.findOne({ channel, customerId: cid })
            .select("assignedUserIds paidSocialExcludedUserIds clickUpExcludedMemberIds")
            .lean();

        const assigned = (doc?.assignedUserIds || []).map((id) => String(id));
        const excluded = await resolvePaidSocialExcludedUserIdsFromDoc(doc);
        const nextAssigned = mergeReconciledAssignedUserIds(assigned, excluded, matched);

        if (doc && assignmentAssignedIdsUnchanged(assigned, nextAssigned)) {
            return { ok: true, updated: false };
        }

        if (!doc && nextAssigned.length === 0) {
            return { ok: true, updated: false, skipped: true, reason: "nothing_to_seed" };
        }

        await ApexRadarAccountAssignment.findOneAndUpdate(
            { channel, customerId: cid },
            {
                $set: {
                    assignedUserIds: nextAssigned.map((id) => new mongoose.Types.ObjectId(id)),
                    paidSocialExcludedUserIds: excluded.map((id) => new mongoose.Types.ObjectId(id)),
                    updatedAt: new Date(),
                },
                $unset: { clickUpExcludedMemberIds: "" },
            },
            { upsert: true, new: true, runValidators: true }
        ).exec();

        return { ok: true, updated: true };
    } catch (e) {
        console.error("[apexRadarPaidSocialReconcile]", e);
        return { ok: false, reason: e?.message || String(e) };
    }
}

/** @deprecated Use {@link reconcileApexAssignmentsAfterCustomerTeamSync} with `APEX_RADAR_CHANNEL_FACEBOOK`. */
export async function reconcileFacebookAssignmentsAfterCustomerTeamSync(customerId) {
    return reconcileApexAssignmentsAfterCustomerTeamSync(customerId, APEX_RADAR_CHANNEL_FACEBOOK);
}
