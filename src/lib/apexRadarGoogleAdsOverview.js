/**
 * Apex Radar — Google Ads overview: account-level daily metrics (same rollups / windows as Meta).
 */

import { extractGoogleAdsClientErrorMessage, fetchGoogleAdsMetrics } from "@/lib/googleAdsApi";
import { APEX_RADAR_CHANNEL_GOOGLE_ADS } from "@/lib/apexRadarChannels";
import { buildGoogleOverviewApexOnlySlice, getGoogleApexRadarSettings } from "@/lib/apexRadarCustomerSettings";
import {
    computeDateWindows,
    getUtcCalendarSpendDodRange,
    maxIso,
    minIso,
    rollOverviewWindows,
} from "@/lib/apexRadarFacebookOverview";

const GOOGLE_ROLL_OPTS = {
    getApexSettings: getGoogleApexRadarSettings,
    channel: APEX_RADAR_CHANNEL_GOOGLE_ADS,
    defaultCustomerSettings: { google: {} },
};

const FETCH_CONCURRENCY = 6;

/**
 * Sum Google Ads query rows (campaign or geo) into Meta-shaped daily rows for {@link rollupDaily}.
 * @param {object[]} metrics — raw rows from `fetchGoogleAdsMetrics`
 */
export function aggregateGoogleAdsMetricsToDaily(metrics) {
    const byDate = new Map();
    for (const row of metrics || []) {
        const dateRaw = row.segments?.date;
        if (!dateRaw) continue;
        const dateStr = String(dateRaw).slice(0, 10);
        if (dateStr.length < 10) continue;
        const m = row.metrics || {};
        const costMicros = Number(m.cost_micros ?? 0);
        const spend = Number.isFinite(costMicros) ? costMicros / 1_000_000 : 0;
        const impressions = Number(m.impressions ?? 0) || 0;
        const clicks = Number(m.clicks ?? 0) || 0;
        const conv = Number(m.conversions ?? 0) || 0;
        const convVal = Number(m.conversions_value ?? 0) || 0;

        const cur = byDate.get(dateStr) || {
            spend: 0,
            impressions: 0,
            clicks: 0,
            conv: 0,
            convVal: 0,
        };
        cur.spend += spend;
        cur.impressions += impressions;
        cur.clicks += clicks;
        cur.conv += conv;
        cur.convVal += convVal;
        byDate.set(dateStr, cur);
    }

    return [...byDate.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date_start, a]) => {
            const impr = a.impressions;
            const clicks = a.clicks;
            return {
                date_start,
                spend: a.spend,
                impressions: impr,
                clicks,
                frequency: null,
                ctr: impr > 0 ? (clicks / impr) * 100 : null,
                actions: [{ action_type: "purchase", value: String(a.conv) }],
                action_values: [{ action_type: "purchase", value: String(a.convVal) }],
            };
        });
}

function placeholderRowNoGoogleAdsCustomer(customer, startDate, endDate) {
    const w = computeDateWindows(startDate, endDate);
    const dod = getUtcCalendarSpendDodRange();
    const id = String(customer._id);
    const apexSlice = buildGoogleOverviewApexOnlySlice(customer);
    return {
        id,
        customerId: id,
        entity: customer.customerName || "Unnamed customer",
        value: {
            conversions2d: null,
            value7d: null,
            minExpectedValue7d: null,
            value30d: null,
            minExpectedValue30d: null,
        },
        targets: apexSlice.targets,
        budget: apexSlice.budget,
        ads: {
            adFatigue: null,
            ctr7d: null,
            ctr30d: null,
            freq7d: null,
            freq30d: null,
        },
        alerts: apexSlice.alerts,
        customerApexRadarSettings: customer.customerApexRadarSettings || { google: {} },
        spendDayOverDay: {
            calendarYesterday: dod.calendarYesterday,
            calendarDayBeforeYesterday: dod.calendarDayBeforeYesterday,
            spendYesterday: null,
            spendDayBeforeYesterday: null,
            pctChangeFromPrior: null,
            warnDrop: false,
        },
        apexRadarMeta: {
            channel: APEX_RADAR_CHANNEL_GOOGLE_ADS,
            skipReason: "no_google_ads_customer_id",
            windows: w,
        },
    };
}

