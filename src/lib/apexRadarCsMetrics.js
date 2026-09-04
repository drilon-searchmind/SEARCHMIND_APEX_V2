import { getCustomerById } from "@root/lib/customerOperations";
import { extractGoogleAdsClientErrorMessage, fetchGoogleAdsMetrics } from "@/lib/googleAdsApi";
import { aggregateGoogleAdsMetricsToDaily } from "@/lib/apexRadarGoogleAdsOverview";
import {
    addDaysIso,
    buildAccountInsightsRelativeUrl,
    fetchAccountInsightsDailyPaginated,
    getUtcCalendarSpendDodRange,
    normalizeDailyInsightRows,
} from "@/lib/apexRadarFacebookOverview";
import { conversionsFromActions } from "@/lib/apexRadarFacebookConversionEvents";
import { getSearchConsoleClient } from "@/lib/searchConsoleClient";
import {
    mapReportRows,
    searchMerchantReportsWithSlotFallback,
} from "@/lib/merchantCenter/merchantCenterReports";
import { normalizeMerchantAccountSlot } from "@/lib/merchantCenter/merchantCenterAuth";
import { getPlacedOrderMetricId } from "@/lib/klaviyoDashboard";
import ApexRadarCsMerchantSnapshot from "@/models/ApexRadarCsMerchantSnapshot";
import { isValidIntegrationId } from "@/lib/customerServiceIntegrations";
import { csPctChange } from "@/lib/apexRadarCsRules";

const CS_LOOKBACK_DAYS = 16;
const KLAVIYO_BASE = "https://a.klaviyo.com/api";
const KLAVIYO_REVISION = "2024-10-15";
/** Klaviyo flow reports require flow_id + flow_message_id in group_by. */
const KLAVIYO_FLOW_GROUP_BY = ["flow_id", "flow_message_id", "send_channel"];

function toPlain(doc) {
    if (!doc) return null;
    if (typeof doc.toObject === "function") return doc.toObject();
    return { ...doc };
}

function googleAdsConfigured() {
    return Boolean(
        process.env.GOOGLE_ADS_CLIENT_ID &&
            process.env.GOOGLE_ADS_CLIENT_SECRET &&
            process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
            process.env.GOOGLE_ADS_REFRESH_TOKEN
    );
}

function dodWindows(utcToday) {
    const currentEnd = addDaysIso(utcToday, -1);
    const priorEnd = addDaysIso(utcToday, -2);
    return {
        currentStart: currentEnd,
        currentEnd,
        priorStart: priorEnd,
        priorEnd,
    };
}

function wowWindows(anchorEnd) {
    const currentEnd = anchorEnd;
    const currentStart = addDaysIso(currentEnd, -6);
    const priorEnd = addDaysIso(currentStart, -1);
    const priorStart = addDaysIso(priorEnd, -6);
    return { currentStart, currentEnd, priorStart, priorEnd };
}

function windowLabel(win) {
    if (!win) return null;
    if (win.currentStart === win.currentEnd) return win.currentEnd;
    return `${win.currentStart}–${win.currentEnd}`;
}

function priorWindowLabel(win) {
    if (!win) return null;
    if (win.priorStart === win.priorEnd) return win.priorEnd;
    return `${win.priorStart}–${win.priorEnd}`;
}

function sumDaily(daily, from, to, key) {
    let sum = 0;
    for (const row of daily || []) {
        if (row.date >= from && row.date <= to) sum += Number(row[key] || 0);
    }
    return sum;
}

function comparisonFromDaily(daily, key, period, utcToday, wowAnchorEnd = null) {
    const win = period === "wow" ? wowWindows(wowAnchorEnd || addDaysIso(utcToday, -1)) : dodWindows(utcToday);
    const current = sumDaily(daily, win.currentStart, win.currentEnd, key);
    const prior = sumDaily(daily, win.priorStart, win.priorEnd, key);
    return {
        current,
        prior,
        pctChange: csPctChange(current, prior),
        currentLabel: windowLabel(win),
        priorLabel: priorWindowLabel(win),
    };
}

