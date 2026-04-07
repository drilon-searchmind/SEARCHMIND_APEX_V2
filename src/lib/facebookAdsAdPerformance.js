// src/lib/facebookAdsAdPerformance.js — Ad-level insights for PS dashboard only (not merged-sources).

function parseMetaIdFilterInline(includeStr, excludeStr) {
    const parse = (s) =>
        typeof s === "string" ? s.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean) : [];
    const include = parse(includeStr);
    const exclude = parse(excludeStr);
    const effectiveInclude = include.length > 0 ? include.filter((c) => !exclude.includes(c)) : [];
    return { include, exclude, effectiveInclude };
}

function getActionValue(actions, actionType) {
    if (!actions) return 0;
    const action = actions.find((a) => a.action_type === actionType);
    return parseFloat(action?.value || 0);
}

function getActionValueSum(actionValues, actionType) {
    if (!actionValues) return 0;
    const a = actionValues.find((x) => x.action_type === actionType);
    return parseFloat(a?.value || 0);
}

/**
 * Fetch ad-level insights for the date range (aggregated per ad). Paginates Graph API results.
 */
export async function fetchFacebookAdsAdPerformance({
    accessToken,
    adAccountId,
    startDate,
    endDate,
    metaIdInclude,
    metaIdExclude,
}) {
    const formattedAccountId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
    const apiUrl = `https://graph.facebook.com/v21.0/${formattedAccountId}/insights`;

    const { effectiveInclude, exclude } = parseMetaIdFilterInline(metaIdInclude, metaIdExclude);
    const useBreakdown = exclude.length > 0 && effectiveInclude.length === 0;

    const fields = [
        "ad_id",
        "ad_name",
        "spend",
        "impressions",
        "clicks",
        "ctr",
        "actions",
        "action_values",
    ].join(",");

    const baseParams = new URLSearchParams({
        access_token: accessToken,
        time_range: JSON.stringify({ since: startDate, until: endDate }),
        fields,
        level: "ad",
        limit: "500",
    });

    if (effectiveInclude.length > 0) {
        baseParams.append(
            "filtering",
            JSON.stringify([{ field: "country", operator: "IN", value: effectiveInclude }])
        );
    }
    if (useBreakdown) {
        baseParams.append("breakdowns", JSON.stringify(["country"]));
    }

    let url = `${apiUrl}?${baseParams.toString()}`;
    const allRows = [];

    while (url) {
        const res = await fetch(url, { method: "GET", headers: { "Content-Type": "application/json" } });
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Facebook API error: ${res.status} - ${errorText}`);
        }
        const data = await res.json();
        if (data.error) throw new Error(`Facebook API error: ${JSON.stringify(data.error)}`);
        allRows.push(...(data.data || []));
        url = data.paging?.next || null;
    }

    let rows = allRows;
    if (useBreakdown && rows.length > 0) {
        rows = rows.filter((row) => {
            const c = (row.country || "").toUpperCase();
            return c && !exclude.includes(c);
        });
        const byAd = {};
        for (const row of rows) {
            const id = row.ad_id || row.ad_name || "unknown";
            if (!byAd[id]) {
                byAd[id] = {
                    ad_id: row.ad_id,
                    ad_name: row.ad_name || "Unknown",
                    spend: 0,
                    impressions: 0,
                    clicks: 0,
                    actions: [],
                    action_values: [],
                };
            }
            byAd[id].spend += parseFloat(row.spend || 0);
            byAd[id].impressions += parseFloat(row.impressions || 0);
            byAd[id].clicks += parseFloat(row.clicks || 0);
            if (row.actions) byAd[id].actions.push(...row.actions);
            if (row.action_values) byAd[id].action_values.push(...row.action_values);
        }
        rows = Object.values(byAd).map((r) => {
            const mergeActions = (arr) => {
                const m = {};
                for (const a of arr || []) {
                    m[a.action_type] = (m[a.action_type] || 0) + parseFloat(a.value || 0);
                }
                return Object.entries(m).map(([action_type, v]) => ({ action_type, value: String(v) }));
            };
            return {
                ...r,
                actions: mergeActions(r.actions),
                action_values: mergeActions(r.action_values),
            };
        });
    } else if (rows.length > 0) {
        const byAd = {};
        for (const row of rows) {
            const id = row.ad_id || row.ad_name || "unknown";
            if (!byAd[id]) {
                byAd[id] = {
                    ad_id: row.ad_id,
                    ad_name: row.ad_name || "Unknown",
                    spend: 0,
                    impressions: 0,
                    clicks: 0,
                    actions: [],
                    action_values: [],
                };
            }
            byAd[id].spend += parseFloat(row.spend || 0);
            byAd[id].impressions += parseFloat(row.impressions || 0);
            byAd[id].clicks += parseFloat(row.clicks || 0);
            if (row.actions) byAd[id].actions.push(...row.actions);
            if (row.action_values) byAd[id].action_values.push(...row.action_values);
        }
        rows = Object.values(byAd).map((r) => {
            const mergeActions = (arr) => {
                const m = {};
                for (const a of arr || []) {
                    m[a.action_type] = (m[a.action_type] || 0) + parseFloat(a.value || 0);
                }
                return Object.entries(m).map(([action_type, v]) => ({ action_type, value: String(v) }));
            };
            return {
                ...r,
                actions: mergeActions(r.actions),
                action_values: mergeActions(r.action_values),
            };
        });
    }

    const ads = rows
        .map((row) => {
            const spend = parseFloat(row.spend || 0);
            const impressions = parseFloat(row.impressions || 0);
            const clicks = parseFloat(row.clicks || 0);
            const conversions =
                getActionValue(row.actions, "purchase") ||
                getActionValue(row.actions, "omni_purchase") ||
                getActionValue(row.actions, "offsite_conversion.fb_pixel_purchase");
            const revenue =
                getActionValueSum(row.action_values, "purchase") ||
                getActionValueSum(row.action_values, "omni_purchase") ||
                getActionValueSum(row.action_values, "offsite_conversion.fb_pixel_purchase");
            const roas = spend > 0 ? revenue / spend : 0;
            const poas = roas;
            const ctr = impressions > 0 ? clicks / impressions : parseFloat(row.ctr || 0) || 0;
            const convRateClicks = clicks > 0 ? conversions / clicks : 0;
            const convRateImpr = impressions > 0 ? conversions / impressions : 0;
            return {
                platform: "facebook",
                ad_id: String(row.ad_id || ""),
                ad_name: row.ad_name || "Unknown",
                revenue,
                roas,
                poas,
                ad_spend: spend,
                impressions,
                clicks,
                ctr,
                conv_rate_clicks: convRateClicks,
                conv_rate_impressions: convRateImpr,
            };
        })
        .filter((r) => r.impressions > 0 || r.clicks > 0 || r.ad_spend > 0)
        .sort((a, b) => b.revenue - a.revenue);

    return {
        ads,
        currency: "DKK",
        adPerformanceNote: null,
    };
}
