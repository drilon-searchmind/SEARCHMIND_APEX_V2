/**
 * Placeholder data for Apex Radar overview until APIs exist.
 * Replace with API responses later.
 */

import { buildFacebookOverviewApexOnlySlice } from "@/lib/apexRadarCustomerSettings";
import { getUtcCalendarSpendDodRange } from "@/lib/apexRadarFacebookOverview";

export const MOCK_INTERNAL_USERS = [
    { id: "all", name: "All team members" },
    { id: "u1", name: "Asger Nielsen" },
    { id: "u2", name: "Maria Jensen" },
    { id: "u3", name: "Lars Hansen" },
];

/** First name + first letter of last name (e.g. "Asger N"). */
export function formatTeamMemberShort(fullName) {
    if (!fullName || typeof fullName !== "string") return "—";
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "—";
    if (parts.length === 1) return parts[0];
    const first = parts[0];
    const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
    return `${first} ${lastInitial}`;
}

/**
 * @param {string} userId
 * @param {Array<{ id: string, name: string }>} [assignableUsers] — real internal users (no synthetic "all" entry)
 */
export function teamMemberShortFromUserId(userId, assignableUsers = []) {
    if (!userId) return "—";
    const u = assignableUsers.find((x) => String(x.id) === String(userId));
    if (!u) return "—";
    return formatTeamMemberShort(u.name);
}

/** Comma-separated short names for assigned user ids (localStorage assignments). */
export function formatAssignedUsersList(userIds, assignableUsers = []) {
    if (!userIds || !userIds.length) return "—";
    return userIds.map((id) => teamMemberShortFromUserId(id, assignableUsers)).join(", ");
}

/** Placeholder metrics until Facebook / ads APIs exist; one row per customer. */
export function buildCustomerOverviewRow(customer) {
    const id = String(customer._id);
    const entity = customer.customerName || "Unnamed customer";
    const apexSlice = buildFacebookOverviewApexOnlySlice(customer);
    return {
        id,
        customerId: id,
        entity,
        value: {
            conversions2d: null,
            value7d: null,
            minExpectedValue7d: null,
            value30d: null,
            minExpectedValue30d: null,
        },
        targets: apexSlice.targets,
        budget: apexSlice.budget,
        ads: {
            adFatigue: null,
            ctr7d: null,
            ctr30d: null,
            freq7d: null,
            freq30d: null,
        },
        alerts: apexSlice.alerts,
        customerApexRadarSettings: customer.customerApexRadarSettings || { facebook: {} },
        spendDayOverDay: (() => {
            const dod = getUtcCalendarSpendDodRange();
            return {
                calendarYesterday: dod.calendarYesterday,
                calendarDayBeforeYesterday: dod.calendarDayBeforeYesterday,
                spendYesterday: null,
                spendDayBeforeYesterday: null,
                pctChangeFromPrior: null,
                warnDrop: false,
            };
        })(),
    };
}

/** @typedef {typeof MOCK_OVERVIEW_ROWS[0]} ApexRadarOverviewRow */

export const MOCK_OVERVIEW_ROWS = [
    {
        id: "1",
        entity: "Example Brand DE",
        value: {
            conversions2d: 142,
            value7d: 184_200,
            minExpectedValue7d: 160_000,
            value30d: 812_400,
            minExpectedValue30d: 720_000,
        },
        targets: {
            targetType: "ROAS",
            target: 4.2,
            actual7d: 3.8,
            actual30d: 4.0,
        },
        budget: {
            targetBudget: 45_000,
            realizedBudget: 42_100,
            spendYesterday: 1_850,
            budgetPace: 0.94,
            budgetType: "D",
        },
        ads: {
            adFatigue: 2,
            ctr7d: 1.24,
            ctr30d: 1.18,
            freq7d: 2.1,
            freq30d: 2.4,
        },
        alerts: {
            value7dBelowMin: false,
            value30dBelowMin: false,
            target7dMiss: true,
            target30dMiss: false,
            budgetPaceOff: false,
            highAdFatigue: false,
        },
    },
    {
        id: "2",
        entity: "Nordic Shop COM",
        value: {
            conversions2d: 89,
            value7d: 96_500,
            minExpectedValue7d: 110_000,
            value30d: 401_200,
            minExpectedValue30d: 440_000,
        },
        targets: { targetType: "ROAS", target: 3.5, actual7d: 2.9, actual30d: 3.1 },
        budget: {
            targetBudget: 28_000,
            realizedBudget: 29_400,
            spendYesterday: 1_020,
            budgetPace: 1.05,
            budgetType: "S",
        },
        ads: { adFatigue: 5, ctr7d: 0.88, ctr30d: 0.92, freq7d: 3.2, freq30d: 3.0 },
        alerts: {
            value7dBelowMin: true,
            value30dBelowMin: true,
            target7dMiss: true,
            target30dMiss: true,
            budgetPaceOff: true,
            highAdFatigue: true,
        },
    },
    {
        id: "3",
        entity: "Angulus DK",
        value: {
            conversions2d: 210,
            value7d: 256_000,
            minExpectedValue7d: 240_000,
            value30d: 1_020_000,
            minExpectedValue30d: 960_000,
        },
        targets: { targetType: "ROAS", target: 4.0, actual7d: 4.2, actual30d: 4.1 },
        budget: {
            targetBudget: 62_000,
            realizedBudget: 58_900,
            spendYesterday: 2_100,
            budgetPace: 0.95,
            budgetType: "D",
        },
        ads: { adFatigue: 0, ctr7d: 1.45, ctr30d: 1.38, freq7d: 1.8, freq30d: 2.0 },
        alerts: {
            value7dBelowMin: false,
            value30dBelowMin: false,
            target7dMiss: false,
            target30dMiss: false,
            budgetPaceOff: false,
            highAdFatigue: false,
        },
    },
    {
        id: "4",
        entity: "Coastal Living SE",
        value: {
            conversions2d: 54,
            value7d: 71_200,
            minExpectedValue7d: 85_000,
            value30d: 298_000,
            minExpectedValue30d: 340_000,
        },
        targets: { targetType: "ROAS", target: 3.8, actual7d: 3.2, actual30d: 3.4 },
        budget: {
            targetBudget: 19_500,
            realizedBudget: 18_200,
            spendYesterday: 640,
            budgetPace: 0.93,
            budgetType: "D",
        },
        ads: { adFatigue: 3, ctr7d: 0.95, ctr30d: 1.02, freq7d: 2.6, freq30d: 2.5 },
        alerts: {
            value7dBelowMin: true,
            value30dBelowMin: true,
            target7dMiss: true,
            target30dMiss: true,
            budgetPaceOff: false,
            highAdFatigue: false,
        },
    },
    {
        id: "5",
        entity: "Urban Supply NO",
        value: {
            conversions2d: 176,
            value7d: 198_400,
            minExpectedValue7d: 190_000,
            value30d: 756_000,
            minExpectedValue30d: 720_000,
        },
        targets: { targetType: "ROAS", target: 4.5, actual7d: 4.4, actual30d: 4.35 },
        budget: {
            targetBudget: 44_000,
            realizedBudget: 46_800,
            spendYesterday: 1_920,
            budgetPace: 1.06,
            budgetType: "S",
        },
        ads: { adFatigue: 1, ctr7d: 1.12, ctr30d: 1.15, freq7d: 2.3, freq30d: 2.2 },
        alerts: {
            value7dBelowMin: false,
            value30dBelowMin: false,
            target7dMiss: false,
            target30dMiss: false,
            budgetPaceOff: true,
            highAdFatigue: false,
        },
    },
];
