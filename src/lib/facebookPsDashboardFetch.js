/**
 * Extended Meta insights fetch for Paid Social service dashboard.
 */

import { parseMetaIdFilter } from "./facebookApi";
import {
    buildFunnelSpendByDate,
    mapCampaignMetricsRow,
    mapDailyMetricsRow,
    mapPlacementMetricsRow,
} from "./facebookPsDashboardUtils";

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

function buildBaseParams({
    accessToken,
    apiUrl,
    since,
    until,
    fields,
    level,
    timeIncrement,
    breakdowns,
    effectiveInclude,
    useBreakdown,
}) {
    const params = new URLSearchParams({
        access_token: accessToken,
        time_range: JSON.stringify({ since, until }),
        fields: fields.join(","),
        level,
        limit: "500",
    });
    if (timeIncrement) params.set("time_increment", String(timeIncrement));
    if (effectiveInclude.length > 0) {
        params.append(
            "filtering",
            JSON.stringify([{ field: "country", operator: "IN", value: effectiveInclude }])
        );
    }
    if (useBreakdown && breakdowns?.length) {
        params.append("breakdowns", JSON.stringify(breakdowns));
    }
    return `${apiUrl}?${params.toString()}`;
}

function mergeActions(rows) {
    const actionsByType = {};
    const actionValuesByType = {};
    for (const a of rows.actions || []) {
        actionsByType[a.action_type] = (actionsByType[a.action_type] || 0) + parseFloat(a.value || 0);
    }
    for (const a of rows.action_values || []) {
        actionValuesByType[a.action_type] =
            (actionValuesByType[a.action_type] || 0) + parseFloat(a.value || 0);
    }
    return {
        actions: Object.entries(actionsByType).map(([action_type, v]) => ({
            action_type,
            value: String(v),
        })),
        action_values: Object.entries(actionValuesByType).map(([action_type, v]) => ({
            action_type,
            value: String(v),
        })),
    };
}

function aggregateAccountDailyWithCountryBreakdown(accountRows, exclude) {
    const filtered = accountRows.filter((row) => {
        const c = (row.country || "").toUpperCase();
        return c && !exclude.includes(c);
    });
    const byDate = {};
    for (const row of filtered) {
        const key = row.date_start || "";
        if (!byDate[key]) {
            byDate[key] = {
                date_start: key,
                spend: 0,
                clicks: 0,
                impressions: 0,
                inline_link_clicks: 0,
                reach: 0,
                frequency: 0,
                actions: [],
                action_values: [],
            };
        }
        byDate[key].spend += parseFloat(row.spend || 0);
        byDate[key].clicks += parseFloat(row.clicks || 0);
        byDate[key].impressions += parseFloat(row.impressions || 0);
        byDate[key].inline_link_clicks += parseFloat(row.inline_link_clicks || row.clicks || 0);
        byDate[key].reach += parseFloat(row.reach || 0);
        byDate[key].frequency = Math.max(byDate[key].frequency, parseFloat(row.frequency || 0));
        if (row.actions) byDate[key].actions.push(...row.actions);
        if (row.action_values) byDate[key].action_values.push(...(row.action_values || []));
    }
    return Object.values(byDate)
        .map((r) => {
            const merged = mergeActions(r);
            return {
                date_start: r.date_start,
                spend: r.spend,
                clicks: r.clicks,
                impressions: r.impressions,
                inline_link_clicks: r.inline_link_clicks,
                reach: r.reach,
                frequency: r.frequency,
                ...merged,
            };
        })
        .sort((a, b) => (a.date_start || "").localeCompare(b.date_start || ""));
}

function aggregateCampaignRowsWithCountryBreakdown(campaignRows, exclude) {
    const filtered = campaignRows.filter((row) => {
        const c = (row.country || "").toUpperCase();
        return c && !exclude.includes(c);
    });
    const byCampaign = {};
    for (const row of filtered) {
        const key = row.campaign_name || "Unknown";
        if (!byCampaign[key]) {
            byCampaign[key] = {
                campaign_name: key,
                spend: 0,
                clicks: 0,
                impressions: 0,
                inline_link_clicks: 0,
                reach: 0,
                frequency: 0,
                actions: [],
                action_values: [],
            };
        }
        byCampaign[key].spend += parseFloat(row.spend || 0);
        byCampaign[key].clicks += parseFloat(row.clicks || 0);
        byCampaign[key].impressions += parseFloat(row.impressions || 0);
        byCampaign[key].inline_link_clicks += parseFloat(row.inline_link_clicks || row.clicks || 0);
        byCampaign[key].reach += parseFloat(row.reach || 0);
        byCampaign[key].frequency = Math.max(byCampaign[key].frequency, parseFloat(row.frequency || 0));
        if (row.actions) byCampaign[key].actions.push(...row.actions);
        if (row.action_values) byCampaign[key].action_values.push(...(row.action_values || []));
    }
    return Object.values(byCampaign).map((r) => {
        const merged = mergeActions(r);
        return { ...r, ...merged };
    });
}

