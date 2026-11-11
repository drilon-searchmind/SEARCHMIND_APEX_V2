/**
 * Customer "Indeks": YoY performance index for the last 30 days (100 = same as last year).
 *
 * Headline metric:
 *   - ecommerce → store revenue (same definition as the dashboards)
 *   - b2b       → GA4 conversions (customer's configured key events)
 * Per-channel entries show every connected channel; only the headline channel drives `indeks`.
 * Paid-media channels are compared on spend (informational — conversion value is not fetched here).
 *
 * Pure of DB writes: see customerIndeksCron.js for persistence.
 */
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { fetchMergedSources } from "@/lib/mergedSourcesApi";
import { fetchB2BDashboardData } from "@/lib/b2bDashboardApi";
import { isB2BCustomer } from "@/lib/customerBusinessCategory";
import { AD_SPEND_CHANNELS } from "@/lib/mergeAdSpendDaily";
import { isAdSpendPlatformConfigured, isValidIntegrationId } from "@/lib/customerServiceIntegrations";
import { sumChildShopifyRevenue } from "@/lib/parentPropertyMetrics";
import { calcIndeks, round2 } from "@/lib/customerIndeksMath";

dayjs.extend(utc);
dayjs.extend(timezone);

export const INDEKS_TIMEZONE = "Europe/Copenhagen";
const DATE_FORMAT = "YYYY-MM-DD";
/** Platform data lag: the window ends this many days before today. */
export const INDEKS_LAG_DAYS = 2;
export const INDEKS_WINDOW_DAYS = 30;

/** Last 30 days ending 2 days ago, plus the same dates one year earlier. */
export function getIndeksWindows(ref = dayjs()) {
    const end = dayjs(ref).tz(INDEKS_TIMEZONE).subtract(INDEKS_LAG_DAYS, "day");
    const start = end.subtract(INDEKS_WINDOW_DAYS - 1, "day");
    return {
        windowStart: start.format(DATE_FORMAT),
        windowEnd: end.format(DATE_FORMAT),
        compareStart: start.subtract(1, "year").format(DATE_FORMAT),
        compareEnd: end.subtract(1, "year").format(DATE_FORMAT),
    };
}

export function todayKey(ref = dayjs()) {
    return dayjs(ref).tz(INDEKS_TIMEZONE).format(DATE_FORMAT);
}

export { calcIndeks };

function plain(doc) {
    return doc && typeof doc.toObject === "function" ? doc.toObject() : doc;
}

function buildSettings(customer) {
    return {
        customerName: customer.customerName,
        customerType: customer.customerType || "Shopify",
        ...(customer.CustomerSettings || {}),
        CustomerStaticExpenses: customer.CustomerStaticExpenses || {},
    };
}

export function getCustomerClickupId(customer) {
    return String(customer?.CustomerSettings?.customerClickupID || "").trim();
}

/** Is a store (revenue source) configured for this ecommerce customer? */
export function isStoreConfigured(customer) {
    const s = customer?.CustomerSettings || {};
    switch (customer?.customerType || "Shopify") {
        case "Shopify":
            return Boolean(String(s.shopifyUrl || "").trim() && String(s.shopifyApiPassword || "").trim());
        case "WooCommerce":
            return Boolean(
                String(s.wooCommerceApiUrl || "").trim() &&
                    String(s.wooCommerceApiKey || "").trim() &&
                    String(s.wooCommerceApiSecret || "").trim()
            );
        case "Magento":
            return Boolean(String(s.magentoBaseUrl || "").trim() && String(s.magentoAccessToken || "").trim());
        case "DanDomain":
            return Boolean(String(s.danDomain?.shopHost || "").trim());
        case "DanDomainOriginal":
            return Boolean(String(s.danDomainOriginal?.shopAdminUrl || "").trim());
        default:
            return false;
    }
}

function channelEntry({ channel, label, metric, headline = false, current, previous, status, error = "" }) {
    if (status && status !== "calc") {
        return { channel, label, metric, headline, current: null, previous: null, indeks: null, status, error };
    }
    const { indeks, status: calcStatus } = calcIndeks(current, previous);
    return {
        channel,
        label,
        metric,
        headline,
        current: round2(current),
        previous: round2(previous),
        indeks,
        status: calcStatus,
        error,
    };
}

function sumSpend(merged, mergeKey) {
    return (merged?.[mergeKey] || []).reduce((s, d) => s + (parseFloat(d.spend) || 0), 0);
}

/** Informational paid-media spend channels that are connected for this customer. */
function buildSpendChannels(settings, cur, prev) {
    const out = [];
    for (const ch of AD_SPEND_CHANNELS) {
        if (!isAdSpendPlatformConfigured(settings, ch.id)) continue; // skip channels not set up
        out.push(
            channelEntry({
                channel: ch.id,
                label: ch.label,
                metric: "spend",
                current: sumSpend(cur, ch.mergeKey),
                previous: sumSpend(prev, ch.mergeKey),
            })
        );
    }
    return out;
}

async function settle(promise) {
    try {
        return { ok: true, value: await promise };
    } catch (err) {
        return { ok: false, error: err?.message || String(err) };
    }
}