function latestDateInDaily(daily) {
    const dates = (daily || []).map((d) => d.date).filter(Boolean).sort();
    return dates.length ? dates[dates.length - 1] : null;
}

function kpisFromDaily(daily, keys, utcToday, wowAnchorEnd = null) {
    /** @type {Record<string, { dod: object, wow: object }>} */
    const kpis = {};
    for (const key of keys) {
        kpis[key] = {
            dod: comparisonFromDaily(daily, key, "dod", utcToday),
            wow: comparisonFromDaily(daily, key, "wow", utcToday, wowAnchorEnd),
        };
    }
    return kpis;
}

function unavailablePlatform(skipReason, extra = {}) {
    return { configured: false, skipReason, kpis: {}, ...extra };
}

function errorPlatform(error, extra = {}) {
    return { configured: true, error: String(error || "Unknown error"), kpis: {}, ...extra };
}

function getActionValue(actions, actionType) {
    if (!actions) return 0;
    const action = actions.find((a) => a.action_type === actionType);
    return parseFloat(action?.value || 0);
}

function purchaseValueFromActionValues(actionValues) {
    if (!actionValues) return 0;
    return (
        getActionValue(actionValues, "purchase") ||
        getActionValue(actionValues, "omni_purchase") ||
        getActionValue(actionValues, "offsite_conversion.fb_pixel_purchase")
    );
}

async function fetchGoogleAdsDaily(customer, startDate, endDate) {
    const settings = customer.CustomerSettings || {};
    const googleCid = String(settings.googleAdsCustomerId || "").trim();
    if (!isValidIntegrationId(googleCid)) return unavailablePlatform("no_google_ads_customer_id");
    if (!googleAdsConfigured()) return unavailablePlatform("google_ads_not_configured");

    try {
        const { metrics } = await fetchGoogleAdsMetrics(
            googleCid,
            startDate,
            endDate,
            settings.googleAdsCountryFilter || undefined,
            settings.googleAdsCountryExclude || undefined,
            { quietLog: true }
        );
        const daily = aggregateGoogleAdsMetricsToDaily(metrics).map((row) => ({
            date: row.date_start,
            conversions: Number(
                (row.actions || []).find((a) => a.action_type === "purchase")?.value || 0
            ),
            spend: Number(row.spend || 0),
            revenue: Number((row.action_values || []).find((a) => a.action_type === "purchase")?.value || 0),
        }));
        return { configured: true, daily };
    } catch (e) {
        return errorPlatform(extractGoogleAdsClientErrorMessage(e));
    }
}

async function fetchMetaDaily(customer, startDate, endDate) {
    const settings = customer.CustomerSettings || {};
    const adId = String(settings.facebookAdAccountId || "").trim();
    const accessToken = String(process.env.FACEBOOK_APP_TOKEN || "").trim();
    if (!isValidIntegrationId(adId)) return unavailablePlatform("no_facebook_ad_account");
    if (!accessToken) return unavailablePlatform("facebook_token_missing");

    try {
        const metaIdInclude = settings.customerMetaID || "";
        const metaIdExclude = settings.customerMetaIDExclude || "";
        const relativeUrl = buildAccountInsightsRelativeUrl(
            adId,
            startDate,
            endDate,
            metaIdInclude,
            metaIdExclude
        );
        const exclude = typeof metaIdExclude === "string"
            ? metaIdExclude.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean)
            : [];
        const include = typeof metaIdInclude === "string"
            ? metaIdInclude.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean)
            : [];
        const useBreakdown = exclude.length > 0 && include.filter((c) => !exclude.includes(c)).length === 0;
        const rawRows = await fetchAccountInsightsDailyPaginated(accessToken, relativeUrl);
        const normalized = normalizeDailyInsightRows(rawRows, { useBreakdown, exclude });
        const daily = normalized.map((row) => ({
            date: row.date_start,
            conversions: conversionsFromActions(row.actions, null),
            spend: Number(row.spend || 0),
            revenue: purchaseValueFromActionValues(row.action_values),
        }));
        return { configured: true, daily };
    } catch (e) {
        return errorPlatform(e?.message || e);
    }
}