function aggregatePlacementRowsWithCountryBreakdown(placementRows, exclude) {
    const filtered = placementRows.filter((row) => {
        const c = (row.country || "").toUpperCase();
        return c && !exclude.includes(c);
    });
    const byPlacement = {};
    for (const row of filtered) {
        const key = row.publisher_platform || "unknown";
        if (!byPlacement[key]) {
            byPlacement[key] = {
                publisher_platform: key,
                spend: 0,
                clicks: 0,
                impressions: 0,
                inline_link_clicks: 0,
                reach: 0,
                frequency: 0,
                actions: [],
                action_values: [],
            };
        }
        byPlacement[key].spend += parseFloat(row.spend || 0);
        byPlacement[key].clicks += parseFloat(row.clicks || 0);
        byPlacement[key].impressions += parseFloat(row.impressions || 0);
        byPlacement[key].inline_link_clicks += parseFloat(row.inline_link_clicks || row.clicks || 0);
        byPlacement[key].reach += parseFloat(row.reach || 0);
        byPlacement[key].frequency = Math.max(
            byPlacement[key].frequency,
            parseFloat(row.frequency || 0)
        );
        if (row.actions) byPlacement[key].actions.push(...row.actions);
        if (row.action_values) byPlacement[key].action_values.push(...(row.action_values || []));
    }
    return Object.values(byPlacement).map((r) => {
        const merged = mergeActions(r);
        return { ...r, ...merged };
    });
}

function aggregateCampaignDailyWithCountryBreakdown(rows, exclude) {
    const filtered = rows.filter((row) => {
        const c = (row.country || "").toUpperCase();
        return c && !exclude.includes(c);
    });
    const byKey = {};
    for (const row of filtered) {
        const key = `${row.date_start || ""}::${row.campaign_name || "Unknown"}`;
        if (!byKey[key]) {
            byKey[key] = {
                date_start: row.date_start,
                campaign_name: row.campaign_name || "Unknown",
                spend: 0,
            };
        }
        byKey[key].spend += parseFloat(row.spend || 0);
    }
    return Object.values(byKey);
}

/**
 * @param {object} config
 * @returns {Promise<object>}
 */
