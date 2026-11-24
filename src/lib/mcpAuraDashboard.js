/**
 * MCP helpers for Aura custom dashboards (Emob / EL / Fiber).
 * Applies the same account-wide campaign filter the UI uses under Data inputs.
 */
import connectToDatabase from "@root/lib/mongodb";
import { loadCustomerForMcp } from "@root/lib/mcpDataService";
import { parseMcpDateRange } from "@root/lib/mcpApiHelpers";
import { getInputs } from "@/lib/customDashboardInputs";
import { conversionSeries, normalizeFilter, normalizeGoals, otherCostSeries } from "@/lib/auraInputs";
import {
    auraCostChannelForCustomerName,
    isAuraCustomerName,
} from "@/lib/auraCustomerProfile";
import { isValidIntegrationId } from "@/lib/customerServiceIntegrations";
import { buildExcludeText } from "@/lib/campaignNameFilter";
import { fetchGoogleAdsPPCDashboardMetrics } from "@/lib/googleAdsPpcDashboard";
import { fetchFacebookAdsPSDashboardMetrics } from "@/lib/facebookApi";
import {
    getGoogleAdsDeveloperToken,
    getGoogleAdsManagerCustomerId,
    getGoogleAdsOAuthClientId,
    getGoogleAdsOAuthClientSecret,
    getGoogleAdsRefreshToken,
} from "@/lib/googleAdsOAuthEnv";
import { FILTER_PRESETS } from "@/lib/auraFilterPresets";

function round2(n) {
    const x = Number(n);
    return Number.isFinite(x) ? Math.round(x * 100) / 100 : null;
}

function sumRows(rows, key) {
    return (rows || []).reduce((s, r) => s + (parseFloat(r?.[key]) || 0), 0);
}

function channelEqual(a, b) {
    return (
        String(a?.include || "").trim() === String(b?.include || "").trim() &&
        String(a?.exclude || "").trim() === String(b?.exclude || "").trim() &&
        JSON.stringify(a?.excludeExact || []) === JSON.stringify(b?.excludeExact || [])
    );
}

export function matchAuraFilterPreset(filter) {
    const f = normalizeFilter(filter);
    if (!f.enabled) return null;
    for (const p of FILTER_PRESETS) {
        if (channelEqual(f.google, p.google) && channelEqual(f.meta, p.meta)) return p.id;
    }
    return null;
}

function filterParamsForChannel(filter, channel) {
    if (!filter?.enabled) return { campaignInclude: undefined, campaignExclude: undefined };
    const c = filter[channel] || {};
    const excludeText = buildExcludeText(c.exclude, c.excludeExact);
    return {
        campaignInclude: c.include?.trim() || undefined,
        campaignExclude: excludeText || undefined,
    };
}

async function assertAuraCustomer(customerId) {
    const customer = await loadCustomerForMcp(customerId);
    if (!isAuraCustomerName(customer.customerName)) {
        throw new Error("Not an Aura custom-dashboard customer");
    }
    if (customer.settings?.customDashboardsEnabled !== true && !customer.isDemo) {
        // Still allow when name matches; UI also requires the flag, but MCP should work if inputs exist.
    }
    return customer;
}

/** Saved account-wide campaign filter (+ which preset it matches, if any). */
export async function fetchMcpAuraFilter(customerId) {
    await connectToDatabase();
    const customer = await assertAuraCustomer(customerId);
    const stored = await getInputs(customer.id, "aura");
    const filter = normalizeFilter(stored.filter);
    return {
        readOnly: true,
        customerId: customer.id,
        customerName: customer.customerName,
        filter,
        matchedPreset: matchAuraFilterPreset(filter),
        presets: FILTER_PRESETS.map((p) => ({
            id: p.id,
            label: p.label,
            google: p.google,
            meta: p.meta,
        })),
        note: "One campaign filter for the whole Aura account. It applies to Performance, Pace report and Overview day (configured under Data inputs).",
    };
}

async function fetchGoogleFiltered(customer, startDate, endDate, filter, useFilter) {
    const cs = customer.settings;
    if (!isValidIntegrationId(cs.googleAdsCustomerId)) {
        return { configured: false, spend: null, conversions: null, conversionValue: null, roas: null };
    }
    const { campaignInclude, campaignExclude } = useFilter
        ? filterParamsForChannel(filter, "google")
        : {};
    try {
        const metrics = await fetchGoogleAdsPPCDashboardMetrics({
            developerToken: getGoogleAdsDeveloperToken(),
            clientId: getGoogleAdsOAuthClientId(),
            clientSecret: getGoogleAdsOAuthClientSecret(),
            refreshToken: getGoogleAdsRefreshToken(),
            customerId: cs.googleAdsCustomerId,
            managerCustomerId: getGoogleAdsManagerCustomerId(),
            startDate,
            endDate,
            countryFilter: cs.googleAdsCountryFilter || undefined,
            countryExclude: cs.googleAdsCountryExclude || undefined,
            campaignInclude,
            campaignExclude,
        });
        const rows = metrics.metrics_by_date || [];
        const spend = round2(sumRows(rows, "ad_spend"));
        const conversions = round2(sumRows(rows, "conversions"));
        const conversionValue = round2(sumRows(rows, "conversions_value"));
        return {
            configured: true,
            spend,
            conversions,
            conversionValue,
            roas: spend > 0 && conversionValue != null ? round2(conversionValue / spend) : null,
            filterApplied: Boolean(useFilter && filter?.enabled),
            campaignInclude: campaignInclude || null,
            campaignExclude: campaignExclude || null,
        };
    } catch (err) {
        return {
            configured: true,
            error: err?.message || String(err),
            spend: null,
            conversions: null,
            conversionValue: null,
            roas: null,
            filterApplied: Boolean(useFilter && filter?.enabled),
        };
    }
}

