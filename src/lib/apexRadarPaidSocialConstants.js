import {
    APEX_RADAR_CHANNEL_FACEBOOK,
    APEX_RADAR_CHANNEL_GOOGLE_ADS,
} from "@/lib/apexRadarChannels";

/** ClickUp task user-field id for PPC / Google Ads roster (same UUID as PPC option in TOPBAR customer services). */
export const CLICKUP_PPC_ROSTER_FIELD_UUID = "11ce14ac-2324-4f56-83c9-c480c86a3a39";

/** ClickUp task user-field id for Paid Social (Meta) roster. */
export const CLICKUP_PS_META_SERVICE_UUID = "2df85265-d5eb-4e86-a111-5d55623851fa";

/**
 * Normalize ClickUp roster member ids for comparisons (always string).
 * @param {unknown} id
 */
export function normClickUpMemberId(id) {
    return String(id ?? "").trim();
}

/**
 * Apex Radar: members from cached customer team for a channel (matches `m.service` to the ClickUp user-field id).
 * @param {{ customerTeam?: { members?: unknown[] } } | null | undefined} customer
 * @param {string} channel — `facebook` uses Meta PS field; `google-ads` uses {@link CLICKUP_PPC_ROSTER_FIELD_UUID}
 */
export function getApexRadarClickUpMembersForChannel(customer, channel) {
    const members = customer?.customerTeam?.members;
    if (!Array.isArray(members)) return [];
    const fieldId =
        String(channel || "") === APEX_RADAR_CHANNEL_GOOGLE_ADS
            ? CLICKUP_PPC_ROSTER_FIELD_UUID.toLowerCase()
            : CLICKUP_PS_META_SERVICE_UUID.toLowerCase();
    return members.filter((m) => String(m?.service || "").trim().toLowerCase() === fieldId);
}

/**
 * @deprecated Use {@link getApexRadarClickUpMembersForChannel} with `facebook`.
 */
export function getPaidSocialClickUpMembers(customer) {
    return getApexRadarClickUpMembersForChannel(customer, APEX_RADAR_CHANNEL_FACEBOOK);
}
