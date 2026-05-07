import { APEX_RADAR_CHANNEL_FACEBOOK } from "@/lib/apexRadarChannels";
import { getApexRadarClickUpMembersForChannel, normClickUpMemberId } from "@/lib/apexRadarPaidSocialConstants";

/** @typedef {{ customerTeam?: { members?: unknown[] } } | null | undefined} CustomerLite */
/** @typedef {{ userIds?: string[], paidSocialExcludedUserIds?: string[] }} ApexAssignmentDetailLite */
/** @typedef {{ id?: string, _id?: string, clickupId?: string|null }} AssignableUserLike */

export function normalizeInternalUserLean(u) {
    const id = u._id != null ? String(u._id) : u.id != null ? String(u.id) : "";
    return { _id: id, clickupId: u.clickupId != null ? String(u.clickupId).trim() : "" };
}

/**
 * Internal user ids whose User.clickupId appears on this customer’s channel roster (Meta PS or PPC).
 * @param {string} [channel] — `facebook` (default) or `google-ads`
 */
export function listMatchedPaidSocialUserIds(customer, assignableUsers, channel = APEX_RADAR_CHANNEL_FACEBOOK) {
    const rosterIds = new Set(
        getApexRadarClickUpMembersForChannel(customer, channel)
            .map((m) => normClickUpMemberId(m.id))
            .filter(Boolean)
    );
    const out = [];
    for (const raw of assignableUsers || []) {
        const u = normalizeInternalUserLean(raw);
        if (!u._id) continue;
        const cu = normClickUpMemberId(u.clickupId);
        if (cu && rosterIds.has(cu)) out.push(u._id);
    }
    return [...new Set(out)];
}

/**
 * Who is effectively assigned: explicit userIds plus PS roster matches that are not excluded.
 */
export function getEffectiveApexRadarAssignmentUserIds(
    detail,
    customer,
    assignableUsers,
    channel = APEX_RADAR_CHANNEL_FACEBOOK
) {
    const matched = new Set(listMatchedPaidSocialUserIds(customer, assignableUsers, channel));
    const excluded = new Set((detail?.paidSocialExcludedUserIds || []).map((x) => String(x)));
    const assigned = new Set((detail?.userIds || []).map((x) => String(x)));
    const fromPs = [...matched].filter((id) => !excluded.has(id));
    return [...new Set([...assigned, ...fromPs])];
}

function sameStringSet(a, b) {
    if (a.length !== b.length) return false;
    const s = new Set(a.map(String));
    for (const x of b) {
        if (!s.has(String(x))) return false;
    }
    return true;
}

/**
 * After a customerTeam refresh: keep manual assignees, re-add newly matched PS users unless excluded.
 * @param {string[]} assignedUserIds
 * @param {string[]} paidSocialExcludedUserIds
 * @param {string[]} matchedPaidSocialUserIds
 */
export function mergeReconciledAssignedUserIds(assignedUserIds, paidSocialExcludedUserIds, matchedPaidSocialUserIds) {
    const ex = new Set((paidSocialExcludedUserIds || []).map(String));
    const ass = new Set((assignedUserIds || []).map(String));
    const fromPs = (matchedPaidSocialUserIds || []).filter((id) => !ex.has(String(id)));
    return [...new Set([...ass, ...fromPs])].map(String);
}

export function assignmentAssignedIdsUnchanged(prevAssigned, nextAssigned) {
    return sameStringSet(prevAssigned || [], nextAssigned || []);
}
