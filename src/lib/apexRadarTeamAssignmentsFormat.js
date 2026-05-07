import { formatTeamMemberShort } from "@/app/(protected)/apex-radar/lib/mockOverviewData";
import { APEX_RADAR_CHANNEL_FACEBOOK } from "@/lib/apexRadarChannels";
import { getEffectiveApexRadarAssignmentUserIds } from "@/lib/apexRadarPaidSocialAssignments";

/**
 * @param {{
 *   userIds?: string[],
 *   paidSocialExcludedUserIds?: string[],
 * }} assignment
 * @param {{ customerTeam?: { members?: unknown[] } } | null | undefined} customer
 * @param {Array<{ id: string, name: string, clickupId?: string }>} internalUsers
 * @param {string} [channel] — Apex Radar channel (`facebook` or `google-ads`)
 * @returns {string}
 */
export function formatApexRadarTeamAssignmentLabel(
    assignment = {},
    customer,
    internalUsers = [],
    channel = APEX_RADAR_CHANNEL_FACEBOOK
) {
    const effective = getEffectiveApexRadarAssignmentUserIds(assignment, customer, internalUsers, channel);
    const parts = [];
    for (const uid of effective) {
        const u = internalUsers.find((x) => String(x.id) === String(uid));
        parts.push(formatTeamMemberShort(u?.name || ""));
    }
    const unique = [...new Set(parts)].filter(Boolean);
    if (!unique.length) return "—";
    return unique.join(", ");
}
