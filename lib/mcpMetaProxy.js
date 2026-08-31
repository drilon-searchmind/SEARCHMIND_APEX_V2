import {
    fetchFacebookAdsInsights,
    fetchMetaAdsCampaignList,
} from "@/lib/facebookApi";
import { getDemoFacebookCampaignInsightsForRange } from "@/lib/demoAdMetrics";
import { isDemoCustomerId } from "@/lib/demoCustomer";
import { parseMcpDateRange } from "@root/lib/mcpApiHelpers";
import { loadMetaAdAccountForMcp } from "@root/lib/mcpProxyAllowlist";
import {
	fetchMcpMetaAdCreatives,
	fetchMcpMetaAdPreview,
	metaGraphGet,
} from "@root/lib/mcpMetaAdCreatives";

function normalizeActId(adAccountId) {
    const raw = String(adAccountId || "").trim();
    if (!raw) return "";
    return raw.startsWith("act_") ? raw : `act_${raw}`;
}

async function graphGet(path, accessToken, searchParams = {}) {
    return metaGraphGet(path, accessToken, searchParams);
}

/**
 * @param {string} endpoint
 * @param {string} customerId
 * @param {Record<string, string>} params
 */
export async function executeMcpMetaProxy(endpoint, customerId, params = {}) {
    const meta = await loadMetaAdAccountForMcp(customerId);
    const actId = normalizeActId(meta.adAccountId);

    if (meta.isDemo || isDemoCustomerId(customerId)) {
        return buildDemoMetaResponse(endpoint, params);
    }

    switch (endpoint) {
        case "accounts":
            return {
                adAccountId: actId.replace(/^act_/, ""),
                configured: true,
            };
        case "campaigns": {
            const range = parseMcpDateRange(params.startDate, params.endDate);
            const campaigns = await fetchMetaAdsCampaignList(
                actId,
                range.startDate,
                range.endDate,
                meta.accessToken
            );
            return { ...range, campaigns };
        }
        case "insights": {
            const range = parseMcpDateRange(params.startDate, params.endDate);
            const level = String(params.level || "account").trim().toLowerCase();
            const allowedLevels = new Set(["account", "campaign", "adset", "ad"]);
            if (!allowedLevels.has(level)) {
                throw new Error('level must be one of: account, campaign, adset, ad');
            }
            const insights = await fetchFacebookAdsInsights(
                actId,
                meta.metaIdInclude,
                meta.metaIdExclude,
                meta.accessToken,
                range.startDate,
                range.endDate,
                {
                    dailyBreakdown: params.dailyBreakdown === "true",
                    forceCampaignQuery: level === "campaign",
                }
            );
            return {
                ...range,
                level,
                insights,
            };
        }
        case "adsets": {
            const fields = [
                "id",
                "name",
                "status",
                "campaign_id",
                "daily_budget",
                "lifetime_budget",
            ].join(",");
            const json = await graphGet(`${actId}/adsets`, meta.accessToken, {
                fields,
                limit: String(params.limit || "100"),
            });
            return { adsets: json.data || [], paging: json.paging || null };
        }
        case "ads": {
            const fields = [
                "id",
                "name",
                "status",
                "adset_id",
                "campaign_id",
            ].join(",");
            const json = await graphGet(`${actId}/ads`, meta.accessToken, {
                fields,
                limit: String(params.limit || "100"),
            });
            return { ads: json.data || [], paging: json.paging || null };
        }
        case "ads-with-creatives":
            return fetchMcpMetaAdCreatives(customerId, params);
        case "ad-preview":
            return fetchMcpMetaAdPreview(customerId, params);
        default:
            throw new Error(`Unknown Meta endpoint: ${endpoint}`);
    }
}

function buildDemoMetaResponse(endpoint, params) {
    switch (endpoint) {
        case "accounts":
            return { adAccountId: "demo", configured: true, demo: true };
        case "campaigns": {
            const range = parseMcpDateRange(params.startDate, params.endDate);
            return {
                ...range,
                demo: true,
                campaigns: [
                    { id: "2001", name: "Prospecting - DK" },
                    { id: "2002", name: "Retargeting" },
                ],
            };
        }
        case "insights": {
            const range = parseMcpDateRange(params.startDate, params.endDate);
            return {
                ...range,
                demo: true,
                level: params.level || "account",
                insights: getDemoFacebookCampaignInsightsForRange(
                    range.startDate,
                    range.endDate
                ),
            };
        }
        case "adsets":
            return {
                demo: true,
                adsets: [{ id: "3001", name: "Demo Ad Set", status: "ACTIVE" }],
            };
        case "ads":
            return {
                demo: true,
                ads: [{ id: "4001", name: "Demo Ad", status: "ACTIVE" }],
            };
        case "ads-with-creatives":
            return {
                demo: true,
                kind: "meta-ad-creatives",
                adAccountId: "demo",
                activeOnly: String(params.activeOnly ?? "true").toLowerCase() !== "false",
                limit: Number(params.limit || 100),
                ads: [
                    {
                        id: "120244576686490024",
                        name: "Demo live ad",
                        status: "ACTIVE",
                        effective_status: "ACTIVE",
                        adset_id: "3001",
                        campaign_id: "2001",
                        creative: {
                            id: "5001",
                            name: "Demo creative",
                            object_type: "VIDEO",
                            thumbnail_url: "https://scontent.example/fbcdn.net/demo-thumbnail.jpg",
                            image_url: null,
                            effective_object_story_id: null,
                        },
                        has_visual: true,
                    },
                ],
                paging: null,
                summary: { total: 1, withThumbnailOrImage: 1, byObjectType: { VIDEO: 1 } },
            };
        case "ad-preview":
            return {
                demo: true,
                kind: "meta-ad-preview",
                adId: params.adId || "4001",
                adFormat: params.adFormat || "DESKTOP_FEED_STANDARD",
                previewHtml:
                    '<iframe src="https://business.facebook.com/ads/api/preview_iframe.php?d=demo"></iframe>',
                previewHtmlLength: 79,
            };
        default:
            throw new Error(`Unknown Meta endpoint: ${endpoint}`);
    }
}
