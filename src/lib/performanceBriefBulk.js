import Customer from "@/models/Customer";
import ApexRadarPerformanceBriefCustomerSettings from "@/models/ApexRadarPerformanceBriefCustomerSettings";
import {
    getServiceDashboardConfigWarnings,
    isValidIntegrationId,
} from "@/lib/customerServiceIntegrations";
import { setApexRadarCustomerSlackChannel } from "@/lib/apexRadarCustomerSlack";
import { isPerformanceBriefCustomerId } from "@/lib/performanceBriefConstants";

/**
 * Active customers eligible for Performance Brief bulk run (non-archived).
 */
export async function listPerformanceBriefBulkCustomers() {
    const customers = await Customer.find({ isArchived: { $ne: true } })
        .select("_id customerName isArchived CustomerSettings")
        .sort({ customerName: 1 })
        .lean();

    const ids = customers.map((c) => c._id);
    const settingsDocs = await ApexRadarPerformanceBriefCustomerSettings.find({
        customerId: { $in: ids },
    })
        .select("customerId slackChannelId slackChannelName")
        .lean();

    const settingsByCustomerId = new Map(
        settingsDocs.map((doc) => [String(doc.customerId), doc])
    );

    return customers.map((c) => {
        const settings = c.CustomerSettings || {};
        const warnings = getServiceDashboardConfigWarnings(settings);
        const briefSettings = settingsByCustomerId.get(String(c._id)) || {};
        return {
            customerId: String(c._id),
            customerName: c.customerName || "Untitled",
            isArchived: Boolean(c.isArchived),
            slackChannelId: String(briefSettings.slackChannelId || "").trim(),
            slackChannelName: String(briefSettings.slackChannelName || "").trim(),
            integrations: {
                meta: !warnings.ps,
                googleAds: !warnings.ppc,
            },
            metaConfigured: isValidIntegrationId(settings.facebookAdAccountId),
            googleConfigured: isValidIntegrationId(settings.googleAdsCustomerId),
        };
    });
}

/**
 * @param {{ customerId: string, slackChannelId?: string, slackChannelName?: string }[]} updates
 */
export async function savePerformanceBriefBulkSlackChannels(updates = []) {
    const saved = [];
    for (const row of updates) {
        const customerId = String(row?.customerId || "").trim();
        if (!isPerformanceBriefCustomerId(customerId)) continue;
        const settings = await setApexRadarCustomerSlackChannel(customerId, {
            slackChannelId: row.slackChannelId,
            slackChannelName: row.slackChannelName,
        });
        saved.push({ customerId, settings });
    }
    return saved;
}
