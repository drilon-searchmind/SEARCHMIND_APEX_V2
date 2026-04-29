import { formatTeamMemberShort } from "@/app/(protected)/apex-radar/lib/mockOverviewData";
import {
    getPaidSocialClickUpMembers,
    normClickUpMemberId,
} from "@/lib/apexRadarPaidSocialConstants";

/**
 * Active PS (ClickUp) assignees for a row — roster minus exclusions.
 */
export function getActivePaidSocialClickUpIds(customer, excludedIds = []) {
    const roster = getPaidSocialClickUpMembers(customer).map((m) => normClickUpMemberId(m.id));
    const excl = new Set((excludedIds || []).map((x) => normClickUpMemberId(x)));
    return roster.filter((id) => id && !excl.has(id));
}

/**
 * Labels for Apex Radar “Team members” cell: Apex users + PS ClickUp short names (first name + last initial).
 *
 * @param {{
 *   userIds?: string[],
 *   excludedClickUpMemberIds?: string[],
 * }} assignment
 * @param {{ customerTeam?: { members?: unknown[] } } | null | undefined} customer
 * @param {Array<{ id: string, name: string }>} internalUsers — no synthetic “all” entry
 * @returns {string}
 */
export function formatApexRadarTeamAssignmentLabel(
    assignment = {},
    customer,
    internalUsers = []
) {
    const userIds = assignment.userIds || [];
    const excluded = assignment.excludedClickUpMemberIds || [];

    const parts = [];
    for (const uid of userIds) {
        const u = internalUsers.find((x) => String(x.id) === String(uid));
        parts.push(formatTeamMemberShort(u?.name || ""));
    }

    const activeIds = new Set(getActivePaidSocialClickUpIds(customer, excluded));
    const roster = getPaidSocialClickUpMembers(customer);
    const byId = new Map(roster.map((m) => [normClickUpMemberId(m.id), m]));

    for (const id of activeIds) {
        const m = byId.get(id);
        if (m?.username) parts.push(formatTeamMemberShort(m.username));
    }

    const unique = [...new Set(parts)].filter(Boolean);
    if (!unique.length) return "—";
    return unique.join(", ");
}