function finalize(base, perChannel) {
    const headlineCh = perChannel.find((c) => c.headline);
    if (!headlineCh) {
        return { ...base, indeks: null, status: "no_data", lastError: "", perChannel };
    }
    if (headlineCh.status === "error") {
        return { ...base, indeks: null, status: "error", lastError: headlineCh.error || "Fetch failed", perChannel };
    }
    if (headlineCh.status === "ok") {
        return { ...base, indeks: headlineCh.indeks, status: "ok", lastError: "", perChannel };
    }
    if (headlineCh.status === "insufficient_history") {
        return { ...base, indeks: null, status: "insufficient_history", lastError: "", perChannel };
    }
    // no_data / not_connected
    return { ...base, indeks: null, status: "no_data", lastError: "", perChannel };
}

async function computeEcommerce(customer, settings, w) {
    const channels = [];
    const revenueType = customer?.CustomerSettings?.customerRevenueType || "total_sales";
    const opts = { dailyBreakdown: true, source: "customer-indeks" };

    const [curR, prevR] = await Promise.all([
        settle(fetchMergedSources(settings, w.windowStart, w.windowEnd, opts)),
        settle(fetchMergedSources(settings, w.compareStart, w.compareEnd, opts)),
    ]);

    if (!curR.ok || !prevR.ok) {
        const msg = curR.error || prevR.error;
        channels.push(
            channelEntry({
                channel: "store",
                label: "Store revenue",
                metric: "revenue",
                headline: true,
                status: "error",
                error: msg,
            })
        );
        return channels;
    }

    const cur = curR.value;
    const prev = prevR.value;

    if (isStoreConfigured(customer)) {
        const csettings = customer.CustomerSettings || {};
        channels.push(
            channelEntry({
                channel: "store",
                label: "Store revenue",
                metric: "revenue",
                headline: true,
                current: sumChildShopifyRevenue(cur.shopifyDaily || [], revenueType, csettings),
                previous: sumChildShopifyRevenue(prev.shopifyDaily || [], revenueType, csettings),
            })
        );
    } else {
        channels.push(
            channelEntry({
                channel: "store",
                label: "Store revenue",
                metric: "revenue",
                headline: true,
                status: "not_connected",
            })
        );
    }

    channels.push(...buildSpendChannels(settings, cur, prev));
    return channels;
}

async function computeB2B(customer, settings, w) {
    const channels = [];
    const ga4PropertyId = String(customer?.CustomerSettings?.ga4PropertyId || "").trim();
    const opts = { source: "customer-indeks" };

    const [curR, prevR] = await Promise.all([
        settle(fetchB2BDashboardData(customer, w.windowStart, w.windowEnd, opts)),
        settle(fetchB2BDashboardData(customer, w.compareStart, w.compareEnd, opts)),
    ]);

    if (!curR.ok || !prevR.ok) {
        channels.push(
            channelEntry({
                channel: "ga4_conversions",
                label: "GA4 conversions",
                metric: "conversions",
                headline: true,
                status: "error",
                error: curR.error || prevR.error,
            })
        );
        return channels;
    }

    const cur = curR.value;
    const prev = prevR.value;

    if (isValidIntegrationId(ga4PropertyId)) {
        channels.push(
            channelEntry({
                channel: "ga4_conversions",
                label: "GA4 conversions",
                metric: "conversions",
                headline: true,
                current: cur.ga4Totals?.conversions,
                previous: prev.ga4Totals?.conversions,
            }),
            channelEntry({
                channel: "ga4_sessions",
                label: "GA4 sessions",
                metric: "sessions",
                current: cur.ga4Totals?.sessions,
                previous: prev.ga4Totals?.sessions,
            })
        );
    } else {
        channels.push(
            channelEntry({
                channel: "ga4_conversions",
                label: "GA4 conversions",
                metric: "conversions",
                headline: true,
                status: "not_connected",
            })
        );
    }

    channels.push(...buildSpendChannels(settings, cur, prev));
    return channels;
}

/**
 * Compute the Indeks for one customer document (lean or mongoose). Never throws.
 * @returns {Promise<object>} snapshot fields (without history / computedAt)
 */
export async function computeCustomerIndeks(customerDoc, { ref } = {}) {
    const customer = plain(customerDoc);
    const w = getIndeksWindows(ref);
    const b2b = isB2BCustomer(customer);
    const base = {
        customerId: String(customer._id),
        customerClickupId: getCustomerClickupId(customer),
        customerName: customer.customerName || "",
        businessCategory: b2b ? "b2b" : "ecommerce",
        headlineMetric: b2b ? "conversions" : "revenue",
        ...w,
    };

    try {
        const settings = buildSettings(customer);
        const perChannel = b2b
            ? await computeB2B(customer, settings, w)
            : await computeEcommerce(customer, settings, w);
        return finalize(base, perChannel);
    } catch (err) {
        return {
            ...base,
            indeks: null,
            status: "error",
            lastError: err?.message || String(err),
            perChannel: [],
        };
    }
}