async function fetchSeoDaily(customer, startDate, endDate) {
    const siteUrl = String(customer.CustomerSettings?.googleSearchConsoleProperty || "").trim();
    if (!isValidIntegrationId(siteUrl)) return unavailablePlatform("no_search_console_property");

    try {
        const searchconsole = await getSearchConsoleClient();
        const res = await searchconsole.searchanalytics.query({
            siteUrl,
            requestBody: {
                startDate,
                endDate,
                dimensions: ["date"],
                rowLimit: 1000,
            },
        });
        const daily = (res.data?.rows || []).map((row) => ({
            date: String(row.keys?.[0] || "").slice(0, 10),
            clicks: Number(row.clicks || 0),
            impressions: Number(row.impressions || 0),
        })).filter((row) => row.date.length === 10);
        return { configured: true, daily };
    } catch (e) {
        return errorPlatform(e?.message || e);
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function klaviyoFetchJson(url, options, maxRetries = 5) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const res = await fetch(url, options);
        if (res.status !== 429) {
            const text = await res.text();
            let json = null;
            try {
                json = text ? JSON.parse(text) : null;
            } catch {
                json = null;
            }
            return { ok: res.ok, status: res.status, json, text };
        }
        const errText = await res.text();
        let waitMs = 1500;
        try {
            const errJson = JSON.parse(errText);
            const detail = errJson.errors?.[0]?.detail || "";
            const match = detail.match(/Expected available in (\d+) second/);
            if (match) waitMs = (parseInt(match[1], 10) + 1) * 1000;
        } catch {
            /* ignore */
        }
        if (attempt >= maxRetries - 1) {
            return { ok: false, status: 429, json: null, text: errText };
        }
        await sleep(waitMs);
    }
    return { ok: false, status: 429, json: null, text: "rate limited" };
}

function eachDayInclusive(startDate, endDate) {
    const days = [];
    let d = startDate;
    while (d <= endDate) {
        days.push(d);
        d = addDaysIso(d, 1);
    }
    return days;
}

function parseFlowSeriesDaily(json, startDate, endDate) {
    const results = json?.data?.attributes?.results || json?.data?.attributes?.result || [];
    const dates = eachDayInclusive(startDate, endDate);
    const byDate = new Map(dates.map((date) => [date, { date, flow_mails: 0, conversions: 0, revenue: 0 }]));

    const list = Array.isArray(results) ? results : [];
    for (const row of list) {
        const stats = row.statistics || {};
        const dateKey = String(row.date || row.timeframe?.start || row.groupings?.date || "").slice(0, 10);
        const recipients = stats.recipients;
        const conversions = stats.conversions;
        const revenue = stats.conversion_value;

        if (Array.isArray(recipients) || Array.isArray(conversions) || Array.isArray(revenue)) {
            const recArr = Array.isArray(recipients) ? recipients : [];
            const convArr = Array.isArray(conversions) ? conversions : [];
            const revArr = Array.isArray(revenue) ? revenue : [];
            const len = Math.max(recArr.length, convArr.length, revArr.length, dates.length);
            for (let i = 0; i < len && i < dates.length; i++) {
                const cur = byDate.get(dates[i]);
                if (!cur) continue;
                cur.flow_mails += Number(recArr[i] || 0);
                cur.conversions += Number(convArr[i] || 0);
                cur.revenue += Number(revArr[i] || 0);
            }
            continue;
        }

        if (dateKey.length === 10 && byDate.has(dateKey)) {
            const cur = byDate.get(dateKey);
            cur.flow_mails += Number(recipients || 0);
            cur.conversions += Number(conversions || 0);
            cur.revenue += Number(revenue || 0);
        }
    }

    return [...byDate.values()];
}

