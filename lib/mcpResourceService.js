import { buildCustomerServicesStatus } from "@/lib/clickupCustomerServices";
import { fetchClickupTeamPayloadForCustomer } from "@/lib/clickupCustomerTeamFetch";
import { computeSegmentationFromMerged } from "@/lib/customerSegmentationApi";
import {
    fetchMarketsOverviewRows,
    loadShopifyMarketsForOverview,
    visibleMarketingColumnKeysForMarkets,
} from "@/lib/marketsOverviewApi";
import { fetchMergedSources } from "@/lib/mergedSourcesApi";
import { getDemoPayload, isDemoCustomerId } from "@/lib/demoCustomer";
import { getDemoMergedSourcesForRange } from "@/lib/demoMergedSources";
import { getCampaignsByCustomer } from "@root/lib/campaignOperations";
import { getCustomKpisByCustomerId } from "@root/lib/customKpiOperations";
import { getCustomerById } from "@root/lib/customerOperations";
import { parseMcpDateRange, serializeCustomerForMcp } from "@root/lib/mcpApiHelpers";
import { loadCustomerForMcp } from "@root/lib/mcpDataService";
import { getParentCustomers } from "@root/lib/parentCustomerOperations";
import {
    sanitizeForMcp,
    serializeCustomerDetailForMcp,
} from "@root/lib/mcpSanitize";
import User from "@/models/User";
import CustomerTrackingScanScores from "@/models/CustomerTrackingScanScores";

export const MCP_CUSTOMER_RESOURCES = [
    "clickup-team",
    "custom-kpis",
    "campaigns",
    "tracking-scores",
    "segmentation",
    "markets-overview",
];

export const MCP_GLOBAL_RESOURCES = ["internal-users", "parent-customers"];

function serializeKpi(kpi) {
    const obj = kpi.toObject ? kpi.toObject() : kpi;
    return {
        ...obj,
        id: obj._id?.toString() || obj.id,
    };
}

function buildMergedSettings(data) {
    return {
        customerName: data.customerName,
        customerType: data.customerType || "Shopify",
        ...(data.CustomerSettings || {}),
        CustomerStaticExpenses: data.CustomerStaticExpenses || {},
    };
}

/**
 * @param {string} customerId
 */
export async function fetchMcpCustomerDetail(customerId) {
    if (isDemoCustomerId(customerId)) {
        return serializeCustomerDetailForMcp(getDemoPayload("customer"));
    }
    const doc = await getCustomerById(customerId);
    if (!doc) throw new Error("Customer not found");
    return serializeCustomerDetailForMcp(doc);
}

/**
 * @param {string} customerId
 */
export async function fetchMcpClickupTeam(customerId) {
    if (isDemoCustomerId(customerId)) {
        const demo = getDemoPayload("clickupTeamMembers") ?? { members: [] };
        return {
            readOnly: true,
            customerId,
            members: demo.members ?? [],
            customerServices:
                demo.customerServices ??
                buildCustomerServicesStatus([
                    "11ce14ac-2324-4f56-83c9-c480c86a3a39",
                    "5ba9c5f7-72ac-4538-ac09-af88da2950b5",
                ]),
        };
    }

    const doc = await getCustomerById(customerId);
    if (!doc) throw new Error("Customer not found");

    const clickupId = doc?.CustomerSettings?.customerClickupID;
    if (!clickupId) {
        return {
            readOnly: true,
            customerId,
            clickupTaskId: "",
            members: [],
            customerServices: buildCustomerServicesStatus([]),
        };
    }

    const { members, customerServices } = await fetchClickupTeamPayloadForCustomer(
        String(clickupId).trim()
    );
    return {
        readOnly: true,
        customerId,
        clickupTaskId: String(clickupId).trim(),
        members,
        customerServices,
    };
}

/**
 * @param {string} customerId
 * @param {string} resource
 * @param {{ startDate?: string, endDate?: string }} [query]
 */
export async function fetchMcpCustomerResource(customerId, resource, query = {}) {
    const id = String(customerId || "").trim();
    if (!id) throw new Error("customerId is required");

    switch (resource) {
        case "clickup-team":
            return fetchMcpClickupTeam(id);
        case "custom-kpis":
            return fetchMcpCustomKpis(id);
        case "campaigns":
            return fetchMcpCampaigns(id);
        case "tracking-scores":
            return fetchMcpTrackingScores(id);
        case "segmentation":
            return fetchMcpSegmentation(id, query.startDate, query.endDate);
        case "markets-overview":
            return fetchMcpMarketsOverview(id, query.startDate, query.endDate);
        default:
            throw new Error(`Unknown customer resource: ${resource}`);
    }
}

async function fetchMcpCustomKpis(customerId) {
    if (isDemoCustomerId(customerId)) {
        return { readOnly: true, customerId, kpis: getDemoPayload("customKpis") || [] };
    }
    const kpis = await getCustomKpisByCustomerId(customerId);
    return {
        readOnly: true,
        customerId,
        kpis: kpis.map(serializeKpi),
    };
}

async function fetchMcpCampaigns(customerId) {
    if (isDemoCustomerId(customerId)) {
        return { readOnly: true, customerId, campaigns: getDemoPayload("campaigns") || [] };
    }
    const campaigns = await getCampaignsByCustomer(customerId);
    return { readOnly: true, customerId, campaigns: sanitizeForMcp(campaigns) };
}