async function fetchMetaFiltered(customer, startDate, endDate, filter, useFilter) {
    const cs = customer.settings;
    if (!isValidIntegrationId(cs.facebookAdAccountId)) {
        return { configured: false, spend: null, conversions: null, conversionValue: null, roas: null };
    }
    const token = process.env.FACEBOOK_APP_TOKEN;
    if (!token) {
        return { configured: true, error: "FACEBOOK_APP_TOKEN not configured", spend: null };
    }
    const { campaignInclude, campaignExclude } = useFilter
        ? filterParamsForChannel(filter, "meta")
        : {};
    try {
        const metrics = await fetchFacebookAdsPSDashboardMetrics({
            accessToken: token,
            adAccountId: cs.facebookAdAccountId,
            startDate,
            endDate,
            metaIdInclude: cs.customerMetaID || undefined,
            metaIdExclude: cs.customerMetaIDExclude || undefined,
            campaignInclude,
            campaignExclude,
            metricsOnly: true,
        });
        const rows = metrics.metrics_by_date || [];
        const spend = round2(sumRows(rows, "ad_spend"));
        const conversions = round2(sumRows(rows, "conversions"));
        const conversionValue = round2(sumRows(rows, "conversion_value"));
        return {
            configured: true,
            spend,
            conversions,
            conversionValue,
            roas: spend > 0 && conversionValue != null ? round2(conversionValue / spend) : null,
            filterApplied: Boolean(useFilter && filter?.enabled),
            campaignInclude: campaignInclude || null,
            campaignExclude: campaignExclude || null,
        };
    } catch (err) {
        return {
            configured: true,
            error: err?.message || String(err),
            spend: null,
            conversions: null,
            conversionValue: null,
            roas: null,
            filterApplied: Boolean(useFilter && filter?.enabled),
        };
    }
}

/**
 * Compact Aura dashboard numbers for a date range, with the saved campaign filter applied
 * (same rules as Performance / Pace / Overview day in the UI).
 *
 * @param {string} customerId
 * @param {Record<string, string | undefined>} query
 */
export async function fetchMcpAuraDashboard(customerId, query = {}) {
    await connectToDatabase();
    const range = parseMcpDateRange(query.startDate, query.endDate);
    const customer = await assertAuraCustomer(customerId);
    const stored = await getInputs(customer.id, "aura");
    const filter = normalizeFilter(stored.filter);
    const useFilter = String(query.useFilter ?? "1") !== "0" && String(query.useFilter ?? "1") !== "false";

    const costChannel = auraCostChannelForCustomerName(customer.customerName);
    const conversions = conversionSeries(stored.conversions, range.startDate, range.endDate);
    const otherCost = otherCostSeries(stored.campaigns, range.startDate, range.endDate, costChannel);
    const goals = normalizeGoals(stored.goals);

    const [google, meta] = await Promise.all([
        fetchGoogleFiltered(customer, range.startDate, range.endDate, filter, useFilter),
        fetchMetaFiltered(customer, range.startDate, range.endDate, filter, useFilter),
    ]);

    const sheetConversions = round2(sumRows(conversions, "value"));
    const sheetOther = round2(sumRows(otherCost, "value"));
    const ppc = google.spend ?? 0;
    const ps = meta.spend ?? 0;
    const totalSpend = round2(ppc + ps + (sheetOther || 0));
    const cac =
        sheetConversions > 0 && totalSpend != null ? round2(totalSpend / sheetConversions) : null;

    // Goals for the start month (pace report uses calendar month goals).
    const start = new Date(`${range.startDate}T00:00:00Z`);
    const monthIndex = start.getUTCMonth();
    const monthGoal = goals[monthIndex] || { goal: 0, budget: 0 };

    return {
        readOnly: true,
        customerId: customer.id,
        customerName: customer.customerName,
        startDate: range.startDate,
        endDate: range.endDate,
        costChannel,
        filter: {
            ...filter,
            matchedPreset: matchAuraFilterPreset(filter),
            applied: Boolean(useFilter && filter.enabled),
        },
        google,
        meta,
        sheet: {
            conversions: sheetConversions,
            otherCost: sheetOther,
            monthGoal: monthGoal.goal,
            monthBudget: monthGoal.budget,
            monthIndex: monthIndex + 1,
        },
        totals: {
            conversions: sheetConversions,
            ppc: google.spend,
            ps: meta.spend,
            other: sheetOther,
            total: totalSpend,
            cac,
        },
        note: "totals.ppc/ps use the saved Aura campaign filter when filter.applied is true (same as the UI dashboards). totals.conversions/other come from Data inputs.",
    };
}
