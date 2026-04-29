/** ClickUp custom field option ID for Paid Social / Meta on customer team roster. */
export const CLICKUP_PS_META_SERVICE_UUID = "2df85265-d5eb-4e86-a111-5d55623851fa";

/**
 * Normalize ClickUp roster member ids for comparisons (always string).
 * @param {unknown} id
 */
export function normClickUpMemberId(id) {
    return String(id ?? "").trim();
}

/**
 * Paid Social–assigned members from cached customerTeam.members (exact service UUID match).
 * @param {{ customerTeam?: { members?: unknown[] } } | null | undefined} customer
 */
export function getPaidSocialClickUpMembers(customer) {
    const members = customer?.customerTeam?.members;
    if (!Array.isArray(members)) return [];
    const ps = CLICKUP_PS_META_SERVICE_UUID.toLowerCase();
    return members.filter((m) => String(m?.service || "").trim().toLowerCase() === ps);
}
