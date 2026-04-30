import { formatTeamMemberShort } from "@/app/(protected)/apex-radar/lib/mockOverviewData";
import { getEffectiveApexRadarAssignmentUserIds } from "@/lib/apexRadarPaidSocialAssignments";

/**
 * @param {{
 *   userIds?: string[],
 *   paidSocialExcludedUserIds?: string[],
 * }} assignment
 * @param {{ customerTeam?: { members?: unknown[] } } | null | undefined} customer
 * @param {Array<{ id: string, name: string, clickupId?: string }>} internalUsers
 * @returns {string}
 */
export function formatApexRadarTeamAssignmentLabel(assignment = {}, customer, internalUsers = []) {
    const effective = getEffectiveApexRadarAssignmentUserIds(assignment, customer, internalUsers);
    const parts = [];
    for (const uid of effective) {
        const u = internalUsers.find((x) => String(x.id) === String(uid));
        parts.push(formatTeamMemberShort(u?.name || ""));
    }
    const unique = [...new Set(parts)].filter(Boolean);
    if (!unique.length) return "—";
    return unique.join(", ");
}
