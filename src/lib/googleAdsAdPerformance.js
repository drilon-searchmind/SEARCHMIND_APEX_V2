// src/lib/googleAdsAdPerformance.js — Ad-level metrics for PPC dashboard only (not merged-sources).
import { GoogleAdsApi } from "google-ads-api";
import currencyApiValues from "./static-data/currencyApiValues.json";

/**
 * Human-readable label for an ad row. Prefer `ad.name`; if empty, use campaign / ad group (lightweight GAQL fields).
 * Avoids selecting creative sub-resources (RSA headlines, etc.) — those explode row size and can stall requests.
 */
export function resolveGoogleAdLabel(row) {
    const ad = row.ad_group_ad?.ad;
    const campaignName = String(row.campaign?.name ?? "").trim();
    const adGroupName = String(row.ad_group?.name ?? "").trim();
    const adName = String(ad?.name ?? "").trim();
    if (adName) return adName;
    if (campaignName && adGroupName) return `${campaignName} · ${adGroupName}`;
    if (campaignName) return campaignName;
    if (adGroupName) return adGroupName;
    const id = ad?.id;
    if (id != null && id !== "") return `Ad ${id}`;
    return "(unnamed ad)";
}

function pickBetterLabel(current, candidate) {
    if (!candidate) return current;
    const tier = (s) => {
        if (!s || s === "(unnamed ad)") return 0;
        if (/^Ad \d+$/.test(String(s))) return 1;
        if (String(s).includes(" · ")) return 3;
        return 2;
    };
    const tc = tier(candidate);
    const tcur = tier(current);
    if (tc > tcur) return candidate;
    if (tc < tcur) return current;
    return String(candidate).length >= String(current).length ? candidate : current;
}

/**
 * Fetch aggregated ad-level performance for a date range.
 * Country filters (used elsewhere on the dashboard) do not apply at ad granularity in this query;
 * the API returns account-wide ad totals for the range.
 */
export async function fetchGoogleAdsAdPerformance({
    developerToken,
    clientId,
    clientSecret,
    refreshToken,
    customerId,
    managerCustomerId,
    startDate,
    endDate,
}) {
    const client = new GoogleAdsApi({
        client_id: clientId,
        client_secret: clientSecret,
        developer_token: developerToken,
    });
    const customer = client.Customer({
        customer_id: customerId,
        refresh_token: refreshToken,
        login_customer_id: managerCustomerId || undefined,
    });

    let accountCurrency = "DKK";
    try {
        const currencyResponse = await customer.query(`SELECT customer.currency_code FROM customer`);
        accountCurrency = currencyResponse[0]?.customer?.currency_code || "DKK";
    } catch (err) {
        console.warn("Google Ads ad performance: could not fetch currency:", err?.message);
    }

    const fromCode = accountCurrency;
    const toCode = "DKK";
    const currencyData = currencyApiValues.data;
    let conversionRate = 1;
    if (fromCode !== toCode && currencyData[fromCode] && currencyData[toCode]) {
        conversionRate = currencyData[toCode].value / currencyData[fromCode].value;
    }

    const baseSelect = `
        SELECT
            campaign.name,
            ad_group.name,
            ad_group_ad.ad.id,
            ad_group_ad.ad.name,
            segments.date,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            metrics.conversions_value`;

    const queryFull = `${baseSelect},
            metrics.all_conversions_value
        FROM ad_group_ad
        WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
        AND ad_group_ad.status != 'REMOVED'
    `;
    const querySimple = `${baseSelect}
        FROM ad_group_ad
        WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
        AND ad_group_ad.status != 'REMOVED'
    `;

    let response;
    let includeAllConversions = true;
    try {
        response = await customer.query(queryFull);
    } catch (e) {
        console.warn("Google Ads ad performance: retrying without all_conversions_value:", e?.message);
        includeAllConversions = false;
        response = await customer.query(querySimple);
    }
    const rawRows = Array.isArray(response) ? response : response?.results || [];

    const byAd = new Map();
    for (const row of rawRows) {
        const ad = row.ad_group_ad?.ad;
        const adId = ad?.id ?? row.ad_group_ad?.ad?.id;
        if (adId == null) continue;
        const key = String(adId);
        const label = resolveGoogleAdLabel(row);
        if (!byAd.has(key)) {
            byAd.set(key, {
                ad_id: key,
                ad_name: label,
                impressions: 0,
                clicks: 0,
                ad_spend: 0,
                conversions: 0,
                conversions_value: 0,
                all_conversions_value: 0,
            });
        } else {
            const agg = byAd.get(key);
            agg.ad_name = pickBetterLabel(agg.ad_name, label);
        }
        const agg = byAd.get(key);
        const m = row.metrics || {};
        agg.impressions += Number(m.impressions || 0);
        agg.clicks += Number(m.clicks || 0);
        agg.ad_spend += (Number(m.cost_micros || 0) / 1_000_000) * conversionRate;
        agg.conversions += Number(m.conversions || 0);
        agg.conversions_value += Number(m.conversions_value || 0);
        agg.all_conversions_value += Number(
            includeAllConversions ? m.all_conversions_value || 0 : m.conversions_value || 0
        );
    }

    const ads = Array.from(byAd.values())
        .map((r) => {
            const spend = r.ad_spend;
            const revenue = r.conversions_value;
            const allVal = r.all_conversions_value;
            const roas = spend > 0 ? revenue / spend : 0;
            const poas = spend > 0 ? (includeAllConversions ? allVal / spend : roas) : 0;
            const ctr = r.impressions > 0 ? r.clicks / r.impressions : 0;
            const convRateClicks = r.clicks > 0 ? r.conversions / r.clicks : 0;
            const convRateImpr = r.impressions > 0 ? r.conversions / r.impressions : 0;
            return {
                platform: "google",
                ad_id: r.ad_id,
                ad_name: r.ad_name,
                revenue,
                roas,
                poas,
                ad_spend: spend,
                impressions: r.impressions,
                clicks: r.clicks,
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
