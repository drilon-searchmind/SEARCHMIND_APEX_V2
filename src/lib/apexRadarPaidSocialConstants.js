import {
    APEX_RADAR_CHANNEL_FACEBOOK,
    APEX_RADAR_CHANNEL_GOOGLE_ADS,
} from "@/lib/apexRadarChannels";

/**
 * ClickUp **custom field id** (Users type) for PPC / Paid Search roster on the customer task.
 * Must be the field’s id from the task JSON — not the PPC option id inside “Service(s)” labels
 * (`11ce14ac-…` in {@link clickupCustomerServices.js} is only for topbar service flags).
 */
export const CLICKUP_PPC_ROSTER_FIELD_UUID = "bee4b7c5-c9d0-4808-8a4f-b00ee6df311e";

/** ClickUp custom field id (Users type) for Paid Social (Meta) roster. */
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