export async function fetchFacebookPsDashboardExtended({
    accessToken,
    adAccountId,
    startDate,
    endDate,
    metaIdInclude,
    metaIdExclude,
}) {
    const formattedAccountId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
    const apiUrl = `https://graph.facebook.com/v21.0/${formattedAccountId}/insights`;

    const includeStr = metaIdInclude || "";
    const excludeStr = metaIdExclude || "";
    const { effectiveInclude, exclude } = parseMetaIdFilter(includeStr, excludeStr);
    const useBreakdown = exclude.length > 0 && effectiveInclude.length === 0;

    const accountFields = [
        "spend",
        "clicks",
        "impressions",
        "inline_link_clicks",
        "reach",
        "frequency",
        "actions",
        "action_values",
        "date_start",
    ];

    const accountUrl = buildBaseParams({
        accessToken,
        apiUrl,
        since: startDate,
        until: endDate,
        fields: accountFields,
        level: "account",
        timeIncrement: 1,
        breakdowns: useBreakdown ? ["country"] : null,
        effectiveInclude,
        useBreakdown,
    });

    let accountRows = await fetchInsightsPages(accountUrl);
    if (useBreakdown && accountRows.length > 0) {
        accountRows = aggregateAccountDailyWithCountryBreakdown(accountRows, exclude);
    }

    const metrics_by_date = accountRows.map(mapDailyMetricsRow).sort((a, b) => a.date.localeCompare(b.date));

    const campaignFields = [
        "campaign_name",
        "spend",
        "clicks",
        "impressions",
        "inline_link_clicks",
        "reach",
        "frequency",
        "actions",
        "action_values",
    ];

    const campaignsUrl = buildBaseParams({
        accessToken,
        apiUrl,
        since: startDate,
        until: endDate,
        fields: campaignFields,
        level: "campaign",
        timeIncrement: null,
        breakdowns: useBreakdown ? ["country"] : null,
        effectiveInclude,
        useBreakdown,
    });

    let campaignRows = await fetchInsightsPages(campaignsUrl);
    if (useBreakdown && campaignRows.length > 0) {
        campaignRows = aggregateCampaignRowsWithCountryBreakdown(campaignRows, exclude);
    }

    const campaigns_performance = campaignRows
        .map(mapCampaignMetricsRow)
        .filter((r) => r.ad_spend > 0 || r.impressions > 0)
        .sort((a, b) => b.ad_spend - a.ad_spend);

    const top_campaigns = [...campaigns_performance]
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 5)
        .map((r) => ({
            campaign_name: r.campaign_name,
            clicks: r.clicks,
            impressions: r.impressions,
            conversions: r.conversions,
            ctr: r.ctr,
        }));

    const placementUrl = buildBaseParams({
        accessToken,
        apiUrl,
        since: startDate,
        until: endDate,
        fields: campaignFields,
        level: "account",
        timeIncrement: null,
        breakdowns: useBreakdown ? ["country", "publisher_platform"] : ["publisher_platform"],
        effectiveInclude,
        useBreakdown,
    });

    let placementRows = [];
    try {
        placementRows = await fetchInsightsPages(placementUrl);
        if (useBreakdown && placementRows.length > 0) {
            placementRows = aggregatePlacementRowsWithCountryBreakdown(placementRows, exclude);
        }
    } catch (e) {
        console.warn("[Facebook PS] Placement insights unavailable:", e.message);
    }

    const placements = placementRows
        .map(mapPlacementMetricsRow)
        .filter((r) => r.ad_spend > 0 || r.impressions > 0)
        .sort((a, b) => b.ad_spend - a.ad_spend);

    let funnel_spend_by_date = [];
    try {
        const funnelUrl = buildBaseParams({
            accessToken,
            apiUrl,
            since: startDate,
            until: endDate,
            fields: ["campaign_name", "spend", "date_start"],
            level: "campaign",
            timeIncrement: 1,
            breakdowns: useBreakdown ? ["country"] : null,
            effectiveInclude,
            useBreakdown,
        });
        let funnelRows = await fetchInsightsPages(funnelUrl);
        if (useBreakdown && funnelRows.length > 0) {
            funnelRows = aggregateCampaignDailyWithCountryBreakdown(funnelRows, exclude);
        }
        funnel_spend_by_date = buildFunnelSpendByDate(funnelRows);
    } catch (e) {
        console.warn("[Facebook PS] Funnel daily spend unavailable:", e.message);
        funnel_spend_by_date = metrics_by_date.map((d) => ({
            date: d.date,
            prospecting_spend: d.ad_spend * 0.55,
            retargeting_spend: d.ad_spend * 0.35,
            other_spend: d.ad_spend * 0.1,
        }));
    }

    let account_summary = {
        new_customer_ratio: null,
        recurring_customer_ratio: null,
    };
    try {
        const summaryUrl = buildBaseParams({
            accessToken,
            apiUrl,
            since: startDate,
            until: endDate,
            fields: ["reach", "frequency", "spend", "impressions", "actions", "action_values"],
            level: "account",
            timeIncrement: null,
            breakdowns: null,
            effectiveInclude,
            useBreakdown: false,
        });
        const summaryRows = await fetchInsightsPages(summaryUrl);
        if (summaryRows[0]) {
            const m = mapDailyMetricsRow({ ...summaryRows[0], date_start: endDate });
            account_summary = {
                ...account_summary,
                period_reach: m.reach,
                period_frequency: m.frequency,
            };
        }
    } catch (e) {
        console.warn("[Facebook PS] Account summary unavailable:", e.message);
    }

    const campaigns_by_date = [];
    const topNames = top_campaigns.map((c) => c.campaign_name).slice(0, 5);
    for (const campaignName of topNames) {
        try {
            const filters = [
                { field: "campaign.name", operator: "EQUAL", value: campaignName },
            ];
            if (effectiveInclude.length > 0) {
                filters.push({ field: "country", operator: "IN", value: effectiveInclude });
            }
            const params = new URLSearchParams({
                access_token: accessToken,
                time_range: JSON.stringify({ since: startDate, until: endDate }),
                fields: "campaign_name,spend,clicks,impressions,inline_link_clicks,actions,date_start",
                level: "campaign",
                filtering: JSON.stringify(filters),
            });
            if (useBreakdown) params.append("breakdowns", JSON.stringify(["country"]));
            const dailyRows = await fetchInsightsPages(`${apiUrl}?${params.toString()}`);
            let rows = dailyRows;
            if (useBreakdown) {
                const byKey = {};
                for (const row of rows.filter((r) => {
                    const c = (r.country || "").toUpperCase();
                    return c && !exclude.includes(c);
                })) {
                    const key = row.date_start || "";
                    if (!byKey[key]) byKey[key] = { date_start: key, campaign_name: campaignName, spend: 0, clicks: 0, impressions: 0, actions: [] };
                    byKey[key].spend += parseFloat(row.spend || 0);
                    byKey[key].clicks += parseFloat(row.clicks || 0);
                    byKey[key].impressions += parseFloat(row.impressions || 0);
                    if (row.actions) byKey[key].actions.push(...row.actions);
                }
                rows = Object.values(byKey);
            }
            for (const row of rows) {
                const m = mapDailyMetricsRow({ ...row, campaign_name: campaignName });
                campaigns_by_date.push({
                    date: m.date,
                    campaign_name: campaignName,
                    clicks: m.clicks,
                    impressions: m.impressions,
                    conversions: m.conversions,
                    ad_spend: m.ad_spend,
                    ctr: m.ctr,
                    conv_rate: m.conv_rate,
                    cpc: m.cpc,
                    cpm: m.cpm,
                });
            }
        } catch (err) {
            console.error(`[Facebook PS] Daily campaign ${campaignName}:`, err.message);
        }
    }

    return {
        metrics_by_date,
        top_campaigns,
        campaigns_by_date,
        campaigns_performance,
        placements,
        funnel_spend_by_date,
        account_summary,
    };
}
