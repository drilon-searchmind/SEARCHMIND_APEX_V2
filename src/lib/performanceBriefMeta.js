import { parseMetaIdFilter } from "@/lib/facebookApi";
import { fetchFacebookAdsAdPerformance } from "@/lib/facebookAdsAdPerformance";
import {
    getPurchaseConversions,
    getPurchaseRevenue,
    getActionValue,
} from "@/lib/facebookPsDashboardUtils";
import { pctChange, roundN, safeDiv } from "@/lib/performanceBriefDates";

const META_GRAPH = "https://graph.facebook.com/v21.0";
const AD_CREATIVE_FIELDS =
    "name,creative{id,name,object_type,product_set_id,video_id,asset_feed_spec,image_url,thumbnail_url}";

const LEAD_ACTION_TYPES = [
    "lead",
    "onsite_conversion.lead_grouped",
    "contact",
    "schedule",
    "find_location",
];

function isDuplicateAddEvent(actionType) {
    return /_add_/i.test(String(actionType || ""));
}

function firstActionValue(actions, types) {
    if (!actions) return 0;
    for (const type of types) {
        const value = getActionValue(actions, type);
        if (value > 0) return value;
    }
    return 0;
}

async function fetchInsightsPages(url) {
    const rows = [];
    let next = url;
    while (next) {
        const res = await fetch(next, { method: "GET", headers: { "Content-Type": "application/json" } });
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Facebook API error: ${res.status} - ${errorText}`);
        }
        const data = await res.json();
        if (data.error) throw new Error(`Facebook API error: ${JSON.stringify(data.error)}`);
        rows.push(...(data.data || []));
        next = data.paging?.next || null;
    }
    return rows;
}

function buildInsightsUrl({
    accessToken,
    adAccountId,
    startDate,
    endDate,
    fields,
    level,
    breakdowns = null,
    filtering = null,
}) {
    const formatted = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
    const params = new URLSearchParams({
        access_token: accessToken,
        time_range: JSON.stringify({ since: startDate, until: endDate }),
        fields: fields.join(","),
        level,
        limit: "500",
    });
    if (filtering?.length) params.append("filtering", JSON.stringify(filtering));
    if (breakdowns?.length) params.append("breakdowns", JSON.stringify(breakdowns));
    return `https://graph.facebook.com/v21.0/${formatted}/insights?${params.toString()}`;
}

function mergeActionArrays(rows, key) {
    const byType = {};
    for (const row of rows) {
        for (const a of row[key] || []) {
            if (isDuplicateAddEvent(a.action_type)) continue;
            byType[a.action_type] = (byType[a.action_type] || 0) + parseFloat(a.value || 0);
        }
    }
    return Object.entries(byType).map(([action_type, value]) => ({
        action_type,
        value: String(value),
    }));
}

function aggregateRows(rows) {
    const spend = rows.reduce((s, r) => s + parseFloat(r.spend || 0), 0);
    const impressions = rows.reduce((s, r) => s + parseFloat(r.impressions || 0), 0);
    const clicks = rows.reduce((s, r) => s + parseFloat(r.clicks || 0), 0);
    const reach = rows.reduce((s, r) => s + parseFloat(r.reach || 0), 0);
    const actions = mergeActionArrays(rows, "actions");
    const action_values = mergeActionArrays(rows, "action_values");
    const frequency =
        rows.length === 1
            ? parseFloat(rows[0].frequency || 0)
            : reach > 0
              ? impressions / reach
              : parseFloat(rows[0]?.frequency || 0);
    return { spend, impressions, clicks, reach, frequency, actions, action_values };
}

function metricsFromAggregated(agg) {
    const purchases = getPurchaseConversions(agg.actions);
    const revenue = getPurchaseRevenue(agg.action_values);
    const leads = firstActionValue(agg.actions, LEAD_ACTION_TYPES);
    const landingPageViews = firstActionValue(agg.actions, ["landing_page_view"]);
    return {
        spend: roundN(agg.spend, 2),
        revenue: roundN(revenue, 2),
        conversions: roundN(purchases, 2),
        leads: roundN(leads, 2),
        landingPageViews: roundN(landingPageViews, 2),
        roas: roundN(safeDiv(revenue, agg.spend), 4),
        cpa: roundN(safeDiv(agg.spend, purchases), 2),
        cpl: roundN(safeDiv(agg.spend, leads), 2),
        frequency: roundN(agg.frequency, 4),
        reach: Math.round(agg.reach),
        impressions: Math.round(agg.impressions),
        clicks: Math.round(agg.clicks),
        ctr: roundN(safeDiv(agg.clicks, agg.impressions) * 100, 2),
        cpc: roundN(safeDiv(agg.spend, agg.clicks), 2),
    };
}

function detectAccountType(actions, actionValues) {
    const types = new Set(
        (actions || [])
            .map((a) => String(a.action_type || ""))
            .filter((t) => t && !isDuplicateAddEvent(t))
    );
    const purchaseValue = getPurchaseRevenue(actionValues);
    const purchases = getPurchaseConversions(actions);
    const leads = firstActionValue(actions, LEAD_ACTION_TYPES);
    const hasPurchase = purchases > 0 || purchaseValue > 0;
    const hasLead = leads > 0 || [...types].some((t) => LEAD_ACTION_TYPES.includes(t));
    if (hasPurchase && hasLead) return "hybrid";
    if (hasPurchase) return "ecommerce";
    if (hasLead) return "lead";
    return "brand";
}

export function classifyMetaAdType(adName, creativeMeta = "") {
    const creative =
        typeof creativeMeta === "string"
            ? { object_type: creativeMeta }
            : creativeMeta && typeof creativeMeta === "object"
              ? creativeMeta
              : {};
    const objectType = String(creative.object_type || "").toUpperCase();
    const creativeName = String(creative.name || "");
    const n = String(adName || "");
    const combined = `${n} ${creativeName}`.toUpperCase();

    if (creative.product_set_id) return "DPA";
    if (/\bDPA\b|CATALOG|PRODUCT_SET|DYNAMIC PRODUCT|PRODUKTER|KATALOG|SHOPPING/.test(combined)) {
        return "DPA";
    }

    if (/\bCAROUSEL\b|\bSAMLING\b/.test(combined) || objectType === "CAROUSEL") return "Carousel";

    const assetFeed = creative.asset_feed_spec;
    const hasFeedVideos =
        assetFeed &&
        typeof assetFeed === "object" &&
        Array.isArray(assetFeed.videos) &&
        assetFeed.videos.length > 0;
    const hasFeedImages =
        assetFeed &&
        typeof assetFeed === "object" &&
        Array.isArray(assetFeed.images) &&
        assetFeed.images.length > 0;

    if (
        creative.video_id ||
        objectType === "VIDEO" ||
        hasFeedVideos ||
        /\bMP4\b|\bVIDEO\b|\bREEL\b|\bREELS\b|\bMOV\b/.test(combined)
    ) {
        return "Video";
    }

    if (
        /\bJPG\b|\bJPEG\b|\bPNG\b|\bBILLEDE\b|\bIMAGE\b|\bSTATIC\b|\bSTILL\b|\bSTILLBILLEDE\b/.test(
            combined
        )
    ) {
        return "Billede";
    }
    if (["PHOTO", "SHARE", "STATUS", "PAGE", "LINK", "OFFER"].includes(objectType)) {
        return "Billede";
    }
    if ((creative.image_url || hasFeedImages) && !creative.video_id && !hasFeedVideos) {
        return "Billede";
    }
    if (creative.thumbnail_url && !creative.video_id && objectType !== "VIDEO") {
        return "Billede";
    }

    return "Ukendt";
}

/**
 * Fetch creative metadata for specific ad IDs (ads with spend in the brief window).
 * @param {string} accessToken
 * @param {string[]} adIds
 */
async function fetchCreativeMetaByAdIds(accessToken, adIds) {
    const unique = [...new Set(adIds.filter(Boolean).map(String))];
    const map = new Map();
    if (!unique.length || !accessToken) return map;

    const BATCH = 50;
    for (let i = 0; i < unique.length; i += BATCH) {
        const batch = unique.slice(i, i + BATCH);
        const params = new URLSearchParams({
            access_token: accessToken,
            ids: batch.join(","),
            fields: AD_CREATIVE_FIELDS,
        });
        const res = await fetch(`${META_GRAPH}/?${params.toString()}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) continue;
        const json = await res.json();
        if (json.error) continue;
        for (const [id, ad] of Object.entries(json)) {
            if (!ad || typeof ad !== "object" || id === "error") continue;
            map.set(String(id), {
                adName: ad.name || "",
                creative: ad.creative && typeof ad.creative === "object" ? ad.creative : {},
            });
        }
    }
    return map;
}

async function fetchAccountWindow(opts) {
    const { accessToken, adAccountId, startDate, endDate, metaIdInclude, metaIdExclude } = opts;
    const { effectiveInclude, exclude } = parseMetaIdFilter(metaIdInclude, metaIdExclude);
    const useBreakdown = exclude.length > 0 && effectiveInclude.length === 0;
    const filtering =
        effectiveInclude.length > 0
            ? [{ field: "country", operator: "IN", value: effectiveInclude }]
            : null;
    const url = buildInsightsUrl({
        accessToken,
        adAccountId,
        startDate,
        endDate,
        fields: [
            "spend",
            "impressions",
            "reach",
            "frequency",
            "clicks",
            "actions",
            "action_values",
        ],
        level: "account",
        breakdowns: useBreakdown ? ["country"] : null,
        filtering,
    });
    let rows = await fetchInsightsPages(url);
    if (useBreakdown) {
        rows = rows.filter((row) => {
            const c = String(row.country || "").toUpperCase();
            return c && !exclude.includes(c);
        });
    }
    if (!rows.length) {
        return metricsFromAggregated({
            spend: 0,
            impressions: 0,
            clicks: 0,
            reach: 0,
            frequency: 0,
            actions: [],
            action_values: [],
        });
    }
    return metricsFromAggregated(aggregateRows(rows));
}

async function fetchCampaignWindow(opts) {
    const { accessToken, adAccountId, startDate, endDate, metaIdInclude, metaIdExclude } = opts;
    const { effectiveInclude, exclude } = parseMetaIdFilter(metaIdInclude, metaIdExclude);
    const useBreakdown = exclude.length > 0 && effectiveInclude.length === 0;
    const filtering =
        effectiveInclude.length > 0
            ? [{ field: "country", operator: "IN", value: effectiveInclude }]
            : null;
    const url = buildInsightsUrl({
        accessToken,
        adAccountId,
        startDate,
        endDate,
        fields: [
            "campaign_name",
            "spend",
            "impressions",
            "clicks",
            "actions",
            "action_values",
        ],
        level: "campaign",
        breakdowns: useBreakdown ? ["country"] : null,
        filtering,
    });
    let rows = await fetchInsightsPages(url);
    if (useBreakdown) {
        rows = rows.filter((row) => {
            const c = String(row.country || "").toUpperCase();
            return c && !exclude.includes(c);
        });
        const byName = {};
        for (const row of rows) {
            const key = row.campaign_name || "Unknown";
            if (!byName[key]) byName[key] = [];
            byName[key].push(row);
        }
        rows = Object.entries(byName).map(([campaign_name, group]) => ({
            campaign_name,
            ...aggregateRows(group),
        }));
    }
    return rows
        .map((row) => {
            const agg = aggregateRows([row]);
            const m = metricsFromAggregated(agg);
            return {
                name: row.campaign_name || "Unknown",
                spend: m.spend,
                revenue: m.revenue,
                conversions: m.conversions,
                roas: m.roas,
                cpa: m.cpa,
            };
        })
        .filter((r) => r.spend > 0)
        .sort((a, b) => b.spend - a.spend);
}

function attachComparisons(current, previous) {
    return {
        ...current,
        vsPrev: {
            spend: pctChange(current.spend, previous?.spend),
            revenue: pctChange(current.revenue, previous?.revenue),
            conversions: pctChange(current.conversions, previous?.conversions),
            roas: pctChange(current.roas, previous?.roas),
            cpa: pctChange(current.cpa, previous?.cpa),
            frequency: pctChange(current.frequency, previous?.frequency),
            leads: pctChange(current.leads, previous?.leads),
            cpl: pctChange(current.cpl, previous?.cpl),
        },
    };
}

function rollupByType(ads, totalSpend, totalRevenue, totalConv) {
    const byType = new Map();
    for (const ad of ads) {
        const type = ad.type || "Ukendt";
        const cur = byType.get(type) || { type, spend: 0, revenue: 0, conversions: 0 };
        cur.spend += ad.spend;
        cur.revenue += ad.revenue;
        cur.conversions += ad.conversions;
        byType.set(type, cur);
    }
    return [...byType.values()]
        .map((row) => ({
            type: row.type,
            spend: roundN(row.spend, 2),
            revenue: roundN(row.revenue, 2),
            conversions: roundN(row.conversions, 2),
            roas: roundN(safeDiv(row.revenue, row.spend), 2),
            spendSharePct: roundN(safeDiv(row.spend, totalSpend) * 100, 1),
            conversionSharePct: roundN(safeDiv(row.conversions, totalConv) * 100, 1),
        }))
        .sort((a, b) => b.roas - a.roas);
}

/**
 * Compact Meta payload for the Performance Brief.
 */
export async function fetchPerformanceBriefMeta({
    customerId,
    accessToken,
    adAccountId,
    metaIdInclude,
    metaIdExclude,
    windows,
}) {
    const common = { accessToken, adAccountId, metaIdInclude, metaIdExclude };
    const [last7, prev7, last90, campaigns, adPerf] = await Promise.all([
            fetchAccountWindow({ ...common, startDate: windows.last7.start, endDate: windows.last7.end }),
            fetchAccountWindow({ ...common, startDate: windows.prev7.start, endDate: windows.prev7.end }),
            fetchAccountWindow({
                ...common,
                startDate: windows.last90.start,
                endDate: windows.last90.end,
            }).catch(() => null),
            fetchCampaignWindow({
                ...common,
                startDate: windows.last7.start,
                endDate: windows.last7.end,
            }).catch(() => []),
            fetchFacebookAdsAdPerformance({
                accessToken,
                adAccountId,
                startDate: windows.last7.start,
                endDate: windows.last7.end,
                metaIdInclude,
                metaIdExclude,
            }).catch(() => ({ ads: [] })),
        ]);

    const adIds = (adPerf?.ads || []).map((ad) => String(ad.ad_id || "")).filter(Boolean);
    const creativeMetaByAdId = await fetchCreativeMetaByAdIds(accessToken, adIds).catch(
        () => new Map()
    );

    const ads = (adPerf?.ads || []).map((ad) => {
        const adId = String(ad.ad_id || "");
        const meta = creativeMetaByAdId.get(adId);
        const type = classifyMetaAdType(
            ad.ad_name || meta?.adName,
            meta?.creative || {}
        );
        return {
            id: String(ad.ad_id || ""),
            name: ad.ad_name,
            type,
            spend: roundN(ad.ad_spend, 2),
            revenue: roundN(ad.revenue, 2),
            conversions: roundN(ad.conversions, 2),
            roas: roundN(ad.roas, 2),
        };
    });

    const totalSpend = ads.reduce((s, a) => s + a.spend, 0);
    const totalRevenue = ads.reduce((s, a) => s + a.revenue, 0);
    const totalConv = ads.reduce((s, a) => s + a.conversions, 0);
    const adTypes = rollupByType(ads, last7.spend || totalSpend, last7.revenue || totalRevenue, last7.conversions || totalConv);

    const accountType = detectAccountType(
        [
            ...(last90
                ? [
                      { action_type: last90.conversions > 0 ? "purchase" : "", value: last90.conversions },
                      { action_type: last90.leads > 0 ? "lead" : "", value: last90.leads },
                  ]
                : []),
        ].filter((a) => a.action_type),
        last90?.revenue > 0 ? [{ action_type: "purchase", value: String(last90.revenue) }] : []
    );

    let resolvedType = "ecommerce";
    if (last90) {
        if (last90.conversions > 0 && last90.leads > 0) resolvedType = "hybrid";
        else if (last90.conversions > 0 || last90.revenue > 0) resolvedType = "ecommerce";
        else if (last90.leads > 0) resolvedType = "lead";
        else resolvedType = "brand";
    } else if (last7.conversions > 0 || last7.revenue > 0) {
        resolvedType = "ecommerce";
    } else if (last7.leads > 0) {
        resolvedType = "lead";
    } else {
        resolvedType = accountType;
    }

    const campaignTotalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
    const campaignsWithShare = campaigns.slice(0, 15).map((c) => ({
        ...c,
        spendSharePct: roundN(safeDiv(c.spend, campaignTotalSpend) * 100, 1),
    }));

    const worstAds = [...ads]
        .filter((a) => a.spend >= 50)
        .sort((a, b) => a.roas - b.roas)
        .slice(0, 8);
    const topAds = [...ads].sort((a, b) => b.roas - a.roas).slice(0, 8);

    return {
        configured: true,
        dataSource: "Facebook Graph API account insights (same filters as Apex overview)",
        accountType: resolvedType,
        last7: attachComparisons(last7, prev7),
        adTypes,
        campaigns: campaignsWithShare,
        adsForAnalysis: {
            topByRoas: topAds,
            worstByRoas: worstAds,
        },
        checksum: {
            adTypeSpend: roundN(adTypes.reduce((s, t) => s + t.spend, 0), 2),
            accountSpend: last7.spend,
            adTypeRevenue: roundN(adTypes.reduce((s, t) => s + t.revenue, 0), 2),
            accountRevenue: last7.revenue,
            adTypeConversions: roundN(adTypes.reduce((s, t) => s + t.conversions, 0), 2),
            accountConversions: last7.conversions,
        },
    };
}
