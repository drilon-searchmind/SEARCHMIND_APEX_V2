import connectToDatabase from "@root/lib/mongodb";
import Customer from "@/models/Customer";
import User from "@root/models/User";
import ApexRadarAccountAssignment from "@/models/ApexRadarAccountAssignment";
import { resolvePaidSocialExcludedUserIdsFromDoc } from "@/lib/apexRadarAssignmentExcludedDb";
import { enrichMonitorAlertsWithAssigneeUserIds } from "@/lib/apexRadarAlertAssignees";
import { isValidApexRadarChannel } from "@/lib/apexRadarChannels";

/**
 * Resolve assigneeUserIds on the server (ClickUp roster + manual assignments per channel).
 * @param {object[]} alerts
 * @param {string} channel — `facebook` | `google-ads`
 */
export async function enrichAlertsWithServerAssignees(alerts, channel) {
    if (!isValidApexRadarChannel(channel) || !Array.isArray(alerts) || !alerts.length) {
        return alerts;
    }

    await connectToDatabase();

    const customerIds = [
        ...new Set(alerts.map((alert) => String(alert.customerId || "")).filter(Boolean)),
    ];
    if (!customerIds.length) return alerts;

    const [assignmentDocs, customerDocs, userDocs] = await Promise.all([
        ApexRadarAccountAssignment.find({ channel, customerId: { $in: customerIds } }).lean(),
        Customer.find({ _id: { $in: customerIds } })
            .select("customerName customerTeam CustomerSettings")
            .lean(),
        User.find({ isExternal: { $ne: true }, isArchived: { $ne: true } })
            .select("name clickupId")
            .lean(),
    ]);

    /** @type {Record<string, { userIds: string[], paidSocialExcludedUserIds: string[] }>} */
    const assignmentDetailMap = {};
    await Promise.all(
        assignmentDocs.map(async (doc) => {
            const excluded = await resolvePaidSocialExcludedUserIdsFromDoc(doc);
            assignmentDetailMap[String(doc.customerId)] = {
                userIds: (doc.assignedUserIds || []).map((id) => String(id)),
                paidSocialExcludedUserIds: excluded,
            };
        })
    );

    /** @type {Record<string, object>} */
    const customersById = {};
    for (const customer of customerDocs) {
        customersById[String(customer._id)] = customer;
    }

    const internalUsers = userDocs.map((user) => ({
        id: String(user._id),
        name: user.name,
        clickupId: (user.clickupId && String(user.clickupId).trim()) || "",
    }));

    return enrichMonitorAlertsWithAssigneeUserIds(
        mergeIntegrationIdsIntoAlerts(alerts, customersById),
        {
            assignmentDetailMap,
            customersById,
            internalUsers,
            channel,
        }
    );
}

function mergeIntegrationIdsIntoAlerts(alerts, customersById) {
    return (alerts || []).map((alert) => {
        const customer = customersById?.[String(alert.customerId || "")];
        if (!customer) return alert;
        const settings = customer.CustomerSettings || {};
        return {
            ...alert,
            facebookAdAccountId:
                String(alert.facebookAdAccountId || settings.facebookAdAccountId || "").trim(),
            googleAdsCustomerId:
                String(alert.googleAdsCustomerId || settings.googleAdsCustomerId || "").trim(),
        };
    });
}