async function poolMap(items, concurrency, mapper) {
    const results = new Array(items.length);
    let idx = 0;
    async function worker() {
        for (;;) {
            const i = idx++;
            if (i >= items.length) break;
            results[i] = await mapper(items[i], i);
        }
    }
    const n = Math.min(concurrency, items.length);
    await Promise.all(Array.from({ length: n }, worker));
    return results;
}

/**
 * @param {object} opts
 * @param {string} opts.startDate
 * @param {string} opts.endDate
 * @param {object[]} opts.customers
 * @param {(id: string) => boolean} [opts.isDemoCustomer]
 * @param {(customer: object) => object} [opts.buildDemoRow]
 */
export async function fetchApexRadarGoogleAdsOverviewRows({
    startDate,
    endDate,
    customers,
    isDemoCustomer = () => false,
    buildDemoRow = null,
}) {
    if (!startDate || !endDate || endDate < startDate) {
        throw new Error("Invalid date range");
    }

    const windows = computeDateWindows(startDate, endDate);
    const dod = getUtcCalendarSpendDodRange();
    const fetchUntilExtended = maxIso(windows.fetchUntil, dod.calendarYesterday);
    const fetchSinceExtended = minIso(windows.fetchSince, dod.calendarDayBeforeYesterday);
    const rangeStart = minIso(windows.weeklyFloorsSince, fetchSinceExtended);
    const rangeEnd = fetchUntilExtended;

    const byCustomerId = new Map();

    for (const customer of customers) {
        const id = String(customer._id);
        if (isDemoCustomer(id)) {
            if (buildDemoRow) {
                byCustomerId.set(id, buildDemoRow(customer, startDate, endDate));
            }
            continue;
        }
        const settings = customer.CustomerSettings || {};
        const googleCid = (settings.googleAdsCustomerId || "").trim();
        if (!googleCid) {
            byCustomerId.set(id, placeholderRowNoGoogleAdsCustomer(customer, startDate, endDate));
        }
    }

    const jobs = customers.filter((c) => {
        const id = String(c._id);
        if (isDemoCustomer(id)) return false;
        const gid = (c.CustomerSettings?.googleAdsCustomerId || "").trim();
        return Boolean(gid);
    });

    const results = await poolMap(jobs, FETCH_CONCURRENCY, async (customer) => {
        const id = String(customer._id);
        const settings = customer.CustomerSettings || {};
        const googleAdsCustomerId = (settings.googleAdsCustomerId || "").trim();
        const countryFilter = settings.googleAdsCountryFilter || undefined;
        const countryExclude = settings.googleAdsCountryExclude || undefined;
        try {
            const { metrics } = await fetchGoogleAdsMetrics(
                googleAdsCustomerId,
                rangeStart,
                rangeEnd,
                countryFilter,
                countryExclude,
                { quietLog: true }
            );
            const daily = aggregateGoogleAdsMetricsToDaily(metrics);
            return {
                customer,
                daily,
                error: null,
            };
        } catch (e) {
            return {
                customer,
                daily: [],
                error: extractGoogleAdsClientErrorMessage(e),
            };
        }
    });

    for (const res of results) {
        const id = String(res.customer._id);
        if (res.error) {
            const emptyRow = rollOverviewWindows(
                res.customer,
                startDate,
                endDate,
                [],
                null,
                GOOGLE_ROLL_OPTS
            );
            byCustomerId.set(id, {
                ...emptyRow,
                apexRadarMeta: {
                    ...emptyRow.apexRadarMeta,
                    googleError: res.error,
                    windows,
                },
            });
        } else {
            byCustomerId.set(
                id,
                rollOverviewWindows(res.customer, startDate, endDate, res.daily, null, GOOGLE_ROLL_OPTS)
            );
        }
    }

    const rows = customers.map((c) => byCustomerId.get(String(c._id))).filter((r) => r != null);

    return { rows, windows };
}