async function fetchFlowValuesWindow(apiKey, conversionMetricId, startDate, endDate) {
    const startIso = `${startDate}T00:00:00+00:00`;
    const endIso = `${endDate}T23:59:59+00:00`;
    const body = {
        data: {
            type: "flow-values-report",
            attributes: {
                timeframe: { start: startIso, end: endIso },
                conversion_metric_id: conversionMetricId,
                filter: 'equals(send_channel,"email")',
                statistics: ["recipients", "conversions", "conversion_value"],
                group_by: KLAVIYO_FLOW_GROUP_BY,
            },
        },
    };
    const res = await klaviyoFetchJson(`${KLAVIYO_BASE}/flow-values-reports/`, {
        method: "POST",
        headers: {
            Authorization: `Klaviyo-API-Key ${apiKey}`,
            Accept: "application/json",
            "Content-Type": "application/json",
            revision: KLAVIYO_REVISION,
        },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        throw new Error(`Klaviyo flow-values-reports ${res.status}: ${res.text?.slice(0, 240) || ""}`);
    }
    const results = res.json?.data?.attributes?.results || [];
    let flow_mails = 0;
    let conversions = 0;
    let revenue = 0;
    for (const row of results) {
        const s = row.statistics || {};
        flow_mails += Number(s.recipients || 0);
        conversions += Number(s.conversions || 0);
        revenue += Number(s.conversion_value || 0);
    }
    return { flow_mails, conversions, revenue };
}

async function fetchEmailDaily(customer, startDate, endDate, utcToday) {
    const apiKey = String(customer.CustomerSettings?.klaviyoPrivateApiKey || "").trim();
    if (!isValidIntegrationId(apiKey)) return unavailablePlatform("no_klaviyo_key");

    try {
        const conversionMetricId = await getPlacedOrderMetricId(apiKey);
        if (!conversionMetricId) {
            return errorPlatform("Placed Order metric not found in Klaviyo");
        }

        const startIso = `${startDate}T00:00:00+00:00`;
        const endIso = `${endDate}T23:59:59+00:00`;
        const seriesBody = {
            data: {
                type: "flow-series-report",
                attributes: {
                    timeframe: { start: startIso, end: endIso },
                    interval: "daily",
                    conversion_metric_id: conversionMetricId,
                    filter: 'equals(send_channel,"email")',
                    statistics: ["recipients", "conversions", "conversion_value"],
                    group_by: KLAVIYO_FLOW_GROUP_BY,
                },
            },
        };
        const seriesRes = await klaviyoFetchJson(`${KLAVIYO_BASE}/flow-series-reports/`, {
            method: "POST",
            headers: {
                Authorization: `Klaviyo-API-Key ${apiKey}`,
                Accept: "application/json",
                "Content-Type": "application/json",
                revision: KLAVIYO_REVISION,
            },
            body: JSON.stringify(seriesBody),
        });

        if (seriesRes.ok) {
            const daily = parseFlowSeriesDaily(seriesRes.json, startDate, endDate);
            return { configured: true, daily };
        }

        const dod = dodWindows(utcToday);
        const wow = wowWindows(addDaysIso(utcToday, -1));
        const dodCurrent = await fetchFlowValuesWindow(
            apiKey,
            conversionMetricId,
            dod.currentStart,
            dod.currentEnd
        );
        const dodPrior = await fetchFlowValuesWindow(apiKey, conversionMetricId, dod.priorStart, dod.priorEnd);
        const wowCurrent = await fetchFlowValuesWindow(
            apiKey,
            conversionMetricId,
            wow.currentStart,
            wow.currentEnd
        );
        const wowPrior = await fetchFlowValuesWindow(apiKey, conversionMetricId, wow.priorStart, wow.priorEnd);

        return {
            configured: true,
            daily: [],
            kpis: {
                flow_mails: {
                    dod: {
                        current: dodCurrent.flow_mails,
                        prior: dodPrior.flow_mails,
                        pctChange: csPctChange(dodCurrent.flow_mails, dodPrior.flow_mails),
                        currentLabel: windowLabel(dod),
                        priorLabel: priorWindowLabel(dod),
                    },
                    wow: {
                        current: wowCurrent.flow_mails,
                        prior: wowPrior.flow_mails,
                        pctChange: csPctChange(wowCurrent.flow_mails, wowPrior.flow_mails),
                        currentLabel: windowLabel(wow),
                        priorLabel: priorWindowLabel(wow),
                    },
                },
                conversions: {
                    dod: {
                        current: dodCurrent.conversions,
                        prior: dodPrior.conversions,
                        pctChange: csPctChange(dodCurrent.conversions, dodPrior.conversions),
                        currentLabel: windowLabel(dod),
                        priorLabel: priorWindowLabel(dod),
                    },
                    wow: {
                        current: wowCurrent.conversions,
                        prior: wowPrior.conversions,
                        pctChange: csPctChange(wowCurrent.conversions, wowPrior.conversions),
                        currentLabel: windowLabel(wow),
                        priorLabel: priorWindowLabel(wow),
                    },
                },
                revenue: {
                    dod: {
                        current: dodCurrent.revenue,
                        prior: dodPrior.revenue,
                        pctChange: csPctChange(dodCurrent.revenue, dodPrior.revenue),
                        currentLabel: windowLabel(dod),
                        priorLabel: priorWindowLabel(dod),
                    },
                    wow: {
                        current: wowCurrent.revenue,
                        prior: wowPrior.revenue,
                        pctChange: csPctChange(wowCurrent.revenue, wowPrior.revenue),
                        currentLabel: windowLabel(wow),
                        priorLabel: priorWindowLabel(wow),
                    },
                },
            },
            source: "flow-values-reports",
        };
    } catch (e) {
        return errorPlatform(e?.message || e);
    }
}

function statusFromProductView(row) {
    const raw =
        row?.aggregated_destination_status ||
        row?.aggregatedDestinationStatus ||
        row?.aggregated_reporting_context_status ||
        row?.aggregatedReportingContextStatus ||
        "";
    return String(raw).toUpperCase();
}

async function fetchAndStoreMerchantSnapshot(customer, utcToday) {
    const settings = customer.CustomerSettings || {};
    const merchantAccountId = String(settings.googleMerchantCenterId || "").trim();
    if (!isValidIntegrationId(merchantAccountId)) {
        return { skipReason: "no_merchant_center_id" };
    }

    try {
        const preferredSlot = normalizeMerchantAccountSlot(settings.googleMerchantAccountSlot);
        const queries = [
            "SELECT product_view.id, product_view.aggregated_reporting_context_status FROM product_view",
            "SELECT product_view.id, product_view.aggregated_destination_status FROM product_view",
        ];
        let rows = [];
        let lastError = null;
        for (const query of queries) {
            try {
                const result = await searchMerchantReportsWithSlotFallback(
                    preferredSlot,
                    merchantAccountId,
                    query,
                    { maxPages: 25 }
                );
                rows = result.rows || [];
                lastError = null;
                break;
            } catch (err) {
                lastError = err;
            }
        }
        if (lastError && !rows.length) throw lastError;
        const products = mapReportRows(rows, "product_view");
        const counts = { approved: 0, limited: 0, notEligible: 0, pending: 0, other: 0, total: 0 };
        const seen = new Set();
        for (const row of products) {
            const id = String(row.id || row.offer_id || row.offerId || "");
            if (id && seen.has(id)) continue;
            if (id) seen.add(id);
            counts.total += 1;
            const status = statusFromProductView(row);
            if (status === "ELIGIBLE") counts.approved += 1;
            else if (status === "ELIGIBLE_LIMITED") counts.limited += 1;
            else if (status === "NOT_ELIGIBLE") counts.notEligible += 1;
            else if (status === "PENDING" || status.includes("PENDING")) counts.pending += 1;
            else counts.other += 1;
        }

        await ApexRadarCsMerchantSnapshot.findOneAndUpdate(
            { customerId: customer._id, date: utcToday },
            {
                $set: {
                    approved: counts.approved,
                    limited: counts.limited,
                    notEligible: counts.notEligible,
                    pending: counts.pending,
                    other: counts.other,
                    total: counts.total,
                    capturedAt: new Date(),
                },
            },
            { upsert: true, new: true }
        );

        const yesterday = addDaysIso(utcToday, -1);
        const priorDoc = await ApexRadarCsMerchantSnapshot.findOne({
            customerId: customer._id,
            date: yesterday,
        }).lean();

        if (!priorDoc) {
            return {
                date: utcToday,
                approved: counts.approved,
                limited: counts.limited,
                notEligible: counts.notEligible,
                pending: counts.pending,
                other: counts.other,
                total: counts.total,
                priorApproved: null,
                priorDate: null,
                skipReason: "no_prior_snapshot",
            };
        }

        return {
            date: utcToday,
            approved: counts.approved,
            limited: counts.limited,
            notEligible: counts.notEligible,
            pending: counts.pending,
            other: counts.other,
            total: counts.total,
            priorApproved: priorDoc.approved,
            priorDate: priorDoc.date,
        };
    } catch (e) {
        return { skipReason: "merchant_error", error: e?.message || String(e) };
    }
}

function attachKpis(result, keys, utcToday, wowAnchorEnd) {
    if (!result.configured || result.error) return result;
    if (result.kpis) {
        const { daily, ...rest } = result;
        return rest;
    }
    return {
        configured: true,
        kpis: kpisFromDaily(result.daily, keys, utcToday, wowAnchorEnd),
    };
}

/**
 * Load CS metrics for one customer across Google Ads, Meta, SEO, and Email.
 * @param {string} customerId
 */
export async function fetchApexRadarCsOverviewMetrics(customerId) {
    const customerDoc = await getCustomerById(customerId);
    const customer = toPlain(customerDoc);
    if (!customer) {
        throw new Error("Customer not found");
    }

    const utcToday = getUtcCalendarSpendDodRange().utcToday;
    const rangeEnd = addDaysIso(utcToday, -1);
    const rangeStart = addDaysIso(rangeEnd, -(CS_LOOKBACK_DAYS - 1));

    const [googleRaw, metaRaw, seoRaw, emailRaw, merchant] = await Promise.all([
        fetchGoogleAdsDaily(customer, rangeStart, rangeEnd),
        fetchMetaDaily(customer, rangeStart, rangeEnd),
        fetchSeoDaily(customer, rangeStart, rangeEnd),
        fetchEmailDaily(customer, rangeStart, rangeEnd, utcToday),
        fetchAndStoreMerchantSnapshot(customer, utcToday),
    ]);

    const seoWowAnchor = latestDateInDaily(seoRaw.daily) || addDaysIso(utcToday, -2);

    return {
        customer: {
            customerId: String(customer._id),
            customerName: customer.customerName || "Unnamed customer",
        },
        dateRange: { startDate: rangeStart, endDate: rangeEnd, utcToday },
        platforms: {
            "google-ads": {
                ...attachKpis(googleRaw, ["conversions", "spend", "revenue"], utcToday),
                merchant,
            },
            meta: attachKpis(metaRaw, ["conversions", "spend", "revenue"], utcToday),
            seo: attachKpis(seoRaw, ["clicks", "impressions"], utcToday, seoWowAnchor),
            email: attachKpis(emailRaw, ["flow_mails", "conversions", "revenue"], utcToday),
        },
    };
}
