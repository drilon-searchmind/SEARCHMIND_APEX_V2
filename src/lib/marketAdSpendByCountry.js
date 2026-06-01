/**

 * Fetch paid-media spend once by ISO-2 country, then allocate to Shopify Markets in memory.

 */



import { fetchFacebookAdsInsights } from "./facebookApi";

import { fetchGoogleAdsSpendByIso2Map } from "./googleAdsApi";

import { fetchSnapchatSpendByIso2Map } from "./snapchatApi";

import { normalizeSnapchatSettings } from "./snapchatCustomerSettings";

import { fetchRedditSpendByIso2Map, resolveRedditAccessTokenForCustomer } from "./redditApi";

import { normalizeRedditSettings } from "./redditCustomerSettings";

import { isAdSpendPlatformConfigured } from "./customerServiceIntegrations";

import { getCurrencyConversionTable, conversionRateToDkk } from "./currencyConversionTable";

import { isoCodeFromBillingCountryName } from "./shopifyMarketAdSpendCountries";

import { AD_SPEND_CHANNELS } from "./mergeAdSpendDaily";



const FACEBOOK_APP_TOKEN = process.env.FACEBOOK_APP_TOKEN;



/**

 * @param {Map<string, number>|Record<string, number>} mapOrRecord

 * @param {string[]} isoCodes

 */

export function sumSpendForIsoCodes(mapOrRecord, isoCodes) {

    const map = mapOrRecord instanceof Map ? mapOrRecord : null;

    const rec = map ? null : mapOrRecord || {};

    let total = 0;

    for (const raw of isoCodes || []) {

        const iso = String(raw || "")

            .trim()

            .toUpperCase();

        if (iso.length !== 2) continue;

        total += map ? Number(map.get(iso) || 0) : Number(rec[iso] || 0);

    }

    return total;

}



/**

 * @param {Record<string, Map<string, number>>} byChannel

 * @param {string[]} isoCodes

 */

export function channelSpendTotalsForMarket(byChannel, isoCodes) {

    return {

        google_spend: sumSpendForIsoCodes(byChannel.google, isoCodes),

        meta_spend: sumSpendForIsoCodes(byChannel.meta, isoCodes),

        pinterest_spend: sumSpendForIsoCodes(byChannel.pinterest, isoCodes),

        snapchat_spend: sumSpendForIsoCodes(byChannel.snapchat, isoCodes),

        bing_spend: sumSpendForIsoCodes(byChannel.bing, isoCodes),

        reddit_spend: sumSpendForIsoCodes(byChannel.reddit, isoCodes),

    };

}



/** @param {Record<string, unknown>} row */

function facebookRowCountryCode(row) {

    const raw =

        row.country ??

        row.country_code ??

        row.COUNTRY ??

        row.COUNTRY_CODE ??

        "";

    const s = String(raw).trim();

    if (s.length === 2) return s.toUpperCase();

    return isoCodeFromBillingCountryName(s) || "";

}



/**

 * Build a merged-sources-shaped object from channel spend totals (for metrics pipeline).

 * @param {Record<string, number>} channelTotals — keys like meta_spend, google_spend

 * @param {string} period — YYYY-MM-DD anchor for synthetic daily rows

 */

export function buildSyntheticMergedFromChannelTotals(channelTotals, period) {

    /** @type {Record<string, Array<{ period: string, spend: number }>>} */

    const merged = {};

    for (const c of AD_SPEND_CHANNELS) {

        const spend = Number(channelTotals[c.metricsDataKey] || 0);

        merged[c.mergeKey] =

            spend > 0 ? [{ period, spend }] : [];

    }

    return merged;

}



/**

 * One fetch per platform with geo breakdown; returns spend totals by ISO-2.

 * @param {Record<string, unknown>} settings

 * @param {string} startDate

 * @param {string} endDate

 * @param {{ excludeAdSpendPlatforms?: string[] }} [options]

 */

export async function fetchAdSpendByIso2Country(settings, startDate, endDate, options = {}) {

    const excluded = new Set(options.excludeAdSpendPlatforms || []);

    const include = (id) => !excluded.has(id);

    const { data: currencyData } = await getCurrencyConversionTable();



    /** @type {Record<string, Map<string, number>>} */

    const out = {

        google: new Map(),

        meta: new Map(),

        pinterest: new Map(),

        snapchat: new Map(),

        bing: new Map(),

        reddit: new Map(),

    };



    const tasks = [];



    if (include("facebook") && isAdSpendPlatformConfigured(settings, "facebook") && FACEBOOK_APP_TOKEN) {

        tasks.push(

            (async () => {

                try {

                    const fbRes = await fetchFacebookAdsInsights(

                        settings.facebookAdAccountId,

                        "",

                        "",

                        FACEBOOK_APP_TOKEN,

                        startDate,

                        endDate,

                        { dailyBreakdown: true, forceCountryBreakdown: true }

                    );

                    for (const row of fbRes?.data || []) {

                        const iso = facebookRowCountryCode(row);

                        if (!iso) continue;

                        const spend = parseFloat(row.spend) || 0;

                        out.meta.set(iso, (out.meta.get(iso) || 0) + spend);

                    }

                } catch (e) {

                    console.error("[Markets] Facebook spend by country:", e);

                }

            })()

        );

    }



    if (include("google") && isAdSpendPlatformConfigured(settings, "google")) {

        tasks.push(

            (async () => {

                try {

                    const { byIso, currencyCode } = await fetchGoogleAdsSpendByIso2Map(
                        settings.googleAdsCustomerId,
                        startDate,
                        endDate,
                        { quietLog: true }
                    );
                    const rate = conversionRateToDkk(currencyCode || "DKK", currencyData);
                    for (const [iso, cost] of byIso) {
                        out.google.set(iso, (out.google.get(iso) || 0) + cost * rate);
                    }

                } catch (e) {

                    console.error("[Markets] Google spend by country:", e);

                }

            })()

        );

    }



    if (include("reddit") && isAdSpendPlatformConfigured(settings, "reddit")) {

        tasks.push(

            (async () => {

                try {

                    const red = normalizeRedditSettings(settings);

                    const acc = (red.accountId || "").trim();

                    if (!acc) return;

                    const token = await resolveRedditAccessTokenForCustomer(red);

                    if (!token) return;

                    out.reddit = await fetchRedditSpendByIso2Map({

                        accessToken: token,

                        accountId: acc,

                        startDate,

                        endDate,

                        redditUsername: red.redditUsername,

                        redditCredentials: red,

                    });

                } catch (e) {

                    console.error("[Markets] Reddit spend by country:", e);

                }

            })()

        );

    }



    if (include("snapchat") && isAdSpendPlatformConfigured(settings, "snapchat")) {

        tasks.push(

            (async () => {

                try {

                    const snap = normalizeSnapchatSettings(settings);

                    const snapAdId = (snap.adAccountId || "").trim();

                    if (!snapAdId) return;

                    const { resolveSnapchatAccessTokenForCustomer } = await import("./snapchatApi");

                    const token = await resolveSnapchatAccessTokenForCustomer(snap);

                    if (!token) return;

                    out.snapchat = await fetchSnapchatSpendByIso2Map({

                        accessToken: token,

                        adAccountId: snapAdId,

                        startDate,

                        endDate,

                        snapCredentials: snap,

                    });

                } catch (e) {

                    console.error("[Markets] Snapchat spend by country:", e);

                }

            })()

        );

    }



    await Promise.all(tasks);

    return out;

}