async function fetchMcpTrackingScores(customerId) {
    if (isDemoCustomerId(customerId)) {
        return {
            readOnly: true,
            customerId,
            ...(getDemoPayload("customerTrackingScores") || {}),
        };
    }

    const latestScan = await CustomerTrackingScanScores.findOne({ customer: customerId })
        .sort({ createdAt: -1 })
        .lean();

    if (!latestScan) {
        return {
            readOnly: true,
            customerId,
            totalScore: 0,
            performanceScore: 0,
            trackingScore: 0,
            complianceScore: 0,
            createdAt: null,
        };
    }

    return {
        readOnly: true,
        customerId,
        totalScore: latestScan.totalScore ?? 0,
        performanceScore: latestScan.performanceScore ?? 0,
        trackingScore: latestScan.trackingScore ?? 0,
        complianceScore: latestScan.complianceScore ?? 0,
        createdAt: latestScan.createdAt ?? null,
    };
}

async function fetchMcpSegmentation(customerId, startDate, endDate) {
    const range = parseMcpDateRange(startDate, endDate);

    if (isDemoCustomerId(customerId)) {
        let customer = null;
        try {
            customer = await loadCustomerForMcp(customerId);
        } catch {
            customer = { settings: getDemoPayload("customer")?.CustomerSettings || {} };
        }
        const merged = getDemoMergedSourcesForRange(
            range.startDate,
            range.endDate,
            getDemoPayload("customer"),
            {}
        );
        return {
            readOnly: true,
            customerId,
            startDate: range.startDate,
            endDate: range.endDate,
            data: computeSegmentationFromMerged(merged, range.startDate, range.endDate),
        };
    }

    const doc = await getCustomerById(customerId);
    if (!doc) throw new Error("Customer not found");
    const data = doc.toObject ? doc.toObject() : doc;
    const settings = buildMergedSettings(data);
    const merged = await fetchMergedSources(settings, range.startDate, range.endDate, {
        dailyBreakdown: true,
    });

    return {
        readOnly: true,
        customerId,
        startDate: range.startDate,
        endDate: range.endDate,
        data: computeSegmentationFromMerged(merged, range.startDate, range.endDate),
    };
}

async function fetchMcpMarketsOverview(customerId, startDate, endDate) {
    const range = parseMcpDateRange(startDate, endDate);

    const doc = await getCustomerById(customerId);
    if (!doc) throw new Error("Customer not found");
    const data = doc.toObject ? doc.toObject() : doc;
    const cs = data.CustomerSettings || {};

    if (data.customerType !== "Shopify" || cs.shopifyMarketsEnabled !== true) {
        return {
            readOnly: true,
            customerId,
            startDate: range.startDate,
            endDate: range.endDate,
            featureDisabled: true,
            rows: [],
            storeTotalRow: null,
            visibleMarketingColumnKeys: [],
        };
    }

    const shop = cs.shopifyUrl;
    const token = cs.shopifyApiPassword;
    if (!shop || !token) {
        throw new Error("Shopify URL and API access token are required for markets overview");
    }

    const markets = await loadShopifyMarketsForOverview(shop, token);
    const settings = {
        ...buildMergedSettings(data),
        CustomerSettings: cs,
    };
    const { rows, storeTotalRow } = await fetchMarketsOverviewRows(
        settings,
        range.startDate,
        range.endDate,
        markets,
        { excludeAdSpendPlatforms: [] }
    );

    return {
        readOnly: true,
        customerId,
        startDate: range.startDate,
        endDate: range.endDate,
        rows,
        storeTotalRow,
        marketsCount: markets.length,
        visibleMarketingColumnKeys: visibleMarketingColumnKeysForMarkets(cs, []),
    };
}

/**
 * @param {string} resource
 */
export async function fetchMcpGlobalResource(resource) {
    switch (resource) {
        case "internal-users":
            return fetchMcpInternalUsers();
        case "parent-customers":
            return fetchMcpParentCustomers();
        default:
            throw new Error(`Unknown global resource: ${resource}`);
    }
}

async function fetchMcpInternalUsers() {
    const docs = await User.find({
        isExternal: { $ne: true },
        isArchived: { $ne: true },
    })
        .select("name email image clickupId")
        .sort({ name: 1 })
        .lean();

    return {
        readOnly: true,
        users: docs.map((u) => ({
            id: String(u._id),
            name: u.name,
            email: u.email || "",
            image: u.image || null,
            clickupId: (u.clickupId && String(u.clickupId).trim()) || "",
        })),
    };
}

async function fetchMcpParentCustomers() {
    const parents = await getParentCustomers();
    return {
        readOnly: true,
        parentCustomers: parents.map((parent) => {
            const obj = parent.toObject ? parent.toObject() : parent;
            return sanitizeForMcp({
                id: String(obj._id),
                name: obj.name || "",
                customers: (obj.customers || []).map((c) => serializeCustomerForMcp(c)),
            });
        }),
    };
}

export function isValidMcpCustomerResource(resource) {
    return MCP_CUSTOMER_RESOURCES.includes(String(resource || "").trim());
}

export function isValidMcpGlobalResource(resource) {
    return MCP_GLOBAL_RESOURCES.includes(String(resource || "").trim());
}

export function listMcpCustomerResources() {
    return [...MCP_CUSTOMER_RESOURCES];
}

export function listMcpGlobalResources() {
    return [...MCP_GLOBAL_RESOURCES];
}
