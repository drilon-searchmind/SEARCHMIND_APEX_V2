/**
 * Meta (Facebook) ad account currency → DKK, using the same FX table as Google Ads.
 */
import { getCurrencyConversionTable, conversionRateToDkk } from "./currencyConversionTable";

const GRAPH_VERSION = "v21.0";
const ACCOUNT_CURRENCY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** @type {Map<string, { currency: string, expires: number }>} */
const accountCurrencyCache = new Map();

export function formatFacebookAdAccountId(adAccountId) {
    const s = String(adAccountId || "").trim();
    if (!s) return "";
    return s.startsWith("act_") ? s : `act_${s}`;
}

/**
 * @param {string} adAccountId
 * @param {string} accessToken
 * @returns {Promise<string>} ISO 4217 code (e.g. USD, DKK)
 */
export async function fetchFacebookAdAccountCurrency(adAccountId, accessToken) {
    const actId = formatFacebookAdAccountId(adAccountId);
    if (!actId || !accessToken) return "DKK";

    const cached = accountCurrencyCache.get(actId);
    if (cached && cached.expires > Date.now()) return cached.currency;

    const url = `https://graph.facebook.com/${GRAPH_VERSION}/${actId}?fields=currency&access_token=${encodeURIComponent(accessToken)}`;
    try {
        const res = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });
        if (!res.ok) {
            console.warn(`[Meta currency] Failed to load account currency (${res.status}) for ${actId}`);
            return "DKK";
        }
        const data = await res.json();
        if (data.error) {
            console.warn(`[Meta currency] Graph error for ${actId}:`, data.error.message || data.error);
            return "DKK";
        }
        const currency = String(data.currency || "DKK").toUpperCase();
        accountCurrencyCache.set(actId, { currency, expires: Date.now() + ACCOUNT_CURRENCY_CACHE_TTL_MS });
        return currency;
    } catch (e) {
        console.warn("[Meta currency] fetch failed:", e?.message || e);
        return "DKK";
    }
}

/**
 * Multiply account-currency amounts by this to get DKK (same as Google Ads merged sources).
 * @param {string} adAccountId
 * @param {string} accessToken
 * @param {Record<string, { code: string, value: number }>} [currencyData]
 */
export async function getMetaAdsConversionRateToDkk(adAccountId, accessToken, currencyData) {
    const table =
        currencyData ||
        (await getCurrencyConversionTable()).data;
    const accountCurrency = await fetchFacebookAdAccountCurrency(adAccountId, accessToken);
    return conversionRateToDkk(accountCurrency, table);
}

export function scaleMetaAmount(amount, rate) {
    const n = typeof amount === "number" ? amount : parseFloat(amount || 0);
    if (!Number.isFinite(n)) return 0;
    if (!rate || rate === 1) return n;
    return n * rate;
}

/** Apex Radar / insight daily rows (spend + purchase action_values). */
export function applyMetaDkkRateToDailyInsightRows(rows, rate) {
    if (!rows?.length || !rate || rate === 1) return rows || [];
    return rows.map((row) => ({
        ...row,
        spend: scaleMetaAmount(row.spend, rate),
        action_values: (row.action_values || []).map((a) => ({
            ...a,
            value: String(scaleMetaAmount(parseFloat(a.value || 0), rate)),
        })),
    }));
}

function convertPsMetricsRow(row, rate) {
    if (!row || !rate || rate === 1) return row;
    const ad_spend = scaleMetaAmount(row.ad_spend ?? row.spend, rate);
    const conversion_value =
        row.conversion_value != null
            ? scaleMetaAmount(row.conversion_value, rate)
            : row.revenue != null
              ? scaleMetaAmount(row.revenue, rate)
              : undefined;
    const clicks = row.clicks ?? 0;
    const link_clicks = row.link_clicks ?? clicks;
    const impressions = row.impressions ?? 0;
    const conversions = row.conversions ?? 0;

    const out = {
        ...row,
        ad_spend,
        spend: row.spend != null ? ad_spend : row.spend,
    };
    if (conversion_value != null) {
        out.conversion_value = conversion_value;
        if (row.revenue != null) out.revenue = conversion_value;
    }
    if (row.aov != null || conversions > 0) {
        out.aov = conversions > 0 && conversion_value != null ? conversion_value / conversions : row.aov;
    }
    out.cpc = clicks > 0 ? ad_spend / clicks : row.cpc ?? 0;
    out.cpm = impressions > 0 ? (ad_spend / impressions) * 1000 : row.cpm ?? 0;
    out.cpa = conversions > 0 ? ad_spend / conversions : row.cpa ?? 0;
    out.conv_rate =
        link_clicks > 0
            ? conversions / link_clicks
            : clicks > 0
              ? conversions / clicks
              : row.conv_rate ?? 0;
    return out;
}

/** Paid Social dashboard payload (metrics_by_date, campaigns, funnel, etc.). */
export function applyMetaDkkConversionToPsDashboard(data, rate) {
    if (!data || !rate || rate === 1) return data;
    return {
        ...data,
        metrics_by_date: (data.metrics_by_date || []).map((r) => convertPsMetricsRow(r, rate)),
        campaigns_performance: (data.campaigns_performance || []).map((r) => convertPsMetricsRow(r, rate)),
        campaigns_by_date: (data.campaigns_by_date || []).map((r) => convertPsMetricsRow(r, rate)),
        placements: (data.placements || []).map((r) => convertPsMetricsRow(r, rate)),
        funnel_spend_by_date: (data.funnel_spend_by_date || []).map((f) => ({
            ...f,
            prospecting_spend: scaleMetaAmount(f.prospecting_spend, rate),
            retargeting_spend: scaleMetaAmount(f.retargeting_spend, rate),
            other_spend: scaleMetaAmount(f.other_spend, rate),
        })),
        account_currency: "DKK",
        meta_spend_conversion_rate: rate,
    };
}
