/**
 * Persist ClickUp team snapshot on Customer.customerTeam (for Apex Radar batch use later).
 * Safe to re-run ("re-sync"); updates only customerTeam (+ updatedAt); does not touch other fields.
 */
import Customer from "../models/Customer.js";
import connectToDatabase from "../../lib/mongodb.js";
import { fetchClickupTeamPayloadForCustomer } from "./clickupCustomerTeamFetch.js";
import { APEX_RADAR_CHANNEL_FACEBOOK, APEX_RADAR_CHANNEL_GOOGLE_ADS } from "@/lib/apexRadarChannels";
import { reconcileApexAssignmentsAfterCustomerTeamSync } from "./apexRadarPaidSocialReconcile.js";

/** @param {{ dryRun?: boolean, skipPaidSocialAssignmentReconcile?: boolean }} [options] */
export async function syncCustomerTeamForCustomerId(customerId, options = {}) {
    const { dryRun = false, skipPaidSocialAssignmentReconcile = false } = options;
    await connectToDatabase();

    const customer = await Customer.findById(customerId).exec();
    if (!customer) {
        return { ok: false, customerId, error: "Customer not found" };
    }

    const clickupId =
        customer.CustomerSettings?.customerClickupID?.trim?.() || "";

    const now = new Date();

    if (!clickupId) {
        return {
            ok: true,
            customerId: String(customerId),
            skipped: true,
            reason: "no_customer_clickup_id",
        };
    }

    if (dryRun) {
        const payload = await fetchClickupTeamPayloadForCustomer(clickupId);
        return {
            ok: true,
            customerId: String(customerId),
            dryRun: true,
            memberCount: payload.members.length,
        };
    }

    try {
        const { members, customerServices } =
            await fetchClickupTeamPayloadForCustomer(clickupId);

        await Customer.updateOne(
            { _id: customerId },
            {
                $set: {
                    "customerTeam.members": members,
                    "customerTeam.customerServices": customerServices,
                    "customerTeam.syncedAt": now,
                    "customerTeam.lastSyncAttemptAt": now,
                    "customerTeam.lastSyncError": null,
                    updatedAt: now,
                },
            }
        );

        if (!skipPaidSocialAssignmentReconcile) {
            try {
                await reconcileApexAssignmentsAfterCustomerTeamSync(customerId, APEX_RADAR_CHANNEL_FACEBOOK);
                await reconcileApexAssignmentsAfterCustomerTeamSync(customerId, APEX_RADAR_CHANNEL_GOOGLE_ADS);
            } catch (e) {
                console.warn("[customerTeamSync] PS assignment reconcile failed:", e?.message || e);
            }
        }

        return {
            ok: true,
            customerId: String(customerId),
            memberCount: members.length,
            syncedAt: now.toISOString(),
        };
    } catch (e) {
        const msg = e?.message || String(e);
        await Customer.updateOne(
            { _id: customerId },
            {
                $set: {
                    "customerTeam.lastSyncAttemptAt": now,
                    "customerTeam.lastSyncError": msg.slice(0, 2000),
                    updatedAt: now,
                },
            }
        );
        return {
            ok: false,
            customerId: String(customerId),
            error: msg,
        };
    }
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

/**
 * Batch re-sync for customers that have CustomerSettings.customerClickupID set (non-empty in DB).
 *
 * @param {{
 *   includeArchived?: boolean;
 *   dryRun?: boolean;
 *   delayBetweenMs?: number;
 *   limit?: number;
 * }} [options]
 */
export async function syncAllCustomersClickupTeams(options = {}) {
    const {
        includeArchived = false,
        dryRun = false,
        delayBetweenMs = 250,
        limit,
    } = options;

    await connectToDatabase();

    const query = {};
    if (!includeArchived) {
        query.isArchived = { $ne: true };
    }

    query["CustomerSettings.customerClickupID"] = {
        $exists: true,
        $nin: [null, ""],
    };

    let q = Customer.find(query)
        .select("_id customerName CustomerSettings.customerClickupID")
        .lean();

    if (limit != null && Number.isFinite(Number(limit))) {
        q = q.limit(Number(limit));
    }

    const list = await q.exec();

    const results = [];
    for (const row of list) {
        const r = await syncCustomerTeamForCustomerId(row._id, { dryRun });
        results.push(r);
        await sleep(delayBetweenMs);
    }

    const summary = {
        total: results.length,
        synced: results.filter((r) => r.ok && !r.skipped && !r?.dryRun).length,
        skipped: results.filter((r) => r.skipped).length,
        errors: results.filter((r) => r.ok === false).length,
    };

    if (dryRun) {
        summary.dryRunMemberSamples = results
            .filter((r) => r.dryRun)
            .map((r) => ({
                customerId: r.customerId,
                memberCount: r.memberCount,
            }));
    }

    return { results, summary };
}
