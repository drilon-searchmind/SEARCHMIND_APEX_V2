import { getEffectiveApexRadarAssignmentUserIds } from "@/lib/apexRadarPaidSocialAssignments";

/**
 * Resolve Mongo user ids assigned to a customer row (explicit + ClickUp roster match).
 */
export function getAssigneeUserIdsForCustomer(
    customerId,
    { assignmentDetailMap, customersById, internalUsers, channel }
) {
    const id = String(customerId ?? "");
    if (!id) return [];
    const detail = assignmentDetailMap?.[id] || {
        userIds: [],
        paidSocialExcludedUserIds: [],
    };
    const customer = customersById?.[id] || null;
    return getEffectiveApexRadarAssignmentUserIds(
        detail,
        customer,
        internalUsers,
        channel
    );
}

/**
 * Attach assigneeUserIds to each monitor alert for Slack DM routing.
 */
export function enrichMonitorAlertsWithAssigneeUserIds(alerts, opts) {
    return (alerts || []).map((alert) => ({
        ...alert,
        assigneeUserIds: getAssigneeUserIdsForCustomer(alert.customerId, opts),
    }));
}
